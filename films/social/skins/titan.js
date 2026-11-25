(function (g) {
  (g.CharSkins = g.CharSkins || {}).titan = { name: 'titan', extends: 'mannequin',
    build:   { heads: 7.5, muscle: 1, shoulders: 1.1, chest: 1.05, waist: 0.7, neck: 0.14 },
    motion:  { weight: 0.45, energy: 1 },
    palette: { skin: '#c98a5e', suit: '#c98a5e', hair: '#1f1612', shoe: '#f2f2f2', vest: '#d62a2a', shorts: '#1c1c22', sock: '#ffffff', band: '#f5f5f5', num: '#ffffff', suitShade: '#a8694a' },
    parts:   {
      head: [
        { d: 'M-0.38 0.55C-0.4 0.85 -0.25 1 0.05 1C0.35 1 0.5 0.85 0.5 0.6L0.5 0.3C0.5 0.12 0.42 0 0.3 0L-0.15 0C-0.3 0 -0.36 0.2 -0.38 0.55Z', fill: 'skin' },
        { d: 'M0.5 0.5C0.55 0.45 0.55 0.4 0.5 0.36Z', fill: 'skin' },
        { d: 'M-0.1 0.5C-0.12 0.58 -0.15 0.6 -0.2 0.6C-0.25 0.5 -0.2 0.4 -0.1 0.42Z', fill: 'skinShade' },
        { swap: 'brow' }, { swap: 'eye' }, { swap: 'mouth' } ],
      hair: [
        { d: 'M-0.42 0.5L-0.4 0.92L-0.3 1.04L0.3 1.04L0.46 0.9L0.5 0.78C0.4 0.82 0.25 0.8 0.1 0.76C-0.1 0.7 -0.25 0.6 -0.3 0.45Z', fill: 'hair' },
        { d: 'M-0.43 0.6L0.5 0.78L0.5 0.66L-0.42 0.5Z', fill: 'band' },
        { d: 'M-0.43 0.55L-0.2 0.5L-0.28 0.4Z', fill: 'band' }
      ],
      torso: [
        { cover: [0, 0.12], loose: 0.04, fill: 'shorts' },
        { cover: [0.1, 0.98], loose: 0.03, fill: 'vest' },
        { d: 'M-0.12 1.15L0.14 1.15L0.14 1.1L0.0 0.75L-0.06 0.75L0.06 1.1L-0.12 1.1Z', fill: 'num' }
      ],
      leg: [ { cover: [0, 0.38], loose: 0.03, fill: 'shorts' },
             { cover: [0.8, 1.02], loose: 0.02, flat: 'start', fill: 'sock' } ]
    },
    chains:  { } };
})(typeof self !== 'undefined' ? self : this);
