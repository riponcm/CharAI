// Export a film as one animated SVG (a vector flip-book): every frame is a real vector frame from the
// engine, and a stepped CSS animation shows one at a time. Needs no browser and no npm install.
// Usage: node tools/svgloop.cjs <film dir> <out.svg> [--from=0] [--to=<end>] [--fps=10]
//          [--crop=x,y,w,h]   the part of the 1280x720 film frame to keep (default: all)
//          [--round=24]       rounded corners (px) on the whole picture
//          [--under=f.svg]    SVG markup drawn behind the characters (panel, text), in output coordinates
//          [--over=f.svg]     SVG markup drawn in front of them
//          [--still=<s>]      the film time shown when the reader asks for reduced motion (default: middle)
//          [--decimals=0]     digits kept after the point, in pixels (0 = whole pixels: smallest file, still crisp)
// The film must be seamless between --from and --to (the frame at --to is not drawn; it equals the first).
// The result has no scripts, no external files and no fonts; it works inside an <img> tag on GitHub.
// Use a bare stage (no `set` line): scenery would be repeated in every frame. Actors that are completely
// outside the crop are left out of a frame, and path shapes that repeat between frames are stored once.
const fs = require('node:fs'), path = require('node:path');
const { loadEngine, build } = require('./check.cjs');

function parseArgs(argv) {
  const pos = argv.filter(a => !a.startsWith('--'));
  const opt = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return [m[1], m[2] ?? true]; }));
  return { pos, opt };
}

const NUM = /-?\d*\.?\d+(?:e-?\d+)?/gi;
const trimNum = (v, dec) => { const s = (+v).toFixed(dec).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''); return s === '-0' ? '0' : s; };
const roundNums = (str, dec) => str.replace(NUM, m => trimNum(m, dec));

// Scale an absolute path (M L C Q Z A) by S, round to dec digits and write it back in the shortest form:
// relative commands, no separator before a minus sign. Null for any other command.
function scalePath(d, Sx, Sy, dec) {
  if (!/^[MLCQZA\d\s.,e-]+$/.test(d)) return null;
  const q = 10 ** dec, rx = n => Math.round(n * Sx * q) / q, ry = n => Math.round(n * Sy * q) / q, size = { M: 2, L: 2, C: 6, Q: 4, A: 7, Z: 0 };
  let out = '', cx = 0, cy = 0, sx = 0, sy = 0, first = true, prev = false;
  const put = n => { const t = trimNum(n, dec); out += (prev && n >= 0 && t[0] !== '-' ? ' ' : '') + t; prev = true; };
  for (const seg of d.match(/[MLCQZA][^MLCQZA]*/g) || []) {
    let cmd = seg[0];
    const nums = (seg.slice(1).match(NUM) || []).map(Number), n = size[cmd];
    if (cmd === 'Z') { out += 'z'; prev = false; cx = sx; cy = sy; continue; }
    if (!n || nums.length % n) return null;
    for (let k = 0; k < nums.length; k += n) {
      const v = nums.slice(k, k + n);
      if (cmd === 'A') {   // rx ry rotation large sweep x y
        out += 'a'; prev = false; put(rx(v[0])); put(ry(v[1])); put(v[2]); put(v[3]); put(v[4]);
        const x = rx(v[5]), y = ry(v[6]); put(x - cx); put(y - cy); cx = x; cy = y; continue;
      }
      if (cmd === 'M' && first) { out += 'M'; prev = false; cx = rx(v[0]); cy = ry(v[1]); put(cx); put(cy); sx = cx; sy = cy; first = false; continue; }
      out += cmd.toLowerCase(); prev = false;
      let ex = cx, ey = cy;
      for (let i = 0; i < n; i += 2) { const x = rx(v[i]), y = ry(v[i + 1]); put(x - cx); put(y - cy); ex = x; ey = y; }
      cx = ex; cy = ey;
      if (cmd === 'M') { sx = cx; sy = cy; }
    }
  }
  return out;
}

