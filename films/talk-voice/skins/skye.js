(function (g) {
  var E = function (x, y, a, b) { return 'M' + (x - a) + ' ' + y + 'A' + a + ' ' + b + ' 0 1 0 ' + (x + a) + ' ' + y + 'A' + a + ' ' + b + ' 0 1 0 ' + (x - a) + ' ' + y + 'Z'; };
  var L = function (x, y, a, c) { return 'M' + (x - a) + ' ' + y + 'Q' + x + ' ' + (y + c) + ' ' + (x + a) + ' ' + y; };
  var X = 0.25, Y = 0.21;
  var S = 1.35; var M = function (a, b, tongue) { a *= S; b *= S; var r = [{ d: E(X, Y, a, b), fill: 'mouthIn' }]; if (tongue) r.push({ d: E(X, Y - b * 0.5, a * 0.6, b * 0.4), fill: 'tongue' }); return r; };
  var T = function (a, b) { return { d: 'M' + (X - a) + ' ' + (Y + b) + 'L' + (X + a) + ' ' + (Y + b) + 'L' + (X + a) + ' ' + (Y + b - 0.02) + 'L' + (X - a) + ' ' + (Y + b - 0.02) + 'Z', fill: 'white' }; };
  var mouth = {
    rest: { d: L(X, Y, 0.05, -0.008), stroke: 'mouth', w: 0.022 },
    mbp: { d: L(X, Y, 0.055, 0), stroke: 'mouth', w: 0.034 },
    ah: M(0.055, 0.07, 1), ee: [{ d: E(X, Y, 0.08, 0.028), fill: 'mouthIn' }, T(0.07, 0.02)],
    oh: M(0.045, 0.06, 1), oo: M(0.025, 0.03), wq: M(0.034, 0.04),
    fv: [{ d: L(X, Y, 0.05, 0), stroke: 'mouth', w: 0.022 }, { d: 'M' + (X - 0.04) + ' ' + Y + 'L' + (X + 0.04) + ' ' + Y + 'L' + (X + 0.035) + ' ' + (Y - 0.03) + 'L' + (X - 0.035) + ' ' + (Y - 0.03) + 'Z', fill: 'white' }],
    l: [{ d: E(X, Y, 0.05, 0.04), fill: 'mouthIn' }, { d: E(X, Y + 0.02, 0.025, 0.014), fill: 'tongue' }],
    neutral: { d: L(X, Y, 0.045, -0.006), stroke: 'mouth', w: 0.022 },
    smile: { d: L(X, Y + 0.01, 0.06, -0.05), stroke: 'mouth', w: 0.024 },
    open: M(0.05, 0.05, 1), o: M(0.032, 0.045),
    worried: { d: 'M' + (X - 0.05) + ' ' + Y + 'Q' + (X - 0.02) + ' ' + (Y + 0.03) + ' ' + X + ' ' + Y + 'T' + (X + 0.05) + ' ' + Y, stroke: 'mouth', w: 0.022 },
    grit: [{ d: E(X, Y, 0.065, 0.03), fill: 'mouthIn' }, T(0.06, 0.02)],
    sad: { d: L(X, Y - 0.01, 0.05, 0.05), stroke: 'mouth', w: 0.024 } };
  var eyeAt = function (a, b) { return [{ d: E(0.3, 0.55, a, b), fill: 'eye', look: 1 }, { d: E(0.315, 0.56, a * 0.4, b * 0.4), fill: 'white', look: 1 }]; };
  var eye = { open: eyeAt(0.05, 0.065), wide: eyeAt(0.06, 0.085), narrow: eyeAt(0.05, 0.03),
    closed: { d: 'M0.25 0.55Q0.3 0.51 0.35 0.55', stroke: 'eye', w: 0.022 }, happy: { d: 'M0.25 0.54Q0.3 0.6 0.35 0.54', stroke: 'eye', w: 0.026 },
    sad: [{ d: E(0.3, 0.54, 0.05, 0.05), fill: 'eye', look: 1 }, { d: 'M0.24 0.58Q0.3 0.6 0.36 0.54', stroke: 'suitShade', w: 0.03 }] };
  var brow = { neutral: { d: 'M0.24 0.68Q0.3 0.7 0.37 0.68', stroke: 'hair', w: 0.03 }, up: { d: 'M0.24 0.73Q0.3 0.77 0.37 0.74', stroke: 'hair', w: 0.03 },
    down: { d: 'M0.23 0.72Q0.3 0.7 0.38 0.65', stroke: 'hair', w: 0.034 }, worried: { d: 'M0.24 0.66Q0.3 0.69 0.37 0.73', stroke: 'hair', w: 0.03 } };
  (g.CharSkins = g.CharSkins || {}).skye = { name: 'skye', extends: 'mannequin',
    build:   { heads: 6.2, chest: 0.7, waist: 0.55, hips: 0.66, arm: 0.1, leg: 0.17 },
    motion:  { energy: 0.45, weight: 0.3, posture: 0.1 },
    palette: { white: '#ffffff', mouth: '#9a3d4a', mouthIn: '#5a1a24', tongue: '#e0707c', eye: '#1d1d24', skin: '#f0c4a4', suit: '#f0c4a4', suitShade: '#d79f80', hair: '#1fb5a8', hoodie: '#8a8d94', jeans: '#1d1d24', shoe: '#f4f4f4', pack: '#7b3fb8', cord: '#222222', phones: '#222222' },
    swaps: { mouth: mouth, eye: eye, brow: brow },
    parts:   {
      hairBack: [ { d: 'M-0.42 0.5C-0.5 0.9 -0.3 1.05 0 1.05C0.3 1.05 0.48 0.9 0.45 0.62C0.3 0.8 0 0.75 -0.2 0.55Z', fill: 'hair' } ],
      hair: [
        { d: 'M-0.45 0.5C-0.52 1 -0.2 1.08 0.1 1.06C0.4 1.03 0.52 0.85 0.5 0.62C0.45 0.5 0.4 0.5 0.36 0.6C0.3 0.75 0.1 0.82 -0.1 0.78C-0.3 0.72 -0.4 0.6 -0.45 0.5Z', fill: 'hair' },
        { d: 'M-0.2 0C-0.2 -0.2 0.2 -0.2 0.2 0', stroke: 'phones', w: 0.05 },
        { d: 'M-0.25 0.05L-0.05 0.05L-0.05 -0.15L-0.25 -0.15Z', fill: 'phones' },
        { d: 'M0.5 0.62C0.46 0.5 0.4 0.42 0.34 0.38C0.3 0.5 0.3 0.6 0.36 0.66Z', fill: 'hair' } ],
      torso: [
        { cover: [-0.08, 1], loose: 0.06, fill: 'hoodie' },
        { d: 'M0.0 0.35L0.4 0.35L0.36 0.7L0.04 0.7Z', fill: 'hoodieShade' },
        { d: 'M-0.35 1.5C-0.5 1.6 -0.4 1.8 -0.2 1.75C0 1.7 0.1 1.6 0.1 1.5Z', fill: 'hoodieShade' } ],
      pelvis: [ { d: 'M-0.4 0.1L0.4 0.1L0.4 -0.15L-0.4 -0.15Z', fill: 'jeans' } ],
      arm: { cover: [0, 0.95], loose: 0.04, fill: 'hoodie' },
      leg: [ { cover: [0, 1], loose: 0.01, fill: 'jeans' },
             { cover: [0.82, 1.03], loose: 0.05, flat: 'start', fill: 'shoe' } ]
    },
    chains:  {
      locks: { bone: 'head', at: [-0.3, 0.6], rest: 250, seg: [0.35, 0.3, 0.25],
        width: [0.34, 0.34, 0.26, 0.14], fill: 'hair', layer: 'back', stiff: 0.2 },
      pack: { bone: 'torso', at: [-0.35, 1.2], rest: 180, seg: [0.07], width: [0.1, 0.1], fill: 'pack', layer: 'back', stiff: 0.5,
        end: [ { d: 'M0.05 0.1C-0.25 0.1 -0.4 0 -0.4 -0.2L-0.4 -0.7C-0.4 -0.85 -0.25 -0.9 0.05 -0.9Z', fill: 'pack' }, { d: 'M-0.05 -0.45L-0.3 -0.45L-0.3 -0.75L-0.05 -0.75Z', fill: 'packShade' } ], endUpright: true }
    } };
})(typeof self !== 'undefined' ? self : this);
