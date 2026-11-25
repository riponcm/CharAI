(function (g) {
  (g.CharSkins = g.CharSkins || {}).tot = { name: 'tot', extends: 'mannequin',
    build:   { heads: 2.3 },
    motion:  { age: 'baby', energy: 0.8, weight: 0.2 },
    palette: { skin: '#f2c4a0', hair: '#e8c97a', shoe: '#f2c4a0', romper: '#f5c518', blush: '#ee8f84', outline: '#3a2a2a', white: '#ffffff' },
    parts:   {
      head: [
        { d: 'M-0.5 0.55C-0.5 0.18 -0.25 0 0.08 0C0.4 0 0.54 0.2 0.54 0.5C0.54 0.82 0.3 1 -0.02 1C-0.35 1 -0.5 0.85 -0.5 0.55Z', fill: 'skin' },
        { d: 'M-0.12 0.5C-0.2 0.55 -0.2 0.38 -0.1 0.36Z', fill: 'skinShade' },
        { d: 'M0.2 0.3C0.28 0.34 0.3 0.24 0.22 0.22C0.16 0.22 0.15 0.28 0.2 0.3Z', fill: 'blush', opacity: 0.8 },
        { swap: 'brow' }, { swap: 'eye' }, { swap: 'mouth' } ],
      hair: [
        { d: 'M-0.3 0.95C-0.1 1.02 0.2 1.0 0.35 0.9', stroke: 'hair', w: 0.045 },
        { d: 'M-0.1 0.98C0 1.1 0.15 1.12 0.15 1.04C0.15 0.98 0.06 0.98 0.07 1.03', stroke: 'hair', w: 0.045 },
        { d: 'M-0.35 0.85C-0.45 0.8 -0.47 0.7 -0.45 0.62', stroke: 'hair', w: 0.04 }
      ],
      torso: { cover: true, loose: 0.03, fill: 'romper' },
      arm: { cover: [0, 0.3], flat: 'end', fill: 'romper' },
      leg: { cover: [0, 0.35], fill: 'romper' }
    },
    swaps: { eye: {
      open: [ { d: 'M0.2 0.5A0.075 0.095 0 1 0 0.35 0.5A0.075 0.095 0 1 0 0.2 0.5Z', fill: 'outline' }, { d: 'M0.25 0.55A0.022 0.03 0 1 0 0.295 0.55A0.022 0.03 0 1 0 0.25 0.55Z', fill: 'white' } ],
      closed: [ { d: 'M0.2 0.48C0.24 0.44 0.31 0.44 0.35 0.48', stroke: 'outline', w: 0.045 } ],
      happy: [ { d: 'M0.2 0.47C0.24 0.54 0.31 0.54 0.35 0.47', stroke: 'outline', w: 0.045 } ] } },
    chains:  { } };
})(typeof self !== 'undefined' ? self : this);
