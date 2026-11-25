(function (g) { (g.CharActions = g.CharActions || {}).dance = {
  channel: 'body', doc: 'a simple two-step with swinging arms (for = seconds)', face: 'happy', planted: 'none', loop: [0.3, 1.1], args: { times: 4, for: 0 },
  keys: [
    { t: 0.3, tilt: 6, lean: 3, crouch: 0.1, footNear: [0.35, 0.1, 0], footFar: [-0.08, 0, 0], armNear: [50, 60, 0], armFar: [-25, 40, 0] },
    { t: 0.5, tilt: 0, crouch: 0.05, footNear: [0.35, 0, 0], footFar: [-0.08, 0, 0], armNear: [20, 50, 0], armFar: [20, 50, 0] },
    { t: 0.7, tilt: -6, lean: 3, crouch: 0.1, footNear: [0.12, 0, 0], footFar: [-0.3, 0.1, 0], armNear: [-25, 40, 0], armFar: [50, 60, 0] },
    { t: 0.9, tilt: 0, crouch: 0.05, footNear: [0.12, 0, 0], footFar: [-0.3, 0, 0], armNear: [20, 50, 0], armFar: [20, 50, 0] },
    { t: 1.1, tilt: 6, lean: 3, crouch: 0.1, footNear: [0.35, 0.1, 0], footFar: [-0.08, 0, 0], armNear: [50, 60, 0], armFar: [-25, 40, 0] },
  ] }; })(typeof self !== 'undefined' ? self : this);
