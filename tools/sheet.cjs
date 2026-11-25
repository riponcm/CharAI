// One contact-sheet PNG of evenly spaced frames with timestamps, so a review costs one image.
// Usage: node tools/sheet.cjs <film dir | file.char> <out.png> [--n=12] [--cols=4] [--w=400] [--from=s] [--to=s]
// --from/--to (seconds) take the frames from that part of the film only (a close strip of one action).
// Builds <film>/index.html first (like check.cjs), then captures every frame in one browser session.
const fs = require('node:fs'), path = require('node:path'), url = require('node:url');
const { build } = require('./check.cjs');
const { launch } = require('./render.cjs');

(async () => {
  const args = process.argv.slice(2);
  const pos = args.filter(a => !a.startsWith('--'));
  const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return [m[1], m[2] ?? true]; }));
  const [dir, out] = pos;
  if (!dir || !out) { console.error('usage: node tools/sheet.cjs <film dir | file.char> <out.png> [--n=12] [--cols=4] [--w=400]'); process.exit(2); }
  const n = +(opt.n || 12), cols = +(opt.cols || 4), tw = +(opt.w || 400), th = Math.round(tw * 9 / 16);
  const b = build(dir);
  const browser = await launch();
  try {
    const p = await browser.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(String(e)));
    await p.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await p.goto(url.pathToFileURL(b.out).href + '?static=1', { waitUntil: 'load' });
    const dur = await p.evaluate(() => window.duration || 0);
    if (!dur) throw Error('the page has no film (window.duration is 0). Run node tools/check.cjs ' + dir);
    const shots = [];
    const t0 = Math.max(0, +(opt.from || 0)), t1 = Math.min(dur, opt.to !== undefined ? +opt.to : dur);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? t0 : +(t0 + i * (t1 - t0) / (n - 1)).toFixed(3) * (t1 >= dur ? 0.999 : 1);   // last frame just before the very end
      await p.evaluate(tt => window.seek(tt), t);
      const buf = await p.screenshot({ type: 'jpeg', quality: 82 });
      shots.push({ t, src: 'data:image/jpeg;base64,' + Buffer.from(buf).toString('base64') });
    }
    const rows = Math.ceil(n / cols), gap = 6, lab = 0;
    const W = cols * tw + (cols + 1) * gap, H = rows * th + (rows + 1) * gap;
    const html = `<html><body style="margin:0;background:#1b1a20"><div style="position:relative;width:${W}px;height:${H}px">` +
      shots.map((s, i) => {
        const x = gap + (i % cols) * (tw + gap), y = gap + Math.floor(i / cols) * (th + gap);
        return `<img src="${s.src}" style="position:absolute;left:${x}px;top:${y}px;width:${tw}px;height:${th}px">` +
          `<div style="position:absolute;left:${x + 6}px;top:${y + 6}px;font:bold 15px Consolas,monospace;color:#fff;background:rgba(0,0,0,.65);padding:2px 6px;border-radius:4px">${s.t.toFixed(2)}s</div>`;
      }).join('') + '</div></body></html>';
    const q = await browser.newPage();
    await q.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await q.setContent(html, { waitUntil: 'load' });
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    await q.screenshot({ path: out });
    console.log(`wrote ${out}: ${n} frames of ${dur}s`, errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : '(no page errors)');
    if (errors.length) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(e => { console.error('sheet failed: ' + e.message); process.exit(1); });
