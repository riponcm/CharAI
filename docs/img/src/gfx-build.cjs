// Builds every readme graphic in docs/img (header, buttons, badges, feature cards, contribute card), light and dark.
// Usage (from the engine folder):  node docs/img/src/gfx-build.cjs [header|buttons|cards|contribute|all] [--only=<slug>]
// Backdrops (panel, text, icons) are drawn in a headless browser; the characters come from films/header-* and films/card-*
// through tools/webploop.cjs, which lays them over the backdrop and writes a 30 fps animated WebP.
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { launch } = require('../../../tools/render.cjs');
const ROOT = path.join(__dirname, '..', '..', '..'), IMG = path.join(ROOT, 'docs', 'img');
const TMP = path.join(require('node:os').tmpdir(), 'charai-gfx'); fs.mkdirSync(TMP, { recursive: true });
const FONT = "'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif";

const T = {
  light: { bg1: '#fffaf0', bg2: '#f7e9d2', ground: '#efd9b6', line: '#d9bb8a', border: '#ead6b0', ink: '#2e2430', mute: '#6f6259', accent: '#e8920c', accent2: '#c77a06',
    chip: '#fffdf8', chipBorder: '#ecd9b6', glow: 'rgba(255,184,77,.35)', shadow: 'rgba(120,80,30,.16)', code: '#fffdf8', codeInk: '#3a2d22', codeDim: '#9a8872', codeName: '#2f6f8f' },
  dark: { bg1: '#1b2342', bg2: '#121830', ground: '#0e1328', line: '#2d3868', border: '#2c3766', ink: '#f6f0e4', mute: '#aab3d1', accent: '#ffb84d', accent2: '#ffc97a',
    chip: '#1f2850', chipBorder: '#34417a', glow: 'rgba(255,184,77,.16)', shadow: 'rgba(0,0,0,.35)', code: '#0e1329', codeInk: '#f1ebdf', codeDim: '#7f89b0', codeName: '#7cc4e8' },
};

// ---- icons (24x24 grid, drawn with currentColor strokes) ----
const ICON = {
  bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>',
  gallery: '<rect x="3.5" y="4.5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="10" r="1.7" fill="currentColor"/><path d="M4 17l5-4.5 3.5 3L16 12l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>',
  evidence: '<path d="M4 20V4M4 20h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 16v-4M12.5 16V8M17 16v-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  docs: '<path d="M6 3.5h8l4 4V20a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 12h6M9 16h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  agent: '<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M19 3.5v3M17.5 5h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  scale: '<path d="M12 3.5v17M5 7h14M5 7l-2.5 7a3 3 0 005 0zM19 7l-2.5 7a3 3 0 005 0z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/>',
  side: '<circle cx="11" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M18 11l3.5 1.5L18 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>',
  cube: '<path d="M12 3l8 4.2v9.6L12 21l-8-4.2V7.2z M4 7.2l8 4.3 8-4.3M12 11.5V21" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  draw: '<circle cx="12" cy="6" r="2.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9.5v6M7 12.5l5-1.5 5 1.5M12 15.5l-3.5 5M12 15.5l3.5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  action: '<path d="M8 5.5v13l11-6.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  film: '<rect x="3.5" y="5" width="17" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 5v14M16 5v14M3.5 9.5H8M3.5 14.5H8M16 9.5h4.5M16 14.5h4.5" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  fix: '<path d="M14.5 6.2a4.2 4.2 0 005.3 5.3l-9.6 9.6a2.3 2.3 0 01-3.3-3.3l9.6-9.6zM14.5 6.2l2.2-2.2 3.3 3.3-2.2 2.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>',
};
const icon = (name, size, color, x = 0, y = 0) => `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" style="color:${color}" color="${color}">${ICON[name]}</svg>`;

