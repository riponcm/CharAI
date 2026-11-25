// Render a film (or .char script) range to a smooth animated WebP loop (needs ffmpeg with libwebp_anim on PATH).
// Usage: node tools/webploop.cjs <film dir | file.char> <out.webp> [--from=0] [--to=<end>] [--fps=30] [--w=1280] [--h=720]
//          [--bg=transparent|light|dark|#rrggbb] [--crop=x,y,w,h] [--q=70] [--under=back.png] [--over=front.png]
//          [--alpha] [--inject=page.js] [--theme=light|dark]
//   --w --h   output size in px.          --crop   the part of the 1280x720 film frame to show (default: full width, centred).
//   --bg      backdrop behind the characters: transparent (default, WebP with alpha), light (cream), dark (navy) or a colour.
//   --under / --over   a PNG of the output size drawn behind / in front of the characters (panels, text, ground shadows).
//   --alpha   keep transparency when --under has some (rounded corners).   --inject   a JS file run once in the page; it may set
//             window.__frame = t => {...} to draw extra DOM (typed text...) per frame; it can read window.__theme (--theme).
//   --q       WebP quality 0-100 (default 70). Loops forever. Frames are exact (seek(t) per frame), so motion is smooth at any fps.
// A loop is seamless when the film's first and last frame match: start and end standing still, hair settled.
// Example: node tools/webploop.cjs films/cast out.webp --from=0 --to=3.5 --w=420 --h=260 --crop=100,250,700,433 --bg=light
const fs = require('node:fs'), path = require('node:path'), url = require('node:url'), { spawn } = require('node:child_process');
const { launch } = require('./render.cjs');

const BG = { light: 'linear-gradient(#fdf8ee,#f6ead6)', dark: 'linear-gradient(#1b2342,#121830)' };

(async () => {
  const { build } = require('./check.cjs');
  const args = process.argv.slice(2);
  const pos = args.filter(a => !a.startsWith('--'));
  const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return [m[1], m[2] ?? true]; }));
  const [dir, out] = pos;
  if (!dir || !out) { console.error('usage: node tools/webploop.cjs <film dir | file.char> <out.webp> [--from=0] [--to=end] [--fps=30] [--w=1280] [--h=720] [--bg=transparent|light|dark|#rrggbb] [--crop=x,y,w,h] [--q=70] [--under=png] [--over=png] [--alpha] [--inject=js] [--theme=light|dark]'); process.exit(2); }
  const fps = +(opt.fps || 30), W = +(opt.w || 1280), H = +(opt.h || 720), q = +(opt.q || 70);
  const bg = String(opt.bg || 'transparent'), solid = bg !== 'transparent';
  let crop = opt.crop ? String(opt.crop).split(',').map(Number) : null;
  if (!crop) { const ch = Math.min(720, Math.round(1280 * H / W)); crop = [0, Math.round((720 - ch) / 2), 1280, ch]; }
  if (crop.length !== 4 || crop.some(n => !(n >= 0))) throw Error('--crop wants x,y,w,h');
  const dsf = Math.max(1, Math.min(3, Math.ceil(W / crop[2])));   // render sharper when the output is bigger than the crop
  const b = build(dir);
  const browser = await launch();
  let ff;
  try {
    const p = await browser.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(String(e)));
    await p.setViewport({ width: 1280, height: 720, deviceScaleFactor: dsf });
    await p.goto(url.pathToFileURL(b.out).href + '?static=1', { waitUntil: 'load' });
    const paint = solid && !opt.under ? (BG[bg] || bg) : 'transparent';
    await p.addStyleTag({ content: 'html,body{background:' + paint + '!important}#bar,#msg{display:none!important}' });
    if (opt.theme) await p.evaluate(t => { window.__theme = t; }, String(opt.theme));
    if (opt.inject) await p.evaluate(fs.readFileSync(path.resolve(String(opt.inject)), 'utf8'));
    const dur = await p.evaluate(() => window.duration || 0);
    if (!dur) throw Error('the page has no film (window.duration is 0). Run node tools/check.cjs ' + dir);
    const from = +(opt.from || 0), to = Math.min(dur, opt.to !== undefined ? +opt.to : dur);
    const N = Math.max(1, Math.round((to - from) * fps));
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    const alpha = (!solid && !opt.under) || !!opt.alpha;
    const ins = ['-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-'];
    if (opt.under) ins.push('-loop', '1', '-framerate', String(fps), '-i', path.resolve(String(opt.under)));
    if (opt.over) ins.push('-loop', '1', '-framerate', String(fps), '-i', path.resolve(String(opt.over)));
    const u = opt.under ? 1 : -1, o = opt.over ? (opt.under ? 2 : 1) : -1;
    let f = '[0:v]scale=' + W + ':' + H + ':flags=lanczos,format=rgba[c]';
    let last = 'c';
    if (u >= 0) { f += ';[' + u + ':v]format=rgba[u];[u][' + last + ']overlay=shortest=1:format=auto[a]'; last = 'a'; }
    if (o >= 0) { f += ';[' + o + ':v]format=rgba[o];[' + last + '][o]overlay=shortest=1:format=auto[b]'; last = 'b'; }
    f += ';[' + last + ']format=' + (alpha ? 'yuva420p' : 'yuv420p') + '[v]';
    ff = spawn('ffmpeg', ['-y', '-loglevel', 'error'].concat(ins, ['-filter_complex', f, '-map', '[v]', '-frames:v', String(N), '-r', String(fps),
      '-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', String(q), '-compression_level', '6', '-loop', '0', '-an', out]), { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => { ff.on('exit', c => c === 0 ? res() : rej(Error('ffmpeg exited with code ' + c))); ff.on('error', rej); });
    done.catch(() => {});
    const clip = { x: crop[0], y: crop[1], width: crop[2], height: crop[3] };
    for (let i = 0; i < N; i++) {
      await p.evaluate(tt => { window.seek(tt); if (window.__frame) window.__frame(tt); }, from + i / fps);
      const buf = Buffer.from(await p.screenshot({ type: 'png', omitBackground: !solid || !!opt.under, clip }));
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 30 === 0) process.stdout.write(`\rframe ${i}/${N}`);
    }
    ff.stdin.end();
    await done;
    console.log(`\rwrote ${out}: ${N} frames, ${(N / fps).toFixed(2)}s at ${fps} fps, ${W}x${H}, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`, errors.length ? '\nPAGE ERRORS:\n' + errors.join('\n') : '');
    if (errors.length) process.exitCode = 1;
  } catch (e) {
    if (ff) ff.kill();
    console.error('webploop failed: ' + e.message); process.exitCode = 1;
  } finally { await browser.close(); }
})();
