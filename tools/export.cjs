// Export a film with a transparent background (characters only, no scenery).
// Usage: node tools/export.cjs films/<name> <out> --format=png|webm|mov [--fps=30] [--w=1280] [--h=720] [--from=0] [--to=<end>]
//   png : <out> is a folder of frame_00001.png ...   webm : VP9 with alpha (yuva420p)   mov : ProRes 4444 with alpha (yuva444p10le)
// A film with a `set` line draws its own scenery; only a bare-stage film is fully transparent.
const fs = require('node:fs'), path = require('node:path'), url = require('node:url'), { spawn } = require('node:child_process');
const { build } = require('./check.cjs');
const { launch } = require('./render.cjs');

(async () => {
  const args = process.argv.slice(2);
  const pos = args.filter(a => !a.startsWith('--'));
  const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return [m[1], m[2] ?? true]; }));
  const [dir, out] = pos, format = opt.format || 'png';
  if (!dir || !out || !['png', 'webm', 'mov'].includes(format)) { console.error('usage: node tools/export.cjs films/<name> <out> --format=png|webm|mov [--fps=30] [--w=1280] [--h=720] [--from=0] [--to=<end>]'); process.exit(2); }
  const fps = +(opt.fps || 30), W = +(opt.w || 1280), H = +(opt.h || 720);
  const b = build(dir);
  const browser = await launch();
  let ff, done;
  try {
    const p = await browser.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(String(e)));
    await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await p.goto(url.pathToFileURL(b.out).href + '?static=1', { waitUntil: 'load' });
    await p.addStyleTag({ content: 'html,body{background:transparent!important}#bar,#msg{display:none!important}' });
    const dur = await p.evaluate(() => window.duration || 0);
    if (!dur) throw Error('the page has no film (window.duration is 0). Run node tools/check.cjs ' + dir);
    const from = +(opt.from || 0), to = Math.min(dur, opt.to !== undefined ? +opt.to : dur);
    const N = Math.max(1, Math.round((to - from) * fps));
    if (format === 'png') fs.mkdirSync(path.resolve(out), { recursive: true });
    else {
      fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
      const enc = format === 'webm'
        ? ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-b:v', '0', '-crf', '24']
        : ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-vendor', 'apl0'];
      ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-'].concat(enc, ['-r', String(fps), out]), { stdio: ['pipe', 'inherit', 'inherit'] });
      done = new Promise((res, rej) => { ff.on('exit', c => c === 0 ? res() : rej(Error('ffmpeg exited with code ' + c))); ff.on('error', rej); });
      done.catch(() => {});
    }
    for (let i = 0; i < N; i++) {
      await p.evaluate(tt => window.seek(tt), from + i / fps);
      const buf = Buffer.from(await p.screenshot({ type: 'png', omitBackground: true }));
      if (format === 'png') fs.writeFileSync(path.join(path.resolve(out), 'frame_' + String(i + 1).padStart(5, '0') + '.png'), buf);
      else if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 30 === 0) process.stdout.write(`\rframe ${i}/${N}`);
    }
    if (ff) { ff.stdin.end(); await done; }
    console.log(`\rwrote ${out}: ${N} frames at ${fps} fps, ${W}x${H}, ${format}`, errors.length ? '\nPAGE ERRORS:\n' + errors.join('\n') : '');
    if (errors.length) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(e => { console.error(e.message); process.exit(1); });
