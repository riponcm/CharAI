(function (g) { (g.CharActions = g.CharActions || {}).yawn = {
  channel: 'body', doc: 'big yawn with a two-arm stretch', keys: [
    { t: 0.35, lean: -4, head: 4, armNear: [30, 40, 0], armFar: [30, 40, 0] },
    { t: 0.9, lean: -10, bend: -10, head: -22, chest: 1.06, rise: 0.3, mouth: 'o', handNear: ['up', 0, 0], handFar: ['up', 0, 0], hold: true },
    { t: 1.8, hold: true },
    { t: 2.4, lean: 3, bend: 6, head: 8, chest: 0.97, rise: 0, mouth: null, armNear: [10, 20, 0], armFar: [10, 20, 0] },
  ] }; })(typeof self !== 'undefined' ? self : this);
