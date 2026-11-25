// actions/clap.js - clap in front of the chest, times = number of claps.
(function (g) { (g.CharActions = g.CharActions || {}).clap = {
  channel: 'arms', doc: 'clap the hands in front of the chest (times = claps, or for = seconds)', args: { times: 4, for: 0 }, loop: [0.3, 0.56], release: 0.35, face: 'happy',
  keys: [
    { t: 0.3, handNear: ['chest', 0.35, 0.12], handFar: ['chest', 0.3, -0.08], hands: 'open' },
    { t: 0.43, handNear: ['chest', 0.32, 0.02], handFar: ['chest', 0.32, 0.0] },
    { t: 0.56, handNear: ['chest', 0.35, 0.12], handFar: ['chest', 0.3, -0.08] },
  ] }; })(typeof self !== 'undefined' ? self : this);
