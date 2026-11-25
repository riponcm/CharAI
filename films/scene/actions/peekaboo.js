(function (g) { (g.CharActions = g.CharActions || {}).peekaboo = {
  channel: 'arms', doc: 'hands over the face, then flung open: peekaboo', contact: true, hold: 0.3, face: 'happy',
  keys: [
    { t: 0.35, handNear: ['eye', 0.15, 0], handFar: ['eye', 0.1, 0.05], hands: 'open', hold: true },
    { t: 0.9, hold: true },
    { t: 1.15, armNear: [120, 20, 0], armFar: [110, 30, 0], head: -8, mouth: 'open' },
  ] }; })(typeof self !== 'undefined' ? self : this);
