// Deterministic screenshot of a char-lab page.
// Usage: node tools/shot.cjs <page.html> <out.png> [--t=1.25] [--w=1200] [--h=800] [--q=extra=query] [--full]
// The page must expose window.seek(seconds) and honour ?static=1 (no autoplay).
const fs = require('node:fs'), path = require('node:path'), url = require('node:url');
// the browser launch (puppeteer lookup, Chrome or Edge with fallback) is shared with the other tools
const { launch } = require('./render.cjs');

(async () => {
  const [page, out, ...rest] = process.argv.slice(2);
  if (!page || !out) { console.error('usage: shot.cjs <page.html> <out.png> [--t=] [--w=] [--h=] [--q=] [--full]'); process.exit(2); }
  const opt = Object.fromEntries(rest.map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return [m[1], m[2] ?? true]; }));
  const w = +(opt.w || 1200), h = +(opt.h || 800), t = opt.t !== undefined ? +opt.t : null;
  const base = url.pathToFileURL(path.resolve(page)).href;
  const target = base + '?static=1' + (t !== null ? '&t=' + t : '') + (opt.q ? '&' + opt.q : '');
  const browser = await launch();
  try {
    const p = await browser.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(String(e)));
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await p.goto(target, { waitUntil: 'load' });
    if (t !== null) await p.evaluate(tt => window.seek && window.seek(tt), t);
    await new Promise(r => setTimeout(r, 150));
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    await p.screenshot({ path: out, fullPage: !!opt.full });
    console.log('wrote', out, errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : '(no page errors)');
    if (errors.length) process.exitCode = 1;
  } finally { await browser.close(); }
})();
