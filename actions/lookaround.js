// actions/lookaround.js - look up and about, chest turning a little with the head.
(function (g) { (g.CharActions = g.CharActions || {}).lookaround = {
  channel: 'body', doc: 'look around, up and about', anticipation: 0.5,
  keys: [
    { t: 0.4, twist: 14, neck: -10, head: -14, lean: -3, hold: true },
    { t: 1.0, twist: -12, neck: 4, head: 8, lean: 3, hold: true },
    { t: 1.5, twist: 6, neck: -6, head: -10 },
  ] }; })(typeof self !== 'undefined' ? self : this);
