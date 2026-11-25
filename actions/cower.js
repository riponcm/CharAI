// actions/cower.js - flinch away, shrink down, both forearms crossed in front of the face, elbows tucked low.
(function (g) { (g.CharActions = g.CharActions || {}).cower = {
  channel: 'body', doc: 'shrink down, arms over the head', face: 'scared', end: 'hold', settle: 0.4, anticipation: 0.3,
  keys: [
    { t: 0.15, lean: -10, crouch: 0.05, head: -6, rise: 0.2, armNear: [70, 70, 0], armFar: [65, 70, 0], hands: 'open' },
    { t: 0.5, lean: 26, bend: 20, head: 20, crouch: 0.55, turn: -0.4, armNear: [85, 135, 0], armFar: [80, 135, 0], hands: 'fist', rise: 0, hold: true },
    { t: 0.9, lean: 28, crouch: 0.6, squash: [1.02, 0.97], hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
