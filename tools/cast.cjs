// One picture of a character in six poses, for self-review of a drawing.
// Usage: node tools/cast.cjs skins/<name>.js out.png       (or films/<film>/skins/<name>.js)
//   1280x720, plain mid-grey background: standing, mid-walk, mid-run, top of jump, wave, sit.
//   Builds a temporary film on the bare stage (six copies of the skin, each timed to be in its pose at
//   one moment), measures the drawn figures and fits them inside the frame, takes one screenshot, adds
//   labels. Only the target skin and the skins it extends are loaded. Run tools/skincheck.cjs first.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), url = require('node:url');
const { loadEngine, build, ROOT } = require('./check.cjs');
const { launch } = require('./render.cjs');
const { loadSkinFile } = require('./skincheck.cjs');

const POSES = ['standing', 'mid-walk', 'mid-run', 'top of jump', 'wave', 'sit'];
const T = 4;            // the moment of the picture (s)
const GROUND = 640;     // ground line (px); labels sit below it
const WID = [0.165, 0.16, 0.19, 0.16, 0.135, 0.19];   // cell widths (shares of 1280)
const CENTRE = WID.map((w, i) => 1280 * (WID.slice(0, i).reduce((a, b) => a + b, 0) + w / 2));

(async () => {
  const [file, out] = process.argv.slice(2);
  if (!file || !out) { console.error('usage: node tools/cast.cjs skins/<name>.js out.png'); process.exit(2); }
  const abs = path.resolve(file), name = path.basename(abs, '.js');
  if (!fs.existsSync(abs)) { console.error('no such file: ' + file); process.exit(2); }
  // a temporary film folder holding the target skin and the chain of skins it extends (never its siblings)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cast-'));
  fs.mkdirSync(path.join(tmp, 'skins'));
  const dir = path.dirname(abs), inRoot = dir === path.join(ROOT, 'skins');
  try {
    let cur = abs;
    for (let n = 0; n < 8 && cur; n++) {
      const L = loadSkinFile(cur), sk = L.skins[path.basename(cur, '.js')] || L.skins[L.keys[0]];
      if (!inRoot) fs.copyFileSync(cur, path.join(tmp, 'skins', path.basename(cur)));
      const base = sk && sk.extends && path.join(dir, sk.extends + '.js');
      cur = !inRoot && base && fs.existsSync(base) ? base : null;
    }
  } catch (e) { console.error(`cannot load ${file}: ${e.message}\nRun node tools/skincheck.cjs ${file}`); process.exit(1); }
  const eng = loadEngine(tmp);
  if (eng.errors.length) { console.error('a skin fails to load: ' + eng.errors.map(e => e.file + ': ' + e.message).join('; ')); process.exit(1); }
  if (!eng.lib.skins[name]) { console.error(`the file registers no skin named '${name}'. Run node tools/skincheck.cjs ${file}`); process.exit(1); }

  const compile = text => eng.CharStage.compile(eng.CharScript.parse(text), eng.lib);
  const head = S => `film "cast ${name}" 8s\nstage width=1280 ground=${GROUND} scale=${S}\n` + POSES.map((_, i) => `actor A${i} = skin ${name} at @X${i}@`).join('\n') + '\n';
  const script = (S, xs, ts) => {
    const L = [[0, 'A0: stand()'], [ts[1], `A1: walk(to=${Math.round(xs[1] + 4000)})`], [ts[2], `A2: run(to=${Math.round(xs[2] + 6000)})`],
      [ts[3], `A3: jump(to=${Math.round(xs[3] + 1.6 * S)}, height=1)`], [0, 'A4: stand()'], [ts[4], 'A4: wave()'], [ts[5], 'A5: sit()']];
    return head(S).replace(/@X(\d)@/g, (m, i) => Math.round(xs[+i])) + L.sort((a, b) => a[0] - b[0]).map(([t, s]) => `${t.toFixed(3)} ${s}`).join('\n') + '\n';
  };

  // measure the height, then for a scale find the action starts so each pose falls at T
  const x0 = new Array(6).fill(300);
  const probe = (S, ts) => compile(script(S, x0, ts));
  const f0 = probe(60, [0, 1, 1, 1, 1, 1]);
  const H = f0.actors[0].perf.height / f0.actors[0].perf.scale;            // height in head heights
  const plan = S => {
    const f1 = probe(S, [0, 1, 1, 1, 1, 1]), off = [0.6, 1.0, 1.3, 0, 0.9, 1.6];
    let best = 1e9, hi = 1e9;
    for (let t = 1; t <= 3.2; t += 1 / 48) { const j = f1.actors[3].joints(t); if (j && j.head[1] < best) { best = j.head[1]; off[3] = t - 1; } }
    for (let t = 1.2; t <= 2.8; t += 1 / 48) { const j = f1.actors[4].joints(t); const y = j ? j.hands.near[1] : 1e9; if (y < hi) { hi = y; off[4] = t - 1; } }
    const ts = off.map((o, i) => i === 0 ? 0 : T - o);
    const f2 = compile(script(S, x0, ts));
    const xs = f2.actors.map((A, i) => {
      const j = A.joints(T), v = [j.head[0] - 0.7 * S, j.head[0] + 0.3 * S, j.hands.near[0], j.hands.far[0]];
      for (const k of ['near', 'far']) v.push(j.feet[k].heel[0], j.feet[k].toe[0]);
      return CENTRE[i] - ((Math.min(...v) + Math.max(...v)) / 2 - x0[i]);
    });
    return { ts, xs };
  };

  const browser = await launch();
  try {
    const p = await browser.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(String(e)));
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    // draw once and measure the ink box of each figure (screen px)
    const draw = async (S, xs, ts) => {
      const text = script(S, xs, ts);
      fs.writeFileSync(path.join(tmp, 'film.char'), text);
      const bad = compile(text).diagnostics.filter(d => d.severity === 'error');
      if (bad.length) { console.error('the cast film has errors:\n' + bad.map(d => d.message).join('\n')); process.exit(1); }
      const b = build(tmp);
      await p.goto(url.pathToFileURL(b.out).href + '?static=1&r=' + Math.random(), { waitUntil: 'load' });
      await p.evaluate(tt => window.seek(tt), T);
      return p.evaluate(() => {
        for (const g of document.querySelectorAll('svg g')) {
          const k = [...g.children];
          if (k.length === 6 && k.every(c => c.tagName === 'g' && /^translate/.test(c.getAttribute('transform') || '')))
            return k.map(c => { const r = c.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
        }
        return null;
      });
    };
    let S = Math.max(20, Math.min(105, Math.round(390 / H)));
    let { ts, xs } = plan(S), boxes = null;
    for (let round = 0; round < 6; round++) {
      boxes = await draw(S, xs, ts);
      if (!boxes) break;
      const MX = 8, TOP = 44;
      let k = 1;
      boxes.forEach((b, i) => { k = Math.min(k, (1280 * WID[i] * 1.25) / (b[2] - b[0]), (GROUND - TOP) / (GROUND - b[1]), 1264 / (b[2] - b[0])); });
      if (k < 0.97 && S > 20) { S = Math.max(20, Math.floor(S * k)); ({ ts, xs } = plan(S)); continue; }
      // centre each figure in its cell, then keep it inside the frame
      let moved = 0;
      xs = xs.map((x, i) => {
        const b = boxes[i], w = b[2] - b[0], c = (b[0] + b[2]) / 2;
        const want = Math.min(Math.max(CENTRE[i], MX + w / 2), 1280 - MX - w / 2);
        const d = want - c; if (Math.abs(d) > 3) moved++;
        return x + d;
      });
      if (!moved) break;
    }
    await p.evaluate((labels, cell, ground, title) => {
      document.documentElement.style.background = document.body.style.background = '#808080';
      const mk = (css, text) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;font:bold 20px Consolas,monospace;color:#fff;text-shadow:0 1px 3px #000;' + css; d.textContent = text; document.body.appendChild(d); };
      labels.forEach((l, i) => mk(`left:${cell[i] - 100}px;width:200px;text-align:center;top:${ground + 28}px`, l));
      mk('left:14px;top:10px;font-size:18px', title);
      const line = document.createElement('div'); line.style.cssText = `position:fixed;left:0;top:${ground}px;width:1280px;height:2px;background:rgba(0,0,0,.25)`; document.body.appendChild(line);
    }, POSES, CENTRE, GROUND, `${name}  (${H.toFixed(1)} heads tall)`);
    await new Promise(r => setTimeout(r, 120));
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    await p.screenshot({ path: out });
    const clipped = boxes && boxes.some(b => b[0] < 0 || b[2] > 1280 || b[1] < 0 || b[3] > 720);
    console.log(`wrote ${out}: ${name}, ${H.toFixed(1)} heads tall, ${POSES.join(', ')}` + (clipped ? '\nWARNING: a figure is cut by the frame edge.' : ''), errors.length ? '\nPAGE ERRORS:\n' + errors.join('\n') : '(no page errors)');
    if (errors.length) process.exitCode = 1;
  } finally { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
})().catch(e => { console.error('cast failed: ' + e.message); process.exit(1); });
