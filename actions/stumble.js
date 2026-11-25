// actions/stumble.js - trip on something, pitch forward, catch it with a quick step, recover.
(function (g) { (g.CharActions = g.CharActions || {}).stumble = {
  channel: 'body', doc: 'trip forward and catch yourself (moves about 0.7 leg lengths)', planted: 'none', travel: 0.7, anticipation: 0,
  keys: [
    { t: 0.14, x: 0.1, lean: 22, head: -6, footNear: [0.2, 0.1, -25], armNear: [55, 30, 0], armFar: [40, 40, 0], hands: 'open', mouth: 'o' },
    { t: 0.34, x: 0.35, lean: 32, crouch: 0.12, footFar: [0.7, 0.14, 10] },
    { t: 0.48, x: 0.48, lean: 22, crouch: 0.25, footFar: [0.78, 0, 0], squash: [1.03, 0.97] },
    { t: 0.66, x: 0.6, lean: 10, crouch: 0.12, footNear: [0.55, 0.12, 0] },
    { t: 0.84, x: 0.7, lean: 2, crouch: 0.02, footNear: [0.82, 0, 0], armNear: [10, 20, 0], armFar: [-4, 24, 0], squash: [1, 1], mouth: null },
  ] }; })(typeof self !== 'undefined' ? self : this);
