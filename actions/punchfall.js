// actions/punchfall.js - a paired action (docs/PAIRS.md): A: punchfall(with=B). A cartoon punch to the
// chest; B is knocked back off the feet and lands on the back, staying down. Lighter partners fly further.
(function (g) {
  const s = a => Math.max(0.35, Math.min(2.2, +a.push || 1));
  (g.CharActions = g.CharActions || {}).punchfall = {
  pair: true, doc: 'a cartoon punch to the chest; the partner falls on the back and stays down', gap: 0.65,
  a: {
    low: { pose: 'heels', lean: 40, head: 6, footNear: null },   // a child: kneel, a bop on the nose
    keys: [
      { t: 0.25, lean: -6, twist: -8, armNear: [25, 125, 0], hands: 'fist' },
      { t: 0.42, lean: 14, twist: 6, handNear: ['partner.chest', 0.05, 0], footNear: [0.3, 0, 0], low: { handNear: 'partner.face' }, high: { handNear: ['partner.front', -0.15, 0] } },
      { t: 0.5, lean: 15, handNear: ['partner.chest', 0.05, 0], low: { handNear: 'partner.face' }, high: { handNear: ['partner.front', -0.15, 0] } },
      { t: 0.8, lean: 4, twist: 0, armNear: [20, 100, 0] },
      { t: 1.3, pose: 'stand', footNear: [0.12, 0, 0], hands: 'relaxed' },
    ] },
  b: {
    planted: 'none', end: 'hold', anticipation: 0, face: 'surprised',
    keys: [
      { t: 0.48, lean: 0, x: 0 },
      { t: 0.6, lean: a => -18 - 6 * s(a), head: -14, x: a => -0.2 * s(a), armNear: [70, 20, 0], armFar: [80, 20, 0], hands: 'open', mouth: 'o', footNear: a => [0.12 - 0.1 * s(a), 0.1, -10] },
      { t: 0.8, lean: -50, x: a => -0.45 * s(a), crouch: 0.35, footNear: a => [0.3, 0.3, -30], footFar: a => [-0.2 * s(a), 0, 0] },
      { t: 1.0, pose: 'lie', x: a => -0.6 * s(a), squash: [1.06, 0.94] },
      { t: 1.2, pose: 'lie', x: a => -0.6 * s(a), squash: [1, 1], mouth: null, hold: true },
    ] },
}; })(typeof self !== 'undefined' ? self : this);
