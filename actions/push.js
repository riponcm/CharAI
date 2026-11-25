// actions/push.js - set both palms on a heavy thing ahead, dig the back foot in, lean on it and shove.
(function (g) { (g.CharActions = g.CharActions || {}).push = {
  channel: 'body', doc: 'lean into a heavy object in front and shove', wall: 0.95, planted: 'none', face: 'angry',
  keys: [
    { t: 0.4, lean: 10, crouch: 0.1, handNear: 'wall', handFar: 'wall', hands: 'open', footNear: [0.2, 0, 0], footFar: [-0.35, 0, 0] },
    { t: 1.2, x: 0.06, lean: 34, crouch: 0.25, head: -6, mouth: 'grit', footFar: [-0.5, 0, 0], hold: true },
    { t: 1.9, x: 0.12, lean: 38, crouch: 0.3, hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
