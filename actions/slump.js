// actions/slump.js - the shoulders give way: lean, round the back, head down, arms hang. Holds.
(function (g) { (g.CharActions = g.CharActions || {}).slump = {
  channel: 'body', doc: 'slump sadly and stay slumped', face: 'sad', end: 'hold', settle: 0.5,
  keys: [
    { t: 0.8, lean: 18, bend: 26, head: 26, neck: 16, crouch: 0.12, armNear: [-3, 4, 0], armFar: [-5, 4, 0], hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