// A transform list of matrix(), translate() and scale() as one matrix [a b c d e f]; null for anything else.
function matrixOf(list) {
  let M = [1, 0, 0, 1, 0, 0];
  const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
  const parts = list.trim().match(/[a-z]+\([^)]*\)/g);
  if (!parts || parts.join(' ') !== list.trim().replace(/\)\s+/g, ') ')) return null;
  for (const p of parts) {
    const name = p.slice(0, p.indexOf('(')), v = p.slice(p.indexOf('(') + 1, -1).trim().split(/[\s,]+/).map(Number);
    if (v.some(isNaN)) return null;
    if (name === 'matrix' && v.length === 6) M = mul(M, v);
    else if (name === 'translate' && v.length <= 2) M = mul(M, [1, 0, 0, 1, v[0], v[1] || 0]);
    else if (name === 'scale' && v.length <= 2) M = mul(M, [v[0], 0, 0, v.length > 1 ? v[1] : v[0], 0, 0]);
    else return null;
  }
  return M;
}

// The engine draws a character in body units under scale(S -S). Re-express each such group in pixels (path
// numbers x S, scale(1 -1)) so a whole pixel is the unit of rounding: far shorter numbers, and shapes that
// barely moved become identical from frame to frame. A group with anything unusual inside is kept as it is.
function toPixels(all, ctx) {
  const re = /<g transform="translate\(([-\d.]+) ([-\d.]+)\) scale\((-?[\d.]+) -([\d.]+)\)">((?:<path [^>]*\/>)*)<\/g>/g;
  return all.replace(re, (whole, tx, ty, sx, sy, inner) => {
    const Sx = Math.abs(+sx), Sy = +sy, flip = +sx < 0;
    let ok = true;
    const conv = inner.replace(/<path ([^>]*)\/>/g, (pw, attrs) => {
      let a = ' ' + attrs;
      const dm = a.match(/\sd="([^"]*)"/);
      const nd = dm && !/stroke-dasharray/.test(a) ? scalePath(dm[1], Sx, Sy, ctx.dec) : null;
      if (nd === null) { ok = false; return pw; }
      a = a.replace(dm[0], ' d="' + nd + '"');
      const tm = a.match(/\stransform="([^"]*)"/);
      if (tm) {
        const v = matrixOf(tm[1]);
        if (!v) { ok = false; return pw; }
        a = a.replace(tm[0], ' transform="matrix(' + [v[0], v[1] * Sy / Sx, v[2] * Sx / Sy, v[3], v[4] * Sx, v[5] * Sy].map(n => trimNum(n, 3)).join(' ') + ')"');
      }
      a = a.replace(/\sstroke-width="([^"]*)"/, (q, w) => ' stroke-width="' + trimNum(+w * Math.sqrt(Sx * Sy), 3) + '"');
      return '<path' + a + '/>';
    });
    return ok ? '<g transform="translate(' + tx + ' ' + ty + ') scale(' + (flip ? -1 : 1) + ' -1)">' + conv + '</g>' : whole;
  });
}

// Leave out actors that are completely outside the crop. An actor is a group translate(x y) holding one
// group translate(..) scale(S -S); the camera group above them is translate scale translate.
function dropOffstage(all, ctx) {
  const cam = all.match(/<g transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\) translate\(([-\d.]+) ([-\d.]+)\)">/);
  if (!cam) return all;
  const [cx, cy, cw, ch] = ctx.crop, z = +cam[3];
  const re = /<g transform="translate\(([-\d.]+) ([-\d.]+)\)"><g transform="translate\([-\d.]+ [-\d.]+\) scale\(-?([\d.]+) -[\d.]+\)">/g;
  let m, res = '', last = 0;
  while ((m = re.exec(all))) {
    const S = +m[3], sx = +cam[1] + z * (+m[1] + +cam[4]), sy = +cam[2] + z * (+m[2] + +cam[5]), r = 3 * S * z;
    // find the end of the actor group by balancing <g> tags
    const tagRe = /<(\/?)g\b[^>]*?(\/?)>/g; tagRe.lastIndex = m.index;
    let depth = 0, t, end = -1;
    while ((t = tagRe.exec(all))) { if (t[2] === '/') continue; depth += t[1] ? -1 : 1; if (depth === 0) { end = tagRe.lastIndex; break; } }
    if (end < 0) break;
    if (sx < cx - r || sx > cx + cw + r || sy - 8 * S * z > cy + ch || sy + 2 * S * z < cy) { res += all.slice(last, m.index); last = end; }
    re.lastIndex = end;
  }
  return res + all.slice(last);
}

