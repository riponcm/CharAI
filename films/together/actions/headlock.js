(function (g) { (g.CharActions = g.CharActions || {}).headlock = {
  pair: true, doc: 'playful headlock: arm round the partner\'s neck, a rub of the head, let go', gap: 0.2,
  a: { keys: [
    { t: 0.4, lean: 8, handNear: ['partner.around', 0, 0.2], handFar: ['front', 0, 0] },
    { t: 0.8, lean: 14, handNear: ['partner.around', 0, 0.2], handFar: 'partner.top', hands: 'fist' },
    { t: 1.1, handFar: ['partner.top', 0.1, 0] },
    { t: 1.4, handFar: ['partner.top', -0.1, 0] },
    { t: 1.7, lean: 14, handFar: ['partner.top', 0.1, 0] , hold: true},
    { t: 2.2, pose: 'stand', hands: 'relaxed' } ] },
  b: { keys: [
    { t: 0.5, lean: 10 },
    { t: 0.8, lean: 28, head: 10 },
    { t: 1.7, lean: 28, head: 10 },
    { t: 2.2, pose: 'stand', hands: 'relaxed' } ] },
}; })(typeof self !== 'undefined' ? self : this);
