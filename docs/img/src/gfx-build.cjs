// Builds every readme graphic in docs/img (header SVG, buttons, badges, feature cards, contribute card), light and dark.
// Usage (from the engine folder):  node docs/img/src/gfx-build.cjs [header|buttons|cards|contribute|all] [--only=<slug>]
// The header is an animated SVG made by tools/svgloop.cjs from films/header. Card backdrops are drawn in a headless browser; the characters come from films/header-* and films/card-*
// through tools/webploop.cjs, which lays them over the backdrop and writes a 30 fps animated WebP.
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { launch } = require('../../../tools/render.cjs');
const ROOT = path.join(__dirname, '..', '..', '..'), IMG = path.join(ROOT, 'docs', 'img');
const TMP = path.join(require('node:os').tmpdir(), 'charai-gfx'); fs.mkdirSync(TMP, { recursive: true });
const FONT = 'system-ui,"Segoe UI",Helvetica,Arial,sans-serif';

// Colours: a warm neutral ramp and one ember accent.
// Only the characters are colourful. No gradients between hues, no glows; depth from surface steps and hairlines.
const T = {
  light: { panel: '#f7f4ee', card: '#fdfbf7', raised: '#efe9df', ink: '#1f1b16', sec: '#5e554a', mute: '#7b7266', hair: 'rgba(31,27,22,.08)', accent: '#c2410c', onAccent: '#ffffff' },
  dark: { panel: '#161513', card: '#1c1a18', raised: '#262421', ink: '#efe9de', sec: '#aaa398', mute: '#8a847a', hair: 'rgba(239,233,222,.08)', accent: '#f08a4b', onAccent: '#12110f' },
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
const icon = (name, size, color, x = 0, y = 0) => `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" style="color:${color}" color="${color}">${ICON[name].replace(/stroke-width="[0-9.]+"/g, 'stroke-width="2"')}</svg>`;

// ---- buttons and badges (SVG) ----
const BUTTONS = [['quick-start', 'Quick start', 'bolt'], ['gallery', 'Gallery', 'gallery'], ['evidence', 'Evidence', 'evidence'], ['docs', 'Docs', 'docs'], ['agent-skill', 'Agent skill', 'agent']];
const BADGES = [['apache-2', 'Apache 2.0', 'scale'], ['side-view', 'Side view', 'side'], ['no-dependencies', 'No dependencies', 'cube']];
async function buttons(browser) {
  const p = await browser.newPage();
  const measure = async (txt, size, weight) => p.evaluate((t, s, w, f) => { const c = document.createElement('canvas').getContext('2d'); c.font = w + ' ' + s + 'px ' + f; return c.measureText(t).width; }, txt, size, weight, FONT);
  const make = async (kind, [slug, label, ic]) => {
    const big = kind === 'btn', h = big ? 40 : 26, size = big ? 15 : 12.5, weight = big ? 500 : 400, icn = big ? 20 : 15, padL = big ? 16 : 10, gap = big ? 9 : 6, padR = big ? 18 : 12, m = 3, r = big ? 10 : 8;
    const tw = Math.ceil((await measure(label, size, weight)) * 1.03), w = padL + icn + gap + tw + padR + 2 * m, H = h + 2 * m + 1;
    const primary = slug === 'quick-start';
    for (const th of ['light', 'dark']) {
      const c = T[th], fill = primary ? c.accent : big ? c.raised : c.card, stroke = primary ? c.accent : c.hair;
      const tc = primary ? c.onAccent : big ? c.ink : c.mute, ac = primary ? c.onAccent : big ? c.sec : c.mute;
      const sh = th === 'light' ? `<defs><filter id="s" x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000" flood-opacity="0.05"/></filter></defs>` : '';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" role="img" aria-label="${label}"><title>${label}</title>` + sh +
        `<rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1"${sh ? ' filter="url(#s)"' : ''}/>` +
        icon(ic, icn, ac, m + padL, m + (h - icn) / 2) +
        `<text x="${m + padL + icn + gap}" y="${m + h / 2 + size * 0.36}" font-family='${FONT}' font-size="${size}" font-weight="${weight}" fill="${tc}">${label}</text></svg>
`;
      fs.writeFileSync(path.join(IMG, `${kind}-${slug}-${th}.svg`), svg);
    }
  };
  // The five btn-*.svg files are the hand-tuned "one strip" set (they join edge to edge in the readme), so they are
  // not rebuilt here; only the badges are. Pass --rebuild-buttons to overwrite them with the older separate buttons.
  if (process.argv.includes('--rebuild-buttons')) for (const b of BUTTONS) await make('btn', b);
  for (const b of BADGES) await make('badge', b);
  await p.close();
}

// ---- the header: a vector flip-book SVG (tools/svgloop.cjs) with the panel and text from header-under.svgfrag ----
function headerSvg() {
  const tpl = fs.readFileSync(path.join(__dirname, 'header-under.svgfrag'), 'utf8');
  for (const th of ['light', 'dark']) {
    const c = T[th], fill = t => t.replace(/@([A-Za-z]+)@/g, (_, k) => k === 'FONT' ? FONT : c[k.toLowerCase()]);
    const under = path.join(TMP, `header-under-${th}.svg`), over = path.join(TMP, `header-over-${th}.svg`);
    fs.writeFileSync(under, fill(tpl));
    fs.writeFileSync(over, `<rect x=".5" y=".5" width="1279" height="359" rx="19.5" fill="none" stroke="${c.ink}" stroke-opacity=".08"/>`);
    const r = spawnSync('node', ['tools/svgloop.cjs', 'films/header', path.join(IMG, `header-${th}.svg`), '--fps=10', '--crop=0,360,1280,360', '--round=20', '--under=' + under, '--over=' + over], { cwd: ROOT, encoding: 'utf8' });
    console.log((r.stdout || '').trim(), r.stderr || '');
  }
}

// ---- backdrops (HTML screenshots with transparent corners): card surface, hairline, radius 14, one ink ground line ----
const base = (c, W, H, extra) => `<!doctype html><meta charset=utf-8><style>*{box-sizing:border-box;margin:0}html,body{width:${W}px;height:${H}px;background:transparent;font-family:${FONT};color:${c.ink};overflow:hidden}
.panel{position:absolute;inset:0;border-radius:14px;overflow:hidden;background:${c.card};border:1px solid ${c.hair}}
.ground{position:absolute;left:0;right:0;bottom:0;background:${c.raised};border-top:2px solid ${c.ink}}
.mark{display:block;width:3px;height:16px;border-radius:2px;background:${c.accent}}
${extra.css}</style><div class=panel>${extra.html}</div>`;
const card = (c, title, noGround) => ({ css: `.t{position:absolute;left:20px;top:17px;font-size:17px;font-weight:500;display:flex;align-items:center;gap:9px}.ground{height:32px}`,
  html: `<div class=t><i class=mark></i>${title}</div>${noGround ? '' : '<div class=ground></div>'}` });
const contribute = (c) => {
  const ways = [['draw', 'Draw a character'], ['action', 'Add an action'], ['film', 'Write an example film'], ['fix', 'Fix a known issue']];
  const chip = ([ic, label]) => `<div class=chip><svg width=22 height=22 viewBox="0 0 24 24" style="color:${c.sec}">${ICON[ic].replace(/stroke-width="[0-9.]+"/g, 'stroke-width="2"')}</svg>${label}</div>`;
  return { css: `h2{position:absolute;left:60px;top:30px;font-size:46px;font-weight:500;letter-spacing:-1px}
.mark{position:absolute;left:60px;top:22px;width:40px;height:4px}
.sub{position:absolute;left:62px;top:92px;font-size:19px;color:${c.sec};font-weight:400}
.grid{position:absolute;left:60px;top:136px;display:grid;grid-template-columns:repeat(2,270px);gap:12px}
.chip{display:flex;align-items:center;gap:12px;height:52px;padding:0 16px;border-radius:10px;background:${c.raised};border:1px solid ${c.hair};font-size:17px;font-weight:500}
.ground{height:24px}`,
    html: `<i class=mark></i><h2>Make CharAI better</h2><div class=sub>Four ways to jump in. Pick one, open a pull request.</div><div class=grid>${ways.map(chip).join('')}</div><div class=ground></div>` };
};

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
    if (which === 'cards' ? !isCard : which === 'header' ? true : which === 'contribute' ? it.id !== 'contribute' : false) continue;
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
    if (which === 'all' || which === 'header') headerSvg();
    if (which !== 'buttons') await animated(browser, which, only);
  } finally { await browser.close(); }
})();
