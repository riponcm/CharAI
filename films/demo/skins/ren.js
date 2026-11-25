// films/demo/skins/ren.js - a second character made by recolouring the shared tess skin.
// `extends` takes every part of the named skin; only the keys given here change.
// The palette keys are the base skin's (see the palette block in skins/tess.js).
(function (g) {
  (g.CharSkins = g.CharSkins || {}).ren = {
    name: 'ren', extends: 'tess',
    palette: {
      skin: '#c98d62', skinShade: '#a8714b', cheek: '#d9826b',
      hair: '#231a16', hairShade: '#120d0b',
      top: '#efe2c0', topShade: '#cdbd98',          // sleeves
      dress: '#3f6fa0', dressShade: '#2f5680',      // tunic
      bottom: '#3d4a3a', bottomShade: '#2c3629',
      shoe: '#5a4636', shoeShade: '#3e3025',
      accent: '#e0b24a', accentShade: '#bf9233',    // scarf, cuffs
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
