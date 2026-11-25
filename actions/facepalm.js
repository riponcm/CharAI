// actions/facepalm.js - hand slaps onto the face, head drops into it, a long sigh.
(function (g) { (g.CharActions = g.CharActions || {}).facepalm = {
  channel: 'arms', doc: 'hand slaps onto the face, head drops', contact: true, hold: 1.2, release: 0.5, face: 'sad',
  keys: [
    { t: 0.3, armNear: [40, 100, 0], head: -3, lean: -3 },
    { t: 0.5, handNear: ['eye', 0.02, 0.0], hands: 'open', head: 10, lean: 4 },
    { t: 0.62, handNear: ['eye', -0.02, -0.02], head: 20, lean: 8 },
    { t: 0.9, hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
