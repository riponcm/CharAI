// actions/getup.js - get up from lying on the back: sit up, tuck the feet into a squat, stand.
(function (g) { (g.CharActions = g.CharActions || {}).getup = {
  channel: 'body', doc: 'get up from lying on the ground (after liedown)', planted: 'none', anticipation: 0,
  keys: [
    { t: 0.3, pose: 'lie', hold: true },
    { t: 0.8, pose: 'sit', lean: 10, handNear: ['ground', -0.6, 0] },
    { t: 1.4, pose: 'squat', handNear: 'ground' },
    { t: 2.0, stand: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
