// props/chair.js - a wooden kitchen chair, back on the left. The grip is the middle of the seat (carry it
// by the seat); base is the floor under it; seat is where a sitter's seat goes. Grip contract: docs/PROPS.md.
(function (g) {
  'use strict';
  (g.CharProps = g.CharProps || {}).chair = {
    name: 'chair', base: [0, 104], size: [64, 190], weight: 0.35, hang: false, seat: [0, 0],
    draw() {
      const w = '#8b5a2b', d = '#4a2c12';
      return `<rect x="-34" y="-90" width="8" height="194" rx="3" fill="${w}" stroke="${d}" stroke-width="2"/>` +
        `<rect x="-30" y="-80" width="10" height="44" fill="${w}" stroke="${d}" stroke-width="1.5"/>` +
        `<rect x="22" y="2" width="8" height="102" rx="3" fill="${w}" stroke="${d}" stroke-width="2"/>` +
        `<rect x="-36" y="-6" width="70" height="10" rx="3" fill="${w}" stroke="${d}" stroke-width="2"/>`;
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
