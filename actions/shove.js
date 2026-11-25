// actions/shove.js - a paired action (docs/PAIRS.md): A: shove(with=B). A playful two-handed shove to the
// chest; B staggers back. How far B goes grows with push (A's weight over B's): a child flies, a giant sways.
(function (g) {
  const s = a => Math.max(0.35, Math.min(2.2, +a.push || 1));   // the reaction scale
  (g.CharActions = g.CharActions || {}).shove = {
  pair: true, doc: 'shove the partner in the chest; they stagger back (further when lighter)', gap: 0.3,
  a: {
    low: { pose: 'heels', lean: 40, head: 6, footNear: null },   // a child: kneel, push the shoulders
    keys: [
      { t: 0.22, lean: -6, handNear: ['chest', 0.12, -0.05], handFar: ['chest', 0.1, 0.02], hands: 'open' },
      { t: 0.4, lean: 16, handNear: 'partner.chest', handFar: ['partner.chest', 0, 0.08], footNear: [0.35, 0, 0], low: { handNear: 'partner.shoulder', handFar: ['partner.shoulder', 0, 0.1] }, high: { handNear: 'partner.front', handFar: ['partner.front', 0, 0.1] } },
      { t: 0.55, lean: 20, handNear: 'partner.chest', handFar: ['partner.chest', 0, 0.08], low: { handNear: 'partner.shoulder', handFar: ['partner.shoulder', 0, 0.1] }, high: { handNear: 'partner.front', handFar: ['partner.front', 0, 0.1] } },
      { t: 0.75, lean: 8, armNear: [40, 30, 0], armFar: [45, 30, 0] },
      { t: 1.2, pose: 'stand', footNear: [0.12, 0, 0], hands: 'relaxed' },
    ] },
  b: {
    planted: 'none',
    keys: [
      { t: 0.4, lean: 0, x: 0 },
      { t: 0.55, lean: a => -10 - 6 * s(a), head: -10, x: a => -0.12 * s(a), armNear: [45, 30, 0], armFar: [55, 25, 0], hands: 'open', mouth: 'o' },
      { t: 0.72, lean: a => -8 - 5 * s(a), x: a => -0.3 * s(a), footFar: a => [-0.08 - 0.35 * s(a), 0.12, 0] },
      { t: 0.88, x: a => -0.42 * s(a), footFar: a => [-0.08 - 0.42 * s(a), 0, 0] },
      { t: 1.02, lean: a => -4 - 3 * s(a), x: a => -0.5 * s(a), footNear: a => [0.12 - 0.5 * s(a), 0.1, 0] },
      { t: 1.18, footNear: a => [0.12 - 0.55 * s(a), 0, 0], lean: 2, head: 0 },
      { t: 1.6, x: a => -0.55 * s(a), lean: 0, armNear: [0, 10, 0], armFar: [0, 10, 0], hands: 'relaxed', mouth: null },
    ] },
}; })(typeof self !== 'undefined' ? self : this);
