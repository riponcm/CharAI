// actions/standup.js - stand up from sitting on the ground: lean forward, push off, rise.
(function (g) { (g.CharActions = g.CharActions || {}).standup = {
  channel: 'body', doc: 'stand up from sitting on the ground (after sit)', planted: 'none', anticipation: 0,
  keys: [
    { t: 0.25, pose: 'sit', hold: true },
    { t: 0.7, pose: 'squat', lean: 34, handNear: 'ground', hands: 'open' },
    { t: 1.3, stand: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
