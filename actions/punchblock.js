// actions/punchblock.js - a paired action (docs/PAIRS.md): A: punchblock(with=B). A play punch at the
// face; B's forearm meets the fist and B rocks back (more when lighter).
(function (g) {
  const s = a => Math.max(0.35, Math.min(2.2, +a.push || 1));
  (g.CharActions = g.CharActions || {}).punchblock = {
  pair: true, doc: 'a play punch at the face, blocked by the partner\'s forearm', gap: 0.7,
  a: {
    low: { pose: 'heels', lean: 40, head: 6, footNear: null },   // a child: get down to its height
    keys: [
      { t: 0.25, lean: -6, twist: -8, armNear: [25, 125, 0], armFar: [30, 110, 0], hands: 'fist' },
      { t: 0.42, lean: 12, twist: 6, handNear: ['partner.face', -0.3, 0], footNear: [0.3, 0, 0], high: { handNear: ['partner.front', -0.15, 0] } },
      { t: 0.55, lean: 9, handNear: ['partner.face', -0.35, -0.02], high: { handNear: ['partner.front', -0.15, 0] } },
      { t: 0.8, lean: 2, twist: 0, armNear: [25, 110, 0] },
      { t: 1.2, pose: 'stand', footNear: [0.12, 0, 0], hands: 'relaxed' },
    ] },
  b: {
    planted: 'none',
    keys: [
      { t: 0.28, lean: -3, handNear: ['face', 0.3, -0.1], hands: 'fist' },
      { t: 0.42, lean: -5, head: -6, x: 0, handNear: 'partner.hand' },
      { t: 0.55, lean: a => -5 - 5 * s(a), head: -8, x: a => -0.08 * s(a), handNear: 'partner.hand' },
      { t: 0.8, lean: -2, x: a => -0.1 * s(a), handNear: ['face', 0.35, -0.15] },
      { t: 1.2, pose: 'stand', x: a => -0.1 * s(a), hands: 'relaxed' },
    ] },
}; })(typeof self !== 'undefined' ? self : this);