// ---- buttons and badges (SVG) ----
const BUTTONS = [['quick-start', 'Quick start', 'bolt'], ['gallery', 'Gallery', 'gallery'], ['evidence', 'Evidence', 'evidence'], ['docs', 'Docs', 'docs'], ['agent-skill', 'Agent skill', 'agent']];
const BADGES = [['apache-2', 'Apache 2.0', 'scale'], ['side-view', 'Side view', 'side'], ['no-dependencies', 'No dependencies', 'cube']];
async function buttons(browser) {
  const p = await browser.newPage();
  const measure = async (txt, size, weight) => p.evaluate((t, s, w, f) => { const c = document.createElement('canvas').getContext('2d'); c.font = w + ' ' + s + 'px ' + f; return c.measureText(t).width; }, txt, size, weight, FONT);
  const make = async (kind, [slug, label, ic]) => {
    const big = kind === 'btn', h = big ? 40 : 26, size = big ? 15 : 12.5, weight = big ? 700 : 600, icn = big ? 20 : 15, padL = big ? 18 : 11, gap = big ? 9 : 6, padR = big ? 20 : 13, m = 3;
    const tw = Math.ceil((await measure(label, size, weight)) * 1.03), w = padL + icn + gap + tw + padR + 2 * m, H = h + 2 * m + 1;
    for (const th of ['light', 'dark']) {
      const c = T[th], fill = big ? c.chip : (th === 'light' ? '#fff6e3' : '#1a2245');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" role="img" aria-label="${label}"><title>${label}</title>` +
        `<defs><filter id="s" x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="1.5" stdDeviation="${big ? 2 : 1.4}" flood-color="${th === 'light' ? '#8a5a1a' : '#000'}" flood-opacity="${th === 'light' ? .2 : .45}"/></filter></defs>` +
        `<rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${c.chipBorder}" stroke-width="1.5" filter="url(#s)"/>` +
        icon(ic, icn, c.accent, m + padL, m + (h - icn) / 2) +
        `<text x="${m + padL + icn + gap}" y="${m + h / 2 + size * 0.36}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${c.ink}">${label}</text></svg>\n`;
      fs.writeFileSync(path.join(IMG, `${kind}-${slug}-${th}.svg`), svg);
    }
  };
  for (const b of BUTTONS) await make('btn', b);
  for (const b of BADGES) await make('badge', b);
  await p.close();
}

// ---- backdrops (HTML screenshots with transparent corners) ----
const base = (c, W, H, extra) => `<!doctype html><meta charset=utf-8><style>*{box-sizing:border-box;margin:0}html,body{width:${W}px;height:${H}px;background:transparent;font-family:${FONT};color:${c.ink};overflow:hidden}
.panel{position:absolute;inset:0;border-radius:${W > 800 ? 30 : 22}px;overflow:hidden;background:linear-gradient(${c.bg1},${c.bg2});border:1.5px solid ${c.border}}
.ground{position:absolute;left:0;right:0;bottom:0;background:${c.ground};border-top:2px solid ${c.line}}
${extra.css}</style><div class=panel>${extra.html}</div>`;
const header = (c) => ({ css: `.glow{position:absolute;right:-90px;top:-150px;width:620px;height:620px;border-radius:50%;background:radial-gradient(${c.glow},transparent 68%)}
.glow2{position:absolute;left:-120px;bottom:-200px;width:520px;height:520px;border-radius:50%;background:radial-gradient(${c.glow},transparent 70%)}
h1{position:absolute;left:68px;top:46px;font-size:100px;font-weight:800;letter-spacing:-3px;line-height:1}h1 b{color:${c.accent}}
p{position:absolute;left:72px;top:170px;font-size:29px;line-height:1.28;font-weight:500;color:${c.mute}}
.chips{position:absolute;left:72px;top:268px;display:flex;gap:10px}.chips span{font-size:15px;font-weight:600;padding:7px 15px;border-radius:99px;background:${c.chip};border:1.5px solid ${c.chipBorder};color:${c.ink};box-shadow:0 2px 6px ${c.shadow}}
.chips i{display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.accent};margin-right:8px}
.ground{height:28px}`, html: `<div class=glow></div><div class=glow2></div><h1>Char<b>AI</b></h1><p>Draw any person as data.<br>Direct them with a script.</p>
<div class=chips><span><i></i>Side view</span><span><i></i>Plain-data skins</span><span><i></i>No dependencies</span></div><div class=ground></div>` });
const card = (c, title, noGround) => ({ css: `.glow{position:absolute;right:-60px;top:-80px;width:300px;height:300px;border-radius:50%;background:radial-gradient(${c.glow},transparent 68%)}
.t{position:absolute;left:20px;top:17px;font-size:17px;font-weight:700;letter-spacing:-.2px;display:flex;align-items:center;gap:8px}.t:before{content:"";width:7px;height:18px;border-radius:4px;background:${c.accent}}
.ground{height:32px}`, html: `<div class=glow></div><div class=t>${title}</div>${noGround ? '' : '<div class=ground></div>'}` });
const contribute = (c) => {
  const ways = [['draw', 'Draw a character'], ['action', 'Add an action'], ['film', 'Write an example film'], ['fix', 'Fix a known issue']];
  const chip = ([ic, label]) => `<div class=chip><div class=ic><svg width=22 height=22 viewBox="0 0 24 24" style="color:${th2(c)}">${ICON[ic]}</svg></div>${label}</div>`;
  return { css: `.glow{position:absolute;right:20px;top:-60px;width:560px;height:560px;border-radius:50%;background:radial-gradient(${c.glow},transparent 66%)}
h2{position:absolute;left:60px;top:30px;font-size:46px;font-weight:800;letter-spacing:-1.2px}h2 b{color:${c.accent}}
.sub{position:absolute;left:62px;top:92px;font-size:19px;color:${c.mute};font-weight:500}
.grid{position:absolute;left:60px;top:136px;display:grid;grid-template-columns:repeat(2,270px);gap:12px}
.chip{display:flex;align-items:center;gap:12px;height:52px;padding:0 16px 0 9px;border-radius:26px;background:${c.chip};border:1.5px solid ${c.chipBorder};font-size:17px;font-weight:700;box-shadow:0 3px 8px ${c.shadow}}
.ic{width:34px;height:34px;border-radius:50%;background:${c.glow};display:flex;align-items:center;justify-content:center}.ground{height:24px}`,
    html: `<div class=glow></div><h2>Make Char<b>AI</b> better</h2><div class=sub>Four ways to jump in. Pick one, open a pull request.</div><div class=grid>${ways.map(chip).join('')}</div><div class=ground></div>` };
};
const th2 = (c) => c.accent2;

