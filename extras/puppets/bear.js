// puppets/bear.js - a very large, dark brown bear with gentle eyes. Format: see puppets/bird.js.
// Faces right with the feet at (0, 0). Built on a tiny skeleton: hip, shoulder and head points
// plus four paw targets; the legs are solved with two-bone IK, so every state is a set of points.
// About 300 px tall sitting, 300 on all fours to the top of the head, 390 standing, at scale 1.
// States:
//   stand    (holds) on all fours, breathing
//   lurk     (default, holds) sitting hunched in the dark: only two glowing eyes show
//   whimper  (holds) sitting, a thorn in the raised front paw, sobbing; fades up out of the dark
//            over 1.6 s (use it when a light reaches the bear)
//   relief   (1.6 s, then sit) the thorn is gone: shakes the paw, looks at it, brightens
//   sit      (holds) sitting, content
//   rise     (holds) rears up from sitting to full height on the hind legs, paws up (1.3 s)
//   bow      (holds) comes down from full height onto all fours, head low, eyes shut (1.2 s)
//   nuzzle   (2.4 s, then stand) rubs its lowered head against whoever is in front
//   walk(to) (ground, 130 px/s) lumbering walk on all fours
// The thorn's grip point in whimper is at (170, -96) in puppet px (see sets/forest.js anchor thorn).
(function (g) {
  'use strict';
  const TAU = Math.PI * 2;
  const r1 = v => Math.round(v * 10) / 10;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const lerp = (a, b, u) => a + (b - a) * u;
  const frac = x => x - Math.floor(x);
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const C = { fur: '#5e3c27', furFar: '#472c1c', furLight: '#80573a', belly: '#74503a', muzzle: '#b8916a', muzzleDark: '#8e6a4c',
    line: '#23150d', nose: '#1a100b', earIn: '#a3755a', eye: '#1b120c', claw: '#e8dcc4', pad: '#3b2519', mouth: '#5c2320',
    thorn: '#c9995c', thornLight: '#f0d2a0', glow: '#ffd25a', glowCore: '#fff3b8', tear: '#bfe4ff', night: '#08070d' };

  function blink(t) {
    const k = Math.floor(t / 3.1), bt = k * 3.1 + 0.6 + hash(k + 3) * 1.8;
    return Math.abs(t - bt) < 0.09 ? 1 : 0;
  }
  // ---- key poses (puppet px, y up is negative) ----
  const KEYS = ['hipX', 'hipY', 'shX', 'shY', 'hdX', 'hdY', 'headA', 'nfX', 'nfY', 'ffX', 'ffY', 'npX', 'npY', 'fpX', 'fpY',
    'mouth', 'eye', 'sad', 'glow', 'dark', 'thorn', 'tear', 'happy'];
  const BASE = { mouth: 0, eye: 1, sad: 0, glow: 0, dark: 0, thorn: 0, tear: 0, happy: 0, nfY: 0, ffY: 0 };
  const P = (o) => Object.assign({}, BASE, o);
  const SIT = P({ hipX: -40, hipY: -64, shX: 14, shY: -200, hdX: 30, hdY: -52, headA: 10, nfX: 62, ffX: 80, npX: 66, npY: -92, fpX: 72, fpY: -86 });
  const LURK = P({ hipX: -40, hipY: -64, shX: 22, shY: -188, hdX: 34, hdY: -40, headA: 4, nfX: 62, ffX: 80, npX: 80, npY: -100, fpX: 72, fpY: -86, glow: 1, dark: 1, thorn: 1 });
  const WHIMPER = P({ hipX: -40, hipY: -64, shX: 40, shY: -190, hdX: 34, hdY: -46, headA: 20, nfX: 62, ffX: 80, npX: 138, npY: -88, fpX: 80, fpY: -84, sad: 1, thorn: 1, eye: 0.6, tear: 1 });
  const UP = P({ hipX: -18, hipY: -128, shX: -4, shY: -276, hdX: 36, hdY: -30, headA: -14, nfX: -8, ffX: 18, npX: 80, npY: -385, fpX: 48, fpY: -400, mouth: 0.55 });
  const FOURS = P({ hipX: -78, hipY: -122, shX: 70, shY: -128, hdX: 66, hdY: -8, headA: 6, nfX: -84, ffX: -62, npX: 78, npY: 0, fpX: 100, fpY: 0 });
  const BOW = P({ hipX: -74, hipY: -126, shX: 74, shY: -112, hdX: 100, hdY: 6, headA: 30, nfX: -84, ffX: -62, npX: 86, npY: 0, fpX: 104, fpY: 0, eye: 0, happy: 1 });
  const mix = (A, B, u) => { const o = {}; for (const k of KEYS) o[k] = lerp(A[k], B[k], u); return o; };

  function pose(state, since, t) {
    let p;
    const br = Math.sin(t * 1.7);   // breathing
    if (state === 'lurk') {
      p = Object.assign({}, LURK);
      p.shY += 2 * br; p.headA += 4 * Math.sin(t * 0.6);
      p.glow = 0.85 + 0.15 * Math.sin(t * 2.1);
      p.eye = blink(t) ? 0 : 1;
    } else if (state === 'whimper') {
      p = Object.assign({}, WHIMPER);
      const sob = Math.pow(Math.max(0, Math.sin(t * TAU * 0.75)), 2);
      p.shY += -5 * sob + 2 * br; p.hdY += 4 * sob; p.headA += 4 * sob;
      p.mouth = 0.2 + 0.5 * sob;
      p.npX += 2.2 * Math.sin(t * 31); p.npY += 2 * Math.sin(t * 27 + 1);   // the hurt paw trembles
      p.dark = 1 - smooth(since / 1.6);
      p.glow = 1 - smooth(since / 0.9);
      p.tear = frac(t / 1.6) + 0.001;
      p.eye = blink(t) ? 0 : 0.6;
      if (since < 0.6) p.mouth *= since / 0.6;
    } else if (state === 'relief') {
      const u = clamp(since / 1.6, 0, 1), env = Math.sin(Math.PI * Math.min(1, since / 0.9));
      p = mix(WHIMPER, SIT, smooth((since - 0.7) / 0.9));
      p.thorn = 0; p.tear = 0; p.sad = 1 - smooth(since / 0.6); p.eye = blink(t) ? 0 : lerp(0.7, 1, smooth(since / 0.5));
      p.npY += 12 * env * Math.sin(since * 22); p.npX += 4 * env * Math.sin(since * 22 + 1);   // shakes the paw
      p.headA = lerp(28, 6, smooth((since - 0.6) / 0.8)); p.hdX += 4 * env;
      p.mouth = 0.35 * env; p.happy = smooth((since - 0.5) / 0.8) * (1 - u * 0);
    } else if (state === 'sit') {
      p = Object.assign({}, SIT);
      p.shY += 2 * br; p.headA += 3 * Math.sin(t * 0.7); p.eye = blink(t) ? 0 : 1; p.happy = 0.6;
    } else if (state === 'rise') {
      const u = smooth(since / 1.3), o = Math.sin(Math.PI * clamp((since - 1.0) / 0.6, 0, 1));
      p = mix(SIT, UP, u);
      p.shY -= 6 * o; p.hdY -= 4 * o;   // a little overshoot at the top
      p.mouth = UP.mouth * smooth((since - 0.7) / 0.4) * (0.75 + 0.25 * Math.sin(t * 5));
      p.npX += 3 * Math.sin(t * 2.2) * u; p.fpX += 3 * Math.sin(t * 2.4 + 1) * u;
      p.eye = blink(t) ? 0 : 1;
    } else if (state === 'bow') {
      const u = smooth(since / 1.2);
      p = mix(UP, BOW, u);
      p.eye = lerp(1, 0, smooth((since - 0.7) / 0.4));
      p.hdY += 2 * Math.sin(t * 1.4) * u; p.headA += 2 * Math.sin(t * 1.1) * u;
      p.happy = u;
    } else if (state === 'nuzzle') {
      p = Object.assign({}, BOW);
      const w = Math.min(1, since / 0.3), env = Math.sin(Math.PI * Math.min(1, since / 2.4));
      p.hdX += 8 * w * env * Math.sin(since * 6.5) + 6 * w; p.hdY += 4 * env * Math.sin(since * 6.5 + 1.2);
      p.headA += 7 * env * Math.sin(since * 6.5 + 0.4);
      p.eye = 0; p.happy = 1; p.mouth = 0.12 * env;
    } else if (state === 'walk') {
      p = Object.assign({}, FOURS);
      const f = 0.85, ph = since * TAU * f, A = 30;
      const foot = (base, phase) => [base + A * Math.sin(ph + phase), 13 * Math.max(0, Math.cos(ph + phase))];
      let q;
      q = foot(FOURS.nfX, 0); p.nfX = q[0]; p.nfY = q[1];
      q = foot(FOURS.npX, Math.PI / 2); p.npX = q[0]; p.npY = -q[1];
      q = foot(FOURS.ffX, Math.PI); p.ffX = q[0]; p.ffY = q[1];
      q = foot(FOURS.fpX, 1.5 * Math.PI); p.fpX = q[0]; p.fpY = -q[1];
      p.hipY += 3 * Math.sin(2 * ph); p.shY += 3 * Math.sin(2 * ph + 1.2);
      p.hdY += 3 * Math.sin(2 * ph + 1.6); p.headA += 3 * Math.sin(2 * ph);
      p.eye = blink(t) ? 0 : 1; p.happy = 0.8;
    } else {   // stand
      p = Object.assign({}, FOURS);
      p.shY += 2 * br; p.hipY += 1 * br; p.headA += 4 * Math.sin(t * 0.6); p.hdY += 2 * Math.sin(t * 0.9);
      p.eye = blink(t) ? 0 : 1; p.happy = 0.5;
    }
    return p;
  }

  // two-bone IK: from root R toward target T with segment lengths a, b; s = +1 / -1 picks the bend side
  function ik(R, T, a, b, s) {
    const dx = T[0] - R[0], dy = T[1] - R[1], d0 = Math.hypot(dx, dy) || 1;
    const d = clamp(d0, Math.abs(a - b) + 1, a + b - 0.5), th = Math.atan2(dy, dx);
    const A = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
    const J = [R[0] + a * Math.cos(th + s * A), R[1] + a * Math.sin(th + s * A)];
    return [J, [R[0] + d * Math.cos(th), R[1] + d * Math.sin(th)]];
  }
  function hexMix(c1, c2, u) {
    const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
    const ch = (v, s) => (v >> s) & 255;
    const m = s => Math.round(lerp(ch(a, s), ch(b, s), u));
    return '#' + ((1 << 24) + (m(16) << 16) + (m(8) << 8) + m(0)).toString(16).slice(1);
  }
  const seg = (A, B, w, col) => `<path d="M${r1(A[0])} ${r1(A[1])}L${r1(B[0])} ${r1(B[1] + (Math.abs(A[0] - B[0]) + Math.abs(A[1] - B[1]) < 0.2 ? 0.2 : 0))}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;

  function render(p) {
    const dk = clamp(p.dark, 0, 1);
    const K = c => dk > 0.001 ? hexMix(c, C.night, 0.93 * dk) : c;
    const LN = K(C.line), OW = 6;
    const hip = [p.hipX, p.hipY], sh = [p.shX, p.shY];
    const head = [p.shX + p.hdX, p.shY + p.hdY];
    // limbs: hind legs bend the knee forward, front legs bend the elbow back
    const hindN = ik(hip, [p.nfX, -p.nfY], 74, 62, -1), hindF = ik([hip[0] + 10, hip[1] - 4], [p.ffX, -p.ffY], 74, 62, -1);
    const frontN = ik(sh, [p.npX, p.npY], 72, 62, 1), frontF = ik([sh[0] + 8, sh[1] - 6], [p.fpX, p.fpY], 72, 62, 1);
    const limb = (R, kj, col, w1, w2, foot) => {
      const [J, E] = kj;
      const outl = seg(R, J, w1 + OW, LN) + seg(J, E, w2 + OW, LN) + foot(E, LN, OW);
      const fill = seg(R, J, w1, col) + seg(J, E, w2, col) + foot(E, col, 0);
      return outl + fill;
    };
    const hindFoot = (E, col, o) => `<ellipse cx="${r1(E[0] + 10)}" cy="${r1(E[1] - 9)}" rx="${r1(26 + o / 2)}" ry="${r1(12 + o / 2)}" fill="${col}"/>`;
    const paw = (E, col, o) => `<circle cx="${r1(E[0])}" cy="${r1(E[1])}" r="${r1(21 + o / 2)}" fill="${col}"/>`;
    const claws = (E, dir) => {
      let o = '';
      for (let k = -1; k <= 1; k++) o += `<path d="M${r1(E[0] + 14 * dir)} ${r1(E[1] + k * 8 + 4)}l${r1(7 * dir)} ${r1(2 + k)}" stroke="${K(C.claw)}" stroke-width="2.6" stroke-linecap="round"/>`;
      return o;
    };
    let o = '';
    // far limbs
    const farHip = [hip[0] + 10, hip[1] - 4], farSh = [sh[0] + 8, sh[1] - 6];
    o += limb(farHip, hindF, K(C.furFar), 58, 44, hindFoot);
    o += limb(farSh, frontF, K(C.furFar), 50, 42, paw);
    // body: a fat capsule from hip to shoulder, a hump, a lighter belly
    const dx = sh[0] - hip[0], dy = sh[1] - hip[1], dl = Math.hypot(dx, dy) || 1;
    const n = [-dy / dl, dx / dl];   // points to the belly side
    const hump = [sh[0] - n[0] * 26 - dx / dl * 10, sh[1] - n[1] * 26 - dy / dl * 10];
    o += seg(hip, sh, 136 + OW, LN) + `<circle cx="${r1(hump[0])}" cy="${r1(hump[1])}" r="${58 + OW / 2}" fill="${LN}"/>`;
    o += seg(hip, sh, 136, K(C.fur)) + `<circle cx="${r1(hump[0])}" cy="${r1(hump[1])}" r="58" fill="${K(C.fur)}"/>`;
    const b0 = [hip[0] + dx * 0.2 + n[0] * 34, hip[1] + dy * 0.2 + n[1] * 34], b1 = [hip[0] + dx * 0.8 + n[0] * 34, hip[1] + dy * 0.8 + n[1] * 34];
    o += seg(b0, b1, 58, K(C.belly));
    const t0 = [hip[0] + dx * 0.15 - n[0] * 44, hip[1] + dy * 0.15 - n[1] * 44], t1 = [hump[0] - n[0] * 22, hump[1] - n[1] * 22];
    o += `<g opacity="0.45">${seg(t0, t1, 18, K(C.furLight))}</g>`;
    // near hind leg; a raised front leg goes behind the head (rearing up), otherwise in front
    o += limb(hip, hindN, K(C.fur), 66, 48, hindFoot);
    const frontLeg = () => {
      let f = limb(sh, frontN, K(C.fur), 54, 46, paw);
      const E = frontN[1];
      f += `<ellipse cx="${r1(E[0] + 6)}" cy="${r1(E[1] + 4)}" rx="9" ry="7" fill="${K(C.pad)}" opacity="0.7"/>` + claws(E, 1);
      if (p.thorn > 0.5) {
        const bx = E[0] + 15, by = E[1] - 4;
        f += `<path d="M${r1(bx)} ${r1(by - 6)}L${r1(bx + 34)} ${r1(by - 11)}L${r1(bx)} ${r1(by + 5)}Z" fill="${K(C.thorn)}" stroke="${LN}" stroke-width="1.6" stroke-linejoin="round"/>`;
        f += `<path d="M${r1(bx + 2)} ${r1(by - 3)}L${r1(bx + 26)} ${r1(by - 9)}" stroke="${K(C.thornLight)}" stroke-width="1.6" stroke-linecap="round"/>`;
      }
      return f;
    };
    const raised = p.npY < p.shY - 50;
    if (raised) o += frontLeg();
    // neck and head
    o += seg(sh, head, 90 + OW, LN) + seg(sh, head, 90, K(C.fur));
    o += `<g transform="translate(${r1(head[0])} ${r1(head[1])}) rotate(${r1(p.headA)})">`;
    const ear = (x, y, col) => `<circle cx="${x}" cy="${y}" r="${15 + OW / 2}" fill="${LN}"/><circle cx="${x}" cy="${y}" r="15" fill="${col}"/><circle cx="${x + 1}" cy="${y + 1}" r="7.5" fill="${K(C.earIn)}"/>`;
    o += ear(14, -42, K(C.furFar));
    o += `<circle cx="0" cy="0" r="${46 + OW / 2}" fill="${LN}"/>` + ear(-22, -36, K(C.fur)) + `<circle cx="0" cy="0" r="46" fill="${K(C.fur)}"/>`;
    o += `<path d="M-30 -24Q-10 -40 16 -36" fill="none" stroke="${K(C.furLight)}" stroke-width="7" stroke-linecap="round" opacity="0.5"/>`;
    // muzzle, nose, mouth
    o += `<ellipse cx="36" cy="14" rx="${30 + OW / 2}" ry="${21 + OW / 2}" fill="${LN}"/><ellipse cx="36" cy="14" rx="30" ry="21" fill="${K(C.muzzle)}"/>`;
    o += `<path d="M18 30Q34 36 52 31" fill="none" stroke="${K(C.muzzleDark)}" stroke-width="3" opacity="0.6"/>`;
    o += `<ellipse cx="60" cy="4" rx="11.5" ry="8.5" fill="${K(C.nose)}"/><ellipse cx="57" cy="1" rx="4" ry="2.4" fill="${K('#6a5248')}"/>`;
    o += `<path d="M58 12L56 22" stroke="${K(C.nose)}" stroke-width="2.4" stroke-linecap="round"/>`;
    if (p.mouth > 0.06) o += `<ellipse cx="50" cy="${r1(25 + 3 * p.mouth)}" rx="${r1(7 + 3 * p.mouth)}" ry="${r1(1.5 + 8 * p.mouth)}" fill="${K(C.mouth)}" stroke="${LN}" stroke-width="2.4"/>`;
    else o += `<path d="M42 ${r1(25 - 3 * p.happy)}Q49 ${r1(29 + 2 * p.happy)} 56 22" fill="none" stroke="${LN}" stroke-width="2.6" stroke-linecap="round"/>`;
    // eyes: near (bigger) and far (3/4 view); open, half-open or shut happy curves; sad brows
    const eyeAt = (x, y, r) => {
      if (p.eye < 0.12) return `<path d="M${x - r - 1} ${y + 1}Q${x} ${r1(y - r * (0.9 * p.happy) + r * 0.6 * (1 - p.happy))} ${x + r + 1} ${y + 1}" fill="none" stroke="${LN}" stroke-width="2.8" stroke-linecap="round"/>`;
      const ry = r1(r * clamp(p.eye, 0.2, 1));
      return `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${ry}" fill="${K(C.eye)}"/><circle cx="${r1(x + r * 0.35)}" cy="${r1(y - r * 0.35 * p.eye)}" r="${r1(r * 0.38)}" fill="#fff" opacity="${r1(1 - dk * 0.9)}"/>` +
        (p.eye < 0.9 ? `<path d="M${x - r - 2} ${r1(y - ry)}L${x + r + 2} ${r1(y - ry)}" stroke="${K(C.fur)}" stroke-width="3"/>` : '');
    };
    o += eyeAt(12, -10, 6.8) + eyeAt(37, -13, 5);
    const sd = p.sad;
    o += `<path d="M1 ${r1(-22 + 5 * sd)}Q11 ${r1(-27 - sd)} 22 ${r1(-25 - 5 * sd)}" fill="none" stroke="${K(C.furFar)}" stroke-width="4" stroke-linecap="round"/>`;
    o += `<path d="M31 ${r1(-27 + 1 * sd)}L43 ${r1(-27 - 4 * sd)}" fill="none" stroke="${K(C.furFar)}" stroke-width="3.4" stroke-linecap="round"/>`;
    if (p.tear > 0.01 && p.sad > 0.5 && dk < 0.6) {
      const ty = -2 + 30 * p.tear, op = r1((1 - p.tear) * (1 - dk));
      o += `<path d="M10 ${r1(ty - 6)}Q14 ${r1(ty)} 10 ${r1(ty + 3)}Q6 ${r1(ty)} 10 ${r1(ty - 6)}Z" fill="${C.tear}" opacity="${op}"/>`;
    }
    // glowing eyes, drawn over everything else on the head (they shine in the dark)
    if (p.glow > 0.02 && p.eye > 0.3) {
      for (const [x, y, r] of [[12, -10, 7], [37, -13, 5.5]]) {
        o += `<circle cx="${x}" cy="${y}" r="${r * 3.4}" fill="${C.glow}" opacity="${r1(0.12 * p.glow * 100) / 100}"/><circle cx="${x}" cy="${y}" r="${r * 1.7}" fill="${C.glow}" opacity="${r1(0.3 * p.glow * 100) / 100}"/>`;
        o += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r1(r * p.eye)}" fill="${C.glowCore}" opacity="${r1(p.glow * 100) / 100}"/>`;
      }
    }
    o += '</g>';
    // near front leg, paw, claws and the thorn
    if (!raised) o += frontLeg();
    return o;
  }

  const bear = {
    name: 'bear', height: 300, initial: 'lurk', blend: 0.3,
    states: {
      stand: { loop: true, doc: 'stand on all fours, breathing (holds)' },
      lurk: { loop: true, doc: 'sit hunched in the dark: only two glowing eyes show (holds)' },
      whimper: { loop: true, doc: 'sit holding up a paw with a thorn in it, sobbing; fades up out of the dark over 1.6 s (holds)' },
      relief: { dur: 1.6, then: 'sit', doc: 'the thorn is gone: shake the paw, look at it, brighten' },
      sit: { loop: true, doc: 'sit, content (holds)' },
      rise: { loop: true, doc: 'rear up to full height on the hind legs, paws up (1.3 s, then holds)' },
      bow: { loop: true, doc: 'come down onto all fours and lower the head, eyes shut (1.2 s, then holds)' },
      nuzzle: { dur: 2.4, then: 'stand', doc: 'rub the lowered head against whoever is in front' },
      walk: { travel: 'ground', speed: 130, then: 'stand', doc: 'lumber along the ground on all fours to=' },
    },
    pose, render,
    draw: (t, state, since) => render(pose(state, since, t)),
  };
  (g.CharPuppets = g.CharPuppets || {}).bear = bear;
})(typeof globalThis !== 'undefined' ? globalThis : this);
