// sets/ravine.js - a meadow that ends at a ravine, an old rope bridge with a gap of missing
// planks, and a narrow rock ledge under a cliff on the far side. Format: see sets/hillside.js.
//
// Layout (x in set px): meadow 0..760 | ravine + bridge 760..1260 (gap 972..1063) |
// ledge 1260..1590 | cliff wall 1590..1960. The bridge deck IS the ground, so actors walk on it;
// the gap is only drawn (jump it: jump(to=gapfar) from gapnear).
// Anchors: left 150, meadow 380, edge 695 (stand at the lip), bridge 760, gapnear 950,
// gap 1018, gapfar 1100, farend 1260, ledge 1400, lamb 1470, wall 1560.
// Variants: dawn (default), day, dusk.
(function (g) {
  'use strict';
  const W = 1960, H = 720;
  const B0 = 760, B1 = 1260, G0 = 962, G1 = 1072, WALL = 1590;
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const r1 = v => Math.round(v * 10) / 10;
  const lerp = (a, b, u) => a + (b - a) * u;
  const gL = x => 490 - 8 * Math.sin(x / 210 + 0.3) - 14 * Math.exp(-Math.pow((x - 300) / 220, 2));
  const gR = x => 494 - 3 * Math.sin(x / 90);
  const SAG = 10;
  const ground = x => {
    if (x <= B0) return gL(x);
    if (x >= B1) return gR(Math.min(x, WALL));
    const u = (x - B0) / (B1 - B0);
    return lerp(gL(B0), gR(B1), u) + SAG * Math.sin(Math.PI * u);
  };
  const span = d => 1280 + (W - 1280) * d;
  function fillUnder(f, x0, x1, bottom, step) {
    let d = `M${x0} ${bottom}`;
    for (let x = x0; x <= x1 + step; x += step) d += `L${r1(Math.min(x, x1))} ${r1(f(Math.min(x, x1)))}`;
    return d + `L${x1} ${bottom}Z`;
  }
  const line = (f, x0, x1, step) => { let d = ''; for (let x = x0; x <= x1 + 1e-6; x += step) d += (d ? 'L' : 'M') + r1(x) + ' ' + r1(f(x)); return d; };
  function cloud(x, y, s, col) {
    let o = `<g fill="${col}">`;
    for (const [dx, dy, r] of [[-50, 6, 22], [-22, -8, 28], [12, -14, 32], [44, -4, 24], [70, 6, 16]]) o += `<circle cx="${r1(x + dx * s)}" cy="${r1(y + dy * s)}" r="${r1(r * s)}"/>`;
    return o + `<rect x="${r1(x - 66 * s)}" y="${r1(y + 2 * s)}" width="${r1(150 * s)}" height="${r1(20 * s)}" rx="${r1(10 * s)}"/></g>`;
  }
  // rope bridge geometry
  const POST_H = 104;
  const postTop = x => ground(x) - POST_H;
  const rail = (x, dy) => { const u = (x - B0) / (B1 - B0); return lerp(postTop(B0), postTop(B1), u) + 38 * Math.sin(Math.PI * u) + (dy || 0); };
  const inGap = x => x > G0 && x < G1;
  function post(x, y, pal, s) {
    s = s || 1;
    const w = 13 * s, h = POST_H + 12;
    let o = `<path d="M${r1(x - w / 2)} ${r1(y + 14)}L${r1(x - w / 2 + 1)} ${r1(y - h + 8)}Q${r1(x)} ${r1(y - h - 4)} ${r1(x + w / 2 - 1)} ${r1(y - h + 8)}L${r1(x + w / 2)} ${r1(y + 14)}Z" fill="${pal.wood}"/>`;
    o += `<path d="M${r1(x + w / 2 - 4)} ${r1(y + 14)}L${r1(x + w / 2 - 3)} ${r1(y - h + 8)}L${r1(x + w / 2 - 1)} ${r1(y - h + 8)}L${r1(x + w / 2)} ${r1(y + 14)}Z" fill="${pal.woodDark}"/>`;
    for (const k of [0, 6]) o += `<path d="M${r1(x - w / 2 - 1)} ${r1(y - h + 14 + k)}L${r1(x + w / 2 + 1)} ${r1(y - h + 18 + k)}" stroke="${pal.ropeDark}" stroke-width="3"/>`;
    return o;
  }
  // planks: a thin top face and a darker front edge, laid on the sagging deck
  function planks(pal) {
    let o = '';
    for (let i = 0, x = B0 + 10; x < B1 - 6; i++, x += 19) {
      if (inGap(x)) continue;
      const y = ground(x) + 1, j = (hash(i + 40) - 0.5) * 3, w = 7 + hash(i + 41) * 1.5;
      const a = Math.atan2(ground(x + 4) - ground(x - 4), 8);
      const dx = Math.cos(a), dy = Math.sin(a);
      const P = (u, v) => `${r1(x + u * dx - v * dy * 0)} ${r1(y + j * 0.3 + u * dy + v)}`;
      o += `<path d="M${P(-w, -6)}L${P(w, -6)}L${P(w + 1, 0)}L${P(-w - 1, 0)}Z" fill="${pal.woodLight}"/>`;
      o += `<path d="M${P(-w - 1, 0)}L${P(w + 1, 0)}L${P(w + 1, 10)}L${P(-w - 1, 10)}Z" fill="${hash(i + 42) > 0.8 ? pal.woodDark : pal.wood}"/>`;
    }
    // broken stubs at both lips of the gap
    const ya = ground(G0) + 1, yb = ground(G1) + 1;
    o += `<path d="M${G0 - 6} ${r1(ya - 4)}L${G0 + 10} ${r1(ya + 1)}L${G0 + 4} ${r1(ya + 4)}L${G0 + 12} ${r1(ya + 9)}L${G0 - 6} ${r1(ya + 7)}Z" fill="${pal.wood}"/>`;
    o += `<path d="M${G1 + 6} ${r1(yb - 4)}L${G1 - 8} ${r1(yb + 2)}L${G1 - 2} ${r1(yb + 5)}L${G1 - 10} ${r1(yb + 10)}L${G1 + 6} ${r1(yb + 7)}Z" fill="${pal.wood}"/>`;
    return o;
  }

  const set = {
    name: 'ravine', width: W, height: H, ground, actorScale: 68,
    camera: { x: 640, lift: [132, 24] },   // lift: centre = ground - 132 - 24 / zoom: zoom 2 frames a kneeling child, zoom 4 a waist-up shot
    anchors: {
      left: 150, meadow: 380, edge: 695, bridge: B0, gapnear: 942, gap: 1017, gapfar: 1102,
      farend: B1, ledge: 1340, lamb: 1400, wall: 1560,
    },
    palette: {
      skyTop: '#3b4784', skyMid: '#c98ba8', skyBottom: '#ffd59c', sun: '#fff1c8', sunGlow: '#ffc48a', sunY: 318, stars: 0.35,
      mtnFar: '#9286b6', mtnNear: '#7a6ea2', snow: '#f4d6dc', cloud: '#f6b6ae', cloudLit: '#ffe0c0',
      hillFar: '#8c9f88', hillMid: '#6a8c62', treeFar: '#4f7356',
      grass: '#6d9e52', grassTop: '#a3cb72', grassDark: '#4a7a40', path: '#dcbd8e', pathEdge: '#bf9d6b',
      rock: '#8f84a0', rockLight: '#bcaec2', rockDark: '#5d5470', chasmTop: '#4a3f62', chasmBottom: '#120f1f',
      wood: '#a47548', woodLight: '#cfa06a', woodDark: '#6c4a2d', rope: '#dcc390', ropeDark: '#a68b5c',
      mist: '#f6dce6', flowerA: '#ffd86a', flowerB: '#f59ab4', flowerC: '#ffffff',
      tint: '#ff9c6a', tintOpacity: 0.1, light: '#ffcf9a', lightOpacity: 0.28, glow: 0.5,
    },
    variants: {
      dawn: {},
      day: { skyTop: '#6fa8dc', skyMid: '#a9cdea', skyBottom: '#eef1df', sun: '#fffbe8', sunGlow: '#fff4cf', sunY: 140, stars: 0, mtnFar: '#a9bfd2', mtnNear: '#8ba7be', snow: '#eef3f6',
        cloud: '#ffffff', cloudLit: '#ffffff', hillFar: '#9cc58e', hillMid: '#77ad6c', treeFar: '#5f9660', rock: '#9a978e', rockLight: '#bdb9ae', rockDark: '#6f6c66',
        chasmTop: '#6c6a66', chasmBottom: '#24252a', mist: '#ffffff', tint: null, tintOpacity: 0, lightOpacity: 0.1, light: '#fff6dc', glow: 0.3 },
      dusk: { skyTop: '#272d5c', skyMid: '#8a5a86', skyBottom: '#ec8a5e', sun: '#ffc08a', sunGlow: '#ff9a6a', sunY: 336, stars: 0.6, mtnFar: '#5e5480', mtnNear: '#4b436c',
        cloud: '#d88a8a', cloudLit: '#f3a98f', hillFar: '#5b7060', hillMid: '#4a6352', treeFar: '#364c40', grass: '#4d7a46', grassTop: '#6a9658',
        tint: '#3a2a66', tintOpacity: 0.3, light: '#ff9a6a', lightOpacity: 0.2, glow: 1 },
    },
    defs: ({ pal }) => `<linearGradient id="rv-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.skyTop}"/><stop offset="0.55" stop-color="${pal.skyMid}"/><stop offset="1" stop-color="${pal.skyBottom}"/></linearGradient>` +
      `<radialGradient id="rv-sun"><stop offset="0" stop-color="${pal.sunGlow}" stop-opacity="0.75"/><stop offset="1" stop-color="${pal.sunGlow}" stop-opacity="0"/></radialGradient>` +
      `<linearGradient id="rv-grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.grass}"/><stop offset="1" stop-color="${pal.grassDark}"/></linearGradient>` +
      `<linearGradient id="rv-chasm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.chasmTop}"/><stop offset="1" stop-color="${pal.chasmBottom}"/></linearGradient>` +
      `<linearGradient id="rv-rock" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal.rockLight}"/><stop offset="0.5" stop-color="${pal.rock}"/><stop offset="1" stop-color="${pal.rockDark}"/></linearGradient>` +
      `<radialGradient id="rv-light" cx="0.75" cy="0.45" r="0.8"><stop offset="0" stop-color="${pal.light}" stop-opacity="${pal.lightOpacity}"/><stop offset="1" stop-color="${pal.light}" stop-opacity="0"/></radialGradient>`,
    layers: [
      { name: 'sky', depth: 0, static: true, draw: ({ pal }) => {
        let o = `<rect x="-80" y="-80" width="1440" height="880" fill="url(#rv-sky)"/>`;
        for (let i = 0; i < 50 * pal.stars; i++) o += `<circle cx="${r1(hash(i) * 1280)}" cy="${r1(hash(i + 99) * 170)}" r="${r1(0.7 + hash(i + 7) * 1.2)}" fill="#fff" opacity="${r1((0.3 + 0.6 * hash(i + 3)) * (1 - hash(i + 99)))}"/>`;
        const sy = pal.sunY;
        o += `<circle cx="930" cy="${sy}" r="300" fill="url(#rv-sun)"/>`;
        for (let i = 0; i < 9; i++) {   // soft rays fanning up from the sun
          const a = (-160 + i * 17.5) * Math.PI / 180, l = 900;
          const a0 = a - 0.035, a1 = a + 0.035;
          o += `<path d="M930 ${sy}L${r1(930 + l * Math.cos(a0))} ${r1(sy + l * Math.sin(a0))}L${r1(930 + l * Math.cos(a1))} ${r1(sy + l * Math.sin(a1))}Z" fill="${pal.sun}" opacity="0.07"/>`;
        }
        o += `<circle cx="930" cy="${sy}" r="46" fill="${pal.sun}"/>`;
        return o;
      } },
      { name: 'mountains', depth: 0.1, static: true, draw: ({ pal }) => {
        const w = span(0.1) + 100;
        const far = x => 318 - 80 * Math.abs(Math.sin(x / 230 + 0.6)) - 34 * Math.sin(x / 101 + 2) * Math.sin(x / 340);
        const near = x => 376 - 52 * Math.abs(Math.sin(x / 280 + 2.0)) - 20 * Math.sin(x / 73);
        let o = `<path d="${fillUnder(far, -100, w, 760, 14)}" fill="${pal.mtnFar}"/>`;
        o += `<path d="${line(x => far(x) + 3, -100, w, 14)}" fill="none" stroke="${pal.snow}" stroke-width="5" opacity="0.45" stroke-linejoin="round"/>`;
        o += `<path d="${fillUnder(near, -100, w, 760, 14)}" fill="${pal.mtnNear}"/>`;
        return o;
      } },
      { name: 'clouds', depth: 0.2, draw: ({ t, pal }) => {
        const w = span(0.2) + 400;
        let o = '';
        for (let i = 0; i < 6; i++) {
          const x = ((hash(i + 20) * w + t * (4 + 3 * hash(i))) % w) - 200, y = 60 + hash(i + 40) * 170, s = 0.6 + 0.6 * hash(i + 11);
          o += `<g opacity="0.9">${cloud(x, y, s, pal.cloud)}${cloud(x + 4 * s, y + 6 * s, s * 0.82, pal.cloudLit)}</g>`;
        }
        return o;
      } },
      { name: 'farHills', depth: 0.38, static: true, draw: ({ pal }) => {
        const w = span(0.38) + 100;
        const f = x => 418 - 34 * Math.sin(x / 290 + 0.5) - 22 * Math.sin(x / 120 + 1.7);
        let o = `<path d="${fillUnder(f, -100, w, 760, 18)}" fill="${pal.hillFar}"/>`;
        for (let i = 0; i < 34; i++) {   // pointed firs along the ridge
          const x = hash(i + 300) * w, y = f(x) + 8, s = 10 + hash(i + 301) * 14;
          o += `<path d="M${r1(x - s * 0.45)} ${r1(y)}L${r1(x)} ${r1(y - s * 2)}L${r1(x + s * 0.45)} ${r1(y)}Z" fill="${pal.treeFar}"/>`;
        }
        return o;
      } },
      { name: 'midHills', depth: 0.66, static: true, draw: ({ pal }) => {
        const w = span(0.66) + 100;
        const f = x => 466 - 40 * Math.sin(x / 360 + 2.2) - 16 * Math.sin(x / 150);
        let o = `<path d="${fillUnder(f, -100, w, 760, 18)}" fill="${pal.hillMid}"/>`;
        for (let i = 0; i < 16; i++) {
          const x = hash(i + 500) * w, y = f(x) + 4;
          o += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(20 + hash(i) * 22)}" ry="${r1(9 + hash(i + 1) * 8)}" fill="${pal.treeFar}" opacity="0.85"/>`;
        }
        return o;
      } },
      { name: 'ground', depth: 1, static: true, draw: ({ pal }) => {
        let o = '';
        // the chasm behind everything: walls fall away into shadow
        o += `<rect x="${B0 - 40}" y="${r1(ground(B0) - 4)}" width="${B1 - B0 + 80}" height="${r1(H + 120 - ground(B0))}" fill="url(#rv-chasm)"/>`;
        // the far wall of the ravine, seen between the cliffs: rock strata catching a little light
        // jagged outcrops on the far wall, fading into the dark as they go down
        for (let k = 0; k < 14; k++) {
          const x = B0 + 10 + hash(k + 140) * (B1 - B0 - 20), y = ground(B0) + 26 + hash(k + 141) * 170, w = 26 + hash(k + 142) * 50, h = 10 + hash(k + 143) * 16;
          const op = r1(0.5 * (1 - (y - ground(B0)) / 230));
          o += `<path d="M${r1(x - w)} ${r1(y + h)}L${r1(x - w * 0.4)} ${r1(y)}L${r1(x + w * 0.2)} ${r1(y + 3)}L${r1(x + w)} ${r1(y + h)}Z" fill="${pal.rock}" opacity="${op}"/>`;
          o += `<path d="M${r1(x - w * 0.4)} ${r1(y)}L${r1(x + w * 0.2)} ${r1(y + 3)}" stroke="${pal.rockLight}" stroke-width="2" opacity="${op}"/>`;
        }
        // a thread of river far below
        o += `<path d="${line(x => 704 + 4 * Math.sin(x / 40), B0 - 20, B1 + 20, 10)}" fill="none" stroke="${pal.mist}" stroke-width="3" opacity="0.35"/>`;
        // meadow
        o += `<path d="${fillUnder(ground, -100, B0, 800, 10)}" fill="url(#rv-grass)"/>`;
        // left cliff face (lit), with strata, under the meadow lip
        const yl = ground(B0);
        o += `<path d="M${B0 - 70} ${r1(yl + 18)}L${B0 + 2} ${r1(yl - 2)}L${B0 + 16} ${r1(yl + 40)}L${B0 + 6} ${r1(yl + 70)}L${B0 + 30} ${r1(yl + 110)}L${B0 + 18} ${r1(yl + 150)}L${B0 + 40} ${H + 40}L${B0 - 70} ${H + 40}Z" fill="url(#rv-rock)"/>`;
        o += `<path d="M${B0 - 40} ${r1(yl + 60)}L${B0 + 8} ${r1(yl + 68)}M${B0 - 52} ${r1(yl + 112)}L${B0 + 26} ${r1(yl + 116)}M${B0 - 30} ${r1(yl + 150)}L${B0 + 18} ${r1(yl + 152)}" stroke="${pal.rockDark}" stroke-width="3" opacity="0.6"/>`;
        // grass over the lip, a few roots hanging into the ravine
        o += `<path d="${line(ground, -100, B0 + 2, 10)}" fill="none" stroke="${pal.grassTop}" stroke-width="7"/>`;
        o += `<path d="M${B0 - 6} ${r1(yl + 4)}C${B0 + 6} ${r1(yl + 30)} ${B0 - 4} ${r1(yl + 50)} ${B0 + 8} ${r1(yl + 74)}M${B0 - 20} ${r1(yl + 8)}C${B0 - 14} ${r1(yl + 26)} ${B0 - 22} ${r1(yl + 40)} ${B0 - 12} ${r1(yl + 52)}" fill="none" stroke="${pal.woodDark}" stroke-width="2.4"/>`;
        // the path, ending at the bridge
        let p = 'M-100 ' + r1(ground(-100) + 30), q = '';
        for (let x = -100; x <= B0 - 10; x += 10) p += `L${x} ${r1(ground(x) + 22 + 4 * Math.sin(x / 90))}`;
        for (let x = B0 - 10; x >= -100; x -= 10) q += `L${x} ${r1(ground(x) + 46 + 6 * Math.sin(x / 70 + 1) - 18 * Math.max(0, (x - B0 + 160) / 150))}`;
        o += `<path d="${p + q}Z" fill="${pal.path}"/><path d="${p}" fill="none" stroke="${pal.pathEdge}" stroke-width="3"/>`;
        for (let i = 0, x = -80; x < B0 - 10; i++, x += 24 + hash(i) * 28) {
          const y = ground(x) + 2, h = 7 + hash(i + 2) * 9;
          o += `<path d="M${r1(x - 5)} ${r1(y)}L${r1(x - 2)} ${r1(y - h)}L${r1(x)} ${r1(y)}L${r1(x + 3)} ${r1(y - h * 0.8)}L${r1(x + 6)} ${r1(y)}Z" fill="${pal.grassDark}"/>`;
        }
        // a boulder near the lip
        const bx = 600, by = ground(bx) + 4;
        o += `<path d="M${bx - 30} ${by}C${bx - 32} ${by - 22} ${bx - 14} ${by - 38} ${bx + 4} ${by - 36}C${bx + 24} ${by - 34} ${bx + 34} ${by - 18} ${bx + 32} ${by}Z" fill="${pal.rock}"/><path d="M${bx - 18} ${by - 26}C${bx - 8} ${by - 34} ${bx + 6} ${by - 34} ${bx + 14} ${by - 28}" fill="none" stroke="${pal.rockLight}" stroke-width="4" stroke-linecap="round"/>`;
        // right side: the ledge (top of the right ravine wall) and the cliff that traps it
        const yr = ground(B1);
        o += `<path d="M${B1 - 18} ${H + 40}L${B1 - 4} ${r1(yr + 150)}L${B1 - 22} ${r1(yr + 100)}L${B1 - 8} ${r1(yr + 50)}L${B1 - 16} ${r1(yr + 20)}L${B1 - 2} ${r1(yr - 2)}${line(ground, B1, WALL + 30, 10).replace('M', 'L')}L${WALL + 30} ${H + 40}Z" fill="${pal.rockDark}"/>`;
        o += `<path d="M${B1 - 2} ${r1(yr - 2)}${line(x => ground(x) - 1, B1, WALL + 30, 10).replace('M', 'L')}L${WALL + 30} ${r1(yr + 26)}L${B1 + 10} ${r1(yr + 22)}Z" fill="${pal.rock}"/>`;
        o += `<path d="${line(x => ground(x) + 1, B1, WALL, 10)}" fill="none" stroke="${pal.rockLight}" stroke-width="4"/>`;
        for (let i = 0; i < 9; i++) { const x = B1 + 20 + hash(i + 60) * (WALL - B1 - 40); const y = ground(x) + 1; o += `<path d="M${r1(x - 4)} ${r1(y)}L${r1(x - 1)} ${r1(y - 8)}L${r1(x + 1)} ${r1(y)}L${r1(x + 4)} ${r1(y - 6)}L${r1(x + 6)} ${r1(y)}Z" fill="${pal.grassDark}"/>`; }
        // the cliff wall: tall, cracked, with a lit edge and a bush on top
        const cw = [[WALL - 10, ground(WALL) + 2], [WALL + 14, 470], [WALL + 2, 400], [WALL + 30, 320], [WALL + 18, 240], [WALL + 52, 160], [WALL + 120, 118], [WALL + 230, 96], [W + 120, 84], [W + 120, H + 40], [WALL - 10, H + 40]];
        o += `<path d="M${cw.map(p => p.join(' ')).join('L')}Z" fill="url(#rv-rock)"/>`;
        o += `<path d="M${cw.slice(0, 8).map(p => p.join(' ')).join('L')}" fill="none" stroke="${pal.rockLight}" stroke-width="5" stroke-linejoin="round" opacity="0.8"/>`;
        o += `<path d="M${WALL + 40} 520L${WALL + 90} 500L${WALL + 160} 512M${WALL + 50} 420L${WALL + 140} 400L${WALL + 230} 410M${WALL + 70} 300L${WALL + 150} 290L${WALL + 300} 300M${WALL + 90} 200L${WALL + 200} 186M${WALL + 120} 440L${WALL + 110} 480L${WALL + 125} 520" fill="none" stroke="${pal.rockDark}" stroke-width="3.5" opacity="0.7" stroke-linecap="round"/>`;
        for (const [dx, dy, r] of [[110, 108, 26], [150, 98, 30], [190, 104, 22], [80, 116, 18]]) o += `<circle cx="${WALL + dx}" cy="${dy}" r="${r}" fill="${pal.grassDark}"/>`;
        // bridge, far side (behind actors): far posts, far rail, far deck rope, suspenders, planks
        const far = -7;
        o += post(B0 - 6, ground(B0) + far, pal, 0.9) + post(B1 + 6, ground(B1) + far, pal, 0.9);
        o += `<path d="${line(x => rail(x, far), B0 - 6, B1 + 6, 8)}" fill="none" stroke="${pal.ropeDark}" stroke-width="3.2"/>`;
        o += `<path d="${line(x => ground(x) + 3 + (inGap(x) ? 34 * Math.sin(Math.PI * (x - G0) / (G1 - G0)) : 0), B0, B1, 6)}" fill="none" stroke="${pal.ropeDark}" stroke-width="3"/>`;
        for (let x = B0 + 26; x < B1 - 10; x += 38) {
          if (inGap(x)) { o += `<path d="M${x} ${r1(rail(x, far))}l2 ${r1(18 + hash(x) * 16)}" stroke="${pal.ropeDark}" stroke-width="2"/>`; continue; }
          o += `<path d="M${x} ${r1(rail(x, far))}L${x} ${r1(ground(x) - 2)}" stroke="${pal.ropeDark}" stroke-width="2"/>`;
        }
        o += planks(pal);
        // near deck rope, snapped at the gap: two frayed ends hang down
        o += `<path d="${line(x => ground(x) + 8, B0, G0 + 6, 6)}C${G0 + 12} ${r1(ground(G0) + 30)} ${G0 + 4} ${r1(ground(G0) + 50)} ${G0 + 12} ${r1(ground(G0) + 70)}" fill="none" stroke="${pal.rope}" stroke-width="3.2"/>`;
        o += `<path d="M${G1 - 12} ${r1(ground(G1) + 54)}C${G1 - 6} ${r1(ground(G1) + 36)} ${G1 - 12} ${r1(ground(G1) + 20)} ${G1 - 6} ${r1(ground(G1) + 8)}${line(x => ground(x) + 8, G1 - 6, B1, 6).replace('M', 'L')}" fill="none" stroke="${pal.rope}" stroke-width="3.2"/>`;
        return o;
      } },
      { name: 'groundLife', depth: 1, draw: ({ t, pal }) => {
        let o = '';
        // drifting mist deep in the ravine
        for (let i = 0; i < 7; i++) {
          const x = B0 - 30 + ((hash(i + 80) * 560 + t * (6 + 5 * hash(i + 81))) % 560), y = 650 + hash(i + 82) * 60;
          o += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(70 + 50 * hash(i + 83))}" ry="${r1(14 + 8 * hash(i + 84))}" fill="${pal.mist}" opacity="0.3"/>`;
        }
        // one loose plank dangling from the far deck rope, swinging
        const hx = G0 + 26, hy = ground(hx) + 3 + 34 * Math.sin(Math.PI * (hx - G0) / (G1 - G0)), a = 9 * Math.sin(t * 1.4) + 6;
        o += `<g transform="translate(${r1(hx)} ${r1(hy)}) rotate(${r1(a)})"><path d="M0 0L0 26" stroke="${pal.ropeDark}" stroke-width="2"/><rect x="-5" y="24" width="10" height="30" rx="2" fill="${pal.wood}"/><rect x="2" y="24" width="3" height="30" fill="${pal.woodDark}"/></g>`;
        // flowers in the meadow
        for (let i = 0; i < 30; i++) {
          const x = hash(i + 700) * (B0 - 40), y = ground(x) + 6 + hash(i + 701) * 8, s = 8 * Math.sin(t * 1.6 + i);
          const c = [pal.flowerA, pal.flowerB, pal.flowerC][i % 3];
          o += `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(s)})"><path d="M0 0L0 -13" stroke="${pal.grassDark}" stroke-width="2"/><circle cx="0" cy="-14" r="3.8" fill="${c}"/><circle cx="0" cy="-14" r="1.5" fill="#f0a030"/></g>`;
        }
        return o;
      } },
      { name: 'bridgeNear', depth: 1, front: true, draw: ({ t, pal }) => {
        // the near rail and suspenders pass in front of whoever is on the bridge
        const sw = 1.5 * Math.sin(t * 1.1);
        let o = post(B0 + 6, ground(B0) + 3, pal) + post(B1 - 6, ground(B1) + 3, pal);
        o += `<path d="${line(x => rail(x, 2) + sw * Math.sin(Math.PI * (x - B0) / (B1 - B0)), B0 + 6, B1 - 6, 8)}" fill="none" stroke="${pal.rope}" stroke-width="4"/>`;
        for (let x = B0 + 45; x < B1 - 10; x += 38) {
          const top = rail(x, 2) + sw * Math.sin(Math.PI * (x - B0) / (B1 - B0));
          if (inGap(x)) { o += `<path d="M${x} ${r1(top)}q3 14 -1 ${r1(22 + hash(x + 3) * 14)}" fill="none" stroke="${pal.rope}" stroke-width="2.4"/>`; continue; }
          o += `<path d="M${x} ${r1(top)}L${x} ${r1(ground(x) + 8)}" stroke="${pal.rope}" stroke-width="2.4"/>`;
        }
        return o;
      } },
      { name: 'foreground', depth: 1.3, front: true, draw: ({ t, pal }) => {
        let o = '';
        const w = W * 1.3 + 200;
        for (let i = 0; i < 9; i++) {
          const x = hash(i + 1200) * w - 100, y = 738, h = 34 + hash(i + 1201) * 34, sw = 5 * Math.sin(t * 1.3 + i * 0.7);
          o += `<g fill="${pal.grassDark}">`;
          for (let k = -2; k <= 2; k++) o += `<path d="M${r1(x + k * 9 - 4)} ${y}Q${r1(x + k * 11 + sw * 0.5)} ${r1(y - h * 0.6)} ${r1(x + k * 13 + sw)} ${r1(y - h * (1 - Math.abs(k) * 0.18))}Q${r1(x + k * 9 + 2)} ${r1(y - h * 0.4)} ${r1(x + k * 9 + 5)} ${y}Z"/>`;
          o += '</g>';
        }
        return o;
      } },
    ],
    overlay: ({ pal }) => (pal.tint ? `<rect x="-20" y="-20" width="1320" height="760" fill="${pal.tint}" opacity="${pal.tintOpacity}" style="mix-blend-mode:multiply"/>` : '') +
      `<rect x="-20" y="-20" width="1320" height="760" fill="url(#rv-light)" style="mix-blend-mode:screen"/>`,
  };
  set.defaultVariant = 'dawn';
  (g.CharSets = g.CharSets || {}).ravine = set;
})(typeof globalThis !== 'undefined' ? globalThis : this);
