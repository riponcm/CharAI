(function (g) { (g.CharActions = g.CharActions || {}).cry = {
  channel: 'body', doc: 'cry into both hands, shoulders shaking', face: 'sad', end: 'hold', loop: [0.9, 1.2],
  keys: [
    { t: 0.5, lean: 10, bend: 14, head: 18, crouch: 0.06, handNear: ['eye', 0.1, 0], handFar: ['eye', 0.1, 0], hands: 'open' },
    { t: 0.9, lean: 16, bend: 22, head: 28, neck: 10, crouch: 0.1, handNear: 'eye', handFar: 'eye', hold: true },
    { t: 1.05, lean: 16, bend: 26, head: 30, crouch: 0.14, handNear: 'eye', handFar: 'eye' },
    { t: 1.2, lean: 16, bend: 22, head: 28, crouch: 0.1, handNear: 'eye', handFar: 'eye' },
  ] }; })(typeof self !== 'undefined' ? self : this);
