(function (g) {
  (g.CharSkins = g.CharSkins || {}).skye = { name: 'skye', extends: 'mannequin',
    build:   { heads: 6.2, chest: 0.7, waist: 0.55, hips: 0.66, arm: 0.1, leg: 0.17 },
    motion:  { energy: 0.45, weight: 0.3, posture: 0.5 },
    palette: { skin: '#f0c4a4', suit: '#f0c4a4', suitShade: '#d79f80', hair: '#1fb5a8', hoodie: '#8a8d94', jeans: '#1d1d24', shoe: '#f4f4f4', pack: '#7b3fb8', cord: '#222222', phones: '#222222' },
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
