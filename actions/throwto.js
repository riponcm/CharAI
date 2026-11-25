// actions/throwto.js - a paired action with a prop (docs/PAIRS.md, docs/PROPS.md):
// A: throwto(with=B, prop=ball). A throws underarm at the key marked release; the prop flies on an arc;
// B reaches with both hands and catches it at the key marked catch.
(function (g) { (g.CharActions = g.CharActions || {}).throwto = {
  pair: true, doc: 'throw a held prop to the partner, who catches it', gap: 4, args: { prop: '' },
  a: {
    keys: [
      { t: 0.35, lean: -8, crouch: 0.15, armNear: [-40, 20, 0], hands: 'grip' },
      { t: 0.6, lean: 10, crouch: 0.05, armNear: [100, 10, 0], hands: 'open', release: true },
      { t: 0.8, lean: 6, armNear: [120, 15, 0] },
      { t: 1.4, pose: 'stand', hands: 'relaxed' },
    ] },
  b: {
    keys: [
      { t: 0.5, lean: -2, handNear: ['front', -0.1, 0.25], handFar: ['front', -0.1, 0.3], hands: 'open' },
      { t: 1.15, lean: -4, handNear: ['front', -0.15, 0.2], handFar: ['front', -0.15, 0.25], hands: 'grip', catch: true },
      { t: 1.3, lean: -8, crouch: 0.1, handNear: ['chest', 0.3, -0.05], handFar: ['chest', 0.28, -0.02] },
      { t: 1.8, pose: 'stand' },
    ] },
}; })(typeof self !== 'undefined' ? self : this);
