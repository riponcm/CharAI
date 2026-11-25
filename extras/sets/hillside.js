// sets/hillside.js - a rolling meadow with a hill, a tree and a rock. Copy this file to make a set.
//
// A set registers CharSets.<name> with:
//   width, height   world size in px (height 720; width > 1280 gives the camera room to pan)
//   ground(x)       y of the ground surface at x (px, y grows downward). A number also works.
//   anchors         named places: x, or [x, y] for a spot off the ground (a branch, a ledge)
//   actorScale      px per head height for actors (68 makes a ~3-head child ~200 px tall)
//   camera          { x: start centre }. Optional focusY fixes the height the camera centres on when
//                   zoomed; by default it follows the ground under the camera.
//   palette + variants   colours; `set hillside dusk` merges variants.dusk over palette
//   layers          [{ depth, draw(ctx), static?, front? }] back to front.
//                   depth 0 = sky (never moves), 1 = the ground actors stand on, >1 = foreground
//                   in front of actors (front: true). ctx = { t, W, H, pal, ground, anchors }.
//                   A layer at depth d is drawn in world px; the stage moves it d times as far as the
//                   camera. Cover x from -100 to 1280 + (width - 1280) * d + 100 so pans never show an edge.
//                   static: true caches the layer (it must not use ctx.t).
//   defs(ctx)       optional SVG <defs> content (gradients); overlay(ctx) optional screen-space tint.
// Everything must be a pure function of ctx.t: no state between frames.
(function (g) {
  'use strict';
  const W = 2400, H = 720;
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const r1 = v => Math.round(v * 10) / 10;
  // the ground: a hill around x = 1250 plus a gentle long wave, so it is never perfectly flat
  const ground = x => 606 - 58 * Math.exp(-Math.pow((x - 1250) / 420, 2)) - 9 * Math.sin(x / 260 + 0.6);
  const span = d => 1280 + (W - 1280) * d;          // how far a layer at depth d can be seen
  // closed path: a curve y = f(x) from x0 to x1, then down to `bottom`
  function fillUnder(f, x0, x1, bottom, step) {
    let d = `M${x0} ${bottom}`;
    for (let x = x0; x <= x1 + step; x += step) d += `L${r1(Math.min(x, x1))} ${r1(f(Math.min(x, x1)))}`;
    return d + `L${x1} ${bottom}Z`;
  }
  function cloud(x, y, s, col) {   // a cloud from overlapping circles with a flat base
    let o = `<g fill="${col}">`;
    for (const [dx, dy, r] of [[-46, 4, 26], [-18, -14, 34], [20, -20, 38], [54, -2, 28], [78, 8, 20]]) o += `<circle cx="${r1(x + dx * s)}" cy="${r1(y + dy * s)}" r="${r1(r * s)}"/>`;
    return o + `<rect x="${r1(x - 64 * s)}" y="${r1(y + 2 * s)}" width="${r1(150 * s)}" height="${r1(26 * s)}" rx="${r1(13 * s)}"/></g>`;
  }

  const set = {
    name: 'hillside', width: W, height: H, ground, actorScale: 68,
    camera: { x: 640 },
    anchors: {
      left: 150, path: 480, center: 800, hilltop: 1250, tree: 1640,
      branch: [1806, ground(1720) - 226],   // a spot on the tree's branch, for birds
      rock: 2050, right: 2260,
    },
    palette: {
      skyTop: '#79b4dc', skyBottom: '#f3e6c8', sun: '#fff4cf', mtnFar: '#a9bfd2', mtnNear: '#8ba7be', snow: '#eef3f6',
      cloud: '#ffffff', hillFar: '#9cc58e', hillMid: '#77ad6c', treeFar: '#5f9660',
      grass: '#64a052', grassTop: '#8cc265', grassDark: '#4c8442', path: '#d9bd86', pathEdge: '#c09f68',
      trunk: '#6b4a34', trunkDark: '#4f3525', leaf: '#3f7f46', leafLight: '#64a456', leafDark: '#2f6439',
      rock: '#9a978e', rockLight: '#b9b6ac', rockDark: '#6f6c66', flowerA: '#f6d55c', flowerB: '#f28da0', flowerC: '#ffffff',
      tint: null, tintOpacity: 0, stars: 0, moon: 0, sunY: 150, glow: 0.3,   // glow scales prop lights
    },
    variants: {
      day: {},
      dawn: { skyTop: '#8fa6d6', skyBottom: '#ffcf9f', sun: '#ffe1b0', mtnFar: '#b6a9c4', mtnNear: '#9a90b2', cloud: '#ffe9e0', hillFar: '#a3b98c', tint: '#ffb27a', tintOpacity: 0.12, sunY: 300, glow: 0.5 },
      dusk: { skyTop: '#2f3566', skyBottom: '#e8875e', sun: '#ffc08a', mtnFar: '#6a5f86', mtnNear: '#544c72', snow: '#c9b8cf', cloud: '#f3a98f',
        hillFar: '#5f7b6c', hillMid: '#4d6b58', treeFar: '#3c5648', grass: '#4d7a46', grassTop: '#6a9658', tint: '#3a2a66', tintOpacity: 0.3, stars: 0.4, sunY: 292, glow: 1 },
      night: { skyTop: '#0b1230', skyBottom: '#2a3b6a', sun: '#e8eefc', mtnFar: '#2c3658', mtnNear: '#222a48', snow: '#8d98b8', cloud: '#3a4672',
        hillFar: '#24364a', hillMid: '#1e3040', treeFar: '#18283a', grass: '#2f4d3c', grassTop: '#3e6249', tint: '#0c1640', tintOpacity: 0.45, stars: 1, moon: 1, sunY: 120, glow: 1.15 },
    },
    defs: ctx => `<linearGradient id="hs-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ctx.pal.skyTop}"/><stop offset="1" stop-color="${ctx.pal.skyBottom}"/></linearGradient>` +
      `<linearGradient id="hs-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ctx.pal.grass}"/><stop offset="1" stop-color="${ctx.pal.grassDark}"/></linearGradient>`,
    layers: [
      { name: 'sky', depth: 0, static: true, draw: ({ pal }) => {
        let o = `<rect x="-80" y="-80" width="1440" height="880" fill="url(#hs-sky)"/>`;
        for (let i = 0; i < 60 * pal.stars; i++) o += `<circle cx="${r1(hash(i) * 1280)}" cy="${r1(hash(i + 99) * 330)}" r="${r1(0.8 + hash(i + 7) * 1.4)}" fill="#fff" opacity="${r1(0.4 + 0.6 * hash(i + 3))}"/>`;
        // sun (or moon): a soft halo and a disc
        const sy = pal.sunY;
        o += `<circle cx="1010" cy="${sy}" r="120" fill="${pal.sun}" opacity="0.22"/><circle cx="1010" cy="${sy}" r="54" fill="${pal.sun}"/>`;
        if (pal.moon) o += `<circle cx="1032" cy="${sy - 12}" r="48" fill="${pal.skyTop}" opacity="0.9"/>`;
        return o;
      } },
      { name: 'mountains', depth: 0.12, static: true, draw: ({ pal }) => {
        const w = span(0.12) + 100;
        const far = x => 360 - 70 * Math.abs(Math.sin(x / 210 + 1)) - 40 * Math.sin(x / 97 + 2) * Math.sin(x / 330);
        const near = x => 420 - 60 * Math.abs(Math.sin(x / 260 + 2.4)) - 25 * Math.sin(x / 71);
        let o = `<path d="${fillUnder(far, -100, w, 760, 16)}" fill="${pal.mtnFar}"/>`;
        // a lit rim along the far ridge reads as snow/light without hard edges
        let rim = '';
        for (let x = -100; x <= w; x += 16) rim += (rim ? 'L' : 'M') + r1(x) + ' ' + r1(far(x) + 3);
        o += `<path d="${rim}" fill="none" stroke="${pal.snow}" stroke-width="5" opacity="0.35" stroke-linejoin="round"/>`;
        o += `<path d="${fillUnder(near, -100, w, 760, 16)}" fill="${pal.mtnNear}"/>`;
        return o;
      } },
      { name: 'clouds', depth: 0.22, draw: ({ t, pal }) => {
        const w = span(0.22) + 400;
        let o = '';
        for (let i = 0; i < 7; i++) {   // drift slowly to the right and wrap around
          const x = ((hash(i + 20) * w + t * (5 + 4 * hash(i))) % w) - 200, y = 70 + hash(i + 40) * 160;
          o += `<g opacity="${r1(0.75 + 0.25 * hash(i + 5))}">${cloud(x, y, 0.6 + 0.6 * hash(i + 11), pal.cloud)}</g>`;
        }
        return o;
      } },
      { name: 'farHills', depth: 0.4, static: true, draw: ({ pal }) => {
        const w = span(0.4) + 100;
        const f = x => 500 - 40 * Math.sin(x / 300 + 0.5) - 25 * Math.sin(x / 130 + 1.7);
        let o = `<path d="${fillUnder(f, -100, w, 760, 20)}" fill="${pal.hillFar}"/>`;
        for (let i = 0; i < 26; i++) {   // little round trees along the ridge
          const x = hash(i + 300) * w, y = f(x) + 6, s = 8 + hash(i + 301) * 10;
          o += `<rect x="${r1(x - 1.5)}" y="${r1(y - s)}" width="3" height="${r1(s)}" fill="${pal.treeFar}"/><circle cx="${r1(x)}" cy="${r1(y - s * 1.3)}" r="${r1(s * 0.8)}" fill="${pal.treeFar}"/>`;
        }
        return o;
      } },
      { name: 'midHills', depth: 0.68, static: true, draw: ({ pal }) => {
        const w = span(0.68) + 100;
        const f = x => 560 - 45 * Math.sin(x / 380 + 2.2) - 18 * Math.sin(x / 160);
        let o = `<path d="${fillUnder(f, -100, w, 760, 20)}" fill="${pal.hillMid}"/>`;
        for (let i = 0; i < 18; i++) {   // hedge bumps
          const x = hash(i + 500) * w, y = f(x) + 4;
          o += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(22 + hash(i) * 20)}" ry="${r1(10 + hash(i + 1) * 8)}" fill="${pal.treeFar}" opacity="0.8"/>`;
        }
        return o;
      } },
      { name: 'ground', depth: 1, static: true, draw: ({ pal }) => {
        let o = `<path d="${fillUnder(ground, -100, W + 100, 800, 12)}" fill="url(#hs-ground)"/>`;
        // a lit top edge of grass, then a dirt path a little below the surface (it reads as depth)
        o += `<path d="${fillUnder(ground, -100, W + 100, 800, 12)}" fill="none" stroke="${pal.grassTop}" stroke-width="7"/>`;
        let p = 'M-100 ' + r1(ground(-100) + 30), q = '';
        for (let x = -100; x <= W + 100; x += 12) { p += `L${x} ${r1(ground(x) + 24 + 4 * Math.sin(x / 90))}`; }
        for (let x = W + 100; x >= -100; x -= 12) { q += `L${x} ${r1(ground(x) + 52 + 6 * Math.sin(x / 70 + 1))}`; }
        o += `<path d="${p + q}Z" fill="${pal.path}"/><path d="${p}" fill="none" stroke="${pal.pathEdge}" stroke-width="3"/>`;
        // grass tufts along the edge (fixed pseudo-random spacing)
        for (let i = 0, x = -80; x < W + 80; i++, x += 26 + hash(i) * 30) {
          const y = ground(x) + 2, h = 7 + hash(i + 2) * 9;
          o += `<path d="M${r1(x - 5)} ${r1(y)}L${r1(x - 2)} ${r1(y - h)}L${r1(x)} ${r1(y)}L${r1(x + 3)} ${r1(y - h * 0.8)}L${r1(x + 6)} ${r1(y)}Z" fill="${pal.grassDark}"/>`;
        }
        // pebbles on the path
        for (let i = 0; i < 70; i++) { const x = hash(i + 900) * W; o += `<ellipse cx="${r1(x)}" cy="${r1(ground(x) + 34 + hash(i + 901) * 14)}" rx="${r1(2 + hash(i) * 3)}" ry="2" fill="${pal.pathEdge}"/>`; }
        // the rock at anchor "rock": something to stand beside or hide behind
        const rx = 2050 + 70, ry = ground(rx) + 6;
        o += `<path d="M${rx - 58} ${ry}C${rx - 60} ${ry - 40} ${rx - 30} ${ry - 72} ${rx + 4} ${ry - 70}C${rx + 40} ${ry - 68} ${rx + 62} ${ry - 36} ${rx + 60} ${ry}Z" fill="${pal.rock}"/>`;
        o += `<path d="M${rx - 34} ${ry - 50}C${rx - 18} ${ry - 64} ${rx + 6} ${ry - 64} ${rx + 20} ${ry - 54}" fill="none" stroke="${pal.rockLight}" stroke-width="6" stroke-linecap="round"/>`;
        o += `<path d="M${rx + 10} ${ry}C${rx + 30} ${ry - 16} ${rx + 52} ${ry - 18} ${rx + 60} ${ry}Z" fill="${pal.rockDark}"/>`;
        // the tree trunk and branch (leaves sway in the next layer)
        const tx = 1720, ty = ground(tx) + 4;
        o += `<path d="M${tx - 22} ${ty}C${tx - 14} ${ty - 90} ${tx - 18} ${ty - 190} ${tx - 10} ${ty - 300}L${tx + 14} ${ty - 300}C${tx + 16} ${ty - 190} ${tx + 14} ${ty - 90} ${tx + 26} ${ty}Z" fill="${pal.trunk}"/>`;
        o += `<path d="M${tx + 4} ${ty - 200}C${tx + 40} ${ty - 214} ${tx + 70} ${ty - 222} ${tx + 112} ${ty - 226}" fill="none" stroke="${pal.trunk}" stroke-width="11" stroke-linecap="round"/>`;
        o += `<path d="M${tx + 4} ${ty - 120}L${tx + 4} ${ty}" stroke="${pal.trunkDark}" stroke-width="5" opacity="0.5"/>`;
        o += `<ellipse cx="${tx + 2}" cy="${ty}" rx="40" ry="7" fill="${pal.grassDark}" opacity="0.6"/>`;
        return o;
      } },
      { name: 'groundLife', depth: 1, draw: ({ t, pal }) => {
        // things that move: tree canopy and flowers. Sway is a sine of t (pure function of time).
        const tx = 1720, ty = ground(tx) + 4, sw = 3 * Math.sin(t * 0.9);
        let o = `<g transform="translate(${r1(sw)} 0)">`;
        for (const [dx, dy, r, c] of [[-60, -330, 62, 'leafDark'], [40, -350, 70, 'leafDark'], [-10, -400, 66, 'leaf'], [-80, -380, 50, 'leaf'], [70, -300, 48, 'leaf'],
          [-40, -300, 52, 'leaf'], [20, -440, 46, 'leafLight'], [-50, -420, 34, 'leafLight'], [60, -390, 40, 'leafLight'], [110, -330, 34, 'leaf']]) {
          o += `<circle cx="${tx + dx}" cy="${r1(ty + dy)}" r="${r}" fill="${pal[c]}"/>`;
        }
        o += '</g>';
        for (let i = 0; i < 40; i++) {
          const x = hash(i + 700) * W, y = ground(x) + 6 + hash(i + 701) * 8, a = 8 * Math.sin(t * 1.6 + i);
          const c = [pal.flowerA, pal.flowerB, pal.flowerC][i % 3];
          o += `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(a)})"><path d="M0 0L0 -14" stroke="${pal.grassDark}" stroke-width="2"/><circle cx="0" cy="-15" r="4" fill="${c}"/><circle cx="0" cy="-15" r="1.6" fill="#f0a030"/></g>`;
        }
        return o;
      } },
      { name: 'foreground', depth: 1.35, front: true, draw: ({ t, pal }) => {
        // tall grass close to the lens, along the bottom edge only, so it never hides a face
        let o = '';
        const w = W * 1.35 + 200;
        for (let i = 0; i < 16; i++) {
          const x = hash(i + 1200) * w - 100, y = 735, h = 40 + hash(i + 1201) * 45, sw = 6 * Math.sin(t * 1.3 + i * 0.7);
          o += `<g fill="${pal.grassDark}">`;
          for (let k = -2; k <= 2; k++) o += `<path d="M${r1(x + k * 9 - 4)} ${y}Q${r1(x + k * 11 + sw * 0.5)} ${r1(y - h * 0.6)} ${r1(x + k * 13 + sw)} ${r1(y - h * (1 - Math.abs(k) * 0.18))}Q${r1(x + k * 9 + 2)} ${r1(y - h * 0.4)} ${r1(x + k * 9 + 5)} ${y}Z"/>`;
          o += '</g>';
        }
        return o;
      } },
    ],
    // colour grade for dawn/dusk/night: a multiply tint over the whole world (glows are added on top)
    overlay: ({ pal }) => pal.tint ? `<rect x="-20" y="-20" width="1320" height="760" fill="${pal.tint}" opacity="${pal.tintOpacity}" style="mix-blend-mode:multiply"/>` : '',
  };
  set.defaultVariant = 'day';
  (g.CharSets = g.CharSets || {}).hillside = set;
})(typeof globalThis !== 'undefined' ? globalThis : this);
