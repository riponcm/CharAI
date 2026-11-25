// actions/hug.js - a paired action (docs/PAIRS.md): A: hug(with=B). Walk up, open the arms, arms round
// each other's back, a squeeze, let go. The taller kneels when the other is a child.
(function (g) { (g.CharActions = g.CharActions || {}).hug = {
  pair: true, doc: 'walk up to someone, arms round each other, a squeeze, let go', gap: 0,
  a: {
    low: { pose: 'heels', lean: 20 },   // partner under 0.6 of my height (a child): sit back on the heels
    keys: [
      { t: 0.45, lean: 4, handNear: ['front', -0.15, 0.05], handFar: ['front', -0.15, 0.12], hands: 'open' },
      { t: 0.9, lean: 9, head: 6, handNear: 'partner.around', handFar: ['partner.around', 0, 0.1], hands: 'open' },
      { t: 1.25, lean: 14, head: 12, chest: 0.96, low: { lean: 18 }, handNear: 'partner.around', handFar: ['partner.around', 0, 0.1] },   // squeeze
      { t: 1.6, lean: 10, head: 9, chest: 1, handNear: 'partner.around', handFar: ['partner.around', 0, 0.1] },
      { t: 1.95, lean: 9, head: 6, handNear: 'partner.around', handFar: ['partner.around', 0, 0.1] },
      { t: 2.45, pose: 'stand', hands: 'relaxed' },
    ] },
  b: {
    low: { pose: 'heels', lean: 12 },
    keys: [
      { t: 0.55, lean: 3, handNear: ['front', -0.15, 0.05], handFar: ['front', -0.15, 0.12], hands: 'open' },
      { t: 1.0, lean: 8, head: 6, handNear: 'partner.around', handFar: ['partner.around', 0, 0.1], hands: 'open' },
      { t: 1.3, lean: 12, head: 10, chest: 0.96, low: { lean: 18 }, handNear: 'partner.around', handFar: ['partner.around', 0, 0.1] },
      { t: 1.65, lean: 9, head: 8, chest: 1, handNear: 'partner.around', handFar: ['partner.around', 0, 0.1] },
      { t: 1.95, lean: 8, head: 5, handNear: 'partner.around', handFar: ['partner.around', 0, 0.1] },
      { t: 2.4, pose: 'stand', hands: 'relaxed' },
    ] },
}; })(typeof self !== 'undefined' ? self : this);
