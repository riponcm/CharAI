// actions/highfive.js - a paired action (docs/PAIRS.md): A: highfive(with=B). Both raise a hand, slap
// it against the other's above the head, swing down. A grown-up keeps the hand low for a child.
(function (g) { (g.CharActions = g.CharActions || {}).highfive = {
  pair: true, doc: 'raise a hand and slap it against the partner\'s', gap: 0.6,
  a: {
    low: { pose: 'heels', lean: 30 },
    keys: [
      { t: 0.3, lean: -4, handNear: ['up', 0.1, 0], hands: 'open' },
      { t: 0.5, lean: 8, handNear: ['partner.hand', 0, 1.2], hands: 'open', squash: [1.03, 0.97] },
      { t: 0.62, lean: 6, handNear: ['partner.hand', 0, 1.2], squash: [1, 1] },
      { t: 0.95, lean: 2, armNear: [30, 30, 0] },
      { t: 1.3, pose: 'stand', hands: 'relaxed' },
    ] },
  b: {
    low: { pose: 'heels', lean: 30 },
    keys: [
      { t: 0.32, lean: -4, handNear: ['up', 0.1, 0], hands: 'open' },
      { t: 0.5, lean: 7, handNear: ['partner.hand', 0, 1.2], hands: 'open', squash: [1.03, 0.97] },
      { t: 0.62, lean: 5, handNear: ['partner.hand', 0, 1.2], squash: [1, 1] },
      { t: 0.95, lean: 2, armNear: [30, 30, 0] },
      { t: 1.3, pose: 'stand', hands: 'relaxed' },
    ] },
}; })(typeof self !== 'undefined' ? self : this);
