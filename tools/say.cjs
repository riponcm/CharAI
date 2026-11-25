// Strips of a face talking, in close-up.
// Usage: node tools/say.cjs out.png --skin=tot,captain --shapes              the nine mouth shapes of each skin
//        node tools/say.cjs out.png --skin=vera --text="Good morning!" [--for=1.8] [--mood=happy,sad] [--n=10]
//                                    [--track=lines/x.json --film=<film>] [--words="0:Good 0.3:morning"]
// Each row is one skin (in one mood), framed from the top of the head to the chest. With --shapes the
// columns are rest, mbp, ah, ee, oh, oo, fv, l, wq; otherwise evenly spaced moments of the line.
const fs = require('node:fs'), path = require('node:path'), url = require('node:url');
const { loadEngine, build, ROOT } = require('./check.cjs');
const { launch } = require('./render.cjs');
const VIS = ['rest', 'mbp', 'ah', 'ee', 'oh', 'oo', 'fv', 'l', 'wq'];

(async () => {
  const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--'));
  const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return [m[1], m[2] ?? true]; }));
  const out = pos[0];
  if (!out || (!opt.shapes && !opt.text && !opt.track)) { console.error('usage: node tools/say.cjs out.png --skin=a,b (--shapes | --text="..." [--for=s] [--mood=happy,sad] [--n=10])'); process.exit(2); }
  const F = require('./skinfind.cjs').finder(ROOT, opt.film);
  const found = String(opt.skin || 'mannequin').split(',').map(s => s.trim()).filter(Boolean).map(s => F.find(s) || s);
  const bad = found.find(f => typeof f === 'string');
  if (bad) { console.error(`no skin '${bad}' (give a name, a path, or --film=<film>)`); process.exit(2); }
  for (const f of found) if (f.warn) console.warn('note: ' + f.warn);
  const skins = found.map(f => f.name);
  const moods = opt.mood ? String(opt.mood).split(',').map(s => s.trim()) : [''];
  const shapes = !!opt.shapes, n = shapes ? VIS.length : Math.max(2, +(opt.n || 10));
  const cellH = 200, cellW = 200, crop = { x: 640 - 330, y: 30, width: 660, height: 660 };
  const tmp = path.join(ROOT, 'films', `.say-${process.pid}`);
  const cleanup = () => fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(path.join(tmp, 'skins'), { recursive: true });
  for (const { name, file } of found) if (!F.isRoot(file)) {
    fs.copyFileSync(file, path.join(tmp, 'skins', name + '.js'));
    const m = fs.readFileSync(file, 'utf8').match(/extends:s*'(w+)'/), p = m && F.parent(m[1], file);
    if (p && !F.isRoot(p)) fs.copyFileSync(p, path.join(tmp, 'skins', m[1] + '.js'));
  }
  if (opt.track) {   // the track file, relative to the film it belongs to
    const src = path.join(ROOT, 'films', String(opt.film || ''), String(opt.track));
    fs.mkdirSync(path.dirname(path.join(tmp, String(opt.track))), { recursive: true });
    fs.copyFileSync(src, path.join(tmp, String(opt.track)));
  }
  const eng = loadEngine(tmp);
  if (eng.errors.length) { console.error('a file fails to load: ' + eng.errors.map(e => e.file + ': ' + e.message).join('; ')); cleanup(); process.exit(1); }
  const esc = s => String(s).replace(/"/g, "'");
  const sayCall = shapes ? `say(visemes="${VIS.join(' ')}", for=${(VIS.length * 0.5).toFixed(1)})`
    : `say("${esc(opt.text || '')}"${opt.for ? `, for=${+opt.for}` : ''}${opt.track ? `, track="${opt.track}"` : ''}${opt.words ? `, words="${esc(opt.words)}"` : ''})`;
  const rows = [];
  for (const s of skins) for (const m of moods) rows.push({ skin: s, mood: m });
  const browser = await launch();
  const shots = [];
  try {
    const p = await browser.newPage();
    await p.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    for (const r of rows) {
      const text = [`film "say" 20s`, `stage width=3000 ground=600 scale=60`, `actor A = skin ${r.skin} at 1000`,
        `0 cam: frame(on=A, top=head, bottom=chin, x=0.42, over=0, pad=0.3)`, r.mood ? `0 A: face(${r.mood}), mood(${r.mood})` : '', `0.6 A: ${sayCall}`].filter(Boolean).join('\n') + '\n';
      fs.writeFileSync(path.join(tmp, 'film.char'), text);
      const b = build(tmp), P = eng.CharScript.parse(text), film = eng.CharStage.compile(P, eng.lib);
      const errs = film.diagnostics.filter(d => d.severity === 'error');
      if (errs.length) { console.error(errs.map(d => `line ${d.line}: ${d.message}`).join('\n') + '\nNo picture written.'); process.exit(1); }
      const st = P.statements.find(q => q.calls && q.calls[0].name === 'say'), t0 = st.t, t1 = st.end;
      await p.goto(url.pathToFileURL(b.out).href + '?static=1', { waitUntil: 'load' });
      const row = [];
      for (let i = 0; i < n; i++) {
        const t = shapes ? t0 + (i + 0.6) * (t1 - t0) / VIS.length : t0 - 0.1 + (t1 - t0 + 0.3) * i / (n - 1);
        await p.evaluate(tt => window.seek(tt), t);
        const buf = await p.screenshot({ type: 'jpeg', quality: 88, clip: crop });
        row.push({ t, lab: shapes ? VIS[i] : (t - t0).toFixed(2) + 's', src: 'data:image/jpeg;base64,' + Buffer.from(buf).toString('base64') });
      }
      shots.push({ r, row });
    }
    const lab = 130, W = lab + n * cellW, H = rows.length * (cellH + 18) + 24;
    const html = `<html><body style="margin:0;background:#2a2a30;font:bold 13px Consolas,monospace;color:#fff"><div style="position:relative;width:${W}px;height:${H}px">` +
      shots.map((s, ri) => { const y = ri * (cellH + 18); return `<div style="position:absolute;left:8px;top:${y + 10}px;width:${lab - 12}px">${s.r.skin}${s.r.mood ? '<br>' + s.r.mood : ''}</div>` +
        s.row.map((c, ci) => `<img src="${c.src}" style="position:absolute;left:${lab + ci * cellW}px;top:${y}px;width:${cellW}px;height:${cellH}px">` +
          `<div style="position:absolute;left:${lab + ci * cellW + 4}px;top:${y + cellH}px;font-size:12px">${c.lab}</div>`).join(''); }).join('') +
      `<div style="position:absolute;left:8px;top:${H - 20}px;font-size:12px;color:#ccc">${sayCall.replace(/</g, '&lt;')}</div></div></body></html>`;
    const q = await browser.newPage();
    await q.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await q.setContent(html, { waitUntil: 'load' });
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    await q.screenshot({ path: out });
    console.log(`wrote ${out}: ${sayCall} on ${rows.map(r => r.skin + (r.mood ? '/' + r.mood : '')).join(', ')}`);
  } finally { await browser.close(); cleanup(); }
})().catch(e => { console.error('say failed: ' + e.message); process.exit(1); });