// Turn one engine frame (an SVG string) into pieces: markup strings and { d, cls, tr } path records.
function convertFrame(svg, ctx) {
  const open = svg.indexOf('<g clip-path="url(#frameclip)">');
  if (open < 0) throw Error('unexpected frame markup (no frame clip)');
  const head = svg.slice(0, open);
  const body = svg.slice(open + '<g clip-path="url(#frameclip)">'.length, svg.lastIndexOf('</g></svg>'));
  // ids: keep each frame's own gradients and clips apart from the other frames
  const idRe = /\bid="([^"]+)"/g;
  const ids = [...new Set([...head.matchAll(idRe)].map(m => m[1]).concat([...body.matchAll(idRe)].map(m => m[1])))].filter(i => i !== 'frameclip' && i !== 'cardbg');
  const dm = head.match(/<defs>([\s\S]*)<\/defs>/);
  const defs = dm && ids.length ? dm[1].replace(/<linearGradient id="cardbg"[\s\S]*?<\/linearGradient>/, '') : '';
  let all = (defs ? '<defs>' + defs + '</defs>' : '') + body;
  for (const id of ids) all = all.split('id="' + id + '"').join('id="' + ctx.prefix + id + '"').split('#' + id + ')').join('#' + ctx.prefix + id + ')');
  all = toPixels(dropOffstage(all, ctx), ctx);
  const out = [], pathRe = /<path ([^>]*)\/>/g;
  let m, last = 0;
  while ((m = pathRe.exec(all))) {
    out.push(all.slice(last, m.index)); last = pathRe.lastIndex;
    const attrs = ' ' + m[1];
    const get = n => { const r = attrs.match(new RegExp('\\s' + n + '="([^"]*)"')); return r ? r[1] : null; };
    const d = roundNums(get('d') || '', 3), tr = get('transform');
    const style = [];
    for (const am of attrs.matchAll(/\s([a-zA-Z:-]+)="([^"]*)"/g)) if (!['d', 'transform', 'id'].includes(am[1])) style.push(am[1] + ':' + am[2]);
    const st = style.sort().join(';');
    if (!ctx.styles.has(st)) ctx.styles.set(st, 'c' + ctx.styles.size.toString(36));
    const cls = ctx.styles.get(st);
    out.push({ d, cls, tr: tr ? roundNums(tr, 2) : '' });
    const k = d + '|' + cls;
    ctx.paths.set(k, (ctx.paths.get(k) || 0) + 1);
  }
  out.push(all.slice(last));
  return out;
}

