// props/loaf.js - a loaf of bread. One hand holds it at its middle. Grip contract: docs/PROPS.md.
(function (g) {
  'use strict';
  (g.CharProps = g.CharProps || {}).loaf = {
    name: 'loaf', base: [0, 9], size: [38, 18], weight: 0.05, hang: false,
    draw() {
      return '<ellipse cx="0" cy="0" rx="19" ry="9.5" fill="#c98a3d" stroke="#5a3514" stroke-width="2"/>' +
        '<path d="M-10 -5Q-7 -1 -9 3M-2 -7Q1 -2 -1 3M6 -6Q9 -1 7 3" fill="none" stroke="#f1c27a" stroke-width="2.2" stroke-linecap="round"/>';
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
