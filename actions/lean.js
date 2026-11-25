// actions/lean.js - lean on a wall ahead with one hand, weight on it, and stay.
(function (g) { (g.CharActions = g.CharActions || {}).lean = {
  channel: 'body', doc: 'lean one hand on a wall in front and rest there', wall: 0.9, end: 'hold',
  keys: [
    { t: 0.45, lean: 14, x: 0.06, handNear: 'wall', hands: 'open', head: -4 },
    { t: 0.9, lean: 18, x: 0.08, bend: 6, handNear: ['wall', 0, -0.1], hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
