// stage.js - composes a parsed film script into frames (STAGE.md sections 4-5).
// UMD: window.CharStage in the browser, module.exports in Node.
//
//   CharStage.compile(parsed, lib) -> film { duration, diagnostics, frame(t) -> SVG string, ...helpers for tools }
//   CharStage.mount(el, parsed, lib) -> { seek(t), duration, diagnostics, film }
//
// lib = { skins, sets, puppets, props } (defaults to the globals CharSkins, CharSets, CharPuppets, CharProps).
// Everything is a pure function of time: frame(t) reads no state left by an earlier frame.
// Actors are driven by CharPerform when it is loaded, otherwise by the small Standin below.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root, require('./script.js'));
  else root.CharStage = factory(root, root.CharScript);
})(typeof self !== 'undefined' ? self : this, function (root, CharScript) {
  'use strict';
  const G = typeof globalThis !== 'undefined' ? globalThis : root;
  function dep(name, file) {
    if (G[name]) return G[name];
    if (typeof require === 'function' && file) { try { const m = require(file); G[name] = m; return m; } catch (e) { /* not available */ } }
    return null;
  }
  const FW = 1280, FH = 720;   // frame size

  // ---------- math ----------
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const ease = u => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const fx = v => (Math.round(v * 100) / 100).toString();
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function lerpObj(a, b, u) {   // numeric blend of two plain objects/arrays; non-numbers switch at the middle
    if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * u;
    if (Array.isArray(a) && Array.isArray(b)) return b.map((v, i) => lerpObj(a[i] === undefined ? v : a[i], v, u));
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const o = {};
      for (const k of Object.keys(b)) o[k] = k in a ? lerpObj(a[k], b[k], u) : b[k];
      for (const k of Object.keys(a)) if (!(k in b)) o[k] = a[k];
      return o;
    }
    return u < 0.5 ? (a === undefined ? b : a) : b;
  }
  function blinkAt(t, seed) {   // irregular deterministic blinks, 0..1 closed
    const P = 2.7, k = Math.floor(t / P + seed);
    let b = 0;
    for (const j of [k - 1, k]) {
      const bt = (j - seed) * P + 0.3 + hash(j + seed * 13) * (P - 0.6);
      const d = Math.abs(t - bt);
      if (d < 0.09) b = Math.max(b, 1 - d / 0.09);
    }
    return b;
  }

  // ---------- skins -> rig character ----------
  const charCache = new WeakMap();
  function charOf(skin) {
    const R = dep('CharRig', './rig.js');
    if (!skin) return R.defaultCharacter();
    if (charCache.has(skin)) return charCache.get(skin);
    if (R.skinCharacter) { const c = R.skinCharacter(skin); charCache.set(skin, c); return c; }
    const ch = R.defaultCharacter();
    const pr = skin.proportions || {};
    ch.proportions = Object.assign({}, ch.proportions, pr, { radius: Object.assign({}, ch.proportions.radius, pr.radius || {}) });
    if (skin.palette) ch.palette = Object.assign({}, ch.palette, skin.palette);
    if (skin.style) ch.style = Object.assign({}, ch.style, skin.style);
    if (skin.hair) ch.hair = skin.hair;
    charCache.set(skin, ch);
    return ch;
  }

  // ======================================================================================
  // Standin performer: used only when CharPerform is not loaded. Stand, idle breathing,
  // walk/run/sneak/enter through CharGait (no foot slide while moving), turn, hold/drop,
  // wave/cheer, face moods via the mouth. Other actions are shown as standing.
  // ======================================================================================
  const Standin = {
    standin: true,
    actions: CharScript.STANDIN_ACTIONS,
    compile(skin, events, env) {
      const R = dep('CharRig', './rig.js'), Gt = dep('CharGait', './gait.js');
      const ch = charOf(skin), pr = ch.proportions, s = env.scale || 62;
      const ground = typeof env.ground === 'function' ? env.ground : () => env.ground;
      const anchors = env.anchors || {};
      const diagnostics = [];
      const gaitOf = (preset, speed) => {
        const prm = { preset, speed: speed || 1 }, p = Gt.resolve(prm);
        const S = p.stride * (pr.thigh + pr.shin) * Math.sqrt(p.speed);
        return { prm, S, v: S * Gt.cycleRate(prm) * s };   // v in px/s
      };
      let x = env.x === undefined ? 200 : env.x, facing = env.facing || 1;
      const moves = [], arms = [], faces = [], turns = [], ends = [];
      const placeX = v => typeof v === 'number' ? v : anchors[v] ? anchors[v][0] : null;
      events.forEach((ev, i) => {
        const a = ev.args || {};
        let end = ev.t + 0.25;
        const mv = { walk: 'walk', run: 'run', sneak: 'sneak', enter: 'walk', jump: 'run' }[ev.action];
        if (mv) {
          let x0 = x, to = placeX(a.to);
          if (ev.action === 'enter') { to = x; x0 = clamp(x + (a.from === 'right' ? 700 : -700), -90, (env.width || 2000) + 90); }
          if (to === null) { diagnostics.push({ code: 'bad-arg', t: ev.t, line: ev.line, message: `cannot find place '${a.to}'.` }); to = x; }
          const g = gaitOf(mv, a.speed);
          const dur = Math.abs(to - x0) / g.v;
          if (dur > 0.01) {
            const dir = Math.sign(to - x0);
            moves.push({ t0: ev.t, t1: ev.t + dur, x0, x1: to, dir, g });
            turns.push({ t: ev.t, f: dir });
            facing = dir;
            end = ev.t + dur + 0.3;
          }
          x = to;
          if (ev.action === 'jump') diagnostics.push({ code: 'standin', t: ev.t, line: ev.line, severity: 'info', message: 'stand-in performer: jump shown as a run' });
        } else if (ev.action === 'turn') { facing = -facing; turns.push({ t: ev.t, f: facing }); end = ev.t + 0.3; }
        else if (ev.action === 'hold') arms.push({ t: ev.t, kind: 'hold', prop: a.prop, how: a.how || 'front' });
        else if (ev.action === 'drop') arms.push({ t: ev.t, kind: 'drop' });
        else if (ev.action === 'wave' || ev.action === 'cheer' || ev.action === 'point' || ev.action === 'reach') { arms.push({ t: ev.t, kind: ev.action, dur: 1.6 }); end = ev.t + 1.6; }
        else if (ev.action === 'face') { faces.push({ t: ev.t, mood: a.mood }); end = ev.t + 0.2; }
        else if (ev.action === 'stand' || ev.action === 'idle' || ev.action === 'look' || ev.action === 'nod') { /* standing is the default */ }
        else diagnostics.push({ code: 'standin', t: ev.t, line: ev.line, severity: 'info', message: `stand-in performer: '${ev.action}' shown as standing` });
        ends[i] = end;
      });

      function stand(t, rootX) {
        const br = Math.sin(t * 2.1) * 0.012;
        return {
          root: [rootX, pr.thigh + pr.shin + pr.ankleHeight - 0.045 + br],
          pelvisTilt: 0, spineLean: 0.03 + br, chestTwist: 0, neck: 0, headTilt: 0.02 + br,
          legs: { near: { foot: [rootX + 0.12, pr.ankleHeight], footAngle: 0 }, far: { foot: [rootX - 0.13, pr.ankleHeight], footAngle: 0 } },
          arms: { near: { shoulder: 0.1 + br, elbow: 0.28, wrist: 0.1 }, far: { shoulder: -0.1, elbow: 0.32, wrist: 0.1 } },
          face: { blink: 0, mouth: 'neutral', eye: [0.3, 0], brow: 0.2 },
          secondary: { hair: 0.05, hair2: 0.05, cloth: 0.03 },
        };
      }
      function walkPose(m, t) {
        const d = m.g.v * clamp(t - m.t0, 0, m.t1 - m.t0), cyc = d / (m.g.S * s);
        return { pose: Gt.pose(m.g.prm, cyc - Math.floor(cyc), ch), x: m.x0 + m.dir * d };
      }
      function bodyAt(t) {
        let m = null;
        for (const mm of moves) if (mm.t0 <= t) m = mm;
        if (!m) return { pose: stand(t, 0), x: env.x === undefined ? 200 : env.x, walking: false };
        const w = walkPose(m, t);
        if (t <= m.t1) {   // blend in from standing over 0.2 s
          const u = smooth((t - m.t0) / 0.2);
          return { pose: u < 1 ? lerpObj(stand(t, w.pose.root[0]), w.pose, u) : w.pose, x: w.x, walking: true };
        }
        const u = smooth((t - m.t1) / 0.3);   // settle into standing
        return { pose: u < 1 ? lerpObj(w.pose, stand(t, w.pose.root[0]), u) : stand(t, w.pose.root[0]), x: m.x1, walking: false };
      }
      const ARM = {
        hold: { up: { shoulder: 2.5, elbow: 0.25, wrist: -0.2 }, front: { shoulder: 1.05, elbow: 0.75, wrist: -0.3 }, side: { shoulder: 0.25, elbow: 0.15, wrist: 0 } },
        cheer: { shoulder: 2.8, elbow: 0.2, wrist: 0 },
        point: { shoulder: 1.5, elbow: 0.05, wrist: 0 },
        reach: { shoulder: 1.3, elbow: 0.2, wrist: 0 },
      };
      function armsAt(t, base) {
        const near = Object.assign({}, base.near), far = Object.assign({}, base.far);
        let held = null, holdW = 0, holdArm = null;
        // the latest hold/drop before t decides what the near hand carries
        for (const a of arms) if (a.t <= t && (a.kind === 'hold' || a.kind === 'drop')) {
          if (a.kind === 'hold') { held = a; holdW = smooth((t - a.t) / 0.3); holdArm = ARM.hold[a.how] || ARM.hold.front; }
          else { holdW = held ? 1 - smooth((t - a.t) / 0.3) : 0; held = null; }
        }
        let out = holdArm ? lerpObj(near, holdArm, holdW) : near;
        let outFar = far;
        for (const a of arms) if (a.dur && t >= a.t && t < a.t + a.dur) {
          const w = smooth((t - a.t) / 0.3) * smooth((a.t + a.dur - t) / 0.3);
          let tgt = a.kind === 'wave' ? { shoulder: 2.55, elbow: 0.55 + 0.45 * Math.sin((t - a.t) * 15), wrist: 0.2 } : ARM[a.kind];
          if (a.kind === 'cheer') outFar = lerpObj(far, { shoulder: 2.7, elbow: 0.25, wrist: 0 }, w);
          if (!held) out = lerpObj(out, tgt, w); else outFar = lerpObj(outFar, tgt, w);
        }
        return { near: out, far: outFar, held: held && t >= held.t + 0.15 ? held : null };
      }
      const MOUTH = { happy: 'smile', scared: 'open', surprised: 'open', determined: 'neutral', sad: 'neutral', neutral: 'neutral' };
      function sample(t) {
        const b = bodyAt(t), pose = b.pose;
        let f = env.facing || 1;
        for (const tr of turns) if (tr.t <= t) f = tr.f;
        const ar = armsAt(t, pose.arms);
        pose.arms = { near: ar.near, far: ar.far };
        let mood = null;
        for (const fc of faces) if (fc.t <= t) mood = fc.mood;
        pose.face = Object.assign({}, pose.face, { blink: blinkAt(t, (env.x || 0) % 7), mouth: mood ? MOUTH[mood] || 'neutral' : pose.face.mouth || 'neutral' });
        // feet follow uneven ground: each foot target is moved by the ground height under it
        const gx = ground(b.x);
        let drop = 0;
        for (const side of ['near', 'far']) {
          const L = pose.legs[side], wx = b.x + f * (L.foot[0] - pose.root[0]) * s;
          const dy = (ground(wx) - gx) / s;   // + = ground lower under this foot
          L.foot = [L.foot[0], L.foot[1] - dy];
          drop = Math.max(drop, dy);
        }
        pose.root = [pose.root[0], pose.root[1] - drop * 0.8];
        const held = ar.held ? { prop: ar.held.prop, joint: 'wrist.near', angle: 0 } : null;
        return { x: b.x, y: gx, facing: f, pose, swaps: { hand: held ? 'grip' : 'relaxed', mouth: pose.face.mouth, eye: 'open', brow: 'neutral' }, held, scale: s };
      }
      return { sample, end: i => ends[i] === undefined ? 0 : ends[i], diagnostics };
    },
    draw(skin, smp) {
      const R = dep('CharRig', './rig.js'), s = smp.scale || 62;
      const drawn = skin && (skin.parts || skin.swaps || skin.chains || skin.build) ? skin : charOf(skin);   // rig.js draws skins itself
      return `<g transform="scale(${smp.facing || 1} 1)">${R.render(drawn, smp.pose, { x: -smp.pose.root[0] * s, y: 0, scale: s })}</g>`;
    },
  };

  // rig joints of a sample in stage px (used for held props and by tools/check.cjs)
  // Convention (CharPerform.draw): rig point p maps to (x + facing*p.x*scale*sq.x, y - p.y*scale*sq.y).
  // The stand-in draws its gait pose shifted by -root.x instead (standin = true).
  function jointsOf(skin, smp, scale, standin) {
    const R = dep('CharRig', './rig.js');
    if (!smp || !smp.pose || !smp.pose.root) return null;
    const ch = charOf(skin), sol = R.solve(ch, smp.pose), J = sol.joints;
    const s = smp.scale || scale, f = smp.facing || 1, r0 = standin ? smp.pose.root[0] : 0;
    const sq = (!standin && smp.pose.squash) || [1, 1];
    const W = p => [smp.x + f * (p[0] - r0) * s * sq[0], smp.y - p[1] * s * sq[1]];
    const out = { root: W(J.root), head: W([J.headBase[0], J.headBase[1] + ch.proportions.head * 1.1]), feet: {}, hands: {} };
    for (const side of ['near', 'far']) {
      const fp = R.footPoints(ch, J['ankle.' + side], sol.angles['foot.' + side]);
      out.feet[side] = { heel: W(fp.heel), toe: W(fp.toe), ankle: W(J['ankle.' + side]), low: Math.max(...fp.ground.map(p => W(p)[1])) };
      const ha = sol.angles['hand.' + side], hs = (ch.proportions.hand || 1) * 0.1;
      const wr = J['wrist.' + side];
      out.hands[side] = W([wr[0] + Math.cos(ha) * hs, wr[1] + Math.sin(ha) * hs]);
    }
    return out;
  }

  // ---------- fallback set ----------
  const PLAIN_SET = {
    name: 'plain', width: 1280, height: 720, ground: 600, actorScale: 62, anchors: { left: 200, center: 640, right: 1080 },
    layers: [{ depth: 0, draw: () => '<rect x="-50" y="-50" width="1380" height="820" fill="#cfe3ee"/><rect x="-50" y="600" width="1380" height="200" fill="#8fb37a"/>' }],
  };

  // bare stage (a film with no set line): transparent, flat ground, no scenery. stage width= ground= scale=
  function bareSet(st) {
    st = st || {};
    return { name: 'bare', bare: true, width: st.width || 2400, height: FH, ground: st.ground || 600, actorScale: st.scale || 68, anchors: { left: 200, center: 640, right: 1080 }, layers: [] };
  }

  function normalizeLib(lib) {
    lib = lib || {};
    return {
      skins: lib.skins || G.CharSkins || {}, sets: lib.sets || G.CharSets || {},
      puppets: lib.puppets || G.CharPuppets || {}, props: lib.props || G.CharProps || {},
    };
  }

  // text helpers for captions, bubbles and cards
  function wrap(text, size, maxW) {
    const cw = size * 0.53, out = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const w of para.split(/\s+/)) {
        const tryL = line ? line + ' ' + w : w;
        if (tryL.length * cw > maxW && line) { out.push(line); line = w; } else line = tryL;
      }
      out.push(line);
    }
    return { lines: out, width: Math.max(...out.map(l => l.length * cw)) };
  }
  const FONT = `'Trebuchet MS', 'Segoe UI', Verdana, sans-serif`;
  const SERIF = `Georgia, 'Palatino Linotype', 'Times New Roman', serif`;

  // ======================================================================================
  function compile(parsed, libIn, opts) {
    opts = opts || {};
    if (typeof parsed === 'string') parsed = CharScript.parse(parsed);
    const P = parsed, lib = normalizeLib(libIn);
    const realPerf = dep('CharPerform', null);
    const Perf = opts.standin ? Standin : (realPerf || Standin);
    const libDiag = CharScript.validate(P, lib);

    // ----- set -----
    const sdecl = P.sets[0] || { name: 'plain' };
    const set = P.sets[0] ? (lib.sets[sdecl.name] || PLAIN_SET) : bareSet(P.stage);
    const variantName = (sdecl.variant && set.variants && set.variants[sdecl.variant]) ? sdecl.variant : (set.defaultVariant || null);
    const pal = Object.assign({}, set.palette || {}, (set.variants && variantName && set.variants[variantName]) || {});
    const W = set.width || FW, H = set.height || FH;
    const ground = typeof set.ground === 'function' ? (x => set.ground(x)) : (() => (set.ground === undefined ? H - 120 : set.ground));
    const actorScale = set.actorScale || 62;
    const anchors = {};
    for (const k of Object.keys(set.anchors || {})) {
      const v = set.anchors[k];
      anchors[k] = Array.isArray(v) ? [v[0], v[1] === undefined || v[1] === null ? ground(v[0]) : v[1]] : [v, ground(v)];
    }
    const placeOf = v => typeof v === 'number' ? [v, ground(v)] : (anchors[v] ? (typeof anchors[v] === 'function' ? anchors[v](0).slice() : anchors[v].slice()) : null);
    // declared puppets, props and actors are also places (where they were put at the start)
    for (const d of P.puppets.concat(P.props, P.actors)) { const p = placeOf(d.at); if (p && !anchors[d.name]) anchors[d.name] = p; }

    // ----- clock: beat grids (tempo) and world freezes -----
    // Script times are real (film) time. Actors, puppets and the water live in world time, which
    // stands still during a freeze: world = real minus the frozen time before it. On a beat grid an
    // actor's pose holds between grid steps and moves quickly into the next one, landing on it.
    const freezes = [], tempos = [];
    for (const st of P.tracks.clock || []) for (const c of st.calls) {
      if (!isFinite(st.t)) continue;
      if (c.name === 'freeze') freezes.push({ t: st.t, d: Math.max(0, +c.args.for || 0) });
      else if (c.name === 'tempo') tempos.push({ t: st.t, bpm: +c.args.bpm || 0, div: Math.max(1, Math.round(+c.args.div || 1)), snap: clamp(+c.args.snap || 0.3, 0.02, 1), who: c.args.who || '' });
    }
    freezes.sort((a, b) => a.t - b.t); tempos.sort((a, b) => a.t - b.t);
    const toWorld = r => { let w = r; for (const f of freezes) w -= clamp(r - f.t, 0, f.d); return w; };
    const toReal = w => { let r = w; for (const f of freezes) if (w > toWorld(f.t) + 1e-9) r += f.d; return r; };
    const gridAt = (name, r) => {
      let g = null;
      for (const q of tempos) if (q.t <= r + 1e-6 && (!q.who || q.who === name)) g = q;
      return g && g.bpm > 0 ? { g: 60 / g.bpm / g.div, snap: g.snap } : null;
    };
    const quant = (name, r) => {
      const G = gridAt(name, r);
      if (!G) return r;
      const g = G.g, sn = G.snap * g, n = Math.ceil(r / g - 1e-7), rn = n * g;
      return (n - 1) * g + (r >= rn - sn ? g * smooth((r - (rn - sn)) / sn) : 0);
    };

    // ----- wind (script target `wind`): amount at real time r, + blows toward +x. Performers read it
    // for their spring chains (hair, scarf, cloth). gust: up in the first quarter, gone by the end.
    const windAt = r => {
      const list = [];
      for (const st of P.tracks.wind || []) for (const c of st.calls) if (isFinite(st.t)) list.push({ t: st.t, c });
      list.sort((a, b) => a.t - b.t);
      let base = 0, g = 0;
      for (const { t, c } of list) {
        if (t > r) break;
        const a = (+c.args.amount || 0) * (c.args.from === 'left' ? 1 : -1), u = (r - t) / Math.max(0.05, +c.args.over || 0);
        if (c.name === 'blow') base = lerp(base, a, smooth(u));
        else if (u < 1) g += a * smooth(u / 0.25) * (1 - smooth((u - 0.35) / 0.65));
      }
      return base + g;
    };

    // ----- actors -----
    // a skin may say extends: '<other skin>' and change only some keys (usually the palette);
    // a key set to null in parts, swaps or chains removes that item of the base skin
    const skinOf = name => {
      const s = lib.skins[name];
      if (!s || !s.extends || !lib.skins[s.extends] || s.extends === name) return s || null;
      const base = skinOf(s.extends);
      const m = Object.assign({}, base, s);
      for (const k of ['palette', 'proportions', 'swaps', 'parts', 'chains', 'build', 'motion', 'springs']) if (base[k] && s[k]) m[k] = Object.assign({}, base[k], s[k]);
      for (const k of ['parts', 'swaps', 'chains']) if (m[k]) { m[k] = Object.assign({}, m[k]); for (const q of Object.keys(m[k])) if (m[k][q] === null) delete m[k][q]; }
      delete m.extends;
      return m;
    };
    const actors = P.actors.map(a => {
      let skin = skinOf(a.skin);
      if (skin && set.silhouette) skin = Object.assign({}, skin, { silhouette: set.silhouette });   // a silhouette set draws every figure in one colour
      const start = placeOf(a.at) || [200, ground(200)];
      const env = { ground, anchors, scale: actorScale * a.scale, x: start[0], facing: a.facing, width: W, height: H,
        grid: w => { const G = gridAt(a.name, toReal(w)); return G ? G.g : 0; },
        wind: w => windAt(toReal(w)) };   // beat grid step (s) at world time w, 0 = none
      return { name: a.name, decl: a, skin, env, events: [], perf: null, P: Perf };
    });
    const actorBy = {};
    actors.forEach(A => { actorBy[A.name] = A; });
    // an actor as a place is where it is at that moment, at the height of its eyes (look, point, reach at it)
    for (const A of actors) {
      const start = anchors[A.name];
      let busy = false;
      anchors[A.name] = t => {
        if (!A.perf || busy || !isFinite(t)) return start;
        busy = true;
        try { const s = A.perf.sample(t); return [s.x, s.y - (s.height || 3 * A.env.scale) * 0.82]; } catch (e) { return start; } finally { busy = false; }
      };
    }
    // the performer wants events sorted by time; A.order maps a source-order index to the sorted one
    const compileActor = A => {
      const idx = A.events.map((e, i) => i).sort((a, b) => A.events[a].t - A.events[b].t || a - b);
      A.order = [];
      idx.forEach((orig, k) => { A.order[orig] = k; });
      A.sorted = idx.map(i => A.events[i]);
      try { return A.P.compile(A.skin, A.sorted, A.env); }
      catch (e) {
        libDiag.push({ code: 'performer', line: A.decl.line, severity: 'error', message: `the performer failed for ${A.name}: ${e.message}. The stand-in is used instead.` });
        A.P = Standin;
        return Standin.compile(A.skin, A.sorted, A.env);
      }
    };

    // ----- puppets: state changes and moves, built in order while times resolve -----
    const puppets = P.puppets.map(p => {
      const def = lib.puppets[p.kind] || null;
      const start = placeOf(p.at) || [300, ground(300)];
      const initial = def ? (def.initial || Object.keys(def.states)[0]) : 'none';
      return { name: p.name, decl: p, def, scale: p.scale, changes: [{ t: -1e9, state: initial }], moves: [], turns: [], start, pending: null, facing0: p.facing };
    });
    const pupBy = {};
    puppets.forEach(p => { pupBy[p.name] = p; });
    function pupPos(U, t) {
      let m = null;
      for (const mm of U.moves) if (mm.t0 <= t) m = mm;
      if (!m) return { x: U.start[0], y: U.start[1], moving: false };
      if (t >= m.t1) return { x: m.to[0], y: m.to[1], moving: false };
      const u = (t - m.t0) / (m.t1 - m.t0);
      let pu;
      if (m.step) { const n = m.n, k = Math.min(n - 1, Math.floor(u * n)), f = u * n - k; pu = (k + smooth(f)) / n; }
      else pu = ease(u);
      const x = lerp(m.from[0], m.to[0], pu);
      let y;
      const onGround = Math.abs(m.from[1] - ground(m.from[0])) < 3 && Math.abs(m.to[1] - ground(m.to[0])) < 3;
      if (m.travel === 'air') y = lerp(m.from[1], m.to[1], pu) - m.arc * Math.sin(Math.PI * pu);
      else y = onGround ? ground(x) : lerp(m.from[1], m.to[1], pu);
      return { x, y, moving: true, dir: Math.sign(m.to[0] - m.from[0]) };
    }
    function pupEnds(st) {
      const U = pupBy[st.target], c = st.calls[0];
      if (!U || !U.def) return [st.t];
      if (U.pending && U.pending.t <= st.t) U.changes.push(U.pending);
      U.pending = null;
      if (c.name === 'turn') { U.turns.push({ t: st.t }); return [st.t + 0.2]; }
      const sd = U.def.states[c.name];
      if (!sd) return [st.t];
      U.changes.push({ t: st.t, state: c.name });
      let end = st.t;
      if (sd.travel && c.args.to !== undefined) {
        const from = pupPos(U, st.t);
        // cut short any move still running
        for (const mm of U.moves) if (mm.t1 > st.t) { mm.to = [from.x, from.y]; mm.t1 = st.t; }
        let to = placeOf(c.args.to) || [from.x, from.y];
        const dist = Math.hypot(to[0] - from.x, to[1] - from.y);
        const mv = { t0: st.t, from: [from.x, from.y], to, travel: sd.travel, arc: sd.travel === 'air' ? Math.min(160, 0.3 * dist + 30) : 0 };
        if (sd.step) { mv.n = Math.max(1, Math.round(dist / (sd.stepLength || 40))); mv.step = sd.step; mv.t1 = st.t + mv.n * sd.step; }
        else mv.t1 = st.t + (c.args.for || dist / (c.args.speed || sd.speed || 200));
        if (dist < 0.5) mv.t1 = st.t;
        U.moves.push(mv);
        end = mv.t1;
      } else if (c.args.for || sd.dur) end = st.t + (c.args.for || sd.dur);
      if (end > st.t && (sd.then || (!sd.loop && !sd.travel))) U.pending = { t: end, state: sd.then || U.changes[0].state, auto: true };
      return [end];
    }

    // ----- paired actions (docs/PAIRS.md): 'A: hug(with=B)' -----
    // A walks (or turns) to the distance the pair file asks for, B turns to face A, then both play their
    // role from the same moment: A 'hug.a', B 'hug.b'. Each role is told how far apart the two stand
    // (apart, in its own head heights), how tall the partner is (size, partner / self) and how heavy
    // (push, partner / self), so keys can kneel for a child or stagger more for a heavier shove.
    const pairDef = name => { const g = typeof globalThis !== 'undefined' ? globalThis : {}; const p = (g.CharActions || {})[name]; return p && p.pair && p.a && p.b ? p : null; };
    function bodyOf(A, smp) {
      const ch = charOf(A.skin), pr = ch.proportions, k = smp.scale || A.env.scale;
      const front = ch.body ? Math.max(...[0.25, 0.4, 0.55, 0.7, 0.85].map(f => ch.body.profile(f * pr.torso).front)) : 0.28;   // the belly counts
      const b = ch.body ? ch.body.b : {}, mot = (A.skin && A.skin.motion) || {};
      const mass = Math.pow(smp.height || 3 * k, 2) * (0.5 + (b.chest || 0.9) + 0.8 * (b.belly || 0)) * (0.7 + 0.6 * (mot.weight === undefined ? 0.5 : mot.weight));
      return { k, front: front * k, arm: (pr.upperArm + pr.foreArm) * k, height: smp.height || 3 * k, mass };
    }
    // speed=2 plays both roles twice as fast; for=s sets the length of the action itself (not the walk-up)
    const roleLen = pd => Math.max(...['a', 'b'].map(r => Math.max(0, ...(pd[r].keys || []).map(k => +k.t || 0))));
    function pairSpeed(c) {
      const pd = pairDef(c.name), f = +c.args.for, sp = +c.args.speed;
      if (f > 0) return Math.max(0.2, Math.min(5, roleLen(pd) / f));
      return sp > 0 ? Math.max(0.2, Math.min(5, sp)) : 1;
    }
    const lastEnd = A => { const i = A.events.length - 1; try { const e = A.perf.end(A.order[i]); return isFinite(e) ? e : A.events[i].t; } catch (e) { return A.events[i].t; } };
    // the closest the two torsos come while both play their roles (px; negative = they overlap)
    // free space between two facing torsos (px; negative = overlap), compared height by height where both
    // torsos are (a child's head does not count); a child's front against a grown-up's knee
    function torsoGap(A, B, sA, sB, side) {
      const la = A.perf.pointOf(sA, 'torsoLine'), lb = B.perf.pointOf(sB, 'torsoLine');
      let g = Infinity;
      for (const p of la) for (let i = 0; i + 1 < lb.length; i++) {
        const q = lb[i], r = lb[i + 1], lo = Math.min(q[1], r[1]), hi = Math.max(q[1], r[1]);
        if (p[1] < lo || p[1] > hi || hi - lo < 1e-6) continue;
        const x = q[0] + (r[0] - q[0]) * (p[1] - q[1]) / (r[1] - q[1]);
        g = Math.min(g, side * x - side * p[0]);
      }
      if (!isFinite(g)) {
        const aHigh = Math.max(...la.map(p => -p[1])) > Math.max(...lb.map(p => -p[1]));
        g = aHigh ? side * B.perf.pointOf(sB, 'torso')[0] - side * A.perf.pointOf(sA, 'knee')[0] : side * B.perf.pointOf(sB, 'knee')[0] - side * A.perf.pointOf(sA, 'torso')[0];
      }
      return g;
    }
    function clearance(A, B, t0, t1, side) {
      let m = Infinity, mc = Infinity, miss = 0, lastT = Infinity;
      // overlap counts until the first touch has landed: after a hit the partner's reaction (a stagger, a fall) is its own
      for (let t = t0; t <= t1 + 1e-6; t += 0.08) { const a = A.perf.sample(t), b = B.perf.sample(t); if ([a, b].some(s => s.contacts && s.contacts.some(q => q.w > 0.99))) { lastT = t; break; } }
      if (!isFinite(lastT)) lastT = t1;   // over the whole role, while a hand is on the partner; how far a hand falls short (px)
      for (let t = t0; t <= t1 + 1e-6; t += 0.08) {
        const sA = A.perf.sample(t), sB = B.perf.sample(t);
        if (!A.perf.pointOf || !B.perf.pointOf) return Infinity;
        const touching = [sA, sB].some(s => s.contacts && s.contacts.some(q => q.w > 0.5));
        const g = torsoGap(A, B, sA, sB, side);
        if (t <= lastT + 0.1 || [sA, sB].some(s => s.contacts && s.contacts.some(q => q.w > 0.99))) m = Math.min(m, g);   // while holding on; after a hit lets go the partner may fall anywhere
        if (touching) mc = Math.min(mc, g);
        if (touching) for (const X of [A, B]) { const s = contactSolve(X, t); for (const q of (s && s.contactErr) || []) if (q.w > 0.99 && !q.reachable) miss = Math.max(miss, q.err * s.scale); }
      }
      return { all: m, touch: isFinite(mc) ? mc : m, miss };
    }
    function playPair(A, B, c, wt, line) {
      if (!A.perf) A.perf = compileActor(A);
      const nA = A.events.length, nB = B.events.length;
      const sA = A.perf.sample(wt), sB = B.perf.sample(wt), bA = bodyOf(A, sA), bB = bodyOf(B, sB);
      const pd = pairDef(c.name), want = (pd.gap === undefined ? 0.5 : +pd.gap) * Math.min(bA.arm, bB.arm);
      let dist = bA.front + bB.front + want, end = wt;
      // the pair file's gap is the closest the torsos come during the action: play it, measure, correct
      // then: torsos never overlap; a hand that falls short brings the two closer while there is room
      const tol = 0.03 * Math.min(bA.k, bB.k);
      const tried = [];
      const replay = dd => { A.events.length = nA; B.events.length = nB; A.perf = compileActor(A); B.perf = compileActor(B); return placePair(A, B, c, wt, line, dd, bA, bB); };
      for (let i = 0; i < 6; i++) {
        const r = replay(dist);
        end = r.end;
        const m = clearance(A, B, r.t, r.end, r.side);
        if (!isFinite(m.touch)) break;
        tried.push({ dist, end, bad: (m.all < -tol ? 1e6 + -m.all : 0) + Math.max(0, m.miss - tol) });
        let d = 0;
        if (m.all < -tol) d = -m.all;
        else if (m.miss > tol && m.all > tol) d = -Math.min(m.miss, m.all);
        else if (Math.abs(want - m.touch) > tol && !(m.miss > tol && want > m.touch)) d = want - m.touch;
        if (Math.abs(d) < tol) break;
        dist += d;
      }
      // keep the best try: no overlap first, then the hands closest to their targets
      const best = tried.reduce((p, q) => q.bad < p.bad - 1e-6 ? q : p, tried[tried.length - 1] || { dist });
      if (tried.length && best !== tried[tried.length - 1]) end = replay(best.dist).end;
      // the release leaves them apart: if they would stand closer than a third of an arm, A steps back
      if (A.perf.pointOf && B.perf.pointOf) {
        const side = Math.sign(B.perf.sample(end).x - A.perf.sample(end).x) || 1, rest = Math.max(0.35 * Math.min(bA.arm, bB.arm), want);
        const g = torsoGap(A, B, A.perf.sample(end + 0.3), B.perf.sample(end + 0.3), side);
        if (isFinite(g) && g < rest - tol) {
          const prA = charOf(A.skin).proportions, Lpx = (prA.thigh + prA.shin) * bA.k;
          A.events.push({ t: end, action: 'stepback', args: { dist: Math.max(0.15, Math.min(1.5, (rest - g) / Lpx)) }, line });
          A.perf = compileActor(A); end = Math.max(end, lastEnd(A));
        }
      }
      return end;
    }
    // get A to x facing 'side': a walk when it is more than a leg length away, else a turn and one or two
    // small steps (forward or back), so a short adjustment does not cost a whole walk
    function approach(A, sA, tx, side, t, line) {
      const pr = charOf(A.skin).proportions, Lpx = (pr.thigh + pr.shin) * (sA.scale || A.env.scale), d = tx - sA.x;
      const hasStep = !!((typeof globalThis !== 'undefined' ? globalThis : {}).CharActions || {}).stepback;   // actions/stepback.js loaded (pages made by check.cjs always load it)
      if (Math.abs(d) > (hasStep ? 1.0 : 0.1) * Lpx) { A.events.push({ t, action: 'walk', args: { to: tx }, line }); A.perf = compileActor(A); t = lastEnd(A); }
      if ((A.perf.sample(t).facing || 1) !== side) { A.events.push({ t, action: 'turn', args: {}, line }); A.perf = compileActor(A); t = lastEnd(A); }
      const d2 = tx - A.perf.sample(t).x;
      if (hasStep && Math.abs(d2) > 0.06 * Lpx && Math.abs(d2) <= 1.05 * Lpx) { A.events.push({ t, action: 'stepback', args: { dist: -(d2 * side) / Lpx }, line }); A.perf = compileActor(A); t = lastEnd(A); }
      return t;
    }
    function placePair(A, B, c, wt, line, dist, bA, bB) {
      const sA = A.perf.sample(wt), sB = B.perf.sample(wt);
      const side = Math.sign(sB.x - sA.x) || sA.facing || 1;
      const tx = sB.x - side * dist;
      let t = approach(A, sA, tx, side, wt, line);
      if ((B.perf.sample(t).facing || 1) !== -side) { B.events.push({ t: Math.max(wt, t - 0.35), action: 'turn', args: {}, line }); B.perf = compileActor(B); t = Math.max(t, lastEnd(B)); }
      const xA = A.perf.sample(t).x, xB = B.perf.sample(t).x, apart = Math.abs(xB - xA);
      const extra = Object.assign({}, c.args); delete extra.with;
      extra.speed = pairSpeed(c); delete extra.for;
      const clampR = v => Math.max(0.2, Math.min(5, v));
      A.events.push({ t, action: c.name + '.a', args: Object.assign({}, extra, { with: B.name, apart: apart / bA.k, size: bB.height / bA.height, push: clampR(bB.mass / bA.mass) }), line });
      B.events.push({ t, action: c.name + '.b', args: Object.assign({}, extra, { with: A.name, apart: apart / bB.k, size: bA.height / bB.height, push: clampR(bA.mass / bB.mass) }), line });
      A.perf = compileActor(A); B.perf = compileActor(B);
      const end = Math.max(lastEnd(A), lastEnd(B));
      pairProps(A, B, Object.assign({ line }, c), t);
      return { t, side, end };
    }

    // ----- props in actions (docs/PROPS.md) -----
    const flights = [];   // { prop, t0, t1, A, B }: a thrown prop between a release and a catch
    const propDecl = n => n ? P.props.find(p => p.name === n) || null : null;
    const propDefOf = pd => pd ? (lib.props || {})[pd.kind] || null : null;
    const keyTime = (def, test) => { const k = (def && def.keys || []).find(test); return k ? +k.t : null; };
    // the moments a pair's roles hand over, throw or catch a prop: keys with give / take / release / catch
    // a giver or thrower who does not hold the prop yet picks it up first (from where it lies)
    function holding(A, pr, t) {
      let h = false;
      for (const e of A.events.slice().sort((p, q) => p.t - q.t)) if (e.t <= t + 1e-6) { if (e.action === 'hold') h = e.args.prop === pr; else if (e.action === 'drop') h = false; }
      return h;
    }
    function ensureHeld(A, c, wt, line) {
      const pdf = pairDef(c.name), pr = c.args.prop;
      if (!pr || !propDecl(pr) || !keyTime(pdf.a, k => k.give || k.release)) return wt;
      if (!A.perf) A.perf = compileActor(A);
      if (holding(A, pr, wt)) return wt;
      const e = playProp(A, { name: 'pickup', args: { prop: pr } }, wt, line);
      return e === null ? wt : e;
    }
    function pairProps(A, B, c, t) {
      const pdf = pairDef(c.name), pr = c.args.prop, pd = propDecl(pr);
      if (!pd) return;
      const tsA = 1 / pairSpeed(c), tsB = tsA;   // paired roles share one clock
      const tg = keyTime(pdf.a, k => k.give || k.release), tk = keyTime(pdf.b, k => k.take || k.catch);
      if (tg === null || tk === null) return;
      const def = propDefOf(pd), weight = def && def.weight || 0;
      A.events.push({ t: t + tg * tsA, action: 'drop', args: { quiet: 1 }, line: c.line });
      B.events.push({ t: t + tk * tsB, action: 'hold', args: { prop: pr, how: 'front', weight, quick: 1 }, line: c.line });   // taken from the hand: no reach, no jump
      if (keyTime(pdf.a, k => k.release) !== null) flights.push({ prop: pr, t0: t + tg * tsA, t1: t + tk * tsB, A, B });
      A.perf = compileActor(A); B.perf = compileActor(B);
    }
    // 'A: pickup(prop=box)' walks to the prop and takes it at the key marked grab (or the first that
    // reaches the ground); 'A: sit(on=chair)' sits on a seat prop; 'A: knock(on=door)' stands at the
    // action's wall distance from an upright prop. Returns the end time, or null when not a prop call.
    function playProp(A, c, wt, line) {
      const pd = propDecl(c.args.prop) || propDecl(c.args.on), def = propDefOf(pd);
      if (!pd || !def) return null;
      if (!A.perf) A.perf = compileActor(A);
      const g = typeof globalThis !== 'undefined' ? globalThis : {}, adef = (g.CharActions || {})[c.name] || null;
      const place = pd.at !== null ? placeOf(pd.at) : null;
      if (!place) return null;
      const s0 = A.perf.sample(wt), b = bodyOf(A, s0), Lpx = (charOf(A.skin).proportions.thigh + charOf(A.skin).proportions.shin) * b.k;
      const args = Object.assign({}, c.args); delete args.prop; delete args.on;
      let tx, face = 0;
      const side = Math.sign(place[0] - s0.x) || s0.facing || 1;
      if (c.name === 'sit' && def.seat) {   // the sitter's back to the chair's back (the chair faces +x)
        tx = place[0] + 0.12 * Lpx; face = 1;
        args.on = Math.max(1, (def.base ? def.base[1] : 0) - def.seat[1]);
      } else if (def.upright && adef && adef.wall !== undefined) tx = place[0] - side * (+adef.wall) * Lpx;
      else if (adef && c.args.prop) tx = place[0] - side * (b.front + 0.3 * b.arm);
      else return null;
      const n0 = A.events.length;
      let t, end;
      const go = () => {
        A.events.length = n0; A.perf = compileActor(A); t = approach(A, s0, tx, face || side, wt, line);
        A.events.push({ t, action: c.name, args, line }); A.perf = compileActor(A);
        end = lastEnd(A);
      };
      go();
      for (let i = 0; face && A.perf.pointOf && i < 3; i++) {   // seated: the hips land over the seat (measured, corrected)
        const hip = A.perf.pointOf(A.perf.sample(end + 0.5), 'hip'), dx = place[0] + (def.seat[0] || 0) - hip[0];
        if (Math.abs(dx) < 0.05 * b.k) break;
        tx += dx; go();
      }
      if (c.args.prop && adef) {
        const kg = keyTime(adef, k => k.grab) ?? keyTime(adef, k => [k.handNear, k.handFar].some(h => h === 'ground' || (Array.isArray(h) && h[0] === 'ground')));
        if (kg !== null) { A.events.push({ t: t + kg * (A.perf.timeScale || 1), action: 'hold', args: { prop: pd.name, how: 'front', weight: def.weight || 0 }, line }); A.perf = compileActor(A); }
      }
      return end;
    }

    // ----- resolve times with exact ends -----
    CharScript.timeline(P, st => {
      if (st.kind === 'actor') {
        const A = actorBy[st.target];
        if (!A) return [st.t];
        const wt = toWorld(st.t);
        const withB = c => { const B = c.args && actorBy[c.args.with]; if (!pairDef(c.name) || !B || B === A) return null; if (!B.perf) B.perf = compileActor(B); return B; };
        const propCall = c => !withB(c) && (propDecl(c.args && c.args.prop) || propDecl(c.args && c.args.on));
        if (st.calls.some(withB) || st.calls.some(propCall)) return st.calls.map(c => {
          const B = withB(c);
          if (B) return toReal(playPair(A, B, c, ensureHeld(A, c, wt, st.line), st.line));
          if (propCall(c)) { const e = playProp(A, c, wt, st.line); if (e !== null) return toReal(e); }
          A.events.push({ t: wt, action: c.name, args: Object.assign({}, c.args), line: st.line }); A.perf = compileActor(A);
          return toReal(lastEnd(A));
        });
        const first = A.events.length;
        for (const c of st.calls) A.events.push({ t: wt, action: c.name, args: Object.assign({}, c.args), line: st.line });
        A.perf = compileActor(A);
        return st.calls.map((c, i) => { try { const e = A.perf.end(A.order[first + i]); return isFinite(e) ? toReal(e) : st.t; } catch (e) { return st.t; } });
      }
      if (st.kind === 'puppet') return pupEnds(Object.assign({}, st, { t: toWorld(st.t) })).map(toReal);
      return CharScript.builtinEnds(st);
    });
    for (const U of puppets) if (U.pending) U.changes.push(U.pending);
    for (const A of actors) if (!A.perf) A.perf = compileActor(A);
    const duration = P.film.duration || Math.ceil((P.contentEnd || 0) + 1);

    const diagnostics = P.diagnostics.concat(libDiag);
    for (const A of actors) for (const d of (A.perf.diagnostics || [])) diagnostics.push(Object.assign({ severity: d.severity || 'warning' }, d, { message: `${A.name}: ${d.message}` }));
    if (Perf === Standin && actors.length) diagnostics.push({ code: 'standin', line: 0, severity: 'info', message: 'CharPerform is not loaded; actors use the stand-in performer (stand, walk, run, sneak, turn, hold, wave).' });

    // contacts (docs/PAIRS.md): after each body has done everything else (breath, springs, mood), a hand
    // that a key puts on a partner is moved onto that partner's landmark as the partner is drawn
    function contactSolve(A, w) {
      const s = A.perf.sample(w);
      if (!s || !s.contacts || !A.perf.reach) return s;
      if (A._cs && A._cs.w === w && A._cs.perf === A.perf) return A._cs.smp;
      const out = Object.assign({}, s, { pose: Object.assign({}, s.pose, { arms: { near: Object.assign({}, s.pose.arms.near), far: Object.assign({}, s.pose.arms.far) } }) });
      const order = s.contacts.slice().sort((p, q) => (p.at === 'hand' || p.at === 'arm') - (q.at === 'hand' || q.at === 'arm'));
      for (const c of order) {
        const B = actorBy[c.who];
        if (!B || !B.perf || !B.perf.pointOf) continue;
        const sB = B.perf.sample(w);
        let P, own = false;   // own: the point already carries this hand's offsets
        if (c.at === 'hand' || c.at === 'arm') {   // a hand meeting a hand: both go to the middle; else to the partner's hand as drawn
          const mutual = sB.contacts && sB.contacts.find(q => q.who === A.name && (q.at === 'hand' || q.at === 'arm'));
          if (mutual && c.at === 'hand' && mutual.at === 'hand') {   // hands meet halfway, at the shorter one's chest (plus both keys' offsets, averaged)
            const a = A.perf.pointOf(s, 'shoulder', c.side), b = B.perf.pointOf(sB, 'shoulder', mutual.side), kk = Math.min(s.scale, sB.scale);
            const fa = A.perf.pointOf(s, 'torso'), fb = B.perf.pointOf(sB, 'torso');   // halfway between the two fronts
            P = [(fa[0] + fb[0]) / 2, Math.max(a[1], b[1]) + 0.55 * kk - (c.dy * s.scale + mutual.dy * sB.scale) / 2]; own = true;
            // a point both arms reach, if there is one (alternate projections onto the two reach circles)
            const sa = A.perf.pointOf(s, 'shoulderJoint', c.side), sb = B.perf.pointOf(sB, 'shoulderJoint', mutual.side), ra = 0.95 * (A.perf.armReach || 1e9), rb = 0.95 * (B.perf.armReach || 1e9);
            for (let i = 0; i < 6; i++) for (const [o, r] of [[sa, ra], [sb, rb]]) { const d = Math.hypot(P[0] - o[0], P[1] - o[1]); if (d > r) P = [o[0] + (P[0] - o[0]) * r / d, o[1] + (P[1] - o[1]) * r / d]; }
          }
          else {
            const sB2 = mutual ? sB : contactSolve(B, w), act = sB2.contacts && sB2.contacts.find(q => q.who === A.name);
            P = B.perf.pointOf(sB2, c.at, act ? act.side : 'near');
          }
        } else if (c.at === 'front') {   // the partner's front (body or knee) at my own shoulder height: what a child reaches on a grown-up
          const sh = A.perf.pointOf(s, 'shoulderJoint', c.side), lb = B.perf.pointOf(sB, 'torsoLine');
          // the nearest point of the partner's front (torso line, knee) to my shoulder
          const cand = [B.perf.pointOf(sB, 'knee', 'near')];
          for (let i = 0; i + 1 < lb.length; i++) for (let u = 0; u <= 1; u += 0.25) cand.push([lb[i][0] + (lb[i + 1][0] - lb[i][0]) * u, lb[i][1] + (lb[i + 1][1] - lb[i][1]) * u]);
          P = cand.reduce((p, q) => Math.hypot(q[0] - sh[0], q[1] - sh[1]) < Math.hypot(p[0] - sh[0], p[1] - sh[1]) ? q : p);
        } else if (c.at === 'around') {   // round the partner's body at my own shoulder height (kept within their torso)
          const fl = B.perf.pointOf(sB, 'side', 'near'), lo = B.perf.pointOf(sB, 'waist', 'near')[1], hi = B.perf.pointOf(sB, 'shoulder', 'near')[1] + 0.1 * sB.scale;
          const my = A.perf.pointOf(s, 'shoulder', c.side)[1] + 0.65 * s.scale;
          P = [fl[0], Math.max(hi, Math.min(lo, my))];
          // as far round as this arm goes: a short arm stops on the partner's near side
          const sh = A.perf.pointOf(s, 'shoulderJoint', c.side), Rr = 0.95 * (A.perf.armReach || 1e9), dx = P[0] - sh[0], dy = P[1] - sh[1];
          if (Math.hypot(dx, dy) > Rr) P = Math.abs(dy) < Rr ? [sh[0] + Math.sign(dx) * Math.sqrt(Rr * Rr - dy * dy), P[1]] : [sh[0] + dx * Rr / Math.hypot(dx, dy), sh[1] + dy * Rr / Math.hypot(dx, dy)];
        } else P = B.perf.pointOf(sB, c.at, 'near');
        if (!P) continue;
        if (!own) P = [P[0] + s.facing * c.dx * s.scale, P[1] - c.dy * s.scale];
        const w0 = out.held && out.held.hand === c.side && Array.isArray(out.held.joint) ? A.perf.pointOf(out, 'hand', c.side) : null;
        if (c.side === 'near') out.pose = Object.assign({}, out.pose, { cane: null, caneTuck: Math.max(out.pose.caneTuck || 0, c.w) });   // a walking stick in a busy hand is tucked
        const ok = A.perf.reach(out, c.side, P, c.w);
        const wr = A.perf.pointOf(out, 'hand', c.side);
        (out.contactErr = out.contactErr || []).push({ side: c.side, at: c.at, w: c.w, reachable: ok, err: Math.hypot(wr[0] - P[0], wr[1] - P[1]) / s.scale });
        if (w0) { const w1 = A.perf.pointOf(out, 'hand', c.side); out.held = Object.assign({}, out.held, { joint: [out.held.joint[0] + w1[0] - w0[0], out.held.joint[1] + w1[1] - w0[1]] }); }
      }
      A._cs = { w, smp: out, perf: A.perf };
      return out;
    }
    // a prop with two grips (a box): the far hand goes to its far grip, wherever the near hand holds it
    function gripSolve(A, s) {
      if (!s || !s.held || !s.held.prop || !A.perf.reach || !Array.isArray(s.held.joint)) return s;
      const pd = P.props.find(p => p.name === s.held.prop), def = pd && (lib.props || {})[pd.kind];
      if (!def || !def.grips || !def.grips.far || !def.grips.near) return s;
      const f = s.facing || 1, hp = s.held.joint, g0 = def.grips.near, g1 = def.grips.far;
      const out = Object.assign({}, s, { pose: Object.assign({}, s.pose, { arms: { near: Object.assign({}, s.pose.arms.near), far: Object.assign({}, s.pose.arms.far) } }) });
      A.perf.reach(out, 'far', [hp[0] + f * (g1[0] - g0[0]), hp[1] + (g1[1] - g0[1])], 1);
      return out;
    }
    const sampleActor = (A, t) => gripSolve(A, contactSolve(A, toWorld(quant(A.name, t))));   // real time -> what is drawn
    const drawActor = (A, smp) => (A.P.draw || Standin.draw)(A.skin, smp);
    const handOf = (A, smp) => {
      if (A.P.hand) { const h = A.P.hand(A.skin, smp); if (h) return h; }
      if (smp.held && Array.isArray(smp.held.joint)) return smp.held.joint;   // CharPerform gives the grip point in stage px
      const j = jointsOf(A.skin, smp, A.env.scale, A.P.standin);
      if (!j) return [smp.x, smp.y - 100];
      const side = smp.held && /far/.test(smp.held.joint || '') ? 'far' : 'near';
      return j.hands[side];
    };

    // ----- props -----
    const props = P.props.map(pd => {
      const def = lib.props[pd.kind] || null;
      const holds = [];
      for (const A of actors) {
        let cur = null;
        for (const ev of A.events.slice().sort((a, b) => a.t - b.t)) {
          if (ev.action === 'hold') { if (cur) { cur.t1 = ev.t; cur = null; } if (ev.args.prop === pd.name) { cur = { A, t0: ev.t, t1: Infinity }; holds.push(cur); } }
          else if (ev.action === 'drop' && cur) { cur.t1 = ev.t; cur = null; }
        }
      }
      holds.sort((a, b) => a.t0 - b.t0);
      // the moment the performer's hand actually closes on it (after its reach), found once here
      for (const h of holds) {
        h.attach = Infinity;
        for (let t = h.t0; t < Math.min(h.t1, h.t0 + 4); t += 1 / 60) {
          const s = h.A.perf.sample(t);
          if (s.held && s.held.prop === pd.name) { h.attach = t; break; }
        }
      }
      return { name: pd.name, decl: pd, def, rest: pd.at !== null ? placeOf(pd.at) : null, holds };
    });
    // where the grip of a prop is while nobody holds it: its start place, or where it was dropped
    function looseAt(R, t) {   // t: world time
      const base = (R.def && R.def.base) || [0, 0];
      for (const f of flights) if (f.prop === R.name && t >= f.t0 && t <= f.t1 + 0.3) {   // thrown: an arc from hand to hand
        const p0 = handOf(f.A, sampleActor(f.A, toReal(f.t0))), p1 = handOf(f.B, sampleActor(f.B, toReal(f.t1)));
        const u = clamp((t - f.t0) / Math.max(0.05, f.t1 - f.t0), 0, 1), hgt = 0.25 * Math.abs(p1[0] - p0[0]) + 20;
        return [lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u) - 4 * hgt * u * (1 - u)];
      }
      let last = null;
      for (const hh of R.holds) if (hh.t1 <= t && hh.attach < hh.t1) last = hh;
      if (last) {   // dropped: falls from the hand to the ground under it
        const hp = handOf(last.A, last.A.perf.sample(last.t1 - 1e-3));
        const gy = ground(hp[0]) - base[1], u = clamp((t - last.t1) / 0.35, 0, 1);
        return [hp[0], lerp(hp[1], gy, u * u)];
      }
      return R.rest ? [R.rest[0], R.rest[1] - base[1]] : null;
    }
    function propState(R, t) {   // t: real time; holds are in world time
      const w = toWorld(t);
      let h = null;
      for (const hh of R.holds) if (hh.t0 <= w && w < hh.t1) h = hh;
      if (h && w >= h.attach) {
        const smp = sampleActor(h.A, t);
        let hp = handOf(h.A, smp), swing = 0;
        if (R.def && R.def.hang) {   // a hanging prop trails the hand: lagged horizontal velocity
          const a = handOf(h.A, sampleActor(h.A, Math.max(0, t - 0.16))), b = handOf(h.A, sampleActor(h.A, Math.max(0, t - 0.06)));
          swing = clamp(-(b[0] - a[0]) * 1.2, -28, 28) + 3 * Math.sin(t * 2.3);
        } else swing = (smp.held && smp.held.angle) || 0;   // degrees in stage space
        const u = (w - h.attach) / 0.2, from = u < 1 ? looseAt(R, h.attach) : null;
        if (from) { const e = smooth(u); hp = [lerp(from[0], hp[0], e), lerp(from[1], hp[1], e)]; swing *= e; }   // picked up, not teleported
        if (R.def && R.def.grips && R.def.grips.near) { const f = smp.facing || 1, g = R.def.grips.near; hp = [hp[0] - f * g[0], hp[1] - g[1]]; swing = 0; }   // two-handed: the near hand on its grip
        return { held: true, at: hp, swing };
      }
      const p = looseAt(R, w);
      return p ? { held: false, at: p, swing: 0 } : null;
    }

    // ----- camera -----
    const camSet = set.camera || {};
    const sc = actorScale / 68;
    const home = { x: camSet.x !== undefined ? camSet.x : FW / 2, focusY: camSet.focusY !== undefined ? camSet.focusY : null,
      lift: camSet.lift || [54 * sc, 192 * sc] };   // centre = ground - lift[0] - lift[1] / zoom
    const posMoves = [], zoomMoves = [], shakes = [], fades = [], frames = [];
    for (const st of P.tracks.cam || []) for (const c of st.calls) {
      if (c.name === 'pan') posMoves.push({ t: st.t, kind: 'pan', to: c.args.to, over: c.args.over });
      else if (c.name === 'follow') posMoves.push({ t: st.t, kind: 'follow', target: c.args.target, over: c.args.over });
      else if (c.name === 'cut') { posMoves.push({ t: st.t, kind: 'pan', to: c.args.to, over: 0 }); if (c.args.zoom) zoomMoves.push({ t: st.t, to: c.args.zoom, over: 0 }); }
      else if (c.name === 'zoom') zoomMoves.push({ t: st.t, to: Math.max(1, c.args.to), over: c.args.over });
      else if (c.name === 'shake') shakes.push({ t: st.t, amount: c.args.amount, over: c.args.over });
      else if (c.name === 'fade') fades.push({ t: st.t, to: c.args.dir === 'out' ? 1 : 0, over: c.args.over });
      else if (c.name === 'frame' || c.name === 'home') frames.push(Object.assign({ t: st.t, kind: c.name }, c.args));
    }
    // depth-aware zoom (set field dolly: true): the camera moves closer instead of magnifying, so a
    // layer of depth d < 1 grows by 1 / (1 - d (1 - 1/z)) (the sky hardly at all); d >= 1 and the
    // actors keep 1 + (z - 1) d (= z at d = 1). Without the field every layer grows by 1 + (z - 1) d.
    const dolly = !!(set.dolly || camSet.dolly);
    const layerZ = (z, d) => dolly && d < 1 ? 1 / Math.max(0.12, 1 - d * (1 - 1 / z)) : 1 + (z - 1) * d;
    // frame(on, top, bottom, x): a close-up that tracks an actor; home() goes back to the base camera
    const levelsOf = A => {
      const chA = charOf(A.skin), pr = chA.proportions, k = A.perf.scale || 1, R0 = dep('CharRig', './rig.js');
      // the real top of the drawing (a hat, a bun) rather than the head's nominal top
      const H0 = (A.perf.height || 3 * k) / k, Hh = H0 + (R0.headTopOf ? Math.max(0, R0.headTopOf(chA) - (chA.headTop || 1.04)) : 0);
      const kn = pr.ankleHeight + pr.shin, hip = kn + pr.thigh, nb = hip + pr.torso;
      return { k, H0, lv: { feet: 0, knee: kn, thigh: kn + 0.45 * pr.thigh, hip, waist: hip + 0.3 * pr.torso, chest: hip + 0.75 * pr.torso, chin: nb + pr.neck + 0.12 * pr.head, head: Hh } };
    };
    // two actors: both whole from the higher head top (plus hands raised over it) to the feet, side by side
    function frameTwo(m, t, names) {
      const box = [Infinity, Infinity, -Infinity, -Infinity];
      for (const n of names) {
        const A = actorBy[n];
        if (!A || !A.perf) return null;
        const { k, lv } = levelsOf(A), s = sampleActor(A, t), j = jointsOf(A.skin, s, A.env.scale, A.P.standin), reach = (A.perf.armReach || 1.2 * k);
        const pts = [[s.x - 0.5 * k, s.y - k * lv.head], [s.x + 0.5 * k, s.y]];
        if (j) for (const sd of ['near', 'far']) pts.push(j.hands[sd]);
        for (const p of pts) { box[0] = Math.min(box[0], p[0]); box[1] = Math.min(box[1], p[1]); box[2] = Math.max(box[2], p[0]); box[3] = Math.max(box[3], p[1]); }
        void reach;
      }
      const pad = 1 + Math.max(0.3, +m.pad || 0), w = (box[2] - box[0]) * pad, h = (box[3] - box[1]) * pad;   // at least 30% room round the two
      const z = Math.max(1, Math.min(FH / h, FW / w));
      return { x: (box[0] + box[2]) / 2, y: (box[1] + box[3]) / 2, z };
    }
    function frameView(m, t) {
      if (String(m.on).includes('+')) return frameTwo(m, t, String(m.on).split('+'));
      const A = actorBy[m.on];
      if (!A || !A.perf) return null;
      const { k, H0, lv } = levelsOf(A), smp = A.perf.sample(toWorld(t));
      const a = lv[m.top] !== undefined ? lv[m.top] : lv.head, b = lv[m.bottom] !== undefined ? lv[m.bottom] : lv.thigh;
      const hi = Math.max(a, b), lo = Math.min(a, b), z = Math.max(1, FH / (k * (hi - lo) * (1 + (m.pad === undefined ? 0.1 : Math.max(0, +m.pad))) + 1));
      // a close-up follows where the head really is (a stoop, a bow, a lean), not just the standing levels
      let hx = 0, hy = 0;
      if (!A.P.standin && smp.pose && smp.pose.root) {
        const R = dep('CharRig', './rig.js'), sol = R.solve(charOf(A.skin), smp.pose), J = sol.joints, ha = sol.angles.head, sq = smp.pose.squash || [1, 1];
        const hc = [J.headBase[0] - 0.5 * Math.sin(ha), J.headBase[1] + 0.5 * Math.cos(ha)];   // head centre, rig units
        const w = clamp(((hi + lo) / 2 - lv.hip) / Math.max(0.01, H0 - 0.5 - lv.hip), 0, 1);
        hx = smp.facing * k * sq[0] * hc[0] * w; hy = (-k * sq[1] * hc[1] + k * (H0 - 0.5)) * w;
      }
      return { x: smp.x + hx - ((+m.x || 0) * FW - FW / 2) / z, y: smp.y - k * (hi + lo) / 2 + hy, z };
    }
    const mixView = (p, q, u) => ({ x: lerp(p.x, q.x, u), y: lerp(p.y, q.y, u), z: Math.exp(lerp(Math.log(p.z), Math.log(q.z), u)) });
    function framedAt(i, t, base) {   // view if frames[i] were the last command, or null = base camera
      if (i < 0) return null;
      const m = frames[i], u = m.over > 0 ? ease((t - m.t) / m.over) : 1;
      const to = m.kind === 'frame' ? frameView(m, t) : null;
      if (u >= 1) return to;
      const from = framedAt(i - 1, t, base) || base;
      return mixView(from, to || base, u);
    }
    const thingX = (name, t) => {
      if (actorBy[name]) return actorBy[name].perf.sample(toWorld(t)).x;   // smooth: the camera does not snap to the beat
      if (pupBy[name]) return pupPos(pupBy[name], toWorld(t)).x;
      const p = placeOf(name);
      return p ? p[0] : null;
    };
    function tween(list, t, initial, valueOf) {   // sequential tweens; each starts from where the last one was
      let v = initial;
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (m.t > t) break;
        if (m.from === undefined) m.from = tween(list.slice(0, i), m.t, initial, valueOf);
        const target = valueOf ? valueOf(m, t) : m.to;
        const u = m.over > 0 ? (t - m.t) / m.over : 1;
        v = lerp(m.from, target === null ? m.from : target, ease(u));
      }
      return v;
    }
    const camX = t => tween(posMoves, t, home.x, (m, tt) => m.kind === 'follow' ? thingX(m.target, tt) : (typeof m.to === 'number' ? m.to : thingX(m.to, tt)));
    function camera(t) {
      const z = Math.max(1, tween(zoomMoves, t, 1));
      const want = camX(t);
      const hw = FW / 2 / z, hh = FH / 2 / z;
      // height: follows the ground under the camera. Zoom 1-2 keeps whole actors in frame with
      // the ground near the bottom; above that it frames the upper body (a close-up).
      let x = clamp(want, hw, W - hw);
      let y = clamp(home.focusY !== null ? home.focusY : ground(x) - home.lift[0] - home.lift[1] / z, hh, H - hh);
      let zz = z;
      if (frames.length) {
        let i = -1;
        for (let j = 0; j < frames.length; j++) if (frames[j].t <= t) i = j;
        const f = framedAt(i, t, { x, y, z });
        if (f) { zz = Math.max(1, f.z); x = clamp(f.x, FW / 2 / zz, W - FW / 2 / zz); y = clamp(f.y, FH / 2 / zz, H - FH / 2 / zz); }
      }
      let sx = 0, sy = 0;
      for (const sk of shakes) if (t >= sk.t && t < sk.t + sk.over) {
        const a = sk.amount * Math.pow(1 - (t - sk.t) / sk.over, 2);
        sx += a * (0.6 * Math.sin(t * 47.3) + 0.4 * Math.sin(t * 83.1 + 1.3));
        sy += a * (0.6 * Math.sin(t * 53.9 + 0.7) + 0.4 * Math.sin(t * 71.7 + 2.1));
      }
      return { x, y, z: zz, sx, sy, want, clamped: !frames.length && Math.abs(want - x) > 2 ? want - x : 0 };
    }
    const fadeAt = t => clamp(tween(fades, t, 0), 0, 1);
    function toScreen(p, cam, depth) {
      const d = depth === undefined ? 1 : depth, zd = layerZ(cam.z, d);
      const cx = FW / 2 + (cam.x - FW / 2) * d, cy = FH / 2 + (cam.y - FH / 2) * d;
      return [(p[0] - cx) * zd + FW / 2 + cam.sx, (p[1] - cy) * zd + FH / 2 + cam.sy];
    }
    function layerTransform(cam, d) {
      const zd = layerZ(cam.z, d), cx = FW / 2 + (cam.x - FW / 2) * d, cy = FH / 2 + (cam.y - FH / 2) * d;
      return `translate(${fx(FW / 2 + cam.sx)} ${fx(FH / 2 + cam.sy)}) scale(${fx(zd * 1000) / 1000}) translate(${fx(-cx)} ${fx(-cy)})`;
    }

    // ----- captions and cards -----
    const caps = [], cards = [];
    for (const st of P.tracks.caption || []) for (const c of st.calls) caps.push({ t: st.t, line: st.line, name: c.name, args: c.args });
    for (const st of P.tracks.card || []) for (const c of st.calls) cards.push({ t: st.t, args: c.args });
    function activeCaptions(t) {
      const slots = {};
      for (let i = 0; i < caps.length; i++) {
        const c = caps[i];
        if (c.t > t) continue;
        if (c.name === 'clear') { for (const k of Object.keys(slots)) if (slots[k].t1 > c.t) slots[k].t1 = c.t; continue; }
        const slot = c.args.by ? 'by:' + c.args.by : c.args.at;
        slots[slot] = { c, t0: c.t, t1: c.t + c.args.for };   // a new caption in the same place replaces the old one
      }
      return Object.values(slots).filter(s => t < s.t1).map(s => Object.assign({}, s, { a: Math.min(smooth((t - s.t0) / 0.2), smooth((s.t1 - t) / 0.25)) }));
    }

    const staticCache = {};
    const layers = (set.layers || []).slice().sort((a, b) => a.depth - b.depth);
    // contacts: every moment a foot touches down on or lifts off the ground, in world time, found
    // once by sampling (sets use them for ripples and splashes). { t, x, y, kind: down|up, speed px/s, air (s in the air before a touch-down), actor, facing }
    let contactCache = null;
    function contacts() {
      if (contactCache) return contactCache;
      const out = [], dt = 1 / 60, wEnd = toWorld(duration);
      for (const A of actors) {
        const prev = {};
        for (let i = 0; i * dt <= wEnd + 1e-9; i++) {
          const w = i * dt, smp = A.perf.sample(w), j = jointsOf(A.skin, smp, A.env.scale, A.P.standin);
          if (!j) continue;
          for (const side of ['near', 'far']) {
            const f = j.feet[side], mx = (f.heel[0] + f.toe[0]) / 2, h = ground(mx) - f.low;
            const p = prev[side] || (prev[side] = { h, on: h <= 1.5 });
            const v = (p.h - h) / dt;   // + = moving down
            if (!p.on && h <= 1.5) { p.on = true; out.push({ t: w, x: mx, y: ground(mx), kind: 'down', speed: Math.max(0, v, p.vd || 0), air: w - (p.up || 0), actor: A.name, facing: smp.facing }); }
            else if (p.on && h > 3) { p.on = false; p.up = w; out.push({ t: w, x: mx, y: ground(mx), kind: 'up', speed: Math.max(0, -v), actor: A.name, facing: smp.facing }); }
            p.vd = Math.max(0, v); p.h = h;
          }
        }
      }
      contactCache = out.sort((a, b) => a.t - b.t);
      return contactCache;
    }
    // ctx.t is real time (skies keep moving through a freeze); ctx.wt is world time (water, splashes)
    const ctxOf = t => ({ t, wt: toWorld(t), W, H, pal, ground, anchors, variant: variantName, contacts });

    function drawCaption(s, cam) {
      const { c, a } = s;
      if (a <= 0.01) return '';
      if (c.args.by) {
        let head = null;
        if (actorBy[c.args.by]) {
          const A = actorBy[c.args.by], smp = sampleActor(A, s.tNow);
          const j = jointsOf(A.skin, smp, A.env.scale, A.P.standin);
          head = smp.height ? [j ? j.head[0] : smp.x, smp.y - smp.height] : (j ? j.head : [smp.x, smp.y - 3.4 * A.env.scale]);
        } else if (pupBy[c.args.by]) {
          const U = pupBy[c.args.by], p = pupPos(U, toWorld(s.tNow)), h = ((U.def && U.def.height) || 40) * U.scale;
          head = [p.x, p.y - h];
        }
        if (!head) return '';
        const hp = toScreen(head, cam);
        const size = 26, wr = wrap(c.args.text, size, 380), bw = wr.width + 36, bh = wr.lines.length * size * 1.25 + 22;
        const bx = clamp(hp[0] - bw / 2 + 30, 12, FW - bw - 12), by = clamp(hp[1] - bh - 34, 12, FH - bh - 60);
        const tx = clamp(hp[0], bx + 18, bx + bw - 18);
        let o = `<g opacity="${fx(a)}"><path d="M${fx(tx - 12)} ${fx(by + bh - 2)} L${fx(tx + 4)} ${fx(Math.min(hp[1] - 8, by + bh + 26))} L${fx(tx + 12)} ${fx(by + bh - 2)} Z" fill="#fffdf6" stroke="#2b2622" stroke-width="3" stroke-linejoin="round"/>`;
        o += `<rect x="${fx(bx)}" y="${fx(by)}" width="${fx(bw)}" height="${fx(bh)}" rx="18" fill="#fffdf6" stroke="#2b2622" stroke-width="3"/>`;
        o += `<rect x="${fx(tx - 10)}" y="${fx(by + bh - 4)}" width="20" height="5" fill="#fffdf6"/>`;
        wr.lines.forEach((l, i) => { o += `<text x="${fx(bx + bw / 2)}" y="${fx(by + 11 + size * 0.95 + i * size * 1.25)}" font-family="${FONT}" font-size="${size}" font-weight="700" fill="#2b2622" text-anchor="middle">${esc(l)}</text>`; });
        return o + '</g>';
      }
      const size = 34, wr = wrap(c.args.text, size, 1040), bw = wr.width + 56, lh = size * 1.28, bh = wr.lines.length * lh + 26;
      const by = c.args.at === 'top' ? 34 : FH - 44 - bh, bx = (FW - bw) / 2;
      let o = `<g opacity="${fx(a)}"><rect x="${fx(bx)}" y="${fx(by)}" width="${fx(bw)}" height="${fx(bh)}" rx="14" fill="#120f1a" fill-opacity="0.66"/>`;
      wr.lines.forEach((l, i) => { o += `<text x="${FW / 2}" y="${fx(by + 13 + size * 0.92 + i * lh)}" font-family="${FONT}" font-size="${size}" font-weight="700" fill="#fffaf0" stroke="#120f1a" stroke-width="5" stroke-opacity="0.55" paint-order="stroke" text-anchor="middle">${esc(l)}</text>`; });
      return o + '</g>';
    }
    function drawCard(t) {
      let o = '';
      for (const cd of cards) {
        if (t < cd.t || (cd.args.for && t >= cd.t + cd.args.for)) continue;
        const fd = cd.args.fade === undefined ? 0.7 : Math.max(0.01, +cd.args.fade), bg = cd.args.bg || '';
        const a = Math.min(smooth((t - cd.t) / fd), cd.args.for ? smooth((cd.t + cd.args.for - t) / Math.min(0.5, fd)) : 1);
        const size = 54, wr = wrap(cd.args.text, size, 980), lh = size * 1.3;
        const sub = cd.args.sub ? wrap(cd.args.sub, 28, 900) : null;
        const total = wr.lines.length * lh + (sub ? 30 + sub.lines.length * 36 : 0);
        let y = FH / 2 - total / 2 + size * 0.8;
        o += `<g opacity="${fx(a)}">` + (bg === 'none' ? '' : `<rect x="-10" y="-10" width="${FW + 20}" height="${FH + 20}" fill="${bg ? esc(bg) : 'url(#cardbg)'}"/>`);
        o += `<rect x="${FW / 2 - 60}" y="${fx(FH / 2 - total / 2 - 46)}" width="120" height="3" rx="1.5" fill="#e9c46a" opacity="0.85"/>`;
        const ta = smooth((t - cd.t - 0.36 * fd) / (1.14 * fd)), dy = (1 - ta) * 14;
        for (const l of wr.lines) { o += `<text x="${FW / 2}" y="${fx(y + dy)}" opacity="${fx(ta)}" font-family="${SERIF}" font-size="${size}" font-style="italic" fill="#fbf4e4" text-anchor="middle">${esc(l)}</text>`; y += lh; }
        if (sub) { y += 18; for (const l of sub.lines) { o += `<text x="${FW / 2}" y="${fx(y)}" opacity="${fx(ta)}" font-family="${FONT}" font-size="28" fill="#cbbfa8" text-anchor="middle" letter-spacing="2">${esc(l)}</text>`; y += 36; } }
        o += '</g>';
      }
      return o;
    }

    function drawPuppet(U, t) {
      if (!U.def) return '';
      t = toWorld(t);
      const pos = pupPos(U, t);
      let f = U.facing0;
      let last = null;
      for (const m of U.moves) if (m.t0 <= t && m.to[0] !== m.from[0]) last = m;
      // facing: the direction of the latest move, flipped by any later turn
      const evs = [];
      for (const m of U.moves) if (m.to[0] !== m.from[0]) evs.push({ t: m.t0, f: Math.sign(m.to[0] - m.from[0]) });
      for (const tr of U.turns) evs.push({ t: tr.t, flip: true });
      evs.sort((a, b) => a.t - b.t);
      for (const e of evs) if (e.t <= t) f = e.flip ? -f : e.f;
      let ci = 0;
      for (let i = 0; i < U.changes.length; i++) if (U.changes[i].t <= t) ci = i;
      const cur = U.changes[ci], since = t - Math.max(0, cur.t);
      const def = U.def, BL = def.blend || 0.25;
      let body;
      if (def.pose && def.render) {
        let prm = def.pose(cur.state, since, t, pos);
        if (ci > 0 && since < BL) {
          const prev = U.changes[ci - 1];
          const pp = def.pose(prev.state, t - Math.max(0, prev.t), t, pos);
          prm = lerpObj(pp, prm, smooth(since / BL));
        }
        body = def.render(prm, t);
      } else body = def.draw(t, cur.state, since);
      const sc = U.scale;
      return `<g transform="translate(${fx(pos.x)} ${fx(pos.y)}) scale(${fx(f * sc)} ${fx(sc)})">${body}</g>`;
    }
    function drawProp(R, t, glows) {
      if (!R.def) return '';
      const st = propState(R, t);
      if (!st) return '';
      const tr = st.at, ang = st.swing;
      const body = R.def.draw(t, { held: !!st.held, swing: ang });
      if (R.def.glow) {
        const g = R.def.glow, a = ang * Math.PI / 180, gx = g.at[0] * Math.cos(a) - g.at[1] * Math.sin(a), gy = g.at[0] * Math.sin(a) + g.at[1] * Math.cos(a);
        const fl = 1 + 0.06 * Math.sin(t * 9.1) + 0.04 * Math.sin(t * 23.7 + 1.1);
        const k = pal.glow === undefined ? 1 : pal.glow;   // sets dim lights in daylight
        glows.push({ p: [tr[0] + gx, tr[1] + gy], r: g.r * fl * (0.6 + 0.4 * Math.min(1, k)), color: g.color, strength: (g.strength || 0.8) * k });
      }
      return `<g transform="translate(${fx(tr[0])} ${fx(tr[1])}) rotate(${fx(ang)})">${body}</g>`;
    }

    const CharRig0 = () => dep('CharRig', './rig.js');
    function frame(tIn) {
      const t = clamp(+tIn || 0, 0, duration);
      const cam = camera(t), ctx = ctxOf(t);
      const parts = [];
      parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FW} ${FH}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block;background:${set.bare ? 'transparent' : '#000'}">`);
      parts.push(`<defs><linearGradient id="cardbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1828"/><stop offset="1" stop-color="#0d0b12"/></linearGradient>`);
      if (set.defs) parts.push(set.defs(ctx));
      parts.push(`</defs><clipPath id="frameclip"><rect width="${FW}" height="${FH}"/></clipPath><g clip-path="url(#frameclip)">`);
      const layerSvg = L => {
        if (L.static) { const k = (L.name || layers.indexOf(L)) + '|' + variantName; if (!(k in staticCache)) staticCache[k] = L.draw(ctx); return staticCache[k]; }
        return L.draw(ctx);
      };
      for (const L of layers) if (!L.front && !L.pass) parts.push(`<g transform="${layerTransform(cam, L.depth)}">${layerSvg(L)}</g>`);
      const smps = new Map();
      for (const A of actors) smps.set(A, sampleActor(A, t));
      // reflections: set.reflect = { opacity, color, level (water y; default the ground under the actor), filter }
      if (set.reflect) {
        const R = set.reflect, ref = [];
        for (const A of actors) {
          const smp = smps.get(A);
          if (smp.offstage) continue;
          const yw = typeof R.level === 'number' ? R.level : ground(smp.x);
          if (!A.reflSkin) A.reflSkin = Object.assign({}, A.skin, { silhouette: R.color || set.silhouette || '#000' });
          ref.push(`<g transform="translate(0 ${fx(2 * yw)}) scale(1 -1) translate(${fx(smp.x)} ${fx(smp.y)})">${drawActor(Object.assign({}, A, { skin: A.reflSkin }), smp)}</g>`);
        }
        parts.push(`<g transform="${layerTransform(cam, 1)}"><g opacity="${R.opacity === undefined ? 0.5 : R.opacity}"${R.filter ? ` filter="${R.filter}"` : ''}>${ref.join('')}</g></g>`);
      }
      // layers with pass: 'water' lie over the reflections and under the actors (ripples, glitter)
      for (const L of layers) if (!L.front && L.pass === 'water') parts.push(`<g transform="${layerTransform(cam, L.depth)}">${layerSvg(L)}</g>`);
      // world: resting props, then actors and puppets in the order they were declared
      const glows = [];
      const world = [];
      const items = actors.map(A => ({ line: A.decl.line, A })).concat(puppets.map(U => ({ line: U.decl.line, U }))).sort((a, b) => a.line - b.line);
      const heldNow = {};
      for (const R of props) { const st = propState(R, t); if (st && st.held) heldNow[R.name] = 1; else world.push(drawProp(R, t, glows)); }
      // actors in contact are drawn together in three passes: their far arms, their bodies, their near
      // arms, so an arm round a partner's back goes behind the partner and the near arm over them
      const groupOf = new Map();
      for (const A of actors) { const s = smps.get(A); if (s.contacts) for (const c of s.contacts) { const B = actorBy[c.who]; if (B && c.w > 0.02) { const g = groupOf.get(A) || groupOf.get(B) || new Set(); g.add(A); g.add(B); groupOf.set(A, g); groupOf.set(B, g); } } }
      const drawnG = new Set();
      const LBODY = CharRig0().LAYERS ? CharRig0().LAYERS.filter(l => l !== 'arm.far' && l !== 'arm.near') : null;
      for (const it of items) {
        if (it.U) { world.push(drawPuppet(it.U, t)); continue; }
        const A = it.A, smp = smps.get(A), g = groupOf.get(A);
        if (g && LBODY) {
          if (drawnG.has(g)) continue;
          drawnG.add(g);
          const mem = items.filter(q => q.A && g.has(q.A)).map(q => q.A);
          const put = (M, pass) => { const s = smps.get(M); world.push(`<g transform="translate(${fx(s.x)} ${fx(s.y)})">${drawActor(M, Object.assign({}, s, { _layers: pass }))}</g>`); };
          const byH = mem.slice().sort((p, q) => (smps.get(q).height || 0) - (smps.get(p).height || 0));
          for (const M of mem) put(M, ['arm.far']);
          const wraps = (smps.get(byH[0]).contacts || []).some(q => q.side === 'near' && /around|back|waist|side/.test(q.at));
          if (byH.length === 2 && wraps && (smps.get(byH[1]).height || 0) < 0.6 * (smps.get(byH[0]).height || 1)) {
            // a grown-up with a child: the grown-up's near arm goes behind the child's head and shows on its back
            put(byH[0], LBODY); put(byH[0], ['arm.near']); put(byH[1], LBODY); put(byH[1], ['arm.near']);
          } else { for (const M of mem) put(M, LBODY); for (const M of mem) put(M, ['arm.near']); }
          for (const M of mem) { const s = smps.get(M); for (const R of props) if (heldNow[R.name] && s.held && s.held.prop === R.name) world.push(drawProp(R, t, glows)); }
          continue;
        }
        world.push(`<g transform="translate(${fx(smp.x)} ${fx(smp.y)})">${drawActor(A, smp)}</g>`);
        for (const R of props) if (heldNow[R.name] && smp.held && smp.held.prop === R.name) world.push(drawProp(R, t, glows));
      }
      parts.push(`<g transform="${layerTransform(cam, 1)}">${world.join('')}</g>`);
      for (const L of layers) if (L.front) parts.push(`<g transform="${layerTransform(cam, L.depth)}">${layerSvg(L)}</g>`);
      if (set.overlay) parts.push(set.overlay(ctx));
      if (glows.length) {
        parts.push(`<g transform="${layerTransform(cam, 1)}" style="mix-blend-mode:screen">`);
        glows.forEach((g, i) => {
          parts.push(`<radialGradient id="glow${i}"><stop offset="0" stop-color="${g.color}" stop-opacity="0.95"/><stop offset="0.18" stop-color="${g.color}" stop-opacity="0.55"/><stop offset="0.5" stop-color="${g.color}" stop-opacity="0.18"/><stop offset="1" stop-color="${g.color}" stop-opacity="0"/></radialGradient>`);
          parts.push(`<circle cx="${fx(g.p[0])}" cy="${fx(g.p[1])}" r="${fx(g.r)}" fill="url(#glow${i})" opacity="${fx(g.strength)}"/>`);
        });
        parts.push('</g>');
      }
      for (const s of activeCaptions(t)) { s.tNow = t; parts.push(drawCaption(s, cam)); }
      parts.push(drawCard(t));
      const fa = fadeAt(t);
      if (fa > 0.001) parts.push(`<rect x="-10" y="-10" width="${FW + 20}" height="${FH + 20}" fill="#000" opacity="${fx(fa)}"/>`);
      parts.push('</g></svg>');
      return parts.join('');
    }

    return {
      duration, diagnostics, set, W, H, ground, anchors, camera, toScreen, frame, standin: Perf === Standin,
      actors: actors.map(A => ({
        name: A.name, decl: A.decl, events: A.sorted || [], perf: A.perf, scale: A.env.scale, skin: A.skin,   // events sorted as the performer saw them
        sample: t => sampleActor(A, t),
        joints: t => jointsOf(A.skin, sampleActor(A, t), A.env.scale, A.P.standin),
      })),
      puppets: puppets.map(U => ({ name: U.name, pos: t => pupPos(U, toWorld(t)), def: U.def })),
      toWorld, toReal, contacts,
      statements: P.statements,
    };
  }

  function mount(el, parsed, lib) {
    const film = compile(parsed, lib);
    return {
      film, duration: film.duration, diagnostics: film.diagnostics,
      seek(t) { el.innerHTML = film.frame(t); },
    };
  }

  // Char.mount(element, { script, skins, width, height }) -> { duration, seek(t), destroy() }
  // For host pages: draws only the characters on a transparent layer (a bare stage unless the script has a set line).
  G.Char = {
    mount(el, o) {
      o = o || {};
      const film = compile(CharScript.parse(o.script || ''), o.skins ? { skins: o.skins } : undefined);
      if (o.width) el.style.width = typeof o.width === 'number' ? o.width + 'px' : o.width;
      if (o.height) el.style.height = typeof o.height === 'number' ? o.height + 'px' : o.height;
      return { duration: film.duration, diagnostics: film.diagnostics, film, seek(t) { el.innerHTML = film.frame(t); }, destroy() { el.innerHTML = ''; } };
    },
  };

  return { compile, mount, Standin, jointsOf, charOf, lerpObj, blinkAt };
});
