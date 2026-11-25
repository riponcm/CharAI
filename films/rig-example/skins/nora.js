(function (g) {
  (g.CharSkins = g.CharSkins || {}).nora = { name: 'nora', extends: 'mannequin',
    build: { heads: 7, chest: 0.8, waist: 0.6, hips: 0.85 },
    motion: { energy: 0.7 },
    palette: { shirt: '#e2574c', jeans: '#3d5a8a', boot: '#5a3a28', hair: '#5a3a28' },
    parts: {
      torso: { cover: true, loose: 0.02, fill: 'shirt' },
      arm: { cover: [0, 0.3], loose: 0.02, flat: 'end', fill: 'shirt' },
      leg: [{ cover: [0, 1], loose: 0.02, fill: 'jeans' }, { cover: [0, 1], loose: 0.02, inset: -0.35, fill: 'jeansShade' },
        { cover: [0.8, 1.02], loose: 0.03, flat: 'start', fill: 'boot' }],
      hair: { d: 'M-0.5 0.6C-0.55 1.0 0.1 1.15 0.42 0.82C0.2 0.9 -0.1 0.85 -0.3 0.7Z', fill: 'hair' },
    },
    chains: { tail: { bone: 'head', at: [-0.45, 0.85], rest: 200, seg: [0.25, 0.22], width: [0.16, 0.14, 0.04],
      fill: 'hair', layer: 'back', stiff: 0.35 } } };
})(typeof self !== 'undefined' ? self : this);
