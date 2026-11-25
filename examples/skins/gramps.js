(function (g) {
  (g.CharSkins = g.CharSkins || {}).gramps = { name: 'gramps', extends: 'mannequin',
    build:   { heads: 6.5, belly: 0.1, chest: 0.8, waist: 0.7, arm: 0.1, leg: 0.17, neck: 0.1 },
    motion:  { age: 'elder', posture: 0.8, energy: 0.25, weight: 0.3 },
    palette: { skin: '#e6b99b', hair: '#f1f1ec', shoe: '#7a4a3a', suit: '#7d8189', cardi: '#7b4f33', shirt: '#f1e6c8', trou: '#7d8189',
               outline: '#3a2a2a', white: '#ffffff', glass: '#4a4a52', stache: '#f6f6f2' },
    parts:   {
      hairBack: [ { d: 'M-0.1 0.78C-0.38 0.82 -0.52 0.7 -0.5 0.45C-0.48 0.25 -0.35 0.22 -0.2 0.3C-0.28 0.45 -0.2 0.65 -0.1 0.78Z', fill: 'hair' } ],
      head: [
        { d: 'M-0.45 0.5C-0.45 0.15 -0.2 0 0.1 0C0.28 0 0.34 0.05 0.4 0.12C0.5 0.2 0.46 0.3 0.5 0.4C0.5 0.44 0.46 0.45 0.44 0.47C0.46 0.5 0.46 0.55 0.46 0.6C0.46 0.85 0.25 1 0 1C-0.28 1 -0.45 0.85 -0.45 0.5Z', fill: 'skin' },
        { d: 'M-0.1 0.5C-0.18 0.55 -0.18 0.36 -0.08 0.34Z', fill: 'skinShade' },
        { swap: 'brow' }, { swap: 'eye' }, { swap: 'mouth' } ],
      hair: [
        { d: 'M-0.45 0.55C-0.45 0.38 -0.38 0.28 -0.28 0.3C-0.26 0.42 -0.28 0.55 -0.2 0.65C-0.3 0.66 -0.42 0.64 -0.45 0.55Z', fill: 'hair' },
        { d: 'M0.16 0.62C0.3 0.74 0.46 0.7 0.52 0.62C0.52 0.78 0.3 0.8 0.16 0.7Z', fill: 'hair' },
        { d: 'M0.2 0.24C0.3 0.32 0.5 0.3 0.56 0.22C0.52 0.14 0.4 0.17 0.3 0.15C0.2 0.14 0.14 0.2 0.2 0.24Z', fill: 'stache' },
        { d: 'M0.265 0.52A0.1 0.1 0 1 0 0.465 0.52A0.1 0.1 0 1 0 0.265 0.52Z', stroke: 'glass', w: 0.025 },
        { d: 'M0.265 0.52C0.1 0.52 -0.1 0.5 -0.2 0.46', stroke: 'glass', w: 0.02 }
      ],
      torso: [
        { cover: [0.85, 1.08], loose: 0.01, fill: 'shirt' },
        { cover: [0, 0.92], loose: 0.04, fill: 'cardi' } ],
      skirt: { skirt: true, length: 0.2, top: 0.3, flare: 0.1, fill: 'cardi' },
      arm: { cover: [0, 0.95], loose: 0.03, fill: 'cardi' },
      leg: [ { cover: [0, 1], loose: 0.02, fill: 'trou' },
             { cover: [0.88, 1.02], loose: 0.03, flat: 'start', fill: 'shoe' } ]
    },
    chains:  { } };
})(typeof self !== 'undefined' ? self : this);
