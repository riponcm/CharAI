(function (g) { (g.CharActions = g.CharActions || {}).putdown = {
  channel: 'body', doc: 'bend and set something on the ground', keys: [
    { t: 0.45, lean: -4, handNear: ['belly', 0.35, 0], handFar: ['belly', 0.35, 0], hands: 'grip' },
    { t: 1.0, lean: 34, crouch: 0.7, bend: 14, head: 14, handNear: 'ground', handFar: ['ground', -0.05, 0] },
    { t: 1.4, hold: true, hands: 'open' },
    { t: 1.9, lean: 4, crouch: 0, bend: 0, handNear: ['chest', 0, -0.4], handFar: ['chest', 0, -0.4] },
  ] }; })(typeof self !== 'undefined' ? self : this);
