// actions/armscrossed.js - fold the arms across the chest: far forearm in front, near hand tucked under it.
(function (g) { (g.CharActions = g.CharActions || {}).armscrossed = {
  channel: 'arms', doc: 'cross the arms and hold', contact: true, hold: 2, release: 0.5,
  keys: [
    { t: 0.3, armNear: [30, 90, 0], armFar: [30, 90, 0], lean: -3 },
    { t: 0.7, handNear: ['chest', 0.28, -0.12], handFar: ['chest', 0.0, -0.02], hands: 'fist', lean: -3, head: -3, bob: -0.01 },
    { t: 0.9, hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
