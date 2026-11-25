// perform.js - CharPerform: turns a list of named actions into a pure function of time
// (STAGE.md sections 2 and 3). UMD: window.CharPerform in the browser, module.exports in Node.
//
//   CharPerform.actions                     vocabulary (from poses.js): {name: {channel, args, moves, doc}}
//   CharPerform.compile(skin, events, env)  -> performer; never throws, problems go to diagnostics
//   performer.sample(t)                     -> { x, y, facing, pose, swaps, held, scale, height, offstage }
//   performer.end(i)                        -> time when events[i]'s motion finishes
//   performer.diagnostics                   -> [{ code, t, line, message, severity }]
//   CharPerform.draw(skin, sample)          -> SVG markup, origin at the actor's feet (sample.x, sample.y)
//
// Motion: clips.js (keys on a time line, played with splines, cross-faded), the procedural gait, and
// a spring simulation (chains, arm/head/torso overlap) stepped at 1/60 s from t = 0 with cached
// snapshots, so sample(t) is the same in any order. env.wind(t) feeds the chains.
// Stage space is px with y down. Rig space (poses) is head heights with y up; 1 head = sample.scale px.
// Internally every body action works in its own frame: x = 0 where it started, +x = facing.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rig.js'), require('./gait.js'), require('./poses.js'), require('./clips.js'), require('./speech.js'));
  else root.CharPerform = factory(root.CharRig, root.CharGait, root.CharPoses, root.CharClips, root.CharSpeech);
})(typeof self !== 'undefined' ? self : this, function (CharRig, CharGait, CharPoses, CharClips, CharSpeech) {
  CharClips = CharClips || {};
  'use strict';
  const D2R = Math.PI / 180, TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const EASE = {
    linear: u => clamp(u, 0, 1),
    inOut: smooth,
    in: u => { u = clamp(u, 0, 1); return u * u * u; },
    out: u => { u = clamp(u, 0, 1); return 1 - Math.pow(1 - u, 3); },
    // overshoots ~12% and settles (used for fast moves)
    back: u => { u = clamp(u, 0, 1); const c = 1.9, v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; },
  };
  const ease = (name, u) => (EASE[name] || EASE.inOut)(u);
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const wrapA = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
  const ACTIONS = CharPoses.actions, MOODS = CharPoses.moods;
  const SIDES = ['near', 'far'];
  const LOOK_WORDS = { up: 1, down: 1, front: 1, back: 1, left: 1, right: 1 };

  // action files register on the global CharActions (actions/<name>.js; docs/ACTIONS.md). A file with
  // the name of a built-in action replaces it.
  const globalActs = () => { const g = typeof globalThis !== 'undefined' ? globalThis : {}; return g.CharActions || {}; };
  const userSpecs = new Map();
  // a paired action file (docs/PAIRS.md) holds one role per actor: { pair: true, gap, a: {keys}, b: {keys} }.
  // The stage turns 'A: hug(with=B)' into the events 'hug.a' for A and 'hug.b' for B; 'hug' alone plays role a.
  const PAIR_ARGS = { with: '', apart: 1, size: 1, push: 1, speed: 1, for: 0 };
  const roleCache = new Map();
  function roleOf(name) {
    const m = String(name).match(/^(\w+)(?:\.(a|b))?$/), p = m && globalActs()[m[1]];
    if (!p || !p.pair || typeof p !== 'object') return null;
    const r = p[m[2] || 'a'];
    if (!r || !Array.isArray(r.keys)) return null;
    if (!roleCache.has(r)) roleCache.set(r, Object.assign({}, r, { name: m[1] + '.' + (m[2] || 'a'), doc: p.doc, args: Object.assign({}, PAIR_ARGS, p.args || {}, r.args || {}) }));
    return roleCache.get(r);
  }
  function specOf(name) {
    const u = roleOf(name) || globalActs()[name];
    if (u && typeof u === 'object' && Array.isArray(u.keys)) {
      if (!userSpecs.has(u)) {
        if (!u.name) u.name = name;
        userSpecs.set(u, { channel: u.channel === 'arms' ? 'arms' : 'body', args: Object.assign({}, u.args || {}), moves: !!u.travel, doc: u.doc || 'an action file',
          user: u, mood: u.face, hold: u.hold || 0, release: u.release === undefined ? 0.35 : u.release });
      }
      return userSpecs.get(u);
    }
    return ACTIONS[name];
  }
  // public vocabulary: channel, args (null = required), moves, doc
  function vocab() {
    const v = {};
    for (const n of Object.keys(ACTIONS)) { const a = ACTIONS[n]; v[n] = { channel: a.channel, args: Object.assign({}, a.args), moves: !!a.moves, doc: a.doc }; }
    for (const n of Object.keys(globalActs())) { const s = specOf(n); if (s && s.user) v[n] = { channel: s.channel, args: Object.assign({}, s.args), moves: s.moves, doc: s.doc }; }
    return v;
  }

  function isSkin(s) { return !!(s && (s.parts || s.swaps || s.chains || s.build)); }

  function compile(skin, events, env) {
    const diagnostics = [];
    const D = (code, t, line, message, severity) => diagnostics.push({ code, t: isFinite(t) ? t : null, line: line === undefined ? null : line, message, severity: severity || 'error' });
    try { return build(skin, events, env, D, diagnostics); } catch (err) {
      // last-resort safety: a broken script must not take the page down
      D('internal', null, null, 'performer failed: ' + (err && err.message) + '. The actor stands still.');
      return build(skin, [], env, () => {}, diagnostics);
    }
  }

  function build(skin, events, env, D, diagnostics) {
    env = env || {};
    skin = skin && typeof skin === 'object' ? skin : {};
    const ch = CharRig.skinCharacter(skin);
    // motion: { weight 0..1, energy 0..1, age: baby|child|adult|elder, posture -1..1 } (docs/RIG.md).
    // The defaults (0.3, 0.5, adult, 0) change nothing, so older skins move as before.
    const MO = Object.assign({ weight: 0.3, energy: 0.5, age: 'adult', posture: undefined }, skin.motion || {});
    MO.weight = clamp(+MO.weight || 0, 0, 1); MO.energy = clamp(MO.energy === undefined ? 0.5 : +MO.energy, 0, 1);
    if (MO.posture === undefined) MO.posture = MO.age === 'elder' ? 0.5 : 0;
    MO.posture = clamp(+MO.posture || 0, -1, 1);
    const AGE = { baby: 1, child: 2, adult: 3, elder: 4 }[MO.age] || 3;
    // time stretch for clips: heavy, old and tired bodies move slower
    const TS = (1 + 0.4 * (MO.weight - 0.3)) * (AGE === 4 ? 1.25 : AGE === 1 ? 0.9 : 1) * (1 - 0.2 * (MO.energy - 0.5));
    const pr = ch.proportions, L = pr.thigh + pr.shin, A = pr.ankleHeight, H = CharRig.heightOf(ch);
    let scale = Number(env.scale);
    if (!(scale > 0)) scale = 1;
    const k = scale > 8 ? scale : 220 / H * scale;            // px per head unit
    const gpts = CharRig.footGeometry(ch).ground;
    const minRotY = a => { let m = Infinity; const c = Math.cos(a), s = Math.sin(a); for (const q of gpts) m = Math.min(m, q[0] * s + q[1] * c); return m; };
    const B = { ch, pr, L, A, k, H, kneeR: pr.radius.knee };
    const width = Number(env.width) > 0 ? Number(env.width) : 1280;
    const groundAt = x => {
      let v = 0;
      try { v = typeof env.ground === 'function' ? +env.ground(x) : +env.ground; } catch (e) { v = 0; }
      return isFinite(v) ? v : 0;
    };
    function resolvePlace(v, t) {
      try {
        if (typeof v === 'number' && isFinite(v)) return [v, groundAt(v)];
        if (typeof v === 'string' && v.trim() !== '' && isFinite(+v)) return [+v, groundAt(+v)];
        if (Array.isArray(v) && isFinite(+v[0])) return [+v[0], isFinite(+v[1]) ? +v[1] : groundAt(+v[0])];
        if (v && typeof v === 'object' && isFinite(+v.x)) return [+v.x, isFinite(+v.y) ? +v.y : groundAt(+v.x)];
        if (typeof v === 'string' && env.anchors && env.anchors[v] !== undefined) {
          let a = env.anchors[v];
          if (typeof a === 'function') a = a(t);
          if (a === v) return null;
          return resolvePlace(a, t);
        }
      } catch (e) { /* fall through */ }
      return null;
    }

    // ---------------------------------------------------------------- body state helpers
    function baseS() {
      return { rx: 0, ry: A + 0.975 * L, lean: 0, tilt: 0, twist: 0, neck: 0, head: 0,
        feet: { near: { x: 0.1 * L, y: -minRotY(0), a: 0 }, far: { x: -0.1 * L, y: -minRotY(0), a: 0 } },
        arms: { near: [0, 0.2, 0], far: [0, 0.2, 0] }, hands: { near: 'relaxed', far: 'relaxed' },
        squash: [1, 1], stretch: 1, mouth: null, bend: 0, chest: 1 };
    }
    function cloneS(S) {
      return { rx: S.rx, ry: S.ry, lean: S.lean, tilt: S.tilt, twist: S.twist, neck: S.neck, head: S.head,
        feet: { near: Object.assign({}, S.feet.near), far: Object.assign({}, S.feet.far) },
        arms: { near: S.arms.near.slice(), far: S.arms.far.slice() }, hands: Object.assign({}, S.hands),
        squash: S.squash.slice(), stretch: S.stretch, mouth: S.mouth, bend: S.bend || 0, chest: S.chest || 1, faceTurn: S.faceTurn || 0 };
    }
    const footY = (lift, a) => lift - minRotY(a);
    function kneel(S, side, f) {
      const kx = S.rx + (f.knee || 0) * L, kr = B.kneeR, dx = kx - S.rx;
      S.ry = kr + Math.sqrt(Math.max(0.01, pr.thigh * pr.thigh - dx * dx));
      const s = (f.shin === undefined ? 26 : f.shin) * D2R;
      const ax = kx - pr.shin * Math.cos(s), ay = kr + pr.shin * Math.sin(s);
      // tuck the toes: find the foot angle where the toe just touches the ground
      let lo = -1.5, hi = -0.15;
      for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (ay + minRotY(m) < 0) lo = m; else hi = m; }
      S.feet[side] = { x: ax, y: ay, a: hi };
    }
    // apply one key (data from poses.js) on top of the previous state
    function resolveKey(key, prev, args, map) {
      const S = cloneS(prev);
      const v = f => typeof f === 'function' ? f(args || {}, B) : f;
      map = map || { N: 'near', F: 'far' };
      S.mouth = key.mouth !== undefined ? key.mouth : (prev.mouth && key.keepMouth ? prev.mouth : null);
      if (key.x != null) S.rx = v(key.x) * L;
      if (key.h != null) S.ry = A + v(key.h) * L;
      for (const f of ['lean', 'tilt', 'twist', 'neck', 'head', 'bend']) if (key[f] != null) S[f] = v(key[f]) * D2R;
      if (key.chest != null) S.chest = v(key.chest);
      for (const side of SIDES) {
        const f = v(key[side]);
        if (Array.isArray(f)) { const a = (f[2] || 0) * D2R; S.feet[side] = { x: f[0] * L, y: footY((f[1] || 0) * L, a), a }; }
      }
      for (const side of SIDES) { const f = v(key[side]); if (f && f.knee !== undefined) kneel(S, side, f); }
      const aN = v(key.armN), aF = v(key.armF);
      if (aN) S.arms[map.N] = aN.map(d => v(d) * D2R);
      if (aF && map.F) S.arms[map.F] = aF.map(d => v(d) * D2R);
      const hs = v(key.hands);
      if (typeof hs === 'string') { S.hands.near = hs; S.hands.far = hs; }
      else if (Array.isArray(hs)) { S.hands[map.N] = hs[0]; if (map.F) S.hands[map.F] = hs[1]; }
      if (key.squash) S.squash = v(key.squash).slice();
      if (key.stretch) S.stretch = v(key.stretch);
      return S;
    }
    // transition S0 -> S1. Upper body uses the key's ease (may overshoot); root x and feet never
    // overshoot. A foot that must move along the ground steps (lifts on an arc) instead of sliding.
    function trans(S0, S1, u, name) {
      const eu = ease(name, u), es = smooth(u);
      const S = cloneS(S1);
      S.rx = lerp(S0.rx, S1.rx, es);
      S.ry = lerp(S0.ry, S1.ry, eu);
      for (const f of ['lean', 'tilt', 'twist', 'neck', 'head', 'bend']) S[f] = lerp(S0[f] || 0, S1[f] || 0, eu);
      S.chest = lerp(S0.chest || 1, S1.chest || 1, eu);
      for (const side of SIDES) for (let j = 0; j < 3; j++) S.arms[side][j] = lerp(S0.arms[side][j], S1.arms[side][j], eu);
      const mv = SIDES.map(s => Math.abs(S1.feet[s].x - S0.feet[s].x));
      const steps = SIDES.map((s, i) => mv[i] > 0.03);
      const first = mv[0] >= mv[1] ? 0 : 1;
      SIDES.forEach((side, i) => {
        const f0 = S0.feet[side], f1 = S1.feet[side];
        if (!steps[i]) {
          const a = lerp(f0.a, f1.a, es);
          let x = lerp(f0.x, f1.x, es);
          // a planted foot that changes angle rolls on its toe or heel, so that point stays put
          if (f0.y < 0.05 * L && f1.y < 0.05 * L) {
            const pv = a < 0 ? pr.toe : pr.heel, rx = (p, q) => p[0] * Math.cos(q) - p[1] * Math.sin(q);
            x = lerp(f0.x + rx(pv, f0.a), f1.x + rx(pv, f1.a), es) - rx(pv, a);
          }
          S.feet[side] = { x, y: lerp(f0.y, f1.y, es), a };
          return;
        }
        const both = steps[0] && steps[1];
        const w0 = !both ? 0 : (i === first ? 0 : 0.38), w1 = !both ? 1 : (i === first ? 0.62 : 1);
        const uf = smooth((u - w0) / (w1 - w0));
        const grounded = f0.y < 0.25 * L && f1.y < 0.25 * L;
        const arc = grounded ? Math.min(0.12 * L, 0.25 * mv[i] + 0.04 * L) * Math.sin(Math.PI * uf) : 0;
        const ux = smooth((uf - 0.12) / 0.72);          // lift before travelling, stop before landing
        S.feet[side] = { x: lerp(f0.x, f1.x, ux), y: lerp(f0.y, f1.y, uf) + arc, a: lerp(f0.a, f1.a, uf) - 0.25 * Math.sin(Math.PI * uf) * (grounded ? 1 : 0) };
      });
      S.hands = u < 0.4 ? Object.assign({}, S0.hands) : Object.assign({}, S1.hands);
      S.squash = [lerp(S0.squash[0], S1.squash[0], eu), lerp(S0.squash[1], S1.squash[1], eu)];
      S.stretch = Math.max(S0.stretch, S1.stretch) > 1 ? lerp(S0.stretch, S1.stretch, es) : 1;
      S.mouth = S1.mouth;
      return S;
    }
    // move a state into a new frame whose origin is its own root
    function rebase(st) {
      const S = cloneS(st.S), dx = S.rx;
      S.rx = 0; for (const s of SIDES) S.feet[s].x -= dx;
      return { S, x: st.x, facing: st.facing };
    }
    const stageX = (ox, facing, rx) => ox + facing * k * rx;
    function mkState(S, ox, facing, extra) {
      const x = stageX(ox, facing, S.rx);
      return Object.assign({ S, x, y: groundAt(x), facing, life: 0, loop: null }, extra || {});
    }

    // ---------------------------------------------------------------- events
    const evs = [];
    const moodHints = [], blinkAt = [];
    const actionNames = Object.keys(vocab());
    const near = (w, names) => {
      let best = null, bd = 99;
      for (const n of names) { const d = lev(String(w), n); if (d < bd) { bd = d; best = n; } }
      return best && bd <= 2 ? ` Did you mean '${best}'?` : '';
    };
    (Array.isArray(events) ? events : []).forEach((e, i) => {
      if (!e || typeof e !== 'object') { D('bad-event', null, null, `event ${i} is not an object {t, action, args}.`); return; }
      const line = e.line, t = Number(e.t);
      if (!isFinite(t)) { D('bad-time', null, line, `time '${e.t}' is not a number of seconds.`); return; }
      const name = e.action || e.name;
      const spec = specOf(name);
      if (!spec) { D('unknown-action', t, line, `unknown action '${name}'.${near(name, actionNames)} Valid: ${actionNames.join(', ')}.`); return; }
      const args = {}, given = e.args && typeof e.args === 'object' ? e.args : {};
      const keys = Object.keys(spec.args);
      let ok = true;
      for (const g of Object.keys(given)) if (!(g in spec.args) && g !== '_pos') D('unknown-arg', t, line, `${name} has no argument '${g}'.${near(g, keys)} Valid: ${keys.join(', ') || '(none)'}.`, 'warning');
      for (const a of keys) {
        const def = spec.args[a];
        let val = given[a];
        if (val === undefined || val === null || val === '') {
          if (def === null) { D('missing-arg', t, line, `${name} needs ${a}=..., for example ${name}(${a}=${a === 'prop' ? 'lantern' : 400}).`); ok = false; }
          else args[a] = def;
          continue;
        }
        if (typeof def === 'number' && typeof val !== 'number') {
          if (isFinite(+val)) val = +val;
          else { D('bad-arg', t, line, `${name}: ${a} must be a number, got '${val}'. Using ${def}.`, 'warning'); val = def; }
        }
        args[a] = val;
      }
      if (!ok) return;
      // enumerations and places
      const enumOf = { name: Object.keys(CharPoses.moodMotion || {}), mood: Object.keys(MOODS), how: ['up', 'front', 'side'], hand: ['near', 'far', 'both'], from: ['left', 'right'], end: ['stop', 'skid'] };
      for (const a of Object.keys(enumOf)) if (a in args && enumOf[a].indexOf(args[a]) < 0) {
        // a misspelt mood or face name is an error: the film would show the wrong feeling (or none)
        if (a === 'mood' || (a === 'name' && name === 'mood')) {
          let best = null, bd = 99;
          for (const n of enumOf[a]) { const d = lev(String(args[a]), n); if (d < bd) { bd = d; best = n; } }
          D('bad-arg', t, line, `${name}: '${args[a]}' is not a ${name === 'mood' ? 'mood' : 'face'} name. Nearest valid name is '${best}', so write ${name}(${best}). Valid: ${enumOf[a].join(', ')}.`);
        } else D('bad-arg', t, line, `${name}: ${a}=${args[a]} is not valid. Use one of: ${enumOf[a].join(', ')}.`, 'warning');
        args[a] = spec.args[a] !== null ? spec.args[a] : enumOf[a][0];
      }
      for (const a of ['to', 'at']) if (a in args) {
        if (name === 'look' && LOOK_WORDS[args[a]]) continue;
        if (!resolvePlace(args[a], t)) {
          const an = env.anchors ? Object.keys(env.anchors) : [];
          D('unknown-place', t, line, `${name}: ${a}=${args[a]} is not a number, [x, y] or an anchor.${near(args[a], an)} Anchors: ${an.join(', ') || '(none)'}.`);
          ok = false;
        }
      }
      if (!ok) return;
      evs.push({ i, t, name, spec, args, line, channel: spec.channel });
    });
    evs.sort((a, b) => a.t - b.t || a.i - b.i);
    const endOf = {};

    // ---------------------------------------------------------------- body track
    const STAND = CharPoses.STAND;
    const segs = [];
    const segAt = t => { let s = null; for (const g of segs) { if (g.t0 <= t) s = g; else break; } return s; };
    const bodyAt = t => segAt(t).at(t);
    const x0 = (() => { const p = resolvePlace(env.x !== undefined ? env.x : env.at, 0); return p ? p[0] : width / 2; })();
    const facing0 = env.facing === -1 || env.facing === 'left' ? -1 : 1;
    const bodyEvs = evs.filter(e => e.channel === 'body');
    const offX = from => from === 'right' ? width + 0.28 * H * k : -0.28 * H * k;
    {
      const first = bodyEvs[0];
      const startX = first && first.name === 'enter' ? offX(first.args.from) : x0;
      const S = resolveKey(STAND, baseS(), {});
      S.rx = 0;
      segs.push({ t0: -Infinity, end: -Infinity, at: t => mkState(S, startX, first && first.name === 'enter' ? (first.args.from === 'right' ? -1 : 1) : facing0, { life: 1, offstage: !!(first && first.name === 'enter') }) });
    }

    function keyedSeg(t0, entry, keys, args, opts) {
      opts = opts || {};
      const E = rebase(entry), ks = [];
      let prev = E.S, tt = t0;
      for (const key of keys) {
        const S = resolveKey(key, prev, args);
        ks.push({ t0: tt, dur: Math.max(0.01, key.dur || 0.3), ease: key.ease || 'inOut', from: prev, S });
        tt += Math.max(0.01, key.dur || 0.3); prev = S;
      }
      const end = tt;
      return { t0, end, at(t) {
        let S, life = 0;
        if (t >= end) { S = cloneS(prev); life = smooth((t - end) / 0.6); }
        else { let kk = ks[0]; for (const q of ks) if (q.t0 <= t) kk = q; S = trans(kk.from, kk.S, (t - kk.t0) / kk.dur, kk.ease); }
        return mkState(S, E.x, E.facing, { life, loop: opts.loop || null, loopT0: end });
      } };
    }
    // ---------------------------------------------------------------- clips (motion as data, clips.js)
    // A clip is pose keys on a time line. Every field is its own spline (Hermite with Catmull-Rom
    // tangents, flat at keys marked flat), fields may lag the body (overlap), feet are pinned inside
    // their contact marks, x is root motion. A clip segment cross-fades from the segment before it.
    const NUMF = ['x', 'h', 'lean', 'tilt', 'twist', 'neck', 'head', 'bend', 'chest', 'stretch', 'squash', 'near', 'far', 'armN', 'armF', 'turn'];
    const STF = { x: 0, h: STAND.h, lean: STAND.lean, tilt: STAND.tilt, twist: STAND.twist, neck: STAND.neck, head: STAND.head, bend: 0, chest: 1, stretch: 1,
      squash: [1, 1], near: STAND.near, far: STAND.far, armN: STAND.armN, armF: STAND.armF };
    const prepCache = new Map();
    function prepClip(name) {
      const c = typeof name === 'string' ? CharClips[name] : name;
      if (!c || !Array.isArray(c.keys) || !c.keys.length) return null;
      if (prepCache.has(c)) return prepCache.get(c);
      const keys = c.keys.slice().sort((a, b) => a.t - b.t);
      const dur = c.dur || keys[keys.length - 1].t || 0.01;
      const cyc = !!(c.loop && c.loop[0] <= 0 && c.loop[1] >= dur - 1e-6);
      const chs = {};
      for (const f of NUMF) {
        const T = [], V = [], F = [];
        for (const q of keys) {
          const v = q[f];
          if (v === undefined || v === null || typeof v === 'string') continue;
          T.push(q.t); F.push(!!q.flat);
          V.push(Array.isArray(v) ? (f === 'squash' ? [0, 1] : [0, 1, 2]).map(j => +v[j] || 0) : +v);
        }
        if (T.length) chs[f] = { T, V, F };
      }
      const disc = f => keys.filter(q => q[f] !== undefined).map(q => [q.t, q[f]]);
      const P = { c, dur, cyc, ch: chs, hands: disc('hands'), mouth: disc('mouth'), lag: c.lag || {}, contacts: c.contacts || {} };
      prepCache.set(c, P);
      return P;
    }
    function splComp(C, t, cyc, dur, j) {
      const T = C.T, n = T.length, val = i => j < 0 ? C.V[i] : C.V[i][j];
      if (n === 1) return val(0);
      if (cyc) t = ((t % dur) + dur) % dur;
      if (t <= T[0]) return val(0);
      if (t >= T[n - 1]) return val(n - 1);
      let i = 0;
      while (i < n - 2 && T[i + 1] <= t) i++;
      const tan = q => {
        if (C.F[q]) return 0;
        let tp, vp, tn, vn;
        if (q > 0) { tp = T[q - 1]; vp = val(q - 1); } else if (cyc) { tp = T[n - 2] - dur; vp = val(n - 2); } else return (val(1) - val(0)) / Math.max(1e-6, T[1] - T[0]);
        if (q < n - 1) { tn = T[q + 1]; vn = val(q + 1); } else if (cyc) { tn = T[1] + dur; vn = val(1); } else return 0;
        const d0 = Math.max(1e-6, T[q] - tp), d1 = Math.max(1e-6, tn - T[q]);
        return ((val(q) - vp) / d0 * d1 + (vn - val(q)) / d1 * d0) / (d0 + d1);
      };
      const h = Math.max(1e-6, T[i + 1] - T[i]), u = clamp((t - T[i]) / h, 0, 1), u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * val(i) + (u3 - 2 * u2 + u) * h * tan(i) + (3 * u2 - 2 * u3) * val(i + 1) + (u3 - u2) * h * tan(i + 1);
    }
    function spl(P, f, t) {
      const C = P.ch[f];
      if (!C) { const d = STF[f]; return Array.isArray(d) ? d.slice() : d; }
      t -= P.lag[f] || 0;
      const v0 = C.V[0];
      return Array.isArray(v0) ? v0.map((_, j) => splComp(C, t, P.cyc, P.dur, j)) : splComp(C, t, P.cyc, P.dur, -1);
    }
    const discAt = (list, t, def) => { let v = def; for (const q of list) if (q[0] <= t + 1e-9) v = q[1]; return v; };
    const rotX = (p, a) => p[0] * Math.cos(a) - p[1] * Math.sin(a);
    function blendS(A0, B0, w) {
      const S = cloneS(B0);
      S.rx = lerp(A0.rx, B0.rx, w); S.ry = lerp(A0.ry, B0.ry, w);
      for (const f of ['lean', 'tilt', 'twist', 'neck', 'head', 'bend']) S[f] = lerp(A0[f] || 0, B0[f] || 0, w);
      S.chest = lerp(A0.chest || 1, B0.chest || 1, w); S.stretch = lerp(A0.stretch || 1, B0.stretch || 1, w); S.faceTurn = lerp(A0.faceTurn || 0, B0.faceTurn || 0, w);
      S.squash = [lerp(A0.squash[0], B0.squash[0], w), lerp(A0.squash[1], B0.squash[1], w)];
      for (const s of SIDES) {
        for (let j = 0; j < 3; j++) S.arms[s][j] = lerp(A0.arms[s][j], B0.arms[s][j], w);
        const a = A0.feet[s], b = B0.feet[s];
        S.feet[s] = { x: lerp(a.x, b.x, w), y: lerp(a.y, b.y, w), a: lerp(a.a, b.a, w) };
      }
      if (w < 0.5) { S.hands = Object.assign({}, A0.hands); S.mouth = A0.mouth; }
      return S;
    }
    // one segment that plays clip P from state `entry` at t0, cross-fading from segment `prev`.
    // opts: times (loop repeats), dist (leg lengths to jump), hm (jump height factor)
    const UPSTAND = { lean: STAND.lean * D2R, bend: 0, twist: STAND.twist * D2R, head: STAND.head * D2R, neck: STAND.neck * D2R };
    function clipSeg(t0, entry, prev, P, opts) {
      opts = opts || {};
      const c = P.c, E = rebase(entry);
      const ts = opts.ts || 1, blendIn = (c.blendIn === undefined ? 0.15 : c.blendIn) * ts;
      const lp = !P.cyc && c.loop ? c.loop : null;
      const extra = lp ? Math.max(0, Math.round(opts.times || 1) - 1) * (lp[1] - lp[0]) : 0;
      const fl = c.flight || null;
      const xs = opts.xs || 1, rawX = tc => spl(P, 'x', tc) * xs;
      let tf = 0, Hj = 0, Df = 0;
      if (fl) {
        const hm = clamp(opts.hm || 1, 0.3, 3), Dl = opts.dist === undefined ? rawX(P.dur) - rawX(0) : opts.dist;
        tf = ((fl[1] - fl[0]) + (c.flightPerL || 0) * Dl) * Math.sqrt(hm);
        Hj = (c.height || 0.5) * L * hm;
        Df = Math.max(0, Dl - (rawX(fl[0]) - rawX(0) + rawX(P.dur) - rawX(fl[1])));
      }
      const ftime = fl ? tf - (fl[1] - fl[0]) : 0;
      const total = (P.dur + extra + ftime) * ts;
      const clipT = tau0 => {
        if (P.cyc) return tau0 / ts;
        const tau = tau0 / ts;
        let q = tau;
        if (lp && q > lp[1]) q = q < lp[1] + extra ? lp[0] + ((q - lp[1]) % (lp[1] - lp[0])) : q - extra;
        if (fl && q > fl[0]) q = q < fl[0] + tf ? fl[0] + (q - fl[0]) * (fl[1] - fl[0]) / tf : q - ftime;
        return clamp(q, 0, P.dur);
      };
      const rootX = tc => {
        if (!fl || tc <= fl[0]) return rawX(tc);
        if (tc < fl[1]) return rawX(fl[0]) + Df * (tc - fl[0]) / (fl[1] - fl[0]);
        return rawX(tc) - rawX(fl[1]) + rawX(fl[0]) + Df;
      };
      const footRaw = (side, tc) => { const r = spl(P, side, tc); return { x: (rootX(tc) + r[0]) * L, lift: r[1] * L, a: r[2] * D2R }; };
      const pins = {};
      function pin(side, j) {
        const key = side + j;
        if (pins[key]) return pins[key];
        const iv = P.contacts[side][j];
        let x0, a0;
        if (iv[0] <= 1e-9) { x0 = E.S.feet[side].x; a0 = E.S.feet[side].a; } else { const f = footRaw(side, iv[0]); x0 = f.x; a0 = f.a; }
        // the pivot the foot stands on now stays put; the other one is placed where it lands when flat
        let heelW = x0 + rotX(pr.heel, a0), toeW = x0 + rotX(pr.toe, a0), lift0 = iv[0] <= 1e-9 ? 0 : footRaw(side, iv[0]).lift;
        if (a0 < 0) heelW = toeW - pr.toe[0] + pr.heel[0]; else toeW = heelW - pr.heel[0] + pr.toe[0];
        const at = a => a < 0 ? toeW - rotX(pr.toe, a) : heelW - rotX(pr.heel, a);
        const fe = footRaw(side, iv[1]);
        return (pins[key] = { at, off: at(fe.a) - fe.x, lift: lift0 });
      }
      function footAt(side, tc, air) {
        const f = footRaw(side, tc), ivs = P.contacts[side] || [];
        for (let j = 0; j < ivs.length; j++) if (tc >= ivs[j][0] - 1e-9 && tc <= ivs[j][1] + 1e-9) { const pj = pin(side, j); return { x: pj.at(f.a), y: footY(pj.lift || 0, f.a), a: f.a }; }
        let x = f.x, lift = f.lift;
        for (let j = 0; j < ivs.length; j++) {
          const d = tc - ivs[j][1], e = ivs[j][0] - tc;
          if (d > 0 && d < 0.15) { x += pin(side, j).off * (1 - smooth(d / 0.15)); lift *= smooth(d / 0.1); }   // lift off smoothly
          if (e > 0 && e < 0.1) lift *= smooth(e / 0.1);                                                    // and touch down
        }
        return { x, y: footY(lift, f.a) + air, a: f.a };
      }
      function poseAt(tc) {
        const S = cloneS(E.S);
        let air = 0, airborne = false;
        if (fl && tc > fl[0] && tc < fl[1]) { const u = (tc - fl[0]) / (fl[1] - fl[0]); air = Hj * 4 * u * (1 - u); airborne = true; }
        S.rx = rootX(tc) * L;
        S.ry = A + spl(P, 'h', tc) * L + air;
        S.faceTurn = P.ch.turn ? spl(P, 'turn', tc) : 0;
        for (const f of ['lean', 'tilt', 'twist', 'neck', 'head', 'bend']) S[f] = spl(P, f, tc) * D2R;
        S.chest = spl(P, 'chest', tc); S.stretch = clamp(spl(P, 'stretch', tc), 1, 1.12); S.squash = spl(P, 'squash', tc);
        S.arms.near = spl(P, 'armN', tc).map(d => d * D2R); S.arms.far = spl(P, 'armF', tc).map(d => d * D2R);
        for (const side of SIDES) S.feet[side] = footAt(side, tc, air);
        const hs = discAt(P.hands, tc, null);
        S.hands = typeof hs === 'string' ? { near: hs, far: hs } : Array.isArray(hs) ? { near: hs[0], far: hs[1] } : Object.assign({}, E.S.hands);
        S.mouth = discAt(P.mouth, tc, null);
        return { S, airborne };
      }
      const yA = groundAt(E.x), yB = fl ? groundAt(E.x + E.facing * rootX(P.dur) * L * k) : yA;
      const lifeAmt = c.life || 0;
      const inW = (w, x) => !!w && w.some(q => x >= q[0] && x <= q[1]);
      let flipX = null;
      return { t0, end: t0 + (P.cyc ? blendIn : total), clip: P, at(t) {
        const tau = t - t0, tc = clipT(Math.max(0, tau));
        let { S, airborne } = poseAt(tc);
        if (opts.upper) {
          const U = cloneS(E.S);
          for (const f of ['lean', 'bend', 'twist', 'head', 'neck']) U[f] = (E.S[f] || 0) + (S[f] || 0) - (UPSTAND[f] || 0);
          U.arms = { near: S.arms.near.slice(), far: S.arms.far.slice() }; U.hands = Object.assign({}, S.hands);
          U.mouth = S.mouth; U.faceTurn = S.faceTurn; U.chest = S.chest;
          S = U; airborne = false;
        }
        if (tau < blendIn) {
          let src = null;
          if (prev) {
            const ps = prev.at(t);
            if (ps.facing === E.facing) { const d = (ps.x - E.x) * E.facing / k - ps.S.rx; src = cloneS(ps.S); src.rx += d; for (const s of SIDES) src.feet[s].x += d; }
          }
          S = blendS(src || E.S, S, smooth(Math.max(0, tau) / blendIn));
        }
        const flipped = c.flip !== undefined && tc >= c.flip;
        // turning round mirrors the body about the planted foot (flipAbout: 'near' | 'far') or the root
        if (flipped && flipX === null) flipX = c.flipAbout === 'near' || c.flipAbout === 'far' ? footAt(c.flipAbout, c.flip, 0).x : rootX(c.flip) * L;
        const life = P.cyc ? lifeAmt : tau > total ? smooth((tau - total) / 0.6) : lifeAmt * smooth(tau / 0.5);
        const st = mkState(S, flipped ? E.x + 2 * E.facing * k * flipX : E.x, flipped ? -E.facing : E.facing, { life, fling: c.fling && tau < total + 0.5 ? c.fling : 1, kind: c === CharClips.idle ? 'idle' : 'clip',
          aim: c.aim ? { near: inW(c.aim.near, tc), far: inW(c.aim.far, tc) } : null, reach: reachKeys(c, tc) });
        if (fl) st.y = airborne ? lerp(yA, yB, (tc - fl[0]) / (fl[1] - fl[0])) : (tc <= fl[0] ? yA : yB);
        st.airborne = airborne;
        return st;
      } };
    }
    // hand-target keys near clip time tc: { side, spec, w } (w = 1 within 0.1 s of the key, 0 beyond 0.35 s)
    function reachKeys(c, tc) {
      let out = null;
      const ks = c.keys || [];
      for (let i = 0; i < ks.length; i++) for (const sd of SIDES) {
        const q = ks[i], spec = q['_tg' + sd];
        if (!spec) continue;
        const d = Math.abs(tc - q.t);
        // a hand on a partner stays there until the next key that does not name the same place
        const nx = spec.who !== undefined && tc >= q.t ? ks.slice(i + 1).find(k2 => k2['_tg' + sd] || k2[sd === 'near' ? 'armN' : 'armF']) : null;
        if (nx && nx['_tg' + sd] && nx['_tg' + sd].at === spec.at && tc <= nx.t) (out = out || []).push({ side: sd, spec, w: 1 });
        else if (d < 0.35) (out = out || []).push({ side: sd, spec, w: 1 - smooth((d - 0.1) / 0.25) });
      }
      return out;
    }
    function clipLoopT(P, tau, times) {
      if (P.c.loop && !P.cyc && times > 1) { const a = P.c.loop[0], b = P.c.loop[1], ex = (Math.round(times) - 1) * (b - a); if (tau > b) tau = tau < b + ex ? a + ((tau - b) % (b - a)) : tau - ex; }
      return tau;
    }
    function clipArmVals(P, tau, times) {
      tau = clipLoopT(P, tau, times);
      const tc = clamp(tau, 0, P.dur), has = f => !!P.ch[f], hs = discAt(P.hands, tc, null);
      const ang = f => has(f) ? spl(P, f, tc) * D2R : 0;
      return { N: has('armN') ? spl(P, 'armN', tc).map(d => d * D2R) : null, F: has('armF') ? spl(P, 'armF', tc).map(d => d * D2R) : null,
        hands: hs ? (typeof hs === 'string' ? [hs, hs] : hs) : null,
        add: { lean: ang('lean'), head: ang('head'), twist: ang('twist'), neck: ang('neck'), bend: ang('bend'), turn: has('turn') ? spl(P, 'turn', tc) : 0, h: has('h') ? spl(P, 'h', tc) * L : 0 },
        stretch: has('stretch') ? spl(P, 'stretch', tc) : 1, wig: [], bob: null };
    }
    // ---------------------------------------------------------------- action files (docs/ACTIONS.md)
    // An action file is key poses in body terms. Here it becomes a clip for THIS body: hand targets
    // named by landmarks are solved by IK on this body's proportions at each key, then the clip
    // plays as usual (splines, overlap lag, contacts, cross-fade, weight and mood tempo).
    function applyPosture(S) { if (MO.posture) { const q = MO.posture; S.lean += 0.2 * q; S.bend = (S.bend || 0) + 0.28 * q; S.neck += 0.3 * q; S.head -= 0.35 * q; S.ry -= 0.03 * L * Math.max(0, q); } }
    const rotv = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
    const handR = Math.max(0.05, (ch.body ? pr.hand : 0.23) * 0.35);
    const LANDMARKS = ['top', 'forehead', 'eye', 'mouth', 'chin', 'ear', 'backhead', 'neck', 'chest', 'belly', 'hip', 'back', 'seat', 'knee', 'ground', 'front', 'up', 'out', 'down', 'wall', 'wallHigh', 'wallLow', 'face', 'shoulder', 'waist', 'side', 'torso'];
    // where a partner's landmark is expected before the stage puts the hand on the real one (docs/PAIRS.md):
    // the partner stands 'apart' head heights ahead, facing this body, 'size' times as tall
    const PGUESS = { front: [-0.08, 0.3], knee: [-0.05, 0.27], around: [0, 0.7], side: [0, 0.6], head: [0, 0.93], top: [0, 0.98], face: [-0.06, 0.88], shoulder: [0, 0.8], chest: [-0.07, 0.7], belly: [-0.08, 0.55], back: [0.07, 0.68], waist: [0.06, 0.55], hip: [0, 0.5], hand: [-0.5, 0.48], arm: [-0.3, 0.62] };
    function partnerGuess(S, spec) {
      const g = PGUESS[spec.at.slice(8)] || PGUESS.chest, Hp = (spec.size || 1) * H, d = (spec.apart || 1);
      const x = spec.at === 'partner.hand' || spec.at === 'partner.arm' ? d * (1 + g[0]) : d + g[0] * Hp;
      if (spec.at === 'partner.hand') return [x - S.rx, Math.min(H, Hp) * 0.8 - 0.4];   // as the stage meets hands: the shorter one's chest
      return [x - S.rx, g[1] * Hp];
    }
    function landmark(S, side, name, wallD, spec) {
      if (/^partner\./.test(name)) return partnerGuess(S, spec || { at: name });
      const pose = poseOf({ S, x: 0, y: 0, facing: 1 }), sol = CharRig.solve(ch, pose);
      return lmOn(sol, side, name, wallD, S.rx);
    }
    // the front of the torso as the skin draws it (curves flattened), torso frame; -Infinity without parts
    let drawnF = null;
    function drawnFront() {
      if (drawnF !== null) return drawnF;
      drawnF = new Array(13).fill(-Infinity);   // heights -0.2 .. 1.0 of the torso (an apron hangs below it)
      const T = pr.torso;
      for (const e of [].concat((ch.parts || {}).torso || [])) if (e && e.d && CharRig.parsePath) {
        let cur = [0, 0];
        const see = p => { const i = Math.round((p[1] / T + 0.2) / 0.1); if (i >= 0 && i < 13) drawnF[i] = Math.max(drawnF[i], p[0]); };
        for (const s of CharRig.parsePath(e.d)) {
          if (s[0] === 'M') cur = s[1];
          else if (s[0] === 'L') { see(s[2]); cur = s[2]; }
          else if (s[0] === 'C') { for (let i = 1; i <= 10; i++) { const u = i / 10, v = 1 - u; see([v * v * v * cur[0] + 3 * v * v * u * s[1][0] + 3 * v * u * u * s[2][0] + u * u * u * s[3][0], v * v * v * cur[1] + 3 * v * v * u * s[1][1] + 3 * v * u * u * s[2][1] + u * u * u * s[3][1]]); } cur = s[3]; }
          else if (s[0] === 'Q') { for (let i = 1; i <= 10; i++) { const u = i / 10, v = 1 - u; see([v * v * cur[0] + 2 * v * u * s[1][0] + u * u * s[2][0], v * v * cur[1] + 2 * v * u * s[1][1] + u * u * s[2][1]]); } cur = s[2]; }
          else if (s[0] === 'A') { see(s[5]); cur = s[5]; }
        }
      }
      return drawnF;
    }
    // a landmark on a solved pose (rig coords, root at x = 0)
    function lmOn(sol, side, name, wallD, rx) {
      const J = sol.joints, An = sol.angles;
      const W = ch.body ? ch.body.b.headWidth : 0.9, hr = handR, T = pr.torso, reach = pr.upperArm + pr.foreArm;
      const H = p => { const q = rotv(p, An.head); return [J.headBase[0] + q[0], J.headBase[1] + q[1]]; };
      const prof = ch.body ? ch.body.profile : (() => ({ front: 0.28, back: -0.28 }));
      const Tt = p => sol.spine && (sol.spine.tb !== 0 || sol.spine.ts !== 1) ? CharRig.spineWarp(sol.spine, p).p : (q => [J.root[0] + q[0], J.root[1] + q[1]])(rotv(p, An.torso));
      const sh = J['shoulder.' + side];
      switch (name) {
        case 'shoulder': return [sh[0] - 0.02, sh[1] + 0.12 + hr];
        case 'shoulderJoint': return sh.slice();
        case 'waist': return Tt([prof(0.22 * T).back - hr, 0.22 * T]);
        case 'torso': case 'torsoLine': {   // the most forward point of the torso as drawn (a skin's apron or belly counts), no hand radius
          const df = drawnFront();
          const line = []; for (let i = 0; i < 13; i++) { const f = -0.2 + 0.1 * i; if (f < 0 && !isFinite(df[i])) continue; line.push(Tt([Math.max(f >= 0 ? prof(f * T).front : -Infinity, df[i]), f * T])); }
          return name === 'torsoLine' ? line : line.reduce((b, p) => p[0] > b[0] ? p : b); }
        case 'side': { const q = prof(0.5 * T); return Tt([0.55 * q.back + 0.45 * q.front, 0.5 * T]); }   // the flank, halfway through the body
        case 'face': return H([0.45 * W + hr, 0.45]);
        case 'wrist.near': case 'wrist.far': return J[name].slice();
        case 'hand': return J['wrist.' + side].slice();
        case 'arm': { const e = J['elbow.' + side], w = J['wrist.' + side]; return [(e[0] + w[0]) / 2, (e[1] + w[1]) / 2]; }
        case 'top': return H([0, (ch.headTop || 1.04) + hr]);
        case 'forehead': return H([0.45 * W + hr, 0.78]);
        case 'eye': return H([0.44 * W + hr, 0.55]);
        case 'mouth': return H([0.5 * W + hr, 0.25]);
        case 'chin': return H([0.3 * W, -hr]);
        case 'ear': return H([-0.06 * W, 0.5]);
        case 'backhead': return H([-0.55 * W - hr, 0.55]);
        case 'neck': { const q = rotv([0.08 + hr, 0.03], An.neck); return [J.neckBase[0] + q[0], J.neckBase[1] + q[1]]; }
        case 'chest': return Tt([prof(0.72 * T).front + hr, 0.72 * T]);
        case 'belly': return Tt([prof(0.4 * T).front + hr, 0.4 * T]);
        case 'hip': return Tt([0.05, 0.1 * T]);
        case 'back': return Tt([prof(0.55 * T).back - hr, 0.55 * T]);
        case 'seat': return Tt([prof(0.05 * T).back - hr, 0.05 * T]);
        case 'knee': return [J['knee.near'][0] + 0.1, J['knee.near'][1] + 0.05];
        case 'ground': return [J.root[0] + 0.5 * L, hr];
        case 'front': return [sh[0] + 0.85 * reach, sh[1] - 0.05 * reach];
        case 'up': return [sh[0] + 0.15 * reach, sh[1] + 0.85 * reach];
        case 'out': return [sh[0] + 0.6 * reach, sh[1] + 0.6 * reach];
        case 'down': return [sh[0] + 0.05, sh[1] - 0.92 * reach];
        // a wall `wall` leg lengths ahead of where the action started (negative: behind), surface side
        case 'wall': case 'wallHigh': case 'wallLow': {
          const wx = (wallD || 0) * L - (rx || 0), toward = wallD >= 0 ? -1 : 1;
          const y = name === 'wall' ? sh[1] : name === 'wallHigh' ? J.headBase[1] + 0.5 : J.root[1] + 0.1 * T;
          return [wx + toward * hr, y];
        }
      }
      return null;
    }
    // a hand target: 'chin' | ['chin', dx, dy] | { at: 'chin', dx, dy }; dx forward, dy up, head heights
    function targetOf(S, side, spec) {
      const s = typeof spec === 'string' ? { at: spec } : Array.isArray(spec) ? { at: spec[0], dx: spec[1], dy: spec[2] } : (spec || {});
      const p = landmark(S, side, s.at, s.wall, s);
      return p ? [p[0] + (+s.dx || 0), p[1] + (+s.dy || 0)] : null;
    }
    // shoulder and elbow angles (radians, as in S.arms) that put this side's wrist on a point
    function armTo(S, side, tgt) {
      const sol = CharRig.solve(ch, poseOf({ S, x: 0, y: 0, facing: 1 })), sh = sol.joints['shoulder.' + side], ta = sol.angles.torso;
      let best = null;
      for (const sd of [-1, 1]) {
        const r = CharRig.ik2(sh, tgt, pr.upperArm, pr.foreArm, sd);
        const ua = Math.atan2(r.mid[1] - sh[1], r.mid[0] - sh[0]), fa = Math.atan2(r.end[1] - r.mid[1], r.end[0] - r.mid[0]);
        const el = wrapA(fa - ua);
        if (el >= -1e-6 && (!best || sd < 0)) best = [wrapA(ua - ta + Math.PI / 2), el];
      }
      return best;
    }
    const userActs = () => { const g = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : {}); return g.CharActions || {}; };
    const actCache = new Map();
    // poses that actions can start from, pass through or end in: the built-in sit, kneel and crouch, a
    // lying pose (on the back, legs out ahead), standing. Fields as in a clip key; feet relative to the pelvis.
    const presetCache = {};
    function presetOf(name) {
      if (presetCache[name] !== undefined) return presetCache[name];
      const run = ks => { let s = resolveKey(STAND, baseS(), {}); for (const q of ks) s = resolveKey(q, s, { on: 0 }); return s; };
      let S = null;
      if (name === 'stand') S = resolveKey(STAND, baseS(), {});
      else if (name === 'sit') S = run(ACTIONS.sit.keys);
      else if (name === 'kneel') S = run(ACTIONS.kneel.keys);
      else if (name === 'squat') S = run(ACTIONS.crouch.keys);
      else if (name === 'heels') {   // both knees down, sitting back on the heels: an adult at a child's height
        S = resolveKey(STAND, baseS(), {});
        const ry = 0.5 * L, a = 1.35;
        S.ry = ry; S.lean = 0.08; S.bend = 0; S.head = 0.1; S.neck = 0.05; S.twist = 0; S.tilt = 0; S.rx = 0;
        S.feet.near = { x: -0.5 * L, y: -minRotY(a) + 0.01, a }; S.feet.far = { x: -0.44 * L, y: -minRotY(a) + 0.01, a };
        S.arms.near = [0.2, 0.5, 0]; S.arms.far = [0.25, 0.5, 0];
      }
      else if (name === 'lie') {
        S = resolveKey(STAND, baseS(), {});
        const ry = Math.max(0.65 * pr.radius.hip, 0.12), a = 1.2, fy = -minRotY(a);
        S.ry = ry; S.lean = -1.5; S.bend = 0; S.head = -0.12; S.neck = 0; S.twist = 0; S.tilt = 0; S.rx = 0;
        const ext = Math.sqrt(Math.max(0.01, Math.pow(L * 0.97, 2) - Math.pow(ry - fy, 2)));
        S.feet.near = { x: ext, y: fy, a }; S.feet.far = { x: ext - 0.08 * L, y: fy, a };
        S.arms.near = [0.22, 0.12, 0]; S.arms.far = [0.18, 0.12, 0];
      }
      if (!S) return (presetCache[name] = null);
      const f = { h: (S.ry - A) / L, lean: S.lean / D2R, bend: (S.bend || 0) / D2R, twist: S.twist / D2R, head: S.head / D2R, neck: S.neck / D2R, tilt: S.tilt / D2R,
        chest: S.chest || 1, armN: S.arms.near.map(v => v / D2R), armF: S.arms.far.map(v => v / D2R) };
      const ft = sd => { const q = S.feet[sd]; return [(q.x - S.rx) / L, Math.max(0, (q.y + minRotY(q.a)) / L), q.a / D2R]; };
      return (presetCache[name] = { f, dx: S.rx / L, near: ft('near'), far: ft('far') });
    }
    const BODYF = ['lean', 'bend', 'twist', 'head', 'neck', 'tilt', 'chest', 'squash', 'x', 'h'];
    function actionClip(def, args) {
      const key = def.name + JSON.stringify(args || {});
      if (actCache.has(def) && actCache.get(def).has(key)) return actCache.get(def).get(key);
      const body = def.channel !== 'arms', val = v => typeof v === 'function' ? v(args || {}, { L, heads: H }) : v;
      // a key's low: {...} replaces its fields when the partner is under 0.6 of this body's height (a child), high: {...} over 1.65
      const sz = args && isFinite(+args.size) ? +args.size : 1;
      // the role's own low / high replace those fields in every key that names no pose and is not 'stand'
      // a role with no low of its own that puts a hand on a much smaller partner kneels on the heels by default
      const isRole = /^w+.(a|b)$/.test(def.name || ''), touchesPartner = (def.keys || []).some(q => /partner./.test(JSON.stringify([q.handNear, q.handFar])));
      const roleV = v => def[v] || (v === 'low' && isRole && touchesPartner ? { pose: 'heels' } : null);
      const variant = k0 => { const v = sz < 0.6 ? 'low' : sz > 1.65 ? 'high' : null; if (!v) return k0; const all = roleV(v) && !k0.pose && !k0.stand ? roleV(v) : null; return all || k0[v] ? Object.assign({}, k0, all || {}, k0[v] || {}) : k0; };
      const keys = (def.keys || []).map(variant).map(k0 => { const q = {}; for (const f of Object.keys(k0)) if (f !== 'low' && f !== 'high') q[f] = val(k0[f]); return q; }).filter(q => isFinite(+q.t)).sort((a, b) => a.t - b.t);
      const standK = body ? { lean: STAND.lean, bend: 0, twist: STAND.twist, head: STAND.head, neck: STAND.neck, tilt: STAND.tilt, chest: 1, squash: [1, 1], x: 0, h: STAND.h, armN: STAND.armN.slice(), armF: STAND.armF.slice() }
        : { lean: 0, head: 0, twist: 0, neck: 0, h: 0, armN: STAND.armN.slice(), armF: STAND.armF.slice() };
      const out = [Object.assign({ t: 0 }, JSON.parse(JSON.stringify(standK)))];
      const aim = { near: [], far: [] };
      let lastCrouch = 0, lastY = 0, curX = 0;
      const step = def.step || null;
      const footSpec = f => {   // [ahead, lift, angle] | 'step' | ['step', dx] | 'ground' | ['ground', dx]
        const nm = typeof f === 'string' ? f : (Array.isArray(f) && typeof f[0] === 'string' ? f[0] : null);
        if (!nm) return f.slice();
        const dx = Array.isArray(f) ? (+f[1] || 0) : 0;
        return nm === 'step' && step ? [(+step.ahead || 0.4) + 0.12 + dx, +step.height || 0.2, 0] : [STAND.near[0] + dx, 0, 0];
      };
      for (const k of keys) {
        const c = { t: Math.max(0.02, +k.t) };
        if (k.hold) c.flat = true;
        if (k.stand) Object.assign(c, JSON.parse(JSON.stringify(standK)));
        if (body && k.pose) { const p = presetOf(k.pose); if (p) { const bx = (k.x !== undefined ? +k.x : curX) + p.dx; Object.assign(c, JSON.parse(JSON.stringify(p.f))); c.x = bx; if (!k.footNear) c._fN = [p.near[0] + bx, p.near[1], p.near[2]]; if (!k.footFar) c._fF = [p.far[0] + bx, p.far[1], p.far[2]]; lastCrouch = 0; lastY = 0; } }
        if (k.turn !== undefined) c.turn = clamp(+k.turn, -1, 1);
        for (const f of ['lean', 'bend', 'twist', 'head', 'neck', 'tilt']) if (k[f] !== undefined) c[f] = +k[f];
        if (isRole && c.lean !== undefined && !(k.pose === 'lie')) c.lean = clamp(c.lean, -60, 50);   // a paired role bends, it never topples
        if (k.chest !== undefined) c.chest = +k.chest;
        if (k.squash !== undefined) c.squash = k.squash;
        if (k.x !== undefined) c.x = +k.x;
        if (body && (k.crouch !== undefined || k.y !== undefined)) {   // pelvis height: crouch lowers it, y raises the whole body (a step, a ledge)
          if (k.crouch !== undefined) lastCrouch = clamp(+k.crouch, 0, 1);
          if (k.y !== undefined) lastY = +k.y;
          c.h = 0.975 - 0.45 * lastCrouch + lastY;
        }
        if (body && k.rise !== undefined) {   // up on the toes: heels lift (the toes stay planted), pelvis rises
          const r = clamp(+k.rise, 0, 1);
          c.h = 0.975 + 0.06 * r;
          if (!k.footNear) c._fN = [STAND.near[0], 0, -32 * r];
          if (!k.footFar) c._fF = [STAND.far[0], 0, -32 * r];
        }
        if (!body && k.bob !== undefined) c.h = +k.bob / L;
        if (k.armNear) c.armN = k.armNear.slice(); if (k.armFar) c.armF = k.armFar.slice();
        if (body && k.footNear) c._fN = footSpec(k.footNear); if (body && k.footFar) c._fF = footSpec(k.footFar);
        if (k.hands) c.hands = typeof k.hands === 'string' ? k.hands : [k.hands.near || 'relaxed', k.hands.far || 'relaxed'];
        if (k.mouth !== undefined) c.mouth = k.mouth;
        const norm = h => { const s = typeof h === 'string' ? { at: h } : Array.isArray(h) ? { at: h[0], dx: h[1], dy: h[2] } : Object.assign({}, h); if (def.wall !== undefined) s.wall = +def.wall;
          if (/^partner\./.test(s.at)) { s.who = (args && args.with) || ''; s.apart = args && isFinite(+args.apart) ? +args.apart : 1; s.size = sz; }
          return s; };
        if (k.handNear) { c._hN = norm(k.handNear); aim.near.push(c.t); }
        if (k.handFar) { c._hF = norm(k.handFar); aim.far.push(c.t); }
        if (c.x !== undefined) curX = c.x;
        out.push(c);
      }
      // an action whose first key names a pose starts in it (getup from lying, standup from sitting)
      if (body && keys.length && keys[0].pose && out.length > 1) { const c1 = out[1]; for (const f of Object.keys(c1)) if (f !== 't' && f !== 'flat' && !f.startsWith('_h')) out[0][f] = JSON.parse(JSON.stringify(c1[f])); }
      // feet are written from where the pelvis started (leg lengths ahead, lift, toe angle); a foot
      // that is down at two keys in the same place is planted between them (no slide)
      const autoC = { near: [], far: [] };
      if (body) {
        let x = 0;
        const last = { _fN: [STAND.near[0], 0, 0], _fF: [STAND.far[0], 0, 0] }, down = { _fN: 0, _fF: 0 };
        const anyFeet = out.some(c => c._fN || c._fF) || out.some(c => c.x);
        for (const c of out) {
          if (c.x !== undefined) x = c.x;
          for (const [fk, side, ck] of [['_fN', 'near', 'near'], ['_fF', 'far', 'far']]) {
            const f = c[fk] || (anyFeet ? last[fk] : null);
            if (!f) continue;
            const same = Math.abs(f[0] - last[fk][0]) < 0.02 && Math.abs((f[1] || 0) - (last[fk][1] || 0)) < 0.01;
            const onSurface = (f[1] || 0) <= 1e-6 || (step && Math.abs((f[1] || 0) - (+step.height || 0.2)) < 0.01);
            if (c[fk] && onSurface && same && c.t > 0) autoC[side].push([down[fk], c.t]);
            if (!onSurface || !same) down[fk] = c.t;
            c[ck] = [f[0] - x, f[1] || 0, f[2] || 0];
            last[fk] = f.slice(); delete c[fk];
          }
        }
      }
      // hand targets: the body pose at that key (without arms), then IK on this body
      const plain = out.map(c => { const q = Object.assign({}, c); delete q._hN; delete q._hF; return q; });
      const probe = prepClip({ dur: Math.max(0.05, plain[plain.length - 1].t), keys: plain, blendIn: 0 });
      const entry = mkState(resolveKey(STAND, baseS(), {}), 0, 1);
      const pseg = body ? clipSeg(0, entry, null, probe, {}) : null;
      for (const c of out) for (const [hk, side, ak] of [['_hN', 'near', 'armN'], ['_hF', 'far', 'armF']]) {
        if (!c[hk]) continue;
        let S;
        if (body) S = cloneS(pseg.at(c.t).S);
        else { S = resolveKey(STAND, baseS(), {}); for (const f of ['lean', 'head', 'twist', 'neck']) S[f] += (c[f] || 0) * D2R; }
        applyPosture(S);
        let tg = targetOf(S, side, c[hk]), a = tg && armTo(S, side, tg);
        // too far for this arm: bring the landmark to the hand (head nods toward it, body leans or
        // crouches toward the ground); what is still out of reach is reached as far as the arm goes
        const lmName = c[hk].at;
        const reachOK = () => { const sol = CharRig.solve(ch, poseOf({ S, x: 0, y: 0, facing: 1 })), sh = sol.joints['shoulder.' + side]; return Math.hypot(tg[0] - sh[0], tg[1] - sh[1]) < 0.97 * (pr.upperArm + pr.foreArm); };
        const HEADL = { top: 1, forehead: 1, eye: 1, mouth: 1, chin: 1, ear: 1, backhead: 1 };
        if (c._assisted) { S.lean += c._assisted.lean; S.ry += c._assisted.ry; S.neck += c._assisted.neck; S.head += c._assisted.head; tg = targetOf(S, side, c[hk]); }
        const as0 = { lean: 0, ry: 0, neck: 0, head: 0 };
        for (let i = 0; tg && !c._assisted && i < 4 && !reachOK(); i++) {
          if (HEADL[lmName]) { S.neck += 0.07; S.head += 0.06; as0.neck += 0.07; as0.head += 0.06; }
          else if (lmName === 'ground' || lmName === 'knee') { S.lean += 0.08; S.ry -= 0.04 * L; as0.lean += 0.08; as0.ry -= 0.04 * L; }
          else if (/^partner./.test(lmName) && tg[1] < S.ry + 0.6 * pr.torso) { S.lean += 0.1; S.ry -= 0.05 * L; as0.lean += 0.1; as0.ry -= 0.05 * L; }   // a smaller partner: bend down to them
          else break;
          tg = targetOf(S, side, c[hk]);
        }
        if (!c._assisted && (as0.lean || as0.neck)) {
          c._assisted = as0;
          if (as0.neck) { c.neck = (c.neck !== undefined ? c.neck : STAND.neck) + as0.neck / D2R; c.head = (c.head !== undefined ? c.head : STAND.head) + as0.head / D2R; }
          if (as0.lean) { c.lean = (c.lean !== undefined ? c.lean : STAND.lean) + as0.lean / D2R; c.h = (c.h !== undefined ? c.h : STAND.h) + as0.ry / L; }
          if (isRole && c.lean !== undefined) c.lean = clamp(c.lean, -60, 50);
        }
        a = tg && armTo(S, side, tg);
        if (tg) (c._pts = c._pts || {})[side] = tg;
        if (a) c[ak] = [a[0] / D2R, a[1] / D2R, c[ak] && c[ak][2] !== undefined ? c[ak][2] : 0];
        c['_tg' + side] = c[hk];
        delete c[hk];
      }
      // anticipation: a small counter-move before the first key; settle: a small overshoot after the last
      const NUM = ['lean', 'bend', 'twist', 'head', 'neck', 'tilt', 'x', 'h', 'armN', 'armF'];
      const an = def.anticipation === undefined ? 1 : +def.anticipation, se = def.settle === undefined ? 1 : +def.settle;
      if (an > 0 && out.length > 1) {
        const k1 = out[1], pre = { t: Math.min(0.14, 0.45 * k1.t) };
        if (pre.t > 0.04) {
          for (const f of NUM) if (k1[f] !== undefined && out[0][f] !== undefined) pre[f] = Array.isArray(k1[f]) ? k1[f].map((v, j) => out[0][f][j] - 0.18 * an * (v - out[0][f][j])) : out[0][f] - 0.18 * an * (k1[f] - out[0][f]);
          out.splice(1, 0, pre);
        }
      }
      // loop: true repeats forever unless the script gives times= or for=, then it ends like any action
      const loopAll = def.loop === true && !(+(args || {}).times > 0 || +(args || {}).for > 0);
      if (body && def.end !== 'hold' && !loopAll) {
        // end state: back to standing (default), or into a sit, kneel, squat or lying pose that holds
        const last = out[out.length - 1], endP = def.end && def.end !== 'stand' ? presetOf(def.end) : null;
        let lx = 0; for (const q of out) if (q.x !== undefined) lx = q.x;
        const fin = Object.assign({ t: last.t + (def.back === undefined ? 0.45 : +def.back) }, JSON.parse(JSON.stringify(endP ? endP.f : standK)));
        fin.x = lx + (endP ? endP.dx : 0);
        if (endP) { fin.near = endP.near.slice(); fin.far = endP.far.slice(); }
        out.push(fin);
      }
      if (se > 0 && out.length > 2) {
        const a = out[out.length - 2], b = out[out.length - 1], over = { t: b.t + 0.13 }, fin = Object.assign({}, b, { t: b.t + 0.32 });
        for (const f of NUM) if (b[f] !== undefined && a[f] !== undefined) over[f] = Array.isArray(b[f]) ? b[f].map((v, j) => v + 0.1 * se * (v - a[f][j])) : b[f] + 0.1 * se * (b[f] - a[f]);
        delete fin.flat; delete fin._tgnear; delete fin._tgfar; delete fin._pts;
        out.push(over, fin);
      }
      const dur = out[out.length - 1].t;
      const ov = def.overlap === undefined ? 1 : +def.overlap;
      const lag = body ? { head: 0.06 * ov, neck: 0.05 * ov, armN: 0.07 * ov, armF: 0.1 * ov } : { armF: 0.05 * ov, head: 0.08 * ov, lean: 0.05 * ov };
      const pl = def.planted === undefined ? (def.travel || def.air || def.step ? 'none' : 'both') : def.planted;
      // airborne: the body flies a parabola between air[0] and air[1] (height in leg lengths), and lands with a squash
      if (body && Array.isArray(def.air)) {
        const [a0, a1] = def.air;
        if (!out.some(c => c.t > a1 && c.t <= a1 + 0.2 && c.squash)) {
          out.push({ t: a1 + 0.08, squash: [1.07, 0.93], h: 0.975 - 0.45 * 0.25 }, { t: a1 + 0.3, squash: [1, 1], h: 0.975 });
          out.sort((p, q) => p.t - q.t);
        }
      }
      const contacts = body ? { near: pl === 'both' || pl === 'near' ? [[0, dur]] : autoC.near, far: pl === 'both' || pl === 'far' ? [[0, dur]] : autoC.far } : {};
      if (body && def.travel && !keys.some(k => k.x !== undefined)) for (const c of out) c.x = def.travel * c.t / dur;
      // aim windows: while a hand goes to (or stays at) a landmark, the keep-out leaves it alone
      const win = ts => { const w = []; ts.forEach((t, i) => w.push([t - 0.3, (i + 1 < ts.length && ts[i + 1] - t < 0.8 ? ts[i + 1] : t) + 0.25])); return w; };
      const userLast = keys.length ? Math.max(...keys.map(q => +q.t)) : dur;
      const loop = loopAll ? [0, dur] : def.loop === true ? [Math.min(+keys[0].t, userLast - 0.05), userLast] : (Array.isArray(def.loop) ? def.loop : null);
      // contact: hands may touch the head and body on purpose for the whole action (no keep-out)
      const ct = def.contact ? [[-1, dur + 1]] : null;
      // start: the action eases out of whatever the actor was doing (sitting, kneeling...) over its first key
      const bIn = def.blendIn !== undefined ? def.blendIn : (body ? clamp(keys.length ? +keys[0].t : 0.15, 0.15, 0.6) : 0.15);
      const clip = { dur, keys: out, lag, contacts, blendIn: bIn, loop, life: loopAll ? 0.2 : 0,
        aim: { near: ct || win(aim.near), far: ct || win(aim.far) }, name: def.name };
      if (body && Array.isArray(def.air)) { clip.flight = def.air.slice(); clip.height = def.height === undefined ? 0.4 : +def.height; }
      if (!actCache.has(def)) actCache.set(def, new Map());
      actCache.get(def).set(key, clip);
      return clip;
    }
    // ---------------------------------------------------------------- mood layer
    const MOODMOTION = CharPoses.moodMotion || {};
    const moodEvs = evs.filter(e => e.channel === 'mood');
    function moodVec(t) {
      const v = { lean: 0, bend: 0, neck: 0, head: 0, twist: 0, chest: 0, drop: 0, shoulder: 0, elbow: 0, cadence: 0, stride: 0, swing: 0, bounce: 0, tempo: 0, fist: 0 };
      for (const e of moodEvs) {
        if (e.t > t) break;
        const m = MOODMOTION[e.args.name] || {}, s = clamp(e.args.strength === undefined ? 1 : +e.args.strength, 0, 2), u = smooth((t - e.t) / 0.6);
        for (const f of Object.keys(v)) v[f] = lerp(v[f], (m[f] || 0) * s, u);
      }
      return v;
    }
    function turnSeg(t0, entry, prev) {
      blinkAt.push(t0 + 0.12);
      const TP = ACTIONS.turn.clip && prepClip(ACTIONS.turn.clip);
      if (TP) return clipSeg(t0, entry, prev || null, TP, { ts: TS });
      const E = rebase(entry), dur = ACTIONS.turn.dur || 0.34, end = t0 + dur;
      const tuck = [10 * D2R, 50 * D2R, 0];
      return { t0, end, at(t) {
        const u = clamp((t - t0) / dur, 0, 1), su = smooth(u), b = Math.sin(Math.PI * u);
        const S = cloneS(E.S);
        S.ry -= 0.035 * L * b;
        for (const s of SIDES) for (let j = 0; j < 3; j++) S.arms[s][j] = lerp(S.arms[s][j], tuck[j], 0.6 * b);
        S.lean += 0.08 * b;
        S.squash = [S.squash[0] * (0.28 + 0.72 * Math.abs(Math.cos(Math.PI * su))), S.squash[1]];
        return mkState(S, E.x, su < 0.5 ? E.facing : -E.facing, { life: u >= 1 ? smooth((t - end) / 0.6) : 0 });
      } };
    }
    // stand back up first when coming from a low pose (kneel, sit, crouch)
    function maybeGetUp(list, t, cur) {
      if (cur.S.ry > A + 0.82 * L) return { t, cur };
      const s = keyedSeg(t, cur, [Object.assign({}, STAND, { dur: 0.42, ease: 'inOut', lean: 18, x: null })], {});
      list.push(s);
      return { t: s.end, cur: s.at(s.end) };
    }
    // beat grid step (s) at a time, 0 = none (stage.js passes env.grid from the script's clock: tempo)
    const gridAt = t => { try { const g = env.grid ? +env.grid(t) : 0; return g > 0.05 ? g : 0; } catch (e) { return 0; } };
    const onGrid = (t, g) => g ? Math.ceil(t / g - 1e-6) * g : t;
    function gaitSegs(spec, t, cur, targetX, speed, steps, endMode, prev) {
      const list = [];
      const dirn = Math.sign(targetX - cur.x) || cur.facing;
      if (Math.abs(targetX - cur.x) < 0.05 * L * k) return list;
      ({ t, cur } = maybeGetUp(list, t, cur));
      if (list.length) prev = list[list.length - 1];
      if (dirn !== cur.facing) { const s = turnSeg(t, cur, prev); list.push(s); t = s.end; cur = s.at(t); prev = s; }
      // on a beat grid every foot strikes on a grid step: the first one step after the start
      const g = gridAt(t);
      if (g && list.length) t = onGrid(t, g);
      // a start clip (anticipation) plays first; the gait cross-fades in from its last pose
      const startP = !g && spec.start ? prepClip(spec.start) : null;
      if (startP) { const s = clipSeg(t, cur, prev, startP, { ts: TS }); list.push(s); t = s.end; cur = s.at(t); prev = s; }
      // end=skid: arrive at full speed, then the skid clip slides the rest of the way
      const skidP = !g && endMode === 'skid' ? prepClip('skid') : null;
      const E = rebase(cur);
      const Dist = Math.abs(targetX - E.x) / k;
      const p = CharGait.resolve(Object.assign({}, CharGait.presets[spec.gait], spec.params || {}, { speed: clamp(speed || 1, 0.3, 2.5) }));
      // a faster run takes longer strides with a longer flight, and leans in more (not just faster legs)
      const vSpeed = p.speed;
      if (ch.body) p.cadence *= Math.pow(1 / Math.max(0.3, L), 0.35);   // longer legs step slower (built bodies)
      if (AGE === 1) { p.stride *= 0.72; p.cadence *= 1.25; p.bounce *= 1.4; p.duty = Math.min(0.75, p.duty + 0.06); p.lean -= 0.06; }
      if (AGE === 4) { p.stride *= 0.78; p.cadence *= 0.85; p.bounce *= 0.6; p.armSwing *= 0.6; p.duty = Math.max(p.duty, 0.52); p.kneeLift *= 0.6; p.heelKick *= 0.5; }
      p.bounce *= (1 - 0.5 * (MO.weight - 0.3)) * (0.8 + 0.4 * MO.energy); p.armSwing *= 0.8 + 0.4 * MO.energy;
      p.cadence *= 0.92 + 0.16 * MO.energy;
      { const mv = moodVec(t); p.cadence *= 1 + mv.cadence; p.stride *= 1 + mv.stride; p.armSwing *= Math.max(0, 1 + mv.swing); p.bounce *= Math.max(0, 1 + mv.bounce); }
      if (spec.gait === 'run') {
        p.stride *= Math.pow(vSpeed, 0.5); p.cadence *= Math.pow(vSpeed, 0.35);
        p.duty = clamp(p.duty - 0.06 * (vSpeed - 1), AGE === 4 ? 0.52 : 0.2, 0.6); p.lean += 0.07 * (vSpeed - 1);
        p.kneeLift *= 0.85 + 0.15 * vSpeed; p.heelKick *= 0.85 + 0.15 * vSpeed; p.speed = 1;
      }
      const cycP = spec.cycle && !gridAt(t) ? prepClip(spec.cycle) : null;
      const sq = Math.sqrt(p.speed), rate = p.cadence * sq, d = p.duty;
      const s0 = (p.heelFrac + p.flatFrac) / 2 * d;
      const stance = E.S.feet.near.x >= E.S.feet.far.x ? 'near' : 'far';
      const other = stance === 'near' ? 'far' : 'near';
      const phS = stance === 'near' ? s0 : s0 + 0.5;
      const STD = { near: STAND.near[0] * L, far: STAND.far[0] * L };
      // choose step count and stride so the pelvis ends at the target (two passes: start and stop
      // offsets depend on the stride)
      let n = 1, S = 1, params = null, offset = 0, want = Dist;
      // the skid slides further the faster she arrives (clip x is authored for about 3.8 leg lengths/s)
      const skidXs = skidP ? clamp(p.stride * L * Math.sqrt(p.speed) * p.cadence * Math.sqrt(p.speed) / L / ((spl(skidP, 'x', 0.1) - spl(skidP, 'x', 0)) / 0.1), 1, 2.2) : 1;
      const skidL = skidP ? spl(skidP, 'x', skidP.dur) * L * skidXs : 0;
      if (skidP) {
        want = Math.max(0.3 * L, Dist - skidL);
        n = steps > 0 ? Math.round(steps) : Math.max(1, Math.round(want / (p.stride * L * sq / 2)));
        S = 2 * want / n;
        params = Object.assign({}, p, { stride: S / (L * sq) });
        offset = E.S.feet[stance].x - CharGait.pose(params, phS, ch).legs[stance].foot[0];
      }
      for (let pass = 0; pass < (skidP ? 0 : 3); pass++) {
        n = steps > 0 ? Math.round(steps) : Math.max(1, Math.round(want / (p.stride * L * sq / 2)));
        S = 2 * want / n;
        params = Object.assign({}, p, { stride: S / (L * sq) });
        const g0 = CharGait.pose(params, phS, ch);
        offset = E.S.feet[stance].x - g0.legs[stance].foot[0];
        const gE = CharGait.pose(params, phS + n / 2, ch);
        const stE = n % 2 === 0 ? stance : other;
        const footE = offset + Math.floor(phS + n / 2) * S + gE.legs[stE].foot[0];
        const finalRoot = footE - STD[stE];
        want = Math.max(0.05, want + (Dist - finalRoot));
      }
      const phE = phS + n / 2;
      const gaitS = ph => {
        const g = CharGait.pose(params, ph, ch), X = offset + Math.floor(ph) * S;
        const St = cloneS(E.S);
        St.rx = X + g.root[0]; St.ry = g.root[1];
        St.lean = g.spineLean; St.tilt = g.pelvisTilt; St.twist = g.chestTwist; St.neck = g.neck; St.head = g.headTilt;
        for (const s of SIDES) {
          St.feet[s] = { x: X + g.legs[s].foot[0], y: g.legs[s].foot[1], a: g.legs[s].footAngle };
          St.arms[s] = [g.arms[s].shoulder, g.arms[s].elbow, g.arms[s].wrist];
        }
        const hand = spec.gait === 'run' ? 'fist' : 'relaxed';
        St.hands = { near: hand, far: hand }; St.squash = [1, 1]; St.stretch = 1; St.mouth = null;
        St.bend = (spec.gait === 'run' ? 0.5 : 0.2) * g.spineLean; St.chest = 1;
        if (cycP) {
          // the cycle clip (clips.js runCycle) shapes the body over one stride: down on each landing,
          // up into the flight, head and chest taking the weight, arms pumping in opposition
          const tc = ph - Math.floor(ph), has = f => !!cycP.ch[f], amp = 0.8 + 0.25 * vSpeed;
          if (has('h')) St.ry += spl(cycP, 'h', tc) * L * (0.7 + 0.3 * vSpeed);
          for (const f of ['lean', 'head', 'neck', 'twist']) if (has(f)) St[f] += spl(cycP, f, tc) * D2R;
          if (has('bend')) St.bend = spl(cycP, 'bend', tc) * D2R;
          if (has('chest')) St.chest = spl(cycP, 'chest', tc);
          const arm = f => spl(cycP, f, tc).map((d, j) => (j === 0 ? 10 + (d - 10) * amp : d) * D2R);
          if (has('armN')) St.arms.near = arm('armN');
          if (has('armF')) St.arms.far = arm('armF');
        }
        return St;
      };
      // a start clip already did part of the speeding up: the gait's own ramp is shorter by its length
      const accel = Math.max(0.12, (spec.accel || 0.35) * (1 + 1.2 * Math.max(0, MO.weight - 0.3)) - (startP ? startP.dur * TS : 0));
      let T = n / (2 * rate) + (skidP ? accel / 2 : accel);
      const al = Math.min(0.5, accel / T);
      const P = u => u < al ? u * u / (2 * al * (1 - al)) : (u > 1 - al ? 1 - (1 - u) * (1 - u) / (2 * al * (1 - al)) : (u - al / 2) / (1 - al));
      // carry (end=skid): speed up at the start only, and keep going at full speed after T
      const Pc = u => u < al ? u * u / (2 * al * (1 - al / 2)) : (u - al / 2) / (1 - al / 2);
      const rEnd = (n / 2) / (T * (1 - al / 2));
      let phase = skidP ? (tau => tau <= T ? phS + (n / 2) * Pc(Math.max(0, tau) / T) : phE + (tau - T) * rEnd) : (tau => phS + (n / 2) * P(clamp(tau / T, 0, 1)));
      let settle = (spec.settle || 0.4) * TS;
      if (g) {
        // strikes at tau = g, 2g, .. n g (phase phS - s0 + j/2); the first step starts slower
        T = n * g + 2 * s0 * g;
        phase = tau => tau < g ? phS + (0.5 - s0) * Math.max(0, tau) / g : Math.min(phS + n / 2, phS - s0 + 0.5 * tau / g);
        settle = Math.ceil((2 * s0 * g + 0.2) / g - 1e-6) * g - 2 * s0 * g;   // stand still on a grid step
      }
      // settle target: plant the swing foot beside the last stance foot in the stand pose
      const stE = n % 2 === 0 ? stance : other, otE = stE === 'near' ? 'far' : 'near';
      const gEnd = gaitS(phE);
      const rootF = gEnd.feet[stE].x - STD[stE];
      const key = Object.assign({}, STAND, { x: rootF / L });
      key[stE] = [gEnd.feet[stE].x / L, 0, 0]; key[otE] = [(rootF + STD[otE]) / L, 0, 0];
      const standS = resolveKey(key, gEnd, {});
      {
        const g = gEnd.feet[stE], pv = g.a < 0 ? pr.toe : pr.heel;
        const px = g.x + pv[0] * Math.cos(g.a) - pv[1] * Math.sin(g.a);
        standS.feet[stE] = { x: px - pv[0], a: 0, y: footY(0, 0) };
      }
      const bi = spec.blendIn || 0, tg0 = t, tEnd = t + T + settle;
      const Sentry = E.S;
      list.push({ t0: tg0, end: tEnd, gait: true, at(tt) {
        const tau = tt - tg0;
        let St;
        if (tau <= T || skidP) {
          St = gaitS(phase(tau));
          if (bi > 0 && tau < bi) {
            const w = smooth(tau / bi);
            const G = St; St = cloneS(G);
            St.rx = lerp(Sentry.rx, G.rx, w); St.ry = lerp(Sentry.ry, G.ry, w);
            for (const f of ['lean', 'tilt', 'twist', 'neck', 'head', 'bend']) St[f] = lerp(Sentry[f] || 0, G[f], w);
            St.chest = lerp(Sentry.chest || 1, 1, w);
            for (const s of SIDES) for (let j = 0; j < 3; j++) St.arms[s][j] = lerp(Sentry.arms[s][j], G.arms[s][j], w);
            // stance foot is already where the gait wants it; the swing foot lifts first, then travels
            const fs = Sentry.feet[stance], gs = G.feet[stance];
            St.feet[stance] = { x: gs.x, y: lerp(fs.y, gs.y, w), a: lerp(fs.a, gs.a, w) };
            const fo = Sentry.feet[other], go = G.feet[other], wy = smooth(w * 1.8), wx = smooth((w - 0.3) / 0.7);
            St.feet[other] = { x: lerp(fo.x, go.x, wx), y: lerp(fo.y, go.y, wy), a: lerp(fo.a, go.a, wy) };
            if (w < 0.5) St.hands = Object.assign({}, Sentry.hands);
            const b = Math.sin(Math.PI * w);
            if (!startP) { St.lean += (spec.startLean || 0) * D2R * b; St.ry -= (spec.startDip || 0) * L * b; }
          }
        } else {
          const u = clamp((tau - T) / settle, 0, 1);
          St = trans(gEnd, standS, u, 'back');
          St.lean += (spec.stopLean || 0) * D2R * Math.sin(Math.PI * u) * (1 - 0.5 * u);
        }
        return mkState(St, E.x, E.facing, { life: tau > T + settle ? smooth((tau - T - settle) / 0.6) : 0, gait: tau <= T, gaitKind: spec.gait });
      } });
      if (skidP) {
        const gs = list[list.length - 1];
        gs.end = tg0 + T;
        list.push(clipSeg(tg0 + T, gs.at(tg0 + T), gs, skidP, { xs: skidXs, ts: TS }));
      }
      return list;
    }
    function jumpClipSegs(spec, t, cur, targetX, hm, prev) {
      const list = [];
      ({ t, cur } = maybeGetUp(list, t, cur));
      if (list.length) prev = list[list.length - 1];
      const dirn = Math.sign(targetX - cur.x) || cur.facing;
      if (dirn !== cur.facing && Math.abs(targetX - cur.x) > 0.05 * L * k) { const s = turnSeg(t, cur, prev); list.push(s); t = s.end; cur = s.at(t); prev = s; }
      // jump height: legs give it (clip heights are in leg lengths); weight, age and energy shape it
      const hmA = hm * (1 - 0.6 * (MO.weight - 0.3)) * (AGE === 4 ? 0.55 : AGE === 1 ? 0.75 : 1) * (0.85 + 0.3 * MO.energy);
      list.push(clipSeg(t, cur, prev, prepClip(spec.clip), { dist: Math.abs(targetX - cur.x) / k / L, hm: hmA, ts: TS }));
      return list;
    }
    function jumpSegs(spec, t, cur, targetX, hm, pose) {
      const list = [];
      ({ t, cur } = maybeGetUp(list, t, cur));
      const dirn = Math.sign(targetX - cur.x) || cur.facing;
      if (dirn !== cur.facing && Math.abs(targetX - cur.x) > 0.05 * L * k) { const s = turnSeg(t, cur); list.push(s); t = s.end; cur = s.at(t); }
      const E = rebase(cur);
      hm = clamp(hm || 1, 0.3, 3);
      const Dl = Math.abs(targetX - E.x) / k / L;           // distance in leg lengths
      const Kc = resolveKey(spec.crouch, E.S, {});
      const Kp = resolveKey(spec.push, Kc, {});
      for (const s of SIDES) { const a = (spec.push.toe || -35) * D2R; Kp.feet[s] = { x: Kc.feet[s].x, y: footY(0, a), a }; }
      const ck = Object.assign({}, spec.contact, { x: Dl, near: [Dl + spec.contact.near[0], 0, spec.contact.near[2]], far: [Dl + spec.contact.far[0], 0, spec.contact.far[2]] });
      const Kl = resolveKey(ck, Kp, {}); Kl.stretch = 1;
      const Kq = resolveKey(Object.assign({}, spec.land, { x: Dl + 0.05 }), Kl, {});
      const rk = Object.assign({}, STAND, spec.recover, { x: Dl + 0.03, near: [Dl + 0.03 + STAND.near[0], 0, 0], far: [Dl + 0.03 + STAND.far[0], 0, 0] });
      const Kr = resolveKey(rk, Kq, {});
      let tc = spec.crouch.dur, tp = spec.push.dur, tf = (spec.flight + spec.flightPerL * Dl) * Math.sqrt(hm);
      const tl = spec.land.dur;
      let tr = spec.recover.dur;
      const g = gridAt(t);
      if (g) {
        // on a beat grid: take off one grid step after the start, the top of the jump and the
        // landing fall on grid steps, and it stands still on a grid step
        if (list.length) t = onGrid(t, g);
        const kq = g / (tc + tp); tc *= kq; tp *= kq;
        tf = Math.max(2, 2 * Math.round(tf / g / 2)) * g;
        tr = Math.ceil((tl + tr) / g - 1e-6) * g - tl;
      }
      const T1 = t + tc, T2 = T1 + tp, T3 = T2 + tf, T4 = T3 + tl, T5 = T4 + tr;
      const Hj = spec.heightL * L * hm;
      const tuck = (pose === 'leap' && spec.leap) || spec.tuck;
      const yA = groundAt(E.x), yB = groundAt(E.x + E.facing * Dl * L * k);
      const relF = (K, s) => [K.feet[s].x - K.rx, K.feet[s].y];
      list.push({ t0: t, end: T5, at(tt) {
        let S, y = null;
        if (tt < T1) S = trans(E.S, Kc, (tt - t) / tc, spec.crouch.ease);
        else if (tt < T2) S = trans(Kc, Kp, (tt - T1) / tp, spec.push.ease);
        else if (tt < T3) {
          const u = (tt - T2) / tf, a = u < 0.5 ? smooth(u / 0.5) : smooth((u - 0.5) / 0.5);
          S = cloneS(u < 0.5 ? Kp : Kl);
          S.rx = lerp(Kp.rx, Kl.rx, u);
          S.ry = lerp(Kp.ry, Kl.ry, u) + Hj * 4 * u * (1 - u);
          const mid = { lean: tuck.lean * D2R };
          for (const f of ['lean', 'tilt', 'twist', 'neck', 'head']) {
            const m = mid[f] !== undefined ? mid[f] : (Kp[f] + Kl[f]) / 2;
            S[f] = u < 0.5 ? lerp(Kp[f], m, a) : lerp(m, Kl[f], a);
          }
          const armMid = { near: tuck.armN.map(d => d * D2R), far: tuck.armF.map(d => d * D2R) };
          SIDES.forEach((s, i) => {
            for (let j = 0; j < 3; j++) S.arms[s][j] = u < 0.5 ? lerp(Kp.arms[s][j], armMid[s][j], a) : lerp(armMid[s][j], Kl.arms[s][j], a);
            const rp = relF(Kp, s), rl = relF(Kl, s), rm = [tuck.feet[i][0] * L, tuck.feet[i][1] * L];
            // tucked foot height is relative to the pelvis
            const fy0 = rp[1] - Kp.ry, fy1 = rl[1] - Kl.ry;
            const rel = u < 0.5 ? [lerp(rp[0], rm[0], a), lerp(fy0, rm[1], a)] : [lerp(rm[0], rl[0], a), lerp(rm[1], fy1, a)];
            S.feet[s] = { x: S.rx + rel[0], y: S.ry + rel[1], a: u < 0.5 ? lerp(Kp.feet[s].a, -0.2, a) : lerp(-0.2, Kl.feet[s].a, a) };
          });
          S.squash = [lerp(Kp.squash[0], 1, smooth(u * 2)), lerp(Kp.squash[1], 1, smooth(u * 2))];
          S.stretch = lerp(Kp.stretch, 1, smooth(u * 3));
          S.hands = u < 0.4 ? Object.assign({}, Kp.hands) : { near: 'open', far: 'open' };
          S.mouth = u < 0.6 ? 'open' : null;
          y = lerp(yA, yB, u);
        } else if (tt < T4) S = trans(Kl, Kq, (tt - T3) / tl, spec.land.ease);
        else S = trans(Kq, Kr, (tt - T4) / tr, spec.recover.ease);
        const st = mkState(S, E.x, E.facing, { life: tt > T5 ? smooth((tt - T5) / 0.6) : 0 });
        if (tt < T2) st.y = yA; else if (y !== null) st.y = y; else st.y = yB;
        st.airborne = tt >= T2 && tt < T3;
        return st;
      } });
      return list;
    }

    let prevEnd = -Infinity, prevName = null;
    for (const ev of bodyEvs) {
      if (ev.t < prevEnd - 1e-4) D('overlap', ev.t, ev.line, `${ev.name} starts at ${ev.t.toFixed(2)}s but ${prevName} is still moving until ${prevEnd.toFixed(2)}s; it cuts that short. Start it at "+0" after the previous line to wait.`, 'warning');
      const cur = bodyAt(ev.t), prevSeg = segAt(ev.t);
      const spec = ev.spec;
      let list = [];
      if (ev.name === 'walk' || ev.name === 'run' || ev.name === 'sneak') {
        list = gaitSegs(spec, ev.t, cur, resolvePlace(ev.args.to, ev.t)[0], ev.args.speed, ev.args.steps, ev.args.end, prevSeg);
      } else if (ev.name === 'enter') {
        const fx = offX(ev.args.from);
        const st = Object.assign({}, cur, { x: fx, facing: ev.args.from === 'right' ? -1 : 1 });
        st.S = resolveKey(STAND, cur.S, {});
        list = gaitSegs(spec, ev.t, st, x0, ev.args.speed, ev.args.steps);
        if (!list.length) list = [{ t0: ev.t, end: ev.t, at: () => mkState(st.S, fx, st.facing) }];
      } else if (ev.name === 'jump') {
        const useClip = spec.clip && prepClip(spec.clip) && ev.args.pose !== 'leap' && !gridAt(ev.t);
        list = useClip ? jumpClipSegs(spec, ev.t, cur, resolvePlace(ev.args.to, ev.t)[0], ev.args.height, prevSeg)
          : jumpSegs(spec, ev.t, cur, resolvePlace(ev.args.to, ev.t)[0], ev.args.height, ev.args.pose);
      } else if (ev.name === 'turn') {
        list = [turnSeg(ev.t, cur, prevSeg)];
      } else if (spec.user) {
        let t = ev.t, c = cur, pv = prevSeg;
        // an action that starts in a named pose (or says from: 'any') takes over from sitting or lying as it is;
        // others stand up first
        const u = spec.user, startsPosed = u.from === 'any' || (Array.isArray(u.keys) && u.keys.length && u.keys.slice().sort((p, q) => p.t - q.t)[0].pose);
        // sitting, kneeling or lying: an action that does not start in a pose of its own plays only its
        // upper body (spine, head, arms, hands, face) on top of that pose, and the actor stays down
        const low = c.S.ry < A + 0.72 * L, upper = low && !startsPosed;
        if (!startsPosed && !upper) ({ t, cur: c } = maybeGetUp(list, t, c));
        if (list.length) pv = list[list.length - 1];
        const AP = prepClip(actionClip(spec.user, ev.args));
        let times = ev.args.times;
        if (AP.c.loop && !AP.cyc && +ev.args.for > 0) times = Math.max(1, Math.round((+ev.args.for - (AP.dur - (AP.c.loop[1] - AP.c.loop[0]))) / (AP.c.loop[1] - AP.c.loop[0])));
        // the two roles of a paired action share one clock (docs/PAIRS.md): no weight or mood tempo
        const paired = /^\w+\.(a|b)$/.test(u.name || '');
        list.push(clipSeg(t, c, pv, AP, { times, ts: paired ? 1 / Math.max(0.2, Math.min(5, +ev.args.speed || 1)) : TS * (1 + moodVec(ev.t).tempo), upper }));
      } else if (spec.clip && prepClip(spec.clip)) {
        let t = ev.t, c = cur, pv = prevSeg;
        ({ t, cur: c } = maybeGetUp(list, t, c));
        if (list.length) pv = list[list.length - 1];
        list.push(clipSeg(t, c, pv, prepClip(spec.clip), { times: ev.args.times, ts: TS * (1 + moodVec(ev.t).tempo) }));
      } else {
        list = [keyedSeg(ev.t, cur, spec.keys || [STAND], ev.args, { loop: spec.loop })];
      }
      if (!list.length) list = [keyedSeg(ev.t, cur, [Object.assign({}, STAND, { x: null, near: null, far: null, dur: 0.3 })], {})];
      // the first sub-segment starts at the event time
      list[0].t0 = ev.t;
      for (const s of list) segs.push(s);
      prevEnd = list[list.length - 1].end; prevName = ev.name;
      endOf[ev.i] = prevEnd;
      if (spec.mood) moodHints.push({ t: ev.t, mood: spec.mood, until: Infinity });
    }
    segs.sort((a, b) => a.t0 - b.t0);

    // ---------------------------------------------------------------- arms track
    // persistent hold layer + transient gestures (each new gesture blends over the previous one)
    const holds = [], gestures = [];
    for (const ev of evs.filter(e => e.channel === 'arms')) {
      const spec = ev.spec;
      if (ev.name === 'hold') {
        const keys = spec.variants[ev.args.how] || spec.variants.front;
        const dur = keys.reduce((s, q) => s + q.dur, 0);
        holds.push({ t0: ev.t, ev, keys, dur, end: Infinity, how: ev.args.how, prop: ev.args.prop });
        endOf[ev.i] = ev.t + dur;
        continue;
      }
      if (ev.name === 'drop') {
        const h = holds[holds.length - 1];
        if (!h || h.end !== Infinity) D('nothing-held', ev.t, ev.line, `drop at ${ev.t.toFixed(2)}s but nothing is held; use hold(prop) first.`, 'warning');
        else h.end = ev.t;
        if (+ev.args.quiet) { endOf[ev.i] = ev.t; continue; }
      }
      const cname = typeof spec.clip === 'function' ? spec.clip(ev.args) : spec.clip;
      const clipP = spec.user ? prepClip(actionClip(spec.user, ev.args)) : (cname ? prepClip(cname) : null);
      const keys = clipP ? [] : (spec.keys || []);
      if (clipP && clipP.c.loop && !clipP.cyc && +ev.args.for > 0) ev.args.times = Math.max(1, Math.round((+ev.args.for - (clipP.dur - (clipP.c.loop[1] - clipP.c.loop[0]))) / (clipP.c.loop[1] - clipP.c.loop[0])));   // for= seconds instead of times=
      const loopX = clipP && clipP.c.loop && !clipP.cyc ? (Math.max(1, Math.round(+ev.args.times || 1)) - 1) * (clipP.c.loop[1] - clipP.c.loop[0]) : 0;
      const kdur = clipP ? (clipP.dur + loopX) * TS : keys.reduce((s, q) => s + q.dur, 0);
      const hold = spec.hold === 'for' ? clamp(+ev.args.for || 1.5, 0, 60) : (spec.hold || 0);
      const rel = spec.release || 0.35;
      gestures.push({ t0: ev.t, ev, keys, clip: clipP, kdur, hold, rel, end: ev.t + kdur + hold + rel, cut: Infinity });
      endOf[ev.i] = ev.t + kdur + hold + rel;
      if (spec.mood) moodHints.push({ t: ev.t, mood: spec.mood, until: ev.t + kdur + hold + rel });
    }
    for (let i = 1; i < holds.length; i++) if (holds[i - 1].end > holds[i].t0) holds[i - 1].end = holds[i].t0;
    for (let i = 0; i + 1 < gestures.length; i++) gestures[i].cut = gestures[i + 1].t0 + (gestures[i + 1].keys[0] ? gestures[i + 1].keys[0].dur : 0.2);

    // value of a key sequence at time tau: { arms: {N:[..], F:[..]}, add, hands, stretch, wig }
    function keyVals(keys, tau, args, aimFn) {
      const out = { N: null, F: null, hands: null, add: { lean: 0, head: 0, twist: 0, h: 0, neck: 0 }, stretch: 1, wig: [], bob: null };
      let prev = null, tt = 0;
      const resolveK = (q0) => {
        // fields may be functions (args, body) => value, as in body keys
        const q = {};
        for (const f of Object.keys(q0)) q[f] = typeof q0[f] === 'function' ? q0[f](args || {}, B) : q0[f];
        const r = { N: q.aim ? aimFn(q.aim) : (q.armN ? q.armN.map(d => d * D2R) : null), F: q.armF ? q.armF.map(d => d * D2R) : null,
          hands: q.hands || null, add: { lean: (q.lean || 0) * D2R, head: (q.head || 0) * D2R, twist: (q.twist || 0) * D2R, h: (q.h || 0) * L, neck: (q.neck || 0) * D2R },
          stretch: q.stretch || 1 };
        if (q.aim && q.aim.lean) r.add.lean += (aimFn.lean || 0) * q.aim.lean;
        return r;
      };
      const carry = (a, b) => ({ N: b.N || a.N, F: b.F || a.F, hands: b.hands || a.hands, add: b.add, stretch: b.stretch });
      let cur = null;
      for (let i = 0; i < keys.length; i++) {
        const q = keys[i];
        const R = cur ? carry(cur, resolveK(q)) : resolveK(q);
        if (tau < tt + q.dur || i === keys.length - 1) {
          const u = i === 0 ? 1 : clamp((tau - tt) / q.dur, 0, 1), e = ease(q.ease, u);
          const P = cur || R;
          const mix = (a, b) => a && b ? a.map((v, j) => lerp(v, b[j], e)) : (b || a);
          out.N = mix(P.N, R.N); out.F = mix(P.F, R.F);
          for (const f of Object.keys(out.add)) out.add[f] = lerp(P.add ? P.add[f] : 0, R.add[f], e);
          out.hands = u < 0.4 && P.hands ? P.hands : R.hands;
          out.stretch = lerp(P.stretch || 1, R.stretch || 1, e);
          if (q.wiggle) out.wig = q.wiggle;
          if (q.bob) out.bob = q.bob;
          out.keyIndex = i;
          break;
        }
        cur = R; tt += q.dur;
      }
      return out;
    }

    // ---------------------------------------------------------------- look, face
    const looks = evs.filter(e => e.channel === 'look' && e.name === 'look');
    const nods = evs.filter(e => e.name === 'nod');
    for (const e of looks) endOf[e.i] = e.t + 0.3;
    for (const e of nods) endOf[e.i] = e.t + 0.75;
    const faces = evs.filter(e => e.channel === 'face');
    // ---- speech: say(text, for, track, words, visemes, beats) -> mouth cues per line (src/speech.js) ----
    const says = [];
    for (const e of evs.filter(q => q.channel === 'say')) {
      const a = e.args, nv = a.visemes ? String(a.visemes).split(/[\s,]+/).filter(Boolean).length : 0;
      const dur = +a.for > 0 ? +a.for : nv ? nv * 0.4 : (CharSpeech ? CharSpeech.estimate(a.text) : 1);
      const cs = CharSpeech ? CharSpeech.cues(a, dur, env.tracks || (typeof globalThis !== 'undefined' && globalThis.CharTracks) || {}) : [];
      says.push({ t: e.t, dur, cues: cs, beats: +a.beats > 0 });
      endOf[e.i] = e.t + dur;
    }
    for (let i = 0; i + 1 < says.length; i++) says[i].dur = Math.min(says[i].dur, says[i + 1].t - says[i].t);
    function speechAt(t) {
      let s = null;
      for (const q of says) if (q.t <= t && t < q.t + q.dur + 0.15) s = q;
      if (!s || !CharSpeech) return null;
      const r = CharSpeech.at(s.cues, t - s.t), fade = 1 - smooth((t - s.t - s.dur) / 0.15);
      r.open *= fade; r.beats = s.beats;
      return r;
    }
    // ---- face parameters (brows, lids, smile) blended between face/mood lines over 0.35 s ----
    const FP = CharPoses.faceParams || {};
    function faceAt(t) {
      const v = Object.assign({ browH: 0, browA: 0, lid: 1, smile: 0 }, FP[env.mood] || {});
      const evsF = faces.map(e => ({ t: e.t, m: e.args.mood, s: e.args.strength === undefined ? 1 : +e.args.strength }))
        .concat(moodEvs.map(e => ({ t: e.t, m: e.args.name, s: e.args.strength === undefined ? 1 : +e.args.strength })))
        .concat(moodHints.filter(h => h.until === Infinity || h.until > h.t).map(h => ({ t: h.t, m: h.mood, s: 1, until: h.until }))).sort((a, b) => a.t - b.t);
      for (const e of evsF) {
        if (e.t > t) break;
        const p = FP[e.m] || {}, u = smooth((t - e.t) / 0.35) * (e.until !== undefined && t >= e.until ? 0 : 1);
        for (const f of Object.keys(v)) { const base = f === 'lid' ? 1 : 0, tg = base + ((p[f] === undefined ? base : p[f]) - base) * clamp(e.s, 0, 2); v[f] += (tg - v[f]) * u; }
      }
      return v;
    }
    for (const e of faces) endOf[e.i] = e.t + 0.2;
    for (const e of looks) blinkAt.push(e.t + 0.02);
    for (const e of faces) blinkAt.push(e.t);
    for (const e of moodEvs) { endOf[e.i] = e.t + 0.6; blinkAt.push(e.t); }

    // ---------------------------------------------------------------- composition
    function poseOf(st, extraAdd) {
      const S = st.S;
      const pose = {
        root: [0, S.ry], spineLean: S.lean, pelvisTilt: S.tilt, chestTwist: S.twist, neck: S.neck, headTilt: S.head,
        legs: {}, arms: {}, stretch: S.stretch, torsoBend: S.bend || 0, torsoStretch: S.chest || 1,
      };
      const maxD = L * 0.995 * clamp(S.stretch || 1, 1, 1.12);
      for (const s of SIDES) {
        const f = S.feet[s];
        // uneven ground: each foot stands on the ground under itself, not under the pelvis
        const gy = isFinite(st.x) && isFinite(st.y) ? (st.y - groundAt(st.x + st.facing * k * (f.x - S.rx))) / k : 0;
        const dy = isFinite(gy) && Math.abs(gy) < 0.2 ? gy * smooth((S.ry - A - 0.35 * L) / (0.2 * L)) : 0;   // fades out for sitting   // gentle swells only; at a cliff edge the foot keeps the pelvis's ground
        let fy = f.y + dy;
        const m = fy + minRotY(f.a) - dy;
        if (m < 0) fy -= m;                       // feet never go below the ground
        pose.legs[s] = { foot: [f.x - S.rx, fy], footAngle: f.a };
        const dx = f.x - S.rx;
        if (!st.airborne && Math.abs(dx) < maxD) pose.root[1] = Math.min(pose.root[1], fy + Math.sqrt(maxD * maxD - dx * dx));
        pose.arms[s] = { shoulder: S.arms[s][0], elbow: S.arms[s][1], wrist: S.arms[s][2], stretch: S.armStretch && S.armStretch[s] };
      }
      pose.root[1] = Math.max(pose.root[1], 0.55 * pr.radius.hip);   // the seat never sinks into the ground
      return pose;
    }
    // stage position of a rig point for a state
    const toStage = (st, p) => [st.x + st.facing * k * p[0], st.y - k * p[1]];

    function moodAt(t) {
      let m = env.mood && MOODS[env.mood] ? env.mood : 'neutral', mt = -Infinity;
      for (const e of moodEvs) if (e.t <= t && e.t >= mt && MOODS[e.args.name]) { m = +e.args.strength === 0 ? 'neutral' : e.args.name; mt = e.t; }
      for (const e of faces) if (e.t <= t && e.t >= mt) { m = e.args.mood; mt = e.t; }
      for (const h of moodHints) if (h.t <= t && t < h.until && h.t >= mt) { m = h.mood; mt = h.t; }
      return m;
    }

    // core(t): body + arms + look, no follow-through chains or life (those are polish)
    function core(t) {
      const st0 = bodyAt(t);
      const S = cloneS(st0.S);
      const st = Object.assign({}, st0, { S });
      const life = st.life || 0;
      // moving hold / idle loop
      if (st.loop && life > 0) {
        const lt = t - (st.loopT0 || 0);
        for (const f of Object.keys(st.loop)) {
          const [amp, per, ph] = st.loop[f], w = Math.sin(TAU * (lt / per + (ph || 0))) * life;
          if (f === 'x') S.rx += amp * L * w;
          else if (f === 'armN') S.arms.near[0] += amp * D2R * w;
          else if (f === 'armF') S.arms.far[0] += amp * D2R * w;
          else S[f] += amp * D2R * w;
        }
      }
      if (life > 0) {
        S.lean += 0.012 * life * Math.sin(t * 0.71 + 1.3);
        S.head += 0.03 * life * Math.sin(t * 0.53 + 0.4);
        S.arms.near[0] += 0.035 * life * Math.sin(t * 0.61 + 2.1);
        S.arms.far[0] += 0.03 * life * Math.sin(t * 0.67);
      }
      // breathing
      const br = Math.sin(TAU * t / 3.3);
      S.lean -= 0.012 * br; S.ry += 0.004 * L * br;
      S.arms.near[0] += 0.015 * br; S.arms.far[0] += 0.015 * br;
      S.head += 0.01 * br;
      // posture: + stoops (rounded back, neck forward, head up to look ahead), - stands proud
      applyPosture(S);
      // a toddler walks and runs with the arms held out for balance, leaning back a little
      if (AGE === 1) {
        let aw = 0;   // eased in and out over 0.35 s at the start and end of each walk or run
        for (const g of segs) if (g.gait && t > g.t0 - 0.35 && t < g.end + 0.35) aw = Math.max(aw, Math.min(smooth((t - g.t0) / 0.35), smooth((g.end - t) / 0.35)));
        if (aw > 0) { for (const s of SIDES) { S.arms[s][0] = lerp(S.arms[s][0], S.arms[s][0] * 0.5 + 0.55, aw); S.arms[s][1] += 0.35 * aw; } S.lean -= 0.05 * aw; }
      }
      // mood: posture, head carriage, shoulders and arms, fists (docs/ACTIONS.md)
      if (moodEvs.length) {
        const mv = moodVec(t);
        S.lean += mv.lean; S.bend = (S.bend || 0) + mv.bend; S.neck += mv.neck; S.head += mv.head; S.twist += mv.twist;
        S.chest = (S.chest || 1) * (1 + mv.chest); S.ry += mv.drop * L;
        for (const s of SIDES) if (mv.fist > 0.5 && S.hands[s] === 'relaxed') S.hands[s] = 'fist';
      }
      const aimS = { near: false, far: false }, gestReach = [];
      // ---- arms layers ----
      const add = { lean: 0, head: 0, twist: 0, h: 0, neck: 0, bend: 0, turn: 0 };
      let heldInfo = null;
      const handsOut = Object.assign({}, S.hands);
      const armStretch = { near: 1, far: 1 };
      // hold layer
      let holdArm = null;
      for (const h of holds) {
        if (h.t0 > t || t >= h.end + 0.2) continue;
        const v = keyVals(h.keys, t - h.t0, h.ev.args, null);
        const fade = t >= h.end ? 1 - smooth((t - h.end) / 0.2) : 1;
        const w = smooth((t - h.t0) / (h.keys[0].dur || 0.3)) * fade;
        if (v.N) S.arms.near = S.arms.near.map((a, j) => lerp(a, v.N[j], w));
        if (v.F) S.arms.far = S.arms.far.map((a, j) => lerp(a, v.F[j], w));
        for (const f of Object.keys(add)) add[f] += (v.add[f] || 0) * w;
        if (v.hands && w > 0.5) { handsOut.near = v.hands[0]; if (v.F) handsOut.far = v.hands[1]; }
        const wt = clamp(+h.ev.args.weight || 0, 0, 1);   // a heavy load (docs/PROPS.md): lean back against it, knees give
        if (wt > 0 && t < h.end) { add.lean -= 0.3 * wt * w; add.h -= 0.05 * L * wt * w; }
        if (t >= h.t0 + (+h.ev.args.quick ? 0 : 0.6 * h.dur) && t < h.end + 0.1) heldInfo = { prop: h.prop, how: h.how, side: 'near' };
        if (t < h.end) holdArm = h.how === 'front' ? null : 'near';
      }
      // gestures
      const solveNow = () => CharRig.solve(ch, poseOf(Object.assign({}, st, { S })));
      for (const g of gestures) {
        if (g.t0 > t || t >= Math.min(g.end, g.cut)) continue;
        const args = g.ev.args, tau = t - g.t0;
        let main = args.hand === 'far' ? 'far' : 'near';
        if (holdArm && g.ev.name !== 'drop' && g.ev.name !== 'cheer' && args.hand !== 'both') main = holdArm === 'near' ? 'far' : 'near';
        const otherA = main === 'near' ? 'far' : 'near';
        // aim the main arm at args.at
        let aimFn = null;
        if (args.at !== undefined) {
          const sol = solveNow();
          const sh = sol.joints['shoulder.' + main];
          const tp = resolvePlace(args.at, t);
          let th = 0;
          if (tp) {
            const dx = (tp[0] - st.x) * st.facing / k - sh[0], dy = (st.y - tp[1]) / k - sh[1];
            th = Math.atan2(dy, dx);
          }
          const ta = -S.lean;
          aimFn = q => { const e = (q.elbow || 0) * D2R; return [wrapA(th - ta + Math.PI / 2 - e / 2 + (q.off || 0) * D2R), e, 0]; };
          aimFn.lean = clamp(-th * 0.9, -0.25, 0.7) + 0.12;
          if (Math.abs(wrapA(th)) > Math.PI / 2) aimFn.lean = 0;
        }
        if (g.clip) for (const r of reachKeys(g.clip.c, clipLoopT(g.clip, tau / TS, +g.ev.args.times || 1)) || []) gestReach.push({ side: r.side === 'near' ? main : otherA, spec: r.spec, w: r.w });
        if (g.clip && g.clip.c.aim) for (const sd of SIDES) if (g.clip.c.aim[sd].some(q => tau / TS >= q[0] && tau / TS <= q[1])) aimS[sd === 'near' ? main : otherA] = true;
        const v = g.clip ? clipArmVals(g.clip, tau / TS, +g.ev.args.times || 1) : keyVals(g.keys, tau, args, aimFn || (() => [0.3, 0.3, 0]));
        const kEnd = g.kdur + g.hold;
        let w = g.clip ? smooth(tau / Math.max(0.01, g.clip.c.blendIn === undefined ? 0.12 : g.clip.c.blendIn))
          : g.keys[0] ? ease(g.keys[0].ease === 'back' ? 'out' : g.keys[0].ease, tau / g.keys[0].dur) : 1;
        if (tau > kEnd) w *= 1 - smooth((tau - kEnd) / g.rel);
        const both = args.hand === 'both' && !g.clip;
        const apply = (side, vals) => { if (vals) S.arms[side] = S.arms[side].map((a, j) => lerp(a, vals[j], w)); };
        apply(main, v.N);
        apply(otherA, both ? v.N : v.F);
        // oscillations ride on top (scaled by the envelope)
        for (const wg of v.wig || []) {
          const side = wg.arm === 'N' || both ? main : otherA;
          const o = wg.amp * D2R * Math.sin(TAU * (wg.hz * tau + (wg.ph || 0))) * w;
          S.arms[side][wg.j] += o;
          if (both && wg.arm === 'N') S.arms[otherA][wg.j] += o;
        }
        if (v.bob) add.h += v.bob[0] * L * Math.abs(Math.sin(Math.PI * v.bob[1] * tau)) * w;
        for (const f of Object.keys(add)) add[f] += (v.add[f] || 0) * w;
        if (v.hands && w > 0.5) { handsOut[main] = v.hands[0]; if (v.hands[1] && (v.F || both)) handsOut[otherA] = both ? v.hands[0] : v.hands[1]; }
        if (v.stretch > 1) armStretch[main] = lerp(1, v.stretch, w);
      }
      S.lean += add.lean; S.head += add.head; S.twist += add.twist; S.ry += add.h; S.neck += add.neck; S.bend = (S.bend || 0) + add.bend; S.faceTurn = (S.faceTurn || 0) + add.turn;
      S.aim = { near: aimS.near || !!(st.aim && st.aim.near), far: aimS.far || !!(st.aim && st.aim.far) };
      // hands that a key sends to a landmark land on it on THIS body in THIS pose (posture, mood, lean)
      const rk = (st.reach || []).concat(gestReach), contacts = [];
      for (const sd of SIDES) {
        let best = null;
        for (const r of rk) if (r.side === sd && (!best || r.w > best.w)) best = r;
        if (!best || best.w <= 0) continue;
        if (best.spec.who) contacts.push({ side: sd, at: best.spec.at.slice(8), dx: +best.spec.dx || 0, dy: +best.spec.dy || 0, who: best.spec.who, w: best.w });
        const tg = targetOf(S, sd, best.spec), a = tg && armTo(S, sd, tg);
        if (a) { S.arms[sd][0] = lerp(S.arms[sd][0], a[0], best.w); S.arms[sd][1] = lerp(S.arms[sd][1], a[1], best.w); }
      }
      // arm offsets that would pull a hand off its landmark apply only to free arms: the belly clearance
      // and the mood's shoulders and elbows
      { const mv = moodEvs.length ? moodVec(t) : null;
        for (const s of SIDES) if (!S.aim[s]) { S.arms[s][0] += ARMBIAS + (mv ? mv.shoulder : 0); S.arms[s][1] += mv ? mv.elbow : 0; } }
      S.hands = handsOut;
      S.armStretch = armStretch;
      // speech: a small nod on stressed syllables, beat gestures of the free near hand (beats=1)
      const spk = speechAt(t);
      if (spk) {
        const mvS = moodEvs.length ? moodVec(t) : { tempo: 0 };
        S.head += 0.1 * spk.stress * (1 - 0.5 * clamp(mvS.tempo, 0, 1)) + 0.05 * spk.emph; S.neck += 0.04 * spk.stress; S.lean += 0.02 * spk.stress;
        if (spk.beats && !aimS.near && !gestures.some(g => g.t0 <= t && t < Math.min(g.end, g.cut))) { S.arms.near[0] += 0.22 * spk.stress + 0.1; S.arms.near[1] += 0.35 * spk.stress + 0.4; S.hands.near = 'open'; }
      }
      // ---- look ----
      const lk = lookAt(t, st, S);
      S.neck += -0.22 * lk.th; S.head += -0.4 * lk.th; S.lean += -0.04 * Math.max(0, lk.th);
      for (const e of nods) {
        const tau = t - e.t;
        if (tau >= 0 && tau < 0.75) S.head += 0.2 * Math.sin(TAU * 2.67 * tau) * Math.sin(Math.PI * tau / 0.75) + 0.06 * Math.sin(Math.PI * tau / 0.75);
      }
      return { st, S, held: heldInfo, eye: lk.eye, lookTh: lk.th, contacts };
    }

    // look value at t: pitch th (+ up) and eye offset; blends over 0.3 s from the previous look
    function lookTarget(e, t, st, S) {
      const at = e.args.at;
      if (at === 'up') return { th: 0.75, back: 0 };
      if (at === 'down') return { th: -0.7, back: 0 };
      if (at === 'front' || at === undefined) return { th: 0, back: 0 };
      if (at === 'back') return { th: 0, back: 1 };
      if (at === 'left' || at === 'right') return { th: 0, back: (at === 'left' ? -1 : 1) === st.facing ? 0 : 1 };
      const tp = resolvePlace(at, t);
      if (!tp) return { th: 0, back: 0 };
      const hx = st.x, hy = st.y - k * (S.ry + pr.torso + pr.neck + 0.5);
      const dx = (tp[0] - hx) * st.facing, dy = hy - tp[1];
      return { th: clamp(Math.atan2(dy, Math.abs(dx) + 0.3 * k), -0.4, 0.55), back: dx < -0.4 * k ? 1 : 0 };   // a person is looked at in the eyes; the pitch stays modest
    }
    function lookAt(t, st, S) {
      let i = -1;
      for (let j = 0; j < looks.length; j++) if (looks[j].t <= t) i = j;
      const val = j => {
        if (j < 0) return { th: 0, back: 0 };
        const cur = lookTarget(looks[j], t, st, S);
        const u = (t - looks[j].t) / 0.3;
        if (u >= 1) return cur;
        const prev = val(j - 1);
        const e = smooth(u);
        return { th: lerp(prev.th, cur.th, e), back: lerp(prev.back, cur.back, e) };
      };
      const v = val(i);
      const ex = lerp(0.6, -1, v.back), ey = clamp(v.th / 0.7, -1, 1) * 0.9;
      return { th: v.th * (1 - 0.6 * v.back), eye: [ex, ey] };
    }

    function blinkAmount(t) {
      let b = 0;
      const shape = d => d < 0 ? 0 : d < 0.06 ? d / 0.06 : d < 0.17 ? 1 - (d - 0.06) / 0.11 : 0;
      const P = 2.9, j0 = Math.floor(t / P);
      for (let j = j0 - 1; j <= j0 + 1; j++) {
        const bt = j * P + 0.4 + hash(j) * 1.7;
        b = Math.max(b, shape(t - bt));
        if (hash(j + 91) > 0.78) b = Math.max(b, shape(t - bt - 0.24));
      }
      for (const bt of blinkAt) b = Math.max(b, shape(t - bt));
      return b;
    }
    function dartAt(t) {
      const P = 1.3, j = Math.floor((t + 0.37) / P);
      const v = q => [(hash(q * 3.1) - 0.5) * 0.5, (hash(q * 5.7 + 2) - 0.5) * 0.4];
      const a = v(j - 1), b = v(j), u = smooth(((t + 0.37) - j * P) / 0.07);
      return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
    }

    // ---------------------------------------------------------------- simulation: springs
    // Spring chains (hair tufts, scarf, backpack, hem) driven by the real motion of their bone, with
    // gravity, air drag and wind; a light spring overlap on the arms, the head and the torso (bend
    // and squash, keeping area). Fixed steps of 1/60 s (4 substeps each) from t = 0, with cached
    // snapshots every 0.5 s: sample(t) gives the same frame in any order.
    const chainSpecs = skin.chains || {};
    const chainNames = Object.keys(chainSpecs);
    const stiffOf = s => s.stiff === undefined ? 0.3 : s.stiff;
    const simNames = chainNames.filter(n => chainSpecs[n] && stiffOf(chainSpecs[n]) < 1 && Array.isArray(chainSpecs[n].seg) && chainSpecs[n].seg.length);
    const SPR = Object.assign({ arms: 1, head: 1, torso: 1 + 1.5 * Math.max(0, MO.weight - 0.3) }, skin.springs || {});
    const SDT = 1 / 60, SUB = 4, SNAP = 30, GRAV = 16, WINDK = 2;
    const useSim = simNames.length > 0 || SPR.arms > 0 || SPR.head > 0 || SPR.torso > 0;
    // wind: env.wind(t) -> amount (+ blows toward +x of the set; 1 = a strong gust) or [vx, vy] in head units/s
    const windOf = t => {
      let w = 0;
      try { w = typeof env.wind === 'function' ? env.wind(t) : (env.wind || 0); } catch (e) { w = 0; }
      if (Array.isArray(w)) return [+w[0] || 0, +w[1] || 0];
      w = +w || 0;
      return [w * 8, Math.abs(w) * 1.6];
    };
    // angle springs: armN shoulder, elbow, armF shoulder, elbow, head, torso bend, torso stretch
    const AHZ = [2.8, 3.2, 2.8, 3.2, 3.4, 3.2, 3.6, 1.8], AZ = [0.4, 0.38, 0.4, 0.38, 0.42, 0.36, 0.32, 0.28];
    const ALIM = [0.7, 0.7, 0.7, 0.7, 0.4, 0.35, 0.14, 0.6];
    function simInputs(n) {
      const t = n * SDT, c = core(t), st = c.st, S = c.S;
      const sol = CharRig.solve(ch, poseOf(Object.assign({}, st, { S })));
      const f = st.facing, W = p => [st.x / k + f * p[0], -st.y / k + p[1]];
      const wa = a => f > 0 ? a : Math.PI - a;
      const chains = {};
      for (const name of simNames) {
        const spec = chainSpecs[name], b = CharRig.chainBase(ch, sol, spec), curl = (spec.curl || 0) * D2R;
        chains[name] = { p: W(b.p), a: spec.seg.map((_, i) => wa(b.angle + curl * i)) };
      }
      return { t, f, cx: st.x / k, pel: W(sol.joints.root), chains, lean: S.lean, fling: st.fling || 1,
        tgt: [S.arms.near[0], S.arms.near[1], S.arms.far[0], S.arms.far[1], S.head, 0, 0, 0] };
    }
    // each segment is a damped pendulum hanging from the end of the one before: a spring pulls it to
    // its rest direction (in the bone's frame), gravity, wind and air drag push it, and the pivot's
    // acceleration swings it (inertia). Gravity counts relative to the rest shape, so a chain sits in
    // its drawn shape when the body stands still upright, and hangs, swings and sags as it moves.
    function chainsStep(st, I0, I1, s, h, t) {
      const wind = windOf(t);
      for (const name of simNames) {
        const spec = chainSpecs[name], C = st.ch[name], A0 = I0.chains[name], A1 = I1.chains[name];
        const stiff = stiffOf(spec), K0 = Math.pow(TAU * (spec.freq || (0.8 + 4 * stiff)), 2);
        const grav = GRAV * (spec.gravity === undefined ? 1 : spec.gravity);
        const drag = spec.drag === undefined ? 4 + 2 * stiff + 0.25 * Math.sqrt(K0) : spec.drag, wk = spec.wind === undefined ? 1 : spec.wind;
        const inert = (spec.inertia === undefined ? 0.6 : spec.inertia) * lerp(I0.fling, I1.fling, s), lp = Math.min(1, h * 25);
        const lim = (spec.limit === undefined ? 120 : spec.limit) * D2R;
        const n = spec.seg.length;
        const seed = hash(name.length * 7.3 + name.charCodeAt(0) + name.charCodeAt(n > 1 ? 1 : 0) * 0.37);
        let px = lerp(A0.p[0], A1.p[0], s), py = lerp(A0.p[1], A1.p[1], s), rPrev = 0;
        for (let i = 0; i < n; i++) {
          const l = spec.seg[i], th = C.th[i], r = A0.a[i] + wrapA(A1.a[i] - A0.a[i]) * s;
          const vx = (px - C.pp[i][0]) / h, vy = (py - C.pp[i][1]) / h;
          // pivot acceleration, smoothed (the anchor moves in 1/60 s steps)
          const pa = C.pa[i];
          pa[0] += (clamp((vx - C.pv[i][0]) / h, -400, 400) - pa[0]) * lp; pa[1] += (clamp((vy - C.pv[i][1]) / h, -400, 400) - pa[1]) * lp;
          const ax = pa[0] * inert, ay = pa[1] * inert;
          C.pp[i] = [px, py]; C.pv[i] = [vx, vy];
          const nx = -Math.sin(th), ny = Math.cos(th);
          const turb = 1 + 0.35 * Math.sin(TAU * (1.7 * t + 0.31 * i + seed)) + 0.2 * Math.sin(TAU * (3.9 * t + 0.53 * i + 2 * seed));
          const wx = wind[0] * wk * turb, wy = wind[1] * wk * (0.6 + 0.6 * Math.sin(TAU * (2.3 * t + 0.4 * i + seed)));
          const tvx = vx + C.om[i] * l * nx, tvy = vy + C.om[i] * l * ny;
          const fx = WINDK * wx - drag * tvx - ax, fy = WINDK * wy - drag * tvy - ay - grav;
          const Ki = K0 * (1 - 0.35 * i / n);
          // the spring pulls mostly toward the parent segment's direction plus the rest bend (so the
          // chain bends as one piece), a little toward the bone's rest; bending is damped
          const rel = i > 0 ? wrapA(C.th[i - 1] + (r - rPrev) - th) : wrapA(r - th);
          const tgt = i > 0 ? 0.7 * rel + 0.3 * wrapA(r - th) : rel;
          const bendD = i > 0 ? 6 * (C.om[i] - C.om[i - 1]) : 0;
          const alpha = (fx * nx + fy * ny + grav * Math.cos(r)) / l + Ki * tgt - bendD;
          C.om[i] = clamp(C.om[i] + alpha * h, -25, 25);
          rPrev = r;
          let nt = th + C.om[i] * h;
          const d = wrapA(nt - r);
          if (Math.abs(d) > lim) { nt = r + Math.sign(d) * lim; C.om[i] *= -0.2; }
          C.th[i] = nt;
          px += Math.cos(nt) * l; py += Math.sin(nt) * l;
        }
      }
    }
    function angStep(st, I0, I1, s, h, acc) {
      const aF = acc[0] * I1.f, aY = acc[1];
      const vF = (I1.pel[0] - I0.pel[0]) / SDT * I1.f, wnd = windOf(I1.t)[0] * I1.f;
      for (let j = 0; j < 8; j++) {
        const x = st.ang[j], T = lerp(I0.tgt[j], I1.tgt[j], s), w = TAU * AHZ[j];
        let c = 0;
        if (j === 0 || j === 2) { const ph = I1.lean + x[0]; c = -1.6 * (aY * Math.sin(ph) + aF * Math.cos(ph)); }
        else if (j === 1 || j === 3) { const ph = I1.lean + st.ang[j - 1][0] + x[0]; c = -1.0 * (aY * Math.sin(ph) + aF * Math.cos(ph)) - 0.3 * st.ang[j - 1][1] * w; }
        else if (j === 4) { const ph = x[0]; c = 0.5 * (aY * Math.sin(ph) - aF * Math.cos(ph)) + 0.25 * aY; }
        else if (j === 5) c = -0.8 * aF;
        else if (j === 6) c = -0.5 * aY;
        else c = -1.2 * aF - 1.2 * vF + 0.35 * wnd;   // skirt hem: lags the motion, blown by the wind
        x[1] += (-w * w * (x[0] - T) - 2 * AZ[j] * w * x[1] + c) * h;
        x[0] += x[1] * h;
        const d = x[0] - T;
        if (Math.abs(d) > ALIM[j]) { x[0] = T + Math.sign(d) * ALIM[j]; x[1] *= 0.5; }
      }
    }
    const cloneSim = s => ({ n: s.n, I: s.I, pelPrev: s.pelPrev, ang: s.ang.map(a => a.slice()),
      ch: Object.fromEntries(Object.keys(s.ch).map(nm => { const c = s.ch[nm]; return [nm, { th: c.th.slice(), om: c.om.slice(), pp: c.pp.map(q => q.slice()), pv: c.pv.map(q => q.slice()), pa: c.pa.map(q => q.slice()) }]; })) });
    function simInit() {
      const I = simInputs(0);
      const st = { n: 0, I, pelPrev: I.pel, ang: I.tgt.map(x => [x, 0]), ch: {} };
      for (const name of simNames) {
        const spec = chainSpecs[name], Ac = I.chains[name], p = [Ac.p.slice()];
        for (let i = 0; i < spec.seg.length; i++) p.push([p[i][0] + Math.cos(Ac.a[i]) * spec.seg[i], p[i][1] + Math.sin(Ac.a[i]) * spec.seg[i]]);
        st.ch[name] = { th: Ac.a.slice(), om: Ac.a.map(() => 0), pp: p.slice(0, -1), pv: Ac.a.map(() => [0, 0]), pa: Ac.a.map(() => [0, 0]) };
      }
      // pre-roll 1.5 s holding the first pose, so chains have settled under gravity when the film starts
      for (let j = 0; j < 180; j++) chainsStep(st, I, I, 1, 1 / 120, 0);
      return st;
    }
    function simStep(s0) {
      const st = cloneSim(s0), I0 = s0.I, I1 = simInputs(s0.n + 1);
      if (I1.f !== I0.f) for (const name of simNames) {   // turned round: mirror the chains
        const c = st.ch[name];
        for (let i = 0; i < c.th.length; i++) { c.th[i] = wrapA(Math.PI - c.th[i]); c.om[i] *= -1; c.pp[i][0] = 2 * I1.cx - c.pp[i][0]; c.pv[i][0] *= -1; c.pa[i][0] *= -1; }
      }
      const acc = [0, 1].map(j => clamp((I1.pel[j] - 2 * I0.pel[j] + s0.pelPrev[j]) / (SDT * SDT), -120, 120));
      const h = SDT / SUB;
      for (let j = 0; j < SUB; j++) { const s = (j + 1) / SUB; chainsStep(st, I0, I1, s, h, I0.t + s * SDT); angStep(st, I0, I1, s, h, acc); }
      st.n = s0.n + 1; st.I = I1; st.pelPrev = I0.pel;
      return st;
    }
    const snaps = new Map();
    let recent = [];
    function simAt(n) {
      n = Math.max(0, n);
      for (const r of recent) if (r.n === n) return r;
      let s = null;
      for (const r of recent) if (r.n < n && (!s || r.n > s.n)) s = r;
      let m = Math.floor(n / SNAP) * SNAP;
      while (m > 0 && !snaps.has(m)) m -= SNAP;
      if (!snaps.has(0)) snaps.set(0, simInit());
      if (!s || snaps.get(m).n > s.n) s = snaps.get(m);
      while (s.n < n) { s = simStep(s); if (s.n % SNAP === 0 && !snaps.has(s.n)) snaps.set(s.n, s); }
      recent = [s].concat(recent.filter(r => r !== s)).slice(0, 3);
      return s;
    }
    // what the springs add at time t: angle offsets and chain point positions (world)
    function simOffsets(t, facing) {
      const x = Math.max(0, t) / SDT, n = Math.floor(x), u = x - n;
      const A0 = simAt(n), B0 = simAt(n + 1);
      const off = A0.ang.map((a, j) => lerp(a[0] - A0.I.tgt[j], B0.ang[j][0] - B0.I.tgt[j], u));
      const okA = A0.I.f === facing, okB = B0.I.f === facing;
      const pts = {};
      for (const name of simNames) {
        const pa = A0.ch[name].th, pb = B0.ch[name].th;
        pts[name] = okA && okB ? pa.map((q, i) => q + wrapA(pb[i] - q) * u) : (okB ? pb : pa);
      }
      return { off, pts };
    }

    // hands keep out of the head and the torso (built bodies): a hand that would sit inside the head
    // circle or inside the chest or belly is moved to just outside it, and the arm follows by IK
    // a walking stick (parts.holdNear with use: 'cane'): planted beside the near foot when standing or
    // walking (the hand goes to its top by IK, the tip steps with the foot); carried in the hand in
    // runs, jumps, gestures and sitting. The switch eases over about 0.2 s.
    const CANE = (() => { const e = [].concat((ch.parts || {}).holdNear || []).find(q => q && q.use === 'cane'); if (!e) return null;
      let len = +e.length; if (!(len > 0)) { let m = 0; try { for (const s of CharRig.parsePath(e.d || '')) for (const p of s.slice(1)) if (Array.isArray(p)) m = Math.min(m, p[1]); } catch (er) { m = -1; } len = -m || 1; }
      return { len }; })();
    function caneCond(t) {
      const st = bodyAt(t);
      if (!st || st.airborne || st.gaitKind === 'run' || (st.kind === 'clip') || st.S.ry < A + 0.8 * L) return 0;
      for (const g of gestures) if (g.t0 - 0.15 <= t && t < Math.min(g.end, g.cut)) return 0;
      for (const h of holds) if (h.t0 <= t && t < h.end) return 0;
      return 1;
    }
    function caneAt(t, st, S) {
      const w = (caneCond(t - 0.2) + caneCond(t - 0.1) + caneCond(t) + caneCond(t + 0.1) + caneCond(t + 0.2)) / 5;
      if (w <= 0) return null;
      const pose = poseOf(Object.assign({}, st, { S })), f = pose.legs.near.foot;
      const lift = Math.max(0, f[1] - pr.ankleHeight - 0.01);
      const tip = [f[0] + 0.3 * L, Math.min(0.6 * lift, 0.3 * L)];
      const wristT = [tip[0] - 0.05 * CANE.len, tip[1] + CANE.len + 0.08];
      const a = armTo(S, 'near', wristT), e = smooth(w);
      if (a) { S.arms.near[0] = lerp(S.arms.near[0], a[0], e); S.arms.near[1] = lerp(S.arms.near[1], a[1], e); S.arms.near[2] = lerp(S.arms.near[2], -0.15, e); }
      if (S.hands.near === 'relaxed') S.hands.near = 'grip';
      return w > 0.5 ? { tip } : null;
    }
    function clearArms(st, S) {
      const B = ch.body, hr = Math.max(0.05, (pr.hand || 0.25) * 0.35);
      for (const side of SIDES) {
        const pose = poseOf(Object.assign({}, st, { S })), sol = CharRig.solve(ch, pose), J = sol.joints;
        const sh = J['shoulder.' + side], wr = J['wrist.' + side], ta = sol.angles.torso;
        let tgt = null;
        const hc = add2(J.headBase, rot2([-0.02, 0.52], sol.angles.head)), R = 0.56 * Math.max(0.8, B.b.headWidth) + hr;
        const dh = [wr[0] - hc[0], wr[1] - hc[1]], dl = Math.hypot(dh[0], dh[1]);
        if (dl < R) {
          // out to the head circle, turning toward the front if the arm cannot reach straight out
          const a0 = Math.atan2(dh[1], dh[0]), fwd = sol.angles.head, reach = 0.97 * (pr.upperArm + pr.foreArm);
          for (let j = 0; j <= 12; j++) {
            const a = a0 + wrapA(fwd - a0) * j / 12, c = [hc[0] + Math.cos(a) * R, hc[1] + Math.sin(a) * R];
            tgt = c;
            if (Math.hypot(c[0] - sh[0], c[1] - sh[1]) < reach) break;
          }
          // arms too short to clear the head (a toddler): wave low, the hand out in front of the chest
          if (Math.hypot(tgt[0] - sh[0], tgt[1] - sh[1]) >= reach) { const o = rot2([reach, -0.1 * reach], ta); tgt = [sh[0] + o[0], sh[1] + o[1]]; }
        }
        else {
          const q = rot2([wr[0] - J.root[0], wr[1] - J.root[1]], -ta), y = q[1];
          if (y > 0.22 * pr.torso && y < pr.torso * 0.95) {   // chest and belly; hands may hang at the hips
            const p = B.profile(y);
            const mid = p.front - 0.45 * (p.front - p.back);   // the hand may lie over the front of the belly, not deep in it
            if (q[0] < mid && q[0] > p.back + 0.4 * (p.front - p.back)) {
              // just in front of the body at this height, or lower down the front if the arm is too short
              const reach = 0.97 * (pr.upperArm + pr.foreArm);
              // the lowest point in front of the body's middle that the hand can reach: the arm hangs as
              // low as it can over the belly instead of sinking into it
              for (let j = 0; j < 30; j++) {
                const yy = -0.4 * pr.torso + j * 0.0455 * pr.torso;
                const pp = B.profile(Math.max(0, yy)), pf = yy > 0 ? pp.front - 0.45 * (pp.front - pp.back) + hr : Math.max(q[0], pp.front * 0.6);
                const o = rot2([pf, yy], ta), c = [J.root[0] + o[0], J.root[1] + o[1]];
                if (Math.hypot(c[0] - sh[0], c[1] - sh[1]) < reach) { tgt = c; break; }
              }
              if (!tgt) { const o2 = rot2([reach, -0.15 * reach], ta); tgt = [sh[0] + o2[0], sh[1] + o2[1]]; }   // arms too short: held out in front
            }
          }
        }
        if (!tgt || (S.aim && S.aim[side])) continue;   // a hand sent to a landmark on purpose stays there
        let best = null;
        for (const sd of [-1, 1]) {
          const r = CharRig.ik2(sh, tgt, pr.upperArm, pr.foreArm, sd);
          const ua = Math.atan2(r.mid[1] - sh[1], r.mid[0] - sh[0]), fa = Math.atan2(r.end[1] - r.mid[1], r.end[0] - r.mid[0]);
          const el = wrapA(fa - ua);
          if (el >= -1e-6 && (!best || sd < 0)) best = [wrapA(ua - ta + Math.PI / 2), el];
        }
        if (best) { const a = S.arms[side]; a[0] = a[0] + wrapA(best[0] - a[0]); a[1] = best[1]; }
      }
    }
    const rot2 = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
    // how far forward a relaxed arm must hang to clear the chest and belly (built bodies), found once
    const ARMBIAS = (() => {
      if (!ch.body) return 0;
      const B = ch.body, S0 = resolveKey(STAND, baseS(), {});
      for (let d = 0; d <= 1.2; d += 0.04) {
        const S = cloneS(S0); for (const s of SIDES) S.arms[s][0] += d;
        const sol = CharRig.solve(ch, poseOf({ S, x: 0, y: 0, facing: 1 })), J = sol.joints, ta = sol.angles.torso;
        let inside = false;
        for (const s of SIDES) {
          const w = J['wrist.' + s], q = rot2([w[0] - J.root[0], w[1] - J.root[1]], -ta);
          if (q[1] > 0.22 * pr.torso && q[1] < 0.95 * pr.torso) { const p = B.profile(q[1]); if (q[0] < p.front - 0.45 * (p.front - p.back) && q[0] > p.back + 0.4 * (p.front - p.back)) inside = true; }
        }
        if (!inside) return d;
      }
      return 0;
    })();
    const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
    function sample(t) {
      t = Number(t);
      if (!isFinite(t)) t = 0;
      const c = core(t);
      const st = c.st, S = c.S;
      const sim = useSim ? simOffsets(t, st.facing) : null;
      if (sim) {
        const o = sim.off, ka = SPR.arms, kh = SPR.head, kt = SPR.torso;
        const kn = ka * (S.aim && S.aim.near ? 0.25 : 1), kf = ka * (S.aim && S.aim.far ? 0.25 : 1);   // a hand on a landmark barely wobbles
        S.arms.near[0] += o[0] * kn; S.arms.near[1] += o[1] * kn; S.arms.far[0] += o[2] * kf; S.arms.far[1] += o[3] * kf;
        S.head += o[4] * kh; S.bend = (S.bend || 0) + o[5] * kt; S.chest = (S.chest || 1) * (1 + o[6] * kt);
      }
      if (ch.body) clearArms(st, S);
      const cane = CANE ? caneAt(t, st, S) : null;
      const pose = poseOf(Object.assign({}, st, { S }));
      if (sim && sim.off[7]) pose.skirtSway = sim.off[7];
      if (cane) pose.cane = cane;
      const mood = MOODS[moodAt(t)] || MOODS.neutral;
      const blink = blinkAmount(t);
      const dart = dartAt(t);
      const eye = [clamp(c.eye[0] + dart[0], -1.2, 1.2), clamp(c.eye[1] + dart[1], -1.2, 1.2)];
      // a hand that holds an object (parts.holdNear / holdFar) grips it unless an action shapes the hand
      const cp = ch.parts || {};
      if (cp.holdNear && S.hands.near === 'relaxed') S.hands.near = 'grip';
      if (cp.holdFar && S.hands.far === 'relaxed') S.hands.far = 'grip';
      const sp = speechAt(t), fp = faceAt(t);
      const swaps = { hand: S.hands.near, handFar: S.hands.far, mouth: sp ? (sp.u < 0.5 ? sp.a : sp.b) : (S.mouth || mood.mouth), eye: mood.eye, brow: mood.brow };
      pose.face = { blink, eye, mouth: swaps.mouth, turn: S.faceTurn || 0, browH: fp.browH, browLift: sp ? sp.emph : 0, browA: fp.browA, lid: fp.lid, smile: fp.smile, speaking: !!sp };
      if (sp) Object.assign(pose.face, { open: sp.open, wide: sp.wide, round: sp.round, teeth: sp.teeth, tongue: sp.tongue, viseme: [sp.a, sp.b, sp.u] });
      pose.swaps = { hand: { near: S.hands.near, far: S.hands.far }, mouth: swaps.mouth, eye: swaps.eye, brow: swaps.brow };
      pose.squash = S.squash.slice();
      const chains = {};
      if (sim && simNames.length) {
        const sol = CharRig.solve(ch, pose);
        for (const name of simNames) {
          const spec = chainSpecs[name], b = CharRig.chainBase(ch, sol, spec), curl = (spec.curl || 0) * D2R, th = sim.pts[name];
          chains[name] = spec.seg.map((_, i) => wrapA((st.facing > 0 ? th[i] : Math.PI - th[i]) - (b.angle + curl * i)));
        }
      }
      pose.secondary = { chains, hair: 0.1, cloth: 0.05 };
      let held = null;
      if (c.held) {
        const sol = CharRig.solve(ch, pose);
        const side = c.held.side, wr = sol.joints['wrist.' + side], ha = sol.angles['hand.' + side];
        const g = skin.grip || [0.1, 0];
        const gp = [wr[0] + g[0] * Math.cos(ha) - g[1] * Math.sin(ha), wr[1] + g[0] * Math.sin(ha) + g[1] * Math.cos(ha)];
        const sp = toStage(st, gp);
        const hd = Math.atan2(-Math.sin(ha), st.facing * Math.cos(ha)) / D2R;     // stage degrees, y down
        // angle: rotation for a prop drawn upright with its grip at the origin; it tilts a little
        // with the hand instead of spinning with it
        const rest = { side: 90, up: -90 }[c.held.how];
        const tilt = rest === undefined ? 0 : clamp(0.25 * wrapA((hd - rest) * D2R) / D2R, -30, 30);
        held = { prop: c.held.prop, how: c.held.how, joint: sp, angle: tilt, handAngle: hd, hand: side, flip: st.facing };
      }
      return { x: st.x, y: st.y, facing: st.facing, pose, swaps, held, scale: k, height: H * k, offstage: !!st.offstage, mood: moodAt(t), airborne: !!st.airborne,
        contacts: c.contacts && c.contacts.length ? c.contacts : null };
    }

    return {
      // for tests and tools: where an action's hand targets are (rig coords) and when (s from its start)
      // where a landmark is on the body at time t (rig coords, root at x = 0), as hand targets see it
      _actionClip(name, args) { const sp = specOf(name); return sp && sp.user ? actionClip(sp.user, Object.assign({}, sp.args, args || {})) : null; },
      landmarkAt(t, side, spec) { const c = core(t); return targetOf(c.S, side, spec); },
      // a landmark of this body in a sample, in stage px (for the partner's hands: docs/PAIRS.md)
      pointOf(smp, name, side) {
        const sol = CharRig.solve(ch, smp.pose), p = lmOn(sol, side || 'near', name, 0, 0);
        const W = q => [smp.x + smp.facing * smp.scale * q[0], smp.y - smp.scale * q[1]];
        return p ? (Array.isArray(p[0]) ? p.map(W) : W(p)) : null;
      },
      // put this side's wrist on a stage point (weight w), changing only that arm of the sample's pose;
      // true when the point is within reach
      reach(smp, side, P, w) {
        const pose = smp.pose, sol = CharRig.solve(ch, pose), sh = sol.joints['shoulder.' + side], ta = sol.angles.torso;
        const tg = [(P[0] - smp.x) / (smp.facing * smp.scale), (smp.y - P[1]) / smp.scale];
        const reach = 0.995 * (pr.upperArm + pr.foreArm), d = Math.hypot(tg[0] - sh[0], tg[1] - sh[1]);
        if (d > reach) { tg[0] = sh[0] + (tg[0] - sh[0]) * reach / d; tg[1] = sh[1] + (tg[1] - sh[1]) * reach / d; }
        let best = null;
        for (const sd of [-1, 1]) {
          const r = CharRig.ik2(sh, tg, pr.upperArm, pr.foreArm, sd);
          const ua = Math.atan2(r.mid[1] - sh[1], r.mid[0] - sh[0]), fa = Math.atan2(r.end[1] - r.mid[1], r.end[0] - r.mid[0]), el = wrapA(fa - ua);
          if (el >= -1e-6 && (!best || sd < 0)) best = [wrapA(ua - ta + Math.PI / 2), el];
        }
        if (!best) return false;
        const a = pose.arms[side], u = clamp(w, 0, 1);
        a.shoulder = a.shoulder + wrapA(best[0] - a.shoulder) * u; a.elbow = a.elbow + wrapA(best[1] - a.elbow) * u;
        return d <= reach * 1.01;
      },
      actionTargets(name, args) {
        const sp = specOf(name);
        if (!sp || !sp.user) return [];
        const c = actionClip(sp.user, Object.assign({}, sp.args, args || {})), out = [];
        for (const q of c.keys) if (q._pts) for (const side of SIDES) if (q._pts[side]) out.push({ side, t: q.t * TS, target: q._pts[side], at: q['_tg' + side] });
        return out;
      },
      sample,
      end(i) { return endOf[i] !== undefined ? endOf[i] : (events && events[i] && isFinite(+events[i].t) ? +events[i].t : 0); },
      diagnostics,
      scale: k, height: H * k, timeScale: TS, armReach: (pr.upperArm + pr.foreArm) * k,
      duration: Math.max(0, ...Object.values(endOf).filter(isFinite)),
    };
  }

  function lev(a, b) {
    const m = a.length, n = b.length, d = [];
    for (let i = 0; i <= m; i++) d[i] = [i];
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }

  // SVG for one actor in its own space: origin = its feet (place it at sample.x, sample.y)
  function draw(skin, sample) {
    if (!sample || !sample.pose) return '';
    const ch = isSkin(skin) ? skin : CharRig.skinCharacter(skin || {});
    return CharRig.render(ch, sample.pose, { x: 0, y: 0, scale: sample.scale, facing: sample.facing, squash: sample.pose.squash, layers: sample._layers });
  }

  return { get actions() { return vocab(); }, compile, draw, moods: Object.keys(CharPoses.moods), specOf };
});
