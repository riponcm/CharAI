// actions/handshake.js - a paired action (docs/PAIRS.md): A: handshake(with=B). Step up, hands meet
// halfway, three pumps, let go. A grown-up bends down to a child.
(function (g) { (g.CharActions = g.CharActions || {}).handshake = {
  pair: true, doc: 'step up and shake hands: three pumps, let go', gap: 0.55,
  a: {
    low: { pose: 'heels', lean: 22, head: 10 },   // the partner is a child: bend down to the hand
    keys: [
      { t: 0.35, lean: 4, handNear: 'partner.hand', hands: 'open' },
      { t: 0.6, lean: 5, head: 4, handNear: 'partner.hand', hands: 'grip' },
      { t: 0.78, handNear: ['partner.hand', 0, 0.06] },
      { t: 0.96, handNear: ['partner.hand', 0, -0.05] },
      { t: 1.14, handNear: ['partner.hand', 0, 0.05] },
      { t: 1.32, handNear: ['partner.hand', 0, -0.03] },
      { t: 1.5, handNear: 'partner.hand', hands: 'open' },
      { t: 1.95, pose: 'stand', hands: 'relaxed' },
    ] },
  b: {
    low: { pose: 'heels', lean: 22, head: 10 },
    keys: [
      { t: 0.4, lean: 3, handNear: 'partner.hand', hands: 'open' },
      { t: 0.6, lean: 4, head: 4, handNear: 'partner.hand', hands: 'grip' },
      { t: 0.78, handNear: ['partner.hand', 0, 0.06] },
      { t: 0.96, handNear: ['partner.hand', 0, -0.05] },
      { t: 1.14, handNear: ['partner.hand', 0, 0.05] },
      { t: 1.32, handNear: ['partner.hand', 0, -0.03] },
      { t: 1.5, handNear: 'partner.hand', hands: 'open' },
      { t: 1.95, pose: 'stand', hands: 'relaxed' },
    ] },
}; })(typeof self !== 'undefined' ? self : this);
