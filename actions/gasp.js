// actions/gasp.js - sharp startle: body snaps back and up on the toes, both hands fly to the open mouth, held, then slow release.
(function (g) { (g.CharActions = g.CharActions || {}).gasp = {
  channel: 'body', doc: 'a sharp startle: hands up, body back', face: 'scared', contact: true, anticipation: 0.3, settle: 1.3,
  keys: [
    { t: 0.12, lean: -14, bend: -8, head: -10, rise: 0.35, chest: 1.05, handNear: ['mouth', 0.12, -0.05], handFar: ['mouth', 0.1, -0.12], hands: 'open', mouth: 'o' },
    { t: 0.22, lean: -18, head: -12, rise: 0.35, squash: [0.98, 1.03], hold: true },
    { t: 0.9, hold: true },
    { t: 1.3, lean: -8, rise: 0.1, squash: [1, 1], mouth: null },
  ] }; })(typeof self !== 'undefined' ? self : this);
