(function (g) { (g.CharActions = g.CharActions || {}).checkwatch = {
  channel: 'arms', doc: 'raise the wrist and look down at it', hold: 1, release: 0.4,
  keys: [
    { t: 0.3, armNear: [30, 90, 0], lean: -1 },
    { t: 0.7, handNear: ['chest', 0.35, 0.2], hands: 'relaxed', head: 20, lean: 4 },
    { t: 0.9, hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
