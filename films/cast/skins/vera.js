(function (g) {
  (g.CharSkins = g.CharSkins || {}).vera = { name: 'vera', extends: 'mannequin',
    build:   { heads: 7.6, chest: 0.72, waist: 0.52, hips: 0.78, arm: 0.1, leg: 0.16, neck: 0.085, bust: 0.06 },
    motion:  { weight: 0.1, energy: 0.5 },
    palette: { skin: '#6b4430', hair: '#16100e', shoe: '#2a2024', suit: '#0f8a5f', suitShade: '#0b6f4c', emerald: '#0f8a5f', gold: '#d9a93a' },
    parts:   {
      hair: [
        { d: 'M-0.5 0.5C-0.55 1.05 0 1.12 0.45 0.82C0.2 0.9 -0.05 0.88 -0.2 0.7C-0.3 0.6 -0.4 0.5 -0.5 0.5Z', fill: 'hair' },
        { d: 'M-0.3 0.95C-0.45 0.95 -0.5 1.2 -0.36 1.3C-0.2 1.4 0 1.35 0 1.2C0.02 1.0 -0.15 0.9 -0.3 0.95Z', fill: 'hair' },
        { d: 'M-0.3 1.2C-0.2 1.28 -0.05 1.28 0 1.2C-0.1 1.22 -0.2 1.2 -0.3 1.2Z', fill: 'hairShade' } ],
      torso: { cover: [0.0, 1.0], fill: 'emerald' },
      arm: { cover: [0, 0.97], loose: 0.03, fill: 'emerald' },
      skirt: { skirt: true, length: 0.93, flare: 0.12, fill: 'emerald', hem: { fill: 'gold', w: 0.07 } } },
    chains:  {
      strand: { bone: 'head', at: [-0.4, 0.8], rest: 230, seg: [0.25, 0.25], width: [0.07, 0.06, 0.03], fill: 'hair', stiff: 0.15 },
      earring: { bone: 'head', at: [0.0, 0.42], rest: 270, seg: [0.18, 0.15], width: [0.04, 0.07, 0.07], fill: 'gold', stiff: 0.1 } } };
})(typeof self !== 'undefined' ? self : this);
