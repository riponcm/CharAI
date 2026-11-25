(function (g) { (g.CharActions = g.CharActions || {}).sigh = {
  channel: 'body', doc: 'shoulders rise, then drop, head sinks', face: 'sad', settle: 0.6,
  keys: [
    { t: 0.6, lean: -4, bend: -6, head: -4, rise: 0.15, chest: 1.04, armNear: [6, 10, 0], armFar: [6, 10, 0] },
    { t: 0.9, hold: true },
    { t: 1.5, lean: 12, bend: 16, head: 22, neck: 8, rise: 0, crouch: 0.06, chest: 0.97, armNear: [-4, 5, 0], armFar: [-4, 5, 0], hold: true },
    { t: 2.0, hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
