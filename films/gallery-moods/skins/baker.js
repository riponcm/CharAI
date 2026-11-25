(function (g) {
  (g.CharSkins = g.CharSkins || {}).baker = { name: 'baker', extends: 'mannequin',
    build:   { heads: 5.5, belly: 0.6, chest: 1.05, waist: 1.0, hips: 0.98, seat: 0.1, arm: 0.17, leg: 0.3, neck: 0.14, headWidth: 0.95 },
    motion:  { weight: 0.95, energy: 0.35 },
    palette: { skin: '#e8a98c', hair: '#1c1612', shoe: '#1a1a1a', suit: '#fbfaf5', white: '#fbfaf5', cream: '#efe3c0', check: '#3a3d4a', rose: '#e07a7a', band: '#c9b88a' },
    parts:   {
      head: [
        { d: 'M-0.45 0.55C-0.5 0.2 -0.3 -0.02 0.05 -0.02C0.3 -0.02 0.5 0.1 0.52 0.3C0.56 0.5 0.52 0.85 0.3 0.97C0.1 1.03 -0.3 1.02 -0.45 0.8C-0.5 0.7 -0.46 0.6 -0.45 0.55Z', fill: 'skin' },
        { d: 'M-0.2 0.12C0 -0.12 0.3 -0.08 0.4 0.12C0.2 0.04 -0.05 0.04 -0.2 0.12Z', fill: 'skinShade' },
        { d: 'M0.2 0.42a0.1 0.07 0 1 0 0.001 0Z', fill: 'rose' },
        { swap: 'brow' }, { swap: 'eye' }, { swap: 'mouth' },
        { d: 'M0.56 0.4C0.5 0.34 0.3 0.34 0.16 0.34C0.1 0.46 0.28 0.5 0.36 0.44C0.44 0.5 0.62 0.5 0.6 0.42C0.58 0.4 0.58 0.4 0.56 0.4Z', fill: 'hair' },
        { d: 'M0.2 0.36C0.1 0.3 0.12 0.24 0.2 0.28C0.26 0.3 0.24 0.34 0.2 0.36Z', fill: 'hair' } ],
      hair: [
        { d: 'M-0.48 0.7C-0.5 0.5 -0.4 0.4 -0.3 0.42C-0.32 0.55 -0.3 0.65 -0.3 0.75C-0.4 0.78 -0.45 0.75 -0.48 0.7Z', fill: 'hair' },
        { d: 'M-0.36 0.92C-0.2 1.02 0.1 1.04 0.32 0.95C0.1 0.97 -0.15 0.95 -0.36 0.92Z', fill: 'hairShade' },
        { d: 'M-0.52 0.9C-0.5 1.02 -0.3 1.3 0 1.3C0.3 1.3 0.5 1.1 0.5 0.9C0.2 1.0 -0.2 1.0 -0.52 0.9Z', fill: 'white' },
        { d: 'M-0.58 0.88C-0.3 0.96 0.2 0.96 0.58 0.88C0.58 0.96 0.5 1.0 0.4 1.0C0 1.05 -0.4 1.05 -0.52 1.0Z', fill: 'whiteShade' },
        { d: 'M-0.35 1.2C-0.3 1.55 0.4 1.55 0.4 1.2C0.45 1.0 -0.4 1.0 -0.35 1.2Z', fill: 'white' } ],
      torso: [
        { cover: true, loose: 0.03, fill: 'white' },
        { cover: [0, 0.62], loose: 0.04, fill: 'cream' } ],
      skirt: { skirt: true, length: 0.55, flare: 0.1, top: 0.0, loose: 0.03, fill: 'cream', hem: { fill: 'band', w: 0.04 } },
      arm: { cover: [0, 0.3], flat: 'end', loose: 0.03, fill: 'white' },
      leg: [ { cover: [0, 1], loose: 0.02, fill: 'check' } ] },
    chains:  { } };
})(typeof self !== 'undefined' ? self : this);
