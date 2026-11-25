// actions/skip.js - skip forward: step-hop on one foot, then the other, arms swinging.
(function (g) { (g.CharActions = g.CharActions || {}).skip = {
  channel: 'body', doc: 'skip forward happily (about 1.5 leg lengths)', travel: 1.5, face: 'happy', anticipation: 0,
  keys: [
    { t: 0.2, x: 0.2, y: 0.13, footNear: [0.45, 0.38, 15], footFar: [-0.05, 0.04, -25], armNear: [-35, 50, 0], armFar: [55, 55, 0] },
    { t: 0.38, x: 0.4, y: 0, footNear: [0.5, 0, 0], footFar: [0.15, 0.08, -10] },
    { t: 0.58, x: 0.75, y: 0.13, footFar: [0.95, 0.38, 15], footNear: [0.55, 0.04, -25], armNear: [55, 55, 0], armFar: [-35, 50, 0] },
    { t: 0.76, x: 0.95, y: 0, footFar: [1.0, 0, 0], footNear: [0.7, 0.08, -10] },
    { t: 0.96, x: 1.3, y: 0.13, footNear: [1.45, 0.38, 15], footFar: [1.0, 0.04, -25], armNear: [-35, 50, 0], armFar: [55, 55, 0] },
    { t: 1.14, x: 1.5, y: 0, footNear: [1.55, 0, 0], footFar: [1.4, 0, 0], armNear: [7, 16, 10], armFar: [-9, 24, 4] },
  ] }; })(typeof self !== 'undefined' ? self : this);
