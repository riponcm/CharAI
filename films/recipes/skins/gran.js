// films/rig-example/skins/gran.js - RIG.md recipes in one skin: hat, glasses, earrings, cane, cardigan over a blouse, coat tails.
(function (g) {
  (g.CharSkins = g.CharSkins || {}).gran = { name: 'gran', extends: 'mannequin',
    build: { heads: 6.4, belly: 0.12, bust: 0.06, hide: ['hair'] },
    motion: { age: 'elder', energy: 0.3 },
    palette: { suit: '#c9b7d6', blouse: '#efe6f2', cardi: '#6d5a8c', hat: '#3b3350', frame: '#2b2b2b', gold: '#d9a93a', wood: '#7a5230', hair: '#d9d6cf' },
    parts: {
      torso: [{ cover: true, fill: 'blouse' }, { cover: true, loose: 0.04, fill: 'cardi' }],
      arm: { cover: [0, 0.92], loose: 0.03, fill: 'cardi' },
      skirt: { skirt: true, top: 0.3, length: 0.7, flare: 0.15, fill: 'cardi', shade: 'cardiShade' },
      hair: [{ d: 'M-0.5 0.62C-0.55 0.95 -0.2 1.05 0.2 0.98L0.1 0.84C-0.15 0.9 -0.35 0.78 -0.42 0.55Z', fill: 'hair' },
        { d: 'M-0.55 0.92C-0.5 1.3 0.45 1.3 0.5 0.92Z', fill: 'hat' }, { d: 'M-0.62 0.9L0.62 0.9L0.6 0.97L-0.6 0.97Z', fill: 'hatShade' },
        { d: 'M0.18 0.55A0.08 0.08 0 1 0 0.34 0.55A0.08 0.08 0 1 0 0.18 0.55Z', stroke: 'frame', w: 0.02 }, { d: 'M0.18 0.55L-0.04 0.52', stroke: 'frame', w: 0.018 }],
      holdNear: { upright: true, d: 'M-0.025 0.05L0.025 0.05L0.025 -2.9L-0.025 -2.9Z', fill: 'wood' },
    },
    chains: { earring: { bone: 'head', at: [-0.06, 0.4], rest: 270, seg: [0.06, 0.05], width: [0.02, 0.02, 0.02], fill: 'gold', layer: 'head', stiff: 0.2,
      end: { d: 'M0 -0.04A0.04 0.04 0 1 0 0 0.04A0.04 0.04 0 1 0 0 -0.04Z', fill: 'gold' } } } };
})(typeof self !== 'undefined' ? self : this);
