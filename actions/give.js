// actions/give.js - a paired action with a prop (docs/PAIRS.md, docs/PROPS.md): A: give(with=B, prop=loaf).
// A holds the prop out, B's hand meets it, it changes hands at the keys marked give / take.
(function (g) { (g.CharActions = g.CharActions || {}).give = {
  pair: true, doc: 'hand a held prop to the partner', gap: 0.5, args: { prop: '' },
  a: {
    low: { pose: 'heels', lean: 22 },
    keys: [
      { t: 0.4, lean: 5, handNear: 'partner.hand', hands: 'grip' },
      { t: 0.7, lean: 6, handNear: 'partner.hand', give: true },
      { t: 0.85, lean: 4, handNear: 'partner.hand', hands: 'open' },
      { t: 1.3, pose: 'stand', hands: 'relaxed' },
    ] },
  b: {
    low: { pose: 'heels', lean: 22 },
    keys: [
      { t: 0.45, lean: 4, handNear: 'partner.hand', hands: 'open' },
      { t: 0.7, lean: 5, handNear: 'partner.hand', hands: 'grip', take: true },
      { t: 0.9, lean: 2, handNear: 'partner.hand' },
      { t: 1.3, pose: 'stand' },
    ] },
}; })(typeof self !== 'undefined' ? self : this);
