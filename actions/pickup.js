// actions/pickup.js - squat, pick something up from the ground in front, stand holding it at the chest.
(function (g) { (g.CharActions = g.CharActions || {}).pickup = {
  channel: 'body', doc: 'pick something up from the ground in front and hold it at the chest', end: 'hold',
  keys: [
    { t: 0.45, crouch: 0.75, lean: 34, bend: 14, head: 14, handNear: 'ground', handFar: ['ground', -0.05, 0], hands: 'open' },
    { t: 0.75, hold: true, hands: 'grip' },
    { t: 1.3, crouch: 0, lean: 2, bend: 0, head: 4, handNear: ['chest', 0.3, -0.05], handFar: ['chest', 0.28, -0.08] },
  ] }; })(typeof self !== 'undefined' ? self : this);
