// props/door.js - a closed door standing on the ground (an upright: knock on it, lean on it, push it).
// The grip is the handle; the face is the vertical line x = 0 of the drawing. Grip contract: docs/PROPS.md.
(function (g) {
  'use strict';
  (g.CharProps = g.CharProps || {}).door = {
    name: 'door', base: [0, 110], size: [14, 240], weight: 1, hang: false, upright: true,
    draw() {
      return '<rect x="0" y="-130" width="14" height="240" fill="#6b4a2f" stroke="#2f1f12" stroke-width="2"/>' +
        '<rect x="-6" y="-14" width="7" height="12" rx="2" fill="#d9b44a" stroke="#5a4510" stroke-width="1.5"/>';
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
