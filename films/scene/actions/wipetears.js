(function (g) { (g.CharActions = g.CharActions || {}).wipetears = {
  channel: 'arms', doc: 'rub the eyes with the back of a fist, sniffle (times = rubs)', args: { times: 3, for: 0 }, loop: [0.4, 0.7], contact: true,
  keys: [
    { t: 0.4, handNear: ['eye', 0.1, -0.05], hands: 'fist', handFar: ['chest', 0.2, -0.2], head: 8 },
    { t: 0.55, handNear: ['eye', 0.18, -0.12] },
    { t: 0.7, handNear: ['eye', 0.1, -0.05] },
  ] }; })(typeof self !== 'undefined' ? self : this);
