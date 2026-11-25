// actions/shrug.js - "I don't know": elbows in, palms up and out, head tilts, a little lift.
(function (g) { (g.CharActions = g.CharActions || {}).shrug = {
  channel: 'arms', doc: 'shrug, palms up', release: 0.4,
  keys: [
    { t: 0.25, armNear: [8, 95, -55], armFar: [4, 90, -55], hands: 'open', head: 10, lean: -3, bob: 0.04 },
    { t: 0.75, hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
