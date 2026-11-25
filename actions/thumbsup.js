// actions/thumbsup.js - fist thrust forward with the thumb up, a nod and a grin, held.
(function (g) { (g.CharActions = g.CharActions || {}).thumbsup = {
  channel: 'arms', doc: 'thumbs up with a nod', face: 'happy', hold: 0.9, release: 0.4,
  keys: [
    { t: 0.25, armNear: [35, 100, 0], head: -3, lean: -2 },
    { t: 0.5, handNear: ['chest', 0.55, 0.3], hands: { near: 'thumb' }, head: 8, lean: 3 },
    { t: 0.62, handNear: ['chest', 0.6, 0.32], head: -3, lean: 1 },
    { t: 0.8, head: -2, hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
