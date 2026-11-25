// poses.js - the action vocabulary of CharPerform, stored as data (STAGE.md section 2).
// UMD: window.CharPoses in the browser, module.exports in Node.
//
// ===================== RECIPE: adding an action (for example "pet" or "pull") =====================
// 0. Motion clips: an entry with clip: '<name>' (or a function of the args, see wave) is played from
//    clips.js (pose keys on a time line, splines, per-field lag, foot contacts, root motion); its
//    keys below, if any, are only a fallback. To tune idle, bounce, jump, skid, turn, the run start
//    or wave, edit clips.js (its top comment lists the format). New clips need no code.
// 1. Pick a channel. 'body' = legs, hips and spine (one at a time, holds until the next body
//    action); 'arms' = a gesture laid over whatever the body does; 'face' and 'look' are built in.
// 2. Copy the closest existing entry below and rename it. An entry is:
//      name: { channel, args: { argName: default, ... }, doc: 'one line for authors',
//              keys: [ key, key, ... ],        // played in order, each from the previous one
//              hold, release, mood }           // arms only: how long to hold, how long to let go
//    An argument default of null means "required". The first argument is the positional one.
// 3. A key is { dur, ease, ...pose fields }. Fields you leave out keep their previous value.
//    dur  : seconds to reach this key.   ease : 'inOut' | 'out' | 'in' | 'back' (overshoots
//           about 12% then settles; use it for fast moves) | 'linear'.
//    Body fields (positions in leg lengths L, angles in degrees):
//      x     pelvis forward/back from where the action started (+ = the way she faces)
//      h     pelvis height above the ankles: 0.975 standing, 0.58 deep crouch
//      lean  spine (+ forward)   tilt  hips   twist  chest   neck, head (+ = chin down)
//      near, far   feet: [x, lift, angle]  (angle + = toes up), or 'keep' (stay planted),
//                  or { knee: x, shin: deg } to put that knee on the ground
//      squash [sx, sy]   stretch (max limb stretch, <= 1.12)   mouth (swap while this key runs)
//    Arm fields (degrees; 0 = hanging along the body, + = swinging forward and up):
//      armN, armF  [shoulder, elbow, wrist] for the gesture's main arm and the other arm
//      hands       'open' or [main, other]: relaxed | fist | open | point | grip
//      aim         { off, elbow, lean } aims the main arm at args.at (off = degrees above it)
//      wiggle      [{ arm: 'N'|'F', j: 0|1|2, amp, hz, ph }]  oscillation during this key
//      lean, head, twist, h on an arms key are ADDED to the body (a gesture can bend the body).
//    Any field may be a function (args, body) => value, where body = { L, A, k, ... } for the
//    current skin; see `sit` for an example.
// 4. Reload poses.html: your action gets a row of 6 frames automatically. Check the joints and
//    that feet stay on the ground, then run `node --test tests/perform.test.cjs`.
//
// Example, a "pet" gesture (stroke something low in front):
//   pet: { channel: 'arms', args: { at: null }, doc: 'stroke an animal at a place', hold: 1.6,
//          release: 0.4, keys: [
//            { dur: 0.35, ease: 'inOut', aim: { off: 0, elbow: 25, lean: 0.6 }, hands: 'open' },
//            { dur: 1.6, wiggle: [{ arm: 'N', j: 1, amp: 10, hz: 1.2 }] } ] },
// =================================================================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CharPoses = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // The resting pose: weight on the back leg, hips and chest turned a touch, arms asymmetric.
  const STAND = { x: 0, h: 0.975, lean: -2, tilt: 3, twist: 5, neck: -2, head: 3,
    near: [0.12, 0, 0], far: [-0.08, 0, 0], armN: [7, 16, 10], armF: [-9, 24, 4], hands: ['relaxed', 'relaxed'] };

  const actions = {
    // ------------------------------------------------------------------ moves (code in perform.js)
    walk: { channel: 'body', moves: true, args: { to: null, speed: 1, steps: 0 }, doc: 'walk to x or an anchor; speed 0.5..2; steps = exact number of steps (0 = automatic)',
      gait: 'walk', params: { cadence: 1.02 }, blendIn: 0.3, accel: 0.32, settle: 0.36, startLean: -3, stopLean: 5 },
    run: { channel: 'body', moves: true, args: { to: null, speed: 1, steps: 0, end: 'stop' }, doc: 'run to x or an anchor; steps = exact number of steps (0 = automatic); end = stop | skid (arrive at full speed and skid to a stop at the target)',
      gait: 'run', start: 'runStart', cycle: 'runCycle', params: { stride: 3.0, cadence: 1.43, duty: 0.26 }, blendIn: 0.26, accel: 0.42, settle: 0.5, startLean: -7, stopLean: 12, startDip: 0.05 },
    sneak: { channel: 'body', moves: true, args: { to: null, speed: 1 }, doc: 'tiptoe, crouched, to x or an anchor',
      gait: 'sneak', blendIn: 0.45, accel: 0.45, settle: 0.5, startLean: 4, stopLean: 3 },
    enter: { channel: 'body', moves: true, args: { from: 'left', speed: 1 }, doc: 'walk in from off screen (left|right) to her place',
      gait: 'walk', params: { cadence: 1.02 }, blendIn: 0.0, accel: 0.25, settle: 0.42, startLean: 0, stopLean: 5 },
    turn: { channel: 'body', args: {}, doc: 'turn round to face the other way', dur: 0.34, clip: 'turn' },
    // ---- clip actions (data in clips.js) ----
    bounce: { channel: 'body', args: { times: 3 }, doc: 'bounce on the toes, times = number of bobs', clip: 'bounce' },
    skid: { channel: 'body', args: {}, doc: 'skid to a stop (best straight after a run: run(to=x, end=skid) does it at the target)', clip: 'skid' },
    jump: { channel: 'body', moves: true, args: { to: null, height: 1, pose: 'tuck' }, doc: 'jump to x or an anchor; height 1 = normal, 2 = big; pose = tuck | leap (legs split front and back, arms flung)', clip: 'jump',
      // the keys below are the keyed version, used for pose=leap and on a beat grid
      // anticipation crouch, push off, (flight), contact, squash, recover
      crouch: { dur: 0.28, ease: 'inOut', h: 0.7, lean: 30, neck: -10, head: -12, armN: [-55, 35, 0], armF: [-45, 40, 0], hands: ['open', 'open'], squash: [1.04, 0.96], mouth: 'grit' },
      push: { dur: 0.1, ease: 'out', h: 1.02, lean: 14, neck: -4, head: -6, armN: [118, 16, 10], armF: [100, 28, 10], squash: [0.95, 1.06], stretch: 1.07, toe: -40, mouth: 'open' },
      tuck: { lean: 6, armN: [104, 44, 10], armF: [88, 56, 10], feet: [[0.12, -0.52], [-0.12, -0.42]] },
      leap: { lean: 4, armN: [128, 12, 10], armF: [-72, 18, 0], feet: [[0.56, -0.7], [-0.58, -0.62]] },   // added for the early jump film
      contact: { h: 0.93, lean: 10, armN: [80, 30, 0], armF: [65, 35, 0], squash: [1, 1], near: [0.12, 0, 8], far: [-0.1, 0, 4] },
      land: { dur: 0.13, ease: 'out', h: 0.62, lean: 32, neck: -10, head: -14, armN: [62, 45, 0], armF: [48, 50, 0], squash: [1.07, 0.93], mouth: 'grit' },
      recover: { dur: 0.45, ease: 'back', squash: [1, 1], mouth: null },
      flight: 0.42, flightPerL: 0.05, heightL: 0.55 },

    // ------------------------------------------------------------------ body poses
    stand: { channel: 'body', args: {}, doc: 'stand at ease', keys: [Object.assign({ dur: 0.45, ease: 'inOut' }, STAND)] },
    idle: { channel: 'body', args: {}, doc: 'stand with life: weight shifts, glances', clip: 'idle',
      keys: [Object.assign({ dur: 0.45, ease: 'inOut' }, STAND)],
      loop: { x: [0.05, 4.6], lean: [2, 4.6, 0.3], tilt: [3.5, 4.6], twist: [4, 4.6, 0.1], head: [7, 7.3], neck: [4, 5.9], armN: [6, 4.6, 0.2], armF: [5, 5.3] } },
    kneel: { channel: 'body', args: {}, doc: 'go down on one knee',
      keys: [
        { dur: 0.28, ease: 'inOut', h: 0.86, lean: 14, near: [-0.3, 0, 0], far: [0.16, 0, 0], armN: [14, 26, 6], armF: [10, 30, 0], head: 6 },
        { dur: 0.4, ease: 'out', x: -0.02, lean: 10, near: { knee: 0.08, shin: 24 }, far: [0.42, 0, 0], armN: [4, 34, 14], armF: [38, 74, 6], head: 8, neck: 4 },
        { dur: 0.22, ease: 'inOut', lean: 5, head: 2, neck: 0 },
      ] },
    crouch: { channel: 'body', args: {}, doc: 'squat down low, ready',
      keys: [
        { dur: 0.36, ease: 'back', h: 0.6, lean: 30, neck: -12, head: -16, near: [0.17, 0, 0], far: [-0.12, 0, -22], armN: [40, 58, 12], armF: [30, 64, 4] },
      ] },
    recoil: { channel: 'body', args: {}, doc: 'flinch and step back in fear', mood: 'scared',
      keys: [
        { dur: 0.1, ease: 'out', h: 0.95, lean: -3, neck: 10, head: 8, armN: [42, 95, -20], armF: [30, 100, -10], hands: ['open', 'open'] },
        { dur: 0.24, ease: 'back', x: -0.3, h: 0.92, lean: -11, neck: 8, head: -2, far: [-0.66, 0, 0], near: [0.06, 0, 16], armN: [78, 88, -35], armF: [62, 96, -20] },
        { dur: 0.5, ease: 'inOut', x: -0.28, h: 0.9, lean: -7, neck: 12, head: 5, near: [0.06, 0, 0], armN: [60, 102, -25], armF: [46, 106, -15] },
      ] },
    // ---- added for films/ep1 (Kai): peer, breathe, wobble ----
    peer: { channel: 'body', args: {}, doc: 'lean out over an edge to look down, arms back for balance (holds)',
      keys: [
        { dur: 0.55, ease: 'inOut', x: 0.05, h: 0.955, lean: 13, neck: 4, head: 5, twist: 2, near: [0.3, 0, 0], far: [-0.1, 0, 0], armN: [-32, 22, 6], armF: [-40, 26, 4], hands: ['open', 'open'] },
        { dur: 0.7, ease: 'inOut', lean: 17, head: 7, armN: [-38, 26, 8], armF: [-46, 30, 6] },
      ] },
    breathe: { channel: 'body', args: {}, doc: 'a deep breath: chest up, hold, blow out, settle (about 2.4 s)',
      keys: [
        { dur: 0.75, ease: 'inOut', h: 0.99, lean: -8, tilt: 2, neck: -6, head: -10, twist: 2, near: [0.12, 0, 0], far: [-0.1, 0, 0], armN: [-6, 20, 6], armF: [-14, 24, 2], squash: [0.97, 1.04], hands: ['relaxed', 'relaxed'] },
        { dur: 0.45, ease: 'linear', lean: -9, head: -11 },
        { dur: 0.8, ease: 'inOut', h: 0.955, lean: 5, neck: 3, head: 7, armN: [6, 18, 8], armF: [-4, 22, 4], squash: [1.02, 0.98], mouth: 'o' },
        { dur: 0.4, ease: 'inOut', h: 0.975, lean: -1, neck: -2, head: 2, squash: [1, 1], armN: STAND.armN, armF: STAND.armF },
      ] },
    wobble: { channel: 'body', args: {}, doc: 'lose balance (after a landing): pitch forward and back, arms windmill, recover',
      keys: [
        { dur: 0.2, ease: 'out', h: 0.95, lean: 24, neck: -6, head: -10, near: [0.14, 0, 0], far: [-0.16, 0.24, -10], armN: [150, 22, 0], armF: [-40, 30, 0], hands: ['open', 'open'], mouth: 'grit' },
        { dur: 0.24, ease: 'inOut', h: 0.965, lean: -14, neck: 4, head: 6, far: [-0.12, 0, 0], near: [0.22, 0.14, 16], armN: [40, 30, 0], armF: [165, 20, 0], mouth: 'o' },
        { dur: 0.22, ease: 'inOut', h: 0.955, lean: 15, head: -6, near: [0.16, 0, 0], armN: [140, 30, 0], armF: [20, 40, 0], mouth: 'grit' },
        { dur: 0.22, ease: 'inOut', lean: -6, head: 2, armN: [60, 40, 0], armF: [110, 40, 0], mouth: 'o' },
        { dur: 0.3, ease: 'back', lean: 5, armN: [24, 30, 0], armF: [14, 32, 0], mouth: null },
        Object.assign({ dur: 0.4, ease: 'inOut' }, STAND, { x: null, near: null, far: null }),
      ] },
    sit: { channel: 'body', args: { on: 0 }, doc: 'sit on the ground, or on a seat on=<height px>',
      keys: [
        { dur: 0.35, ease: 'inOut', h: 0.62, lean: 24, near: [0.2, 0, 0], far: [0.02, 0, 0], armN: [30, 30, 0], armF: [20, 30, 0] },
        { dur: 0.42, ease: 'out', x: -0.12,
          h: (a, b) => a.on > 0 ? (a.on / b.k + Math.max(0.2, b.pr.radius.hip * 0.75) - b.A) / b.L : (Math.max(0.25, b.pr.radius.hip * 0.85) - b.A) / b.L,   // seat height grows with a thick thigh
          lean: (a) => a.on > 0 ? 4 : -8, head: (a) => a.on > 0 ? 3 : 8,
          near: (a, b) => a.on > 0 ? [0.42, 0, 0] : [0.66, 0, 14], far: (a, b) => a.on > 0 ? [0.32, 0, 0] : [0.52, 0, 10],
          armN: (a) => a.on > 0 ? [48, 24, 0] : [-38, 8, -70], armF: (a) => a.on > 0 ? [40, 30, 0] : [-30, 8, -70] },
        { dur: 0.3, ease: 'inOut', lean: (a) => a.on > 0 ? 6 : -5 },
      ] },
    // ---- added for films/ep2 (Kai): fallsit ----
    fallsit: { channel: 'body', args: {}, doc: 'something gives way: pop up, topple backwards and land sitting on the ground (holds; ~0.9 s)',
      keys: [
        { dur: 0.12, ease: 'out', x: -0.08, h: 0.97, lean: -20, neck: -6, head: -12, near: [0.12, 0.1, 18], far: [-0.06, 0, 0], armN: [70, 12, 0], armF: [58, 16, 0], hands: ['open', 'open'], mouth: 'o' },
        { dur: 0.26, ease: 'in', x: -0.42, h: (a, b) => (Math.max(0.25, b.pr.radius.hip * 0.85) - b.A) / b.L, lean: -18, head: -8, near: [0.22, 0.2, 30], far: [0.1, 0.12, 24], armN: [128, 22, 0], armF: [104, 30, 0] },
        { dur: 0.32, ease: 'back', lean: -6, neck: 2, head: 6, near: [0.28, 0, 14], far: [0.14, 0, 10], armN: [-38, 8, -70], armF: [-30, 8, -70], mouth: null },
        { dur: 0.2, ease: 'inOut', lean: -4 },
      ] },

    // ---- added for the early jump film: backstep ----
    backstep: { channel: 'body', args: {}, doc: 'back away from something: three wary steps backwards, hands up in front (~1.4 s, about 1.4 leg lengths)', mood: 'scared',
      keys: [
        { dur: 0.32, ease: 'inOut', x: -0.28, h: 0.955, lean: -9, neck: 6, head: 6, near: [0.12, 0, 0], far: [-0.62, 0, 0], armN: [36, 78, -14], armF: [28, 86, -10], hands: ['open', 'open'] },
        { dur: 0.34, ease: 'inOut', x: -0.78, lean: -7, near: [-1.08, 0, 0], armN: [40, 82, -16], armF: [30, 90, -12] },
        { dur: 0.34, ease: 'inOut', x: -1.26, lean: -8, far: [-1.5, 0, 0], head: 8 },
        { dur: 0.4, ease: 'inOut', x: -1.36, h: 0.97, lean: -3, neck: 2, head: 4, near: [-1.24, 0, 0], armN: [14, 40, 6], armF: [8, 46, 4], hands: ['relaxed', 'relaxed'] },
      ] },

    // ------------------------------------------------------------------ arm gestures
    wave: { channel: 'arms', args: { hand: 'near' }, doc: 'wave hello (hand=near|far|both)', release: 0.4, mood: 'happy',
      clip: a => a.hand === 'both' ? 'waveBoth' : 'wave',
      keys: [
        { dur: 0.28, ease: 'back', armN: [104, 62, -6], armF: [-6, 26, 0], hands: ['open', 'relaxed'], lean: -3, head: -5, twist: 6 },
        { dur: 0.95, ease: 'linear', wiggle: [{ arm: 'N', j: 1, amp: 24, hz: 2.4 }, { arm: 'N', j: 2, amp: 16, hz: 2.4, ph: 0.22 }] },
      ] },
    point: { channel: 'arms', args: { at: null, for: 1.5 }, doc: 'point at a place or name', hold: 'for', release: 0.35,
      keys: [
        { dur: 0.14, ease: 'out', aim: { off: -30, elbow: 70 }, hands: ['fist', 'relaxed'], twist: -4 },
        { dur: 0.2, ease: 'back', aim: { off: 0, elbow: 6, lean: 0.12 }, hands: ['point', 'relaxed'], armF: [-14, 28, 0], twist: 8, head: -3 },
      ] },
    reach: { channel: 'arms', args: { at: null, for: 1.2 }, doc: 'reach out to a place or name', hold: 'for', release: 0.45,
      keys: [
        { dur: 0.16, ease: 'inOut', aim: { off: 10, elbow: 50 }, hands: ['relaxed', 'relaxed'] },
        { dur: 0.36, ease: 'out', aim: { off: 0, elbow: 4, lean: 0.45 }, hands: ['open', 'relaxed'], armF: [-28, 30, 0], stretch: 1.08, twist: 10,
          wiggle: [{ arm: 'N', j: 2, amp: 6, hz: 0.9 }] },
      ] },
    cheer: { channel: 'arms', args: {}, doc: 'both arms up, fists, a little bounce', release: 0.4, mood: 'excited',
      keys: [
        { dur: 0.12, ease: 'out', armN: [25, 100, 0], armF: [20, 105, 0], hands: ['fist', 'fist'], h: -0.05, lean: 6 },
        { dur: 0.22, ease: 'back', armN: [108, 14, 20], armF: [140, 40, 10], h: 0.02, lean: -9, head: -10, stretch: 1.1 },
        { dur: 0.85, ease: 'linear', wiggle: [{ arm: 'N', j: 0, amp: 9, hz: 2.2 }, { arm: 'F', j: 0, amp: 9, hz: 2.2, ph: 0.5 }], bob: [0.03, 2.2] },
      ] },
    hold: { channel: 'arms', args: { prop: null, how: 'front', weight: 0, quick: 0 }, doc: 'take and keep holding a prop: how=up|front|side', hold: Infinity, release: 0.4,
      variants: {
        front: [{ dur: 0.32, ease: 'inOut', armN: [42, 92, -10], armF: [48, 88, -10], hands: ['grip', 'grip'] }],
        up: [{ dur: 0.18, ease: 'out', armN: [60, 60, 0], hands: ['grip', 'relaxed'] }, { dur: 0.3, ease: 'back', armN: [172, 10, 0], armF: [-10, 24, 0], lean: -4, head: -8 }],
        side: [{ dur: 0.3, ease: 'inOut', armN: [6, 14, -6], hands: ['grip', 'relaxed'] }],
      } },
    // ---- added for films/ep1 (Kai): clench, pet ----
    clench: { channel: 'arms', args: { for: 1.2 }, doc: 'clench a fist in front of the chest and hold it, trembling with resolve', hold: 'for', release: 0.45, mood: 'determined',
      keys: [
        { dur: 0.3, ease: 'back', armN: [22, 122, -12], armF: [-8, 30, 0], hands: ['fist', 'relaxed'], lean: 4, head: 3, twist: -5 },
        { dur: 0.5, ease: 'inOut', armN: [26, 128, -16], lean: 5, head: 5, wiggle: [{ arm: 'N', j: 1, amp: 2.5, hz: 7 }, { arm: 'N', j: 0, amp: 1.5, hz: 7, ph: 0.3 }] },
      ] },
    pet: { channel: 'arms', args: { at: null, for: 2 }, doc: 'stroke an animal at a place or name, gently, for= seconds', hold: 'for', release: 0.45, mood: 'happy',
      keys: [
        { dur: 0.4, ease: 'inOut', aim: { off: 4, elbow: 30, lean: 0.15 }, hands: ['open', 'relaxed'], head: 6 },
        { dur: 0.6, ease: 'inOut', aim: { off: -2, elbow: 22, lean: 0.2 }, head: 8,
          wiggle: [{ arm: 'N', j: 1, amp: 12, hz: 1.1 }, { arm: 'N', j: 0, amp: 5, hz: 1.1, ph: 0.25 }, { arm: 'N', j: 2, amp: 10, hz: 1.1, ph: 0.5 }] },
      ] },
    // ---- added for films/ep2 (Kai): hesitate, tug, shield, laugh ----
    hesitate: { channel: 'arms', args: { at: null, for: 0.8 }, doc: 'reach slowly toward a place or name, flinch back to the chest, then reach again, slowly (~2.6 s + for)', hold: 'for', release: 0.4,
      keys: [
        { dur: 0.8, ease: 'inOut', aim: { off: 22, elbow: 70, lean: 0.12 }, hands: ['open', 'relaxed'], armF: [-6, 30, 0], head: 2 },
        { dur: 0.22, ease: 'out', armN: [26, 118, -22], armF: [10, 60, 0], hands: ['fist', 'relaxed'], lean: -5, head: -3, twist: -4 },
        { dur: 0.55, ease: 'linear', wiggle: [{ arm: 'N', j: 1, amp: 3, hz: 6 }] },
        { dur: 1.0, ease: 'inOut', aim: { off: 4, elbow: 18, lean: 0.4 }, hands: ['open', 'relaxed'], armF: [-20, 30, 0], head: 4, twist: 6,
          wiggle: [{ arm: 'N', j: 2, amp: 5, hz: 2.5 }] },
      ] },
    tug: { channel: 'arms', args: { at: null, for: 1.5, hand: 'both' }, doc: 'grip something at a place or name with both hands and pull hard, leaning back, straining', hold: 'for', release: 0.3, mood: 'angry',
      keys: [
        { dur: 0.3, ease: 'inOut', aim: { off: 0, elbow: 16, lean: 0.35 }, hands: ['grip', 'grip'] },
        { dur: 0.35, ease: 'out', aim: { off: -8, elbow: 6, lean: 0 }, lean: -14, h: -0.05, head: 6, neck: 4, twist: -6,
          wiggle: [{ arm: 'N', j: 0, amp: 2.5, hz: 9 }, { arm: 'N', j: 1, amp: 3, hz: 9, ph: 0.3 }] },
        { dur: 0.5, ease: 'inOut', aim: { off: -12, elbow: 4, lean: 0 }, lean: -19, h: -0.07, head: 8, neck: 5, twist: -8,
          wiggle: [{ arm: 'N', j: 0, amp: 3.5, hz: 10 }, { arm: 'N', j: 1, amp: 4, hz: 10, ph: 0.3 }] },
      ] },
    shield: { channel: 'arms', args: { for: 2 }, doc: 'shield someone behind: front arm out, palm up to stop, back arm spread around them; trembling', hold: 'for', release: 0.4, mood: 'scared',
      keys: [
        { dur: 0.25, ease: 'back', armN: [84, 14, -55], armF: [-78, 10, 20], hands: ['open', 'open'], lean: -7, head: -4, twist: -8, h: -0.03 },
        { dur: 0.5, ease: 'inOut', armN: [80, 18, -60], armF: [-84, 12, 24], lean: -6,
          wiggle: [{ arm: 'N', j: 0, amp: 2, hz: 7 }, { arm: 'F', j: 0, amp: 2, hz: 7, ph: 0.4 }] },
      ] },
    laugh: { channel: 'arms', args: { for: 1.2 }, doc: 'laugh out loud: head back, a hand on the belly, shoulders bouncing', hold: 'for', release: 0.35, mood: 'excited',
      keys: [
        { dur: 0.2, ease: 'out', armN: [14, 104, 10], armF: [4, 90, 0], hands: ['open', 'relaxed'], lean: -9, head: -14, neck: -4 },
        { dur: 0.3, ease: 'inOut', lean: -7, head: -12, bob: [0.025, 4.2],
          wiggle: [{ arm: 'N', j: 0, amp: 4, hz: 4.2 }, { arm: 'F', j: 0, amp: 3, hz: 4.2, ph: 0.2 }] },
      ] },
    // ---- added for the early jump film: beat gestures. Each one is built on the 0.5 s beat of 120 BPM:
    // started on a beat, its strong poses fall on beats (the clap meets on every beat).
    clap: { channel: 'arms', args: { for: 2 }, doc: 'clap in profile on the beat (120 BPM): hands meet in front on every beat, open wide between; for= seconds', hold: 'for', release: 0.25, mood: 'happy',
      keys: [
        { dur: 0.25, ease: 'out', armN: [98, 28, 0], armF: [62, 28, 0], hands: ['open', 'open'], lean: -2, head: -4 },
        { dur: 0.25, ease: 'inOut', wiggle: [{ arm: 'N', j: 0, amp: 20, hz: 2, ph: 0.75 }, { arm: 'F', j: 0, amp: -20, hz: 2, ph: 0.75 },
          { arm: 'N', j: 1, amp: 10, hz: 2, ph: 0.75 }, { arm: 'F', j: 1, amp: 10, hz: 2, ph: 0.75 }] },
      ] },
    waveover: { channel: 'arms', args: { hand: 'near', for: 1 }, doc: 'wave someone over: a big arm over the head swinging back on every beat (hand=near|far|both)', hold: 'for', release: 0.3, mood: 'happy',
      keys: [
        { dur: 0.25, ease: 'back', armN: [148, 30, 0], armF: [-12, 28, 0], hands: ['open', 'relaxed'], lean: -4, head: -6 },
        { dur: 0.25, ease: 'inOut', wiggle: [{ arm: 'N', j: 0, amp: 26, hz: 1, ph: 0.25 }, { arm: 'N', j: 1, amp: 30, hz: 1, ph: 0.75 }, { arm: 'N', j: 2, amp: 20, hz: 1, ph: 0.75 }] },
      ] },
    psych: { channel: 'arms', args: {}, doc: 'psych up: clench both fists at the sides and nod hard on four beats (2 s)', release: 0.3, mood: 'determined',
      keys: [
        { dur: 0.25, ease: 'back', armN: [-30, 42, 10], armF: [-20, 52, 0], hands: ['fist', 'fist'], lean: 6, head: 2, twist: -3 },
        { dur: 0.25, ease: 'out', head: 18, neck: 4, lean: 7 },
        { dur: 0.25, ease: 'inOut', head: -2, neck: 0, lean: 4 },
        { dur: 0.25, ease: 'out', head: 18, neck: 4, lean: 7 },
        { dur: 0.25, ease: 'inOut', head: -2, neck: 0, lean: 4 },
        { dur: 0.25, ease: 'out', head: 18, neck: 4, lean: 7 },
        { dur: 0.25, ease: 'inOut', head: -2, neck: 0, lean: 4 },
        { dur: 0.25, ease: 'out', head: 16, neck: 4, lean: 7, armN: [-34, 46, 12], armF: [-24, 56, 0] },
      ] },
    // cheer on the beat: a new pose on every beat for 8 beats. alt = 0..3 starts the cycle at another
    // pose; alt = 4..7 uses poses for a small child (short arms that would vanish against a big head)
    cheerbeat: { channel: 'arms', args: { alt: 0 }, doc: 'cheer with a new pose on every beat for 8 beats (4 s); alt=0..3 starts at another pose, 4..7 = small-child poses', release: 0.4, mood: 'excited',
      keys: [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
        const P = [
          { armN: [158, 12, 0], armF: [128, 18, 0], hands: ['fist', 'fist'], lean: -9, head: -12, h: 0 },       // V for victory
          { armN: [176, 4, 0], armF: [18, 92, 0], hands: ['fist', 'fist'], lean: 5, head: -2, h: -0.1 },       // fist pump, knees bent
          { armN: [104, 4, 0], armF: [-62, 8, 0], hands: ['open', 'open'], lean: -12, head: -16, h: 0 },       // arms flung wide
          { armN: [178, 0, 0], armF: [168, 6, 0], hands: ['open', 'open'], lean: -5, head: -14, h: -0.04 },    // both arms straight up
          { armN: [102, 0, 0], armF: [80, 8, 0], hands: ['fist', 'fist'], lean: -8, head: -12, h: 0 },         // small: both fists punched forward
          { armN: [-42, 58, 0], armF: [-56, 48, 0], hands: ['fist', 'fist'], lean: 16, head: 6, h: -0.1 },     // small: fists back, shouting forward
          { armN: [96, 0, 0], armF: [-78, 8, 0], hands: ['open', 'open'], lean: -12, head: -16, h: 0 },        // small: arms flung wide
          { armN: [110, 0, 0], armF: [-100, 4, 0], hands: ['open', 'open'], lean: -6, head: -14, h: -0.04 },   // small: star
        ];
        const pick = f => a => { const k = Math.round(a.alt || 0); return P[(k >= 4 ? 4 : 0) + (i + k) % 4][f]; };
        return { dur: 0.5, ease: 'back', armN: pick('armN'), armF: pick('armF'), hands: pick('hands'), lean: pick('lean'), head: pick('head'), h: pick('h') };
      }) },
    drop: { channel: 'arms', args: { quiet: 0 }, doc: 'let go of the held prop (quiet=1: no gesture, it was handed over or thrown)', release: 0.4,
      keys: [{ dur: 0.18, ease: 'out', armN: [30, 20, 25], armF: [20, 25, 20], hands: ['open', 'open'], lean: -2 }, { dur: 0.15, ease: 'linear' }] },

    // ------------------------------------------------------------------ face and eyes (perform.js)
    face: { channel: 'face', args: { mood: 'neutral', strength: 1 }, doc: 'mood = happy|scared|determined|surprised|sad|neutral|excited|angry|tired|proud|shy; strength 0..2 (brows, lids, smile blend over 0.35 s)' },
    // ---- speech (docs/SPEECH.md) ----
    say: { channel: 'say', args: { text: '', for: 0, track: '', words: '', visemes: '', beats: 0 }, doc: 'speak a line: say("text", for=seconds); track="lines/x.json" (Rhubarb or [{t,v}]), words="0:Good 0.3:morning", beats=1 for hand beats' },
    look: { channel: 'look', args: { at: 'front' }, doc: 'look at a place or name, or up|down|front|back' },
    nod: { channel: 'look', args: {}, doc: 'nod twice' },
    // ---- the mood layer (docs/ACTIONS.md): colours every motion until the next mood line ----
    mood: { channel: 'mood', args: { name: 'neutral', strength: 1 }, doc: 'mood = neutral|happy|sad|angry|scared|tired|proud|shy (strength 0..2): posture, head, arms, step tempo, arm swing, idle, face' },
  };

  // mood -> swap names (skins may lack a name; the renderer falls back to the neutral one)
  const moods = {
    neutral: { mouth: 'neutral', eye: 'open', brow: 'neutral' },
    happy: { mouth: 'smile', eye: 'open', brow: 'up' },
    excited: { mouth: 'open', eye: 'happy', brow: 'up' },
    scared: { mouth: 'worried', eye: 'wide', brow: 'worried' },
    surprised: { mouth: 'o', eye: 'wide', brow: 'up' },
    determined: { mouth: 'neutral', eye: 'narrow', brow: 'down' },   // skins without 'narrow' fall back to 'open'
    sad: { mouth: 'sad', eye: 'sad', brow: 'worried' },
    angry: { mouth: 'grit', eye: 'open', brow: 'down' },
    tired: { mouth: 'neutral', eye: 'narrow', brow: 'worried' },
    proud: { mouth: 'smile', eye: 'narrow', brow: 'neutral' },
    shy: { mouth: 'smile', eye: 'open', brow: 'worried' },
  };

  // how a mood changes the body (radians, leg lengths; cadence, stride, swing, bounce, tempo are
  // relative changes: -0.2 = 20% less, tempo + = slower actions; fist > 0.5 clenches relaxed hands)
  const moodMotion = {
    neutral: {},
    happy: { lean: -0.03, head: -0.06, chest: 0.02, cadence: 0.06, stride: 0.05, swing: 0.25, bounce: 0.35, tempo: -0.08 },
    sad: { lean: 0.1, bend: 0.24, neck: 0.1, head: 0.1, chest: -0.03, drop: -0.02, shoulder: -0.06, elbow: -0.15, cadence: -0.22, stride: -0.18, swing: -0.65, bounce: -0.5, tempo: 0.3 },
    angry: { lean: 0.14, bend: 0.06, neck: 0.18, head: -0.06, chest: 0.02, drop: -0.01, shoulder: 0.05, elbow: 0.5, cadence: 0.12, stride: 0.05, swing: 0.35, bounce: 0.1, tempo: -0.12, fist: 1 },
    scared: { lean: 0.06, bend: 0.2, neck: -0.12, head: 0.05, twist: 0.1, chest: -0.04, drop: -0.05, shoulder: 0.35, elbow: 1.1, cadence: 0.15, stride: -0.25, swing: -0.6, bounce: -0.4, tempo: -0.1 },
    tired: { lean: 0.08, bend: 0.22, neck: 0.22, head: 0.18, chest: -0.02, drop: -0.025, shoulder: -0.04, elbow: -0.1, cadence: -0.28, stride: -0.15, swing: -0.5, bounce: -0.55, tempo: 0.35 },
    proud: { lean: -0.08, bend: -0.18, neck: -0.12, head: -0.15, chest: 0.05, shoulder: -0.05, elbow: 0.05, cadence: -0.05, stride: 0.12, swing: 0.15, bounce: -0.1, tempo: 0.05 },
    shy: { lean: 0.05, bend: 0.12, neck: 0.22, head: 0.3, twist: -0.12, chest: -0.02, drop: -0.01, shoulder: 0.12, elbow: 0.9, cadence: -0.1, stride: -0.3, swing: -0.7, bounce: -0.4, tempo: 0.15 },
  };

  // face parameters per mood: brow height and angle (-1 angry .. +1 worried), upper lid (1 open, 0.5 half, 1.2 wide), smile (-1 .. 1)
  const faceParams = {
    neutral: {}, happy: { browH: 0.3, lid: 0.92, smile: 0.8 }, excited: { browH: 0.6, lid: 1.05, smile: 1 }, scared: { browH: 0.7, browA: 0.8, lid: 1.2, smile: -0.3 },
    surprised: { browH: 1, browA: 0.2, lid: 1.25 }, determined: { browH: -0.4, browA: -0.6, lid: 0.8 }, sad: { browH: 0.1, browA: 0.9, lid: 0.75, smile: -0.6 },
    angry: { browH: -0.5, browA: -1, lid: 0.85, smile: -0.4 }, tired: { browH: -0.2, browA: 0.3, lid: 0.55, smile: -0.1 }, proud: { browH: 0.1, browA: -0.2, lid: 0.8, smile: 0.5 },
    shy: { browH: 0.2, browA: 0.6, lid: 0.8, smile: 0.3 },
  };

  return { actions, moods, STAND, moodMotion, faceParams };
});
