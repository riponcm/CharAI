// Rebuilds docs/img/social-preview.png (1280x640). Run from the engine folder: node docs/img/src/social-build.cjs [t=1.35]
// 1) draws films/social at film time t as a transparent 2x PNG, 2) shoots social.html at 2x, 3) ffmpeg lanczos down to 1280x640.
const fs = require('node:fs'), path = require('node:path'), url = require('node:url'), { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..', '..', '..');
const { launch } = require(path.join(root, 'tools', 'render.cjs'));
const { build } = require(path.join(root, 'tools', 'check.cjs'));
const t = +(process.argv[2] || 1.35);
(async () => {
  const b = build(path.join(root, 'films', 'social'));
  const browser = await launch();
  try {
    const p = await browser.newPage();
    await p.setViewport({ width: 1280, height: 640, deviceScaleFactor: 2 });
    await p.goto(url.pathToFileURL(b.out).href + '?static=1', { waitUntil: 'load' });
    await p.evaluate(tt => { document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent'; window.seek(tt); }, t);
    await p.screenshot({ path: path.join(root, 'films', 'social', 'cast@2x.png'), omitBackground: true });
    const q = await browser.newPage();
    await q.setViewport({ width: 1280, height: 640, deviceScaleFactor: 2 });
    await q.goto(url.pathToFileURL(path.join(__dirname, 'social.html')).href, { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 300));
    await q.screenshot({ path: path.join(__dirname, 'social-preview@2x.png') });
  } finally { await browser.close(); }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(__dirname, 'social-preview@2x.png'), '-vf', 'scale=1280:640:flags=lanczos', path.join(__dirname, '..', 'social-preview.png')]);
  console.log('wrote docs/img/social-preview.png');
})();
