// actions/pull.js - grip a rope or handle ahead, sit back on the heels, haul the hands in to the chest.
(function (g) { (g.CharActions = g.CharActions || {}).pull = {
  channel: 'body', doc: 'grip something in front and haul back with the body weight', planted: 'none', travel: -0.2, face: 'angry',
  keys: [
    { t: 0.4, lean: 18, crouch: 0.2, armNear: [80, 10, 0], armFar: [80, 10, 0], hands: 'grip', footNear: [0.3, 0, 0], footFar: [-0.2, 0, 0] },
    { t: 1.2, x: -0.12, lean: -20, crouch: 0.3, bend: -4, head: 4, mouth: 'grit', armNear: [55, 95, 0], armFar: [55, 95, 0], hold: true },
    { t: 1.9, x: -0.2, lean: -24, crouch: 0.3, hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
