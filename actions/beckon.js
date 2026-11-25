// actions/beckon.js - come here: arm out, palm up, fingers curl in hard and flick open, with a head tilt.
(function (g) { (g.CharActions = g.CharActions || {}).beckon = {
  channel: 'arms', doc: 'come here: repeated curl of the hand (times = curls)', args: { times: 3, for: 0 }, loop: [0.5, 0.8], hold: 0.2, release: 0.4, face: 'happy',
  keys: [
    { t: 0.3, armNear: [80, 40, 40], hands: 'open', head: -5, lean: -2, turn: 0.2 },
    { t: 0.5, armNear: [85, 20, 55], hands: 'open', lean: -3 },
    { t: 0.65, armNear: [70, 75, -45], hands: 'grip', lean: 4, head: 3 },
    { t: 0.8, armNear: [85, 20, 55], hands: 'open', lean: -3, head: -5 },
  ] }; })(typeof self !== 'undefined' ? self : this);
