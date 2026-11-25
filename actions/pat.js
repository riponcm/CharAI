// actions/pat.js - a paired action (docs/PAIRS.md): A: pat(with=B). Pat the partner on the shoulder three
// times; the partner nods. For a child the hand goes on the head.
(function (g) { (g.CharActions = g.CharActions || {}).pat = {
  pair: true, doc: 'pat the partner on the shoulder (a child: on the head) three times', gap: 0.45,
  a: {
    low: { lean: 18, head: 8 },
    keys: [
      { t: 0.35, lean: 4, handNear: ['partner.shoulder', 0, -0.45], hands: 'open', low: { handNear: ['partner.top', 0, 0.14] }, high: { handNear: 'partner.front' } },
      { t: 0.5, handNear: ['partner.shoulder', 0, -0.6], low: { handNear: 'partner.top' }, high: { handNear: 'partner.front' } },
      { t: 0.66, handNear: ['partner.shoulder', 0, -0.48], low: { handNear: ['partner.top', 0, 0.1] }, high: { handNear: 'partner.front' } },
      { t: 0.8, handNear: ['partner.shoulder', 0, -0.6], low: { handNear: 'partner.top' }, high: { handNear: 'partner.front' } },
      { t: 0.96, handNear: ['partner.shoulder', 0, -0.48], low: { handNear: ['partner.top', 0, 0.1] }, high: { handNear: 'partner.front' } },
      { t: 1.1, handNear: ['partner.shoulder', 0, -0.6], low: { handNear: 'partner.top' }, high: { handNear: 'partner.front' } },
      { t: 1.6, pose: 'stand', hands: 'relaxed' },
    ] },
  b: {
    keys: [
      { t: 0.5, head: 8, lean: 1 },
      { t: 0.8, head: 2 },
      { t: 1.1, head: 9 },
      { t: 1.6, pose: 'stand' },
    ] },
}; })(typeof self !== 'undefined' ? self : this);
