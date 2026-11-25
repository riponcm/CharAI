// actions/backaway.js - slow frightened steps backwards, palms out in front, eyes on the threat.
(function (g) { (g.CharActions = g.CharActions || {}).backaway = {
  channel: 'body', doc: 'slow frightened steps backwards, facing forward', face: 'scared', planted: 'none', travel: -1.2, anticipation: 0.5,
  keys: [
    { t: 0.3, x: -0.1, lean: -8, head: -4, crouch: 0.06, footNear: [-0.35, 0.18, 0], armNear: [35, 45, 0], armFar: [30, 50, 0], hands: 'open' },
    { t: 0.6, x: -0.3, lean: -10, crouch: 0.1, footNear: [-0.45, 0, 0] },
    { t: 0.9, x: -0.55, lean: -8, crouch: 0.06, footFar: [-0.65, 0.18, 0] },
    { t: 1.2, x: -0.8, lean: -10, crouch: 0.1, footFar: [-0.7, 0, 0] },
    { t: 1.5, x: -1.05, lean: -8, crouch: 0.06, footNear: [-0.95, 0.18, 0] },
    { t: 1.8, x: -1.2, lean: -8, crouch: 0.08, footNear: [-1.0, 0, 0], hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
