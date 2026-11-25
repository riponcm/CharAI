// Render a film folder to an MP4 (1280x720, H.264) with ffmpeg (must be on PATH).
// Usage: node tools/render.cjs <film dir | file.char> <out.mp4> [--fps=24] [--from=0] [--to=<end>] [--pages=1]
// --bg=warm (or a #rrggbb sky colour) paints a plain backdrop with a ground line under the characters, for gallery clips.
// --crf=<n> sets the H.264 quality (default 18). Without --bg the film looks as before.
// Uses the same headless browser setup as tools/shot.cjs; all frames come from one browser session
// and are piped straight into ffmpeg as JPEG images.
const fs = require('node:fs'), path = require('node:path'), url = require('node:url'), { spawn } = require('node:child_process');
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

// Every installed browser worth trying, in order: BROWSER_PATH first, then Chrome and Edge in
// their usual places on Windows, macOS and Linux.
function browserCandidates() {
  const pf = process.env.PROGRAMFILES || 'C:/Program Files', pf86 = process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)';
  const c = [
    process.env.BROWSER_PATH,
    path.join(pf, 'Google/Chrome/Application/chrome.exe'),
    path.join(pf86, 'Google/Chrome/Application/chrome.exe'),
    path.join(pf86, 'Microsoft/Edge/Application/msedge.exe'),
    path.join(pf, 'Microsoft/Edge/Application/msedge.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
  ];
  return [...new Set(c.filter(p => p && fs.existsSync(p)))];
}
function browserPath() {
  const found = browserCandidates()[0];
  if (!found) throw Error('No Chrome/Edge found; set BROWSER_PATH.');
  return found;
}
// Tries each browser in turn, so one that is installed but will not start does not stop the tools.
async function launch() {
  const puppeteer = require(PUPPETEER);
  const tried = [];
  for (const executablePath of browserCandidates()) {
    try {
      return await puppeteer.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
    } catch (e) { tried.push(executablePath + ': ' + String(e.message || e).split('\n')[0]); }
  }
  throw Error(tried.length ? 'No browser would start. Tried:\n  ' + tried.join('\n  ') + '\nSet BROWSER_PATH to a working Chrome or Edge.' : 'No Chrome/Edge found; set BROWSER_PATH.');
}
module.exports = { launch, browserPath };

// Runs in the page: a sky colour on the body and a ground band that follows the camera (page-side, the engine is untouched).
function setupBackdrop(bg) {
  const warm = bg === 'warm' || bg === 'true';
  const sky = warm ? '#f4e6d0' : bg, ground = warm ? '#dcc29c' : 'color-mix(in srgb,' + bg + ' 82%, #6b4a20)', line = warm ? '#b99a6c' : 'color-mix(in srgb,' + bg + ' 60%, #4a3010)';
  document.body.style.background = 'linear-gradient(' + sky + ',' + (warm ? '#efdcc0' : sky) + ')';
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:0;background:' + ground + ';border-top:3px solid ' + line + ';box-shadow:0 -10px 18px -8px rgba(120,80,30,.25)';
  document.body.insertBefore(d, document.body.firstChild);
  document.getElementById('stage').style.zIndex = 1;
  const orig = window.seek;
  window.seek = function (t) {
    orig(t);
    const f = window.film.film, cam = f.camera(Math.max(0, Math.min(f.duration, +t || 0)));
    const gy = f.toScreen([640, f.ground(640)], cam)[1] * innerHeight / 720;
    d.style.top = Math.min(innerHeight, Math.max(0, gy)) + 'px';
  };
  window.seek(0);
}

if (require.main === module) (async () => {
  const { build } = require('./check.cjs');
  const args = process.argv.slice(2);
  const pos = args.filter(a => !a.startsWith('--'));
  const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return [m[1], m[2] ?? true]; }));
  const [dir, out] = pos;
  if (!dir || !out) { console.error('usage: node tools/render.cjs <film dir | file.char> <out.mp4> [--fps=24] [--from=0] [--to=<end>] [--pages=1] [--bg=warm|#rrggbb] [--crf=18]'); process.exit(2); }
  const fps = +(opt.fps || 24), pages = Math.max(1, +(opt.pages || 1));
  const started = Date.now();
  const b = build(dir);
  const browser = await launch();
  let ff;
  try {
    const tabs = [];
    const errors = [];
    for (let i = 0; i < pages; i++) {
      const p = await browser.newPage();
      p.on('pageerror', e => errors.push(String(e)));
      await p.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
      await p.goto(url.pathToFileURL(b.out).href + '?static=1', { waitUntil: 'load' });
      if (opt.bg) await p.evaluate(setupBackdrop, String(opt.bg));
      tabs.push(p);
    }
    const dur = await tabs[0].evaluate(() => window.duration || 0);
    if (!dur) throw Error('the page has no film (window.duration is 0). Run node tools/check.cjs ' + dir);
    const from = +(opt.from || 0), to = Math.min(dur, opt.to !== undefined ? +opt.to : dur);
    const N = Math.max(1, Math.round((to - from) * fps));
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    // --audio=<file>: a given sound file is muxed in (the engine itself makes no sound)
    const audio = opt.audio ? ['-i', path.resolve(String(opt.audio)), '-c:a', 'aac', '-b:a', '192k', '-shortest'] : [];
    ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-'].concat(audio, [
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', String(opt.crf || 18), '-preset', 'medium', '-movflags', '+faststart', '-r', String(fps), out]), { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => { ff.on('exit', c => c === 0 ? res() : rej(Error('ffmpeg exited with code ' + c))); ff.on('error', rej); });
    done.catch(() => {});
    // frames are captured out of order by several tabs and written in order
    const ready = new Map();
    let next = 0, taken = 0;
    const write = buf => new Promise(r => { if (!ff.stdin.write(buf)) ff.stdin.once('drain', r); else r(); });
    async function flush() { while (ready.has(next)) { const buf = ready.get(next); ready.delete(next); next++; await write(buf); } }
    let flushing = Promise.resolve();
    await Promise.all(tabs.map(async p => {
      while (taken < N) {
        const i = taken++;
        await p.evaluate(tt => window.seek(tt), from + i / fps);
        ready.set(i, Buffer.from(await p.screenshot({ type: 'jpeg', quality: 92 })));
        flushing = flushing.then(flush);
        if (i % 48 === 0) process.stdout.write(`\rframe ${i}/${N}`);
      }
    }));
    await flushing;
    ff.stdin.end();
    await done;
    const secs = (Date.now() - started) / 1000;
    console.log(`\rwrote ${out}: ${N} frames, ${(N / fps).toFixed(2)}s at ${fps} fps, 1280x720, in ${secs.toFixed(1)}s`, errors.length ? '\nPAGE ERRORS:\n' + errors.join('\n') : '');
    if (errors.length) process.exitCode = 1;
  } catch (e) {
    if (ff) ff.kill();
    console.error('render failed: ' + e.message); process.exitCode = 1;
  } finally { await browser.close(); }
})();
