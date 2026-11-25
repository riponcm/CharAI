// actions/stepup.js - step up onto a step in front (height in leg lengths) and stay on it.
(function (g) { (g.CharActions = g.CharActions || {}).stepup = {
  channel: 'body', doc: 'step up onto a step ahead (height = step height in leg lengths); stays up', args: { height: 0.25 },
  step: { ahead: 0.35, height: 0.25 }, end: 'hold',
  keys: [
    { t: 0.3, lean: 10, footNear: ['step', 0] },
    { t: 0.6, x: 0.45, y: 0.25, lean: 14, footFar: [-0.08, 0, -30], armNear: [-25, 30, 0], armFar: [30, 35, 0] },
    { t: 0.9, x: 0.55, y: 0.25, lean: 4, footFar: ['step', -0.2] },
    { t: 1.2, x: 0.55, y: 0.25, lean: -2, armNear: [7, 16, 10], armFar: [-9, 24, 4], hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
