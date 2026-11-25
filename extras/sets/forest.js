// sets/forest.js - a forest path at dusk that passes a rocky knoll with a cave mouth, then runs on
// into open ground under the moon. Format: see sets/hillside.js.
//
// Layout (x in set px): forest path 0..880 | rock knoll + cave 880..1880 (mouth 1130..1590) |
// open path 1820..2600 under the moon. Ground is nearly flat (y ~ 520).
// Anchors: left 150, path 400, edge 560 (a trembling spot), stop 680, near 1125 (stand here to
// reach a creature sitting in the cave mouth), cave 1380 (a big creature sits here, in the mouth),
// thorn [1185, ~410] (where a bear puppet's raised paw is when it sits at `cave` with scale=1.15,
// facing left, in state whimper), beyond 1900, moonpath 2250, right 2450.
// Variants: dusk (default), night.
(function (g) {
  'use strict';
  const W = 2600, H = 720;
  const CX = 1360, MW = 230, MH = 385;          // cave mouth centre, half width, height
  const K0 = 880, K1 = 1880;                    // rock knoll extent
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const r1 = v => Math.round(v * 10) / 10;
  const ground = x => 522 - 5 * Math.sin(x / 260 + 0.4) - 3 * Math.sin(x / 97 + 1);
  const span = d => 1280 + (W - 1280) * d;
  function fillUnder(f, x0, x1, bottom, step) {
    let d = `M${x0} ${bottom}`;
    for (let x = x0; x <= x1 + step; x += step) d += `L${r1(Math.min(x, x1))} ${r1(f(Math.min(x, x1)))}`;
    return d + `L${x1} ${bottom}Z`;
  }
  const line = (f, x0, x1, step) => { let d = ''; for (let x = x0; x <= x1 + 1e-6; x += step) d += (d ? 'L' : 'M') + r1(x) + ' ' + r1(f(x)); return d; };
  function fir(x, y, s, col) {   // a layered fir silhouette
    let o = `<g fill="${col}"><rect x="${r1(x - s * 0.06)}" y="${r1(y - s * 0.3)}" width="${r1(s * 0.12)}" height="${r1(s * 0.32)}"/>`;
    for (let k = 0; k < 3; k++) {
      const yb = y - s * (0.22 + k * 0.28), w = s * (0.42 - k * 0.1), h = s * 0.5;
      o += `<path d="M${r1(x - w)} ${r1(yb)}L${r1(x)} ${r1(yb - h)}L${r1(x + w)} ${r1(yb)}Z"/>`;
    }
    return o + '</g>';
  }
  // the knoll's outline: rises from the path, a round top, falls back down
  const knoll = x => {
    if (x <= K0 || x >= K1) return ground(x);
    const u = (x - K0) / (K1 - K0);
    return ground(x) - 480 * Math.pow(Math.sin(Math.PI * u), 0.8) - 18 * Math.sin(x / 40) * Math.sin(Math.PI * u);
  };
  // the arch of the mouth (top edge), for x in CX-MW .. CX+MW
  const arch = x => { const u = (x - CX) / MW; return ground(x) + 4 - MH * Math.sqrt(Math.max(0, 1 - u * u * u * u)) + 10 * Math.sin(x / 23); };

  const set = {
    name: 'forest', width: W, height: H, ground, actorScale: 68,
    camera: { x: 640, lift: [132, 24] },   // same framing as ravine: zoom 2 = kneeling child, zoom 4 = waist-up
    anchors: {
      left: 150, path: 400, edge: 560, stop: 680, near: 1125, cave: 1380, thorn: [1185, r1(ground(1185) - 110)],
      beyond: 1900, moonpath: 2250, right: 2450,
    },
    palette: {
      skyTop: '#1c1f4a', skyMid: '#4f3c74', skyBottom: '#e07f5c', moon: '#fbf3d4', moonShade: '#e6dab0', moonGlow: '#f8e9c0', stars: 0.8,
      ridge: '#3f3866', firFar: '#342e58', firMid: '#262447', trunk: '#1e1b33', canopy: '#211e3a',
      floor: '#344233', floorDark: '#1b2219', path: '#8c7759', pathEdge: '#6a5844', moss: '#4f6b3e', mossLight: '#6e8b4f',
      rock: '#4e4864', rockLight: '#706989', rockDark: '#2e2a40', caveIn: '#0c0a12', caveMid: '#1d1828',
      fern: '#151a14', firefly: '#e9f59a', mushroom: '#d96d5a',
      tint: '#2b2560', tintOpacity: 0.3, light: '#ff9a6a', lightOpacity: 0.16, glow: 1,
    },
    variants: {
      dusk: {},
      night: { skyTop: '#0b0d26', skyMid: '#1c1d48', skyBottom: '#3b3568', stars: 1, tintOpacity: 0.42, light: '#8fa0ff', lightOpacity: 0.1 },
    },
    defs: ({ pal }) => `<linearGradient id="fo-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.skyTop}"/><stop offset="0.6" stop-color="${pal.skyMid}"/><stop offset="1" stop-color="${pal.skyBottom}"/></linearGradient>` +
      `<radialGradient id="fo-moon"><stop offset="0" stop-color="${pal.moonGlow}" stop-opacity="0.55"/><stop offset="1" stop-color="${pal.moonGlow}" stop-opacity="0"/></radialGradient>` +
      `<linearGradient id="fo-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.floor}"/><stop offset="1" stop-color="${pal.floorDark}"/></linearGradient>` +
      `<linearGradient id="fo-rock" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal.rockLight}"/><stop offset="0.45" stop-color="${pal.rock}"/><stop offset="1" stop-color="${pal.rockDark}"/></linearGradient>` +
      `<radialGradient id="fo-cave" cx="0.5" cy="0.75" r="0.7"><stop offset="0" stop-color="${pal.caveIn}"/><stop offset="0.7" stop-color="${pal.caveIn}"/><stop offset="1" stop-color="${pal.caveMid}"/></radialGradient>` +
      `<radialGradient id="fo-vig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#05040c" stop-opacity="0.55"/></radialGradient>` +
      `<radialGradient id="fo-light" cx="0.8" cy="0.2" r="0.9"><stop offset="0" stop-color="${pal.light}" stop-opacity="${pal.lightOpacity}"/><stop offset="1" stop-color="${pal.light}" stop-opacity="0"/></radialGradient>`,
    layers: [
      { name: 'sky', depth: 0, static: true, draw: ({ pal }) => {
        let o = `<rect x="-80" y="-80" width="1440" height="880" fill="url(#fo-sky)"/>`;
        for (let i = 0; i < 90 * pal.stars; i++) o += `<circle cx="${r1(hash(i) * 1280)}" cy="${r1(hash(i + 99) * 260)}" r="${r1(0.6 + hash(i + 7) * 1.3)}" fill="#fff" opacity="${r1((0.35 + 0.6 * hash(i + 3)) * (1 - 0.8 * hash(i + 99)))}"/>`;
        const mx = 1010, my = 118;
        o += `<circle cx="${mx}" cy="${my}" r="190" fill="url(#fo-moon)"/>`;
        o += `<circle cx="${mx}" cy="${my}" r="44" fill="${pal.moon}"/>`;
        o += `<circle cx="${mx - 13}" cy="${my - 9}" r="9" fill="${pal.moonShade}"/><circle cx="${mx + 15}" cy="${my + 12}" r="6" fill="${pal.moonShade}"/><circle cx="${mx + 8}" cy="${my - 20}" r="4" fill="${pal.moonShade}"/><circle cx="${mx - 18}" cy="${my + 18}" r="4.5" fill="${pal.moonShade}"/>`;
        return o;
      } },
      { name: 'ridge', depth: 0.15, static: true, draw: ({ pal }) => {
        const w = span(0.15) + 100;
        const f = x => 372 - 46 * Math.abs(Math.sin(x / 260 + 0.8)) - 20 * Math.sin(x / 90);
        let o = `<path d="${fillUnder(f, -100, w, 760, 12)}" fill="${pal.ridge}"/>`;
        for (let i = 0; i < 70; i++) { const x = hash(i + 300) * w - 60; o += fir(x, f(x) + 10, 26 + hash(i + 301) * 26, pal.ridge); }
        return o;
      } },
      { name: 'firsFar', depth: 0.35, static: true, draw: ({ pal }) => {
        const w = span(0.35) + 100;
        let o = `<rect x="-100" y="430" width="${w + 100}" height="400" fill="${pal.firFar}"/>`;
        for (let i = 0; i < 60; i++) { const x = hash(i + 400) * w - 60; o += fir(x, 446 + hash(i + 402) * 12, 90 + hash(i + 401) * 80, pal.firFar); }
        return o;
      } },
      { name: 'firsMid', depth: 0.6, static: true, draw: ({ pal }) => {
        const w = span(0.6) + 100;
        let o = `<rect x="-100" y="470" width="${w + 100}" height="400" fill="${pal.firMid}"/>`;
        for (let i = 0; i < 44; i++) {
          const x = hash(i + 500) * w - 60;
          if (x > 980 && x < 1500) continue;   // the knoll stands here; keep the sky behind it clear
          o += fir(x, 482 + hash(i + 502) * 10, 150 + hash(i + 501) * 120, pal.firMid);
        }
        return o;
      } },
      { name: 'trunks', depth: 0.82, static: true, draw: ({ pal }) => {
        const w = span(0.82) + 100;
        let o = '';
        for (let i = 0; i < 11; i++) {
          const x = (i + 0.3 * hash(i + 600)) * (w / 11) - 60, tw = 26 + hash(i + 601) * 22;
          if (x > 960 && x < 1780) continue;
          o += `<path d="M${r1(x - tw / 2)} 520L${r1(x - tw * 0.38)} -20L${r1(x + tw * 0.38)} -20L${r1(x + tw / 2)} 520Z" fill="${pal.trunk}"/>`;
          o += `<path d="M${r1(x - tw / 2 - 14)} 522Q${r1(x - tw / 2)} 500 ${r1(x - tw / 2 + 2)} 470M${r1(x + tw / 2 + 12)} 522Q${r1(x + tw / 2)} 505 ${r1(x + tw / 2 - 2)} 478" fill="none" stroke="${pal.trunk}" stroke-width="9" stroke-linecap="round"/>`;
          for (let k = 0; k < 4; k++) o += `<circle cx="${r1(x + (hash(i * 7 + k) - 0.5) * 160)}" cy="${r1(20 + hash(i * 5 + k) * 80)}" r="${r1(50 + hash(i * 3 + k) * 40)}" fill="${pal.canopy}"/>`;
        }
        return o;
      } },
      { name: 'ground', depth: 1, static: true, draw: ({ pal }) => {
        let o = '';
        // forest floor
        o += `<path d="${fillUnder(ground, -100, W + 100, 800, 10)}" fill="url(#fo-floor)"/>`;
        // the knoll: lit rock with moss on top, strata, a few boulders
        o += `<path d="${line(knoll, K0 - 20, K1 + 20, 8)}L${K1 + 20} ${r1(ground(K1 + 20) + 8)}L${K0 - 20} ${r1(ground(K0 - 20) + 8)}Z" fill="url(#fo-rock)"/>`;
        o += `<path d="${line(x => knoll(x) + 2, K0 + 40, K1 - 40, 8)}" fill="none" stroke="${pal.moss}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`;
        o += `<path d="${line(x => knoll(x) - 4, K0 + 80, K1 - 80, 8)}" fill="none" stroke="${pal.mossLight}" stroke-width="5" stroke-linecap="round" opacity="0.7"/>`;
        for (let k = 0; k < 9; k++) {
          const x = K0 + 70 + hash(k + 140) * (K1 - K0 - 140), y = knoll(x) + 50 + hash(k + 141) * 200;
          if (Math.abs(x - CX) < MW + 30 && y > ground(x) - MH - 40) continue;
          if (y > ground(x) - 20) continue;
          const w = 30 + hash(k + 142) * 50;
          o += `<path d="M${r1(x - w)} ${r1(y)}Q${r1(x)} ${r1(y - 8)} ${r1(x + w)} ${r1(y + 4)}" fill="none" stroke="${pal.rockDark}" stroke-width="3" opacity="0.6" stroke-linecap="round"/>`;
        }
        // cave mouth: a dark hollow, an inner rim, a thick lit rim of stones
        o += `<path d="M${CX - MW} ${r1(ground(CX - MW) + 6)}${line(arch, CX - MW, CX + MW, 6).replace('M', 'L')}L${CX + MW} ${r1(ground(CX + MW) + 6)}Z" fill="url(#fo-cave)"/>`;
        o += `<path d="${line(x => arch(x) + 14, CX - MW + 18, CX + MW - 18, 6)}" fill="none" stroke="${pal.caveMid}" stroke-width="10" opacity="0.8"/>`;
        for (let i = 0; i <= 16; i++) {
          const a = Math.PI * (i / 16), x = CX - Math.cos(a) * (MW + 6), y = arch(Math.max(CX - MW, Math.min(CX + MW, x))) - 4 + (i === 0 || i === 16 ? -6 : 0);
          const r = 15 + hash(i + 70) * 9;
          o += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(r * 1.2)}" ry="${r1(r)}" fill="${pal.rock}" stroke="${pal.rockDark}" stroke-width="3"/>`;
          o += `<path d="M${r1(x - r * 0.7)} ${r1(y - r * 0.35)}Q${r1(x)} ${r1(y - r)} ${r1(x + r * 0.6)} ${r1(y - r * 0.45)}" fill="none" stroke="${pal.rockLight}" stroke-width="3" stroke-linecap="round"/>`;
        }
        // hanging roots over the mouth
        for (let i = 0; i < 5; i++) {
          const x = CX - 90 + i * 44 + hash(i + 90) * 10, y = arch(x) + 6, l = 26 + hash(i + 91) * 40;
          o += `<path d="M${r1(x)} ${r1(y)}q${r1(6 - hash(i) * 12)} ${r1(l * 0.5)} ${r1(2 - hash(i + 3) * 4)} ${r1(l)}" fill="none" stroke="${pal.rockDark}" stroke-width="2.5" stroke-linecap="round"/>`;
        }
        // the path, a lighter band of packed earth
        let p = 'M-100 ' + r1(ground(-100) + 6), q = '';
        for (let x = -100; x <= W + 100; x += 12) p += `L${x} ${r1(ground(x) + 4 + 3 * Math.sin(x / 80))}`;
        for (let x = W + 100; x >= -100; x -= 12) q += `L${x} ${r1(ground(x) + 34 + 6 * Math.sin(x / 70 + 1))}`;
        o += `<path d="${p + q}Z" fill="${pal.path}"/><path d="${p}" fill="none" stroke="${pal.pathEdge}" stroke-width="3"/>`;
        for (let i = 0; i < 40; i++) { const x = hash(i + 800) * W, y = ground(x) + 14 + hash(i + 801) * 16; o += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(3 + hash(i + 802) * 5)}" ry="${r1(2 + hash(i + 803) * 2)}" fill="${pal.pathEdge}" opacity="0.7"/>`; }
        // grass tufts and mushrooms along the floor
        for (let i = 0, x = -80; x < W + 80; i++, x += 30 + hash(i) * 40) {
          if (Math.abs(x - CX) < MW) continue;
          const y = ground(x) + 2, h = 8 + hash(i + 2) * 10;
          o += `<path d="M${r1(x - 6)} ${r1(y)}L${r1(x - 3)} ${r1(y - h)}L${r1(x)} ${r1(y)}L${r1(x + 3)} ${r1(y - h * 0.8)}L${r1(x + 7)} ${r1(y)}Z" fill="${pal.moss}"/>`;
          if (hash(i + 900) > 0.86) o += `<path d="M${r1(x + 10)} ${r1(y)}L${r1(x + 10)} ${r1(y - 9)}" stroke="#e9dcc4" stroke-width="2.4"/><path d="M${r1(x + 4)} ${r1(y - 8)}Q${r1(x + 10)} ${r1(y - 17)} ${r1(x + 16)} ${r1(y - 8)}Z" fill="${pal.mushroom}"/>`;
        }
        // a mossy log on the left, a signpost-less stump on the right
        const lx = 260, ly = ground(lx) - 4;
        o += `<rect x="${lx - 70}" y="${r1(ly - 26)}" width="140" height="30" rx="15" fill="#4a3a2c"/><ellipse cx="${lx + 70}" cy="${r1(ly - 11)}" rx="10" ry="15" fill="#7a6248"/><ellipse cx="${lx + 70}" cy="${r1(ly - 11)}" rx="5" ry="8" fill="#5a4634"/><path d="M${lx - 60} ${r1(ly - 26)}Q${lx - 10} ${r1(ly - 34)} ${lx + 40} ${r1(ly - 26)}" fill="none" stroke="${pal.moss}" stroke-width="7" stroke-linecap="round"/>`;
        const sx = 2060, sy = ground(sx);
        o += `<path d="M${sx - 26} ${r1(sy + 2)}L${sx - 20} ${r1(sy - 40)}L${sx + 20} ${r1(sy - 40)}L${sx + 26} ${r1(sy + 2)}Z" fill="#4a3a2c"/><ellipse cx="${sx}" cy="${r1(sy - 40)}" rx="20" ry="6" fill="#7a6248"/>`;
        return o;
      } },
      { name: 'groundLife', depth: 1, draw: ({ t, pal }) => {
        let o = '';
        // fireflies drifting and pulsing
        for (let i = 0; i < 22; i++) {
          const bx = hash(i + 1000) * W, by = ground(bx) - 40 - hash(i + 1001) * 220;
          const x = bx + 26 * Math.sin(t * (0.3 + 0.3 * hash(i + 1002)) + i), y = by + 16 * Math.sin(t * (0.5 + 0.4 * hash(i + 1003)) + i * 2);
          const a = Math.max(0, Math.sin(t * (1.1 + hash(i + 1004)) + i * 1.7));
          if (a < 0.05) continue;
          o += `<circle cx="${r1(x)}" cy="${r1(y)}" r="7" fill="${pal.firefly}" opacity="${r1(0.25 * a * 10) / 10}"/><circle cx="${r1(x)}" cy="${r1(y)}" r="2.2" fill="${pal.firefly}" opacity="${r1(a * 10) / 10}"/>`;
        }
        return o;
      } },
      { name: 'foreground', depth: 1.3, front: true, draw: ({ t, pal }) => {
        let o = '';
        const w = W * 1.3 + 200;
        for (let i = 0; i < 12; i++) {
          const x = hash(i + 1200) * w - 100, y = 742, h = 40 + hash(i + 1201) * 46, sw = 4 * Math.sin(t * 1.1 + i * 0.7);
          o += `<g fill="${pal.fern}">`;
          for (let k = -3; k <= 3; k++) o += `<path d="M${r1(x + k * 6 - 3)} ${y}Q${r1(x + k * 14 + sw * 0.5)} ${r1(y - h * 0.6)} ${r1(x + k * 22 + sw)} ${r1(y - h * (1 - Math.abs(k) * 0.16))}Q${r1(x + k * 10 + 2)} ${r1(y - h * 0.35)} ${r1(x + k * 6 + 4)} ${y}Z"/>`;
          o += '</g>';
        }
        return o;
      } },
    ],
    overlay: ({ pal }) => (pal.tint ? `<rect x="-20" y="-20" width="1320" height="760" fill="${pal.tint}" opacity="${pal.tintOpacity}" style="mix-blend-mode:multiply"/>` : '') +
      `<rect x="-20" y="-20" width="1320" height="760" fill="url(#fo-light)" style="mix-blend-mode:screen"/>` +
      `<rect x="-20" y="-20" width="1320" height="760" fill="url(#fo-vig)"/>`,
  };
  set.defaultVariant = 'dusk';
  (g.CharSets = g.CharSets || {}).forest = set;
})(typeof globalThis !== 'undefined' ? globalThis : this);
