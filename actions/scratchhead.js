// actions/scratchhead.js - puzzled: scratch the top of the head, head tipped, a frown.
(function (g) { (g.CharActions = g.CharActions || {}).scratchhead = {
  channel: 'arms', doc: 'scratch the top of the head, puzzled', contact: true, face: 'scared', release: 0.4,
  keys: [
    { t: 0.35, handNear: ['top', -0.15, -0.08], hands: { near: 'open' }, head: 10, lean: 3 },
    { t: 0.5, handNear: ['top', -0.02, -0.06] },
    { t: 0.65, handNear: ['top', -0.15, -0.08] },
    { t: 0.8, handNear: ['top', -0.02, -0.06] },
    { t: 1.0, handNear: ['top', -0.1, -0.08], hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
