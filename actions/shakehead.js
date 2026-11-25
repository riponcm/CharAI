// actions/shakehead.js - no: the face swings away and back, shoulders counter, chin a little down.
(function (g) { (g.CharActions = g.CharActions || {}).shakehead = {
  channel: 'arms', doc: 'no: head swings side to side (times = swings)', loop: [0.35, 0.7], args: { times: 3, for: 0 }, hold: 0.1, release: 0.4, face: 'sad',
  keys: [
    { t: 0.18, head: 3, lean: -2, turn: 0.25 },
    { t: 0.35, turn: 0.9, head: 6, twist: -10 },
    { t: 0.52, turn: -0.9, head: 8, twist: 10 },
    { t: 0.7, turn: 0.9, head: 6, twist: -10 },
  ] }; })(typeof self !== 'undefined' ? self : this);
