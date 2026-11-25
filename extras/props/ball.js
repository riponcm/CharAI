// props/ball.js - a light play ball. Grip contract: docs/PROPS.md.
(function (g) {
  'use strict';
  (g.CharProps = g.CharProps || {}).ball = {
    name: 'ball', base: [0, 12], size: [24, 24], weight: 0.03, hang: false,
    draw(t) {
      const a = (t * 400) % 360;
      return `<g transform="rotate(${a.toFixed(1)})"><circle r="12" fill="#e64b3c" stroke="#5a1a12" stroke-width="2"/>` +
        '<path d="M-12 0Q0 -7 12 0" fill="none" stroke="#fff3d6" stroke-width="3"/></g>';
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
