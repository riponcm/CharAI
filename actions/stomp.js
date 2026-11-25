// actions/stomp.js - an angry stomp: lift the near foot, stamp it down, fists clenched.
(function (g) { (g.CharActions = g.CharActions || {}).stomp = {
  channel: 'body', doc: 'stamp a foot in anger', face: 'angry', planted: 'far',
  keys: [
    { t: 0.22, footNear: [0.2, 0.5, 15], crouch: 0.05, lean: -4, armNear: [20, 70, 0], armFar: [12, 75, 0], hands: 'fist' },
    { t: 0.34, footNear: [0.18, 0, 0], crouch: 0.22, lean: 10, bend: 8, head: 6, squash: [1.05, 0.95], hold: true },
    { t: 0.7, crouch: 0.05, lean: 4, squash: [1, 1] },
  ] }; })(typeof self !== 'undefined' ? self : this);
