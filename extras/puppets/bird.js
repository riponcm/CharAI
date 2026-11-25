// puppets/bird.js - a small songbird with states perch, hop, flap, fly, peck. Copy this file to
// make an animal or creature.
//
// A puppet registers CharPuppets.<name> with:
//   height        px from the feet to the top of the head (speech bubbles sit above it)
//   initial       the state it starts in
//   states        { name: { loop?, dur?, then?, travel?, speed?, step?, stepLength?, doc } }
//                   loop: true     holds until the script says otherwise (perch)
//                   dur + then     plays for dur seconds, then switches to `then` (flap -> perch)
//                   travel         'ground' or 'air': the state moves the puppet; the script must give to=
//                   speed          px per second while travelling
//                   step, stepLength   ground travel in hops: one hop every `step` s, `stepLength` px each,
//                                  so the feet never slide (the stage moves x only while airborne)
//   pose(state, since, t) -> params   numbers only; `since` = seconds since the state began
//   render(params, t)     -> SVG       drawn facing +x, origin at the feet, y down, in px
//   draw(t, state, since) -> SVG       the contract form; the stage prefers pose + render because it
//                                      blends the numbers of the old and new state for `blend` seconds,
//                                      so state changes never pop.
(function (g) {
  'use strict';
  const TAU = Math.PI * 2;
  const r1 = v => Math.round(v * 100) / 100;
  const frac = x => x - Math.floor(x);
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const C = { back: '#5b7fa6', backDark: '#3a587a', wing: '#6d93bd', breast: '#f08a3c', belly: '#f7e7cf', beak: '#f2b33d', leg: '#c0783a', eye: '#1d1a19', line: '#2c3440' };

  // blink: a short close at irregular, fixed times
  function blink(t) {
    const k = Math.floor(t / 2.3), bt = k * 2.3 + 0.4 + hash(k) * 1.4;
    return Math.abs(t - bt) < 0.08 ? 1 : 0;
  }

  // the numbers a state produces; every state returns the same keys so they can be blended
  const STEP = 0.3;
  function pose(state, since, t) {
    const p = { lift: 0, tilt: 0, wing: 0, spread: 0, head: 0, headTilt: 0, tail: 0, tuck: 0, blink: blink(t), beak: 0 };
    if (state === 'perch') {
      p.head = -1.5 * Math.max(0, Math.sin(t * 1.7)) ;           // small look-around bob
      p.headTilt = 10 * Math.sin(t * 0.9) * (Math.sin(t * 0.37) > 0.2 ? 1 : 0.2);
      p.tail = 6 * Math.max(0, Math.sin(t * 3.1)) * (frac(t / 3) < 0.25 ? 1 : 0);   // occasional tail flick
      p.lift = -0.8 * Math.sin(t * 3.0);                         // breathing
    } else if (state === 'hop') {
      const f = frac(since / STEP), air = Math.sin(Math.PI * f);
      p.lift = 15 * air; p.tilt = -8 + 6 * air; p.tuck = 0.7 * air; p.wing = 18 * air; p.spread = 0.25 * air; p.tail = 10 * air;
    } else if (state === 'flap') {
      const w = Math.sin(since * TAU * 5.5);
      p.lift = 5 + 3 * w; p.wing = 18 + 52 * w; p.spread = 1; p.tilt = -12; p.tail = 8 + 6 * w; p.tuck = 0.3; p.beak = 0.6 * Math.max(0, Math.sin(since * 9));
    } else if (state === 'fly') {
      const w = Math.sin(since * TAU * 4.5);
      p.wing = 15 + 58 * w; p.spread = 1; p.tilt = -6 + 4 * w; p.tuck = 1; p.lift = 2 * w; p.tail = 4;
    } else if (state === 'peck') {
      const f = frac(since / 0.45), dip = Math.pow(Math.sin(Math.PI * Math.min(1, f * 1.6)), 2);
      p.tilt = 28 * dip; p.head = 3 * dip; p.tail = -10 * dip;
    } else if (state === 'sing') {
      p.beak = 0.5 + 0.5 * Math.sin(since * 14); p.head = -2; p.headTilt = -12; p.tail = 4 * Math.sin(since * 7);
    }
    return p;
  }

  function render(p) {
    // wing: a feather fan hinged at the shoulder; folded (spread 0) it lies along the back
    function wing(col, edge, k) {
      const len = 24 + 14 * p.spread;
      // the wing points backward (-x); a positive SVG rotation swings a backward-pointing wing up
      const d = `M0 0C-6 -9 ${r1(-len * 0.6)} -10 ${r1(-len)} -3L${r1(-len + 6)} 2L${r1(-len + 10)} 3L${r1(-len + 15)} 6C${r1(-len * 0.4)} 10 -6 8 0 0Z`;
      const feathers = `M${r1(-len + 8)} 0L${r1(-len * 0.45)} 1M${r1(-len + 12)} 3L${r1(-len * 0.4)} 4`;
      return `<g transform="translate(4 -24) rotate(${r1(p.wing * k - 4)}) scale(1 ${r1(0.8 + 0.45 * p.spread)})"><path d="${d}" fill="${col}" stroke="${edge}" stroke-width="1.2"/><path d="${feathers}" stroke="${edge}" stroke-width="1.4" stroke-linecap="round" fill="none"/></g>`;
    }
    const legs = (() => {
      const L = 10 * (1 - 0.6 * p.tuck), back = 4 * p.tuck;
      let o = '';
      for (const dx of [-3, 3]) {
        o += `<path d="M${dx} -11L${r1(dx - back)} ${r1(-11 + L)}" stroke="${C.leg}" stroke-width="2" stroke-linecap="round"/>`;
        if (p.tuck < 0.5) o += `<path d="M${r1(dx - back - 3)} ${r1(-11 + L)}L${r1(dx - back + 4)} ${r1(-11 + L)}" stroke="${C.leg}" stroke-width="2" stroke-linecap="round"/>`;
      }
      return o;
    })();
    const eyeR = 2.4;
    const eye = p.blink > 0.5
      ? `<path d="M14.5 -33.5L18.5 -33.5" stroke="${C.eye}" stroke-width="1.6" stroke-linecap="round"/>`
      : `<circle cx="16.5" cy="-33.5" r="${eyeR}" fill="${C.eye}"/><circle cx="17.3" cy="-34.4" r="0.8" fill="#fff"/>`;
    const bo = p.beak * 3;
    const head = `<g transform="translate(0 ${r1(p.head)}) rotate(${r1(p.headTilt)} 12 -28)">` +
      `<path d="M20 -33L29 ${r1(-31 - bo * 0.3)}L20 -30Z" fill="${C.beak}"/><path d="M20 -30L27 ${r1(-29 + bo)}L20 -28Z" fill="${C.beak}"/>` +
      `<circle cx="13" cy="-31" r="9.5" fill="${C.back}"/><path d="M13 -26C17 -26 21 -27 21.5 -30C20 -24 15 -22 10 -23Z" fill="${C.breast}"/>${eye}</g>`;
    const body = `<g transform="rotate(${r1(p.tail)} -14 -19)"><path d="M-12 -22L-31 -29L-33 -22L-30 -16L-12 -15Z" fill="${C.backDark}"/></g>` +
      wing(C.backDark, C.backDark, 0.85) +
      `<ellipse cx="0" cy="-20" rx="18" ry="12.5" fill="${C.back}"/>` +
      `<path d="M4 -29C14 -27 17 -18 12 -11C7 -7 -2 -8 -6 -11C2 -14 6 -20 4 -29Z" fill="${C.breast}"/>` +
      `<path d="M-6 -11C0 -9 6 -9 10 -11C4 -8 -2 -8 -6 -11Z" fill="${C.belly}"/>` +
      head + wing(C.wing, C.backDark, 1);
    return `<g transform="translate(0 ${r1(-p.lift)})">${legs}<g transform="rotate(${r1(p.tilt)} 0 -18)">${body}</g></g>`;
  }

  const bird = {
    name: 'bird', height: 44, initial: 'perch', blend: 0.22,
    states: {
      perch: { loop: true, doc: 'sit still, look around' },
      hop: { travel: 'ground', step: STEP, stepLength: 34, then: 'perch', doc: 'hop along the ground to=' },
      flap: { dur: 1.2, then: 'perch', doc: 'flap the wings in place' },
      fly: { travel: 'air', speed: 260, then: 'perch', doc: 'fly in an arc to= a place or anchor' },
      peck: { dur: 1.35, then: 'perch', doc: 'peck at the ground three times' },
      sing: { dur: 1.5, then: 'perch', doc: 'open the beak and sing' },
    },
    pose, render,
    draw: (t, state, since) => render(pose(state, since, t)),
  };
  (g.CharPuppets = g.CharPuppets || {}).bird = bird;
})(typeof globalThis !== 'undefined' ? globalThis : this);
