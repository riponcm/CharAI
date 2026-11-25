// actions/liedown.js - lower to the ground (squat, sit with a hand down), then roll back and lie flat; stays down.
(function (g) { (g.CharActions = g.CharActions || {}).liedown = {
  channel: 'body', doc: 'go from standing down to lying on the back', planted: 'none', end: 'lie', anticipation: 0.5,
  keys: [
    { t: 0.5, pose: 'squat', lean: 20, handNear: 'ground', hands: 'open', hold: true },
    { t: 1.0, pose: 'sit', lean: 8, handNear: 'ground', hold: true },
    { t: 1.8, pose: 'lie', head: -8, hold: true },
    { t: 2.3, hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
