(function (g) {
  (g.CharSkins = g.CharSkins || {}).duchess = { name: 'duchess', extends: 'mannequin',
    build:   { heads: 7.8, chest: 0.72, waist: 0.52, hips: 0.78, arm: 0.1, leg: 0.16, neck: 0.085, bust: 0.06 },
    motion:  { weight: 0.1, energy: 0.5, posture: -0.5 },
    palette: { skin: '#f0cfb8', hair: '#c9ccd6', suit: '#5a2a4e', shoe: '#2a1a24', gown: '#5a2a4e', glove: '#f6f4f0',
      lilac: '#b9a0d8', ribbon: '#6b3a78', pearl: '#f3efe6', bag: '#3a2a30', ink: '#3a2430', lip: '#a8465a' },
    parts: {
      hairBack: [ { d: 'M-0.4 0.45C-0.7 0.4 -0.72 0.05 -0.45 0.02C-0.2 0.0 -0.15 0.3 -0.3 0.5Z', fill: 'hair' } ],
      hair: [
        { d: 'M0.18 0.74C0.28 0.8 0.42 0.78 0.5 0.72C0.4 0.74 0.28 0.72 0.18 0.74Z', fill: 'hairShade' },
        { d: 'M-0.45 0.9C-0.45 1.6 0.45 1.6 0.45 0.9Z', fill: 'lilac' },
        { d: 'M-0.45 0.9L0.45 0.9L0.44 1.0L-0.44 1.0Z', fill: 'ribbon' },
        { d: 'M-0.95 0.86C-0.5 0.8 0.5 0.8 1.0 0.88C0.9 0.97 0.5 0.95 0 0.96C-0.5 0.96 -0.9 0.95 -0.95 0.86Z', fill: 'lilac' },
        { d: 'M-0.95 0.86C-0.5 0.8 0.5 0.8 1.0 0.88C0.5 0.84 -0.5 0.84 -0.95 0.86Z', fill: 'lilacShade' },
        { d: 'M-0.44 0.97L0.44 0.97L0.44 1.05L-0.44 1.05Z', fill: 'ribbon' }
      ],
      torso: { cover: [0, 1.1], loose: 0.02, fill: 'gown' },
      skirt: { skirt: true, top: 0.3, length: 1.0, flare: 0.3, fill: 'gown', hem: { fill: 'ribbon', w: 0.05 } },
      arm: [ { cover: [0, 0.97], loose: 0.02, fill: 'gown' }, { cover: [0.72, 1.0], loose: 0.03, fill: 'glove' } ],
      holdNear: { d: 'M0.05 -0.02L0.3 -0.02L0.3 -0.3L0.05 -0.3Z', fill: 'bag' }
    },
    chains: {
      earring: { bone: 'head', at: [0.0, 0.42], rest: 270, seg: [0.2, 0.16], width: [0.02, 0.02, 0.02], fill: 'pearl', layer: 'head', stiff: 0.1,
        end: { d: 'M0 -0.06A0.045 0.06 0 1 0 0 0.06A0.045 0.06 0 1 0 0 -0.06Z', fill: 'pearl' } }
    } };
})(typeof self !== 'undefined' ? self : this);
