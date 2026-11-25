// skins/kai.js - Kai, a small ten-year-old boy: messy dark hair with a cowlick, a knitted red
// scarf (knot in front, long tail behind), a blue tunic with a belt and a sword strap, short
// sleeves and leather bracers, oatmeal trousers, brown boots, a wooden sword on his back.
// Format: see skins/tess.js (top comment). Drawn with a thin ink outline (outline > 0).
(function (root, factory) {
  const skin = factory();
  if (typeof module === 'object' && module.exports) module.exports = skin;
  else { root.CharSkins = root.CharSkins || {}; root.CharSkins[skin.name] = skin; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const oval = (x, y, rx, ry) => `M${x - rx} ${y}A${rx} ${ry} 0 1 0 ${x + rx} ${y}A${rx} ${ry} 0 1 0 ${x - rx} ${y}Z`;
  const EX = 0.34, EY = 0.52;          // eye centre (head frame)
  const D2R = Math.PI / 180;
  // sword on the back: guard point and angle (torso frame); the hilt points up and back
  const SG = [-0.27, 0.53], SA = 140;
  const gx = SG[0] + 0.08 * Math.cos((SA + 90) * D2R), gy = SG[1] + 0.08 * Math.sin((SA + 90) * D2R);

  return {
    name: 'kai',
    // small for his age: a big head, short torso and limbs
    proportions: {
      head: 1, neck: 0.07, torso: 0.6, shoulderDrop: 0.12,
      upperArm: 0.34, foreArm: 0.32, thigh: 0.5, shin: 0.46,
      ankleHeight: 0.1,
      heel: [-0.12, -0.1], toe: [0.34, -0.1],
      footGround: [[-0.13, -0.1], [0.4, -0.1], [-0.145, -0.07], [0.43, -0.075], [0.44, -0.04], [0.42, 0.0]],
      farShoulder: [-0.05, -0.015],
      radius: { hip: 0.16, knee: 0.08, hem: 0.12, shoulder: 0.085, elbow: 0.065, wrist: 0.052, neck: 0.068 },
    },
    headTop: 1.22,
    outline: 0.022,
    farShade: 0.82,
    palette: {
      skin: '#f2c29b', skinShade: '#d99b78',
      hair: '#2d2433', hairShade: '#1a141f', hairLight: '#50425c',
      top: '#3d6fb8', topShade: '#2b5392', trim: '#efe0b0',
      bottom: '#d2bd94', bottomShade: '#ad9770',
      shoe: '#8c5a35', shoeShade: '#6a4127', shoeLight: '#b07a4c', sole: '#43291b',
      belt: '#6b4226', buckle: '#e8b84a', strap: '#7d4f2c', strapShade: '#5e3a20',
      accent: '#d4372d', accentShade: '#a5261f', stripe: '#f06b55',
      wood: '#cf9f62', woodShade: '#a87a45', grip: '#5a3720',
      eye: '#22181c', white: '#ffffff', mouth: '#6e2430', tongue: '#e0707a', cheek: '#ee9a86', freckle: '#c98466',
      outline: '#2a1c22', shade: 0.82,
    },

    parts: {
      // ---- arms: short tunic sleeve over a bare arm; leather bracer on the forearm ----
      // soft limbs: `arm` and `leg` are whole limbs, one continuous tube from shoulder (hip) through
      // elbow (knee) to wrist (ankle) with one unbroken outline. tube = radii at the three joints;
      // from/to = fractions of the limb length (sleeve 0..0.31, bracer 0.76..0.98).
      arm: [
        { tube: [0.07, 0.06, 0.05], fill: 'skin' },
        { tube: [0.07, 0.06, 0.05], inset: -0.35, fill: 'skinShade' },
        { tube: [0.097, 0.088, 0.08], to: 0.31, flat: 'end', fill: 'top' },
        { tube: [0.097, 0.088, 0.08], to: 0.31, flat: 'end', inset: -0.38, fill: 'topShade' },
        { tube: [0.07, 0.07, 0.062], from: 0.76, to: 0.98, flat: 'both', fill: 'strap' },
        { tube: [0.07, 0.07, 0.062], from: 0.76, to: 0.98, flat: 'both', inset: -0.4, fill: 'strapShade' },
      ],
      // per-bone parts still work and draw on top of the tube: details that follow one bone
      upperArm: [{ d: 'M0.6 -0.26Q0.585 0 0.6 0.26', stroke: 'trim', w: 0.06 }],
      foreArm: [{ d: 'M0.62 -0.2L0.7 0.2M0.74 -0.2L0.82 0.2', stroke: 'trim', w: 0.035 }],     // lacing
      // ---- legs: oatmeal trousers tucked into brown boots with a folded cuff ----
      leg: [
        { tube: [0.145, 0.09, 0.064], fill: 'bottom' },
        { tube: [0.145, 0.09, 0.064], inset: -0.36, from: 0.1, fill: 'bottomShade' },
        { tube: [0.09, 0.084, 0.076], from: 0.77, to: 1.01, flat: 'start', fill: 'shoe' },
        { tube: [0.09, 0.084, 0.076], from: 0.8, to: 1.01, flat: 'start', inset: -0.4, fill: 'shoeShade' },
      ],
      shin: [
        { d: 'M0.47 -0.25Q0.45 0 0.47 0.25L0.62 0.23Q0.605 0 0.62 -0.23Z', fill: 'shoeLight' },   // folded cuff
      ],
      foot: [
        { d: 'M-0.105 0.12L-0.125 -0.02C-0.13 -0.06 -0.12 -0.075 -0.1 -0.075L0.3 -0.075C0.39 -0.075 0.435 -0.055 0.435 -0.015C0.435 0.035 0.38 0.065 0.3 0.07C0.21 0.075 0.12 0.08 0.075 0.105L0.065 0.12Z', fill: 'shoe' },
        { d: 'M-0.105 0.12L-0.125 -0.02C-0.13 -0.06 -0.12 -0.075 -0.1 -0.075L-0.03 -0.075C-0.05 -0.02 -0.05 0.06 -0.035 0.12Z', fill: 'shoeShade' },
        { d: 'M0.1 0.08L0.15 0.04M0.15 0.075L0.2 0.035', stroke: 'shoeShade', w: 0.016 },         // laces
        { d: 'M-0.135 -0.055L0.41 -0.055C0.445 -0.055 0.45 -0.08 0.445 -0.1L-0.125 -0.1C-0.14 -0.09 -0.145 -0.07 -0.135 -0.055Z', fill: 'sole' },
      ],
      pelvis: { d: 'M-0.19 0.06C-0.21 -0.09 -0.15 -0.19 0 -0.2C0.14 -0.19 0.2 -0.11 0.19 0.03C0.12 0.11 -0.12 0.11 -0.19 0.06Z', fill: 'bottom' },
      neck: [
        { d: 'M-0.072 -0.05L-0.078 0.17C-0.03 0.21 0.05 0.21 0.072 0.17L0.068 -0.05Z', fill: 'skin' },
        { d: 'M-0.072 -0.05L-0.078 0.17C-0.06 0.19 -0.04 0.2 -0.02 0.2L-0.015 -0.05Z', fill: 'skinShade' },
      ],
      // ---- torso: tunic, back shade, hem trim, sword strap, belt, scarf wrap and knot ----
      torso: [
        { d: 'M0.14 0.6C0.22 0.5 0.25 0.36 0.25 0.22C0.26 0.1 0.27 -0.05 0.28 -0.2L0.29 -0.25C0.15 -0.29 -0.12 -0.29 -0.29 -0.25C-0.27 -0.1 -0.25 0.05 -0.25 0.2C-0.25 0.38 -0.24 0.52 -0.17 0.6C-0.08 0.65 0.08 0.65 0.14 0.6Z', fill: 'top' },
        { d: 'M-0.17 0.6C-0.24 0.52 -0.25 0.38 -0.25 0.2C-0.25 0.05 -0.27 -0.1 -0.29 -0.25L-0.2 -0.265C-0.19 -0.1 -0.17 0.05 -0.165 0.2C-0.16 0.36 -0.15 0.5 -0.12 0.61Z', fill: 'topShade' },
        { d: 'M0.282 -0.215C0.15 -0.255 -0.12 -0.255 -0.282 -0.215', stroke: 'trim', w: 0.028 },
        { d: 'M0.06 0.6L0.16 0.57L-0.21 0.04L-0.26 0.12Z', fill: 'strap' },                     // sword strap
        { d: 'M-0.255 -0.005C-0.1 -0.02 0.12 -0.02 0.268 -0.01L0.266 0.075C0.12 0.065 -0.1 0.065 -0.252 0.08Z', fill: 'belt' },
        { d: 'M0.15 -0.028L0.236 -0.028L0.236 0.092L0.15 0.092Z', fill: 'buckle' },
        { d: 'M0.17 -0.004L0.216 -0.004L0.216 0.068L0.17 0.068Z', fill: 'belt' },
        // scarf: wrap, underside shade, knit stripe, knot and a short front tail
        { d: 'M-0.21 0.54C-0.25 0.68 -0.12 0.78 0.04 0.77C0.16 0.76 0.23 0.68 0.2 0.57C0.1 0.51 -0.12 0.5 -0.21 0.54Z', fill: 'accent' },
        { d: 'M-0.21 0.54C-0.12 0.5 0.1 0.51 0.2 0.57C0.205 0.6 0.205 0.62 0.2 0.64C0.1 0.58 -0.1 0.58 -0.205 0.61Z', fill: 'accentShade' },
        { d: 'M-0.21 0.67C-0.08 0.63 0.1 0.64 0.2 0.69', stroke: 'stripe', w: 0.022 },
        { d: 'M0.19 0.58C0.25 0.5 0.26 0.42 0.23 0.34L0.15 0.36C0.18 0.43 0.17 0.5 0.13 0.56Z', fill: 'accent' },
        { d: 'M0.2 0.44L0.155 0.45', stroke: 'stripe', w: 0.02 },
        { d: oval(0.19, 0.59, 0.065, 0.058), fill: 'accentShade' },
      ],
      // ---- head ----
      head: [
        { d: 'M-0.12 0.1C0 0.03 0.2 0.02 0.32 0.09C0.4 0.14 0.44 0.22 0.45 0.3C0.455 0.34 0.46 0.36 0.47 0.38C0.5 0.39 0.555 0.41 0.55 0.46C0.545 0.5 0.5 0.51 0.48 0.53C0.49 0.7 0.44 0.86 0.3 0.96C0.14 1.06 -0.18 1.06 -0.34 0.92C-0.5 0.78 -0.52 0.52 -0.42 0.36C-0.34 0.24 -0.22 0.14 -0.12 0.1Z', fill: 'skin' },
        { d: 'M-0.12 0.1C0 0.03 0.2 0.02 0.32 0.09C0.2 0.08 0.05 0.1 -0.06 0.16Z', fill: 'skinShade' },
        { d: oval(0.26, 0.345, 0.07, 0.04), fill: 'cheek', opacity: 0.7 },
        { d: oval(0.2, 0.41, 0.011, 0.011) + oval(0.245, 0.425, 0.011, 0.011) + oval(0.29, 0.405, 0.011, 0.011) + oval(0.225, 0.385, 0.009, 0.009), fill: 'freckle' },
        { swap: 'mouth' },
        { swap: 'eye' },
        // messy hair: spiky fringe, tufts sticking out at the back and the top
        { d: 'M0.46 1.06Q0.56 0.98 0.55 0.76Q0.48 0.8 0.43 0.84Q0.44 0.78 0.4 0.73Q0.34 0.8 0.28 0.84Q0.27 0.78 0.24 0.74Q0.17 0.78 0.11 0.8Q0.06 0.68 0.07 0.52Q-0.02 0.56 -0.08 0.62Q-0.2 0.5 -0.22 0.3Q-0.26 0.22 -0.28 0.15Q-0.32 0.22 -0.38 0.25Q-0.42 0.18 -0.47 0.13Q-0.48 0.26 -0.52 0.36Q-0.62 0.42 -0.69 0.48Q-0.62 0.56 -0.58 0.62Q-0.67 0.72 -0.71 0.82Q-0.6 0.83 -0.53 0.88Q-0.57 1.0 -0.53 1.09Q-0.43 1.05 -0.35 1.06Q-0.3 1.18 -0.2 1.24Q-0.14 1.15 -0.06 1.12Q0.04 1.22 0.15 1.23Q0.18 1.12 0.26 1.08Q0.38 1.13 0.46 1.06Z', fill: 'hair' },
        { d: 'M-0.22 0.3Q-0.26 0.22 -0.28 0.15Q-0.32 0.22 -0.38 0.25Q-0.42 0.18 -0.47 0.13Q-0.48 0.26 -0.52 0.36Q-0.62 0.42 -0.69 0.48Q-0.5 0.5 -0.37 0.45Q-0.27 0.4 -0.22 0.3Z', fill: 'hairShade' },
        { d: 'M-0.32 0.98Q-0.12 1.07 0.1 1.01', stroke: 'hairLight', w: 0.026 },
        { d: 'M-0.46 0.74Q-0.4 0.87 -0.26 0.92', stroke: 'hairLight', w: 0.022 },
        { d: 'M0.33 0.96Q0.4 0.92 0.44 0.86', stroke: 'hairLight', w: 0.02 },
        // ear over the hair
        { d: 'M-0.04 0.35C0.04 0.36 0.07 0.46 0.035 0.54C0.005 0.6 -0.09 0.6 -0.115 0.51C-0.135 0.43 -0.095 0.35 -0.04 0.35Z', fill: 'skin' },
        { d: 'M-0.04 0.41C-0.005 0.43 0.005 0.5 -0.03 0.53C-0.065 0.51 -0.075 0.45 -0.04 0.41Z', fill: 'skinShade' },
        { swap: 'brow' },
      ],
    },

    grip: [0.1, 0.0],
    handZ: -1,

    swaps: {
      hand: {
        relaxed: [
          { d: 'M0 -0.048C0.05 -0.066 0.125 -0.07 0.175 -0.048C0.215 -0.03 0.232 0.014 0.21 0.045C0.195 0.066 0.165 0.066 0.15 0.045C0.125 0.04 0.092 0.045 0.072 0.05C0.04 0.056 0.01 0.05 0 0.043Z', fill: 'skin' },
          { d: 'M0.035 0.037C0.07 0.08 0.112 0.095 0.138 0.082C0.154 0.07 0.138 0.053 0.115 0.048C0.092 0.043 0.062 0.03 0.035 0.037Z', fill: 'skinShade' },
        ],
        fist: [
          { d: 'M0 -0.05C0.065 -0.075 0.14 -0.07 0.172 -0.028C0.192 0.016 0.172 0.072 0.122 0.078C0.074 0.083 0.03 0.07 0 0.046Z', fill: 'skin' },
          { d: 'M0.17 -0.028C0.14 -0.034 0.128 0.0 0.138 0.033M0.165 0.038C0.14 0.038 0.128 0.055 0.133 0.072', stroke: 'skinShade', w: 0.014 },
          { d: 'M0.04 0.038C0.075 0.064 0.118 0.066 0.145 0.05C0.128 0.033 0.09 0.027 0.04 0.038Z', fill: 'skinShade' },
        ],
        open: [
          { d: 'M0.12 -0.035L0.19 -0.066M0.125 -0.012L0.222 -0.028', stroke: 'skinShade', w: 0.032 },
          { d: 'M0 -0.048C0.05 -0.06 0.1 -0.06 0.128 -0.045L0.133 0.048C0.08 0.058 0.03 0.058 0 0.043Z', fill: 'skin' },
          { d: 'M0.12 0.012L0.234 0.014M0.112 0.036L0.218 0.062', stroke: 'skin', w: 0.033 },
          { d: 'M0.035 0.037L0.098 0.102', stroke: 'skin', w: 0.036 },
        ],
        point: [
          { d: 'M0 -0.048C0.058 -0.068 0.125 -0.064 0.15 -0.027C0.166 0.013 0.15 0.053 0.114 0.058C0.073 0.063 0.03 0.058 0 0.043Z', fill: 'skin' },
          { d: 'M0.125 0.032L0.252 0.038', stroke: 'skin', w: 0.032 },
          { d: 'M0.04 0.032C0.072 0.053 0.104 0.057 0.13 0.048C0.114 0.034 0.083 0.027 0.04 0.032Z', fill: 'skinShade' },
        ],
        grip: [
          { d: 'M0 -0.048C0.062 -0.07 0.135 -0.066 0.164 -0.032C0.183 0 0.176 0.043 0.156 0.062C0.125 0.08 0.062 0.075 0 0.045Z', fill: 'skin' },
          { d: 'M0.116 -0.06C0.104 -0.02 0.104 0.032 0.12 0.07M0.146 -0.045C0.135 -0.01 0.135 0.032 0.148 0.066', stroke: 'skinShade', w: 0.011 },
        ],
      },
      eye: {
        open: [
          { d: oval(EX, EY, 0.05, 0.072), fill: 'eye', look: 1 },
          { d: oval(EX + 0.017, EY + 0.028, 0.018, 0.02), fill: 'white', look: 1 },
          { d: oval(EX - 0.014, EY - 0.03, 0.008, 0.008), fill: 'white', look: 1 },
          { d: `M${EX - 0.062} ${EY + 0.06}Q${EX} ${EY + 0.105} ${EX + 0.058} ${EY + 0.058}`, stroke: 'eye', w: 0.026 },
        ],
        wide: [
          { d: oval(EX, EY + 0.008, 0.066, 0.094), fill: 'white' },
          { d: oval(EX + 0.01, EY, 0.036, 0.052), fill: 'eye', look: 1 },
          { d: oval(EX + 0.021, EY + 0.02, 0.012, 0.014), fill: 'white', look: 1 },
          { d: `M${EX - 0.07} ${EY + 0.085}Q${EX} ${EY + 0.135} ${EX + 0.066} ${EY + 0.082}`, stroke: 'eye', w: 0.022 },
        ],
        narrow: [   // focused, determined: a flat heavy upper lid over the pupil
          { d: oval(EX, EY - 0.008, 0.05, 0.062), fill: 'eye', look: 1 },
          { d: oval(EX + 0.016, EY + 0.004, 0.015, 0.015), fill: 'white', look: 1 },
          { d: `M${EX - 0.08} ${EY + 0.1}L${EX - 0.08} ${EY + 0.028}L${EX + 0.07} ${EY + 0.012}L${EX + 0.07} ${EY + 0.1}Z`, fill: 'skin' },
          { d: `M${EX - 0.064} ${EY + 0.028}L${EX + 0.062} ${EY + 0.014}`, stroke: 'eye', w: 0.028 },
        ],
        closed: [
          { d: `M${EX - 0.06} ${EY + 0.012}Q${EX} ${EY - 0.035} ${EX + 0.056} ${EY + 0.012}`, stroke: 'eye', w: 0.026 },
        ],
        happy: [
          { d: `M${EX - 0.058} ${EY - 0.02}Q${EX} ${EY + 0.07} ${EX + 0.054} ${EY - 0.02}`, stroke: 'eye', w: 0.03 },
        ],
        sad: [
          { d: oval(EX, EY - 0.012, 0.048, 0.064), fill: 'eye', look: 1 },
          { d: oval(EX + 0.014, EY - 0.03, 0.013, 0.014), fill: 'white', look: 1 },
          { d: `M${EX - 0.08} ${EY + 0.12}L${EX - 0.08} ${EY + 0.012}Q${EX} ${EY + 0.05} ${EX + 0.07} ${EY + 0.022}L${EX + 0.07} ${EY + 0.12}Z`, fill: 'skin' },
          { d: `M${EX - 0.072} ${EY + 0.016}Q${EX} ${EY + 0.05} ${EX + 0.062} ${EY + 0.024}`, stroke: 'eye', w: 0.022 },
        ],
      },
      // thick, expressive brows
      brow: {
        neutral: { d: 'M0.27 0.66Q0.33 0.69 0.41 0.67', stroke: 'hair', w: 0.048 },
        up: { d: 'M0.27 0.7Q0.33 0.75 0.41 0.72', stroke: 'hair', w: 0.048 },
        down: { d: 'M0.26 0.695Q0.33 0.685 0.42 0.63', stroke: 'hair', w: 0.052 },
        worried: { d: 'M0.27 0.645Q0.33 0.665 0.4 0.715', stroke: 'hair', w: 0.046 },
      },
      mouth: {
        neutral: { d: 'M0.37 0.28Q0.41 0.276 0.442 0.29', stroke: 'mouth', w: 0.022 },
        smile: [{ d: 'M0.34 0.315Q0.39 0.25 0.446 0.29', stroke: 'mouth', w: 0.024 },
          { d: 'M0.333 0.335L0.35 0.308', stroke: 'skinShade', w: 0.015 }],
        open: [
          { d: 'M0.452 0.31C0.42 0.32 0.375 0.325 0.345 0.332C0.35 0.255 0.4 0.205 0.447 0.215C0.458 0.25 0.46 0.28 0.452 0.31Z', fill: 'mouth' },
          { d: 'M0.375 0.26C0.39 0.232 0.425 0.222 0.445 0.23C0.447 0.246 0.435 0.258 0.413 0.262C0.398 0.265 0.382 0.264 0.375 0.26Z', fill: 'tongue' },
          { d: 'M0.452 0.31C0.42 0.316 0.39 0.322 0.37 0.326L0.372 0.31C0.4 0.306 0.43 0.302 0.454 0.297Z', fill: 'white' },
        ],
        o: [{ d: oval(0.425, 0.272, 0.025, 0.036), fill: 'mouth' }, { d: oval(0.428, 0.259, 0.012, 0.012), fill: 'tongue' }],
        worried: { d: 'M0.355 0.27Q0.38 0.295 0.405 0.282Q0.43 0.27 0.448 0.29', stroke: 'mouth', w: 0.021 },
        grit: [
          { d: 'M0.355 0.315L0.452 0.31L0.452 0.252L0.36 0.26Z', fill: 'mouth' },
          { d: 'M0.365 0.305L0.446 0.302L0.446 0.262L0.369 0.268Z', fill: 'white' },
          { d: 'M0.365 0.284L0.446 0.282', stroke: 'skinShade', w: 0.008 },
        ],
        sad: { d: 'M0.35 0.262Q0.4 0.3 0.448 0.288', stroke: 'mouth', w: 0.021 },
      },
    },

    // chains, drawn in this order. The sword pieces are rigid (stiff: 1).
    chains: {
      scarf: { bone: 'torso', at: [-0.17, 0.63], rest: 222, curl: 5, seg: [0.14, 0.14, 0.13, 0.12], width: [0.14, 0.13, 0.13, 0.12, 0.12],
        fill: 'accent', shade: 0.4, shadeSide: 1, layer: 'back', stiff: 0.1, tip: 0,
        end: { d: 'M0 -0.05L0.07 -0.065M0 0L0.08 0M0 0.05L0.07 0.065', stroke: 'accent', w: 0.022 } },
      blade: { bone: 'torso', at: SG, rest: SA + 180, seg: [0.3, 0.3], width: [0.085, 0.085, 0.07], fill: 'wood', shade: 0.35, shadeSide: 1, layer: 'back', stiff: 1, tip: 0.035 },
      hilt: { bone: 'torso', at: SG, rest: SA, seg: [0.12, 0.12], width: [0.055, 0.05, 0.05], fill: 'grip', layer: 'back', stiff: 1, tip: 0,
        end: { d: oval(0.02, 0, 0.045, 0.045), fill: 'wood' } },
      guard: { bone: 'torso', at: [gx, gy], rest: SA - 90, seg: [0.16], width: [0.055, 0.055], fill: 'woodShade', layer: 'back', stiff: 1, tip: 0.012 },
      cowlick: { bone: 'head', at: [-0.08, 1.13], rest: 75, curl: -40, seg: [0.09, 0.08], width: [0.08, 0.05, 0.015], fill: 'hair', layer: 'head', stiff: 0.45, tip: 0.02 },
      // separate hair tufts at the back of the head: each one is its own spring chain
      tuftHi: { bone: 'head', at: [-0.5, 0.86], rest: 160, curl: 22, seg: [0.11, 0.09], width: [0.12, 0.08, 0.02], fill: 'hair', layer: 'back', stiff: 0.4, limit: 70, tip: 0.03 },
      tuftLo: { bone: 'head', at: [-0.56, 0.6], rest: 200, curl: 18, seg: [0.1, 0.08], width: [0.11, 0.07, 0.02], fill: 'hairShade', layer: 'back', stiff: 0.35, limit: 70, tip: 0.03 },
      // a leather pouch bouncing on a short strap at the back of the belt (end drawn upright: endUpright)
      pouch: { bone: 'torso', at: [-0.24, 0.05], rest: 262, seg: [0.1], width: [0.035, 0.03], fill: 'strap', layer: 'back', stiff: 0.25, limit: 60, tip: 0,
        endUpright: true, end: [{ d: 'M-0.09 0.02L0.09 0.02L0.085 -0.13Q0 -0.17 -0.085 -0.13Z', fill: 'belt' }, { d: 'M-0.09 0.02L0.09 0.02L0.08 -0.04L-0.08 -0.04Z', fill: 'strapShade' }] },
      // the tunic's lower edge is a wide, short chain: it sways and flares as he moves
      hem: { bone: 'torso', at: [0.0, -0.12], rest: 268, seg: [0.08, 0.08], width: [0.53, 0.56, 0.6], fill: 'top', shade: 0.3, shadeSide: 1, layer: 'torso', stiff: 0.65, limit: 18, tip: 0,
        endUpright: true, end: { d: 'M-0.29 0.01L0.29 0.01', stroke: 'trim', w: 0.028 } },
    },
    // spring overlap on the body (0 = off, 1 = default, up to 2): arms lag and settle, the head
    // nods on landings, the torso squashes on impact and bends against sudden starts and stops
    springs: { arms: 1, head: 1, torso: 1 },
  };
});
