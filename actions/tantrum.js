// actions/tantrum.js - stamp hard, feet thrown high, fists hammering down, body slamming, face red.
(function (g) { (g.CharActions = g.CharActions || {}).tantrum = {
  channel: 'body', doc: 'stamp both feet in turn, fists shaking', face: 'angry', planted: 'none', loop: [0.25, 0.7], args: { times: 3, for: 0 },
  keys: [
    { t: 0.25, lean: -4, tilt: 6, crouch: 0.05, head: -8, footNear: [0.2, 0.9, 25], footFar: [-0.08, 0, 0], armNear: [150, 90, 0], armFar: [140, 90, 0], hands: 'fist', mouth: 'grit' },
    { t: 0.35, lean: 14, tilt: 0, crouch: 0.3, head: 6, footNear: [0.12, 0, 0], footFar: [-0.08, 0, 0], armNear: [20, 40, 0], armFar: [15, 40, 0], squash: [1.04, 0.95] },
    { t: 0.6, lean: -4, tilt: -6, crouch: 0.05, head: -8, footNear: [0.12, 0, 0], footFar: [-0.02, 0.9, 25], armNear: [140, 90, 0], armFar: [150, 90, 0], squash: [1, 1] },
    { t: 0.7, lean: 14, tilt: 0, crouch: 0.3, head: 6, footNear: [0.12, 0, 0], footFar: [-0.08, 0, 0], armNear: [15, 40, 0], armFar: [20, 40, 0], squash: [1.04, 0.95] },
  ] }; })(typeof self !== 'undefined' ? self : this);
