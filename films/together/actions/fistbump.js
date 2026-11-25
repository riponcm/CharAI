(function (g) { (g.CharActions = g.CharActions || {}).fistbump = {
  pair: true, doc: 'two fists meet halfway, bump, pull back', gap: 0.6,
  a: { keys: [
    { t: 0.4, handNear: ['front', 0, 0], hands: { near: 'fist' } },
    { t: 0.7, handNear: 'partner.hand', hands: { near: 'fist' }, hold: true },
    { t: 1.0, handNear: 'partner.hand', hands: { near: 'fist' } },
    { t: 1.5, hands: 'relaxed' } ] },
  b: { keys: [
    { t: 0.4, handNear: ['front', 0, 0], hands: { near: 'fist' } },
    { t: 0.7, handNear: 'partner.hand', hands: { near: 'fist' }, hold: true },
    { t: 1.0, handNear: 'partner.hand', hands: { near: 'fist' } },
    { t: 1.5, hands: 'relaxed' } ] },
}; })(typeof self !== 'undefined' ? self : this);
