// Check a film folder and build its index.html.
// Usage: node tools/check.cjs <film dir> [--timeline] [--standin]
//   Prints script diagnostics and motion problems, each with the line to change and what to write.
//   --timeline also prints every statement with its resolved start and end time.
//   Exit code 1 when there is any error.
// Also exports { ROOT, loadEngine, build } for tools/sheet.cjs, tools/render.cjs and the tests.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const KINDS = ['skins', 'sets', 'puppets', 'props', 'actions'];
const kindDir = (k) => k === 'skins' || k === 'actions' ? path.join(ROOT, k) : path.join(ROOT, 'extras', k);   // sets, puppets, props live in extras/

// Load the engine and every library file into this Node process (the same UMD files the page uses).
function loadEngine(filmDir) {
  if (globalThis.__charEngine) return globalThis.__charEngine;
  globalThis.self = globalThis;
  const errors = [];
  const run = file => {
    // hide module/exports/require so every UMD file takes its browser branch and registers a global
    try { vm.runInThisContext('(function (module, exports, require) {' + fs.readFileSync(file, 'utf8') + '\n})', { filename: file }).call(globalThis); }
    catch (e) { errors.push({ file: path.relative(process.cwd(), file), message: e.message }); }
  };
  for (const f of ['rig.js', 'gait.js', 'poses.js', 'clips.js', 'speech.js', 'perform.js']) if (fs.existsSync(path.join(ROOT, 'src', f))) run(path.join(ROOT, 'src', f));
  for (const kind of KINDS) for (const dir of [kindDir(kind), filmDir && path.join(filmDir, kind)]) {
    if (!dir || !fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()) run(path.join(dir, f));
  }
  run(path.join(ROOT, 'src', 'script.js'));
  run(path.join(ROOT, 'src', 'stage.js'));
  const G = globalThis;
  const eng = { CharScript: G.CharScript, CharStage: G.CharStage, lib: { skins: G.CharSkins || {}, sets: G.CharSets || {}, puppets: G.CharPuppets || {}, props: G.CharProps || {} }, errors };
  G.__charEngine = eng;
  return eng;
}

// Find the file for a library item: the film's own folder first, then the shared one.
function libFile(filmDir, kind, name) {
  for (const dir of [path.join(filmDir, kind), kindDir(kind)]) {
    const f = path.join(dir, name + '.js');
    if (fs.existsSync(f)) return f;
  }
  return null;
}

// Write <film>/index.html from film.html with the script text and exactly the library files it uses.
function build(filmDir) {
  filmDir = path.resolve(filmDir);
  const scriptFile = path.join(filmDir, 'film.char');
  if (!fs.existsSync(scriptFile)) throw Error(`no film.char in ${filmDir}. A film is a folder with a film.char script.`);
  const text = fs.readFileSync(scriptFile, 'utf8');
  const { CharScript } = loadEngine(filmDir);
  const P = CharScript.parse(text);
  const files = [];
  for (const f of ['rig.js', 'gait.js', 'poses.js', 'clips.js', 'speech.js', 'perform.js']) if (fs.existsSync(path.join(ROOT, 'src', f))) files.push(path.join(ROOT, 'src', f));
  const want = { skins: [], sets: P.sets.map(s => s.name), puppets: P.puppets.map(p => p.kind), props: P.props.map(p => p.kind),
    // action files the script calls, plus the ones the stage adds itself (a step to close a gap, picking up a prop)
    actions: ['stepback', 'pickup'].concat(...P.statements.filter(st => st.kind === 'actor').map(st => st.calls.map(c => c.name))) };
  const skins = loadEngine(filmDir).lib.skins;
  const addSkin = n => { if (skins[n] && skins[n].extends && skins[n].extends !== n) addSkin(skins[n].extends); want.skins.push(n); };   // base skins load first
  for (const a of P.actors) addSkin(a.skin);
  for (const kind of KINDS) for (const name of new Set(want[kind])) { const f = libFile(filmDir, kind, name); if (f) files.push(f); }
  files.push(path.join(ROOT, 'src', 'script.js'), path.join(ROOT, 'src', 'stage.js'));
  const rel = f => path.relative(filmDir, f).split(path.sep).join('/');
  // speech tracks named by say(track="lines/x.json"): read from the film folder and embedded in the page
  const tracks = {};
  for (const st of P.statements) if (st.kind === 'actor') for (const c of st.calls) if (c.name === 'say' && c.args.track) {
    try { tracks[c.args.track] = JSON.parse(fs.readFileSync(path.join(filmDir, String(c.args.track)), 'utf8')); } catch (e) { /* the performer falls back to the text */ }
  }
  globalThis.CharTracks = Object.assign(globalThis.CharTracks || {}, tracks);
  const tpl = fs.readFileSync(path.join(ROOT, 'film.html'), 'utf8');
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = tpl
    .replace('<title>__TITLE__</title>', `<title>${esc(P.film.title || path.basename(filmDir))}</title>`)
    .replace('<script type="text/plain" id="film-script">__SCRIPT__</script>', () => `<script type="text/plain" id="film-script">${text.replace(/<\/script/gi, '<\\/script')}</script>`)
    .replace('<!-- LIBS -->', () => `<script>window.CharTracks = ${JSON.stringify(tracks).replace(/</g, '\\u003c')};</script>\n` + files.map(f => `<script src="${rel(f)}"></script>`).join('\n'));
  const out = path.join(filmDir, 'index.html');
  fs.writeFileSync(out, html);
  return { out, text, parsed: P };
}

