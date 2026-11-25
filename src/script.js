// script.js - the char-lab film script language (STAGE.md section 4).
// UMD: window.CharScript in the browser, module.exports in Node. No dependencies.
//
//   CharScript.parse(text, opts?)      -> { film, sets, actors, puppets, props, tracks, statements, diagnostics }
//   CharScript.validate(parsed, lib)   -> extra diagnostics that need the library (sets, skins, puppets, props)
//   CharScript.timeline(parsed, endOf) -> resolves "+n" times with exact end times (the stage calls this)
//
// Every problem becomes a diagnostic { code, line, severity, message } whose message says what to
// write instead. parse() never throws.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.CharScript = factory(root);
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  const REQ = null;   // an argument default of null means "required"

  // Actor vocabulary used when CharPerform is not loaded (mirrors STAGE.md section 2).
  const STANDIN_ACTIONS = {
    walk: { channel: 'body', args: { to: REQ, speed: 1 }, moves: true, doc: 'walk to a place' },
    run: { channel: 'body', args: { to: REQ, speed: 1 }, moves: true, doc: 'run to a place' },
    sneak: { channel: 'body', args: { to: REQ }, moves: true, doc: 'tiptoe to a place' },
    jump: { channel: 'body', args: { to: REQ, height: 1 }, moves: true, doc: 'jump to a place' },
    turn: { channel: 'body', args: {}, moves: false, doc: 'turn around' },
    enter: { channel: 'body', args: { from: 'left' }, moves: true, doc: 'walk in from off screen' },
    stand: { channel: 'body', args: {}, moves: false, doc: 'stand still' },
    idle: { channel: 'body', args: {}, moves: false, doc: 'stand with small life' },
    kneel: { channel: 'body', args: {}, moves: false, doc: 'kneel' },
    crouch: { channel: 'body', args: {}, moves: false, doc: 'crouch' },
    recoil: { channel: 'body', args: {}, moves: false, doc: 'step back in fear' },
    sit: { channel: 'body', args: {}, moves: false, doc: 'sit on the ground' },
    wave: { channel: 'arms', args: { hand: 'near' }, moves: false, doc: 'wave' },
    point: { channel: 'arms', args: { at: REQ }, moves: false, doc: 'point at something' },
    reach: { channel: 'arms', args: { at: REQ }, moves: false, doc: 'reach toward something' },
    cheer: { channel: 'arms', args: {}, moves: false, doc: 'both arms up' },
    hold: { channel: 'arms', args: { prop: REQ, how: 'front' }, moves: false, doc: 'hold a prop: how=up|front|side' },
    drop: { channel: 'arms', args: {}, moves: false, doc: 'let go of the held prop' },
    face: { channel: 'face', args: { mood: 'neutral' }, moves: false, doc: 'mood=happy|scared|determined|surprised|sad|neutral' },
    look: { channel: 'look', args: { at: 'front' }, moves: false, doc: 'look at=<name>|up|down|front' },
    nod: { channel: 'look', args: {}, moves: false, doc: 'nod' },
  };

  const CAM = {
    pan: { channel: 'pos', args: { to: REQ, over: 1.5 }, doc: 'move the camera centre to x, an anchor or an actor' },
    follow: { channel: 'pos', args: { target: REQ, over: 0.8 }, doc: 'keep an actor or puppet centred until the next pan/cut' },
    cut: { channel: 'pos', args: { to: REQ, zoom: 0 }, doc: 'jump instantly (zoom=0 keeps the zoom)' },
    zoom: { channel: 'zoom', args: { to: REQ, over: 1 }, doc: 'zoom level, 1 = whole frame, 1.5 = closer' },
    shake: { channel: 'shake', args: { amount: 8, over: 0.6 }, doc: 'shake in px, dying away' },
    fade: { channel: 'fade', args: { dir: 'out', over: 0.6 }, doc: 'fade to black (out) or back (in)' },
    frame: { channel: 'frame', args: { on: REQ, top: 'head', bottom: 'thigh', x: 0.35, over: 1.2, pad: 0.1 }, doc: 'close-up on an actor (or two: on=Kai+Tess keeps both whole, heads and hands): the frame height runs from top to bottom (head|chin|chest|waist|hip|thigh|knee|feet) and the actor stands at x (0 = left edge, 1 = right edge of the frame); keeps tracking the actor until home()' },
    home: { channel: 'frame', args: { over: 1.2 }, doc: 'leave a frame() close-up: back to the pan/zoom/follow camera' },
  };
  const CAPTION = {
    show: { channel: 'text', args: { text: REQ, for: 3, at: 'bottom', by: '' }, doc: 'caption text; by=<actor> makes a speech bubble' },
    clear: { channel: 'text', args: {}, doc: 'remove the caption now' },
  };
  const CARD = {
    show: { channel: 'card', args: { text: REQ, for: 0, sub: '', fade: 0.7, bg: '' }, doc: 'full-frame card; for=0 = to the end; fade = seconds to fade in; bg = a colour, or none to show the scene' },
  };
  // the film clock: a beat grid that poses snap to, and freezes of the world (the set's sky can keep moving)
  const CLOCK = {
    tempo: { channel: 'tempo', args: { bpm: 120, div: 1, snap: 0.3, who: '' }, doc: 'from now on poses land on a beat grid (bpm, div = steps per beat, snap = share of a step spent moving); bpm=0 = smooth; who=<actor> for one actor only' },
    freeze: { channel: 'freeze', args: { for: 1 }, doc: 'stop the world for= seconds (actors, puppets, water); sets may keep the sky moving' },
  };
  // wind for the spring chains (hair, scarf, cloth); sets do not handle wind
  const WIND = {
    gust: { channel: 'gust', args: { amount: 1, over: 1.5, from: 'right' }, doc: 'a gust that rises fast and dies away over `over` s; amount 1 = strong; from = right | left' },
    blow: { channel: 'blow', args: { amount: 0.3, over: 1, from: 'right' }, doc: 'a steady wind from now on, reached over `over` s; amount 0 = calm' },
  };
  const LEVELS = ['head', 'chin', 'chest', 'waist', 'hip', 'thigh', 'knee', 'feet'];
  const ENUMS = { 'frame.top': LEVELS, 'frame.bottom': LEVELS, 'fade.dir': ['in', 'out'], 'show.at': ['bottom', 'top'], 'gust.from': ['left', 'right'], 'blow.from': ['left', 'right'] };
  const PLACE_KEYS = { to: 1, at: 1, from: 1, target: 1, by: 1, on: 1 };   // keys that accept names of places or things
  const LOOK_WORDS = ['up', 'down', 'front', 'back', 'left', 'right'];

  // ---------- small helpers ----------
  function lev(a, b) {
    const m = a.length, n = b.length, d = [];
    for (let i = 0; i <= m; i++) { d[i] = [i]; }
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1));
    return d[m][n];
  }
  function suggest(word, names) {
    let best = null, bd = 99;
    for (const n of names) { const d = lev(String(word), n); if (d < bd) { bd = d; best = n; } }
    return best && bd <= Math.max(2, Math.floor(String(word).length / 3)) ? ` Did you mean '${best}'?` : '';
  }
  const list = names => names.length ? names.join(', ') : '(none)';
  const fmt = v => typeof v === 'string' ? (/^[A-Za-z_][\w-]*$/.test(v) ? v : JSON.stringify(v)) : String(v);
  function callText(c) {
    const a = Object.keys(c.given || {}).map(k => `${k}=${fmt(c.given[k])}`);
    return `${c.name}(${a.join(', ')})`;
  }

  // split on a separator at bracket depth 0 and outside quotes
  function splitTop(s, sep) {
    const out = []; let depth = 0, q = false, cur = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"' && s[i - 1] !== '\\') q = !q;
      if (!q) { if (ch === '(') depth++; else if (ch === ')') depth--; }
      if (ch === sep && depth === 0 && !q) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out.map(x => x.trim()).filter(x => x.length);
  }
  function stripComment(s) {
    let q = false;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '"' && s[i - 1] !== '\\') q = !q;
      if (s[i] === '#' && !q) return s.slice(0, i);
    }
    return s;
  }
  function value(raw) {
    raw = raw.trim();
    const m = raw.match(/^"((?:[^"\\]|\\.)*)"$/);
    if (m) return { v: m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'), kind: 'string' };
    if (/^-?\d+(\.\d+)?s?$/.test(raw) || /^-?\.\d+s?$/.test(raw)) return { v: parseFloat(raw), kind: 'number' };
    if (/^[A-Za-z_][\w-]*(\+[A-Za-z_][\w-]*)?$/.test(raw)) return { v: raw, kind: 'name' };   // A+B: two actors (cam frame)
    return { v: raw, kind: 'bad' };
  }
  // "name(args)" | "name" | "\"text\""  ->  { name, pos:[{v,kind}], named:{k:{v,kind}} } or { error }
  function parseCall(src) {
    src = src.trim();
    if (/^"/.test(src)) {
      const v = value(src);
      if (v.kind !== 'string') return { error: `unclosed quote in ${src}` };
      return { name: 'show', pos: [v], named: {}, text: src };
    }
    const m = src.match(/^([A-Za-z_]\w*)\s*(?:\((.*)\))?$/);
    if (!m) return { error: `cannot read '${src}'. Write name(arg, key=value), for example walk(to=420) or face(happy).` };
    const pos = [], named = {};
    for (const part of splitTop(m[2] || '', ',')) {
      const kv = part.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
      if (kv) named[kv[1]] = value(kv[2]);
      else pos.push(value(part));
    }
    return { name: m[1], pos, named, text: src };
  }

  // bind a raw call to a schema entry: fills defaults, checks names and types
  function bind(raw, schema, ctx) {
    const where = ctx.where;
    const keys = Object.keys(schema.args);
    const given = {};
    const errs = [];
    raw.pos.forEach((p, i) => {
      if (i >= keys.length) { errs.push(`${raw.name} takes ${keys.length ? keys.length + ' argument(s): ' + keys.join(', ') : 'no arguments'}; remove '${fmt(p.v)}'.`); return; }
      given[keys[i]] = p;
    });
    for (const k of Object.keys(raw.named)) {
      if (!(k in schema.args) && !(schema.channel && (k === 'on' || k === 'prop'))) {   // any action can name a prop it uses (docs/PROPS.md)
        errs.push(`${raw.name} has no argument '${k}'.${suggest(k, keys)} Valid: ${list(keys)}.`); continue; }
      given[k] = raw.named[k];
    }
    const args = {}, out = {};
    for (const k of keys) {
      const def = schema.args[k];
      if (!(k in given)) {
        if (def === REQ) errs.push(`${raw.name} needs ${k}=... (for example ${raw.name}(${k}=${k === 'text' ? '"..."' : (k === 'prop' ? 'lantern' : (k === 'to' ? '400' : 'x'))})).`);
        else args[k] = def;
        continue;
      }
      const g = given[k];
      if (g.kind === 'bad') { errs.push(`cannot read value '${g.v}' for ${k}. Use a number, a name, or "text in quotes".`); continue; }
      if (typeof def === 'number' && g.kind !== 'number' && !PLACE_KEYS[k] && !(k === 'on' && g.kind !== 'bad' && typeof g.v === 'string')) { errs.push(`${raw.name}: ${k} must be a number, got '${g.v}'.`); continue; }
      const en = ENUMS[raw.name + '.' + k];
      if (en && en.indexOf(g.v) < 0) { errs.push(`${raw.name}: ${k}=${g.v} is not valid. Use one of: ${en.join(', ')}.`); continue; }
      args[k] = g.v; out[k] = g.v;
    }
    for (const k of ['on', 'prop']) if (k in given && !(k in schema.args) && given[k].kind !== 'bad') { args[k] = given[k].v; out[k] = given[k].v; }
    return { args, given: out, errs };
  }

  // ---------- parse ----------
  function parse(text, opts) {
    opts = opts || {};
    const G = typeof globalThis !== 'undefined' ? globalThis : root;
    const actions = opts.actions || (G.CharPerform && G.CharPerform.actions) || (G.CharPoses && G.CharPoses.actions) || STANDIN_ACTIONS;
    const P = { film: { title: '', duration: null, line: 0 }, sets: [], actors: [], puppets: [], props: [], tracks: {}, statements: [], diagnostics: [] };
    const D = (code, line, message, severity, extra) => P.diagnostics.push(Object.assign({ code, line, severity: severity || 'error', message }, extra || {}));
    const names = {};   // Name -> 'actor' | 'puppet' | 'prop'
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const timed = [];

    lines.forEach((rawLine, i) => {
      const ln = i + 1;
      const s = stripComment(rawLine).trim();
      if (!s) return;
      let m;
      if ((m = s.match(/^film\b\s*(.*)$/))) {
        const mm = m[1].match(/^"((?:[^"\\]|\\.)*)"\s*(?:(\d+(?:\.\d+)?)\s*s?)?\s*$/);
        if (!mm) { D('syntax', ln, `write the film line as: film "Title" 30s`); return; }
        P.film = { title: mm[1], duration: mm[2] ? parseFloat(mm[2]) : null, line: ln };
        if (!mm[2]) D('syntax', ln, `the film needs a length: film "${mm[1]}" 30s`);
        return;
      }
      if ((m = s.match(/^stage\b\s*(.*)$/))) {   // bare stage: stage width=2400 ground=600 scale=68
        const st = { line: ln };
        for (const w of m[1].split(/\s+/).filter(Boolean)) {
          const kv = w.match(/^(width|ground|scale)=(\d+(?:\.\d+)?)$/);
          if (kv) st[kv[1]] = parseFloat(kv[2]); else D('syntax', ln, `unexpected '${w}'. Write: stage width=2400 ground=600 scale=68 (all optional)`);
        }
        P.stage = st;
        return;
      }
      if ((m = s.match(/^set\b\s*(.*)$/))) {
        const w = m[1].split(/\s+/).filter(Boolean);
        if (!w.length || !/^[A-Za-z_][\w-]*$/.test(w[0])) { D('syntax', ln, `write: set <name> [variant], for example: set hillside dusk`); return; }
        if (P.sets.length) D('one-set', ln, `only one set per film (already 'set ${P.sets[0].name}' on line ${P.sets[0].line}). Delete this line or make a second film.`);
        else P.sets.push({ name: w[0], variant: w[1] || null, line: ln });
        return;
      }
      if ((m = s.match(/^(actor|puppet)\b\s*(.*)$/))) {
        const kind = m[1];
        const re = kind === 'actor'
          ? /^([A-Za-z_]\w*)\s*=\s*skin\s+([A-Za-z_][\w-]*)\s+at\s+(\S+)(.*)$/
          : /^([A-Za-z_]\w*)\s*=\s*([A-Za-z_][\w-]*)\s+at\s+(\S+)(.*)$/;
        const mm = m[2].match(re);
        if (!mm) {
          D('syntax', ln, kind === 'actor' ? `write: actor Kai = skin kai at 120 [facing left] [scale=1]` : `write: puppet Pip = bird at branch [facing left] [scale=1]`);
          return;
        }
        const decl = { name: mm[1], line: ln, at: value(mm[3]).v, facing: 1, scale: 1 };
        if (kind === 'actor') decl.skin = mm[2]; else decl.kind = mm[2];
        const rest = mm[4].trim().split(/\s+/).filter(Boolean);
        for (let k = 0; k < rest.length; k++) {
          const w = rest[k];
          if (w === 'facing') { const f = rest[++k]; if (f === 'left') decl.facing = -1; else if (f === 'right') decl.facing = 1; else D('syntax', ln, `facing must be left or right, got '${f}'.`); }
          else if (/^scale=/.test(w)) { decl.scale = parseFloat(w.slice(6)); if (!(decl.scale > 0)) { D('syntax', ln, `scale must be a positive number, for example scale=0.8`); decl.scale = 1; } }
          else D('syntax', ln, `unexpected '${w}' at the end. Allowed: facing left|right, scale=<n>.`);
        }
        if (names[decl.name]) { D('duplicate', ln, `the name '${decl.name}' is already used for a ${names[decl.name]}. Pick another name.`); return; }
        if (/^(cam|caption|card|clock|wind)$/.test(decl.name)) { D('reserved', ln, `'${decl.name}' is a reserved target. Pick another name.`); return; }
        names[decl.name] = kind;
        (kind === 'actor' ? P.actors : P.puppets).push(decl);
        P.tracks[decl.name] = [];
        return;
      }
      if ((m = s.match(/^prop\b\s*(.*)$/))) {
        const mm = m[1].match(/^([A-Za-z_][\w-]*)(?:\s+as\s+([A-Za-z_]\w*))?(?:\s+at\s+(\S+))?\s*$/);
        if (!mm) { D('syntax', ln, `write: prop lantern [as Lamp] [at 300]`); return; }
        const decl = { kind: mm[1], name: mm[2] || mm[1], at: mm[3] !== undefined ? value(mm[3]).v : null, line: ln };
        if (names[decl.name]) { D('duplicate', ln, `the name '${decl.name}' is already used for a ${names[decl.name]}. Use: prop ${decl.kind} as OtherName`); return; }
        names[decl.name] = 'prop';
        P.props.push(decl);
        return;
      }
      if ((m = s.match(/^(\+?)(\d+(?:\.\d+)?|\.\d+)s?\s+([A-Za-z_]\w*)\s*:\s*(.*)$/))) {
        timed.push({ ln, rel: m[1] === '+', num: parseFloat(m[2]), target: m[3], body: m[4] });
        return;
      }
      if (/^[+\d.]/.test(s)) D('syntax', ln, `write a timed line as: <time> <target>: call(args), for example: 2.5 Kai: walk(to=400)  or  +0.5 cam: zoom(1.3)`);
      else D('syntax', ln, `cannot read this line. Start it with film, set, actor, puppet, prop, or a time such as 3.0 or +0.5.`);
    });

    if (!P.film.line) D('no-film', 1, `the script needs a first line like: film "Title" 30s`);
    if (!P.sets.length) D('no-set', 1, `no set line: the stage is bare (transparent, flat ground, no scenery). To add scenery write, for example: set hillside`, 'info');

    const targets = () => Object.keys(names).filter(n => names[n] !== 'prop').concat(['cam', 'caption', 'card', 'clock', 'wind']);
    for (const L of timed) {
      const ln = L.ln;
      const kind = L.target === 'cam' ? 'cam' : L.target === 'caption' ? 'caption' : L.target === 'card' ? 'card' : L.target === 'clock' ? 'clock' : L.target === 'wind' ? 'wind' : names[L.target];
      if (!kind || kind === 'prop') {
        D('unknown-target', ln, kind === 'prop'
          ? `'${L.target}' is a prop; props cannot act. Make an actor hold it: <time> Kai: hold(${L.target}).`
          : `unknown target '${L.target}'.${suggest(L.target, targets())} Valid targets: ${list(targets())}. Declare actors with 'actor Name = skin x at 100'.`);
        continue;
      }
      const st = { line: ln, target: L.target, kind, t: L.rel ? null : L.num, rel: L.rel ? L.num : null, calls: [] };
      const schema = kind === 'actor' ? actions : kind === 'cam' ? CAM : kind === 'caption' ? CAPTION : kind === 'card' ? CARD : kind === 'clock' ? CLOCK : kind === 'wind' ? WIND : null;
      const chans = {};
      const parts = splitTop(L.body, ',');
      // "key=value" parts at the top level belong to the call before them: caption: "Hi", for=2
      const merged = [];
      for (const p of parts) {
        if (/^[A-Za-z_]\w*\s*=/.test(p) && merged.length) merged[merged.length - 1].extra.push(p);
        else merged.push({ src: p, extra: [] });
      }
      if (!merged.length) { D('syntax', ln, `nothing after '${L.target}:'. Write a call, for example ${L.target}: ${kind === 'actor' ? 'wave()' : kind === 'cam' ? 'pan(to=800)' : '"text"'}`); continue; }
      for (const mp of merged) {
        const raw = parseCall(mp.src);
        if (raw.error) { D('syntax', ln, raw.error); continue; }
        for (const e of mp.extra) { const kv = e.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/); raw.named[kv[1]] = value(kv[2]); }
        if (kind === 'puppet') {   // states come from the puppet file: validated by validate()
          const given = {};
          for (const k of Object.keys(raw.named)) given[k] = raw.named[k].v;
          if (raw.pos.length) given._pos = raw.pos.map(p => p.v);
          st.calls.push({ name: raw.name, args: Object.assign({}, given), given, channel: 'state', raw });
          if (chans.state) D('channel-clash', ln, `${L.target} can do one state per line ('${chans.state}' and '${raw.name}'). Put '${raw.name}' on its own line, for example +0 ${L.target}: ${raw.name}.`);
          chans.state = raw.name;
          continue;
        }
        const sc = schema[raw.name];
        if (!sc) {
          const valid = Object.keys(schema);
          const extra = kind === 'card' || kind === 'caption' ? ` For text write ${L.target}: "your text".` : '';
          D('unknown-action', ln, `${L.target} has no action '${raw.name}'.${suggest(raw.name, valid)} Valid for ${kind === 'actor' ? 'actors' : L.target}: ${list(valid)}.${extra}`);
          continue;
        }
        const b = bind(raw, sc, { where: L.target });
        for (const e of b.errs) D('bad-arg', ln, e);
        if (b.errs.length) continue;
        const call = { name: raw.name, args: b.args, given: b.given, channel: sc.channel, moves: !!sc.moves };
        if (chans[sc.channel]) {
          D('channel-clash', ln, `${chans[sc.channel]} and ${raw.name} both use the ${sc.channel} channel, so they cannot start on one line. Move ${raw.name} to its own line, for example: +0 ${L.target}: ${callText(call)}`);
          continue;
        }
        chans[sc.channel] = raw.name;
        st.calls.push(call);
      }
      if (!st.calls.length) continue;
      P.statements.push(st);
      (P.tracks[L.target] = P.tracks[L.target] || []).push(st);
    }

    // first pass of times with estimated actor durations; the stage redoes this exactly
    timeline(P, estimator(P, actions));
    return P;
  }

  // rough end times used before the performer exists: px/s for moves, fixed times for gestures
  function estimator(P, actions) {
    const xs = {};
    for (const a of P.actors) xs[a.name] = typeof a.at === 'number' ? a.at : null;
    const speed = { walk: 125, run: 330, sneak: 70, jump: 260, enter: 125 };
    return st => {
      if (st.kind !== 'actor') return builtinEnds(st);
      return st.calls.map(c => {
        if (c.moves) {
          const x0 = xs[st.target], to = c.args.to;
          if (typeof to === 'number') {
            xs[st.target] = to;
            if (x0 !== null) return st.t + Math.abs(to - x0) / (speed[c.name] || 125) / (c.args.speed || 1) + 0.3;
          } else xs[st.target] = null;
          return { t: st.t + 2, approx: true };
        }
        return st.t + (c.channel === 'face' || c.channel === 'look' ? 0.3 : 0.8);
      });
    };
  }
  // exact ends for cam, caption, card; puppets get theirs from the stage
  function builtinEnds(st) {
    return st.calls.map(c => {
      if (st.kind === 'cam') return st.t + (c.name === 'cut' ? 0 : (c.args.over || 0));
      if (st.kind === 'caption') return st.t + (c.name === 'clear' ? 0 : c.args.for);
      if (st.kind === 'card') return st.t + (c.args.for || 0.6);
      if (st.kind === 'clock') return st.t + (c.name === 'freeze' ? c.args.for : 0);
      if (st.kind === 'wind') return st.t + (c.args.over || 0);
      return { t: st.t + 1, approx: true };
    });
  }

  // Resolve times in source order. endOf(statement) -> array of per-call end times (numbers, or
  // {t, approx}). Recomputes the timing diagnostics (codes time-order, overlap, past-end).
  function timeline(P, endOf) {
    P.diagnostics = P.diagnostics.filter(d => !d.timing);
    const D = (code, line, message, severity) => P.diagnostics.push({ code, line, severity: severity || 'error', message, timing: true });
    const last = {};
    for (const st of P.statements) {
      const prev = last[st.target];
      if (st.rel !== null) st.t = +(((prev ? prev.end : 0) + st.rel).toFixed(4));
      else if (prev && prev.pairOf && st.t < prev.end - 1e-4) D('overlap', st.line, `${st.target} is busy with ${prev.pairOf.target}'s ${prev.pairOf.calls[0].name} from line ${prev.pairOf.line} until ${prev.end.toFixed(2)}s; this line at ${st.t}s cuts it short. Start it with +0 (or at ${prev.end.toFixed(1)}).`, 'warning');
      else if (prev && st.t < prev.t) D('time-order', st.line, `${st.target}'s statements must go forward in time: ${st.t}s is before line ${prev.line} (${prev.t}s). Move this line above line ${prev.line} or change its time.`);
      const ends = endOf(st) || [];
      st.callEnds = ends.map(e => typeof e === 'number' ? e : e.t);
      st.approx = ends.some(e => e && e.approx);
      st.end = Math.max(st.t, ...st.callEnds);
      last[st.target] = st;
      // a pair line (A: hug(with=B)) occupies B too: B's next '+n' line waits for it
      if (st.kind === 'actor') for (const c of st.calls) {
        const B = c.args && typeof c.args.with === 'string' ? c.args.with : null;
        if (B && B !== st.target && (!last[B] || last[B].end < st.end)) last[B] = { t: st.t, end: st.end, line: st.line, target: B, pairOf: st };
      }
      const dur = P.film.duration;
      if (dur && st.t >= dur) D('past-end', st.line, `this starts at ${st.t.toFixed(2)}s but the film is ${dur}s long. Make the film longer (film "${P.film.title}" ${Math.ceil(st.t + 2)}s) or move the line earlier.`);
    }
    // a statement whose motion is still running when the next statement on the same channel starts
    for (const name of Object.keys(P.tracks)) {
      const tr = P.tracks[name];
      for (let i = 0; i < tr.length - 1; i++) {
        const a = tr[i];
        if (a.approx) continue;
        a.calls.forEach((c, ci) => {
          const long = a.kind === 'actor' ? c.moves : (a.kind === 'cam' ? c.name !== 'cut' && c.name !== 'follow' : a.kind === 'puppet');
          if (!long) return;
          const e = a.callEnds[ci];
          for (let j = i + 1; j < tr.length; j++) {
            const b = tr[j];
            if (b.t >= e - 1e-4) break;   // start times are rounded to 0.1 ms
            const clash = b.calls.find(bc => bc.channel === c.channel);
            if (clash) {
              const what = a.kind === 'actor' ? `${name}'s ${c.name}` : `${name} ${c.name}`;
              D('overlap', b.line, `${what} from line ${a.line} runs until ${e.toFixed(2)}s, but this line starts ${clash.name} at ${b.t.toFixed(2)}s and cuts it short. Start this line with +0 (or at ${e.toFixed(1)}), or shorten line ${a.line}.`);
              break;
            }
          }
        });
      }
    }
    let end = 0;
    for (const st of P.statements) end = Math.max(end, st.end);
    P.contentEnd = end;
    return P;
  }

  // ---------- validate against the library ----------
  // lib: { sets, skins, puppets, props } objects keyed by name. anchors come from the set.
  function validate(P, lib) {
    lib = lib || {};
    const out = [];
    const D = (code, line, message, severity) => out.push({ code, line, severity: severity || 'error', message });
    const sets = lib.sets || {}, skins = lib.skins || {}, pups = lib.puppets || {}, props = lib.props || {};
    let set = null;
    if (P.sets.length) {
      const s = P.sets[0];
      set = sets[s.name];
      if (!set) D('unknown-set', s.line, `unknown set '${s.name}'.${suggest(s.name, Object.keys(sets))} Available sets: ${list(Object.keys(sets))}. Add sets/${s.name}.js to make a new one.`);
      else if (s.variant && !(set.variants && set.variants[s.variant])) D('unknown-variant', s.line, `set ${s.name} has no variant '${s.variant}'. Variants: ${list(Object.keys(set.variants || {}))}.`);
    }
    const anchors = set && set.anchors ? Object.keys(set.anchors) : [];
    const things = P.actors.map(a => a.name).concat(P.puppets.map(a => a.name), P.props.map(a => a.name));
    const place = (v, line, what, extraWords) => {
      if (typeof v === 'number' || v === null || v === undefined || v === '') return;
      const ok = anchors.concat(things, extraWords || []);
      if (ok.indexOf(v) < 0) D('unknown-place', line, `${what}: '${v}' is not a number, an anchor or a name.${suggest(v, ok)} Anchors in this set: ${list(anchors)}. Names: ${list(things)}.`);
    };
    for (const a of P.actors) {
      if (!skins[a.skin]) {
        const have = Object.keys(skins);
        D('unknown-skin', a.line, `unknown skin '${a.skin}'.${suggest(a.skin, have)} Available skins: ${list(have)}. ${have.length ? '' : 'The default character is drawn instead.'}`, have.length ? 'error' : 'warning');
      }
      place(a.at, a.line, `actor ${a.name} at`);
    }
    for (const p of P.puppets) {
      const def = pups[p.kind];
      if (!def) { D('unknown-puppet', p.line, `unknown puppet '${p.kind}'.${suggest(p.kind, Object.keys(pups))} Available puppets: ${list(Object.keys(pups))}.`); continue; }
      place(p.at, p.line, `puppet ${p.name} at`);
      for (const st of P.tracks[p.name] || []) for (const c of st.calls) {
        const states = Object.keys(def.states || {}).concat(['turn']);
        if (states.indexOf(c.name) < 0) { D('unknown-action', st.line, `puppet ${p.name} (${p.kind}) has no state '${c.name}'.${suggest(c.name, states)} Valid: ${list(states)}.`); continue; }
        const sd = (def.states || {})[c.name] || {};
        const okArgs = ['for'].concat(sd.travel ? ['to', 'speed'] : []);
        for (const k of Object.keys(c.given)) {
          if (k === '_pos') {
            if (sd.travel && c.given._pos.length === 1) { c.args.to = c.given._pos[0]; continue; }
            D('bad-arg', st.line, `write ${c.name} arguments as key=value. Valid keys: ${okArgs.join(', ')}.`); continue;
          }
          if (okArgs.indexOf(k) < 0) D('bad-arg', st.line, `${p.kind} state '${c.name}' has no argument '${k}'. Valid: ${okArgs.join(', ')}.${sd.travel ? '' : ' Only moving states (' + Object.keys(def.states).filter(n => def.states[n].travel).join(', ') + ') take to=.'}`);
        }
        delete c.args._pos;
        if (sd.travel && (c.args.to === undefined)) D('bad-arg', st.line, `${c.name} needs to=<x or anchor>, for example ${p.name}: ${c.name}(to=${anchors[0] || 400}).`);
        place(c.args.to, st.line, `${p.name}: ${c.name} to`);
      }
    }
    for (const pr of P.props) {
      if (!props[pr.kind]) D('unknown-prop', pr.line, `unknown prop '${pr.kind}'.${suggest(pr.kind, Object.keys(props))} Available props: ${list(Object.keys(props))}.`);
      place(pr.at, pr.line, `prop ${pr.name} at`);
    }
    const movers = P.actors.map(a => a.name).concat(P.puppets.map(a => a.name));
    for (const st of P.statements) for (const c of st.calls) {
      if (st.kind === 'actor') {
        if (c.name === 'hold') {
          const names = P.props.map(p => p.name);
          if (names.indexOf(c.args.prop) < 0) D('unknown-prop', st.line, `${st.target} cannot hold '${c.args.prop}': declare it first with 'prop ${c.args.prop}'.${suggest(c.args.prop, names)} Declared props: ${list(names)}.`);
        }
        for (const k of ['to', 'at', 'from']) if (k in c.given) {
          if (c.name === 'enter' && k === 'from') { if (['left', 'right'].indexOf(c.args.from) < 0) D('bad-arg', st.line, `enter(from=left) or enter(from=right).`); continue; }
          place(c.given[k], st.line, `${st.target}: ${c.name} ${k}`, k === 'at' ? LOOK_WORDS : []);
        }
      } else if (st.kind === 'cam') {
        if (c.name === 'follow' && movers.indexOf(c.args.target) < 0) D('unknown-place', st.line, `cam can follow only an actor or puppet. Names: ${list(movers)}.`);
        if (c.name === 'frame' && String(c.args.on).split('+').some(n => P.actors.every(a => a.name !== n))) D('unknown-place', st.line, `cam frame(on=...) needs an actor, or two joined with + (on=Kai+Tess). Actors: ${list(P.actors.map(a => a.name))}.`);
        if (c.name === 'pan' || c.name === 'cut') place(c.args.to, st.line, `cam ${c.name} to`);
        if (c.name === 'zoom' && c.args.to < 1) D('bad-arg', st.line, `zoom below 1 would show past the edge of the set; use 1 for the whole frame or more to go closer.`);
      } else if (st.kind === 'clock') {
        if (c.args.who && P.actors.every(a => a.name !== c.args.who)) D('unknown-place', st.line, `clock: who=${c.args.who} is not an actor. Actors: ${list(P.actors.map(a => a.name))}.`);
        if (c.name === 'freeze' && st.rel !== null) D('bad-arg', st.line, `write freeze at an absolute time (for example 20.5 clock: freeze(for=1)), not a + time.`);
        if (c.name === 'tempo' && (c.args.div < 1 || c.args.snap <= 0 || c.args.snap > 1)) D('bad-arg', st.line, `tempo: div must be 1 or more and snap between 0 and 1.`);
      } else if (st.kind === 'caption' && c.args.by) {
        if (movers.indexOf(c.args.by) < 0) D('unknown-place', st.line, `by=${c.args.by}: speech bubbles need an actor or puppet. Names: ${list(movers)}.`);
      }
    }
    return out;
  }

  return { parse, validate, timeline, builtinEnds, STANDIN_ACTIONS, CAM, CAPTION, CARD, CLOCK, WIND, suggest };
});
