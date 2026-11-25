// actions/handsonhips.js - fists on the hips, chest out, chin up, a little twist to show the elbows.
(function (g) { (g.CharActions = g.CharActions || {}).handsonhips = {
  channel: 'arms', doc: 'plant both hands on the hips and hold', contact: true, hold: 2, release: 0.5, face: 'proud',
  keys: [
    { t: 0.25, armNear: [15, 50, 0], armFar: [15, 50, 0], lean: -3, bob: 0.02 },
    { t: 0.6, handNear: 'hip', handFar: 'hip', hands: 'fist', lean: -5, head: -4, twist: 12, bob: 0.015 },
    { t: 0.8, hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
