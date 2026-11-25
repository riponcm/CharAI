// actions/throw.js - wind up back with the weight on the rear foot, step into it, whip the arm through and open the hand, follow through.
(function (g) { (g.CharActions = g.CharActions || {}).throw = {
  channel: 'body', doc: 'wind up and throw overarm', planted: 'none', anticipation: 0.6, settle: 1.2,
  keys: [
    { t: 0.5, lean: -16, twist: -30, crouch: 0.1, head: -4, footNear: [0.1, 0, 0], armNear: [170, 90, 0], armFar: [85, 15, 0], hands: 'grip' },
    { t: 0.68, lean: 8, twist: 5, crouch: 0.15, footNear: [0.4, 0.1, 0], armNear: [140, 40, 0], armFar: [60, 30, 0] },
    { t: 0.78, lean: 26, twist: 28, crouch: 0.18, head: 8, footNear: [0.45, 0, 0], armNear: [95, 0, 0], armFar: [-15, 40, 0], hands: 'open' },
    { t: 1.0, lean: 30, twist: 22, armNear: [20, 5, 0], armFar: [-10, 45, 0], hold: true },
    { t: 1.6, hold: true, lean: 16, twist: 0, armNear: [30, 10, 0] },
  ] }; })(typeof self !== 'undefined' ? self : this);
