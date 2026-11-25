// actions/hi.js - a quick "hi": hand up beside the head, palm out, a little wag, down.
(function (g) { (g.CharActions = g.CharActions || {}).hi = {
  channel: 'arms', doc: 'a quick hi with one raised hand', face: 'happy', release: 0.35,
  keys: [
    { t: 0.22, armNear: [135, 30, -15], hands: { near: 'open' }, head: -4, turn: 0.3 },
    { t: 0.4, armNear: [140, 15, -25] },
    { t: 0.58, armNear: [132, 40, -5] },
    { t: 0.76, armNear: [138, 20, -20], hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
