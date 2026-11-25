// actions/stepback.js - a quick small step or two backwards (dist = leg lengths, default 0.5; negative =
// forward), still facing the same way. The stage uses it to close or open a short gap before and after
// a paired action instead of a whole walk (docs/PAIRS.md).
(function (g) { (g.CharActions = g.CharActions || {}).stepback = {
  channel: 'body', doc: 'a quick step or two backwards (negative dist: forwards), facing the same way', args: { dist: 0.5 }, planted: 'none', anticipation: 0, settle: 0, end: 'hold',
  keys: [
    { t: 0.14, x: a => -0.35 * a.dist, footFar: a => [-0.08 - 0.6 * a.dist, 0.08, 0] },
    { t: 0.28, x: a => -0.6 * a.dist, footFar: a => [-0.08 - a.dist, 0, 0] },
    { t: 0.42, x: a => -0.85 * a.dist, footNear: a => [0.12 - 0.6 * a.dist, 0.08, 0] },
    { t: 0.56, x: a => -a.dist, footNear: a => [0.12 - a.dist, 0, 0] },
  ] }; })(typeof self !== 'undefined' ? self : this);
