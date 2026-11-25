(function (g) { (g.CharActions = g.CharActions || {}).bowto = {
  pair: true, doc: 'both bow to each other, hand on chest, rise grinning', gap: 1.6,
  a: { face: 'happy', keys: [
    { t: 0.5, lean: 8, handNear: ['chest', 0.1, 0] },
    { t: 1.0, lean: 38, head: 18, handNear: ['chest', 0.1, 0], handFar: ['back', -0.1, 0], hold: true },
    { t: 1.5, lean: 38, head: 18, handNear: ['chest', 0.1, 0], handFar: ['back', -0.1, 0] },
    { t: 2.1, pose: 'stand', hands: 'relaxed' } ] },
  b: { face: 'happy', keys: [
    { t: 0.5, lean: 8, handNear: ['chest', 0.1, 0] },
    { t: 1.0, lean: 38, head: 18, handNear: ['chest', 0.1, 0], handFar: ['back', -0.1, 0], hold: true },
    { t: 1.5, lean: 38, head: 18, handNear: ['chest', 0.1, 0], handFar: ['back', -0.1, 0] },
    { t: 2.1, pose: 'stand', hands: 'relaxed' } ] },
}; })(typeof self !== 'undefined' ? self : this);
