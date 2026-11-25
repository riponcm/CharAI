(function (g) { (g.CharActions = g.CharActions || {}).tripfall = {
  channel: 'body', doc: 'trip forward and fall flat, staying down', face: 'scared', planted: 'none', end: 'hold', travel: 1.0, anticipation: 0,
  keys: [
    { t: 0.15, x: 0.1, lean: 18, footNear: [0.25, 0.12, -25], armNear: [50, 30, 0], armFar: [45, 30, 0], hands: 'open', mouth: 'o' },
    { t: 0.4, x: 0.4, lean: 50, crouch: 0.3, footNear: [0.3, 0.1, 0], armNear: [110, 10, 0], armFar: [105, 10, 0] },
    { t: 0.7, x: 0.8, lean: 85, crouch: 0.75, footNear: [-0.4, 0.3, 40], footFar: [-0.6, 0.2, 40], handNear: 'ground', handFar: 'ground' },
    { t: 0.95, x: 1.0, lean: 90, crouch: 1, hold: true, mouth: null },
  ] }; })(typeof self !== 'undefined' ? self : this);
