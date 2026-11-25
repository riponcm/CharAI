(function (g) { (g.CharActions = g.CharActions || {}).offerhand = {
  channel: 'arms', doc: 'hold a hand out for a handshake and keep it there', face: 'happy', hold: 1.5, release: 0.4,
  keys: [
    { t: 0.25, armNear: [30, 70, 0], lean: -2 },
    { t: 0.6, handNear: ['front', 0, -0.25], hands: 'open', lean: 4, head: -3 },
    { t: 0.8, hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
