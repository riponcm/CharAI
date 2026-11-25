// gait.js - procedural gait generator for CharRig (char-lab experiment A).
// UMD: window.CharGait in the browser, module.exports in Node. Uses CharRig for foot geometry and IK.
// CharGait.pose(params, phase, character) is a pure function of phase: no state between frames.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rig.js'));
  else root.CharGait = factory(root.CharRig);
})(typeof self !== 'undefined' ? self : this, function (CharRig) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = u => u * u * (3 - 2 * u);
  const frac = x => x - Math.floor(x);
  const rot = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
  // compact bump on [0,1] with peak 1 at u = c (a scaled beta curve); n sets its sharpness
  const bump = (u, c, n) => (u <= 0 || u >= 1) ? 0 : Math.pow(u / c, c * n) * Math.pow((1 - u) / (1 - c), (1 - c) * n);
  const herm = (p0, p1, m0, m1, u) => {
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1;
  };

  // Public parameters (contract): speed, stride, cadence, duty, bounce, lean, armSwing, elbowBend,
  // kneeLift, heelKick. Extra shaping parameters below them are per-preset, rarely touched.
  //   speed    : scales ground speed; stride and cadence each grow with sqrt(speed)
  //   stride   : distance per full cycle (two steps), in leg lengths
  //   cadence  : full cycles per second at speed 1
  //   duty     : fraction of the cycle a foot is on the ground (< 0.5 = flight phase)
  //   bounce   : pelvis up/down amplitude, head heights
  //   lean     : forward torso lean, radians
  //   armSwing : arm swing amount (1 = full sprint swing)
  //   elbowBend: base elbow flexion, radians
  //   kneeLift : how high the swing knee drives in front (0..1.5)
  //   heelKick : how high the heel kicks up behind (0..1.5)
  const base = { toeUp: 0.25, toeOff: 0.6, crouch: 0, reach: 0.96, armBias: 0, stanceShift: 0, lowAt: 0.2, mouth: 'open', heelFrac: 0.22, flatFrac: 0.5 };
  const presets = {
    walk: Object.assign({}, base, { speed: 1, stride: 1.5, cadence: 0.9, duty: 0.6, bounce: 0.045, lean: 0.06, armSwing: 0.5, elbowBend: 0.3, kneeLift: 0.3, heelKick: 0.25,
      toeUp: 0.38, toeOff: 0.55, reach: 0.975, stanceShift: 0.04, lowAt: 0.1, mouth: 'smile', heelFrac: 0.25, flatFrac: 0.55 }),
    jog: Object.assign({}, base, { speed: 1, stride: 1.9, cadence: 1.15, duty: 0.44, bounce: 0.06, lean: 0.14, armSwing: 0.7, elbowBend: 1.35, kneeLift: 0.6, heelKick: 0.6,
      toeUp: 0.2, toeOff: 0.6, reach: 0.96, stanceShift: 0.0, armBias: 0.1, lowAt: 0.22, heelFrac: 0.2, flatFrac: 0.45 }),
    run: Object.assign({}, base, { speed: 1, stride: 2.3, cadence: 1.2, duty: 0.3, bounce: 0.045, lean: 0.2, armSwing: 1.0, elbowBend: 1.05, kneeLift: 1.0, heelKick: 1.0,
      toeUp: 0.15, toeOff: 0.75, reach: 0.975, stanceShift: -0.07, armBias: 0.15, lowAt: 0.24, heelFrac: 0.15, flatFrac: 0.4 }),
    sneak: Object.assign({}, base, { speed: 1, stride: 1.3, cadence: 0.55, duty: 0.66, bounce: 0.03, lean: 0.34, armSwing: 0.3, elbowBend: 1.75, kneeLift: 1.1, heelKick: 0.1,
      toeUp: -0.2, toeOff: 0.5, reach: 0.93, crouch: 0.08, stanceShift: 0.02, armBias: 0.55, lowAt: 0.15, mouth: 'neutral', heelFrac: 0.3, flatFrac: 0.55 }),
  };

  function resolve(params) {
    const name = params && params.preset;
    const p = Object.assign({}, presets[name] || presets.run, params || {});
    p.speed = Math.max(0.05, p.speed);
    p.duty = clamp(p.duty, 0.2, 0.8);
    return p;
  }
  function cycleRate(params) { const p = resolve(params); return p.cadence * Math.sqrt(p.speed); }

  function consts(ch) {
    const pr = ch.proportions, g = CharRig.footGeometry(ch);
    return { L: pr.thigh + pr.shin, l1: pr.thigh, l2: pr.shin, ah: g.ah, heel: g.heel, toe: g.toe, ground: g.ground };
  }

  // pelvis vertical offset: two bounces per cycle, lowest at step-phase lowAt (just after contact)
  const bounceNorm = (p, phase) => -Math.cos(TAU * (2 * phase - p.lowAt));      // -1 low .. +1 high
  const bounceVel = (p, phase) => Math.sin(TAU * (2 * phase - p.lowAt));        // + = moving up

  // stance: s in [0, duty). F = flat-foot ankle x relative to the pelvis, moving back at stride speed.
  // Heel-pivot while toe is up, flat, then toe-pivot at toe-off; the pivot point is fixed in world.
  function stanceFoot(p, k, S, s) {
    const d = p.duty, F = p.stanceShift * k.L + S * (d / 2 - s);
    const hp = p.heelFrac * d, fe = p.flatFrac * d;
    let a = 0;
    if (s < hp) a = p.toeUp * (1 - s / hp) * (1 - s / hp);
    else if (s > fe) { const v = (s - fe) / (d - fe); a = -p.toeOff * v * v; }
    let ankle;
    if (a >= 0) {
      const piv = [F + k.heel[0], 0];
      ankle = [piv[0] - rotX(k.heel, a), piv[1] - rotY(k.heel, a)];
    } else {
      const piv = [F + k.toe[0], 0];
      ankle = [piv[0] - rotX(k.toe, a), piv[1] - rotY(k.toe, a)];
    }
    return { ankle, a };
  }
  const rotX = (v, a) => v[0] * Math.cos(a) - v[1] * Math.sin(a);
  const rotY = (v, a) => v[0] * Math.sin(a) + v[1] * Math.cos(a);

  // pelvis height so that no stance leg ever stretches beyond `reach` of its length
  function pelvisBase(p, k, S) {
    const R = p.reach * k.L;
    let h = k.L * 0.985 + k.ah;
    const N = 96;
    for (let i = 0; i <= N; i++) {
      const s = p.duty * i / N;
      const f = stanceFoot(p, k, S, s);
      const dx = f.ankle[0];
      if (Math.abs(dx) >= R) continue;
      const hy = f.ankle[1] + Math.sqrt(R * R - dx * dx) - p.bounce * bounceNorm(p, s);
      h = Math.min(h, hy);
    }
    return h - p.crouch * k.L;
  }

  function shinDown(hip, ankle, k) {
    const r = CharRig.ik2(hip, ankle, k.l1, k.l2, +1);
    const d = [r.end[0] - r.mid[0], r.end[1] - r.mid[1]];
    return Math.atan2(d[0], -d[1]);   // 0 = shin vertical, negative = ankle behind the knee
  }
  function footMinY(k, ankle, a) {
    let m = Infinity;
    for (const q of k.ground) m = Math.min(m, ankle[1] + rotY(q, a));
    return m;
  }

  // one leg at its own local phase s (0 = heel contact). Returns ankle (x relative to pelvis) and angle.
  function legAt(p, k, S, baseH, s, rootYAt) {
    const d = p.duty;
    if (s < d) return stanceFoot(p, k, S, s);
    const u = (s - d) / (1 - d), w = 1 - d, L = k.L;
    const f0 = stanceFoot(p, k, S, d - 1e-9), f1 = stanceFoot(p, k, S, 0);
    const A0 = f0.ankle, A1 = f1.ankle;
    // x: Hermite from toe-off to contact, leaving and arriving with backward ground-speed velocity,
    // plus an early backward bump (heel kick). y: blend plus heel-kick bump plus knee-drive bump.
    // heel kick peaks while the other foot is at mid-stance, knee drive just before contact
    const ck = clamp((0.5 - d / 2) / (1 - d) - 0.04, 0.25, 0.55), cd = Math.min(0.8, ck + 0.3);
    const kick = bump(u, ck, 3.2), drive = bump(u, cd, 4);
    let x = herm(A0[0], A1[0], -S * w * 0.55, -S * w * 0.3, u) - p.heelKick * 0.42 * L * kick;
    let y = A0[1] + (A1[1] - A0[1]) * smooth(u) + p.heelKick * 0.62 * L * kick + p.kneeLift * 0.2 * L * drive
      + 0.06 * L * Math.sin(Math.PI * u);
    const hipY = rootYAt(s);
    // keep the swing ankle inside reach: soft radial clamp, identity below k0
    const R0 = (p.reach + 0.008) * L, R1 = 0.985 * L;
    const dx = x, dy = y - hipY, D = Math.hypot(dx, dy);
    if (D > R0) { const nd = R0 + (R1 - R0) * Math.tanh((D - R0) / (R1 - R0)); x = dx * nd / D; y = hipY + dy * nd / D; }
    // foot angle: interpolate the ankle angle relative to the shin, so the foot folds with the leg
    const hip = [0, hipY];
    const sh = shinDown(hip, [x, y], k);
    const rel0 = f0.a - shinDown([0, rootYAt(d)], A0, k);
    const rel1 = f1.a - shinDown([0, rootYAt(0)], A1, k);
    const a = sh + rel0 + (rel1 - rel0) * smooth(u) - 0.35 * p.heelKick * kick;
    // never through the ground
    const m = footMinY(k, [x, y], a);
    if (m < 0) y -= m;
    return { ankle: [x, y], a };
  }

  function armAt(p, ph) {
    const f = -Math.cos(TAU * (ph - 0.04));          // -1 = arm fully back, +1 = fully forward
    const amp = 1.1 * p.armSwing;
    return {
      shoulder: p.armBias + amp * f,
      elbow: Math.max(0.05, p.elbowBend * (0.5 + 0.7 * (f + 1) / 2) + 0.12 * p.armSwing * (f > 0 ? f : 0)),
      wrist: 0.15 - 0.2 * f * Math.min(1, p.armSwing),
    };
  }

  function pose(params, phase, character) {
    const p = resolve(params);
    const ch = character || CharRig.defaultCharacter();
    const k = consts(ch);
    const ph = frac(phase);
    const S = p.stride * k.L * Math.sqrt(p.speed);
    const baseH = pelvisBase(p, k, S);
    const rootYAt = q => baseH + p.bounce * bounceNorm(p, q);
    const rootY = rootYAt(ph);
    const rootX = ph * S;
    const legs = {};
    for (const [side, off] of [['near', 0], ['far', 0.5]]) {
      const s = frac(ph - off);
      const r = legAt(p, k, S, baseH, s, q => rootYAt(q + off));
      legs[side] = { foot: [rootX + r.ankle[0], r.ankle[1]], footAngle: r.a };
    }
    const bn = bounceNorm(p, ph);
    const leanOsc = -0.05 * bn * Math.min(1.5, p.bounce / 0.06);       // a touch more lean when low
    const fNear = -Math.cos(TAU * (ph - 0.04));
    const gs = S * p.cadence * Math.sqrt(p.speed);                  // ground speed, head heights / s
    const trail = 0.05 + 0.05 * gs;
    const rate = p.cadence * Math.sqrt(p.speed);
    const hairAmp = Math.min(0.6, 1.6 * p.bounce * 4 * rate * rate);   // follows vertical acceleration
    return {
      root: [rootX, rootY],
      pelvisTilt: 0.04 * bn,
      spineLean: p.lean + leanOsc,
      chestTwist: 0.14 * p.armSwing * fNear,
      neck: -0.2 * p.lean,
      headTilt: 0.12 - 0.2 * p.lean - leanOsc * 0.9,
      legs,
      arms: { near: armAt(p, ph), far: armAt(p, ph + 0.5) },
      face: { blink: 0, mouth: p.mouth, eye: [0.3, 0], brow: p.lean > 0.3 ? -0.5 : 0.2 },
      // follow-through: hair falls behind the head's vertical motion by a phase delay
      secondary: {
        hair: trail - hairAmp * bounceVel(p, ph - 0.08),
        hair2: trail - hairAmp * bounceVel(p, ph - 0.2),
        cloth: 0.5 * trail - 0.6 * hairAmp * bounceVel(p, ph - 0.1),
      },
      meta: { stride: S, phase: ph, rate: p.cadence * Math.sqrt(p.speed), speed: gs },
    };
  }

  return { presets, resolve, pose, cycleRate };
});
