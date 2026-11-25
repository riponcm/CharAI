// actions/salute.js - salute: elbow lifts, hand snaps to the brow, held, snapped down.
(function (g) { (g.CharActions = g.CharActions || {}).salute = {
  channel: 'arms', doc: 'salute: hand to brow, held, snapped down', contact: true, hold: 0.8, release: 0.2,
  keys: [
    { t: 0.22, armNear: [50, 100, 0], lean: -2, head: -2, bob: 0.01 },
    { t: 0.4, handNear: ['forehead', 0.0, -0.02], hands: 'open', lean: -4, head: -4, bob: 0.02 },
    { t: 0.55, hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
