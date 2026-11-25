// actions/bow.js - bow from the waist with the hands at the sides, hold, come back up.
(function (g) { (g.CharActions = g.CharActions || {}).bow = {
  channel: 'body', doc: 'bow from the waist (deep = 0.5 small nod of a bow .. 1.5 very deep)', args: { deep: 1 },
  keys: [
    { t: 0.4, lean: a => 38 * a.deep, bend: a => 14 * a.deep, head: 12, neck: 6, x: -0.04, armNear: [-4, 8, 0], armFar: [-6, 10, 0] },
    { t: 1.0, lean: a => 40 * a.deep, hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
