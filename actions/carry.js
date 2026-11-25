// actions/carry.js - scoop a heavy load up from the ground, then hold it against the belly, leaning back to balance it, strained.
(function (g) { (g.CharActions = g.CharActions || {}).carry = {
  channel: 'body', doc: 'hold a heavy load in both arms in front and keep holding', end: 'hold', face: 'scared',
  keys: [
    { t: 0.5, lean: 18, crouch: 0.25, bend: 8, handNear: ['ground', 0, 0], handFar: ['ground', 0, 0], hands: 'grip' },
    { t: 1.2, lean: -14, crouch: 0.15, bend: -6, head: -4, handNear: ['belly', 0.4, 0.05], handFar: ['belly', 0.4, 0.05], mouth: 'grit', hold: true },
    { t: 1.5, lean: -20, crouch: 0.12, bend: -8, head: 2, chest: 1.03 },
    { t: 1.9, lean: -17, crouch: 0.14, hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
