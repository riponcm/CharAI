// actions/jumpjoy.js - jump for joy on the spot: crouch, spring up with both fists high, land with a squash.
(function (g) { (g.CharActions = g.CharActions || {}).jumpjoy = {
  channel: 'body', doc: 'jump for joy, fists in the air', face: 'excited', air: [0.38, 0.8], height: 0.45,
  keys: [
    { t: 0.28, crouch: 0.35, lean: 16, armNear: [-40, 30, 0], armFar: [-45, 30, 0], hold: true },
    { t: 0.38, crouch: 0, lean: -4, armNear: [165, 10, 0], armFar: [155, 15, 0], hands: 'fist', squash: [0.95, 1.05], footNear: [0.12, 0, -30], footFar: [-0.08, 0, -30] },
    { t: 0.6, footNear: [0.12, 0.12, -15], footFar: [-0.08, 0.12, -15], squash: [1, 1] },
    { t: 0.8, footNear: [0.12, 0, 0], footFar: [-0.08, 0, 0] },
    { t: 0.9, crouch: 0.3, lean: 16, squash: [1.06, 0.94], armNear: [60, 40, 0], armFar: [50, 45, 0] },
  ] }; })(typeof self !== 'undefined' ? self : this);
