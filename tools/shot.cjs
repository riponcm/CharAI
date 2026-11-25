// Deterministic screenshot of a char-lab page.
// Usage: node tools/shot.cjs <page.html> <out.png> [--t=1.25] [--w=1200] [--h=800] [--q=extra=query] [--full]
// The page must expose window.seek(seconds) and honour ?static=1 (no autoplay).
const fs = require('node:fs'), path = require('node:path'), url = require('node:url');
// puppeteer-core lookup, in order: local node_modules, env CHAR_PUPPETEER, "puppeteer" path in untracked .char-local.json
function findPuppeteer() {
  try { return require.resolve('puppeteer-core'); } catch (e) { /* not installed locally */ }
  if (process.env.CHAR_PUPPETEER) return process.env.CHAR_PUPPETEER;
  try {
    const p = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.char-local.json'), 'utf8')).puppeteer;
    if (p) return p;
  } catch (e) { /* no local file */ }
  throw Error('puppeteer-core not found. Run "npm install" in the engine folder (or set CHAR_PUPPETEER, or "puppeteer" in .char-local.json).');
}
const PUPPETEER = findPuppeteer();
const puppeteer = require(PUPPETEER);

function browserPath() {
  if (process.env.BROWSER_PATH) return process.env.BROWSER_PATH;
  const c = [
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Microsoft/Edge/Application/msedge.exe'),
  ];
  const found = c.find(p => fs.existsSync(p));
  if (!found) throw Error('No Chrome/Edge found; set BROWSER_PATH.');
  return found;
}

(async () => {
  const [page, out, ...rest] = process.argv.slice(2);
  if (!page || !out) { console.error('usage: shot.cjs <page.html> <out.png> [--t=] [--w=] [--h=] [--q=] [--full]'); process.exit(2); }
  const opt = Object.fromEntries(rest.map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return [m[1], m[2] ?? true]; }));
  const w = +(opt.w || 1200), h = +(opt.h || 800), t = opt.t !== undefined ? +opt.t : null;
  const base = url.pathToFileURL(path.resolve(page)).href;
  const target = base + '?static=1' + (t !== null ? '&t=' + t : '') + (opt.q ? '&' + opt.q : '');
  const browser = await puppeteer.launch({ executablePath: browserPath(), headless: true, args: ['--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
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