async function shot(browser, c, W, H, parts, out) {
  const p = await browser.newPage();
  await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await p.setContent(base(c, W, H, parts), { waitUntil: 'load' });
  await p.screenshot({ path: out, omitBackground: true, type: 'png' });
  await p.close();
}

// ---- the animated items ----
const CARD = { W: 420, H: 260, cx: 430, cy: 372 };   // card 420x260 shows film pixels x 430..850, y 372..632 (ground at y 600 = card y 228)
const ITEMS = [
  { id: 'header', out: 'header', W: 1280, H: 360, film: 'films/header-hero', crop: '0,268,1280,360', from: 0, to: 7, q: 80, back: header },
  { id: 'bodies', out: 'feature-any-body-from-numbers', title: 'Any body from numbers', film: 'films/card-bodies', from: 0, to: 3 },
  { id: 'physics', out: 'feature-physics-that-settles', title: 'Physics that settles', film: 'films/card-physics', from: 0, to: 4 },
  { id: 'moods', out: 'feature-moods-change-the-walk', title: 'Moods change the walk', film: 'films/card-moods', from: 1.9667, to: 5.9, inject: 'inject-moods.js' },
  { id: 'speech', out: 'feature-speech-and-lip-sync', title: 'Speech and lip sync', film: 'films/card-speech', from: 0, to: 3.2, crop: '430,222,420,260', noGround: true },
  { id: 'touch', out: 'feature-characters-that-touch', title: 'Characters that touch', film: 'films/card-touch', from: 0, to: 4 },
  { id: 'script', out: 'feature-one-line-of-script', title: 'One line of script', film: 'films/card-script', from: 0, to: 4, inject: 'inject-script.js' },
  { id: 'contribute', out: 'contribute', W: 1280, H: 300, film: 'films/header-contribute', crop: '0,324,1280,300', from: 0, to: 5.2, q: 80, back: contribute },
];
async function animated(browser, which, only) {
  for (const it of ITEMS) {
    const isCard = !it.W;
    if (which === 'cards' ? !isCard : which === 'header' ? it.id !== 'header' : which === 'contribute' ? it.id !== 'contribute' : false) continue;
    if (only && it.id !== only) continue;
    const W = it.W || CARD.W, H = it.H || CARD.H, crop = it.crop || `${CARD.cx},${CARD.cy},${CARD.W},${CARD.H}`;
    for (const th of ['light', 'dark']) {
      const c = T[th], under = path.join(TMP, `${it.id}-${th}.png`);
      await shot(browser, c, W, H, it.back ? it.back(c) : card(c, it.title, it.noGround), under);
      const args = ['tools/webploop.cjs', it.film, path.join(IMG, `${it.out}-${th}.webp`), `--from=${it.from}`, `--to=${it.to}`, `--fps=30`, `--w=${W}`, `--h=${H}`,
        `--crop=${crop}`, `--under=${under}`, '--alpha', `--q=${it.q || 72}`, `--theme=${th}`];
      if (it.inject) args.push('--inject=' + path.join(__dirname, it.inject));
      const r = spawnSync('node', args, { cwd: ROOT, encoding: 'utf8' });
      console.log((r.stdout || '').split('\r').pop().trim(), r.stderr || '');
    }
  }
}

(async () => {
  const args = process.argv.slice(2), which = args.find(a => !a.startsWith('--')) || 'all', only = (args.find(a => a.startsWith('--only=')) || '').slice(7);
  const browser = await launch();
  try {
    if (which === 'all' || which === 'buttons') await buttons(browser);
    if (which !== 'buttons') await animated(browser, which, only);
  } finally { await browser.close(); }
})();
