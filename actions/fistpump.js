// actions/fistpump.js - crouch, spring up with the fist driven overhead and a shout, then yank it down to the hip twice.
(function (g) { (g.CharActions = g.CharActions || {}).fistpump = {
  channel: 'body', doc: 'yes! a fist pump', face: 'happy', anticipation: 0.8,
  keys: [
    { t: 0.22, lean: 10, crouch: 0.2, armNear: [-15, 70, 0], armFar: [-10, 50, 0], hands: 'fist' },
    { t: 0.4, lean: -8, crouch: 0, rise: 0.5, armNear: [165, 15, 0], armFar: [15, 50, 0], head: -10, mouth: 'open' },
    { t: 0.52, hold: true },
    { t: 0.68, lean: 8, crouch: 0.12, rise: 0, armNear: [60, 120, 0], head: 4, mouth: null },
    { t: 0.85, lean: -6, rise: 0.3, armNear: [155, 25, 0], head: -8, mouth: 'open' },
    { t: 1.0, hold: true },
    { t: 1.25, lean: 4, rise: 0, crouch: 0.08, armNear: [45, 100, 0], mouth: null },
  ] }; })(typeof self !== 'undefined' ? self : this);
