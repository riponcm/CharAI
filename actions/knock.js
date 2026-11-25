// actions/knock.js - knock on a door ahead: fist raised, three raps on the wall, hand pulled back between them.
(function (g) { (g.CharActions = g.CharActions || {}).knock = {
  channel: 'body', doc: 'knock on a door in front, three raps', wall: 0.95, planted: 'both',
  keys: [
    { t: 0.3, lean: 2, head: -3, handNear: ['wall', -0.2, 0.05], hands: 'fist', handFar: ['hip', 0, 0] },
    { t: 0.45, lean: 7, head: 2, handNear: 'wall' },
    { t: 0.58, lean: 4, handNear: ['wall', -0.2, 0.1] },
    { t: 0.7, lean: 7, handNear: 'wall' },
    { t: 0.82, lean: 4, handNear: ['wall', -0.2, 0.1] },
    { t: 0.94, lean: 7, handNear: 'wall' },
    { t: 1.2, lean: 4, head: 4, handNear: ['wall', -0.2, 0.0] },
    { t: 1.7, hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
