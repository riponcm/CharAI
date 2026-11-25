(function (g) {
  var btn = function (x, y) { return { d: 'M' + (x-0.025) + ' ' + y + 'A0.025 0.025 0 1 0 ' + (x+0.025) + ' ' + y + 'A0.025 0.025 0 1 0 ' + (x-0.025) + ' ' + y + 'Z', fill: 'gold' }; };
  (g.CharSkins = g.CharSkins || {}).captain = { name: 'captain', extends: 'mannequin',
    build:   { heads: 6, belly: 0.62, chest: 1.05, waist: 1.0, hips: 0.98, seat: 0.1, arm: 0.15, leg: 0.26, neck: 0.14 },
    motion:  { age: 'elder', weight: 0.9, energy: 0.3, posture: 0.6 },
    palette: { skin: '#d49a78', hair: '#f2f2f0', suit: '#1c2f55', shoe: '#141414', coat: '#1c2f55', trousers: '#7b7f87',
      gold: '#d9a521', beard: '#f4f4f2', brow: '#e6e6e4', wood: '#7a4a24', cap: '#1c2f55', ink: '#2a1a14' },
    parts: {
      hair: [
        { d: 'M-0.1 0.5C-0.15 0.3 -0.05 0.05 0.2 -0.08C0.45 -0.18 0.7 0.0 0.62 0.2C0.58 0.3 0.5 0.3 0.42 0.32C0.3 0.4 0.15 0.44 -0.1 0.5Z', fill: 'beard' },
        { d: 'M0.26 0.27C0.36 0.33 0.52 0.32 0.58 0.23C0.48 0.19 0.34 0.2 0.26 0.27Z', fill: 'beard' },
        { d: 'M0.16 0.7C0.24 0.82 0.42 0.82 0.5 0.7C0.42 0.74 0.26 0.74 0.16 0.7Z', fill: 'brow' },
        { d: 'M-0.52 0.82C-0.5 1.16 0.46 1.16 0.5 0.84Z', fill: 'cap' },
        { d: 'M-0.55 0.8L0.52 0.8C0.62 0.8 0.68 0.84 0.7 0.88L0.5 0.9L-0.55 0.9Z', fill: 'capShade' },
        { d: 'M0.12 0.88A0.07 0.07 0 1 0 0.26 0.88A0.07 0.07 0 1 0 0.12 0.88Z', fill: 'gold' },
        { d: 'M0.06 0.52C0.1 0.5 0.16 0.5 0.2 0.52', stroke: 'ink', w: 0.015 }
      ],
      torso: [ { cover: [0, 1.1], loose: 0.04, fill: 'coat' }, btn(0.3, 0.9), btn(0.34, 0.6), btn(0.34, 0.3) ],
      skirt: { skirt: true, top: 0.2, length: 0.5, flare: 0.1, fill: 'coat', hem: { fill: 'gold', w: 0.03 } },
      arm: [ { cover: [0, 0.95], loose: 0.03, fill: 'coat' }, { cover: [0.8, 0.97], loose: 0.05, fill: 'gold' } ],
      leg: [ { cover: [0, 1], loose: 0.02, fill: 'trousers' }, { cover: [0.8, 1.02], loose: 0.03, flat: 'start', fill: 'shoe' } ],
      holdNear: { use: 'cane', length: 2.7, upright: true, d: 'M-0.025 0.05L0.025 0.05L0.025 -2.7L-0.025 -2.7Z', fill: 'wood' }
    },
    chains: { } };
})(typeof self !== 'undefined' ? self : this);
