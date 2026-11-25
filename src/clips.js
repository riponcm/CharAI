// clips.js - CharClips: motion as data. Each clip is a set of pose keys on a time line that the
// performer (perform.js) plays with spline interpolation. UMD: window.CharClips / module.exports.
//
// ===================== FORMAT (read this to add or tune a clip) =====================
// name: {
//   dur,            seconds (the time of the last key if left out)
//   keys: [ { t, ...fields }, ... ]   a field only has to appear on the keys where it changes;
//                   each field is its own spline (Catmull-Rom through the keys that set it).
//                   A field no key sets stays at the standing pose. flat: true on a key makes every
//                   field set there arrive and leave with zero speed (an extreme or a hit pose).
//   lag: { head, armN, armF, lean, ... }   per-field delay in seconds: the field plays that much
//                   later than the body (overlap: head and arms trail the hips)
//   contacts: { near: [[t0, t1], ...], far: [...] }   foot-contact marks: inside a mark the foot is
//                   planted (lift 0, no slide; it rolls on heel or toe when its angle changes). A
//                   mark that starts at 0 plants the foot where it already was.
//   loop: [a, b]    the part that repeats (times=n in the script); [0, dur] = loops forever (idle)
//   flight: [f0, f1], height, flightPerL   airborne part of a jump: the root flies a parabola of
//                   `height` leg lengths (times the script's height) and the flight time grows by
//                   flightPerL per leg length jumped; root x in flight is stretched to the target.
//   flip            time at which the actor faces the other way (turn)
//   blendIn         seconds of cross-fade from whatever the actor was doing (default 0.15)
//   life            0..1 idle wobble left on top while/after the clip plays (default 0)
// }
// Body fields (as in poses.js keys): x = root motion (pelvis forward, leg lengths); h = pelvis
// height above the ankles (0.975 standing); lean, tilt, twist, neck, head (degrees); bend = spine
// curve (degrees, + = chest curls forward); chest = torso stretch (1 = rest, 1.1 = tall and thin,
// 0.88 = short and wide; area is kept); near, far = feet [x from the PELVIS, lift, angle (+ toes up)];
// armN, armF = [shoulder, elbow, wrist]; squash [sx, sy]; stretch (limbs, <= 1.12); hands
// ['main', 'other'] or one name; mouth (a swap name, null = back to the mood).
// Arm clips (channel 'arms') use armN/armF/hands plus lean, head, twist, neck, h added to the body.
// =====================================================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CharClips = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const ST = { h: 0.975, lean: -2, tilt: 3, twist: 5, neck: -2, head: 3, bend: 0, chest: 1, armN: [7, 16, 10], armF: [-9, 24, 4] };
  const stand = (t, extra) => Object.assign({ t }, ST, extra || {});

  return {
    // standing with life: weight drifts from foot to foot, a glance up, breathing in the chest
    idle: { dur: 4.8, loop: [0, 4.8], blendIn: 0.45, life: 0.25,
      lag: { head: 0.25, neck: 0.2, armN: 0.3, armF: 0.4 },
      contacts: { near: [[0, 4.8]], far: [[0, 4.8]] },
      keys: [
        stand(0, { x: 0, near: [0.12, 0, 0], far: [-0.08, 0, 0] }),
        { t: 1.2, x: 0.035, h: 0.966, lean: -1, tilt: 6, twist: 3, head: 6, neck: 0, bend: 2, chest: 1.01, armN: [4, 20, 12], armF: [-6, 22, 4] },
        { t: 2.4, x: 0.045, h: 0.972, head: -3, neck: -5, chest: 1.025, armN: [10, 14, 8] },
        { t: 3.6, x: 0.0, h: 0.962, lean: -3, tilt: 0, twist: 7, head: 4, neck: -1, bend: -2, chest: 0.99, armF: [-13, 28, 4] },
        stand(4.8, { x: 0 }),
      ] },

    // on the toes: rise, then bob (heels up, knees giving), arms float with lag; times = bobs
    bounce: { dur: 1.3, loop: [0.36, 0.76], blendIn: 0.12,
      lag: { head: 0.06, neck: 0.05, armN: 0.08, armF: 0.11 },
      contacts: { near: [[0, 1.3]], far: [[0, 1.3]] },
      keys: [
        stand(0, { x: 0, near: [0.12, 0, 0], far: [-0.08, 0, 0] }),
        { t: 0.18, flat: true, h: 0.9, lean: 9, bend: 7, chest: 0.93, head: 2, armN: [-22, 30, 0], armF: [-30, 34, 0], near: [0.12, 0, 0], far: [-0.08, 0, 0] },
        { t: 0.36, h: 1.0, lean: -3, bend: -3, chest: 1.07, head: -4, armN: [34, 40, 0], armF: [22, 46, 0], hands: 'open', near: [0.12, 0, -30], far: [-0.08, 0, -30] },
        { t: 0.5, h: 1.01, chest: 1.05, armN: [44, 52, 0], armF: [34, 56, 0], near: [0.12, 0, -36], far: [-0.08, 0, -36] },
        { t: 0.62, flat: true, h: 0.925, lean: 6, bend: 5, chest: 0.93, head: 3, armN: [8, 38, 0], armF: [-4, 44, 0], near: [0.12, 0, -20], far: [-0.08, 0, -20] },
        { t: 0.76, h: 1.0, lean: -3, bend: -3, chest: 1.07, head: -4, armN: [34, 40, 0], armF: [22, 46, 0], near: [0.12, 0, -30], far: [-0.08, 0, -30] },
        { t: 0.98, flat: true, h: 0.94, lean: 4, bend: 3, chest: 0.96, head: 2, armN: [12, 22, 8], armF: [-4, 26, 4], near: [0.12, 0, 0], far: [-0.08, 0, 0], hands: 'relaxed' },
        stand(1.3, { near: [0.12, 0, 0], far: [-0.08, 0, 0] }),
      ] },

    // the first beat of a run: sink and lean in, arms cock back, push. The gait cross-fades in after.
    runStart: { dur: 0.24, blendIn: 0.08,
      lag: { head: 0.05, armN: 0.04, armF: 0.05 },
      contacts: { near: [[0, 0.24]], far: [[0, 0.24]] },
      keys: [
        stand(0, { x: 0 }),
        { t: 0.12, x: -0.025, h: 0.9, lean: 5, bend: 7, chest: 0.94, head: -4, armN: [-34, 44, 0], armF: [26, 52, 0], hands: 'fist', mouth: 'grit' },
        { t: 0.24, x: 0.05, h: 0.93, lean: 17, bend: 4, chest: 1.02, head: -8, armN: [-46, 72, 0], armF: [44, 72, 0] },
      ] },

    // crouch (anticipation), stretch on the push, tuck in the air, squash on landing, rebound, settle
    jump: { dur: 1.52, flight: [0.4, 0.84], height: 0.52, flightPerL: 0.05, blendIn: 0.1,
      lag: { head: 0.04, neck: 0.03, armN: 0.05, armF: 0.075 },
      contacts: { near: [[0, 0.4], [0.84, 1.52]], far: [[0, 0.4], [0.84, 1.52]] },
      keys: [
        stand(0, { x: 0, near: [0.12, 0, 0], far: [-0.08, 0, 0] }),
        { t: 0.12, h: 0.93, lean: 7, bend: 3, armN: [22, 30, 0], armF: [12, 34, 0] },
        { t: 0.3, flat: true, x: -0.03, h: 0.68, lean: 32, bend: 14, chest: 0.87, neck: -10, head: -14, armN: [-62, 30, 0], armF: [-52, 36, 0], hands: 'open', near: [0.2, 0, 0], far: [0.0, 0, 0], mouth: 'grit', squash: [1.03, 0.97] },
        { t: 0.4, x: 0.08, h: 1.03, lean: 12, bend: -6, chest: 1.13, neck: -4, head: -6, armN: [126, 14, 10], armF: [106, 24, 10], near: [-0.08, 0, -42], far: [-0.2, 0, -42], mouth: 'open', stretch: 1.08, squash: [0.96, 1.05] },
        { t: 0.52, h: 0.98, lean: 6, chest: 1.06, armN: [122, 28, 10], armF: [102, 38, 10], near: [0.0, 0.14, -20], far: [-0.15, 0.12, -24], stretch: 1, squash: [1, 1] },
        { t: 0.64, flat: true, h: 0.86, lean: 8, bend: 10, chest: 0.97, armN: [100, 52, 10], armF: [82, 62, 10], near: [0.2, 0.42, -10], far: [0.05, 0.36, -16] },
        { t: 0.84, x: 1.0, h: 0.95, lean: 10, bend: 4, chest: 1.04, head: -6, armN: [82, 30, 0], armF: [62, 34, 0], near: [0.2, 0, 8], far: [0.02, 0, 4] },
        { t: 0.96, flat: true, x: 1.04, h: 0.62, lean: 30, bend: 16, chest: 0.84, neck: -10, head: -14, armN: [56, 45, 0], armF: [40, 50, 0], near: [0.2, 0, 0], far: [0.02, 0, 0], mouth: 'grit', squash: [1.06, 0.94] },
        { t: 1.2, x: 1.1, h: 0.99, lean: -4, bend: -4, chest: 1.05, neck: 0, head: 2, armN: [20, 26, 6], armF: [0, 30, 4], mouth: null, squash: [1, 1], hands: 'relaxed' },
        stand(1.52, { x: 1.09 }),
      ] },

    // stop from a run: brace (heel digs in, lean back), slide, stop, overshoot forward, step, settle
    skid: { dur: 1.35, blendIn: 0.14, fling: 1,
      lag: { head: 0.06, neck: 0.05, armN: 0.07, armF: 0.1 },
      contacts: { near: [[0.55, 1.35]], far: [[0.55, 0.86], [1.06, 1.35]] },
      keys: [
        { t: 0, x: 0, h: 0.9, lean: 14, bend: 4, near: [0.25, 0.05, 0], far: [-0.3, 0.1, 0], armN: [40, 80, 0], armF: [-40, 80, 0], hands: 'fist' },
        { t: 0.1, x: 0.38, h: 0.82, lean: -18, bend: -10, chest: 0.92, head: 6, near: [0.5, 0, 24], far: [-0.15, 0, -10], armN: [70, 40, 0], armF: [50, 50, 0], hands: 'open', mouth: 'o' },
        { t: 0.35, x: 0.95, h: 0.78, lean: -24, bend: -12, chest: 0.9, head: 8, near: [0.5, 0, 26], far: [-0.12, 0, -8], armN: [96, 30, 0], armF: [80, 36, 0] },
        { t: 0.55, flat: true, x: 1.12, h: 0.84, lean: -8, bend: -4, near: [0.42, 0, 0], far: [-0.1, 0, 0], armN: [62, 30, 0], armF: [50, 34, 0] },
        { t: 0.76, x: 1.24, h: 0.9, lean: 19, bend: 13, chest: 1.04, neck: -6, head: -10, armN: [74, 62, 0], armF: [58, 68, 0], mouth: 'open' },
        { t: 0.96, x: 1.29, far: [-0.18, 0.12, 0] },
        { t: 1.06, flat: true, x: 1.3, h: 0.96, lean: -5, bend: -4, chest: 0.99, neck: 0, head: 2, far: [-0.1, 0, 0], armN: [10, 24, 8], armF: [-6, 28, 4], hands: 'relaxed', mouth: null },
        stand(1.35, { x: 1.3 }),
      ] },

    // turn round with a little hop: dip, spring up with the feet drawn in under her (she faces the
    // other way at the top, never thinner than 85%), land on both feet re-planted, squash, settle
    // The far foot stays planted and she pivots on it (flipAbout); the near foot hops round.
    turn: { dur: 0.48, flip: 0.17, flipAbout: 'far', blendIn: 0.05,
      lag: { head: 0.03, armN: 0.04, armF: 0.06 },
      contacts: { near: [[0, 0.07], [0.27, 0.48]], far: [[0, 0.48]] },
      keys: [
        stand(0, { x: 0, squash: [1, 1], near: [0.12, 0, 0], far: [-0.08, 0, 0] }),
        { t: 0.07, flat: true, x: -0.025, h: 0.9, lean: 8, bend: 6, chest: 0.93, armN: [-10, 40, 0], armF: [-16, 44, 0], squash: [1.04, 0.96], near: [0.14, 0, 0], far: [-0.055, 0, 0] },
        { t: 0.17, x: -0.07, h: 0.96, lean: 0, bend: 0, chest: 1.05, armN: [24, 70, 0], armF: [18, 74, 0], squash: [0.86, 1.05], near: [-0.01, 0.1, -12], far: [-0.01, 0, 0] },
        { t: 0.27, x: -0.03, h: 0.93, lean: 3, chest: 0.95, near: [0.19, 0, 0], far: [-0.05, 0, 0], squash: [1.05, 0.95] },
        { t: 0.34, flat: true, h: 0.91, lean: 6, bend: 5, chest: 0.92, armN: [-6, 34, 6], armF: [-14, 36, 4], squash: [1.06, 0.94] },
        stand(0.48, { squash: [1, 1] }),
      ] },

    // one stride of the run (phase 0 = near foot lands, 0.5 = far foot lands), laid over the gait,
    // which plants the feet. h, lean, head, neck are ADDED to the gait; bend, chest and the arms
    // replace it (arm swing grows with speed). contact, down, passing, up, (flight), contact.
    runCycle: { dur: 1, loop: [0, 1],
      keys: [
        { t: 0, h: 0, lean: 0, head: 2, neck: 0, bend: 3, chest: 1.0, armN: [-52, 96, 0], armF: [58, 88, -10] },
        { t: 0.1, h: -0.05, lean: 3, head: 6, neck: 2, bend: 8, chest: 0.93, armN: [-40, 100, 0], armF: [46, 92, -8] },
        { t: 0.25, h: 0, lean: 1, head: 2, neck: 0, bend: 4, chest: 1.0, armN: [4, 82, 0], armF: [4, 84, 0] },
        { t: 0.38, h: 0.04, lean: -1, head: -2, neck: -1, bend: 1, chest: 1.05, armN: [44, 86, -8], armF: [-40, 96, 0] },
        { t: 0.5, h: 0, lean: 0, head: 2, neck: 0, bend: 3, chest: 1.0, armN: [58, 88, -10], armF: [-52, 96, 0] },
        { t: 0.6, h: -0.05, lean: 3, head: 6, neck: 2, bend: 8, chest: 0.93, armN: [46, 92, -8], armF: [-40, 100, 0] },
        { t: 0.75, h: 0, lean: 1, head: 2, neck: 0, bend: 4, chest: 1.0, armN: [4, 84, 0], armF: [4, 82, 0] },
        { t: 0.88, h: 0.04, lean: -1, head: -2, neck: -1, bend: 1, chest: 1.05, armN: [-40, 96, 0], armF: [44, 86, -8] },
        { t: 1, h: 0, lean: 0, head: 2, neck: 0, bend: 3, chest: 1.0, armN: [-52, 96, 0], armF: [58, 88, -10] },
      ] },

    // ------------------------------------------------------------------ arm clips
    // one hand: dip, swing up past the pose, waggle at the elbow and wrist, the body leans away
    wave: { dur: 1.34, blendIn: 0.1, lag: { armF: 0.08, head: 0.1, lean: 0.06 },
      keys: [
        { t: 0, armN: [7, 16, 10], armF: [-9, 24, 4], lean: 0, head: 0, twist: 0 },
        { t: 0.1, armN: [-12, 40, 0] },
        { t: 0.32, armN: [120, 48, -12], armF: [-12, 28, 0], hands: ['open', 'relaxed'], lean: -4, head: -6, twist: 6 },
        { t: 0.42, flat: true, armN: [104, 62, -6] },
        { t: 0.6, armN: [107, 38, -22] }, { t: 0.78, armN: [101, 76, 12] },
        { t: 0.96, armN: [107, 38, -22] }, { t: 1.14, armN: [101, 76, 12] },
        { t: 1.34, armN: [104, 60, 0] },
      ] },
    // both hands, laughing: dip, fling both arms up, wave them across each other out of step, bob
    waveBoth: { dur: 1.5, blendIn: 0.1, lag: { armF: 0.07, head: 0.08 },
      keys: [
        { t: 0, armN: [7, 16, 10], armF: [-9, 24, 4], h: 0, lean: 0, head: 0 },
        { t: 0.1, armN: [-16, 40, 0], armF: [-22, 40, 0], h: -0.03, lean: 4, head: 3 },
        { t: 0.34, armN: [152, 28, -10], armF: [142, 34, -10], hands: ['open', 'open'], h: 0.025, lean: -9, head: -12 },
        { t: 0.46, flat: true, armN: [138, 40, 0], armF: [130, 44, 0], h: 0 },
        { t: 0.64, armN: [152, 18, -26], armF: [118, 52, 16], h: -0.02, lean: -6, head: -8 },
        { t: 0.82, armN: [124, 52, 16], armF: [148, 22, -26], h: 0.02, lean: -9, head: -12 },
        { t: 1.0, armN: [152, 18, -26], armF: [118, 52, 16], h: -0.02, lean: -6, head: -8 },
        { t: 1.18, armN: [124, 52, 16], armF: [148, 22, -26], h: 0.02, lean: -9, head: -12 },
        { t: 1.5, armN: [136, 40, 0], armF: [128, 44, 0], h: 0, lean: -5, head: -6 },
      ] },
  };
});
