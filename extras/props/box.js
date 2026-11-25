// props/box.js - a heavy cardboard box, carried in both arms. Grip contract: docs/PROPS.md.
(function (g) {
  'use strict';
  (g.CharProps = g.CharProps || {}).box = {
    name: 'box', base: [0, 20], size: [52, 40], weight: 0.6, hang: false,
    grips: { near: [-24, 2], far: [24, 2] },   // a hand on each side
    draw() {
      return '<rect x="-26" y="-20" width="52" height="40" rx="2" fill="#c49a62" stroke="#5c4223" stroke-width="2"/>' +
        '<path d="M-26 -12L26 -12M-6 -20L-6 -12M6 -20L6 -12" stroke="#8a6a3e" stroke-width="2"/>';
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