function main() {
  const { pos, opt } = parseArgs(process.argv.slice(2));
  const [dir, outFile] = pos;
  if (!dir || !outFile) {
    console.error('usage: node tools/svgloop.cjs <film dir> <out.svg> [--from=0] [--to=<end>] [--fps=10] [--crop=x,y,w,h] [--round=24] [--under=f.svg] [--over=f.svg] [--still=s] [--decimals=0]');
    process.exit(2);
  }
  const b = build(dir);
  const eng = loadEngine(dir);
  const film = eng.CharStage.compile(eng.CharScript.parse(b.text), eng.lib);
  if (film.diagnostics.some(d => d.severity === 'error')) { console.error('the film has errors; run node tools/check.cjs ' + dir); process.exit(1); }
  const fps = +(opt.fps || 10), from = +(opt.from || 0), to = Math.min(film.duration, opt.to !== undefined ? +opt.to : film.duration);
  const N = Math.max(1, Math.round((to - from) * fps)), T = N / fps;
  const crop = opt.crop ? String(opt.crop).split(',').map(Number) : [0, 0, 1280, 720];
  if (crop.length !== 4 || crop.some(isNaN)) throw Error('--crop needs x,y,w,h');
  const read = f => f ? fs.readFileSync(String(f), 'utf8').replace(/^\s*<\?xml[^>]*>\s*/, '') : '';
  const ctx = { crop, dec: opt.decimals !== undefined ? +opt.decimals : 0, paths: new Map(), styles: new Map(), prefix: '' };
  const frames = [];
  for (let i = 0; i < N; i++) { ctx.prefix = 'f' + i + '_'; frames.push(convertFrame(film.frame(from + i / fps), ctx)); }
  // path shapes used on more than one page go into <defs> once, with their style class
  const shared = new Map();
  for (const [k, n] of ctx.paths) if (n > 1) shared.set(k, 'p' + shared.size.toString(36));
  const still = Math.max(0, Math.min(N - 1, Math.round(((opt.still !== undefined ? +opt.still : (from + to) / 2) - from) * fps)));
  const pathTag = (r, withTr) => {
    const id = shared.get(r.d + '|' + r.cls), tr = withTr && r.tr ? ` transform="${r.tr}"` : '';
    return id ? `<use href="#${id}"${tr}/>` : `<path d="${r.d}" class="${r.cls}"${tr}/>`;
  };
  const pages = frames.map((parts, i) => {
    let inner = '', run = [];
    const flush = () => {   // consecutive paths with the same transform share one group
      for (let j = 0; j < run.length;) {
        let e = j; while (e + 1 < run.length && run[e + 1].tr === run[j].tr) e++;
        const grp = run.slice(j, e + 1);
        inner += e > j && run[j].tr ? `<g transform="${run[j].tr}">${grp.map(r => pathTag(r, false)).join('')}</g>` : grp.map(r => pathTag(r, true)).join('');
        j = e + 1;
      }
      run = [];
    };
    for (const p of parts) { if (typeof p === 'string') { if (p) { flush(); inner += p; } } else run.push(p); }
    flush();
    return `<g class="f${i === still ? ' s' : ''}"${i ? ` style="animation-delay:${trimNum(i / fps, 3)}s"` : ''}>${inner}</g>`;
  });
  const W = crop[2], H = crop[3], R = opt.round ? +opt.round : 0;
  const css = [...ctx.styles].map(([st, c]) => `.${c}{${st}}`).join('')
    + `.f{visibility:hidden;animation:p ${trimNum(T, 3)}s linear infinite}`
    + `@keyframes p{0%{visibility:visible}${(100 / N).toFixed(4)}%{visibility:hidden}100%{visibility:hidden}}`
    + `@media (prefers-reduced-motion:reduce){.f{animation:none}.f.s{visibility:visible}}`;
  const defs = (R ? `<clipPath id="rc"><rect width="${W}" height="${H}" rx="${R}"/></clipPath>` : '')
    + [...shared].map(([k, id]) => { const q = k.lastIndexOf('|'); return `<path id="${id}" class="${k.slice(q + 1)}" d="${k.slice(0, q)}"/>`; }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`
    + `<style>${css}</style><defs>${defs}</defs>`
    + `<g${R ? ' clip-path="url(#rc)"' : ''}>${read(opt.under)}<g transform="translate(${-crop[0]} ${-crop[1]})">${pages.join('')}</g>${read(opt.over)}</g></svg>`;
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, svg);
  console.log(`wrote ${outFile}: ${Buffer.byteLength(svg)} bytes (${(svg.length / 1024).toFixed(0)} KB), ${N} frames at ${fps} fps, loop ${T.toFixed(2)} s, ${W}x${H}, ${shared.size} shared paths, still frame ${still}`);
}
if (require.main === module) main();
module.exports = { convertFrame, toPixels, scalePath };
