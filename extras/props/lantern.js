// props/lantern.js - a small hand lantern with a flickering flame and a glow. Copy this file to make a prop.
//
// A prop registers CharProps.<name> with:
//   grip    the point the hand holds is the origin (0,0) of the drawing; draw everything around it, y down, px
//   base    [x, y] of the point that touches the ground when the prop is put down or dropped
//   hang    true: it hangs from the hand and swings with the hand's motion (lanterns, bags);
//           false: it turns with the hand (swords, sticks)
//   glow    optional { at: [x, y], r, color, strength } - a light added on top of the picture,
//           drawn after the set's dusk/night tint so it really lights up the dark
//   draw(t, ctx) -> SVG     ctx = { held, swing }. Pure function of t.
(function (g) {
  'use strict';
  const r1 = v => Math.round(v * 100) / 100;
  const C = { metal: '#3c3a40', metalLight: '#6d6a72', glass: '#ffe7a8', glassEdge: '#f2c463', flame: '#ff9f2e', core: '#fff6d0' };
  const lantern = {
    name: 'lantern', base: [0, 52], hang: true,
    glow: { at: [0, 31], r: 190, color: '#ffc463', strength: 0.85 },
    draw(t) {
      const fl = 1 + 0.12 * Math.sin(t * 17.3) + 0.08 * Math.sin(t * 29.1 + 0.7);   // flame flicker
      const lean = 1.5 * Math.sin(t * 6.1);
      return '' +
        `<path d="M-6 6C-6 -3 6 -3 6 6" fill="none" stroke="${C.metal}" stroke-width="2.6" stroke-linecap="round"/>` +   // handle ring
        `<path d="M-11 15L-6 7L6 7L11 15Z" fill="${C.metal}"/><rect x="-13" y="14" width="26" height="4" rx="1.5" fill="${C.metalLight}"/>` +   // cap
        `<rect x="-11" y="18" width="22" height="26" rx="3" fill="${C.glass}" stroke="${C.glassEdge}" stroke-width="1.5"/>` +   // glass
        `<ellipse cx="${r1(lean * 0.4)}" cy="${r1(36 - 6 * fl)}" rx="${r1(4.2 * fl)}" ry="${r1(8 * fl)}" fill="${C.flame}"/>` +
        `<ellipse cx="${r1(lean * 0.3)}" cy="${r1(37 - 4 * fl)}" rx="2.2" ry="${r1(4.5 * fl)}" fill="${C.core}"/>` +
        `<path d="M-11 22L11 22M-11 40L11 40M0 18L0 21M-5 44L-5 18M5 44L5 18" stroke="${C.metal}" stroke-width="1.2" opacity="0.55"/>` +   // frame bars
        `<rect x="-14" y="44" width="28" height="5" rx="2" fill="${C.metal}"/><rect x="-10" y="49" width="20" height="3" rx="1" fill="${C.metalLight}"/>`;
    },
  };
  (g.CharProps = g.CharProps || {}).lantern = lantern;
})(typeof globalThis !== 'undefined' ? globalThis : this);
