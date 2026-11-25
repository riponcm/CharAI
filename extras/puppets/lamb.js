// puppets/lamb.js - a small white lamb with a black face and legs and a tiny bell on a red
// collar. Format: see puppets/bird.js. About 58 px tall at scale 1 (Kai is about 200 px).
// States: stand (default, holds), bleat (1.3 s), tremble (holds: frightened shiver), walk(to)
// (ground, 55 px/s), pronk (1.1 s: happy bounces in place), nuzzle (2.4 s: rubs its head
// against whoever is in front, eyes shut), lie (holds: lying down, legs folded).
(function (g) {
  'use strict';
  const TAU = Math.PI * 2;
  const r1 = v => Math.round(v * 100) / 100;
  const frac = x => x - Math.floor(x);
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const C = { wool: '#fbf7ef', woolShade: '#e2d8cb', face: '#2a2327', faceLight: '#40363b', leg: '#2a2327', legFar: '#1b1619', hoof: '#5a4a44',
    ear: '#2a2327', earIn: '#c98a8a', eye: '#ffffff', pupil: '#141012', mouth: '#7a2b3a', collar: '#d4372d', bell: '#f0c040', bellDark: '#b78a22', line: '#2a1c22' };

  function blink(t) {
    const k = Math.floor(t / 2.7), bt = k * 2.7 + 0.5 + hash(k + 7) * 1.6;
    return Math.abs(t - bt) < 0.08 ? 1 : 0;
  }
  const KEYS = ['lift', 'tilt', 'headA', 'headX', 'headY', 'ear', 'mouth', 'fN', 'fF', 'bN', 'bF', 'shiver', 'tail', 'blink', 'bell', 'fold'];
  function pose(state, since, t) {
    const p = {};
    for (const k of KEYS) p[k] = 0;
    p.blink = blink(t);
    p.bell = 6 * Math.sin(t * 2.3);
    p.ear = 6 * Math.sin(t * 0.8) + (frac(t / 3.7) < 0.08 ? 14 : 0);      // occasional ear flick
    p.tail = frac(t / 2.9) < 0.18 ? 22 * Math.sin(t * 30) : 0;          // occasional tail wag
    p.lift = 0.6 * Math.sin(t * 2.6);                                      // breathing
    if (state === 'stand') {
      p.headA = 4 * Math.sin(t * 0.7); p.headY = 0.6 * Math.sin(t * 1.3);
    } else if (state === 'bleat') {
      const env = Math.sin(Math.PI * Math.min(1, since / 1.3));
      const pulse = Math.max(0, Math.sin(since * TAU * 1.6));
      p.headA = -28 * env; p.headX = 1.5 * env; p.headY = -3 * env;
      p.mouth = env * (0.4 + 0.6 * pulse); p.ear = -18 * env; p.tilt = -4 * env; p.lift += 1.5 * env * pulse;
      p.bell = 18 * env * Math.sin(since * 14); p.tail = 10 * env * Math.sin(since * 20);
    } else if (state === 'tremble') {
      const s = Math.min(1, since / 0.3);
      p.shiver = s * 1.3 * Math.sin(t * 42); p.headA = 16 * s; p.headY = 2 * s; p.ear = 34 * s; p.tail = -10 * s; p.lift = -1 * s + 0.4 * Math.sin(t * 37);
      p.bell = s * 10 * Math.sin(t * 40); p.fN = -4 * s; p.bN = 4 * s; p.fF = -2 * s; p.bF = 2 * s;
    } else if (state === 'walk') {
      const ph = since * TAU * 2.1, s = Math.sin(ph);
      p.fN = 24 * s; p.bF = 24 * s; p.fF = -24 * s; p.bN = -24 * s;
      p.lift = 1.6 * Math.abs(Math.cos(ph)); p.headA = 3 * Math.sin(ph * 2); p.headY = 1.2 * Math.cos(ph * 2); p.bell = 14 * Math.sin(ph);
    } else if (state === 'pronk') {
      const f = frac(since / 0.55), air = Math.sin(Math.PI * f);
      p.lift = 16 * air; p.tilt = -6 * Math.cos(Math.PI * f); p.fN = -10 * air; p.fF = -6 * air; p.bN = 10 * air; p.bF = 6 * air;
      p.headA = -10 * air; p.ear = -20 * air; p.tail = 20 * Math.sin(since * 26); p.bell = 20 * Math.sin(since * 12);
      p.mouth = 0.3 * air;
    } else if (state === 'nuzzle') {
      const env = Math.sin(Math.PI * Math.min(1, since / 2.4)), w = Math.min(1, since / 0.3);
      p.headA = 22 * w + 8 * env * Math.sin(since * 7); p.headX = 5 * w; p.headY = 2 * w + 2.5 * env * Math.sin(since * 7 + 1);
      p.tilt = 4 * w; p.blink = since > 0.3 && since < 2.2 ? 1 : p.blink; p.ear = 26 * w;
      p.tail = 24 * env * Math.sin(since * 28); p.bell = 10 * Math.sin(since * 7);
    } else if (state === 'lie') {
      const s = Math.min(1, since / 0.5);
      p.fold = s; p.lift -= 14 * s; p.headA = 6 * s;
    }
    return p;
  }

  function render(p) {
    const wool = [[-20, -30, 10], [-13, -40, 11], [0, -43, 12], [12, -40, 11], [19, -32, 10], [14, -22, 9], [0, -20, 10], [-14, -22, 9], [0, -31, 15]];
    const circles = (list, fill, dy, extra) => list.map(([x, y, r]) => `<circle cx="${x}" cy="${y + (dy || 0)}" r="${r + (extra || 0)}" fill="${fill}"/>`).join('');
    // legs hang from the hips; fold bends them under the body when lying down
    const leg = (x, ang, col) => {
      const L = 20 * (1 - 0.55 * p.fold);
      return `<g transform="translate(${x} -21) rotate(${r1(ang + 70 * p.fold * (x > 0 ? -1 : 1))})"><rect x="-2.7" y="-2" width="5.4" height="${r1(L + 2)}" rx="2.7" fill="${col}"/><rect x="-3.1" y="${r1(L - 3)}" width="6.2" height="4" rx="1.2" fill="${C.hoof}"/></g>`;
    };
    const legsFar = leg(16, p.fF, C.legFar) + leg(-12, p.bF, C.legFar);
    const legsNear = leg(11, p.fN, C.leg) + leg(-17, p.bN, C.leg);
    const tail = `<g transform="rotate(${r1(p.tail)} -24 -36)"><circle cx="-29" cy="-37" r="5.5" fill="${C.line}"/><circle cx="-29" cy="-37" r="4.2" fill="${C.wool}"/></g>`;
    const body = circles(wool, C.line, 0, 1.6) + circles(wool, C.woolShade, 0) + circles(wool, C.wool, -3, -1.5) +
      `<path d="M-16 -42Q-10 -47 -4 -44M2 -48Q8 -50 13 -45" fill="none" stroke="${C.woolShade}" stroke-width="1.6" stroke-linecap="round"/>`;
    // head, pivoting at the neck
    const eye = p.blink > 0.5
      ? `<path d="M9.6 -4.6Q12 -2.6 14.4 -4.6" fill="none" stroke="${C.eye}" stroke-width="1.5" stroke-linecap="round"/>`
      : `<circle cx="12" cy="-4.4" r="2.7" fill="${C.eye}"/><circle cx="12.7" cy="-4.2" r="1.6" fill="${C.pupil}"/><circle cx="13.2" cy="-4.9" r="0.6" fill="#fff"/>`;
    const mouth = p.mouth > 0.05 ? `<ellipse cx="17.6" cy="${r1(4.4 + p.mouth)}" rx="2.2" ry="${r1(0.4 + 2.4 * p.mouth)}" fill="${C.mouth}"/>` : `<path d="M15.6 4.6Q17.2 5.6 18.8 4.4" fill="none" stroke="${C.faceLight}" stroke-width="1"/>`;
    const ear = (x, y, ang, col, inner) => `<g transform="translate(${x} ${y}) rotate(${r1(ang)})"><path d="M0 0Q-7 -5 -15 -1Q-8 4 0 2Z" fill="${col}" stroke="${C.line}" stroke-width="1"/>${inner ? `<path d="M-2 0.4Q-7 -2 -11 -0.6Q-7 1.6 -2 1.4Z" fill="${C.earIn}"/>` : ''}</g>`;
    const head = `<g transform="translate(${r1(17 + p.headX)} ${r1(-39 + p.headY)}) rotate(${r1(p.headA)})">` +
      ear(5, -6, -20 + p.ear * 0.8, C.legFar, false) +
      `<path d="M-2 -7C4 -12 14 -11 19 -5C23 0 22 6 17 7.5C12 9 4 6 0 2C-3 -1 -4 -4 -2 -7Z" fill="${C.face}" stroke="${C.line}" stroke-width="1.6"/>` +
      `<path d="M14 -9C17 -7 19 -4 20 -1" fill="none" stroke="${C.faceLight}" stroke-width="1.4" stroke-linecap="round"/>` +
      eye + mouth + `<circle cx="19.6" cy="0.6" r="0.9" fill="${C.faceLight}"/>` +
      `<circle cx="4" cy="-9" r="5.5" fill="${C.wool}" stroke="${C.line}" stroke-width="1.2"/><circle cx="8.6" cy="-10.4" r="4.4" fill="${C.wool}"/>` +
      ear(4, -4, 10 + p.ear, C.ear, true) + '</g>';
    // collar and bell (the bell swings from the collar)
    const collar = `<path d="M13 -46Q20 -40 22 -32" fill="none" stroke="${C.collar}" stroke-width="3.2" stroke-linecap="round"/>` +
      `<g transform="translate(21.5 -33) rotate(${r1(p.bell)})"><path d="M-3 1.5Q-3 -3.2 0 -3.2Q3 -3.2 3 1.5L3.8 3.2L-3.8 3.2Z" fill="${C.bell}" stroke="${C.bellDark}" stroke-width="0.8"/><circle cx="0" cy="4" r="1.1" fill="${C.bellDark}"/></g>`;
    return `<g transform="translate(${r1(p.shiver)} ${r1(-p.lift)})">${legsFar}${legsNear}<g transform="rotate(${r1(p.tilt)} 0 -30)">${tail}${body}${collar}${head}</g></g>`;
  }

  const lamb = {
    name: 'lamb', height: 58, initial: 'stand', blend: 0.25,
    states: {
      stand: { loop: true, doc: 'stand, breathing, ears and tail flick now and then' },
      bleat: { dur: 1.3, then: 'stand', doc: 'lift the head and bleat' },
      tremble: { loop: true, doc: 'shiver with fear, head and ears down (holds)' },
      walk: { travel: 'ground', speed: 55, then: 'stand', doc: 'trot along the ground to=' },
      pronk: { dur: 1.1, then: 'stand', doc: 'bounce in place for joy, two hops' },
      nuzzle: { dur: 2.4, then: 'stand', doc: 'rub its head against whoever is in front, eyes shut' },
      lie: { loop: true, doc: 'lie down with the legs folded (holds)' },
    },
    pose, render,
    draw: (t, state, since) => render(pose(state, since, t)),
  };
  (g.CharPuppets = g.CharPuppets || {}).lamb = lamb;
})(typeof globalThis !== 'undefined' ? globalThis : this);
