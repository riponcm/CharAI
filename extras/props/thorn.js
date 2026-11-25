// props/thorn.js - a long, curved thorn (pulled out of a paw). Format: see props/lantern.js.
// Held by its thick end; the point sticks out past the fingers.
(function (g) {
  'use strict';
  const thorn = {
    name: 'thorn', base: [0, 3], hang: false,
    draw() {
      return '<path d="M-7 3C3 -1 20 -12 44 -30C27 -8 12 3 -6 10Z" fill="#c9995c" stroke="#23150d" stroke-width="2" stroke-linejoin="round"/>' +
        '<path d="M-3 4C8 0 22 -9 37 -23" fill="none" stroke="#f0d2a0" stroke-width="2" stroke-linecap="round"/>' +
        '<circle cx="-5" cy="7" r="4" fill="#9a2a22" opacity="0.85"/>';
    },
  };
  (g.CharProps = g.CharProps || {}).thorn = thorn;
})(typeof globalThis !== 'undefined' ? globalThis : this);
