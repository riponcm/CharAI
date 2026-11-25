// skins/mannequin.js - the neutral human. Its whole body is generated from numbers (`build`):
// copy this file, or write a skin with extends: 'mannequin' and change only build numbers, motion,
// palette, and add your own head, hair and garments. Every field: docs/RIG.md.
(function (root, factory) {
  const skin = factory();
  if (typeof module === 'object' && module.exports) module.exports = skin;
  else { root.CharSkins = root.CharSkins || {}; root.CharSkins[skin.name] = skin; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    name: 'mannequin',
    // height 5 heads; every other number has a default that follows `heads` (docs/RIG.md)
    build: { heads: 5 },
    motion: { weight: 0.3, energy: 0.5, age: 'adult', posture: 0 },
    outline: 0.03,
    // shades (skinShade, suitShade) are made from these unless a skin sets them
    palette: { skin: '#e8c3a2', suit: '#8a94a6', shoe: '#5b4a42', sole: '#3a2f2a', hair: '#5a4636' },
  };
});
