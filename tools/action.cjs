// A strip of an action (or a short sequence) on one or more bodies, optionally in several moods.
// Usage: node tools/action.cjs <action> out.png [--skin=kai,vera,baker] [--mood=sad,angry] [--n=8] [--args="to=1400"]
//                              [--film=<film>] [--fixed] [--props=box@900,chair@1100] [--hold=loaf] [--zoom=1.4 --at=840]
//   --skin=a+b plays a paired action (docs/PAIRS.md) with A on the left and B on the right; with= is added.
//   <action>: a name (bow), a call (walk(to=1400)), or calls joined with ';' that play one after another
//   (walk(to=1300); wave(); sit()). Skins are names or paths; a name is looked up in --film, then skins/, then films/*/skins/; actions in actions/ and
//   in the film folder of each skin used (or --film=<film>), so a film's own actions can be previewed.
//   Each row is one body (in one mood) followed by a close camera, or with --fixed a still camera so
//   travel shows. A declared wall or step (action options) is drawn as a grey shape. Nothing is written
//   if the script or the action has errors.
const fs = require('node:fs'), path = require('node:path'), url = require('node:url');
const { loadEngine, build, ROOT } = require('./check.cjs');
const { launch } = require('./render.cjs');

(async () => {
  const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--'));
  const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return [m[1], m[2] ?? true]; }));
  const [act, out] = pos;
  if (!act || !out) { console.error('usage: node tools/action.cjs <action> out.png [--skin=a,b] [--mood=sad,angry] [--n=8] [--args="k=v"] [--film=name] [--fixed]'); process.exit(2); }
  const F = require('./skinfind.cjs').finder(ROOT, opt.film);
  // a row is one skin, or two joined with + (a pair: A on the left, B on the right facing A)
  const rowSpecs = String(opt.skin || 'mannequin').split(',').map(s => s.trim()).filter(Boolean).map(s => s.split('+').map(q => q.trim()).filter(Boolean));
  const found = [].concat(...rowSpecs).map(s => F.find(s) || s);
  const bad = found.find(f => typeof f === 'string');
  if (bad) { console.error(`no skin '${bad}' in --film, skins/ or films/*/skins/ (a path works too)`); process.exit(2); }
  for (const f of found) if (f.warn) console.warn('note: ' + f.warn);
  const skins = rowSpecs.map(r => r.map(s => F.find(s).name).join('+'));
  const moods = opt.mood ? String(opt.mood).split(',').map(s => s.trim()) : [''];
  const n = Math.max(2, +(opt.n || 8)), cellH = 260, cellW = cellH, crop = { x: 640 - 360, y: 0, width: 720, height: 720 };
  const calls = act.split(';').map(s => s.trim()).filter(Boolean).map((c, i) => c.includes('(') ? c : `${c}(${i === 0 && opt.args ? opt.args : ''})`);
  const tmp = path.join(ROOT, 'films', `.action-${process.pid}`);
  fs.mkdirSync(path.join(tmp, 'skins'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'actions'), { recursive: true });
  const actionDirs = new Set(opt.film ? [path.join(ROOT, 'films', String(opt.film), 'actions')] : []);
  const cleanup = () => fs.rmSync(tmp, { recursive: true, force: true });
  for (const { name, file: f } of found) if (!F.isRoot(f)) {
    fs.copyFileSync(f, path.join(tmp, 'skins', name + '.js'));
    actionDirs.add(path.join(path.dirname(path.dirname(f)), 'actions'));
    const m = fs.readFileSync(f, 'utf8').match(/extends:\s*'(\w+)'/), p = m && F.parent(m[1], f);
    if (p && !F.isRoot(p)) fs.copyFileSync(p, path.join(tmp, 'skins', m[1] + '.js'));
  }
  for (const d of actionDirs) if (fs.existsSync(d)) for (const f of fs.readdirSync(d).filter(f => f.endsWith('.js'))) fs.copyFileSync(path.join(d, f), path.join(tmp, 'actions', f));
  const eng = loadEngine(tmp);
  if (eng.errors.length) { console.error('a file fails to load: ' + eng.errors.map(e => e.file + ': ' + e.message).join('; ')); cleanup(); process.exit(1); }
  const rows = [];
  for (const s of skins) for (const m of moods) rows.push({ skin: s, mood: m });
  const camLine = opt.fixed ? `0 cam: cut(to=A, zoom=1.5)` : `0 cam: frame(on=A, top=head, bottom=feet, x=0.5, over=0, pad=0.8)`;
  const isPair = c => { const d = (globalThis.CharActions || {})[c.replace(/\(.*$/, '').trim()]; return !!(d && d.pair); };
  const withB = c => isPair(c) && !/\bwith\s*=/.test(c) ? c.replace(/\)\s*$/, (/\(\s*\)\s*$/.test(c) ? '' : ', ') + 'with=B)') : c;
  // --props=box@900,chair@1100 places props (x in stage px; A starts at 700); --hold=loaf has A holding one first
  const propLines = String(opt.props || '').split(',').filter(Boolean).map(s => { const [k, x] = s.split('@'); return `prop ${k.trim()}${x ? ' at ' + (+x) : ''}`; });
  const holdLine = opt.hold ? [`0.1 A: hold(${opt.hold})`] : [];
  const scriptOf = (r, zoom) => {
    const [a, b] = r.skin.split('+');
    if (!b) return [`film "action" 40s`, `stage width=9000 ground=600 scale=60`, `actor A = skin ${a} at 700`, ...propLines, ...holdLine,
      camLine, r.mood ? `0 A: mood(${r.mood})` : '', `0.8 A: ${calls[0]}`]
      .concat(calls.slice(1).map(c => `+0.1 A: ${c}`)).filter(Boolean).join('\n') + '\n';
    // a pair (--skin=a+b): A on the left, B on the right facing A, a still camera on both
    return [`film "action" 40s`, `stage width=9000 ground=600 scale=60`, `actor A = skin ${a} at 700`, `actor B = skin ${b} at 960 facing left`, ...propLines, ...holdLine,
      `0 cam: cut(to=${opt.at || 840}, zoom=${opt.zoom || zoom || 1.45})`, r.mood ? `0 A: mood(${r.mood})` : '', `0.6 A: ${withB(calls[0])}`]
      .concat(calls.slice(1).map(c => `+0.1 A: ${withB(c)}`)).filter(Boolean).join('\n') + '\n';
  };
  const browser = await launch();
  const shots = [];
  try {
    const p = await browser.newPage();
    await p.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    for (const r of rows) {
      let text = scriptOf(r), P = eng.CharScript.parse(text);
      let film = eng.CharStage.compile(P, eng.lib);
      if (r.skin.includes('+') && film.actors.length > 1) {   // a pair: zoom so the taller fills about 80% of the picture
        const hMax = Math.max(...film.actors.map(a => a.perf.height || 0));
        if (hMax > 0) { text = scriptOf(r, Math.min(1.8, 560 / hMax).toFixed(2)); P = eng.CharScript.parse(text); film = eng.CharStage.compile(P, eng.lib); }
      }
      const errs = film.diagnostics.filter(d => d.severity === 'error');
      if (errs.length) { console.error(`${r.skin}: ` + errs.map(d => `line ${d.line}: ${d.message}`).join('\n') + '\nNo picture written.'); process.exit(1); }
      const acts = P.statements.filter(st => st.kind === 'actor' && st.calls[0].name !== 'mood');
      const t0 = acts[0].t - 0.1, t1 = Math.max(...acts.map(st => st.end)) + 0.3;
      // declared surfaces: a wall or a step, placed from where the action started
      const A = film.actors[0], ch = globalThis.CharRig.skinCharacter(A.skin), Lpx = (ch.proportions.thigh + ch.proportions.shin) * A.perf.scale;
      const surf = [];
      for (const st of acts) {
        const def = (globalThis.CharActions || {})[st.calls[0].name];
        if (!def || (def.wall === undefined && !def.step)) continue;
        const s0 = A.sample(st.t);
        if (def.wall !== undefined) surf.push({ t: st.t, kind: 'wall', x: s0.x + s0.facing * def.wall * Lpx, y: s0.y });
        if (def.step) surf.push({ t: st.t, kind: 'step', x: s0.x + s0.facing * (+def.step.ahead || 0.35) * Lpx, x2: s0.x + s0.facing * ((+def.step.ahead || 0.35) + 0.9) * Lpx, h: (+def.step.height || 0.25) * Lpx, y: s0.y });
      }
      fs.writeFileSync(path.join(tmp, 'film.char'), text);
      const b = build(tmp);
      await p.goto(url.pathToFileURL(b.out).href + '?static=1', { waitUntil: 'load' });
      const row = [];
      for (let i = 0; i < n; i++) {
        const t = t0 + (t1 - t0) * i / (n - 1);
        await p.evaluate(tt => window.seek(tt), t);
        const buf = await p.screenshot({ type: 'jpeg', quality: 85, clip: crop });
        const cam = film.camera(t), sc = cellH / crop.height, rects = [];
        for (const q of surf) {
          if (t < q.t) continue;
          const g = film.toScreen([q.x, q.y], cam, 1);
          if (q.kind === 'wall') { const top = film.toScreen([q.x, q.y - 6 * Lpx], cam, 1); rects.push([g[0] - 3, top[1], 6, g[1] - top[1]]); }
          else { const g2 = film.toScreen([q.x2, q.y - q.h], cam, 1); rects.push([Math.min(g[0], g2[0]), g2[1], Math.abs(g2[0] - g[0]), g[1] - g2[1]]); }
        }
        row.push({ t, src: 'data:image/jpeg;base64,' + Buffer.from(buf).toString('base64'), rects: rects.map(q => [(q[0] - crop.x) * sc, (q[1] - crop.y) * sc, q[2] * sc, q[3] * sc]) });
      }
      shots.push({ r, row });
    }
    const lab = 150, W = lab + n * cellW, H = rows.length * cellH;
    const html = `<html><body style="margin:0;background:#2a2a30;font:bold 14px Consolas,monospace;color:#fff"><div style="position:relative;width:${W}px;height:${H}px">` +
      shots.map((s, ri) => `<div style="position:absolute;left:8px;top:${ri * cellH + 10}px;width:${lab - 12}px">${s.r.skin}${s.r.mood ? '<br>' + s.r.mood : ''}</div>` +
        s.row.map((c, ci) => `<div style="position:absolute;left:${lab + ci * cellW}px;top:${ri * cellH}px;width:${cellW}px;height:${cellH}px;overflow:hidden">` +
          c.rects.map(q => `<div style="position:absolute;left:${q[0]}px;top:${q[1]}px;width:${q[2]}px;height:${q[3]}px;background:#6d6d78"></div>`).join('') +
          `<img src="${c.src}" style="position:absolute;left:0;top:0;width:${cellW}px;height:${cellH}px;mix-blend-mode:lighten"></div>` +
          (ri === 0 ? `<div style="position:absolute;left:${lab + ci * cellW + 4}px;top:4px;font-size:11px;background:rgba(0,0,0,.5);padding:1px 4px">${(c.t - shots[0].row[0].t).toFixed(2)}s</div>` : '')).join('')).join('') +
      `<div style="position:absolute;left:8px;top:${H - 24}px;font-size:12px;color:#ccc">${calls.join('; ')}</div></div></body></html>`;
    const q = await browser.newPage();
    await q.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await q.setContent(html, { waitUntil: 'load' });
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    await q.screenshot({ path: out });
    console.log(`wrote ${out}: ${calls.join('; ')} on ${rows.map(r => r.skin + (r.mood ? '/' + r.mood : '')).join(', ')}`);
  } finally { await browser.close(); cleanup(); }
})().catch(e => { console.error('action failed: ' + e.message); process.exit(1); });
