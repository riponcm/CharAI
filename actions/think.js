(function (g) { (g.CharActions = g.CharActions || {}).think = {
  channel: 'body', doc: 'hand to chin, weight on one leg, head tilted', end: 'hold', planted: 'both',
  keys: [
    { t: 0.4, lean: -3, head: -4, tilt: 4, handNear: ['front', 0, -0.2] },
    { t: 0.9, tilt: 6, lean: 3, head: 8, handNear: ['chin', 0.02, -0.08], hands: 'relaxed', handFar: ['belly', 0.05, 0.1], hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
