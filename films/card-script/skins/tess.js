// skins/tess.js - Tess, the reference skin. Copy this file to draw a new character.
// UMD: registers CharSkins.tess in the browser, module.exports in Node.
//
// Style: flat, no outline, limited palette, one darker shade plane per colour ('<key>Shade').
// Coordinates are y-up. Frames (see rig.js "Skins"):
//   limbs (upperArm, foreArm, thigh, shin): x runs 0..1 along the bone. The `cap` shorthand
//     draws a tapered capsule with radii in head units, so it fits any bone length.
//   torso, pelvis: origin = pelvis centre; neck: origin = neck base; head: origin = top of the
//     neck. x forward (the way she faces), y up, 1 unit = 1 head height.
//   foot: origin = ankle, x along the sole. hand swaps: origin = wrist, x along the fingers,
//     +y = thumb side. Both in head units.
// To restyle: change `palette`; to re-proportion: change `proportions` (parts follow bones).
//
// Newer features (all optional; skins/kai.js uses every one, AUTHORING.md "Writing a skin" has
// the full field list and recipes):
//   parts.arm, parts.leg  soft limbs: { tube: [r0, r1, r2], from, to, flat, inset, fill } is ONE
//     continuous shape from shoulder (hip) through elbow (knee) to wrist (ankle), no hinge, one
//     outline. from/to are fractions of the whole limb (sleeves, cuffs, boots).
//   torso  is bent along a short spine and squashed/stretched keeping its area by the engine;
//     draw it as a few closed paths in the torso frame.
//   chains  are simulated springs (hair tufts, scarf tail, backpack, skirt hem): stiff, limit,
//     gravity, drag, wind, inertia, freq, end + endUpright (a pack hanging on its strap).
//   springs: { arms, head, torso }  how much the body overlaps and settles (default 1 each).
//   outline: 0.04 with palette.outline gives a thick ink line round every part.
(function (root, factory) {
  const skin = factory();
  if (typeof module === 'object' && module.exports) module.exports = skin;
  else { root.CharSkins = root.CharSkins || {}; root.CharSkins[skin.name] = skin; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // ellipse path helper (a skin is plain data; this only shortens repeated ovals)
  const oval = (x, y, rx, ry) => `M${x - rx} ${y}A${rx} ${ry} 0 1 0 ${x + rx} ${y}A${rx} ${ry} 0 1 0 ${x - rx} ${y}Z`;

  // eye centre and the mouth corner live here so the whole face can be nudged at once
  const EX = 0.31, EY = 0.52;

  return {
    name: 'tess',
    // bone lengths in head heights (head = 1). A child: big head, short limbs.
    proportions: {
      head: 1, neck: 0.07, torso: 0.66, shoulderDrop: 0.12,
      upperArm: 0.37, foreArm: 0.35, thigh: 0.53, shin: 0.5,
      ankleHeight: 0.1,
      heel: [-0.12, -0.1], toe: [0.34, -0.1],          // pivots used by the gait (foot frame)
      footGround: [[-0.13, -0.1], [0.4, -0.1], [-0.145, -0.07], [0.43, -0.075], [0.44, -0.04], [0.42, 0.0]],
      farShoulder: [-0.05, -0.015],
      radius: { hip: 0.16, knee: 0.085, hem: 0.12, shoulder: 0.085, elbow: 0.068, wrist: 0.055, neck: 0.07 },
    },
    headTop: 1.1,                 // top of the hair above the head origin (for height and framing)
    outline: 0,                   // 0 = flat. Set e.g. 0.03 (head units) for an outlined look.
    farShade: 0.84,               // far arm and leg are darkened by this factor
    palette: {
      skin: '#f7c8a6', skinShade: '#e4a283',
      hair: '#7b3a2c', hairShade: '#57261c',
      top: '#3f8f88', topShade: '#2f716c',              // sleeves (long-sleeved top)
      dress: '#f0b23e', dressShade: '#d29028',          // pinafore over the top
      bottom: '#2e3b63', bottomShade: '#222c4c',
      shoe: '#d9573f', shoeShade: '#b2422e', sole: '#f6e9d1',
      accent: '#e2554a', accentShade: '#bf4137',         // scarf, cuffs, scrunchie
      eye: '#2a1a17', white: '#ffffff', mouth: '#7a2b2e', tongue: '#e8737a', cheek: '#f29c87',
      outline: '#2a1b18', shade: 0.82,
    },

    parts: {
      // ---- arms: long teal sleeves with a mustard cuff; the hand sits under the cuff ----
      upperArm: [
        { cap: [0.088, 0.07], fill: 'top' },
        { cap: [0.088, 0.07], inset: -0.38, from: 0.15, fill: 'topShade' },      // back-edge shade
      ],
      foreArm: [
        { cap: [0.07, 0.06], fill: 'top' },
        { cap: [0.07, 0.06], inset: -0.36, to: 0.8, fill: 'topShade' },
        { d: 'M0.82 -0.2Q0.805 0 0.82 0.2L0.97 0.185Q0.985 0 0.97 -0.185Z', fill: 'accent' },   // cuff (bone units)
      ],
      // ---- legs: navy leggings, boots with a cream fleece cuff ----
      thigh: [
        { cap: [0.15, 0.1, 0.086], fill: 'bottom' },
        { cap: [0.15, 0.1, 0.086], inset: -0.36, from: 0.2, fill: 'bottomShade' },
      ],
      shin: [
        { cap: [0.086, 0.078, 0.058], mid: 0.35, fill: 'bottom' },                 // calf bulge
        { cap: [0.086, 0.078, 0.058], mid: 0.35, inset: -0.36, to: 0.6, fill: 'bottomShade' },
        { cap: [0.074, 0.07], from: 0.62, to: 1.02, fill: 'shoe' },               // boot shaft
        { d: 'M0.58 -0.17Q0.565 0 0.58 0.17L0.665 0.17Q0.68 0 0.665 -0.17Z', fill: 'sole' },   // fleece cuff (bone units)
      ],
      foot: [
        // boot upper: shaft at the back, rounded toe in front
        { d: 'M-0.105 0.12L-0.125 -0.02C-0.13 -0.06 -0.12 -0.075 -0.1 -0.075L0.31 -0.075C0.39 -0.075 0.43 -0.06 0.43 -0.02C0.43 0.03 0.37 0.06 0.29 0.065C0.2 0.07 0.12 0.075 0.075 0.1L0.065 0.12Z', fill: 'shoe' },
        { d: 'M-0.105 0.12L-0.125 -0.02C-0.13 -0.06 -0.12 -0.075 -0.1 -0.075L-0.03 -0.075C-0.05 -0.02 -0.05 0.06 -0.035 0.12Z', fill: 'shoeShade' },
        { d: 'M0.1 0.075L0.16 0.0', stroke: 'sole', w: 0.022 },                     // strap
        // sole with a small heel block
        { d: 'M-0.135 -0.06L0.41 -0.06C0.44 -0.06 0.445 -0.08 0.44 -0.1L-0.125 -0.1C-0.14 -0.09 -0.145 -0.07 -0.135 -0.06Z', fill: 'sole' },
      ],
      pelvis: { d: 'M-0.19 0.06C-0.21 -0.09 -0.15 -0.19 0 -0.2C0.14 -0.19 0.2 -0.11 0.19 0.03C0.12 0.11 -0.12 0.11 -0.19 0.06Z', fill: 'bottom' },
      neck: [
        { d: 'M-0.075 -0.05L-0.08 0.17C-0.03 0.21 0.05 0.21 0.075 0.17L0.07 -0.05Z', fill: 'skin' },
        { d: 'M-0.075 -0.05L-0.08 0.17C-0.06 0.19 -0.04 0.2 -0.02 0.2L-0.015 -0.05Z', fill: 'skinShade' },
      ],
      // ---- torso: A-line jumper (tunic), back shade plane, the scarf wrap on top ----
      torso: [
        { d: 'M0.2 -0.24C0.26 -0.06 0.27 0.12 0.25 0.3C0.24 0.45 0.2 0.58 0.1 0.66C0.02 0.7 -0.1 0.7 -0.16 0.66C-0.24 0.6 -0.26 0.44 -0.25 0.28C-0.25 0.1 -0.27 -0.07 -0.29 -0.22C-0.14 -0.27 0.08 -0.27 0.2 -0.24Z', fill: 'dress' },
        { d: 'M-0.16 0.64C-0.24 0.58 -0.26 0.44 -0.25 0.28C-0.25 0.1 -0.27 -0.07 -0.29 -0.22C-0.25 -0.235 -0.21 -0.245 -0.17 -0.25C-0.15 -0.07 -0.13 0.13 -0.13 0.3C-0.13 0.45 -0.14 0.56 -0.16 0.64Z', fill: 'dressShade' },
        { d: 'M0.05 0.18C0.1 0.17 0.16 0.17 0.2 0.18L0.205 0.03C0.16 0.02 0.1 0.02 0.055 0.03Z', fill: 'dressShade' },   // pocket
        // scarf wrapped round the neck (the trailing tail is the `scarf` chain below)
        { d: 'M-0.19 0.6C-0.22 0.72 -0.1 0.8 0.03 0.79C0.14 0.78 0.2 0.71 0.17 0.62C0.1 0.58 -0.1 0.56 -0.19 0.6Z', fill: 'accent' },
        { d: 'M-0.19 0.6C-0.1 0.56 0.1 0.58 0.17 0.62C0.18 0.65 0.18 0.67 0.175 0.69C0.1 0.65 -0.08 0.64 -0.185 0.67Z', fill: 'accentShade' },
      ],
      // ---- head: drawn in order; {swap} entries place the face swaps between layers ----
      head: [
        // face and skull: round cranium, small button nose, soft chin
        { d: 'M-0.1 0.1C0.02 0.04 0.18 0.02 0.3 0.08C0.38 0.11 0.42 0.18 0.42 0.24C0.44 0.27 0.46 0.29 0.46 0.32C0.47 0.35 0.47 0.37 0.47 0.39C0.5 0.4 0.54 0.42 0.535 0.46C0.53 0.5 0.49 0.52 0.47 0.55C0.47 0.7 0.44 0.84 0.32 0.94C0.16 1.04 -0.14 1.03 -0.32 0.9C-0.46 0.78 -0.48 0.56 -0.4 0.4C-0.34 0.28 -0.22 0.16 -0.1 0.1Z', fill: 'skin' },
        { d: 'M-0.1 0.1C0.02 0.04 0.18 0.02 0.3 0.08C0.18 0.075 0.05 0.1 -0.05 0.155Z', fill: 'skinShade' },   // under the jaw
        { d: oval(0.25, 0.34, 0.075, 0.045), fill: 'cheek', opacity: 0.75 },
        { swap: 'mouth' },
        { swap: 'eye' },
        // bob with a scalloped fringe; the back hangs to the jaw
        { d: 'M0.46 0.7C0.5 0.84 0.42 0.99 0.26 1.06C0.06 1.14 -0.26 1.11 -0.43 0.95C-0.54 0.84 -0.55 0.62 -0.5 0.45C-0.47 0.35 -0.43 0.27 -0.45 0.19C-0.39 0.17 -0.31 0.2 -0.24 0.26C-0.19 0.36 -0.16 0.42 -0.12 0.52C-0.08 0.62 0.02 0.68 0.12 0.68C0.18 0.74 0.22 0.7 0.27 0.66C0.31 0.71 0.36 0.7 0.4 0.65C0.43 0.67 0.45 0.68 0.46 0.7Z', fill: 'hair' },
        { d: 'M-0.45 0.19C-0.39 0.17 -0.31 0.2 -0.24 0.26C-0.22 0.31 -0.2 0.35 -0.19 0.39C-0.28 0.33 -0.37 0.3 -0.455 0.3C-0.45 0.26 -0.445 0.22 -0.45 0.19Z', fill: 'hairShade' },
        { d: 'M0.3 0.99C0.2 0.92 0.16 0.82 0.15 0.71', stroke: 'hairShade', w: 0.02 },                // fringe parting
        { d: 'M-0.05 0.97C-0.2 0.9 -0.3 0.74 -0.33 0.5', stroke: 'hairShade', w: 0.018 },
        // ear tucked over the hair
        { d: 'M-0.03 0.36C0.03 0.37 0.06 0.45 0.03 0.52C0 0.57 -0.08 0.57 -0.1 0.5C-0.12 0.43 -0.08 0.36 -0.03 0.36Z', fill: 'skin' },
        { d: 'M-0.035 0.42C-0.005 0.44 0.005 0.49 -0.025 0.52C-0.055 0.5 -0.065 0.45 -0.035 0.42Z', fill: 'skinShade' },
        // scrunchie at the root of the ponytail
        { d: oval(-0.36, 0.99, 0.055, 0.06), fill: 'accent' },
        { d: oval(-0.37, 0.975, 0.03, 0.035), fill: 'accentShade' },
        { swap: 'brow' },
      ],
    },

    // grip point of a held prop, in the hand frame
    grip: [0.1, 0.0],
    handZ: -1,       // hands are drawn under the sleeve cuff

    swaps: {
      // hands: origin = wrist, x along the fingers, +y = thumb side. About 0.23 long.
      hand: {
        relaxed: [
          { d: 'M0 -0.045C0.05 -0.062 0.12 -0.066 0.17 -0.046C0.21 -0.03 0.226 0.012 0.204 0.042C0.19 0.062 0.16 0.062 0.145 0.042C0.12 0.036 0.09 0.042 0.07 0.046C0.04 0.052 0.01 0.046 0 0.04Z', fill: 'skin' },
          { d: 'M0.135 -0.01C0.16 -0.012 0.185 -0.004 0.2 0.01', stroke: 'skinShade', w: 0.012 },
          { d: 'M0.035 0.035C0.07 0.075 0.11 0.09 0.135 0.078C0.15 0.066 0.135 0.05 0.112 0.045C0.09 0.04 0.06 0.028 0.035 0.035Z', fill: 'skinShade' },   // thumb
        ],
        fist: [
          { d: 'M0 -0.045C0.06 -0.068 0.13 -0.064 0.16 -0.025C0.18 0.015 0.16 0.065 0.115 0.07C0.07 0.075 0.03 0.064 0 0.042Z', fill: 'skin' },
          { d: 'M0.16 -0.025C0.13 -0.03 0.12 0.0 0.13 0.03M0.155 0.035C0.13 0.035 0.12 0.05 0.125 0.065', stroke: 'skinShade', w: 0.012 },
          { d: 'M0.04 0.035C0.07 0.058 0.11 0.06 0.135 0.045C0.12 0.03 0.085 0.025 0.04 0.035Z', fill: 'skinShade' },   // thumb across
        ],
        open: [
          { d: 'M0.12 -0.035L0.185 -0.062M0.125 -0.012L0.215 -0.026', stroke: 'skinShade', w: 0.03 },                 // far fingers
          { d: 'M0 -0.045C0.05 -0.056 0.1 -0.056 0.125 -0.042L0.13 0.045C0.08 0.054 0.03 0.054 0 0.04Z', fill: 'skin' }, // palm
          { d: 'M0.12 0.012L0.228 0.014M0.112 0.034L0.212 0.058', stroke: 'skin', w: 0.031 },                          // near fingers
          { d: 'M0.035 0.035L0.095 0.098', stroke: 'skin', w: 0.034 },                                                 // thumb out
        ],
        point: [
          { d: 'M0 -0.045C0.055 -0.064 0.12 -0.06 0.145 -0.025C0.16 0.012 0.145 0.05 0.11 0.055C0.07 0.06 0.03 0.055 0 0.04Z', fill: 'skin' },
          { d: 'M0.12 0.03L0.245 0.036', stroke: 'skin', w: 0.03 },                                                    // index finger
          { d: 'M0.145 -0.025C0.12 -0.025 0.11 0.0 0.12 0.02', stroke: 'skinShade', w: 0.011 },
          { d: 'M0.04 0.03C0.07 0.05 0.1 0.054 0.125 0.045C0.11 0.032 0.08 0.025 0.04 0.03Z', fill: 'skinShade' },
        ],
        grip: [   // fingers wrapped round a handle that runs into the screen
          { d: 'M0 -0.045C0.06 -0.066 0.13 -0.062 0.158 -0.03C0.176 0 0.17 0.04 0.15 0.058C0.12 0.075 0.06 0.07 0 0.042Z', fill: 'skin' },
          { d: 'M0.112 -0.056C0.1 -0.02 0.1 0.03 0.115 0.066M0.14 -0.042C0.13 -0.01 0.13 0.03 0.142 0.062', stroke: 'skinShade', w: 0.01 },
          { d: 'M0.03 0.03C0.06 0.08 0.1 0.095 0.125 0.085C0.135 0.075 0.12 0.06 0.1 0.055C0.08 0.05 0.05 0.03 0.03 0.03Z', fill: 'skinShade' },
        ],
      },
      // eyes (head frame). `look: 1` parts follow the eye darts.
      eye: {
        open: [
          { d: oval(EX, EY, 0.052, 0.079), fill: 'eye', look: 1 },
          { d: oval(EX + 0.016, EY + 0.03, 0.018, 0.02), fill: 'white', look: 1 },
          { d: oval(EX - 0.014, EY - 0.032, 0.008, 0.008), fill: 'white', look: 1 },
          { d: `M${EX - 0.07} ${EY + 0.065}C${EX - 0.04} ${EY + 0.1} ${EX + 0.03} ${EY + 0.1} ${EX + 0.06} ${EY + 0.06}`, stroke: 'eye', w: 0.022 },
          { d: `M${EX - 0.065} ${EY + 0.07}L${EX - 0.1} ${EY + 0.085}`, stroke: 'eye', w: 0.016 },        // lash flick
        ],
        wide: [
          { d: oval(EX, EY + 0.005, 0.064, 0.092), fill: 'white' },
          { d: oval(EX + 0.01, EY, 0.04, 0.058), fill: 'eye', look: 1 },
          { d: oval(EX + 0.022, EY + 0.022, 0.013, 0.015), fill: 'white', look: 1 },
          { d: `M${EX - 0.075} ${EY + 0.08}C${EX - 0.04} ${EY + 0.12} ${EX + 0.03} ${EY + 0.12} ${EX + 0.065} ${EY + 0.08}`, stroke: 'eye', w: 0.02 },
          { d: `M${EX - 0.07} ${EY + 0.088}L${EX - 0.105} ${EY + 0.105}`, stroke: 'eye', w: 0.015 },
        ],
        closed: [
          { d: `M${EX - 0.065} ${EY + 0.01}C${EX - 0.035} ${EY - 0.03} ${EX + 0.03} ${EY - 0.03} ${EX + 0.058} ${EY + 0.01}`, stroke: 'eye', w: 0.022 },
          { d: `M${EX - 0.06} ${EY}L${EX - 0.095} ${EY - 0.012}`, stroke: 'eye', w: 0.016 },
        ],
        happy: [
          { d: `M${EX - 0.062} ${EY - 0.02}C${EX - 0.035} ${EY + 0.045} ${EX + 0.03} ${EY + 0.045} ${EX + 0.056} ${EY - 0.02}`, stroke: 'eye', w: 0.026 },
        ],
        sad: [
          { d: oval(EX, EY - 0.012, 0.05, 0.068), fill: 'eye', look: 1 },
          { d: oval(EX + 0.014, EY - 0.03, 0.013, 0.014), fill: 'white', look: 1 },
          { d: `M${EX - 0.08} ${EY + 0.12}L${EX - 0.08} ${EY + 0.015}C${EX - 0.04} ${EY + 0.045} ${EX + 0.03} ${EY + 0.04} ${EX + 0.07} ${EY + 0.02}L${EX + 0.07} ${EY + 0.12}Z`, fill: 'skin' },
          { d: `M${EX - 0.075} ${EY + 0.018}C${EX - 0.04} ${EY + 0.045} ${EX + 0.03} ${EY + 0.04} ${EX + 0.062} ${EY + 0.022}`, stroke: 'eye', w: 0.02 },
        ],
      },
      brow: {
        neutral: { d: 'M0.245 0.69C0.285 0.715 0.335 0.715 0.375 0.695', stroke: 'hairShade', w: 0.03 },
        up: { d: 'M0.245 0.725C0.285 0.765 0.335 0.765 0.375 0.74', stroke: 'hairShade', w: 0.03 },
        down: { d: 'M0.245 0.72C0.29 0.72 0.34 0.7 0.38 0.665', stroke: 'hairShade', w: 0.032 },
        worried: { d: 'M0.24 0.685C0.28 0.69 0.33 0.715 0.37 0.75', stroke: 'hairShade', w: 0.03 },
      },
      // mouths sit on the front of the face, back corner at about x = 0.37
      mouth: {
        neutral: { d: 'M0.39 0.285C0.42 0.282 0.445 0.288 0.462 0.295', stroke: 'mouth', w: 0.02 },
        smile: [{ d: 'M0.36 0.32C0.385 0.275 0.435 0.265 0.465 0.288', stroke: 'mouth', w: 0.021 },
          { d: 'M0.352 0.335L0.37 0.31', stroke: 'skinShade', w: 0.014 }],
        open: [
          { d: 'M0.468 0.305C0.44 0.312 0.39 0.322 0.362 0.33C0.37 0.26 0.42 0.215 0.462 0.225C0.474 0.25 0.476 0.28 0.468 0.305Z', fill: 'mouth' },
          { d: 'M0.395 0.26C0.41 0.235 0.44 0.228 0.46 0.235C0.462 0.25 0.45 0.262 0.43 0.266C0.415 0.268 0.4 0.266 0.395 0.26Z', fill: 'tongue' },
          { d: 'M0.468 0.305C0.44 0.31 0.41 0.316 0.39 0.32L0.392 0.305C0.42 0.302 0.45 0.298 0.47 0.293Z', fill: 'white' },
        ],
        o: [{ d: oval(0.443, 0.275, 0.024, 0.034), fill: 'mouth' }, { d: oval(0.446, 0.262, 0.012, 0.012), fill: 'tongue' }],
        worried: { d: 'M0.37 0.27C0.39 0.292 0.41 0.293 0.43 0.282C0.445 0.274 0.456 0.28 0.466 0.29', stroke: 'mouth', w: 0.02 },
        grit: [
          { d: 'M0.37 0.315L0.468 0.31L0.468 0.255L0.375 0.262Z', fill: 'mouth' },
          { d: 'M0.38 0.305L0.462 0.302L0.462 0.265L0.384 0.27Z', fill: 'white' },
          { d: 'M0.38 0.286L0.462 0.284', stroke: 'skinShade', w: 0.008 },
        ],
        sad: { d: 'M0.36 0.26C0.385 0.295 0.435 0.302 0.465 0.29', stroke: 'mouth', w: 0.02 },
      },
    },

    // spring chains (simulated). bone: head|neck|torso|pelvis; at: anchor in that bone's frame;
    // rest: direction in degrees in the bone frame (180 = straight back, 270 = straight down);
    // seg: segment lengths; width: one per point; curl: extra bend per segment in degrees;
    // stiff: 0 = hangs and streams freely, 1 = rigid; limit: max swing from rest (deg); shade: width
    // of the shade strip (0..1); layer: which draw layer (rig.js LAYERS). More fields: AUTHORING.md.
    chains: {
      ponytail: { bone: 'head', at: [-0.38, 0.98], rest: 165, curl: 24, seg: [0.15, 0.15, 0.13, 0.11],
        width: [0.11, 0.2, 0.19, 0.14, 0.04], fill: 'hair', shade: 0.45, shadeSide: 1, layer: 'back', stiff: 0.55, tip: 0.02 },
      scarf: { bone: 'torso', at: [-0.15, 0.66], rest: 228, curl: 4, seg: [0.13, 0.13, 0.13, 0.11],
        width: [0.13, 0.12, 0.12, 0.12, 0.13], fill: 'accent', shade: 0.4, shadeSide: 1, layer: 'back', stiff: 0.15, tip: 0 },
    },
  };
});