// ---------------- checks ----------------
// the partner a pair line names (A: hug(with=B) occupies B too), or null
const withOf = s => { if (s.kind !== 'actor') return null; const c = (s.calls || []).find(q => q.args && typeof q.args.with === 'string' && q.args.with); return c ? c.args.with : null; };
function check(filmDir, opts) {
  opts = opts || {};
  const b = build(filmDir);
  const eng = loadEngine(filmDir);
  const film = eng.CharStage.compile(eng.CharScript.parse(b.text), eng.lib, { standin: opts.standin });
  const out = [];   // { sev, line, t, msg }
  for (const e of eng.errors) out.push({ sev: 'error', line: 0, msg: `${e.file} fails to load: ${e.message}` });
  for (const d of film.diagnostics) {
    if ((d.code === 'standin' || d.code === 'no-set') && d.severity === 'info') continue;
    out.push({ sev: d.severity || 'error', line: d.line || 0, msg: d.message, code: d.code });
  }
  const fps = 24, N = Math.round(film.duration * fps);
  const lineAt = (name, t) => { let l = null; for (const s of film.statements) if (s.target === name && s.t <= t + 1e-6) l = s; return l; };
  const cardFrom = (() => { let c = Infinity; for (const s of film.statements) if (s.kind === 'card' && !s.calls[0].args.for) c = Math.min(c, s.t); return c; })();
  const fmtT = t => t.toFixed(1) + 's';
  const callStr = s => s ? `line ${s.line} (${s.target}: ${s.calls.map(c => c.name).join(', ')})` : 'its start position';

  // group per-frame flags into time ranges
  function ranges(flags, minLen) {
    const r = []; let s = -1, worst = 0;
    for (let i = 0; i <= flags.length; i++) {
      const v = i < flags.length ? flags[i] : 0;
      if (v && s < 0) { s = i; worst = 0; }
      if (v) worst = Math.max(worst, v);
      if (!v && s >= 0) { if ((i - s) / fps >= (minLen || 0)) r.push({ t0: s / fps, t1: (i - 1) / fps, worst }); s = -1; }
    }
    return r;
  }

  for (const A of film.actors) {
    const sink = [], float = [], slide = [], off = [];
    let prev = null, prevFacing = 0;
    const jumpsAt = t => A.events.some((e, i) => e.action === 'jump' && t >= e.t && t <= A.perf.end(i));
    for (let i = 0; i <= N; i++) {
      const t = i / fps;
      const smp = A.sample(t), j = A.joints(t);
      const cam = film.camera(t), sx = film.toScreen([smp.x, smp.y], cam)[0];
      off.push(t < cardFrom && (sx < -30 || sx > 1310) ? 1 : 0);
      if (!j) { sink.push(0); float.push(0); slide.push(0); continue; }
      let sk = 0, gap = Infinity;
      for (const side of ['near', 'far']) {
        const f = j.feet[side], mx = (f.heel[0] + f.toe[0]) / 2, gy = film.ground(mx);
        sk = Math.max(sk, f.low - gy);
        gap = Math.min(gap, gy - f.low);
      }
      sink.push(sk > 4 ? sk : 0);
      float.push(gap > 6 && !jumpsAt(t) && !smp.airborne ? gap : 0);   // a jump, or any action's declared air time
      let sl = 0;
      // turning round swaps heel and toe of a planted foot in side view: compare the ankle then
      const turned = prev && prevFacing !== smp.facing;
      if (prev) for (const side of ['near', 'far']) for (const k of (turned ? ['ankle'] : ['heel', 'toe'])) {
        const a = k === 'ankle' ? [prev.feet[side].ankle[0], prev.feet[side].heel[1]] : prev.feet[side][k];
        const c = k === 'ankle' ? [j.feet[side].ankle[0], j.feet[side].heel[1]] : j.feet[side][k];
        const onA = Math.abs(a[1] - film.ground(a[0])) < 1.5, onC = Math.abs(c[1] - film.ground(c[0])) < 1.5;   // planted = within 1.5 px
        if (onA && onC) sl = Math.max(sl, Math.abs(c[0] - a[0]));
      }
      slide.push(sl > 2.5 ? sl : 0);
      prev = j; prevFacing = smp.facing;
    }
    for (const r of ranges(sink, 0)) out.push({ sev: 'error', line: (lineAt(A.name, r.t0) || A.decl).line, t: r.t0, msg: `${A.name}'s feet are up to ${r.worst.toFixed(0)}px under the ground from ${fmtT(r.t0)} to ${fmtT(r.t1)}, during ${callStr(lineAt(A.name, r.t0))}. This is an engine problem if the line is plain; otherwise move the actor to flatter ground (another x or anchor).` });
    for (const r of ranges(float, 0.25)) out.push({ sev: 'error', line: (lineAt(A.name, r.t0) || A.decl).line, t: r.t0, msg: `${A.name} floats up to ${r.worst.toFixed(0)}px above the ground from ${fmtT(r.t0)} to ${fmtT(r.t1)}, during ${callStr(lineAt(A.name, r.t0))}. Move the actor to flatter ground or report it as an engine problem.` });
    for (const r of ranges(slide, 0)) out.push({ sev: 'warning', line: (lineAt(A.name, r.t0) || A.decl).line, t: r.t0, msg: `${A.name}'s planted foot slides up to ${r.worst.toFixed(0)}px per frame from ${fmtT(r.t0)} to ${fmtT(r.t1)}, during ${callStr(lineAt(A.name, r.t0))}.` });
    for (const r of ranges(off, 0)) {
      // only a problem if the actor is asked to act while nobody can see it
      const acts = film.statements.filter(s => s.target === A.name && s.t >= r.t0 - 1e-6 && s.t <= r.t1 && s.calls.some(c => !c.moves));
      if (acts.length) out.push({ sev: 'warning', line: acts[0].line, t: acts[0].t, msg: `${A.name} is outside the frame from ${fmtT(r.t0)} to ${fmtT(r.t1)} but acts on line ${acts.map(a => a.line).join(', ')}. Pan the camera to ${A.name} first (cam: pan(to=${A.name})) or use cam: follow(${A.name}).` });
      else if (r.t1 - r.t0 > film.duration * 0.9) out.push({ sev: 'warning', line: A.decl.line, t: 0, msg: `${A.name} is never in the frame. Put the actor nearer the camera (camera starts at x=${Math.round(film.camera(0).x)}) or pan to it.` });
    }
    // frozen: nothing to do for more than 4 s
    const iv = film.statements.filter(s => s.target === A.name || withOf(s) === A.name).map(s => [s.t, s.end]).sort((a, b) => a[0] - b[0]);   // a pair line occupies the partner too
    let cur = 0, from = 0;
    const lim = Math.min(film.duration, cardFrom);
    for (const [s, e] of iv.concat([[lim, lim]])) {
      if (s - cur > 4 && cur < lim) out.push({ sev: 'warning', line: (lineAt(A.name, cur) || A.decl).line, t: cur, msg: `${A.name} has nothing to do from ${fmtT(cur)} to ${fmtT(Math.min(s, lim))}. Add a line in between, for example: ${(cur + 2).toFixed(1)} ${A.name}: look(at=front)  or  face(happy).` });
      cur = Math.max(cur, e); from = s;
    }
  }
  for (const U of film.puppets) {
    const bad = [];
    for (let i = 0; i <= N; i++) { const p = U.pos(i / fps); bad.push(p.y > film.ground(p.x) + 3 ? p.y - film.ground(p.x) : 0); }
    for (const r of ranges(bad, 0)) out.push({ sev: 'error', line: 0, t: r.t0, msg: `${U.name} is ${r.worst.toFixed(0)}px under the ground from ${fmtT(r.t0)} to ${fmtT(r.t1)}. Use an anchor above the ground or a plain x.` });
  }
  // camera stopped at the edge of the set
  // one report per cam statement whose target lies past the edge (the camera stops there, never shows the edge)
  const camR = [];
  for (let i = 0; i <= N; i++) {
    const t = i / fps, c = film.camera(t);
    if (Math.abs(c.clamped) <= 20) continue;
    const cs = lineAt('cam', t), key = cs ? cs.line : 0, last = camR[camR.length - 1];
    if (last && last.key === key && i - last.i1 <= 1) { last.i1 = i; if (Math.abs(c.clamped) > Math.abs(last.c.clamped)) last.c = c; }
    else camR.push({ key, i0: i, i1: i, c });
  }
  for (const r of camR) {
    if ((r.i1 - r.i0) / fps < 0.1) continue;
    const c = r.c;
    out.push({ sev: 'warning', line: r.key, t: r.i0 / fps, msg: `from ${fmtT(r.i0 / fps)} to ${fmtT(r.i1 / fps)} the camera wants x=${Math.round(c.want)} but stops at x=${Math.round(c.x)}, the edge of the set (width ${film.W}). At zoom ${c.z.toFixed(2)} use pan targets between ${Math.round(640 / c.z)} and ${Math.round(film.W - 640 / c.z)}.` });
  }

  const order = { error: 0, warning: 1, info: 2 };
  out.sort((a, b) => order[a.sev] - order[b.sev] || a.line - b.line || (a.t || 0) - (b.t || 0));
  const errs = out.filter(o => o.sev === 'error').length, warns = out.filter(o => o.sev === 'warning').length;
  const lines = [];
  lines.push(`${path.relative(process.cwd(), path.resolve(filmDir)) || '.'}: ${film.duration}s, ${film.actors.length} actor(s), ${film.puppets.length} puppet(s); performer: ${film.standin ? 'stand-in' : 'CharPerform'}`);
  for (const o of out) lines.push(`${o.sev.toUpperCase()}${o.line ? ' line ' + o.line : ''}: ${o.msg}`);
  if (opts.timeline) {
    lines.push('timeline:');
    const rows = [];
    for (const s of film.statements) {
      rows.push({ s, who: s.target, what: s.calls.map(c => c.name).join(', ') });
      if (withOf(s)) rows.push({ s, who: withOf(s), what: s.calls.filter(c => c.args && c.args.with).map(c => `${c.name} with ${s.target}`).join(', ') + ' (partner)' });
    }
    for (const r of rows.sort((a, b) => a.s.t - b.s.t || a.s.line - b.s.line))
      lines.push(`  ${r.s.t.toFixed(2).padStart(6)}-${r.s.end.toFixed(2).padEnd(6)} line ${String(r.s.line).padEnd(3)} ${r.who}: ${r.what}`);
  }
  lines.push(errs ? `FAIL: ${errs} error(s), ${warns} warning(s). Fix the errors and run check again.` : `OK: 0 errors, ${warns} warning(s). Wrote ${path.relative(process.cwd(), b.out)}.`);
  return { ok: !errs, errors: errs, warnings: warns, text: lines.join('\n'), film, out };
}

module.exports = { ROOT, loadEngine, build, check, libFile };

if (require.main === module) {
  const args = process.argv.slice(2);
  const dir = args.find(a => !a.startsWith('--'));
  if (!dir) { console.error('usage: node tools/check.cjs <film dir> [--timeline] [--standin]'); process.exit(2); }
  try {
    const r = check(dir, { timeline: args.includes('--timeline'), standin: args.includes('--standin') });
    console.log(r.text);
    process.exit(r.ok ? 0 : 1);
  } catch (e) { console.error('check failed: ' + e.message); process.exit(1); }
}
