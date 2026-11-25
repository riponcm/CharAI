/* char.js: 2D character animation engine, one file, no dependencies. Built by tools/build.cjs from src/. */
(function () {
var G = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : this;

// ---- src/rig.js ----
(function (module, exports, require) {
// rig.js - parametric side-view cut-out character rig (char-lab experiment A).
// UMD: window.CharRig in the browser, module.exports in Node. No dependencies.
// Rig space: y up, ground at y = 0, units are head heights. Character faces +x.
// All functions are pure; render() returns an SVG <g> string.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CharRig = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- vector helpers ----------
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const len = a => Math.hypot(a[0], a[1]);
  const dir = ang => [Math.cos(ang), Math.sin(ang)];
  const rot = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
  // local frame: origin o, x axis at math angle ang (CCW), y axis 90 deg CCW from it
  const frame = (o, ang) => p => add(o, rot(p, ang));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ---------- character ----------
  function defaultCharacter() {
    return {
      name: 'Leo',
      proportions: {
        head: 1, neck: 0.11, torso: 0.78, shoulderDrop: 0.14,
        upperArm: 0.44, foreArm: 0.42, hand: 1.3,      // hand = scale of the hand shape
        thigh: 0.66, shin: 0.64,
        ankleHeight: 0.12,              // ankle above sole
        heel: [-0.15, -0.12],           // heel pivot relative to ankle (foot frame)
        toe: [0.47, -0.12],             // toe pivot relative to ankle (foot frame)
        farShoulder: [-0.03, -0.02],    // far shoulder offset in torso frame (depth cue)
        radius: {
          hip: 0.19, knee: 0.13, hem: 0.2, shoulder: 0.085, elbow: 0.068, wrist: 0.058,
          neck: 0.095, sleeve: 0.12, sleeveEnd: 0.115,
        },
      },
      palette: {
        skin: '#f4c19c', hair: '#b9462a', hairDark: '#7e2a18', top: '#f3b52f', topAccent: '#2f6f9a',
        bottom: '#3e6f62', bottomSeam: '#2c5248', shoe: '#6c4bc2', sole: '#f6f0e4', lace: '#f6f0e4',
        outline: '#2a1b18', eyeWhite: '#ffffff', iris: '#3c8a4a', pupil: '#1b1412',
        mouth: '#7a2630', tongue: '#e2707c', blush: '#f29b8b', freckle: '#c9805e',
      },
      style: {
        outline: 0.034,          // visible outline width in head units; 0 = flat, no outline
        line: 0.026,             // inner detail line width
        limbTaper: 1,            // multiplies the taper between joint radii
        hands: 'fingers',        // 'fingers' | 'mitten'
        hair: 'ponytail',
        farShade: 0.88,          // far limbs are darkened by this factor
      },
      // hair, all in head frame (origin = top of neck, y up, 1 = head height).
      //   cap: outline of the hair mass; locks: short tufts (anchor, direction in deg with
      //   180 = backward, length, width, bend, follow = share of the secondary lag);
      //   tail: a ponytail chain whose segments lag progressively (follow-through)
      hair: {
        cap: [[0.40, 0.80], [0.47, 0.93], [0.38, 1.07], [0.16, 1.15], [-0.12, 1.13], [-0.35, 1.02], [-0.47, 0.80],
          [-0.47, 0.55], [-0.40, 0.38], [-0.30, 0.40], [-0.22, 0.58], [-0.08, 0.68], [0.08, 0.72], [0.20, 0.80], [0.31, 0.79]],
        locks: [
          { at: [0.24, 1.04], deg: -70, len: 0.2, w: 0.17, bend: 0.03, follow: 0.25 },
          { at: [0.38, 0.97], deg: -58, len: 0.17, w: 0.15, bend: 0.03, follow: 0.2 },
          { at: [-0.44, 0.52], deg: 236, len: 0.13, w: 0.14, bend: 0.02, follow: 0.6 },
        ],
        tail: { at: [-0.42, 0.95], deg: 222, curl: 12, seg: [0.2, 0.2, 0.19, 0.16], width: [0.16, 0.22, 0.2, 0.14, 0.06] },
        tie: 'topAccent',
      },
    };
  }

  // ---------- IK ----------
  // two-bone IK from a to target with bone lengths l1, l2. side=+1 puts the middle joint on the
  // CCW side of the a->target line (knee forward for a leg hanging down), -1 the other side.
  // stretch (>= 1, optional): when the target is out of reach, both bones may lengthen up to this
  // factor instead of the target being clamped (squash-and-stretch for fast poses).
  function ik2(a, target, l1, l2, side, stretch) {
    let d = sub(target, a);
    let D = len(d);
    if (stretch > 1) {
      const f = clamp(D / ((l1 + l2) * 0.9999), 1, stretch);
      l1 *= f; l2 *= f;
    }
    const maxD = (l1 + l2) * 0.9999, minD = Math.abs(l1 - l2) + 1e-6;
    let t = target;
    if (D > maxD || D < minD) {
      const nd = clamp(D, minD, maxD);
      d = D > 1e-9 ? mul(d, nd / D) : [0, -nd];
      D = nd; t = add(a, d);
    }
    const u = mul(d, 1 / D);
    const along = (l1 * l1 - l2 * l2 + D * D) / (2 * D);
    const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    const n = [-u[1] * side, u[0] * side];
    return { mid: add(add(a, mul(u, along)), mul(n, h)), end: t };
  }
  // interior angle at b in the chain a-b-c, returns bend = pi - interior (0 = straight)
  function bendAt(a, b, c) {
    const u = sub(a, b), v = sub(c, b);
    const cs = (u[0] * v[0] + u[1] * v[1]) / (len(u) * len(v));
    return Math.PI - Math.acos(clamp(cs, -1, 1));
  }

  // ---------- foot ----------
  function footGeometry(ch) {
    const pr = ch.proportions, ah = pr.ankleHeight;
    // shoe contour in foot frame (origin = ankle, x forward along the sole, y up)
    const upper = [[-0.19, -0.075], [-0.19, 0.02], [-0.12, 0.10], [0.0, 0.11], [0.08, 0.08], [0.2, 0.055],
      [0.34, 0.045], [0.45, 0.005], [0.49, -0.06]];
    const sole = [[-0.19, -0.075], [0.485, -0.075], [0.495, -0.09], [0.47, -ah], [-0.15, -ah], [-0.19, -0.098]];
    // a skin may give its own contact contour (foot frame) so ground checks match its drawn shoe
    const ground = pr.footGround || sole.concat(upper);
    return { ah, heel: pr.heel, toe: pr.toe, upper, sole, ground };
  }
  function footPoints(ch, ankle, angle) {
    const g = footGeometry(ch), F = frame(ankle, angle);
    return { heel: F(g.heel), toe: F(g.toe), ground: g.ground.map(F) };
  }

  // ---------- solve ----------
  function torsoAngle(pose) { return -(pose.spineLean || 0); }
  function solve(ch, pose) {
    const pr = ch.proportions;
    const J = {}, A = {}, B = {};
    const rootP = pose.root || [0, pr.thigh + pr.shin + pr.ankleHeight];
    J.root = rootP;
    const ta = torsoAngle(pose);
    A.torso = ta; A.pelvis = ta * 0.4 - (pose.pelvisTilt || 0);
    const T = frame(rootP, ta);
    const twist = pose.chestTwist || 0;
    // spine: torsoBend (radians, + = chest curls forward) and torsoStretch (1 = rest; area is kept)
    const tb = pose.torsoBend || 0, ts = clamp(pose.torsoStretch || 1, 0.6, 1.5);
    const sp = makeSpine(rootP, ta, pr.torso, tb, ts);
    let na;
    if (tb === 0 && ts === 1) {
      J.neckBase = T([0.0, pr.torso]);
      na = ta - (pose.neck || 0);
      J['shoulder.near'] = T([0.02 + twist * 0.12, pr.torso - pr.shoulderDrop]);
      J['shoulder.far'] = T([0.02 + pr.farShoulder[0] - twist * 0.12, pr.torso - pr.shoulderDrop + pr.farShoulder[1]]);
      A.chest = ta;
    } else {
      const top = spineWarp(sp, [0, pr.torso]);
      J.neckBase = top.p; A.chest = top.a;
      na = top.a - (pose.neck || 0);
      J['shoulder.near'] = spineWarp(sp, [0.02 + twist * 0.12, pr.torso - pr.shoulderDrop]).p;
      J['shoulder.far'] = spineWarp(sp, [0.02 + pr.farShoulder[0] - twist * 0.12, pr.torso - pr.shoulderDrop + pr.farShoulder[1]]).p;
    }
    J.headBase = add(J.neckBase, rot([0, pr.neck], na));
    A.neck = na;
    A.head = na - (pose.headTilt || 0);
    for (const side of ['near', 'far']) {
      // legs: IK to ankle target, knee always forward
      const leg = (pose.legs && pose.legs[side]) || {};
      const hip = rootP;
      const ankleT = leg.foot || [rootP[0], pr.ankleHeight];
      const r = ik2(hip, ankleT, pr.thigh, pr.shin, +1, pose.stretch);
      J['hip.' + side] = hip; J['knee.' + side] = r.mid; J['ankle.' + side] = r.end;
      A['foot.' + side] = leg.footAngle || 0;
      const fp = footPoints(ch, r.end, A['foot.' + side]);
      J['heel.' + side] = fp.heel; J['toe.' + side] = fp.toe;
      B['knee.' + side] = bendAt(hip, r.mid, r.end);
      // arms: FK angles (relative to torso; 0 = hanging along the spine, + = forward)
      // or IK to a hand target with the elbow pointing back
      const arm = (pose.arms && pose.arms[side]) || {};
      const sh = J['shoulder.' + side];
      let el, wr, handA;
      const ast = clamp(arm.stretch || 1, 1, 1.12);
      if (arm.hand) {
        const rr = ik2(sh, arm.hand, pr.upperArm, pr.foreArm, -1, ast);
        el = rr.mid; wr = rr.end;
        const fa = Math.atan2(wr[1] - el[1], wr[0] - el[0]);
        handA = fa + (arm.bend || 0);
      } else {
        const ua = ta - Math.PI / 2 + (arm.shoulder || 0);
        const fa = ua + Math.max(0, arm.elbow || 0);
        el = add(sh, mul(dir(ua), pr.upperArm * ast));
        wr = add(el, mul(dir(fa), pr.foreArm * ast));
        handA = fa + (arm.wrist || 0);
      }
      J['elbow.' + side] = el; J['wrist.' + side] = wr;
      A['hand.' + side] = handA;
      B['elbow.' + side] = bendAt(sh, el, wr);
    }
    return { joints: J, angles: A, bends: B, spine: sp };
  }

  // ---------- shape helpers ----------
  const fx = v => (Math.round(v * 1000) / 1000).toString();
  const P = p => fx(p[0]) + ' ' + fx(p[1]);
  function polyD(pts) { return 'M' + pts.map(P).join('L') + 'Z'; }
  // closed Catmull-Rom spline through pts, as cubic Beziers
  function blobD(pts, t) {
    t = t === undefined ? 1 : t;
    const n = pts.length; let d = 'M' + P(pts[0]);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1 = add(p1, mul(sub(p2, p0), t / 6)), c2 = sub(p2, mul(sub(p3, p1), t / 6));
      d += 'C' + P(c1) + ' ' + P(c2) + ' ' + P(p2);
    }
    return d + 'Z';
  }
  function curveD(pts, t) {
    t = t === undefined ? 1 : t;
    const n = pts.length; let d = 'M' + P(pts[0]);
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      const c1 = add(p1, mul(sub(p2, p0), t / 6)), c2 = sub(p2, mul(sub(p3, p1), t / 6));
      d += 'C' + P(c1) + ' ' + P(c2) + ' ' + P(p2);
    }
    return d;
  }
  function circlePts(c, r, n) { const o = []; n = n || 20; for (let i = 0; i < n; i++) o.push(add(c, mul(dir(i / n * 2 * Math.PI), r))); return o; }
  function ellipsePts(F, c, rx, ry, n) { const o = []; n = n || 20; for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI; o.push(F([c[0] + rx * Math.cos(a), c[1] + ry * Math.sin(a)])); } return o; }
  // tapered capsule between circles (A, ra) and (B, rb); flatB gives a straight cut at B (hems)
  function capsulePts(A, ra, B, rb, flatB, n) {
    n = n || 12;
    const d = sub(B, A), D = len(d);
    if (D < 1e-6) return circlePts(A, Math.max(ra, rb), 2 * n);
    const th = Math.atan2(d[1], d[0]);
    const al = Math.asin(clamp((ra - rb) / D, -0.95, 0.95));
    const pts = [];
    if (flatB) {
      pts.push(add(B, mul(dir(th - Math.PI / 2), rb)), add(B, mul(dir(th + Math.PI / 2), rb)));
    } else {
      for (let i = 0; i <= n; i++) { const a = th - Math.PI / 2 + al + (Math.PI - 2 * al) * i / n; pts.push(add(B, mul(dir(a), rb))); }
    }
    for (let i = 0; i <= n; i++) { const a = th + Math.PI / 2 - al + (Math.PI + 2 * al) * i / n; pts.push(add(A, mul(dir(a), ra))); }
    return pts;
  }
  function shade(hex, k) {
    const v = parseInt(hex.slice(1), 16);
    const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map(x => Math.round(x * k));
    return '#' + c.map(x => x.toString(16).padStart(2, '0')).join('');
  }
  // ---------- soft limbs: one continuous tube through the joints ----------
  // C: centre points, R: radii. One closed outline: round caps (or flat), the outer side of each
  // bend goes round the joint, the inner side meets in a softened crease. No seam, no hinge circle.
  const arcTo = (c, r, from, to, p) => {
    const a0 = Math.atan2(from[1], from[0]), a1 = Math.atan2(to[1], to[0]);
    let span = a0 - a1; while (span < 0) span += 2 * Math.PI; while (span >= 2 * Math.PI) span -= 2 * Math.PI;
    return `A${fx(r)} ${fx(r)} 0 ${span > Math.PI ? 1 : 0} 0 ${P(p)}`;      // clockwise (angle decreasing)
  };
  function tubeSide(C, R) {
    const n = C.length, sg = [];
    for (let i = 0; i < n - 1; i++) {
      const d = sub(C[i + 1], C[i]), D = len(d) || 1e-6, u = mul(d, 1 / D), nn = [-u[1], u[0]];
      const s = clamp((R[i] - R[i + 1]) / D, -0.95, 0.95), c = Math.sqrt(1 - s * s);
      const m = add(mul(nn, c), mul(u, s));
      sg.push({ u, m, D, a: add(C[i], mul(m, R[i])), b: add(C[i + 1], mul(m, R[i + 1])) });
    }
    let d = '';
    for (let k = 1; k < n - 1; k++) {
      const s0 = sg[k - 1], s1 = sg[k], cr = s0.u[0] * s1.u[1] - s0.u[1] * s1.u[0];
      if (cr < -1e-4) d += 'L' + P(s0.b) + arcTo(C[k], R[k], s0.m, s1.m, s1.a);
      else if (cr > 1e-4) {
        // inner side: where the two edge lines cross, rounded off a little
        const e0 = sub(s0.b, s0.a), e1 = sub(s1.b, s1.a), den = e0[0] * e1[1] - e0[1] * e1[0];
        const w = sub(s1.a, s0.a), tt = (w[0] * e1[1] - w[1] * e1[0]) / den;
        const X = add(s0.a, mul(e0, clamp(tt, 0, 1.5)));
        const f = Math.min(0.7 * R[k], 0.35 * s0.D, 0.35 * s1.D);
        d += 'L' + P(sub(X, mul(s0.u, f))) + 'Q' + P(X) + ' ' + P(add(X, mul(s1.u, f)));
      } else d += 'L' + P(s0.b) + 'L' + P(s1.a);
    }
    return { d: d + 'L' + P(sg[sg.length - 1].b), first: sg[0], last: sg[sg.length - 1] };
  }
  function tubeD(C, R, flat0, flat1) {
    const n = C.length;
    const A = tubeSide(C, R), B = tubeSide(C.slice().reverse(), R.slice().reverse());
    let d = 'M' + P(A.first.a) + A.d;
    d += flat1 ? 'L' + P(B.first.a) : arcTo(C[n - 1], R[n - 1], A.last.m, B.first.m, B.first.a);
    d += B.d;
    d += flat0 ? 'L' + P(A.first.a) : arcTo(C[0], R[0], B.last.m, A.first.m, A.first.a);
    return d + 'Z';
  }
  // the part of a joint chain between fractions f0..f1 of its length (beyond 0..1 extends the end bones)
  function subChain(C, R, f0, f1) {
    const cum = [0];
    for (let i = 1; i < C.length; i++) cum.push(cum[i - 1] + len(sub(C[i], C[i - 1])));
    const tot = cum[cum.length - 1] || 1e-6;
    const at = f => {
      const s = f * tot;
      let i = 0;
      while (i < C.length - 2 && cum[i + 1] < s) i++;
      const u = (s - cum[i]) / Math.max(1e-6, cum[i + 1] - cum[i]);
      return [add(C[i], mul(sub(C[i + 1], C[i]), u)), R[i] + (R[i + 1] - R[i]) * clamp(u, 0, 1)];
    };
    const pts = [], rs = [];
    const a = at(f0); pts.push(a[0]); rs.push(a[1]);
    for (let i = 1; i < C.length - 1; i++) if (cum[i] / tot > f0 + 1e-4 && cum[i] / tot < f1 - 1e-4) { pts.push(C[i]); rs.push(R[i]); }
    const b = at(f1); pts.push(b[0]); rs.push(b[1]);
    return { C: pts, R: rs };
  }

  // ---------- torso: a short spine that bends and squashes (keeping area) ----------
  // sp = sol.spine. p is a point in the torso frame (origin pelvis, y up, head units). Returns the
  // rig point and the angle of the local frame there.
  function spineWarp(sp, p) {
    const Tl = sp.T * sp.ts, x = p[0] / sp.ts, y = p[1] * sp.ts, b = sp.tb;
    let q, th = 0;
    if (Math.abs(b) < 1e-5) q = [x, y];
    else {
      const kk = b / Tl, yy = clamp(y, 0, Tl);
      th = kk * yy;
      const cs = Math.cos(th), sn = Math.sin(th), e = y - yy;
      q = [(1 - cs) / kk + x * cs + e * sn, sn / kk - x * sn + e * cs];
    }
    return { p: add(sp.root, rot(rot(q, sp.phi), sp.ta)), a: sp.ta + sp.phi - th };
  }
  function makeSpine(root, ta, T, tb, ts) {
    let phi = 0;
    if (Math.abs(tb) >= 1e-5) { const Tl = T * ts, kk = tb / Tl; phi = Math.atan2((1 - Math.cos(tb)) / kk, Math.sin(tb) / kk); }
    return { root, ta, T, tb, ts, phi };
  }
  // SVG path data (any commands, absolute or relative) -> absolute segments, cached per string
  const pathCache = new Map();
  function parsePath(d) {
    if (pathCache.has(d)) return pathCache.get(d);
    const tk = d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
    const out = [];
    let i = 0, cmd = 'M', cx = 0, cy = 0, sx = 0, sy = 0, lc = null, lq = null;
    const num = () => +tk[i++];
    while (i < tk.length) {
      if (/^[a-zA-Z]$/.test(tk[i])) cmd = tk[i++];
      const C = cmd.toUpperCase(), rl = cmd !== C, ox = rl ? cx : 0, oy = rl ? cy : 0;
      if (C === 'Z') { out.push(['Z']); cx = sx; cy = sy; lc = lq = null; if (i < tk.length && !/^[a-zA-Z]$/.test(tk[i])) cmd = 'L'; continue; }
      if (i >= tk.length) break;
      if (C === 'M') { cx = ox + num(); cy = oy + num(); sx = cx; sy = cy; out.push(['M', [cx, cy]]); cmd = rl ? 'l' : 'L'; lc = lq = null; continue; }
      let p0 = [cx, cy], p;
      if (C === 'L' || C === 'H' || C === 'V') {
        p = C === 'L' ? [ox + num(), oy + num()] : C === 'H' ? [ox + num(), cy] : [cx, oy + num()];
        out.push(['L', p0, p]); lc = lq = null;
      } else if (C === 'C' || C === 'S') {
        const c1 = C === 'C' ? [ox + num(), oy + num()] : (lc ? [2 * cx - lc[0], 2 * cy - lc[1]] : [cx, cy]);
        const c2 = [ox + num(), oy + num()]; p = [ox + num(), oy + num()];
        out.push(['C', c1, c2, p]); lc = c2; lq = null;
      } else if (C === 'Q' || C === 'T') {
        const q = C === 'Q' ? [ox + num(), oy + num()] : (lq ? [2 * cx - lq[0], 2 * cy - lq[1]] : [cx, cy]);
        p = [ox + num(), oy + num()];
        out.push(['Q', q, p]); lq = q; lc = null;
      } else if (C === 'A') {
        const r = [num(), num()], xr = num(), la = num(), sw = num(); p = [ox + num(), oy + num()];
        out.push(['A', r, xr, la, sw, p]); lc = lq = null;
      } else { i++; continue; }
      cx = p[0]; cy = p[1];
    }
    pathCache.set(d, out);
    return out;
  }
  // bend a path through a point map W (lines become curves so they can bend)
  function warpD(d, W, sx, sy) {
    let o = '';
    for (const s of parsePath(d)) {
      if (s[0] === 'Z') o += 'Z';
      else if (s[0] === 'M') o += 'M' + P(W(s[1]));
      else if (s[0] === 'L') { const a = s[1], b = s[2], e = sub(b, a); o += 'C' + P(W(add(a, mul(e, 1 / 3)))) + ' ' + P(W(add(a, mul(e, 2 / 3)))) + ' ' + P(W(b)); }
      else if (s[0] === 'C') o += 'C' + P(W(s[1])) + ' ' + P(W(s[2])) + ' ' + P(W(s[3]));
      else if (s[0] === 'Q') o += 'Q' + P(W(s[1])) + ' ' + P(W(s[2]));
      else if (s[0] === 'A') o += `A${fx(s[1][0] * sx)} ${fx(s[1][1] * sy)} ${fx(s[2])} ${s[3]} ${s[4]} ${P(W(s[5]))}`;
    }
    return o;
  }


  // ---------- render ----------
  // The generated (procedural) body: tapered tubes, mitten/finger hands, drawn head. It is the
  // whole look of a plain character spec and the per-group fallback for a skin that leaves a
  // group out. Returns draw functions that append to `out`.
  function generated(ch, pose, sol, out) {
    const J = sol.joints, A = sol.angles;
    const pr = ch.proportions, R = pr.radius, pal = ch.palette, st = ch.style;
    const ow = st.outline || 0, lw = st.line || 0.025, tp = st.limbTaper === undefined ? 1 : st.limbTaper;
    const sec = pose.secondary || {}, face = pose.face || {};
    // a colour group: stroke pass of every shape first, then fill pass, so inner seams vanish
    function group(fill, ds) {
      if (ow > 0) for (const d of ds) out.push(`<path d="${d}" fill="${pal.outline}" stroke="${pal.outline}" stroke-width="${fx(ow * 2)}" stroke-linejoin="round"/>`);
      for (const d of ds) out.push(`<path d="${d}" fill="${fill}"/>`);
    }
    function lineD(d, color, w) { out.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${fx(w)}" stroke-linecap="round" stroke-linejoin="round"/>`); }
    function fillD(d, color) { out.push(`<path d="${d}" fill="${color}"/>`); }
    const rr = r => r * (0.5 + 0.5 * tp);

    function drawArm(side) {
      const k = side === 'far' ? st.farShade : 1;
      const skin = shade(pal.skin, k), top = shade(pal.top, k);
      const sh = J['shoulder.' + side], el = J['elbow.' + side], wr = J['wrist.' + side], ha = A['hand.' + side];
      const H = p => add(wr, rot(mul(p, pr.hand || 1), ha));
      const handBlob = blobD([[-0.02, -0.05], [0.07, -0.07], [0.15, -0.06], [0.175, 0.0], [0.16, 0.055], [0.08, 0.07], [0.0, 0.055]].map(H));
      const fingers = [];
      if (st.hands !== 'mitten') {
        // four relaxed fingers fanned from the knuckles, pinky (far) first, slight curl
        const curl = pose.handCurl === undefined ? 0.35 : pose.handCurl;
        for (let i = 3; i >= 0; i--) {
          const base = [0.13, 0.035 - i * 0.03], a0 = 0.22 - i * 0.17, l = (i === 3 ? 0.085 : 0.11) - (i === 0 ? 0.01 : 0);
          const mid = add(base, mul(dir(a0), l * 0.55)), tip = add(mid, mul(dir(a0 - curl * 1.2), l * 0.5));
          fingers.push(polyD(capsulePts(H(base), 0.027, H(mid), 0.024, false, 6)));
          fingers.push(polyD(capsulePts(H(mid), 0.024, H(tip), 0.021, false, 6)));
        }
      }
      const thumb = polyD(capsulePts(H([0.05, 0.05]), 0.03, H([0.135, 0.105]), 0.024, false, 6));
      // fingers first (each outlined so they read separately), then arm + palm, then thumb
      if (fingers.length) for (let i = 0; i < fingers.length; i += 2) group(skin, [fingers[i], fingers[i + 1]]);
      group(skin, [
        polyD(capsulePts(sh, rr(R.shoulder), el, rr(R.elbow))),
        polyD(capsulePts(el, rr(R.elbow), wr, rr(R.wrist))),
        handBlob,
      ]);
      group(skin, [thumb]);
      // short sleeve
      const ua = sub(el, sh), uaL = len(ua);
      const sEnd = add(sh, mul(ua, 0.5));
      const back = sub(sh, mul(ua, 0.12 / uaL));
      group(top, [polyD(capsulePts(back, R.sleeve, sEnd, R.sleeveEnd, true))]);
      if (ow > 0) {
        const n = mul([-ua[1], ua[0]], 1 / uaL), u = mul(ua, 1 / uaL);
        lineD(curveD([add(add(sEnd, mul(n, R.sleeveEnd * 0.8)), mul(u, -0.06)), add(sEnd, mul(u, -0.05)), add(add(sEnd, mul(n, -R.sleeveEnd * 0.8)), mul(u, -0.06))]), shade(pal.top, 0.75 * k), lw * 0.8);
      }
    }

    function drawLeg(side, withPelvis) {
      const k = side === 'far' ? st.farShade : 1;
      const bottom = shade(pal.bottom, k), shoe = shade(pal.shoe, k), sole = shade(pal.sole, k);
      const hip = J['hip.' + side], kn = J['knee.' + side], an = J['ankle.' + side], fa = A['foot.' + side];
      const g = footGeometry(ch), F = frame(an, fa);
      // shoe: upper, sole, lace marks
      group(shoe, [blobD(g.upper.map(F), 0.8)]);
      group(sole, [polyD(g.sole.map(F))]);
      for (const [a0, b0] of [[[0.06, 0.07], [0.13, 0.05]], [[0.14, 0.055], [0.21, 0.035]]]) lineD(curveD([a0, b0].map(F)), shade(pal.lace, k), lw * 1.3);
      lineD(curveD([[0.3, -0.06], [0.38, -0.02], [0.47, -0.04]].map(F)), shade(pal.shoe, 0.7 * k), lw * 0.8);
      // trousers: thigh, knee, flared shin with a straight hem at the ankle
      const sd = sub(an, kn), sl = len(sd), su = mul(sd, 1 / sl);
      const hem = add(an, mul(su, 0.015));
      const shapes = [
        polyD(capsulePts(hip, rr(R.hip), kn, rr(R.knee))),
        polyD(capsulePts(kn, rr(R.knee), hem, R.hem, true)),
      ];
      if (withPelvis) {
        const Tp = frame(J.root, A.pelvis);
        shapes.unshift(blobD([[-0.26, 0.10], [-0.22, 0.24], [0.04, 0.30], [0.24, 0.20], [0.24, 0.0], [0.12, -0.14], [-0.12, -0.15], [-0.25, -0.06]].map(Tp)));
      }
      group(bottom, shapes);
      // hem seam and a knee crease to show the fold of the cloth
      const n = [-su[1], su[0]];
      lineD(curveD([add(hem, add(mul(n, R.hem * 0.8), mul(su, -0.05))), add(hem, mul(su, -0.045)), add(hem, add(mul(n, -R.hem * 0.8), mul(su, -0.05)))]), shade(pal.bottomSeam, k), lw * 0.8);
      const bk = sol.bends['knee.' + side];
      if (bk > 0.5) {
        const td = sub(kn, hip), tu = mul(td, 1 / len(td)), tn = [tu[1], -tu[0]];
        // crease on the back of the knee, short arc
        const c = add(kn, mul(tn, -R.knee * 0.15));
        lineD(curveD([add(c, mul(tu, -0.07)), add(add(c, mul(tn, -0.03)), mul(tu, 0.0)), add(c, mul(su, 0.06))]), shade(pal.bottomSeam, k), lw * 0.7);
      }
    }

    function drawTorso() {
      const T = frame(J.root, A.torso);
      const cl = sec.cloth || 0;
      // hem trails back and lifts with the cloth lag
      const hb = [-0.27 - cl * 0.10, -0.15 + cl * 0.06], hm = [-0.02 - cl * 0.05, -0.19 + cl * 0.03], hf = [0.23 - cl * 0.03, -0.15 + cl * 0.01];
      const shirt = [hf, [0.29, 0.12], [0.31, 0.42], [0.27, 0.70], [0.14, pr.torso - 0.03], [-0.06, pr.torso],
        [-0.22, pr.torso - 0.09], [-0.27, 0.55], [-0.25, 0.15], hb, hm];
      group(pal.top, [blobD(shirt.map(T), 0.9)]);
      // collar, side stripe, emblem
      lineD(curveD([[-0.08, pr.torso - 0.04], [0.04, pr.torso - 0.10], [0.15, pr.torso - 0.05]].map(T)), shade(pal.top, 0.72), lw);
      lineD(curveD([[-0.26, 0.30], [0.0, 0.26 - cl * 0.01], [0.30, 0.30]].map(T)), pal.topAccent, 0.06);
      lineD(curveD([hb, [-0.04, -0.13 + cl * 0.02], [0.2, -0.10]].map(T)), shade(pal.top, 0.75), lw * 0.8);
    }

    function drawNeck() {
      group(pal.skin, [polyD(capsulePts(add(J.neckBase, rot([0.0, -0.12], A.torso)), R.neck, add(J.headBase, rot([-0.02, 0.1], A.head)), R.neck * 0.92))]);
    }

    function drawHead() {
      const Hf = frame(J.headBase, A.head);
      const skull = [[-0.42, 0.55], [-0.36, 0.82], [-0.14, 0.99], [0.14, 0.99], [0.36, 0.84], [0.45, 0.62],
        [0.46, 0.44], [0.44, 0.28], [0.39, 0.15], [0.26, 0.06], [0.10, 0.05], [-0.07, 0.12], [-0.27, 0.23], [-0.39, 0.36]];
      const nose = [[0.42, 0.53], [0.53, 0.47], [0.575, 0.415], [0.545, 0.38], [0.45, 0.37]];
      group(pal.skin, [blobD(skull.map(Hf)), blobD(nose.map(Hf), 0.8)]);
      // ear
      group(pal.skin, [blobD([[-0.1, 0.39], [-0.03, 0.43], [-0.02, 0.51], [-0.06, 0.58], [-0.15, 0.57], [-0.17, 0.47]].map(Hf))]);
      lineD(curveD([[-0.07, 0.44], [-0.05, 0.5], [-0.09, 0.54], [-0.12, 0.5]].map(Hf)), shade(pal.skin, 0.62), lw * 0.9);
      // cheek blush and freckles
      fillD(blobD(ellipsePts(Hf, [0.25, 0.34], 0.08, 0.05, 12)), pal.blush + '99');
      for (const p of [[0.2, 0.39], [0.27, 0.40], [0.235, 0.36]]) fillD(blobD(ellipsePts(Hf, p, 0.011, 0.011, 8)), pal.freckle);
      // eye: white, iris, pupil, highlight; blink squashes it
      const blink = clamp(face.blink || 0, 0, 1), eo = face.eye || [0, 0];
      const ec = [0.29, 0.57], ery = 0.12 * (1 - 0.92 * blink);
      if (blink < 0.9) {
        group(pal.eyeWhite, [blobD(ellipsePts(Hf, ec, 0.075, ery, 16))]);
        const ic = [ec[0] + 0.025 + eo[0] * 0.03, ec[1] - 0.005 + eo[1] * 0.03];
        const iry = Math.min(0.062, ery * 0.85);
        fillD(blobD(ellipsePts(Hf, ic, 0.048, iry, 14)), pal.iris);
        fillD(blobD(ellipsePts(Hf, [ic[0] + 0.006, ic[1]], 0.03, Math.min(0.04, iry * 0.7), 12)), pal.pupil);
        fillD(blobD(ellipsePts(Hf, [ic[0] + 0.012, ic[1] + 0.022 * (1 - blink)], 0.013, 0.013, 8)), '#ffffff');
        // upper lid line
        lineD(curveD([[ec[0] - 0.07, ec[1] + ery * 0.4], [ec[0], ec[1] + ery * 1.02], [ec[0] + 0.075, ec[1] + ery * 0.55]].map(Hf)), pal.outline, lw * 1.3);
      } else {
        lineD(curveD([[ec[0] - 0.07, ec[1]], [ec[0], ec[1] - 0.02], [ec[0] + 0.07, ec[1]]].map(Hf)), pal.outline, lw * 1.2);
      }
      // brow
      const bw = face.brow || 0;
      lineD(curveD([[0.2, 0.74 + bw * 0.02], [0.29, 0.775 + bw * 0.03], [0.38, 0.75 + bw * 0.02]].map(Hf)), pal.hairDark, 0.04);
      // mouth
      const m = face.mouth || 'smile';
      if (m === 'open') {
        const mo = [[0.31, 0.26], [0.375, 0.27], [0.44, 0.285], [0.425, 0.205], [0.37, 0.17], [0.33, 0.2]].map(Hf);
        group(pal.mouth, [blobD(mo, 0.9)]);
        fillD(blobD([[0.34, 0.2], [0.38, 0.215], [0.415, 0.205], [0.39, 0.18], [0.36, 0.18]].map(Hf), 0.9), pal.tongue);
      } else if (m === 'smile') {
        lineD(curveD([[0.30, 0.27], [0.37, 0.215], [0.44, 0.26]].map(Hf)), pal.outline, lw * 1.1);
      } else {
        lineD(curveD([[0.32, 0.25], [0.38, 0.24], [0.43, 0.25]].map(Hf)), pal.outline, lw * 1.1);
      }
      // hair: cap plus locks that rotate back/up with the secondary lag (closed form, from pose)
      const lag = sec.hair || 0;
      const lag2 = sec.hair2 === undefined ? lag : sec.hair2;
      const hd = ch.hair || {};
      const locks = [];
      for (const L of hd.locks || []) {
        const a = L.deg * Math.PI / 180 - lag * L.follow;
        const u = dir(a), n = [-u[1], u[0]];
        const at = L.at;
        // lock bends further as it lags (tip trails more than the root)
        const bend = L.bend - lag * L.follow * 0.08;
        const p = (s, o) => add(add(at, mul(u, s * L.len)), mul(n, o));
        const tip = add(p(1, bend * 1.8), mul(dir(a - lag * L.follow * 0.35), 0.02));
        locks.push(blobD([p(0, L.w / 2), p(0.45, L.w * 0.42 + bend), p(0.82, L.w * 0.2 + bend * 1.5), tip, p(0.6, -L.w * 0.28 + bend), p(0, -L.w / 2)].map(Hf), 0.9));
      }
      let tie = null;
      if (hd.tail) {
        // ponytail: a chain; each segment adds curl and a growing share of the (delayed) lag
        const T = hd.tail, pts = [T.at];
        let a = T.deg * Math.PI / 180;
        for (let i = 0; i < T.seg.length; i++) {
          // a hanging tail rests against the head: negative lag (droop) is damped
          const l1 = lag > 0 ? lag : 0.4 * lag, l2 = lag2 > 0 ? lag2 : 0.4 * lag2;
          a += (i ? T.curl * Math.PI / 180 : 0) - (i === 0 ? 0.55 * l1 : 0.18 * l1 + 0.22 * l2 * i / T.seg.length);
          pts.push(add(pts[i], mul(dir(a), T.seg[i])));
        }
        const left = [], right = [];
        for (let i = 0; i < pts.length; i++) {
          const dv = i < pts.length - 1 ? sub(pts[i + 1], pts[i]) : sub(pts[i], pts[i - 1]);
          const nn = mul([-dv[1], dv[0]], 1 / len(dv)), w = T.width[i] / 2;
          left.push(add(pts[i], mul(nn, w))); right.push(add(pts[i], mul(nn, -w)));
        }
        const tipP = add(pts[pts.length - 1], mul(dir(a), 0.05));
        locks.unshift(blobD(left.concat([tipP], right.reverse()).map(Hf), 0.9));
        tie = pts[0];
      }
      if (hd.cap) locks.push(blobD(hd.cap.map(Hf), 0.95));
      group(pal.hair, locks);
      if (tie) group(pal[hd.tie] || pal.hairDark, [blobD(ellipsePts(Hf, add(tie, [0.03, -0.01]), 0.05, 0.075, 12))]);
      // strand lines for texture
      lineD(curveD([[0.34, 1.0], [0.08, 1.08], [-0.28, 1.0]].map(Hf)), pal.hairDark, lw * 0.9);
      lineD(curveD([[0.18, 0.84], [-0.06, 0.88], [-0.3, 0.93]].map(Hf)), pal.hairDark, lw * 0.9);
      lineD(curveD([[-0.36, 0.5], [-0.38, 0.72], [-0.36, 0.9]].map(Hf)), pal.hairDark, lw * 0.9);
    }

    return { drawArm, drawLeg, drawTorso, drawNeck, drawHead };
  }

  // outer transform: rig space (y up) -> page px. opts: x, y, scale, facing (-1 mirrors),
  // squash [sx, sy] about the feet.
  function wrap(out, opts) {
    const s = opts.scale || 100, x = opts.x || 0, y = opts.y || 0;
    const f = opts.facing === -1 ? -1 : 1, sq = opts.squash || [1, 1];
    return `<g transform="translate(${fx(x)} ${fx(y)}) scale(${fx(s * f * sq[0])} ${fx(-s * sq[1])})">${out.join('')}</g>`;
  }

  function render(ch, pose, opts) {
    opts = opts || {};
    if (ch.parts || ch.swaps || ch.chains || ch.build) return renderSkin(ch, pose, opts);
    const sol = solve(ch, pose), out = [];
    const g = generated(ch, pose, sol, out);
    // draw order (far to near): far arm, far leg, pelvis + near leg, neck, torso, head, near arm
    g.drawArm('far');
    g.drawLeg('far', false);
    g.drawLeg('near', true);
    g.drawNeck();
    g.drawTorso();
    g.drawHead();
    g.drawArm('near');
    return wrap(out, opts);
  }

  // =====================================================================================
  // Skins: drawn SVG parts attached to bones (STAGE.md section 1). See skins/tess.js.
  //
  // Frames (all y up before the final flip):
  //   limb bones upperArm, foreArm, thigh, shin: origin = parent joint, +x along the bone,
  //     1 unit = that bone's length (a `d` path runs from x=0 to x=1). Stretch lengthens x only.
  //   torso, pelvis (origin = root/pelvis), neck (origin = neck base), head (origin = top of
  //     the neck): upright frames, x forward, y up, 1 unit = 1 head height, rotating with the bone.
  //   foot (origin = ankle, x along the sole) and hand swaps (origin = wrist, x along the
  //     fingers, +y = thumb side): 1 unit = 1 head height.
  // A part is one entry or a list of entries:
  //   { d, fill }                  filled path in the bone frame
  //   { d, stroke, w }             stroked line (w in frame units), round caps
  //   { cap: [r0, r1] | [r0, rMid, r1], from, to, inset, fill }   limb shorthand: a tapered
  //       capsule along the bone, radii in head units; from/to are fractions of the bone;
  //       inset: -0.4 = a strip on the back (-y) edge 40% wide, +0.4 on the front edge
  //   { swap: 'eye' }              placeholder: draw the current eye/mouth/brow swap here
  //   look: k                      (swap entries) moves with the eye dart offset times k
  // Fill names: a palette key ('top'), '<key>Shade' (palette entry, else key darkened by
  // palette.shade), or a literal '#rrggbb'. Far-side limbs are darkened by skin.farShade.
  // =====================================================================================
  const LAYERS = ['back', 'arm.far', 'leg.far', 'pelvis', 'leg.near', 'neck', 'torso', 'head', 'arm.near', 'front'];
  const LIMB = { upperArm: ['shoulder', 'elbow'], foreArm: ['elbow', 'wrist'], thigh: ['hip', 'knee'], shin: ['knee', 'ankle'] };

  // merge a skin over the default character so generated fallbacks and IK have every key
  // =====================================================================================
  // The mannequin: a whole human from numbers (skin.build). See docs/RIG.md "build".
  //   build.heads gives the height in head heights (2.2 toddler .. 8 adult) and with it default
  //   proportions and thicknesses; every other build number overrides one of those defaults.
  //   Thicknesses are side-view depths (front to back) or limb radii, in head heights.
  // The generated body (arm and leg tubes, torso, pelvis, neck, feet, a plain head, hand and
  // face swaps) is drawn UNDER whatever the skin's own parts draw for that group, so a skin adds
  // garments on top; build.hide: ['head', 'torso', ...] leaves a generated group out, and a skin
  // that draws parts.head (or swaps.eye etc.) replaces the generated head (or that swap).
  // =====================================================================================
  const mix = (a, b, u) => a + (b - a) * u;
  function buildOf(skin) {
    const b0 = skin.build || {};
    const h = clamp(+b0.heads || 3, 2, 9), u = clamp((h - 2.2) / 5.8, 0, 1);
    const d = {
      heads: h, legs: mix(0.32, 0.47, u),
      neck: mix(0.075, 0.11, u), shoulders: mix(0.5, 0.92, u), chest: mix(0.52, 0.95, u), waist: mix(0.5, 0.78, u),
      hips: mix(0.52, 0.86, u), belly: mix(0.07, 0, u), seat: mix(0.03, 0.06, u), bust: 0,
      arm: mix(0.08, 0.2, u), leg: mix(0.135, 0.31, u), hand: 1, foot: 1, muscle: 0, headWidth: mix(0.96, 0.8, u),
      arms: mix(0.28, 0.385, u), hide: [],
    };
    const b = Object.assign(d, b0);
    b.u = u;
    // muscle: thicker limbs, deeper chest, slimmer waist
    const m = clamp(+b.muscle || 0, 0, 1);
    b.armR = b.arm * (1 + 0.45 * m); b.legR = b.leg * (1 + 0.3 * m); b.chestD = b.chest * (1 + 0.18 * m); b.shouldersD = b.shoulders * (1 + 0.25 * m);
    return b;
  }
  function propsFromBuild(b) {
    const u = b.u, H = b.heads, legTot = b.legs * H, ankle = mix(0.08, 0.22, u);
    const neck = b.neckLength !== undefined ? clamp(+b.neckLength, 0, 1.5) : mix(0.06, 0.3, u), headTop = 1.04;
    const torso = Math.max(0.3, H - headTop - neck - legTot);
    const hand = mix(0.2, 0.62, u) * b.hand, armTot = Math.max(hand + 0.2, b.arms * H);
    const fl = mix(0.42, 1.08, u) * b.foot;
    return {
      head: 1, neck, torso, shoulderDrop: mix(0.1, 0.3, u) + 0.2 * (b.shouldersD - mix(0.5, 0.92, u)),
      upperArm: (armTot - hand) * 0.53, foreArm: (armTot - hand) * 0.47, hand,
      thigh: (legTot - ankle) * 0.52, shin: (legTot - ankle) * 0.48, ankleHeight: ankle,
      heel: [-0.2 * fl, -ankle], toe: [0.72 * fl, -ankle],
      footGround: [[-0.22 * fl, -ankle], [0.76 * fl, -ankle], [-0.24 * fl, -0.7 * ankle], [0.79 * fl, -0.7 * ankle], [0.8 * fl, -0.35 * ankle], [0.74 * fl, 0]],
      farShoulder: [-0.05, -0.015],
      radius: { hip: b.legR, knee: 0.68 * b.legR, hem: b.legR, shoulder: b.armR, elbow: 0.76 * b.armR, wrist: 0.58 * b.armR, neck: b.neck },
      footLength: fl,
    };
  }
  // torso side profile at height y (torso frame): front and back x
  function torsoProfile(b, T) {
    const lv = [[-0.06, b.hips * 0.97], [0, b.hips], [0.4, b.waist], [0.75, b.chestD], [1, b.shouldersD * 0.92], [1.08, b.neck * 2.6]];
    const bump = (u, c, w) => Math.exp(-Math.pow((u - c) / w, 2));
    return y => {
      const u = y / T;
      let i = 0;
      while (i < lv.length - 2 && lv[i + 1][0] < u) i++;
      const a = lv[i], c = lv[i + 1], s = clamp((u - a[0]) / (c[0] - a[0]), 0, 1), e = s * s * (3 - 2 * s);
      const dep = mix(a[1], c[1], e), cx = 0.04 * bump(u, 0.75, 0.3);
      return { front: cx + dep / 2 + b.belly * bump(u, 0.36, 0.3) + b.bust * bump(u, 0.72, 0.12), back: cx - dep / 2 - b.seat * bump(u, 0.02, 0.14) - 0.15 * b.belly * bump(u, 0.4, 0.4) };
    };
  }
  function torsoOutline(b, T, f0, f1, lo) {
    const prof = torsoProfile(b, T), n = 12, ys = [];
    for (let i = 0; i <= n; i++) ys.push((Math.max(-0.06, f0) + (Math.min(1.08, f1) - Math.max(-0.06, f0)) * i / n) * T);
    const back = ys.map(y => [prof(y).back - lo, y]), front = ys.slice().reverse().map(y => [prof(y).front + lo, y]);
    if (f1 >= 1.08) { const p = prof(1.08 * T); back.push([p.back * 0.9 - lo, 1.09 * T + lo]); front.unshift([p.front * 0.9 + lo, 1.09 * T + lo]); }
    return blobD(back.concat(front), 0.9);
  }
  function bodyParts(b, pr) {
    const T = pr.torso, prof = torsoProfile(b, T), parts = {};
    const ys = [-0.06, -0.02, 0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95, 1.03].map(u => u * T);
    const back = ys.map(y => [prof(y).back, y]), front = ys.slice().reverse().map(y => [prof(y).front, y]);
    const top = [[prof(1.08 * T).front * 0.9, 1.09 * T], [prof(1.08 * T).back * 0.9, 1.09 * T]];
    const outline = back.concat([top[1], top[0]], front);
    const shadePts = back.concat(ys.slice().reverse().map(y => { const p = prof(y); return [p.back + 0.32 * (p.front - p.back), y]; }));
    parts.torso = [{ d: blobD(outline, 0.9), fill: 'suit' }, { d: blobD(shadePts, 0.9), fill: 'suitShade' }];
    const hw = b.hips / 2;
    parts.pelvis = [{ d: blobD(ellipsePts(p => p, [0.01, 0.04 * T], hw * 0.98, Math.max(pr.radius.hip * 0.8, 0.08 * T), 16), 1), fill: 'suit' }];
    parts.neck = [{ d: polyD([[-b.neck, -0.08], [b.neck * 0.9, -0.08], [b.neck * 0.9, pr.neck + 0.22], [-b.neck, pr.neck + 0.22]]), fill: 'skin' },
      { d: polyD([[-b.neck, -0.08], [-b.neck * 0.25, -0.08], [-b.neck * 0.25, pr.neck + 0.22], [-b.neck, pr.neck + 0.22]]), fill: 'skinShade' }];
    const ar = [pr.radius.shoulder, pr.radius.elbow, pr.radius.wrist], lr = [pr.radius.hip, pr.radius.knee, pr.radius.knee * 0.72];
    parts.arm = [{ tube: ar, fill: 'skin' }, { tube: ar, inset: -0.35, fill: 'skinShade' }];
    parts.leg = [{ tube: lr, fill: 'skin' }, { tube: lr, inset: -0.35, fill: 'skinShade' }, { tube: lr.map(r => r * 1.05), from: 0, to: 0.16, flat: 'end', fill: 'suit' }, { tube: lr.map(r => r * 1.05), from: 0, to: 0.16, flat: 'end', inset: -0.35, fill: 'suitShade' }];
    // foot: a plain shoe, sole on the ground line of the foot frame
    const fl = pr.footLength, ah = pr.ankleHeight, fr = Math.max(0.04, lr[2]);
    const sh = [[-0.22 * fl, -ah * 0.55], [-0.2 * fl, -ah], [0.7 * fl, -ah], [0.8 * fl, -ah * 0.6], [0.74 * fl, -ah * 0.1], [0.4 * fl, ah * 0.15], [0.1 * fl, fr * 1.1], [-0.12 * fl, fr * 1.15], [-0.22 * fl, fr * 0.4]];
    parts.foot = [{ d: blobD(sh, 0.6), fill: 'shoe' }, { d: polyD([[-0.22 * fl, -ah], [0.78 * fl, -ah], [0.78 * fl, -ah * 0.78], [-0.22 * fl, -ah * 0.78]]), fill: 'sole' }];
    // head (head frame: origin = top of the neck, 1 = head height); headWidth scales front to back
    const W = b.headWidth, P0 = q => [q[0] * W, q[1]];
    const skull = [[-0.1, 0.03], [0.14, 0.02], [0.32, 0.12], [0.42, 0.28], [0.45, 0.4], [0.52, 0.47], [0.46, 0.54], [0.45, 0.66], [0.4, 0.84], [0.2, 0.99], [-0.12, 1.02], [-0.4, 0.9], [-0.53, 0.64], [-0.46, 0.34], [-0.3, 0.14]].map(P0);
    parts.head = [{ d: blobD(skull, 0.95), fill: 'skin' },
      { d: blobD([[-0.1, 0.03], [0.14, 0.02], [0.3, 0.1], [0.1, 0.08], [-0.08, 0.12]].map(P0), 0.9), fill: 'skinShade' },
      { d: oval(-0.06 * W, 0.5, 0.07 * W, 0.1), fill: 'skin' }, { d: oval(-0.06 * W, 0.5, 0.035 * W, 0.06), fill: 'skinShade' },
      { d: oval(0.3 * W, 0.33, 0.06, 0.035), fill: 'cheek', opacity: 0.6 },
      { swap: 'mouth' }, { swap: 'eye' }, { swap: 'brow' },
      { d: blobD([[-0.48, 0.66], [-0.36, 0.95], [-0.1, 1.04], [0.2, 1.0], [0.4, 0.86], [0.43, 0.76], [0.2, 0.86], [-0.1, 0.84], [-0.3, 0.72], [-0.42, 0.52]].map(P0), 0.9), fill: 'hair' }];
    return parts;
  }
  const oval = (x, y, rx, ry) => `M${fx(x - rx)} ${fx(y)}A${fx(rx)} ${fx(ry)} 0 1 0 ${fx(x + rx)} ${fx(y)}A${fx(rx)} ${fx(ry)} 0 1 0 ${fx(x - rx)} ${fx(y)}Z`;
  function bodySwaps(b, pr) {
    const W = b.headWidth, EX = 0.3 * W, EY = 0.55, MX = 0.38 * W, MY = 0.24, h = pr.hand, s = h / 0.23;
    const S = q => q.map(p => [p[0] * s, p[1] * s * 0.82]);
    const mitt = S([[0, -0.05], [0.1, -0.06], [0.18, -0.045], [0.215, 0], [0.19, 0.045], [0.1, 0.055], [0, 0.045]]);
    return {
      hand: {
        relaxed: [{ d: blobD(mitt, 0.9), fill: 'skin' }, { d: blobD(S([[0.03, 0.04], [0.09, 0.09], [0.12, 0.08], [0.1, 0.045]]), 0.9), fill: 'skinShade' }],
        fist: [{ d: blobD(S([[0, -0.05], [0.09, -0.07], [0.16, -0.04], [0.17, 0.03], [0.12, 0.07], [0, 0.045]]), 0.9), fill: 'skin' }],
        open: [{ d: blobD(S([[0, -0.05], [0.1, -0.07], [0.24, -0.06], [0.26, 0], [0.23, 0.05], [0.12, 0.06], [0.09, 0.11], [0.05, 0.1], [0, 0.045]]), 0.9), fill: 'skin' }],
        point: [{ d: blobD(S([[0, -0.05], [0.1, -0.06], [0.14, -0.02], [0.26, 0.02], [0.26, 0.05], [0.12, 0.06], [0, 0.045]]), 0.9), fill: 'skin' }],
        grip: [{ d: blobD(S([[0, -0.05], [0.1, -0.07], [0.17, -0.03], [0.17, 0.05], [0.1, 0.07], [0, 0.045]]), 0.9), fill: 'skin' }],
        thumb: [{ d: blobD(S([[0, -0.05], [0.09, -0.07], [0.16, -0.04], [0.17, 0.03], [0.12, 0.07], [0, 0.045]]), 0.9), fill: 'skin' },
          { d: blobD(S([[0.05, 0.05], [0.04, 0.16], [0.07, 0.19], [0.1, 0.16], [0.1, 0.06]]), 0.9), fill: 'skin' }],
      },
      eye: {
        open: [{ d: oval(EX, EY, 0.045, 0.065), fill: 'eye', look: 1 }, { d: oval(EX + 0.015, EY + 0.025, 0.015, 0.017), fill: 'white', look: 1 }],
        wide: [{ d: oval(EX, EY, 0.06, 0.085), fill: 'white' }, { d: oval(EX + 0.01, EY, 0.032, 0.046), fill: 'eye', look: 1 }],
        narrow: [{ d: oval(EX, EY - 0.01, 0.045, 0.045), fill: 'eye', look: 1 }, { d: `M${EX - 0.06} ${EY + 0.03}L${EX + 0.06} ${EY + 0.015}`, stroke: 'eye', w: 0.025 }],
        closed: { d: `M${EX - 0.05} ${EY + 0.01}Q${EX} ${EY - 0.03} ${EX + 0.05} ${EY + 0.01}`, stroke: 'eye', w: 0.022 },
        happy: { d: `M${EX - 0.05} ${EY - 0.015}Q${EX} ${EY + 0.06} ${EX + 0.05} ${EY - 0.015}`, stroke: 'eye', w: 0.026 },
        sad: [{ d: oval(EX, EY - 0.01, 0.042, 0.058), fill: 'eye', look: 1 }, { d: `M${EX - 0.06} ${EY + 0.05}L${EX + 0.05} ${EY + 0.08}`, stroke: 'eye', w: 0.022 }],
      },
      brow: {
        neutral: { d: `M${EX - 0.05} ${EY + 0.12}Q${EX} ${EY + 0.145} ${EX + 0.06} ${EY + 0.125}`, stroke: 'hair', w: 0.035 },
        up: { d: `M${EX - 0.05} ${EY + 0.15}Q${EX} ${EY + 0.19} ${EX + 0.06} ${EY + 0.16}`, stroke: 'hair', w: 0.035 },
        down: { d: `M${EX - 0.06} ${EY + 0.15}Q${EX} ${EY + 0.14} ${EX + 0.07} ${EY + 0.09}`, stroke: 'hair', w: 0.04 },
        worried: { d: `M${EX - 0.05} ${EY + 0.1}Q${EX} ${EY + 0.12} ${EX + 0.06} ${EY + 0.17}`, stroke: 'hair', w: 0.034 },
      },
      mouth: {
        neutral: { d: `M${MX - 0.04} ${MY}Q${MX} ${MY - 0.005} ${MX + 0.035} ${MY + 0.008}`, stroke: 'mouth', w: 0.02 },
        smile: { d: `M${MX - 0.05} ${MY + 0.03}Q${MX - 0.01} ${MY - 0.035} ${MX + 0.04} ${MY + 0.01}`, stroke: 'mouth', w: 0.022 },
        open: [{ d: blobD([[MX - 0.05, MY + 0.03], [MX + 0.04, MY + 0.02], [MX + 0.03, MY - 0.06], [MX - 0.02, MY - 0.06]], 0.9), fill: 'mouth' }],
        o: { d: oval(MX, MY - 0.01, 0.022, 0.032), fill: 'mouth' },
        worried: { d: `M${MX - 0.045} ${MY - 0.01}Q${MX - 0.01} ${MY + 0.02} ${MX + 0.035} ${MY}`, stroke: 'mouth', w: 0.02 },
        grit: [{ d: polyD([[MX - 0.05, MY + 0.025], [MX + 0.04, MY + 0.02], [MX + 0.04, MY - 0.03], [MX - 0.045, MY - 0.025]]), fill: 'white' }],
        sad: { d: `M${MX - 0.045} ${MY - 0.02}Q${MX} ${MY + 0.025} ${MX + 0.04} ${MY - 0.005}`, stroke: 'mouth', w: 0.02 },
      },
    };
  }
  const MANNEQUIN_PALETTE = { skin: '#e8c3a2', skinShade: '#cf9f7f', suit: '#8a94a6', suitShade: '#6f788b', shoe: '#5b4a42', sole: '#3a2f2a',
    hair: '#5a4636', eye: '#2a1f1c', white: '#ffffff', mouth: '#7a3a3a', cheek: '#e79a86', outline: '#2c2422', shade: 0.82 };
  // the body groups a build skin draws for itself (cached per skin object)
  const builtCache = new WeakMap();
  function built(skin) {
    if (builtCache.has(skin)) return builtCache.get(skin);
    const b = buildOf(skin);
    const pr = Object.assign(propsFromBuild(b), skin.proportions || {});
    pr.radius = Object.assign({}, propsFromBuild(b).radius, (skin.proportions || {}).radius || {});
    const gen = bodyParts(b, pr), hide = b.hide || [];
    const own = skin.parts || {};
    const parts = {};
    if (hide.indexOf('hair') >= 0) gen.head = gen.head.filter(e => e.fill !== 'hair');   // bald: no generated hair cap
    for (const k of Object.keys(gen)) if (hide.indexOf(k) < 0 && !(k === 'head' && own.head)) parts[k] = gen[k];
    // garments: { cover: [from, to], loose, ... } on arm / leg = a tube that follows the body's own
    // limb radii (plus `loose`); { cover: [from, to] } on torso = the body's outline between those
    // fractions of the torso height (0 = hip line, 1 = shoulders; default [-0.12, 1.1]), plus `loose`
    const ar = [pr.radius.shoulder, pr.radius.elbow, pr.radius.wrist], lr = [pr.radius.hip, pr.radius.knee, pr.radius.knee * 0.72];
    const garment = (k, e) => {
      if (!e || !e.cover) return e;
      const c = Array.isArray(e.cover) ? e.cover : null, lo = e.loose || 0;
      if (k === 'arm' || k === 'leg') return Object.assign({}, e, { cover: undefined, tube: (k === 'arm' ? ar : lr).map(r => r + lo), from: c ? c[0] : 0, to: c ? c[1] : 1 });
      if (k === 'torso') return Object.assign({}, e, { cover: undefined, d: torsoOutline(b, pr.torso, c ? c[0] : -0.12, c ? c[1] : 1.1, lo) });
      return e;
    };
    for (const k of Object.keys(own)) {
      if (own[k] === null) { delete parts[k]; continue; }
      const mine = [].concat(own[k]).map(e => garment(k, e));
      parts[k] = parts[k] ? [].concat(parts[k], mine) : mine;
    }
    const sw = bodySwaps(b, pr), swaps = Object.assign({}, sw, skin.swaps || {});
    const out = { b, pr, parts, swaps, profile: torsoProfile(b, pr.torso), headTop: skin.headTop || 1.04 };
    builtCache.set(skin, out);
    return out;
  }
  function skinCharacter(skin) {
    const d = defaultCharacter();
    const prop = Object.assign({}, d.proportions, skin.proportions || {});
    prop.radius = Object.assign({}, d.proportions.radius, (skin.proportions || {}).radius || {});
    const ch = Object.assign({}, d, skin);
    ch.proportions = prop;
    ch.palette = Object.assign({}, d.palette, skin.palette || {});
    if (skin.build) {
      // a body from numbers: generated proportions and parts, the skin's own on top
      const B = built(skin);
      ch.proportions = Object.assign({}, d.proportions, B.pr, { radius: B.pr.radius });
      ch.parts = B.parts; ch.swaps = B.swaps; ch.headTop = B.headTop; ch.body = B;
      ch.palette = Object.assign({}, d.palette, MANNEQUIN_PALETTE, skin.palette || {});
      // a skin that sets a base colour but not its shade gets the automatic shade, not the mannequin's
      for (const k of Object.keys(MANNEQUIN_PALETTE)) if (/Shade$/.test(k) && skin.palette && skin.palette[k.slice(0, -5)] && !skin.palette[k]) delete ch.palette[k];
      ch.outline = skin.outline === undefined ? 0.03 : skin.outline;
    }
    ch.style = Object.assign({}, d.style, skin.style || {}, { outline: ch.outline || 0 });
    if (!skin.hair) ch.hair = d.hair;
    return ch;
  }
  // character height in head units (ground to top of head, standing straight)
  function heightOf(ch) {
    const pr = ch.proportions;
    return pr.ankleHeight + pr.thigh + pr.shin + pr.torso + pr.neck + pr.head * (ch.headTop || 1.04);
  }

  function colorFn(ch) {
    const pal = ch.palette, k = pal.shade || 0.8;
    return function (name, far) {
      let c;
      if (!name) c = '#ff00ff';
      else if (name[0] === '#') c = name;
      else if (pal[name]) c = pal[name];
      else if (/Shade$/.test(name) && pal[name.slice(0, -5)]) c = shade(pal[name.slice(0, -5)], k);
      else c = '#ff00ff';
      return far ? shade(c.slice(0, 7), far) : c;
    };
  }

  // the frame of a chain's anchor and its rest direction, in rig space (perform.js uses it too)
  function chainBase(ch, sol, spec) {
    const J = sol.joints, A = sol.angles;
    if ((spec.bone === 'torso') && sol.spine && (sol.spine.tb !== 0 || sol.spine.ts !== 1)) {
      const w = spineWarp(sol.spine, spec.at || [0, 0]);
      return { p: w.p, angle: w.a + (spec.rest || 0) * Math.PI / 180 };
    }
    const o = { torso: J.root, pelvis: J.root, neck: J.neckBase, head: J.headBase }[spec.bone || 'head'];
    const a = A[spec.bone || 'head'] || 0;
    return { p: add(o, rot(spec.at || [0, 0], a)), angle: a + (spec.rest || 0) * Math.PI / 180 };
  }
  // chain centre points; delta = per-segment angle offsets (radians) from pose.secondary.chains
  function chainPoints(ch, sol, spec, delta) {
    const b = chainBase(ch, sol, spec), pts = [b.p], angs = [];
    const curl = (spec.curl || 0) * Math.PI / 180;
    for (let i = 0; i < spec.seg.length; i++) {
      const a = b.angle + curl * i + ((delta && delta[i]) || 0);
      angs.push(a);
      pts.push(add(pts[i], mul(dir(a), spec.seg[i])));
    }
    return { pts, angs };
  }

  // ---------- faces: mouth shapes with fallbacks, a mouth, brows and lids drawn from numbers ----------
  // a viseme a skin lacks -> the first of these it has, scaled [sx, sy] about the shape's centre
  const MOUTHF = {
    rest: [['rest', 1, 1], ['neutral', 1, 1], ['closed', 1, 1], ['smile', 1, 1], ['mbp', 1, 1]],
    mbp: [['mbp', 1, 1], ['closed', 1, 1], ['rest', 1, 1], ['neutral', 1, 1]],
    ah: [['ah', 1, 1], ['open', 1, 1], ['o', 1.2, 1], ['oh', 1.2, 1]],
    ee: [['ee', 1, 1], ['grit', 1, 1], ['open', 1.1, 0.4], ['ah', 1.1, 0.4], ['smile', 1, 1]],
    oh: [['oh', 1, 1], ['o', 1, 1], ['open', 0.75, 0.85], ['ah', 0.75, 0.85]],
    oo: [['oo', 1, 1], ['wq', 1, 1], ['o', 0.7, 0.6], ['oh', 0.7, 0.6], ['open', 0.5, 0.45], ['ah', 0.5, 0.45]],
    fv: [['fv', 1, 1], ['grit', 1, 0.6], ['mbp', 1, 1], ['closed', 1, 1], ['neutral', 1, 1]],
    l: [['l', 1, 1], ['open', 0.9, 0.65], ['ah', 0.9, 0.65]],
    wq: [['wq', 1, 1], ['oo', 1, 1], ['o', 0.75, 0.6], ['oh', 0.75, 0.6], ['open', 0.55, 0.5], ['ah', 0.55, 0.5]],
  };
  const bbCache = new WeakMap();
  function bboxOf(ent) {
    if (bbCache.has(ent)) return bbCache.get(ent);
    let b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const e of [].concat(ent)) if (e && e.d) for (const s of parsePath(e.d)) for (const p of s.slice(1)) if (Array.isArray(p) && p.length === 2 && isFinite(p[0])) b = [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])];
    if (!isFinite(b[0])) b = [0, 0, 0, 0];
    bbCache.set(ent, b);
    return b;
  }
  // beard, chin and lower-face pieces (drawn below the mouth line) drop with the jaw while speaking
  function isLowerFace(e) { if (!e || !e.d) return false; const b = bboxOf(e); return b[3] < 0.62 && b[1] < 0.12 && b[3] - b[1] > 0.12 && (b[1] + b[3]) / 2 < 0.32; }
  const genMouth = (W, f) => {
    const MX = 0.38 * W, MY = 0.24, o = Math.max(0, f.open || 0), w = f.wide === undefined ? 1 : f.wide, r = f.round || 0, s = clamp(f.smile || 0, -1, 1);
    const hw = 0.075 * w * (1 - 0.3 * r), back = [MX - hw, MY + 0.022 * s], front = [MX + 0.045 + 0.025 * r, MY + 0.004];
    if (o < 0.06) return { d: `M${P(back)}Q${fx(MX)} ${fx(MY - 0.004 + 0.006 * s)} ${P(front)}`, stroke: 'mouth', w: 0.02 + 0.006 * (f.viseme && f.viseme[0] === 'mbp' ? 1 : 0) };
    const h = 0.11 * o, fb = [front[0] - 0.008 - 0.012 * r, MY + 0.006 - 0.9 * h], out = [];
    out.push({ d: `M${P(back)}Q${fx(MX)} ${fx(MY + 0.012)} ${P(front)}L${P(fb)}Q${fx(MX - 0.01)} ${fx(MY - h)} ${P(back)}Z`, fill: 'mouth' });
    if ((f.teeth || 0) > 0.3) out.push({ d: `M${fx(back[0] + 0.012)} ${fx(back[1] - 0.003)}L${fx(front[0] - 0.004)} ${fx(front[1] - 0.002)}L${fx(front[0] - 0.008)} ${fx(front[1] - 0.016)}L${fx(back[0] + 0.014)} ${fx(back[1] - 0.012)}Z`, fill: 'white' });
    if ((f.tongue || 0) > 0.3 && h > 0.03) out.push({ d: `M${fx(MX - 0.02)} ${fx(MY - h * 0.75)}Q${fx(MX + 0.01)} ${fx(MY - h * 0.2)} ${fx(fb[0])} ${fx(fb[1] + 0.006)}Q${fx(MX)} ${fx(MY - h * 0.95)} ${fx(MX - 0.02)} ${fx(MY - h * 0.75)}Z`, fill: '#d9707a' });
    return out;
  };
  const genBrow = (W, f) => {
    const EX = 0.3 * W, by = 0.55 + 0.125 + 0.035 * clamp((f.browH || 0) + (f.browLift || 0), -1.2, 1.5), a = clamp(f.browA || 0, -1, 1);
    return { d: `M${fx(EX - 0.055)} ${fx(by - 0.012 * a)}Q${fx(EX)} ${fx(by + 0.022)} ${fx(EX + 0.06)} ${fx(by + 0.03 * a)}`, stroke: 'hair', w: 0.035 + 0.008 * Math.max(0, -a) };
  };
  const genLid = (W, lid) => {
    const EX = 0.3 * W, EY = 0.55, edge = EY + 0.066 - (1 - clamp(lid, 0, 1)) * 0.135;
    return [{ d: `M${fx(EX - 0.065)} ${fx(EY + 0.085)}L${fx(EX + 0.065)} ${fx(EY + 0.085)}L${fx(EX + 0.065)} ${fx(edge)}Q${fx(EX)} ${fx(edge - 0.012)} ${fx(EX - 0.065)} ${fx(edge)}Z`, fill: 'skin' },
      { d: `M${fx(EX - 0.06)} ${fx(edge)}Q${fx(EX)} ${fx(edge - 0.012)} ${fx(EX + 0.06)} ${fx(edge)}`, stroke: 'eye', w: 0.016 }];
  };
  // the highest point drawn on the head (hats, buns, spikes), head frame units
  function headTopOf(ch) {
    let top = ch.headTop || 1.04;
    for (const k of ['head', 'hair']) for (const e of [].concat((ch.parts || {})[k] || [])) if (e && e.d) top = Math.max(top, bboxOf(e)[3] + (e.w || 0) / 2);
    return top;
  }
  function renderSkin(skin, pose, opts) {
    const ch = skinCharacter(skin);
    const sol = solve(ch, pose), J = sol.joints, A = sol.angles, pr = ch.proportions;
    // silhouette: '#rrggbb' draws every part in that one colour, with no outline and no inner
    // shading (a contour-only figure; stage.js sets it from the set's `silhouette`)
    const sil = skin.silhouette || null;
    const col = sil ? () => sil : colorFn(ch), parts = ch.parts || {}, swaps = ch.swaps || {};
    const ow = sil ? 0 : (ch.outline || 0), farK = skin.farShade || 0.85;
    const face = pose.face || {}, sw = pose.swaps || {};
    const jawOf = e => face.speaking && face.open > 0.05 && isLowerFace(e) ? Object.assign({}, e, { _jaw: face.open }) : e;
    const eyeOff = face.eye || [0, 0];
    // layered items: { d, fill?, stroke?, w?, tf? (matrix string), unit (frame scale) }
    const layers = {};
    for (const l of LAYERS) layers[l] = [];
    const genOut = {};          // layer -> generated markup (fallback)
    const M = (o, ax, ay) => `matrix(${fx(ax[0])} ${fx(ax[1])} ${fx(ay[0])} ${fx(ay[1])} ${fx(o[0])} ${fx(o[1])})`;
    const upright = (o, a) => ({ tf: M(o, dir(a), dir(a + Math.PI / 2)), unit: 1 });
    function limbFrame(bone, side) {
      const [ja, jb] = LIMB[bone], a = J[ja + '.' + side], b = J[jb + '.' + side];
      const e = sub(b, a), la = len(e) || 1e-6, ln = pr[bone], u = mul(e, 1 / la);
      return { a, b, e, u, la, ln, tf: M(a, e, mul([-u[1], u[0]], ln)), unit: ln };
    }
    function capD(F, c) {
      const r = c.cap, f0 = c.from === undefined ? 0 : c.from, f1 = c.to === undefined ? 1 : c.to;
      const n = [-F.u[1], F.u[0]];
      const P = t => add(F.a, mul(F.e, t));
      const ins = c.inset || 0, sg = Math.sign(ins), q = Math.abs(ins);
      const seg = (t0, t1, r0, r1) => {
        let A0 = P(t0), B0 = P(t1);
        if (ins) { A0 = add(A0, mul(n, sg * r0 * (1 - q))); B0 = add(B0, mul(n, sg * r1 * (1 - q))); r0 *= q; r1 *= q; }
        return polyD(capsulePts(A0, r0, B0, r1, false, 10));
      };
      if (r.length === 3) {
        const tm = c.mid === undefined ? 0.45 : c.mid;
        const rAt = t => t <= tm ? r[0] + (r[1] - r[0]) * t / tm : r[1] + (r[2] - r[1]) * (t - tm) / (1 - tm);
        const ds = [];
        if (f0 < tm) ds.push(seg(f0, Math.min(tm, f1), rAt(f0), rAt(Math.min(tm, f1))));
        if (f1 > tm) ds.push(seg(Math.max(tm, f0), f1, rAt(Math.max(tm, f0)), rAt(f1)));
        return ds.join('');
      }
      return seg(f0, f1, r[0] + (r[1] - r[0]) * f0, r[0] + (r[1] - r[0]) * f1);
    }
    // a soft limb: { tube: [r0, r1, r2] radii at shoulder|hip, elbow|knee, wrist|ankle; from, to:
    // fractions of the whole limb (beyond 1 extends the last bone); inset as for cap; flat: 'start'|'end'|'both' }
    function tubeOf(F, e) {
      const r = e.tube, f0 = e.from === undefined ? 0 : e.from, f1 = e.to === undefined ? 1 : e.to;
      let { C, R } = subChain(F.pts, [r[0], r[1], r[2] === undefined ? r[1] : r[2]], f0, f1);
      const ins = e.inset || 0;
      if (ins) {
        const sg = Math.sign(ins), q = Math.abs(ins);
        C = C.map((c, i) => {
          const a = C[Math.max(0, i - 1)], b = C[Math.min(C.length - 1, i + 1)], u = sub(b, a), l = len(u) || 1e-6;
          return add(c, mul([-u[1] / l, u[0] / l], sg * R[i] * (1 - q)));
        });
        R = R.map(x => x * q);
      }
      return tubeD(C, R, e.flat === 'start' || e.flat === 'both', e.flat === 'end' || e.flat === 'both');
    }
    // push the entries of one part (or swap) into a layer, in a given frame
    function emit(layer, entries, F, far, extra) {
      if (!entries) return;
      if (!Array.isArray(entries)) entries = [entries];
      for (const e of entries) {
        if (!e) continue;
        if (e.swap) { emitSwap(layer, e.swap, F, far); continue; }
        let tf = F.tf;
        if (e.look) tf += ` translate(${fx(eyeOff[0] * e.look * 0.03)} ${fx(eyeOff[1] * e.look * 0.03)})`;
        if (e._jaw) tf += ` translate(0 ${fx(-0.14 * e._jaw)}) scale(1 ${fx(1 + 0.08 * e._jaw)})`;
        if (e.tube) { layers[layer].push({ d: tubeOf(F, e), fill: col(e.fill, far), unit: 1 }); continue; }
        if (F.warp && e.d) {
          if (e.stroke) layers[layer].push({ d: warpD(e.d, F.warp, F.sx, F.sy), stroke: col(e.stroke, far), w: e.w || 0.02, unit: 1 });
          else layers[layer].push({ d: warpD(e.d, F.warp, F.sx, F.sy), fill: col(e.fill, far), unit: 1, op: e.opacity });
          continue;
        }
        if (e.cap) layers[layer].push({ d: capD(F, e), fill: col(e.fill, far), unit: 1 });
        else if (e.stroke) layers[layer].push({ d: e.d, stroke: col(e.stroke, far), w: e.w || 0.02, tf, unit: F.unit });
        else layers[layer].push({ d: e.d, fill: col(e.fill, far), tf, unit: F.unit, op: e.opacity });
      }
    }
    function pick(set, name, fallbacks) {
      if (!set) return null;
      if (set[name]) return set[name];
      for (const f of fallbacks) if (set[f]) return set[f];
      const k = Object.keys(set); return k.length ? set[k[0]] : null;
    }
    function emitSwap(layer, kind, F, far) {
      let name = sw[kind];
      if (kind === 'eye' && (face.blink || 0) > 0.5) name = 'closed';
      const fb = { eye: ['open'], mouth: ['neutral', 'smile'], brow: ['neutral'] }[kind] || [];
      // a head turned toward (+) or away from (-) the camera: the face features squeeze together and slide back
      const tn = face.turn || 0;
      if (tn && (kind === 'eye' || kind === 'mouth' || kind === 'brow') && F.tf) {
        const sx = 1 - 0.45 * Math.min(1, Math.abs(tn));
        F = Object.assign({}, F, { tf: F.tf + ` translate(${fx(0.3 * (1 - sx) - 0.12 * tn)} 0) scale(${fx(sx)} 1)` });
      }
      const genFace = ch.body && !(skin.swaps && skin.swaps[kind]);   // the mannequin's face, drawn from numbers
      const W = ch.body ? ch.body.b.headWidth : 0.9;
      if (kind === 'mouth' && genFace && (face.speaking || !/^(open|o|grit)$/.test(name || ''))) { emit(layer, genMouth(W, face), F, far); return; }
      if (kind === 'brow' && genFace) { emit(layer, genBrow(W, face), F, far); return; }
      if (kind === 'eye' && genFace && name !== 'closed') {
        if ((face.lid || 1) > 1.1 && swaps.eye && swaps.eye.wide) name = 'wide';
        emit(layer, pick(swaps[kind], name || fb[0], fb), F, far);
        if ((face.lid || 1) < 0.97) emit(layer, genLid(W, face.lid), F, far);
        return;
      }
      if (kind === 'mouth' && MOUTHF[name]) {
        // a skin without this mouth: the nearest shape it has, scaled about its own centre
        for (const [nm, sx, sy] of MOUTHF[name]) {
          const ent = swaps.mouth && swaps.mouth[nm];
          if (!ent) continue;
          if (sx === 1 && sy === 1) { emit(layer, ent, F, far); return; }
          const bb = bboxOf(ent), cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
          emit(layer, ent, Object.assign({}, F, { tf: F.tf + ` translate(${fx(cx * (1 - sx))} ${fx(cy * (1 - sy))}) scale(${fx(sx)} ${fx(sy)})` }), far);
          return;
        }
      }
      if (kind === 'brow' && face.browLift && F.tf) F = Object.assign({}, F, { tf: F.tf + ` translate(0 ${fx(0.035 * face.browLift)})` });
      emit(layer, pick(swaps[kind], name || fb[0], fb), F, far);
    }

    // ----- arms -----
    for (const side of ['far', 'near']) {
      const layer = 'arm.' + side, far = side === 'far' ? farK : 0;
      if (!parts.upperArm && !parts.foreArm && !parts.arm) { genOut[layer] = true; continue; }
      const hs = sw.hand && typeof sw.hand === 'object' ? sw.hand[side] : (side === 'near' ? sw.hand : sw.handFar);
      const items = [
        ['arm', { pts: [J['shoulder.' + side], J['elbow.' + side], J['wrist.' + side]], unit: 1 }],
        ['upperArm', limbFrame('upperArm', side)], ['foreArm', limbFrame('foreArm', side)],
        ['hand', Object.assign(upright(J['wrist.' + side], A['hand.' + side]), {})],
      ];
      const z = b => (b === 'hand' ? (skin.handZ === undefined ? 1 : skin.handZ) : (parts[b] && parts[b].z) || 0);
      items.sort((p, q) => z(p[0]) - z(q[0]));
      for (const [b, F] of items) {
        if (b === 'hand') {
          if (parts.hand) emit(layer, parts.hand, F, far);
          else emit(layer, pick(swaps.hand, hs || 'relaxed', ['relaxed']), F, far);
        } else emit(layer, parts[b], F, far);
      }
      // a held object (holdNear / holdFar): drawn over the hand in the hand frame, or with
      // upright: true in an upright frame at the grip (a cane or a lantern that hangs straight)
      const held = parts[side === 'near' ? 'holdNear' : 'holdFar'];
      if (held) {
        const ha = A['hand.' + side], g = skin.grip || [0.1, 0], gp = add(J['wrist.' + side], rot(g, ha));
        for (const e of [].concat(held)) {
          if (!e) continue;
          if (e.use === 'cane' && side === 'near' && pose.cane) {
            // planted: from the grip down to the tip on the ground, stretched a little if needed
            const dv = sub(pose.cane.tip, gp), dl = len(dv) || 1e-6, a = Math.atan2(dv[1], dv[0]) + Math.PI / 2, sy = dl / (e.length || dl);
            emit(layer, e, { tf: `matrix(${fx(Math.cos(a))} ${fx(Math.sin(a))} ${fx(-Math.sin(a) * sy)} ${fx(Math.cos(a) * sy)} ${fx(gp[0])} ${fx(gp[1])})`, unit: 1 }, far);
          } else if (e.use === 'cane') {
            // carried: held loosely, slanting forward and down whatever the arm does, never into the ground
            let a = 0.75;
            const ln = e.length || 1;
            for (let i = 0; i < 30 && gp[1] - ln * Math.cos(a) < 0.03; i++) a += 0.1;
            if (pose.caneTuck > 0) {   // the hand is busy (a hug): the stick is tucked along the forearm, pointing back past the elbow
              const d = sub(J['elbow.' + side], J['wrist.' + side]), aT = Math.atan2(d[0], -d[1]);
              let dA = aT - a; while (dA > Math.PI) dA -= 2 * Math.PI; while (dA < -Math.PI) dA += 2 * Math.PI;
              a += dA * Math.min(1, pose.caneTuck);
            }
            emit(layer, e, upright(gp, a), far);
          }
          else emit(layer, e, e.upright ? upright(gp, 0) : upright(J['wrist.' + side], ha), far);
        }
      }
    }
    // ----- legs (+ pelvis) -----
    for (const side of ['far', 'near']) {
      const layer = 'leg.' + side, far = side === 'far' ? farK : 0;
      if (!parts.thigh && !parts.shin && !parts.leg) { genOut[layer] = true; continue; }
      emit(layer, parts.leg, { pts: [J['hip.' + side], J['knee.' + side], J['ankle.' + side]], unit: 1 }, far);
      emit(layer, parts.thigh, limbFrame('thigh', side), far);
      emit(layer, parts.shin, limbFrame('shin', side), far);
      emit(layer, parts.foot, upright(J['ankle.' + side], A['foot.' + side]), far);
    }
    if (parts.pelvis) emit('pelvis', parts.pelvis, upright(J.root, A.pelvis), 0);
    if (parts.neck) emit('neck', parts.neck, upright(J.neckBase, A.neck), 0); else genOut.neck = true;
    const sp = sol.spine, bent = sp && (sp.tb !== 0 || sp.ts !== 1);
    const torsoF = bent ? { warp: p => spineWarp(sp, p).p, sx: 1 / sp.ts, sy: sp.ts, unit: 1 } : upright(J.root, A.torso);
    // ----- skirt: cloth from the waist round both legs down to a hem length -----
    // { skirt: true, length (0 = at the hip .. 1 = at the ankles, fraction of the leg), top (waist
    //   height as a fraction of the torso, default 0.38), flare (hem spread, fraction of the skirt
    //   length, default 0.15), loose (ease round the legs, head units, default 0.04), fill, shade
    //   (a colour for the far leg's half, optional), hem: { fill, w } (a band along the hem) }
    // The outline is traced level by level down the body, so the cloth hangs over the hips, lies
    // over the thighs and shins when she sits, and curves in under a lifted knee. It can spread
    // only so far: in a long stride the lower legs come out from under the hem. The hem trails on a
    // spring (pose.skirtSway).
    const skirtE = parts.skirt && [].concat(parts.skirt).find(e => e && e.skirt);
    if (skirtE) {
      const slen = clamp(skirtE.length === undefined ? 0.6 : skirtE.length, 0.05, 1.05), lo = skirtE.loose === undefined ? 0.04 : skirtE.loose;
      const prof = ch.body ? ch.body.profile : (y => ({ front: pr.radius.hem, back: -pr.radius.hem }));
      const T = pr.torso, topY = (skirtE.top === undefined ? 0.38 : skirtE.top) * T;
      const TP = p => (sp && (sp.tb !== 0 || sp.ts !== 1)) ? spineWarp(sp, p).p : add(J.root, rot(p, A.torso));
      const body = [];
      for (let i = 0; i <= 4; i++) { const y = topY * (1 - i / 4) - 0.04 * T * (i === 4 ? 1 : 0), p = prof(Math.max(0, y)); body.push(TP([p.front + lo, y]), TP([p.back - lo, y])); }
      const legR = [pr.radius.hip, pr.radius.knee, pr.radius.knee * 0.72];
      const Ltot = pr.thigh + pr.shin, sway = pose.skirtSway || 0, flare = skirtE.flare === undefined ? 0.15 : skirtE.flare;
      const hipD = prof(0).front - prof(0).back;
      const legPts = side => {
        const H = J['hip.' + side], K = J['knee.' + side], An = J['ankle.' + side], out = [];
        const lt = len(sub(K, H)), ls = len(sub(An, K)), total = lt + ls;
        for (let i = 0; i <= 14; i++) {
          const s = slen * total * i / 14;
          let c, d, r;
          if (s <= lt) { const u = s / lt; c = add(H, mul(sub(K, H), u)); d = sub(K, H); r = mix(legR[0], legR[1], u); }
          else { const u = Math.min(1.2, (s - lt) / ls); c = add(K, mul(sub(An, K), u)); d = sub(An, K); r = mix(legR[1], legR[2], Math.min(1, u)); }
          const n = mul([-d[1], d[0]], 1 / (len(d) || 1));
          out.push({ c, n, r: r + lo, low: s > lt ? (s - lt) / Math.max(1e-6, slen * total - lt) : 0 });
        }
        return out;
      };
      const legs = { near: legPts('near'), far: legPts('far') };
      // the cloth can only spread so far: lower legs beyond that come out from under it
      const eN = legs.near[legs.near.length - 1].c, eF = legs.far[legs.far.length - 1].c, sep = Math.abs(eN[0] - eF[0]);
      const wMax = hipD + (0.3 + flare) * slen * Ltot, pull = Math.max(0, sep - wMax) / 2, mid = (eN[0] + eF[0]) / 2;
      const ptsOf = side => {
        const out = [];
        for (const q of legs[side]) {
          const c = [q.c[0] + Math.sign(mid - q.c[0]) * Math.min(Math.abs(mid - q.c[0]), pull * q.low), q.c[1]];
          out.push(add(c, mul(q.n, q.r)), add(c, mul(q.n, -q.r)));
        }
        return out;
      };
      // outline: at each level down from the waist, the frontmost and backmost covered point
      const trace = pts => {
        const top = Math.max(...pts.map(p => p[1])), bot = Math.min(...pts.map(p => p[1])), N = 12, dy = (top - bot) / N;
        const front = [], back = [];
        for (let i = 0; i <= N; i++) {
          const y = top - i * dy, near = pts.filter(p => Math.abs(p[1] - y) <= dy * 0.8 + 1e-6);
          if (!near.length) continue;
          const k = i / N, fl = flare * slen * Ltot * k * k * 0.5, sw = sway * k * k;
          front.push([Math.max(...near.map(p => p[0])) + fl + sw, y]);
          back.push([Math.min(...near.map(p => p[0])) - fl + sw, y]);
        }
        // drape: going down, cloth comes in only slowly from the widest point above, then smooth
        const fall = dy * 0.45;
        for (let i = 1; i < front.length; i++) { front[i][0] = Math.max(front[i][0], front[i - 1][0] - fall); back[i][0] = Math.min(back[i][0], back[i - 1][0] + fall); }
        for (const side of [front, back]) for (let pass = 0; pass < 2; pass++) for (let i = 1; i < side.length - 1; i++) side[i][0] = (side[i - 1][0] + 2 * side[i][0] + side[i + 1][0]) / 4;
        return { pts: back.concat(front.reverse()), front, back };
      };
      const all = trace(body.concat(ptsOf('near'), ptsOf('far')));
      layers.torso.push({ d: blobD(all.pts, 0.7), fill: col(skirtE.fill || 'dress'), unit: 1 });
      if (skirtE.shade && typeof skirtE.shade === 'string') {
        layers.torso.push({ d: blobD(trace(body.concat(ptsOf('far'))).pts, 0.7), fill: col(skirtE.shade), unit: 1 });
        layers.torso.push({ d: blobD(trace(body.concat(ptsOf('near'))).pts, 0.7), fill: col(skirtE.fill || 'dress'), unit: 1 });
      }
      if (skirtE.hem) {
        const w = skirtE.hem.w || 0.08, a = all.back[all.back.length - 1], b2 = all.front[0];
        if (a && b2) layers.torso.push({ d: polyD([a, b2, [b2[0] - w * 0.2, b2[1] + w], [a[0] + w * 0.2, a[1] + w]]), fill: col(skirtE.hem.fill || 'hem'), unit: 1 });
      }
    }
    if (parts.torso) emit('torso', parts.torso, torsoF, 0); else genOut.torso = true;
    if (parts.head) {
      const HF = upright(J.headBase, A.head);
      const list = Array.isArray(parts.head) ? parts.head : [parts.head];
      emit('head', list.map(jawOf), HF, 0);
      for (const k of ['mouth', 'eye', 'brow']) if (!list.some(e => e && e.swap === k)) emitSwap('head', k, HF, 0);
    } else genOut.head = true;
    // hair (head frame): parts.hair over the head, parts.hairBack behind everything
    if (parts.hair) emit('head', [].concat(parts.hair).map(jawOf), upright(J.headBase, A.head), 0);
    if (parts.hairBack) emit('back', parts.hairBack, upright(J.headBase, A.head), 0);
    // ----- follow-through chains -----
    const chains = skin.chains || {}, sec = (pose.secondary && pose.secondary.chains) || {};
    for (const name of Object.keys(chains)) {
      const c = chains[name];
      const { pts, angs } = chainPoints(ch, sol, c, sec[name]);
      const ribbon = (wk, off) => {
        const L = [], Rr = [];
        for (let i = 0; i < pts.length; i++) {
          const a = i < angs.length ? (i ? (angs[i - 1] + angs[i]) / 2 : angs[0]) : angs[angs.length - 1];
          const nn = dir(a + Math.PI / 2), w = c.width[i] / 2;
          const cpt = add(pts[i], mul(nn, off * w));
          L.push(add(cpt, mul(nn, w * wk))); Rr.push(add(cpt, mul(nn, -w * wk)));
        }
        const last = angs[angs.length - 1];
        const tip = add(pts[pts.length - 1], mul(dir(last), c.tip === undefined ? 0.03 : c.tip));
        return blobD(L.concat([tip], Rr.reverse()), 0.85);
      };
      const layer = c.layer || 'back';
      layers[layer].push({ d: ribbon(1, 0), fill: col(c.fill), unit: 1 });
      if (c.shade) layers[layer].push({ d: ribbon(c.shade, -(1 - c.shade) * (c.shadeSide || 1)), fill: col(c.fill + 'Shade'), unit: 1 });
      // endUpright: the end part keeps the bone's upright frame (x forward, y up), turned only by how far
      // the chain has swung from rest; otherwise its x axis runs along the last segment
      const swing = (sec[name] && sec[name].length) ? sec[name][sec[name].length - 1] : 0;
      if (c.end) emit(layer, c.end, upright(pts[pts.length - 1], c.endUpright ? (A[c.bone || 'head'] || 0) + swing : last0(angs)), 0);
    }
    function last0(a) { return a[a.length - 1]; }

    // ----- emit, far to near; outlined skins draw a stroke pass then a fill pass per layer -----
    const out = [];
    let gen = null;
    const G = () => gen || (gen = generated(ch, pose, sol, out));
    for (const l of LAYERS) {
      if (opts.layers && opts.layers.indexOf(l) < 0) continue;   // one pass of a paired drawing (docs/PAIRS.md)
      if (genOut[l]) {
        if (l === 'arm.far') G().drawArm('far');
        else if (l === 'arm.near') G().drawArm('near');
        else if (l === 'leg.far') G().drawLeg('far', false);
        else if (l === 'leg.near') G().drawLeg('near', !parts.pelvis);
        else if (l === 'neck') G().drawNeck();
        else if (l === 'torso') G().drawTorso();
        else if (l === 'head') G().drawHead();
      }
      const items = layers[l];
      if (!items.length) continue;
      const T = it => it.tf ? ` transform="${it.tf}"` : '';
      if (ow > 0) for (const it of items) {
        const w = (it.stroke ? it.w * it.unit + ow * 2 : ow * 2) / it.unit;
        out.push(`<path d="${it.d}"${T(it)} fill="${it.stroke ? 'none' : ch.palette.outline}" stroke="${ch.palette.outline}" stroke-width="${fx(w)}" stroke-linejoin="round" stroke-linecap="round"/>`);
      }
      for (const it of items) {
        if (it.stroke) out.push(`<path d="${it.d}"${T(it)} fill="none" stroke="${it.stroke}" stroke-width="${fx(it.w)}" stroke-linecap="round" stroke-linejoin="round"/>`);
        else out.push(`<path d="${it.d}"${T(it)} fill="${it.fill}"${it.op && !sil ? ` fill-opacity="${it.op}"` : ''}/>`);
      }
    }
    return wrap(out, opts);
  }

  return { defaultCharacter, solve, render, ik2, bendAt, footGeometry, footPoints, shade,
    headTopOf, bboxOf, skinCharacter, heightOf, chainBase, chainPoints, LAYERS, tubeD, spineWarp, parsePath };
});

}).call(G);

// ---- src/gait.js ----
(function (module, exports, require) {
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

}).call(G);

// ---- src/poses.js ----
(function (module, exports, require) {
﻿// poses.js - the action vocabulary of CharPerform, stored as data (STAGE.md section 2).
// UMD: window.CharPoses in the browser, module.exports in Node.
//
// ===================== RECIPE: adding an action (for example "pet" or "pull") =====================
// 0. Motion clips: an entry with clip: '<name>' (or a function of the args, see wave) is played from
//    clips.js (pose keys on a time line, splines, per-field lag, foot contacts, root motion); its
//    keys below, if any, are only a fallback. To tune idle, bounce, jump, skid, turn, the run start
//    or wave, edit clips.js (its top comment lists the format). New clips need no code.
// 1. Pick a channel. 'body' = legs, hips and spine (one at a time, holds until the next body
//    action); 'arms' = a gesture laid over whatever the body does; 'face' and 'look' are built in.
// 2. Copy the closest existing entry below and rename it. An entry is:
//      name: { channel, args: { argName: default, ... }, doc: 'one line for authors',
//              keys: [ key, key, ... ],        // played in order, each from the previous one
//              hold, release, mood }           // arms only: how long to hold, how long to let go
//    An argument default of null means "required". The first argument is the positional one.
// 3. A key is { dur, ease, ...pose fields }. Fields you leave out keep their previous value.
//    dur  : seconds to reach this key.   ease : 'inOut' | 'out' | 'in' | 'back' (overshoots
//           about 12% then settles; use it for fast moves) | 'linear'.
//    Body fields (positions in leg lengths L, angles in degrees):
//      x     pelvis forward/back from where the action started (+ = the way she faces)
//      h     pelvis height above the ankles: 0.975 standing, 0.58 deep crouch
//      lean  spine (+ forward)   tilt  hips   twist  chest   neck, head (+ = chin down)
//      near, far   feet: [x, lift, angle]  (angle + = toes up), or 'keep' (stay planted),
//                  or { knee: x, shin: deg } to put that knee on the ground
//      squash [sx, sy]   stretch (max limb stretch, <= 1.12)   mouth (swap while this key runs)
//    Arm fields (degrees; 0 = hanging along the body, + = swinging forward and up):
//      armN, armF  [shoulder, elbow, wrist] for the gesture's main arm and the other arm
//      hands       'open' or [main, other]: relaxed | fist | open | point | grip
//      aim         { off, elbow, lean } aims the main arm at args.at (off = degrees above it)
//      wiggle      [{ arm: 'N'|'F', j: 0|1|2, amp, hz, ph }]  oscillation during this key
//      lean, head, twist, h on an arms key are ADDED to the body (a gesture can bend the body).
//    Any field may be a function (args, body) => value, where body = { L, A, k, ... } for the
//    current skin; see `sit` for an example.
// 4. Reload poses.html: your action gets a row of 6 frames automatically. Check the joints and
//    that feet stay on the ground, then run `node --test tests/perform.test.cjs`.
//
// Example, a "pet" gesture (stroke something low in front):
//   pet: { channel: 'arms', args: { at: null }, doc: 'stroke an animal at a place', hold: 1.6,
//          release: 0.4, keys: [
//            { dur: 0.35, ease: 'inOut', aim: { off: 0, elbow: 25, lean: 0.6 }, hands: 'open' },
//            { dur: 1.6, wiggle: [{ arm: 'N', j: 1, amp: 10, hz: 1.2 }] } ] },
// =================================================================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CharPoses = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // The resting pose: weight on the back leg, hips and chest turned a touch, arms asymmetric.
  const STAND = { x: 0, h: 0.975, lean: -2, tilt: 3, twist: 5, neck: -2, head: 3,
    near: [0.12, 0, 0], far: [-0.08, 0, 0], armN: [7, 16, 10], armF: [-9, 24, 4], hands: ['relaxed', 'relaxed'] };

  const actions = {
    // ------------------------------------------------------------------ moves (code in perform.js)
    walk: { channel: 'body', moves: true, args: { to: null, speed: 1, steps: 0 }, doc: 'walk to x or an anchor; speed 0.5..2; steps = exact number of steps (0 = automatic)',
      gait: 'walk', params: { cadence: 1.02 }, blendIn: 0.3, accel: 0.32, settle: 0.36, startLean: -3, stopLean: 5 },
    run: { channel: 'body', moves: true, args: { to: null, speed: 1, steps: 0, end: 'stop' }, doc: 'run to x or an anchor; steps = exact number of steps (0 = automatic); end = stop | skid (arrive at full speed and skid to a stop at the target)',
      gait: 'run', start: 'runStart', cycle: 'runCycle', params: { stride: 3.0, cadence: 1.43, duty: 0.26 }, blendIn: 0.26, accel: 0.42, settle: 0.5, startLean: -7, stopLean: 12, startDip: 0.05 },
    sneak: { channel: 'body', moves: true, args: { to: null, speed: 1 }, doc: 'tiptoe, crouched, to x or an anchor',
      gait: 'sneak', blendIn: 0.45, accel: 0.45, settle: 0.5, startLean: 4, stopLean: 3 },
    enter: { channel: 'body', moves: true, args: { from: 'left', speed: 1 }, doc: 'walk in from off screen (left|right) to her place',
      gait: 'walk', params: { cadence: 1.02 }, blendIn: 0.0, accel: 0.25, settle: 0.42, startLean: 0, stopLean: 5 },
    turn: { channel: 'body', args: {}, doc: 'turn round to face the other way', dur: 0.34, clip: 'turn' },
    // ---- clip actions (data in clips.js) ----
    bounce: { channel: 'body', args: { times: 3 }, doc: 'bounce on the toes, times = number of bobs', clip: 'bounce' },
    skid: { channel: 'body', args: {}, doc: 'skid to a stop (best straight after a run: run(to=x, end=skid) does it at the target)', clip: 'skid' },
    jump: { channel: 'body', moves: true, args: { to: null, height: 1, pose: 'tuck' }, doc: 'jump to x or an anchor; height 1 = normal, 2 = big; pose = tuck | leap (legs split front and back, arms flung)', clip: 'jump',
      // the keys below are the keyed version, used for pose=leap and on a beat grid
      // anticipation crouch, push off, (flight), contact, squash, recover
      crouch: { dur: 0.28, ease: 'inOut', h: 0.7, lean: 30, neck: -10, head: -12, armN: [-55, 35, 0], armF: [-45, 40, 0], hands: ['open', 'open'], squash: [1.04, 0.96], mouth: 'grit' },
      push: { dur: 0.1, ease: 'out', h: 1.02, lean: 14, neck: -4, head: -6, armN: [118, 16, 10], armF: [100, 28, 10], squash: [0.95, 1.06], stretch: 1.07, toe: -40, mouth: 'open' },
      tuck: { lean: 6, armN: [104, 44, 10], armF: [88, 56, 10], feet: [[0.12, -0.52], [-0.12, -0.42]] },
      leap: { lean: 4, armN: [128, 12, 10], armF: [-72, 18, 0], feet: [[0.56, -0.7], [-0.58, -0.62]] },   // added for the early jump film
      contact: { h: 0.93, lean: 10, armN: [80, 30, 0], armF: [65, 35, 0], squash: [1, 1], near: [0.12, 0, 8], far: [-0.1, 0, 4] },
      land: { dur: 0.13, ease: 'out', h: 0.62, lean: 32, neck: -10, head: -14, armN: [62, 45, 0], armF: [48, 50, 0], squash: [1.07, 0.93], mouth: 'grit' },
      recover: { dur: 0.45, ease: 'back', squash: [1, 1], mouth: null },
      flight: 0.42, flightPerL: 0.05, heightL: 0.55 },

    // ------------------------------------------------------------------ body poses
    stand: { channel: 'body', args: {}, doc: 'stand at ease', keys: [Object.assign({ dur: 0.45, ease: 'inOut' }, STAND)] },
    idle: { channel: 'body', args: {}, doc: 'stand with life: weight shifts, glances', clip: 'idle',
      keys: [Object.assign({ dur: 0.45, ease: 'inOut' }, STAND)],
      loop: { x: [0.05, 4.6], lean: [2, 4.6, 0.3], tilt: [3.5, 4.6], twist: [4, 4.6, 0.1], head: [7, 7.3], neck: [4, 5.9], armN: [6, 4.6, 0.2], armF: [5, 5.3] } },
    kneel: { channel: 'body', args: {}, doc: 'go down on one knee',
      keys: [
        { dur: 0.28, ease: 'inOut', h: 0.86, lean: 14, near: [-0.3, 0, 0], far: [0.16, 0, 0], armN: [14, 26, 6], armF: [10, 30, 0], head: 6 },
        { dur: 0.4, ease: 'out', x: -0.02, lean: 10, near: { knee: 0.08, shin: 24 }, far: [0.42, 0, 0], armN: [4, 34, 14], armF: [38, 74, 6], head: 8, neck: 4 },
        { dur: 0.22, ease: 'inOut', lean: 5, head: 2, neck: 0 },
      ] },
    crouch: { channel: 'body', args: {}, doc: 'squat down low, ready',
      keys: [
        { dur: 0.36, ease: 'back', h: 0.6, lean: 30, neck: -12, head: -16, near: [0.17, 0, 0], far: [-0.12, 0, -22], armN: [40, 58, 12], armF: [30, 64, 4] },
      ] },
    recoil: { channel: 'body', args: {}, doc: 'flinch and step back in fear', mood: 'scared',
      keys: [
        { dur: 0.1, ease: 'out', h: 0.95, lean: -3, neck: 10, head: 8, armN: [42, 95, -20], armF: [30, 100, -10], hands: ['open', 'open'] },
        { dur: 0.24, ease: 'back', x: -0.3, h: 0.92, lean: -11, neck: 8, head: -2, far: [-0.66, 0, 0], near: [0.06, 0, 16], armN: [78, 88, -35], armF: [62, 96, -20] },
        { dur: 0.5, ease: 'inOut', x: -0.28, h: 0.9, lean: -7, neck: 12, head: 5, near: [0.06, 0, 0], armN: [60, 102, -25], armF: [46, 106, -15] },
      ] },
    // ---- added for films/ep1 (Kai): peer, breathe, wobble ----
    peer: { channel: 'body', args: {}, doc: 'lean out over an edge to look down, arms back for balance (holds)',
      keys: [
        { dur: 0.55, ease: 'inOut', x: 0.05, h: 0.955, lean: 13, neck: 4, head: 5, twist: 2, near: [0.3, 0, 0], far: [-0.1, 0, 0], armN: [-32, 22, 6], armF: [-40, 26, 4], hands: ['open', 'open'] },
        { dur: 0.7, ease: 'inOut', lean: 17, head: 7, armN: [-38, 26, 8], armF: [-46, 30, 6] },
      ] },
    breathe: { channel: 'body', args: {}, doc: 'a deep breath: chest up, hold, blow out, settle (about 2.4 s)',
      keys: [
        { dur: 0.75, ease: 'inOut', h: 0.99, lean: -8, tilt: 2, neck: -6, head: -10, twist: 2, near: [0.12, 0, 0], far: [-0.1, 0, 0], armN: [-6, 20, 6], armF: [-14, 24, 2], squash: [0.97, 1.04], hands: ['relaxed', 'relaxed'] },
        { dur: 0.45, ease: 'linear', lean: -9, head: -11 },
        { dur: 0.8, ease: 'inOut', h: 0.955, lean: 5, neck: 3, head: 7, armN: [6, 18, 8], armF: [-4, 22, 4], squash: [1.02, 0.98], mouth: 'o' },
        { dur: 0.4, ease: 'inOut', h: 0.975, lean: -1, neck: -2, head: 2, squash: [1, 1], armN: STAND.armN, armF: STAND.armF },
      ] },
    wobble: { channel: 'body', args: {}, doc: 'lose balance (after a landing): pitch forward and back, arms windmill, recover',
      keys: [
        { dur: 0.2, ease: 'out', h: 0.95, lean: 24, neck: -6, head: -10, near: [0.14, 0, 0], far: [-0.16, 0.24, -10], armN: [150, 22, 0], armF: [-40, 30, 0], hands: ['open', 'open'], mouth: 'grit' },
        { dur: 0.24, ease: 'inOut', h: 0.965, lean: -14, neck: 4, head: 6, far: [-0.12, 0, 0], near: [0.22, 0.14, 16], armN: [40, 30, 0], armF: [165, 20, 0], mouth: 'o' },
        { dur: 0.22, ease: 'inOut', h: 0.955, lean: 15, head: -6, near: [0.16, 0, 0], armN: [140, 30, 0], armF: [20, 40, 0], mouth: 'grit' },
        { dur: 0.22, ease: 'inOut', lean: -6, head: 2, armN: [60, 40, 0], armF: [110, 40, 0], mouth: 'o' },
        { dur: 0.3, ease: 'back', lean: 5, armN: [24, 30, 0], armF: [14, 32, 0], mouth: null },
        Object.assign({ dur: 0.4, ease: 'inOut' }, STAND, { x: null, near: null, far: null }),
      ] },
    sit: { channel: 'body', args: { on: 0 }, doc: 'sit on the ground, or on a seat on=<height px>',
      keys: [
        { dur: 0.35, ease: 'inOut', h: 0.62, lean: 24, near: [0.2, 0, 0], far: [0.02, 0, 0], armN: [30, 30, 0], armF: [20, 30, 0] },
        { dur: 0.42, ease: 'out', x: -0.12,
          h: (a, b) => a.on > 0 ? (a.on / b.k + Math.max(0.2, b.pr.radius.hip * 0.75) - b.A) / b.L : (Math.max(0.25, b.pr.radius.hip * 0.85) - b.A) / b.L,   // seat height grows with a thick thigh
          lean: (a) => a.on > 0 ? 4 : -8, head: (a) => a.on > 0 ? 3 : 8,
          near: (a, b) => a.on > 0 ? [0.42, 0, 0] : [0.66, 0, 14], far: (a, b) => a.on > 0 ? [0.32, 0, 0] : [0.52, 0, 10],
          armN: (a) => a.on > 0 ? [48, 24, 0] : [-38, 8, -70], armF: (a) => a.on > 0 ? [40, 30, 0] : [-30, 8, -70] },
        { dur: 0.3, ease: 'inOut', lean: (a) => a.on > 0 ? 6 : -5 },
      ] },
    // ---- added for films/ep2 (Kai): fallsit ----
    fallsit: { channel: 'body', args: {}, doc: 'something gives way: pop up, topple backwards and land sitting on the ground (holds; ~0.9 s)',
      keys: [
        { dur: 0.12, ease: 'out', x: -0.08, h: 0.97, lean: -20, neck: -6, head: -12, near: [0.12, 0.1, 18], far: [-0.06, 0, 0], armN: [70, 12, 0], armF: [58, 16, 0], hands: ['open', 'open'], mouth: 'o' },
        { dur: 0.26, ease: 'in', x: -0.42, h: (a, b) => (Math.max(0.25, b.pr.radius.hip * 0.85) - b.A) / b.L, lean: -18, head: -8, near: [0.22, 0.2, 30], far: [0.1, 0.12, 24], armN: [128, 22, 0], armF: [104, 30, 0] },
        { dur: 0.32, ease: 'back', lean: -6, neck: 2, head: 6, near: [0.28, 0, 14], far: [0.14, 0, 10], armN: [-38, 8, -70], armF: [-30, 8, -70], mouth: null },
        { dur: 0.2, ease: 'inOut', lean: -4 },
      ] },

    // ---- added for the early jump film: backstep ----
    backstep: { channel: 'body', args: {}, doc: 'back away from something: three wary steps backwards, hands up in front (~1.4 s, about 1.4 leg lengths)', mood: 'scared',
      keys: [
        { dur: 0.32, ease: 'inOut', x: -0.28, h: 0.955, lean: -9, neck: 6, head: 6, near: [0.12, 0, 0], far: [-0.62, 0, 0], armN: [36, 78, -14], armF: [28, 86, -10], hands: ['open', 'open'] },
        { dur: 0.34, ease: 'inOut', x: -0.78, lean: -7, near: [-1.08, 0, 0], armN: [40, 82, -16], armF: [30, 90, -12] },
        { dur: 0.34, ease: 'inOut', x: -1.26, lean: -8, far: [-1.5, 0, 0], head: 8 },
        { dur: 0.4, ease: 'inOut', x: -1.36, h: 0.97, lean: -3, neck: 2, head: 4, near: [-1.24, 0, 0], armN: [14, 40, 6], armF: [8, 46, 4], hands: ['relaxed', 'relaxed'] },
      ] },

    // ------------------------------------------------------------------ arm gestures
    wave: { channel: 'arms', args: { hand: 'near' }, doc: 'wave hello (hand=near|far|both)', release: 0.4, mood: 'happy',
      clip: a => a.hand === 'both' ? 'waveBoth' : 'wave',
      keys: [
        { dur: 0.28, ease: 'back', armN: [104, 62, -6], armF: [-6, 26, 0], hands: ['open', 'relaxed'], lean: -3, head: -5, twist: 6 },
        { dur: 0.95, ease: 'linear', wiggle: [{ arm: 'N', j: 1, amp: 24, hz: 2.4 }, { arm: 'N', j: 2, amp: 16, hz: 2.4, ph: 0.22 }] },
      ] },
    point: { channel: 'arms', args: { at: null, for: 1.5 }, doc: 'point at a place or name', hold: 'for', release: 0.35,
      keys: [
        { dur: 0.14, ease: 'out', aim: { off: -30, elbow: 70 }, hands: ['fist', 'relaxed'], twist: -4 },
        { dur: 0.2, ease: 'back', aim: { off: 0, elbow: 6, lean: 0.12 }, hands: ['point', 'relaxed'], armF: [-14, 28, 0], twist: 8, head: -3 },
      ] },
    reach: { channel: 'arms', args: { at: null, for: 1.2 }, doc: 'reach out to a place or name', hold: 'for', release: 0.45,
      keys: [
        { dur: 0.16, ease: 'inOut', aim: { off: 10, elbow: 50 }, hands: ['relaxed', 'relaxed'] },
        { dur: 0.36, ease: 'out', aim: { off: 0, elbow: 4, lean: 0.45 }, hands: ['open', 'relaxed'], armF: [-28, 30, 0], stretch: 1.08, twist: 10,
          wiggle: [{ arm: 'N', j: 2, amp: 6, hz: 0.9 }] },
      ] },
    cheer: { channel: 'arms', args: {}, doc: 'both arms up, fists, a little bounce', release: 0.4, mood: 'excited',
      keys: [
        { dur: 0.12, ease: 'out', armN: [25, 100, 0], armF: [20, 105, 0], hands: ['fist', 'fist'], h: -0.05, lean: 6 },
        { dur: 0.22, ease: 'back', armN: [108, 14, 20], armF: [140, 40, 10], h: 0.02, lean: -9, head: -10, stretch: 1.1 },
        { dur: 0.85, ease: 'linear', wiggle: [{ arm: 'N', j: 0, amp: 9, hz: 2.2 }, { arm: 'F', j: 0, amp: 9, hz: 2.2, ph: 0.5 }], bob: [0.03, 2.2] },
      ] },
    hold: { channel: 'arms', args: { prop: null, how: 'front', weight: 0, quick: 0 }, doc: 'take and keep holding a prop: how=up|front|side', hold: Infinity, release: 0.4,
      variants: {
        front: [{ dur: 0.32, ease: 'inOut', armN: [42, 92, -10], armF: [48, 88, -10], hands: ['grip', 'grip'] }],
        up: [{ dur: 0.18, ease: 'out', armN: [60, 60, 0], hands: ['grip', 'relaxed'] }, { dur: 0.3, ease: 'back', armN: [172, 10, 0], armF: [-10, 24, 0], lean: -4, head: -8 }],
        side: [{ dur: 0.3, ease: 'inOut', armN: [6, 14, -6], hands: ['grip', 'relaxed'] }],
      } },
    // ---- added for films/ep1 (Kai): clench, pet ----
    clench: { channel: 'arms', args: { for: 1.2 }, doc: 'clench a fist in front of the chest and hold it, trembling with resolve', hold: 'for', release: 0.45, mood: 'determined',
      keys: [
        { dur: 0.3, ease: 'back', armN: [22, 122, -12], armF: [-8, 30, 0], hands: ['fist', 'relaxed'], lean: 4, head: 3, twist: -5 },
        { dur: 0.5, ease: 'inOut', armN: [26, 128, -16], lean: 5, head: 5, wiggle: [{ arm: 'N', j: 1, amp: 2.5, hz: 7 }, { arm: 'N', j: 0, amp: 1.5, hz: 7, ph: 0.3 }] },
      ] },
    pet: { channel: 'arms', args: { at: null, for: 2 }, doc: 'stroke an animal at a place or name, gently, for= seconds', hold: 'for', release: 0.45, mood: 'happy',
      keys: [
        { dur: 0.4, ease: 'inOut', aim: { off: 4, elbow: 30, lean: 0.15 }, hands: ['open', 'relaxed'], head: 6 },
        { dur: 0.6, ease: 'inOut', aim: { off: -2, elbow: 22, lean: 0.2 }, head: 8,
          wiggle: [{ arm: 'N', j: 1, amp: 12, hz: 1.1 }, { arm: 'N', j: 0, amp: 5, hz: 1.1, ph: 0.25 }, { arm: 'N', j: 2, amp: 10, hz: 1.1, ph: 0.5 }] },
      ] },
    // ---- added for films/ep2 (Kai): hesitate, tug, shield, laugh ----
    hesitate: { channel: 'arms', args: { at: null, for: 0.8 }, doc: 'reach slowly toward a place or name, flinch back to the chest, then reach again, slowly (~2.6 s + for)', hold: 'for', release: 0.4,
      keys: [
        { dur: 0.8, ease: 'inOut', aim: { off: 22, elbow: 70, lean: 0.12 }, hands: ['open', 'relaxed'], armF: [-6, 30, 0], head: 2 },
        { dur: 0.22, ease: 'out', armN: [26, 118, -22], armF: [10, 60, 0], hands: ['fist', 'relaxed'], lean: -5, head: -3, twist: -4 },
        { dur: 0.55, ease: 'linear', wiggle: [{ arm: 'N', j: 1, amp: 3, hz: 6 }] },
        { dur: 1.0, ease: 'inOut', aim: { off: 4, elbow: 18, lean: 0.4 }, hands: ['open', 'relaxed'], armF: [-20, 30, 0], head: 4, twist: 6,
          wiggle: [{ arm: 'N', j: 2, amp: 5, hz: 2.5 }] },
      ] },
    tug: { channel: 'arms', args: { at: null, for: 1.5, hand: 'both' }, doc: 'grip something at a place or name with both hands and pull hard, leaning back, straining', hold: 'for', release: 0.3, mood: 'angry',
      keys: [
        { dur: 0.3, ease: 'inOut', aim: { off: 0, elbow: 16, lean: 0.35 }, hands: ['grip', 'grip'] },
        { dur: 0.35, ease: 'out', aim: { off: -8, elbow: 6, lean: 0 }, lean: -14, h: -0.05, head: 6, neck: 4, twist: -6,
          wiggle: [{ arm: 'N', j: 0, amp: 2.5, hz: 9 }, { arm: 'N', j: 1, amp: 3, hz: 9, ph: 0.3 }] },
        { dur: 0.5, ease: 'inOut', aim: { off: -12, elbow: 4, lean: 0 }, lean: -19, h: -0.07, head: 8, neck: 5, twist: -8,
          wiggle: [{ arm: 'N', j: 0, amp: 3.5, hz: 10 }, { arm: 'N', j: 1, amp: 4, hz: 10, ph: 0.3 }] },
      ] },
    shield: { channel: 'arms', args: { for: 2 }, doc: 'shield someone behind: front arm out, palm up to stop, back arm spread around them; trembling', hold: 'for', release: 0.4, mood: 'scared',
      keys: [
        { dur: 0.25, ease: 'back', armN: [84, 14, -55], armF: [-78, 10, 20], hands: ['open', 'open'], lean: -7, head: -4, twist: -8, h: -0.03 },
        { dur: 0.5, ease: 'inOut', armN: [80, 18, -60], armF: [-84, 12, 24], lean: -6,
          wiggle: [{ arm: 'N', j: 0, amp: 2, hz: 7 }, { arm: 'F', j: 0, amp: 2, hz: 7, ph: 0.4 }] },
      ] },
    laugh: { channel: 'arms', args: { for: 1.2 }, doc: 'laugh out loud: head back, a hand on the belly, shoulders bouncing', hold: 'for', release: 0.35, mood: 'excited',
      keys: [
        { dur: 0.2, ease: 'out', armN: [14, 104, 10], armF: [4, 90, 0], hands: ['open', 'relaxed'], lean: -9, head: -14, neck: -4 },
        { dur: 0.3, ease: 'inOut', lean: -7, head: -12, bob: [0.025, 4.2],
          wiggle: [{ arm: 'N', j: 0, amp: 4, hz: 4.2 }, { arm: 'F', j: 0, amp: 3, hz: 4.2, ph: 0.2 }] },
      ] },
    // ---- added for the early jump film: beat gestures. Each one is built on the 0.5 s beat of 120 BPM:
    // started on a beat, its strong poses fall on beats (the clap meets on every beat).
    clap: { channel: 'arms', args: { for: 2 }, doc: 'clap in profile on the beat (120 BPM): hands meet in front on every beat, open wide between; for= seconds', hold: 'for', release: 0.25, mood: 'happy',
      keys: [
        { dur: 0.25, ease: 'out', armN: [98, 28, 0], armF: [62, 28, 0], hands: ['open', 'open'], lean: -2, head: -4 },
        { dur: 0.25, ease: 'inOut', wiggle: [{ arm: 'N', j: 0, amp: 20, hz: 2, ph: 0.75 }, { arm: 'F', j: 0, amp: -20, hz: 2, ph: 0.75 },
          { arm: 'N', j: 1, amp: 10, hz: 2, ph: 0.75 }, { arm: 'F', j: 1, amp: 10, hz: 2, ph: 0.75 }] },
      ] },
    waveover: { channel: 'arms', args: { hand: 'near', for: 1 }, doc: 'wave someone over: a big arm over the head swinging back on every beat (hand=near|far|both)', hold: 'for', release: 0.3, mood: 'happy',
      keys: [
        { dur: 0.25, ease: 'back', armN: [148, 30, 0], armF: [-12, 28, 0], hands: ['open', 'relaxed'], lean: -4, head: -6 },
        { dur: 0.25, ease: 'inOut', wiggle: [{ arm: 'N', j: 0, amp: 26, hz: 1, ph: 0.25 }, { arm: 'N', j: 1, amp: 30, hz: 1, ph: 0.75 }, { arm: 'N', j: 2, amp: 20, hz: 1, ph: 0.75 }] },
      ] },
    psych: { channel: 'arms', args: {}, doc: 'psych up: clench both fists at the sides and nod hard on four beats (2 s)', release: 0.3, mood: 'determined',
      keys: [
        { dur: 0.25, ease: 'back', armN: [-30, 42, 10], armF: [-20, 52, 0], hands: ['fist', 'fist'], lean: 6, head: 2, twist: -3 },
        { dur: 0.25, ease: 'out', head: 18, neck: 4, lean: 7 },
        { dur: 0.25, ease: 'inOut', head: -2, neck: 0, lean: 4 },
        { dur: 0.25, ease: 'out', head: 18, neck: 4, lean: 7 },
        { dur: 0.25, ease: 'inOut', head: -2, neck: 0, lean: 4 },
        { dur: 0.25, ease: 'out', head: 18, neck: 4, lean: 7 },
        { dur: 0.25, ease: 'inOut', head: -2, neck: 0, lean: 4 },
        { dur: 0.25, ease: 'out', head: 16, neck: 4, lean: 7, armN: [-34, 46, 12], armF: [-24, 56, 0] },
      ] },
    // cheer on the beat: a new pose on every beat for 8 beats. alt = 0..3 starts the cycle at another
    // pose; alt = 4..7 uses poses for a small child (short arms that would vanish against a big head)
    cheerbeat: { channel: 'arms', args: { alt: 0 }, doc: 'cheer with a new pose on every beat for 8 beats (4 s); alt=0..3 starts at another pose, 4..7 = small-child poses', release: 0.4, mood: 'excited',
      keys: [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
        const P = [
          { armN: [158, 12, 0], armF: [128, 18, 0], hands: ['fist', 'fist'], lean: -9, head: -12, h: 0 },       // V for victory
          { armN: [176, 4, 0], armF: [18, 92, 0], hands: ['fist', 'fist'], lean: 5, head: -2, h: -0.1 },       // fist pump, knees bent
          { armN: [104, 4, 0], armF: [-62, 8, 0], hands: ['open', 'open'], lean: -12, head: -16, h: 0 },       // arms flung wide
          { armN: [178, 0, 0], armF: [168, 6, 0], hands: ['open', 'open'], lean: -5, head: -14, h: -0.04 },    // both arms straight up
          { armN: [102, 0, 0], armF: [80, 8, 0], hands: ['fist', 'fist'], lean: -8, head: -12, h: 0 },         // small: both fists punched forward
          { armN: [-42, 58, 0], armF: [-56, 48, 0], hands: ['fist', 'fist'], lean: 16, head: 6, h: -0.1 },     // small: fists back, shouting forward
          { armN: [96, 0, 0], armF: [-78, 8, 0], hands: ['open', 'open'], lean: -12, head: -16, h: 0 },        // small: arms flung wide
          { armN: [110, 0, 0], armF: [-100, 4, 0], hands: ['open', 'open'], lean: -6, head: -14, h: -0.04 },   // small: star
        ];
        const pick = f => a => { const k = Math.round(a.alt || 0); return P[(k >= 4 ? 4 : 0) + (i + k) % 4][f]; };
        return { dur: 0.5, ease: 'back', armN: pick('armN'), armF: pick('armF'), hands: pick('hands'), lean: pick('lean'), head: pick('head'), h: pick('h') };
      }) },
    drop: { channel: 'arms', args: { quiet: 0 }, doc: 'let go of the held prop (quiet=1: no gesture, it was handed over or thrown)', release: 0.4,
      keys: [{ dur: 0.18, ease: 'out', armN: [30, 20, 25], armF: [20, 25, 20], hands: ['open', 'open'], lean: -2 }, { dur: 0.15, ease: 'linear' }] },

    // ------------------------------------------------------------------ face and eyes (perform.js)
    face: { channel: 'face', args: { mood: 'neutral', strength: 1 }, doc: 'mood = happy|scared|determined|surprised|sad|neutral|excited|angry|tired|proud|shy; strength 0..2 (brows, lids, smile blend over 0.35 s)' },
    // ---- speech (docs/SPEECH.md) ----
    say: { channel: 'say', args: { text: '', for: 0, track: '', words: '', visemes: '', beats: 0 }, doc: 'speak a line: say("text", for=seconds); track="lines/x.json" (Rhubarb or [{t,v}]), words="0:Good 0.3:morning", beats=1 for hand beats' },
    look: { channel: 'look', args: { at: 'front' }, doc: 'look at a place or name, or up|down|front|back' },
    nod: { channel: 'look', args: {}, doc: 'nod twice' },
    // ---- the mood layer (docs/ACTIONS.md): colours every motion until the next mood line ----
    mood: { channel: 'mood', args: { name: 'neutral', strength: 1 }, doc: 'mood = neutral|happy|sad|angry|scared|tired|proud|shy (strength 0..2): posture, head, arms, step tempo, arm swing, idle, face' },
  };

  // mood -> swap names (skins may lack a name; the renderer falls back to the neutral one)
  const moods = {
    neutral: { mouth: 'neutral', eye: 'open', brow: 'neutral' },
    happy: { mouth: 'smile', eye: 'open', brow: 'up' },
    excited: { mouth: 'open', eye: 'happy', brow: 'up' },
    scared: { mouth: 'worried', eye: 'wide', brow: 'worried' },
    surprised: { mouth: 'o', eye: 'wide', brow: 'up' },
    determined: { mouth: 'neutral', eye: 'narrow', brow: 'down' },   // skins without 'narrow' fall back to 'open'
    sad: { mouth: 'sad', eye: 'sad', brow: 'worried' },
    angry: { mouth: 'grit', eye: 'open', brow: 'down' },
    tired: { mouth: 'neutral', eye: 'narrow', brow: 'worried' },
    proud: { mouth: 'smile', eye: 'narrow', brow: 'neutral' },
    shy: { mouth: 'smile', eye: 'open', brow: 'worried' },
  };

  // how a mood changes the body (radians, leg lengths; cadence, stride, swing, bounce, tempo are
  // relative changes: -0.2 = 20% less, tempo + = slower actions; fist > 0.5 clenches relaxed hands)
  const moodMotion = {
    neutral: {},
    happy: { lean: -0.03, head: -0.06, chest: 0.02, cadence: 0.06, stride: 0.05, swing: 0.25, bounce: 0.35, tempo: -0.08 },
    sad: { lean: 0.1, bend: 0.24, neck: 0.1, head: 0.1, chest: -0.03, drop: -0.02, shoulder: -0.06, elbow: -0.15, cadence: -0.22, stride: -0.18, swing: -0.65, bounce: -0.5, tempo: 0.3 },
    angry: { lean: 0.14, bend: 0.06, neck: 0.18, head: -0.06, chest: 0.02, drop: -0.01, shoulder: 0.05, elbow: 0.5, cadence: 0.12, stride: 0.05, swing: 0.35, bounce: 0.1, tempo: -0.12, fist: 1 },
    scared: { lean: 0.06, bend: 0.2, neck: -0.12, head: 0.05, twist: 0.1, chest: -0.04, drop: -0.05, shoulder: 0.35, elbow: 1.1, cadence: 0.15, stride: -0.25, swing: -0.6, bounce: -0.4, tempo: -0.1 },
    tired: { lean: 0.08, bend: 0.22, neck: 0.22, head: 0.18, chest: -0.02, drop: -0.025, shoulder: -0.04, elbow: -0.1, cadence: -0.28, stride: -0.15, swing: -0.5, bounce: -0.55, tempo: 0.35 },
    proud: { lean: -0.08, bend: -0.18, neck: -0.12, head: -0.15, chest: 0.05, shoulder: -0.05, elbow: 0.05, cadence: -0.05, stride: 0.12, swing: 0.15, bounce: -0.1, tempo: 0.05 },
    shy: { lean: 0.05, bend: 0.12, neck: 0.22, head: 0.3, twist: -0.12, chest: -0.02, drop: -0.01, shoulder: 0.12, elbow: 0.9, cadence: -0.1, stride: -0.3, swing: -0.7, bounce: -0.4, tempo: 0.15 },
  };

  // face parameters per mood: brow height and angle (-1 angry .. +1 worried), upper lid (1 open, 0.5 half, 1.2 wide), smile (-1 .. 1)
  const faceParams = {
    neutral: {}, happy: { browH: 0.3, lid: 0.92, smile: 0.8 }, excited: { browH: 0.6, lid: 1.05, smile: 1 }, scared: { browH: 0.7, browA: 0.8, lid: 1.2, smile: -0.3 },
    surprised: { browH: 1, browA: 0.2, lid: 1.25 }, determined: { browH: -0.4, browA: -0.6, lid: 0.8 }, sad: { browH: 0.1, browA: 0.9, lid: 0.75, smile: -0.6 },
    angry: { browH: -0.5, browA: -1, lid: 0.85, smile: -0.4 }, tired: { browH: -0.2, browA: 0.3, lid: 0.55, smile: -0.1 }, proud: { browH: 0.1, browA: -0.2, lid: 0.8, smile: 0.5 },
    shy: { browH: 0.2, browA: 0.6, lid: 0.8, smile: 0.3 },
  };

  return { actions, moods, STAND, moodMotion, faceParams };
});

}).call(G);

// ---- src/clips.js ----
(function (module, exports, require) {
// clips.js - CharClips: motion as data. Each clip is a set of pose keys on a time line that the
// performer (perform.js) plays with spline interpolation. UMD: window.CharClips / module.exports.
//
// ===================== FORMAT (read this to add or tune a clip) =====================
// name: {
//   dur,            seconds (the time of the last key if left out)
//   keys: [ { t, ...fields }, ... ]   a field only has to appear on the keys where it changes;
//                   each field is its own spline (Catmull-Rom through the keys that set it).
//                   A field no key sets stays at the standing pose. flat: true on a key makes every
//                   field set there arrive and leave with zero speed (an extreme or a hit pose).
//   lag: { head, armN, armF, lean, ... }   per-field delay in seconds: the field plays that much
//                   later than the body (overlap: head and arms trail the hips)
//   contacts: { near: [[t0, t1], ...], far: [...] }   foot-contact marks: inside a mark the foot is
//                   planted (lift 0, no slide; it rolls on heel or toe when its angle changes). A
//                   mark that starts at 0 plants the foot where it already was.
//   loop: [a, b]    the part that repeats (times=n in the script); [0, dur] = loops forever (idle)
//   flight: [f0, f1], height, flightPerL   airborne part of a jump: the root flies a parabola of
//                   `height` leg lengths (times the script's height) and the flight time grows by
//                   flightPerL per leg length jumped; root x in flight is stretched to the target.
//   flip            time at which the actor faces the other way (turn)
//   blendIn         seconds of cross-fade from whatever the actor was doing (default 0.15)
//   life            0..1 idle wobble left on top while/after the clip plays (default 0)
// }
// Body fields (as in poses.js keys): x = root motion (pelvis forward, leg lengths); h = pelvis
// height above the ankles (0.975 standing); lean, tilt, twist, neck, head (degrees); bend = spine
// curve (degrees, + = chest curls forward); chest = torso stretch (1 = rest, 1.1 = tall and thin,
// 0.88 = short and wide; area is kept); near, far = feet [x from the PELVIS, lift, angle (+ toes up)];
// armN, armF = [shoulder, elbow, wrist]; squash [sx, sy]; stretch (limbs, <= 1.12); hands
// ['main', 'other'] or one name; mouth (a swap name, null = back to the mood).
// Arm clips (channel 'arms') use armN/armF/hands plus lean, head, twist, neck, h added to the body.
// =====================================================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CharClips = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const ST = { h: 0.975, lean: -2, tilt: 3, twist: 5, neck: -2, head: 3, bend: 0, chest: 1, armN: [7, 16, 10], armF: [-9, 24, 4] };
  const stand = (t, extra) => Object.assign({ t }, ST, extra || {});

  return {
    // standing with life: weight drifts from foot to foot, a glance up, breathing in the chest
    idle: { dur: 4.8, loop: [0, 4.8], blendIn: 0.45, life: 0.25,
      lag: { head: 0.25, neck: 0.2, armN: 0.3, armF: 0.4 },
      contacts: { near: [[0, 4.8]], far: [[0, 4.8]] },
      keys: [
        stand(0, { x: 0, near: [0.12, 0, 0], far: [-0.08, 0, 0] }),
        { t: 1.2, x: 0.035, h: 0.966, lean: -1, tilt: 6, twist: 3, head: 6, neck: 0, bend: 2, chest: 1.01, armN: [4, 20, 12], armF: [-6, 22, 4] },
        { t: 2.4, x: 0.045, h: 0.972, head: -3, neck: -5, chest: 1.025, armN: [10, 14, 8] },
        { t: 3.6, x: 0.0, h: 0.962, lean: -3, tilt: 0, twist: 7, head: 4, neck: -1, bend: -2, chest: 0.99, armF: [-13, 28, 4] },
        stand(4.8, { x: 0 }),
      ] },

    // on the toes: rise, then bob (heels up, knees giving), arms float with lag; times = bobs
    bounce: { dur: 1.3, loop: [0.36, 0.76], blendIn: 0.12,
      lag: { head: 0.06, neck: 0.05, armN: 0.08, armF: 0.11 },
      contacts: { near: [[0, 1.3]], far: [[0, 1.3]] },
      keys: [
        stand(0, { x: 0, near: [0.12, 0, 0], far: [-0.08, 0, 0] }),
        { t: 0.18, flat: true, h: 0.9, lean: 9, bend: 7, chest: 0.93, head: 2, armN: [-22, 30, 0], armF: [-30, 34, 0], near: [0.12, 0, 0], far: [-0.08, 0, 0] },
        { t: 0.36, h: 1.0, lean: -3, bend: -3, chest: 1.07, head: -4, armN: [34, 40, 0], armF: [22, 46, 0], hands: 'open', near: [0.12, 0, -30], far: [-0.08, 0, -30] },
        { t: 0.5, h: 1.01, chest: 1.05, armN: [44, 52, 0], armF: [34, 56, 0], near: [0.12, 0, -36], far: [-0.08, 0, -36] },
        { t: 0.62, flat: true, h: 0.925, lean: 6, bend: 5, chest: 0.93, head: 3, armN: [8, 38, 0], armF: [-4, 44, 0], near: [0.12, 0, -20], far: [-0.08, 0, -20] },
        { t: 0.76, h: 1.0, lean: -3, bend: -3, chest: 1.07, head: -4, armN: [34, 40, 0], armF: [22, 46, 0], near: [0.12, 0, -30], far: [-0.08, 0, -30] },
        { t: 0.98, flat: true, h: 0.94, lean: 4, bend: 3, chest: 0.96, head: 2, armN: [12, 22, 8], armF: [-4, 26, 4], near: [0.12, 0, 0], far: [-0.08, 0, 0], hands: 'relaxed' },
        stand(1.3, { near: [0.12, 0, 0], far: [-0.08, 0, 0] }),
      ] },

    // the first beat of a run: sink and lean in, arms cock back, push. The gait cross-fades in after.
    runStart: { dur: 0.24, blendIn: 0.08,
      lag: { head: 0.05, armN: 0.04, armF: 0.05 },
      contacts: { near: [[0, 0.24]], far: [[0, 0.24]] },
      keys: [
        stand(0, { x: 0 }),
        { t: 0.12, x: -0.025, h: 0.9, lean: 5, bend: 7, chest: 0.94, head: -4, armN: [-34, 44, 0], armF: [26, 52, 0], hands: 'fist', mouth: 'grit' },
        { t: 0.24, x: 0.05, h: 0.93, lean: 17, bend: 4, chest: 1.02, head: -8, armN: [-46, 72, 0], armF: [44, 72, 0] },
      ] },

    // crouch (anticipation), stretch on the push, tuck in the air, squash on landing, rebound, settle
    jump: { dur: 1.52, flight: [0.4, 0.84], height: 0.52, flightPerL: 0.05, blendIn: 0.1,
      lag: { head: 0.04, neck: 0.03, armN: 0.05, armF: 0.075 },
      contacts: { near: [[0, 0.4], [0.84, 1.52]], far: [[0, 0.4], [0.84, 1.52]] },
      keys: [
        stand(0, { x: 0, near: [0.12, 0, 0], far: [-0.08, 0, 0] }),
        { t: 0.12, h: 0.93, lean: 7, bend: 3, armN: [22, 30, 0], armF: [12, 34, 0] },
        { t: 0.3, flat: true, x: -0.03, h: 0.68, lean: 32, bend: 14, chest: 0.87, neck: -10, head: -14, armN: [-62, 30, 0], armF: [-52, 36, 0], hands: 'open', near: [0.2, 0, 0], far: [0.0, 0, 0], mouth: 'grit', squash: [1.03, 0.97] },
        { t: 0.4, x: 0.08, h: 1.03, lean: 12, bend: -6, chest: 1.13, neck: -4, head: -6, armN: [126, 14, 10], armF: [106, 24, 10], near: [-0.08, 0, -42], far: [-0.2, 0, -42], mouth: 'open', stretch: 1.08, squash: [0.96, 1.05] },
        { t: 0.52, h: 0.98, lean: 6, chest: 1.06, armN: [122, 28, 10], armF: [102, 38, 10], near: [0.0, 0.14, -20], far: [-0.15, 0.12, -24], stretch: 1, squash: [1, 1] },
        { t: 0.64, flat: true, h: 0.86, lean: 8, bend: 10, chest: 0.97, armN: [100, 52, 10], armF: [82, 62, 10], near: [0.2, 0.42, -10], far: [0.05, 0.36, -16] },
        { t: 0.84, x: 1.0, h: 0.95, lean: 10, bend: 4, chest: 1.04, head: -6, armN: [82, 30, 0], armF: [62, 34, 0], near: [0.2, 0, 8], far: [0.02, 0, 4] },
        { t: 0.96, flat: true, x: 1.04, h: 0.62, lean: 30, bend: 16, chest: 0.84, neck: -10, head: -14, armN: [56, 45, 0], armF: [40, 50, 0], near: [0.2, 0, 0], far: [0.02, 0, 0], mouth: 'grit', squash: [1.06, 0.94] },
        { t: 1.2, x: 1.1, h: 0.99, lean: -4, bend: -4, chest: 1.05, neck: 0, head: 2, armN: [20, 26, 6], armF: [0, 30, 4], mouth: null, squash: [1, 1], hands: 'relaxed' },
        stand(1.52, { x: 1.09 }),
      ] },

    // stop from a run: brace (heel digs in, lean back), slide, stop, overshoot forward, step, settle
    skid: { dur: 1.35, blendIn: 0.14, fling: 1,
      lag: { head: 0.06, neck: 0.05, armN: 0.07, armF: 0.1 },
      contacts: { near: [[0.55, 1.35]], far: [[0.55, 0.86], [1.06, 1.35]] },
      keys: [
        { t: 0, x: 0, h: 0.9, lean: 14, bend: 4, near: [0.25, 0.05, 0], far: [-0.3, 0.1, 0], armN: [40, 80, 0], armF: [-40, 80, 0], hands: 'fist' },
        { t: 0.1, x: 0.38, h: 0.82, lean: -18, bend: -10, chest: 0.92, head: 6, near: [0.5, 0, 24], far: [-0.15, 0, -10], armN: [70, 40, 0], armF: [50, 50, 0], hands: 'open', mouth: 'o' },
        { t: 0.35, x: 0.95, h: 0.78, lean: -24, bend: -12, chest: 0.9, head: 8, near: [0.5, 0, 26], far: [-0.12, 0, -8], armN: [96, 30, 0], armF: [80, 36, 0] },
        { t: 0.55, flat: true, x: 1.12, h: 0.84, lean: -8, bend: -4, near: [0.42, 0, 0], far: [-0.1, 0, 0], armN: [62, 30, 0], armF: [50, 34, 0] },
        { t: 0.76, x: 1.24, h: 0.9, lean: 19, bend: 13, chest: 1.04, neck: -6, head: -10, armN: [74, 62, 0], armF: [58, 68, 0], mouth: 'open' },
        { t: 0.96, x: 1.29, far: [-0.18, 0.12, 0] },
        { t: 1.06, flat: true, x: 1.3, h: 0.96, lean: -5, bend: -4, chest: 0.99, neck: 0, head: 2, far: [-0.1, 0, 0], armN: [10, 24, 8], armF: [-6, 28, 4], hands: 'relaxed', mouth: null },
        stand(1.35, { x: 1.3 }),
      ] },

    // turn round with a little hop: dip, spring up with the feet drawn in under her (she faces the
    // other way at the top, never thinner than 85%), land on both feet re-planted, squash, settle
    // The far foot stays planted and she pivots on it (flipAbout); the near foot hops round.
    turn: { dur: 0.48, flip: 0.17, flipAbout: 'far', blendIn: 0.05,
      lag: { head: 0.03, armN: 0.04, armF: 0.06 },
      contacts: { near: [[0, 0.07], [0.27, 0.48]], far: [[0, 0.48]] },
      keys: [
        stand(0, { x: 0, squash: [1, 1], near: [0.12, 0, 0], far: [-0.08, 0, 0] }),
        { t: 0.07, flat: true, x: -0.025, h: 0.9, lean: 8, bend: 6, chest: 0.93, armN: [-10, 40, 0], armF: [-16, 44, 0], squash: [1.04, 0.96], near: [0.14, 0, 0], far: [-0.055, 0, 0] },
        { t: 0.17, x: -0.07, h: 0.96, lean: 0, bend: 0, chest: 1.05, armN: [24, 70, 0], armF: [18, 74, 0], squash: [0.86, 1.05], near: [-0.01, 0.1, -12], far: [-0.01, 0, 0] },
        { t: 0.27, x: -0.03, h: 0.93, lean: 3, chest: 0.95, near: [0.19, 0, 0], far: [-0.05, 0, 0], squash: [1.05, 0.95] },
        { t: 0.34, flat: true, h: 0.91, lean: 6, bend: 5, chest: 0.92, armN: [-6, 34, 6], armF: [-14, 36, 4], squash: [1.06, 0.94] },
        stand(0.48, { squash: [1, 1] }),
      ] },

    // one stride of the run (phase 0 = near foot lands, 0.5 = far foot lands), laid over the gait,
    // which plants the feet. h, lean, head, neck are ADDED to the gait; bend, chest and the arms
    // replace it (arm swing grows with speed). contact, down, passing, up, (flight), contact.
    runCycle: { dur: 1, loop: [0, 1],
      keys: [
        { t: 0, h: 0, lean: 0, head: 2, neck: 0, bend: 3, chest: 1.0, armN: [-52, 96, 0], armF: [58, 88, -10] },
        { t: 0.1, h: -0.05, lean: 3, head: 6, neck: 2, bend: 8, chest: 0.93, armN: [-40, 100, 0], armF: [46, 92, -8] },
        { t: 0.25, h: 0, lean: 1, head: 2, neck: 0, bend: 4, chest: 1.0, armN: [4, 82, 0], armF: [4, 84, 0] },
        { t: 0.38, h: 0.04, lean: -1, head: -2, neck: -1, bend: 1, chest: 1.05, armN: [44, 86, -8], armF: [-40, 96, 0] },
        { t: 0.5, h: 0, lean: 0, head: 2, neck: 0, bend: 3, chest: 1.0, armN: [58, 88, -10], armF: [-52, 96, 0] },
        { t: 0.6, h: -0.05, lean: 3, head: 6, neck: 2, bend: 8, chest: 0.93, armN: [46, 92, -8], armF: [-40, 100, 0] },
        { t: 0.75, h: 0, lean: 1, head: 2, neck: 0, bend: 4, chest: 1.0, armN: [4, 84, 0], armF: [4, 82, 0] },
        { t: 0.88, h: 0.04, lean: -1, head: -2, neck: -1, bend: 1, chest: 1.05, armN: [-40, 96, 0], armF: [44, 86, -8] },
        { t: 1, h: 0, lean: 0, head: 2, neck: 0, bend: 3, chest: 1.0, armN: [-52, 96, 0], armF: [58, 88, -10] },
      ] },

    // ------------------------------------------------------------------ arm clips
    // one hand: dip, swing up past the pose, waggle at the elbow and wrist, the body leans away
    wave: { dur: 1.34, blendIn: 0.1, lag: { armF: 0.08, head: 0.1, lean: 0.06 },
      keys: [
        { t: 0, armN: [7, 16, 10], armF: [-9, 24, 4], lean: 0, head: 0, twist: 0 },
        { t: 0.1, armN: [-12, 40, 0] },
        { t: 0.32, armN: [120, 48, -12], armF: [-12, 28, 0], hands: ['open', 'relaxed'], lean: -4, head: -6, twist: 6 },
        { t: 0.42, flat: true, armN: [104, 62, -6] },
        { t: 0.6, armN: [107, 38, -22] }, { t: 0.78, armN: [101, 76, 12] },
        { t: 0.96, armN: [107, 38, -22] }, { t: 1.14, armN: [101, 76, 12] },
        { t: 1.34, armN: [104, 60, 0] },
      ] },
    // both hands, laughing: dip, fling both arms up, wave them across each other out of step, bob
    waveBoth: { dur: 1.5, blendIn: 0.1, lag: { armF: 0.07, head: 0.08 },
      keys: [
        { t: 0, armN: [7, 16, 10], armF: [-9, 24, 4], h: 0, lean: 0, head: 0 },
        { t: 0.1, armN: [-16, 40, 0], armF: [-22, 40, 0], h: -0.03, lean: 4, head: 3 },
        { t: 0.34, armN: [152, 28, -10], armF: [142, 34, -10], hands: ['open', 'open'], h: 0.025, lean: -9, head: -12 },
        { t: 0.46, flat: true, armN: [138, 40, 0], armF: [130, 44, 0], h: 0 },
        { t: 0.64, armN: [152, 18, -26], armF: [118, 52, 16], h: -0.02, lean: -6, head: -8 },
        { t: 0.82, armN: [124, 52, 16], armF: [148, 22, -26], h: 0.02, lean: -9, head: -12 },
        { t: 1.0, armN: [152, 18, -26], armF: [118, 52, 16], h: -0.02, lean: -6, head: -8 },
        { t: 1.18, armN: [124, 52, 16], armF: [148, 22, -26], h: 0.02, lean: -9, head: -12 },
        { t: 1.5, armN: [136, 40, 0], armF: [128, 44, 0], h: 0, lean: -5, head: -6 },
      ] },
  };
});

}).call(G);

// ---- src/speech.js ----
(function (module, exports, require) {
// speech.js - CharSpeech: mouth shapes (visemes) over time from a track, word timings or plain text.
// UMD: window.CharSpeech in the browser, module.exports in Node. Pure functions, no state.
//
//   VISEMES                       rest mbp ah ee oh oo fv l wq
//   SHAPE[v]                      { open, wide, round, teeth, tongue } 0..1, for drawn-from-numbers mouths
//   cues(args, dur, tracks)       -> [{ t, v, k, stress, emph }] (k = strength 0..1.3), times from 0
//   at(cues, tau)                 -> { a, b, u, open, wide, round, teeth, tongue, stress, emph } blended
//   fromText(text, dur)           English spelling rules (or an open-close fallback for other scripts)
//   fromTrack(data, dur)          Rhubarb mouth-cue JSON or a list of { t, v }
//   fromWords(words, text, dur)   "0:Good 0.3:morning ..." word start times
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CharSpeech = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VISEMES = ['rest', 'mbp', 'ah', 'ee', 'oh', 'oo', 'fv', 'l', 'wq'];
  const SHAPE = {
    rest: { open: 0, wide: 1, round: 0, teeth: 0, tongue: 0 },
    mbp: { open: 0, wide: 0.92, round: 0, teeth: 0, tongue: 0 },
    ah: { open: 1, wide: 1, round: 0, teeth: 0.2, tongue: 0.3 },
    ee: { open: 0.35, wide: 1.25, round: 0, teeth: 1, tongue: 0 },
    oh: { open: 0.75, wide: 0.75, round: 0.6, teeth: 0, tongue: 0.2 },
    oo: { open: 0.32, wide: 0.5, round: 1, teeth: 0, tongue: 0 },
    fv: { open: 0.15, wide: 0.95, round: 0, teeth: 1, tongue: 0 },
    l: { open: 0.6, wide: 0.95, round: 0, teeth: 0.5, tongue: 1 },
    wq: { open: 0.3, wide: 0.55, round: 0.9, teeth: 0, tongue: 0 },
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const FUNC = new Set('a an the of to and or in on at by for with is it its i you he she we they me my your his her our their be am are was were do does did not no so but as if this that there then than from up out'.split(' '));
  const PREFIX = /^(a|be|de|re|un|in|en|ex|pre|pro|con|com)(?=[a-z]{3,})/;

  // one word -> [{ v, d (relative length), syl (vowel group index or -1) }]
  function wordUnits(w) {
    const out = [], s = w.toLowerCase().replace(/[^a-z']/g, '');
    let i = 0, syl = -1, inV = false;
    const V = 'aeiouy';
    const push = (v, d, vowel) => { if (vowel && !inV) syl++; inV = vowel; out.push({ v, d, syl: vowel ? syl : -1 }); };
    while (i < s.length) {
      const c = s[i], two = s.slice(i, i + 2), three = s.slice(i, i + 3);
      if (c === "'") { i++; continue; }
      if (three === 'igh') { push('ah', 1.4, true); push('ee', 0.8, true); i += 3; continue; }
      const DI = { th: ['l', 1], sh: ['wq', 1.1], ch: ['wq', 1.1], ph: ['fv', 1], wh: ['wq', 1], ck: ['ee', 0.6], ng: ['ee', 0.7], qu: ['wq', 1],
        oo: ['oo', 1.8, 1], ou: ['oh', 1.2, 1], ow: ['oh', 1.2, 1], ee: ['ee', 1.8, 1], ea: ['ee', 1.7, 1], ie: ['ee', 1.6, 1], ey: ['ee', 1.4, 1],
        ai: ['ah', 1.6, 1], ay: ['ah', 1.6, 1], ei: ['ah', 1.4, 1], oa: ['oh', 1.8, 1], oe: ['oh', 1.6, 1], au: ['oh', 1.6, 1], aw: ['oh', 1.6, 1], oi: ['oh', 1.4, 1], oy: ['oh', 1.4, 1] };
      if (DI[two]) {
        const [v, d, vow] = DI[two];
        push(v, d, !!vow);
        if (two === 'ou' || two === 'ow') push('wq', 0.6, true);
        if (two === 'oi' || two === 'oy' || two === 'ai' || two === 'ay') push('ee', 0.6, true);
        i += 2; continue;
      }
      if (c === 'e' && i === s.length - 1 && s.length > 3 && !V.includes(s[i - 1])) { i++; continue; }   // silent final e
      if ('mbp'.includes(c)) push('mbp', 1.1, false);
      else if ('fv'.includes(c)) push('fv', 1, false);
      else if (c === 'w') push('wq', 1, false);
      else if (c === 'r') push('wq', 0.7, false);
      else if (c === 'l') push('l', 0.9, false);
      else if (c === 'a') push('ah', 1.6, true);
      else if (c === 'e') push('ee', 1.3, true);
      else if (c === 'i') push('ee', 1.2, true);
      else if (c === 'o') push('oh', 1.6, true);
      else if (c === 'u') push('ah', 1.2, true);
      else if (c === 'y') push(i === 0 ? 'ee' : 'ee', i === 0 ? 0.7 : 1.2, i > 0);
      else push('ee', 0.6, false);   // t d n s z k g c h x j: a slightly open mouth, teeth showing
      i++;
    }
    return { units: out, syllables: syl + 1, word: s };
  }
  function stressedSyllable(word, n) {
    if (n <= 1) return FUNC.has(word) ? -1 : 0;
    return PREFIX.test(word) ? 1 : 0;
  }
  // English text -> cues over dur seconds (or an open-close fallback for text that is not Latin script)
  function fromText(text, dur) {
    text = String(text || '');
    const letters = (text.match(/[a-z]/gi) || []).length, other = (text.replace(/[\s\p{P}\d]/gu, '').length) || 1;
    const items = [];   // { v, d, stress, emph } with d in relative units; rests for pauses
    if (letters / other < 0.5) {
      // open-close fallback: each character (or vowel-ish run) is a syllable
      const chars = [...text];
      chars.forEach((ch, i) => {
        if (/[\s]/.test(ch)) { items.push({ v: 'rest', d: 0.6 }); return; }
        if (/[\p{P}]/u.test(ch)) { items.push({ v: 'rest', d: /[,，、]/.test(ch) ? 2.5 : 4 }); return; }
        const h = hash(i + 1.7);
        items.push({ v: h < 0.5 ? 'ah' : h < 0.75 ? 'oh' : 'ee', d: 1.6, k: 0.7 + 0.4 * hash(i * 3.3), stress: i % 3 === 0 }, { v: h < 0.3 ? 'mbp' : 'rest', d: 0.7 });
      });
    } else {
      const toks = text.match(/[A-Za-z']+|[.,!?;:—-]+/g) || [];
      const sentEnds = new Set();
      toks.forEach((tk, i) => { if (/[!]/.test(tk)) for (let j = i - 1; j >= 0 && /[A-Za-z]/.test(toks[j]); j--) { if (!FUNC.has(toks[j].toLowerCase())) { sentEnds.add(j); break; } } });
      toks.forEach((tk, i) => {
        if (!/[A-Za-z]/.test(tk)) { items.push({ v: 'rest', d: /[,;:—-]/.test(tk) ? 2.6 : 4.5 }); return; }
        const W = wordUnits(tk), ss = stressedSyllable(W.word, W.syllables);
        const emph = sentEnds.has(i) || (tk.length > 1 && tk === tk.toUpperCase());
        for (const u of W.units) {
          const st = u.syl >= 0 && u.syl === ss;
          items.push({ v: u.v, d: u.d * (st ? 1.35 : 1), k: st ? 1.15 : (u.syl >= 0 ? 0.85 : 0.75), stress: st && u.syl >= 0, emph: st && emph });
        }
        items.push({ v: 'rest', d: 0.25, gap: true });
      });
    }
    while (items.length && items[items.length - 1].v === 'rest') items.pop();
    const total = items.reduce((s, q) => s + q.d, 0) || 1;
    const speak = Math.max(0.1, dur - 0.12);   // the mouth comes to rest a little before the end
    const out = [];
    let t = 0;
    for (const q of items) { out.push({ t, v: q.v, k: q.k === undefined ? 1 : q.k, stress: !!q.stress, emph: !!q.emph }); t += q.d / total * speak; }
    out.push({ t: speak, v: 'rest', k: 1 });
    return merge(out);
  }
  // join neighbours with the same shape; a word gap between two consonants is dropped
  function merge(cs) {
    const out = [];
    for (const c of cs) { const p = out[out.length - 1]; if (p && p.v === c.v && !c.stress) continue; out.push(c); }
    return out;
  }
  const RHUBARB = { A: 'mbp', B: 'ee', C: 'ah', D: 'ah', E: 'oh', F: 'oo', G: 'fv', H: 'l', X: 'rest' };
  function fromTrack(data, dur) {
    let list = [];
    if (data && Array.isArray(data.mouthCues)) list = data.mouthCues.map(c => ({ t: +c.start, v: RHUBARB[c.value] || 'rest', k: c.value === 'C' ? 0.75 : 1 }));
    else if (Array.isArray(data)) list = data.map(c => ({ t: +c.t, v: VISEMES.includes(String(c.v).toLowerCase()) ? String(c.v).toLowerCase() : (RHUBARB[c.v] || 'rest'), k: 1 }));
    list = list.filter(c => isFinite(c.t)).sort((a, b) => a.t - b.t);
    // stress: the start of each open stretch after a closed or rest one
    list.forEach((c, i) => { c.stress = (c.v === 'ah' || c.v === 'oh') && (i === 0 || ['rest', 'mbp'].includes(list[i - 1].v)); });
    if (!list.length || list[list.length - 1].v !== 'rest') list.push({ t: list.length ? list[list.length - 1].t + 0.15 : 0, v: 'rest', k: 1 });
    return list;
  }
  // words: "0:Good 0.3:morning 0.85:little" (start times; the text of each word is spoken in its slot)
  function fromWords(words, text, dur) {
    const ws = String(words || '').trim().split(/\s+/).map(s => { const m = s.match(/^([\d.]+):(.+)$/); return m ? { t: +m[1], w: m[2] } : null; }).filter(Boolean);
    if (!ws.length) return fromText(text, dur);
    const out = [];
    ws.forEach((w, i) => {
      const end = i + 1 < ws.length ? ws[i + 1].t : Math.min(dur, w.t + 0.45 + 0.08 * w.w.length);
      const part = fromText(w.w, Math.max(0.12, end - w.t) + 0.12).slice(0, -1);
      for (const c of part) out.push(Object.assign({}, c, { t: w.t + c.t }));
      if (i + 1 < ws.length && ws[i + 1].t - end > 0.05) out.push({ t: end, v: 'rest', k: 1 });
    });
    out.push({ t: Math.min(dur, out.length ? out[out.length - 1].t + 0.15 : 0), v: 'rest', k: 1 });
    return out.sort((a, b) => a.t - b.t);
  }
  function cues(args, dur, tracks) {
    if (args.visemes) {   // a fixed parade of shapes, for looking at a skin's mouths
      const vs = String(args.visemes).split(/[\s,]+/).filter(v => VISEMES.includes(v));
      return vs.map((v, i) => ({ t: i * dur / vs.length, v, k: 1 })).concat([{ t: dur, v: 'rest', k: 1 }]);
    }
    if (args.track && tracks && tracks[args.track]) return fromTrack(tracks[args.track], dur);
    if (args.words) return fromWords(args.words, args.text, dur);
    return fromText(args.text, dur);
  }
  // estimated speaking time for a text: about 4.5 syllables a second plus pauses
  function estimate(text) {
    const s = String(text || '');
    const syl = (s.toLowerCase().match(/[aeiouy]+/g) || []).length || Math.ceil([...s.replace(/\s/g, '')].length / 1.2);
    const pauses = (s.match(/[,;:]/g) || []).length * 0.2 + (s.match(/[.!?]/g) || []).length * 0.3;
    return Math.max(0.5, syl / 4.5 + pauses + 0.2);
  }
  // the mouth at time tau: shape params blended across cue boundaries (coarticulation, 70 ms)
  function at(cs, tau) {
    const R = Object.assign({ a: 'rest', b: 'rest', u: 0, stress: 0, emph: 0 }, SHAPE.rest);
    if (!cs || !cs.length || tau < 0) return R;
    let i = 0;
    while (i + 1 < cs.length && cs[i + 1].t <= tau) i++;
    const c = cs[i], n = cs[i + 1];
    const X = 0.07;
    let u = 0;
    if (n) u = smooth((tau - (n.t - X / 2)) / X);
    const A = SHAPE[c.v] || SHAPE.rest, B = n ? (SHAPE[n.v] || SHAPE.rest) : A, ka = c.k || 1, kb = n ? (n.k || 1) : ka;
    // closed shapes (mbp) must reach closure: do not blend them open early
    if (c.v === 'mbp') u = n ? smooth((tau - n.t + 0.01) / 0.05) : 0;
    const out = { a: c.v, b: n ? n.v : c.v, u };
    for (const f of Object.keys(A)) out[f] = (A[f] * (f === 'open' ? ka : 1)) * (1 - u) + (B[f] * (f === 'open' ? kb : 1)) * u;
    // stress and emphasis pulses (for head bobs and brow lifts): 0..1, peaking 60 ms into a stressed cue
    let st = 0, em = 0;
    for (let j = Math.max(0, i - 2); j <= i; j++) {
      const d = tau - cs[j].t;
      if (d >= 0 && d < 0.35) { const p = Math.sin(Math.PI * d / 0.35); if (cs[j].stress) st = Math.max(st, p); if (cs[j].emph) em = Math.max(em, p); }
    }
    out.stress = st; out.emph = em;
    return out;
  }
  return { VISEMES, SHAPE, cues, at, fromText, fromTrack, fromWords, estimate, wordUnits };
});

}).call(G);

// ---- src/perform.js ----
(function (module, exports, require) {
// perform.js - CharPerform: turns a list of named actions into a pure function of time
// (STAGE.md sections 2 and 3). UMD: window.CharPerform in the browser, module.exports in Node.
//
//   CharPerform.actions                     vocabulary (from poses.js): {name: {channel, args, moves, doc}}
//   CharPerform.compile(skin, events, env)  -> performer; never throws, problems go to diagnostics
//   performer.sample(t)                     -> { x, y, facing, pose, swaps, held, scale, height, offstage }
//   performer.end(i)                        -> time when events[i]'s motion finishes
//   performer.diagnostics                   -> [{ code, t, line, message, severity }]
//   CharPerform.draw(skin, sample)          -> SVG markup, origin at the actor's feet (sample.x, sample.y)
//
// Motion: clips.js (keys on a time line, played with splines, cross-faded), the procedural gait, and
// a spring simulation (chains, arm/head/torso overlap) stepped at 1/60 s from t = 0 with cached
// snapshots, so sample(t) is the same in any order. env.wind(t) feeds the chains.
// Stage space is px with y down. Rig space (poses) is head heights with y up; 1 head = sample.scale px.
// Internally every body action works in its own frame: x = 0 where it started, +x = facing.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rig.js'), require('./gait.js'), require('./poses.js'), require('./clips.js'), require('./speech.js'));
  else root.CharPerform = factory(root.CharRig, root.CharGait, root.CharPoses, root.CharClips, root.CharSpeech);
})(typeof self !== 'undefined' ? self : this, function (CharRig, CharGait, CharPoses, CharClips, CharSpeech) {
  CharClips = CharClips || {};
  'use strict';
  const D2R = Math.PI / 180, TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const EASE = {
    linear: u => clamp(u, 0, 1),
    inOut: smooth,
    in: u => { u = clamp(u, 0, 1); return u * u * u; },
    out: u => { u = clamp(u, 0, 1); return 1 - Math.pow(1 - u, 3); },
    // overshoots ~12% and settles (used for fast moves)
    back: u => { u = clamp(u, 0, 1); const c = 1.9, v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; },
  };
  const ease = (name, u) => (EASE[name] || EASE.inOut)(u);
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const wrapA = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
  const ACTIONS = CharPoses.actions, MOODS = CharPoses.moods;
  const SIDES = ['near', 'far'];
  const LOOK_WORDS = { up: 1, down: 1, front: 1, back: 1, left: 1, right: 1 };

  // action files register on the global CharActions (actions/<name>.js; docs/ACTIONS.md). A file with
  // the name of a built-in action replaces it.
  const globalActs = () => { const g = typeof globalThis !== 'undefined' ? globalThis : {}; return g.CharActions || {}; };
  const userSpecs = new Map();
  // a paired action file (docs/PAIRS.md) holds one role per actor: { pair: true, gap, a: {keys}, b: {keys} }.
  // The stage turns 'A: hug(with=B)' into the events 'hug.a' for A and 'hug.b' for B; 'hug' alone plays role a.
  const PAIR_ARGS = { with: '', apart: 1, size: 1, push: 1, speed: 1, for: 0 };
  const roleCache = new Map();
  function roleOf(name) {
    const m = String(name).match(/^(\w+)(?:\.(a|b))?$/), p = m && globalActs()[m[1]];
    if (!p || !p.pair || typeof p !== 'object') return null;
    const r = p[m[2] || 'a'];
    if (!r || !Array.isArray(r.keys)) return null;
    if (!roleCache.has(r)) roleCache.set(r, Object.assign({}, r, { name: m[1] + '.' + (m[2] || 'a'), doc: p.doc, args: Object.assign({}, PAIR_ARGS, p.args || {}, r.args || {}) }));
    return roleCache.get(r);
  }
  function specOf(name) {
    const u = roleOf(name) || globalActs()[name];
    if (u && typeof u === 'object' && Array.isArray(u.keys)) {
      if (!userSpecs.has(u)) {
        if (!u.name) u.name = name;
        userSpecs.set(u, { channel: u.channel === 'arms' ? 'arms' : 'body', args: Object.assign({}, u.args || {}), moves: !!u.travel, doc: u.doc || 'an action file',
          user: u, mood: u.face, hold: u.hold || 0, release: u.release === undefined ? 0.35 : u.release });
      }
      return userSpecs.get(u);
    }
    return ACTIONS[name];
  }
  // public vocabulary: channel, args (null = required), moves, doc
  function vocab() {
    const v = {};
    for (const n of Object.keys(ACTIONS)) { const a = ACTIONS[n]; v[n] = { channel: a.channel, args: Object.assign({}, a.args), moves: !!a.moves, doc: a.doc }; }
    for (const n of Object.keys(globalActs())) { const s = specOf(n); if (s && s.user) v[n] = { channel: s.channel, args: Object.assign({}, s.args), moves: s.moves, doc: s.doc }; }
    return v;
  }

  function isSkin(s) { return !!(s && (s.parts || s.swaps || s.chains || s.build)); }

  function compile(skin, events, env) {
    const diagnostics = [];
    const D = (code, t, line, message, severity) => diagnostics.push({ code, t: isFinite(t) ? t : null, line: line === undefined ? null : line, message, severity: severity || 'error' });
    try { return build(skin, events, env, D, diagnostics); } catch (err) {
      // last-resort safety: a broken script must not take the page down
      D('internal', null, null, 'performer failed: ' + (err && err.message) + '. The actor stands still.');
      return build(skin, [], env, () => {}, diagnostics);
    }
  }

  function build(skin, events, env, D, diagnostics) {
    env = env || {};
    skin = skin && typeof skin === 'object' ? skin : {};
    const ch = CharRig.skinCharacter(skin);
    // motion: { weight 0..1, energy 0..1, age: baby|child|adult|elder, posture -1..1 } (docs/RIG.md).
    // The defaults (0.3, 0.5, adult, 0) change nothing, so older skins move as before.
    const MO = Object.assign({ weight: 0.3, energy: 0.5, age: 'adult', posture: undefined }, skin.motion || {});
    MO.weight = clamp(+MO.weight || 0, 0, 1); MO.energy = clamp(MO.energy === undefined ? 0.5 : +MO.energy, 0, 1);
    if (MO.posture === undefined) MO.posture = MO.age === 'elder' ? 0.5 : 0;
    MO.posture = clamp(+MO.posture || 0, -1, 1);
    const AGE = { baby: 1, child: 2, adult: 3, elder: 4 }[MO.age] || 3;
    // time stretch for clips: heavy, old and tired bodies move slower
    const TS = (1 + 0.4 * (MO.weight - 0.3)) * (AGE === 4 ? 1.25 : AGE === 1 ? 0.9 : 1) * (1 - 0.2 * (MO.energy - 0.5));
    const pr = ch.proportions, L = pr.thigh + pr.shin, A = pr.ankleHeight, H = CharRig.heightOf(ch);
    let scale = Number(env.scale);
    if (!(scale > 0)) scale = 1;
    const k = scale > 8 ? scale : 220 / H * scale;            // px per head unit
    const gpts = CharRig.footGeometry(ch).ground;
    const minRotY = a => { let m = Infinity; const c = Math.cos(a), s = Math.sin(a); for (const q of gpts) m = Math.min(m, q[0] * s + q[1] * c); return m; };
    const B = { ch, pr, L, A, k, H, kneeR: pr.radius.knee };
    const width = Number(env.width) > 0 ? Number(env.width) : 1280;
    const groundAt = x => {
      let v = 0;
      try { v = typeof env.ground === 'function' ? +env.ground(x) : +env.ground; } catch (e) { v = 0; }
      return isFinite(v) ? v : 0;
    };
    function resolvePlace(v, t) {
      try {
        if (typeof v === 'number' && isFinite(v)) return [v, groundAt(v)];
        if (typeof v === 'string' && v.trim() !== '' && isFinite(+v)) return [+v, groundAt(+v)];
        if (Array.isArray(v) && isFinite(+v[0])) return [+v[0], isFinite(+v[1]) ? +v[1] : groundAt(+v[0])];
        if (v && typeof v === 'object' && isFinite(+v.x)) return [+v.x, isFinite(+v.y) ? +v.y : groundAt(+v.x)];
        if (typeof v === 'string' && env.anchors && env.anchors[v] !== undefined) {
          let a = env.anchors[v];
          if (typeof a === 'function') a = a(t);
          if (a === v) return null;
          return resolvePlace(a, t);
        }
      } catch (e) { /* fall through */ }
      return null;
    }

    // ---------------------------------------------------------------- body state helpers
    function baseS() {
      return { rx: 0, ry: A + 0.975 * L, lean: 0, tilt: 0, twist: 0, neck: 0, head: 0,
        feet: { near: { x: 0.1 * L, y: -minRotY(0), a: 0 }, far: { x: -0.1 * L, y: -minRotY(0), a: 0 } },
        arms: { near: [0, 0.2, 0], far: [0, 0.2, 0] }, hands: { near: 'relaxed', far: 'relaxed' },
        squash: [1, 1], stretch: 1, mouth: null, bend: 0, chest: 1 };
    }
    function cloneS(S) {
      return { rx: S.rx, ry: S.ry, lean: S.lean, tilt: S.tilt, twist: S.twist, neck: S.neck, head: S.head,
        feet: { near: Object.assign({}, S.feet.near), far: Object.assign({}, S.feet.far) },
        arms: { near: S.arms.near.slice(), far: S.arms.far.slice() }, hands: Object.assign({}, S.hands),
        squash: S.squash.slice(), stretch: S.stretch, mouth: S.mouth, bend: S.bend || 0, chest: S.chest || 1, faceTurn: S.faceTurn || 0 };
    }
    const footY = (lift, a) => lift - minRotY(a);
    function kneel(S, side, f) {
      const kx = S.rx + (f.knee || 0) * L, kr = B.kneeR, dx = kx - S.rx;
      S.ry = kr + Math.sqrt(Math.max(0.01, pr.thigh * pr.thigh - dx * dx));
      const s = (f.shin === undefined ? 26 : f.shin) * D2R;
      const ax = kx - pr.shin * Math.cos(s), ay = kr + pr.shin * Math.sin(s);
      // tuck the toes: find the foot angle where the toe just touches the ground
      let lo = -1.5, hi = -0.15;
      for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (ay + minRotY(m) < 0) lo = m; else hi = m; }
      S.feet[side] = { x: ax, y: ay, a: hi };
    }
    // apply one key (data from poses.js) on top of the previous state
    function resolveKey(key, prev, args, map) {
      const S = cloneS(prev);
      const v = f => typeof f === 'function' ? f(args || {}, B) : f;
      map = map || { N: 'near', F: 'far' };
      S.mouth = key.mouth !== undefined ? key.mouth : (prev.mouth && key.keepMouth ? prev.mouth : null);
      if (key.x != null) S.rx = v(key.x) * L;
      if (key.h != null) S.ry = A + v(key.h) * L;
      for (const f of ['lean', 'tilt', 'twist', 'neck', 'head', 'bend']) if (key[f] != null) S[f] = v(key[f]) * D2R;
      if (key.chest != null) S.chest = v(key.chest);
      for (const side of SIDES) {
        const f = v(key[side]);
        if (Array.isArray(f)) { const a = (f[2] || 0) * D2R; S.feet[side] = { x: f[0] * L, y: footY((f[1] || 0) * L, a), a }; }
      }
      for (const side of SIDES) { const f = v(key[side]); if (f && f.knee !== undefined) kneel(S, side, f); }
      const aN = v(key.armN), aF = v(key.armF);
      if (aN) S.arms[map.N] = aN.map(d => v(d) * D2R);
      if (aF && map.F) S.arms[map.F] = aF.map(d => v(d) * D2R);
      const hs = v(key.hands);
      if (typeof hs === 'string') { S.hands.near = hs; S.hands.far = hs; }
      else if (Array.isArray(hs)) { S.hands[map.N] = hs[0]; if (map.F) S.hands[map.F] = hs[1]; }
      if (key.squash) S.squash = v(key.squash).slice();
      if (key.stretch) S.stretch = v(key.stretch);
      return S;
    }
    // transition S0 -> S1. Upper body uses the key's ease (may overshoot); root x and feet never
    // overshoot. A foot that must move along the ground steps (lifts on an arc) instead of sliding.
    function trans(S0, S1, u, name) {
      const eu = ease(name, u), es = smooth(u);
      const S = cloneS(S1);
      S.rx = lerp(S0.rx, S1.rx, es);
      S.ry = lerp(S0.ry, S1.ry, eu);
      for (const f of ['lean', 'tilt', 'twist', 'neck', 'head', 'bend']) S[f] = lerp(S0[f] || 0, S1[f] || 0, eu);
      S.chest = lerp(S0.chest || 1, S1.chest || 1, eu);
      for (const side of SIDES) for (let j = 0; j < 3; j++) S.arms[side][j] = lerp(S0.arms[side][j], S1.arms[side][j], eu);
      const mv = SIDES.map(s => Math.abs(S1.feet[s].x - S0.feet[s].x));
      const steps = SIDES.map((s, i) => mv[i] > 0.03);
      const first = mv[0] >= mv[1] ? 0 : 1;
      SIDES.forEach((side, i) => {
        const f0 = S0.feet[side], f1 = S1.feet[side];
        if (!steps[i]) {
          const a = lerp(f0.a, f1.a, es);
          let x = lerp(f0.x, f1.x, es);
          // a planted foot that changes angle rolls on its toe or heel, so that point stays put
          if (f0.y < 0.05 * L && f1.y < 0.05 * L) {
            const pv = a < 0 ? pr.toe : pr.heel, rx = (p, q) => p[0] * Math.cos(q) - p[1] * Math.sin(q);
            x = lerp(f0.x + rx(pv, f0.a), f1.x + rx(pv, f1.a), es) - rx(pv, a);
          }
          S.feet[side] = { x, y: lerp(f0.y, f1.y, es), a };
          return;
        }
        const both = steps[0] && steps[1];
        const w0 = !both ? 0 : (i === first ? 0 : 0.38), w1 = !both ? 1 : (i === first ? 0.62 : 1);
        const uf = smooth((u - w0) / (w1 - w0));
        const grounded = f0.y < 0.25 * L && f1.y < 0.25 * L;
        const arc = grounded ? Math.min(0.12 * L, 0.25 * mv[i] + 0.04 * L) * Math.sin(Math.PI * uf) : 0;
        const ux = smooth((uf - 0.12) / 0.72);          // lift before travelling, stop before landing
        S.feet[side] = { x: lerp(f0.x, f1.x, ux), y: lerp(f0.y, f1.y, uf) + arc, a: lerp(f0.a, f1.a, uf) - 0.25 * Math.sin(Math.PI * uf) * (grounded ? 1 : 0) };
      });
      S.hands = u < 0.4 ? Object.assign({}, S0.hands) : Object.assign({}, S1.hands);
      S.squash = [lerp(S0.squash[0], S1.squash[0], eu), lerp(S0.squash[1], S1.squash[1], eu)];
      S.stretch = Math.max(S0.stretch, S1.stretch) > 1 ? lerp(S0.stretch, S1.stretch, es) : 1;
      S.mouth = S1.mouth;
      return S;
    }
    // move a state into a new frame whose origin is its own root
    function rebase(st) {
      const S = cloneS(st.S), dx = S.rx;
      S.rx = 0; for (const s of SIDES) S.feet[s].x -= dx;
      return { S, x: st.x, facing: st.facing };
    }
    const stageX = (ox, facing, rx) => ox + facing * k * rx;
    function mkState(S, ox, facing, extra) {
      const x = stageX(ox, facing, S.rx);
      return Object.assign({ S, x, y: groundAt(x), facing, life: 0, loop: null }, extra || {});
    }

    // ---------------------------------------------------------------- events
    const evs = [];
    const moodHints = [], blinkAt = [];
    const actionNames = Object.keys(vocab());
    const near = (w, names) => {
      let best = null, bd = 99;
      for (const n of names) { const d = lev(String(w), n); if (d < bd) { bd = d; best = n; } }
      return best && bd <= 2 ? ` Did you mean '${best}'?` : '';
    };
    (Array.isArray(events) ? events : []).forEach((e, i) => {
      if (!e || typeof e !== 'object') { D('bad-event', null, null, `event ${i} is not an object {t, action, args}.`); return; }
      const line = e.line, t = Number(e.t);
      if (!isFinite(t)) { D('bad-time', null, line, `time '${e.t}' is not a number of seconds.`); return; }
      const name = e.action || e.name;
      const spec = specOf(name);
      if (!spec) { D('unknown-action', t, line, `unknown action '${name}'.${near(name, actionNames)} Valid: ${actionNames.join(', ')}.`); return; }
      const args = {}, given = e.args && typeof e.args === 'object' ? e.args : {};
      const keys = Object.keys(spec.args);
      let ok = true;
      for (const g of Object.keys(given)) if (!(g in spec.args) && g !== '_pos') D('unknown-arg', t, line, `${name} has no argument '${g}'.${near(g, keys)} Valid: ${keys.join(', ') || '(none)'}.`, 'warning');
      for (const a of keys) {
        const def = spec.args[a];
        let val = given[a];
        if (val === undefined || val === null || val === '') {
          if (def === null) { D('missing-arg', t, line, `${name} needs ${a}=..., for example ${name}(${a}=${a === 'prop' ? 'lantern' : 400}).`); ok = false; }
          else args[a] = def;
          continue;
        }
        if (typeof def === 'number' && typeof val !== 'number') {
          if (isFinite(+val)) val = +val;
          else { D('bad-arg', t, line, `${name}: ${a} must be a number, got '${val}'. Using ${def}.`, 'warning'); val = def; }
        }
        args[a] = val;
      }
      if (!ok) return;
      // enumerations and places
      const enumOf = { name: Object.keys(CharPoses.moodMotion || {}), mood: Object.keys(MOODS), how: ['up', 'front', 'side'], hand: ['near', 'far', 'both'], from: ['left', 'right'], end: ['stop', 'skid'] };
      for (const a of Object.keys(enumOf)) if (a in args && enumOf[a].indexOf(args[a]) < 0) {
        // a misspelt mood or face name is an error: the film would show the wrong feeling (or none)
        if (a === 'mood' || (a === 'name' && name === 'mood')) {
          let best = null, bd = 99;
          for (const n of enumOf[a]) { const d = lev(String(args[a]), n); if (d < bd) { bd = d; best = n; } }
          D('bad-arg', t, line, `${name}: '${args[a]}' is not a ${name === 'mood' ? 'mood' : 'face'} name. Nearest valid name is '${best}', so write ${name}(${best}). Valid: ${enumOf[a].join(', ')}.`);
        } else D('bad-arg', t, line, `${name}: ${a}=${args[a]} is not valid. Use one of: ${enumOf[a].join(', ')}.`, 'warning');
        args[a] = spec.args[a] !== null ? spec.args[a] : enumOf[a][0];
      }
      for (const a of ['to', 'at']) if (a in args) {
        if (name === 'look' && LOOK_WORDS[args[a]]) continue;
        if (!resolvePlace(args[a], t)) {
          const an = env.anchors ? Object.keys(env.anchors) : [];
          D('unknown-place', t, line, `${name}: ${a}=${args[a]} is not a number, [x, y] or an anchor.${near(args[a], an)} Anchors: ${an.join(', ') || '(none)'}.`);
          ok = false;
        }
      }
      if (!ok) return;
      evs.push({ i, t, name, spec, args, line, channel: spec.channel });
    });
    evs.sort((a, b) => a.t - b.t || a.i - b.i);
    const endOf = {};

    // ---------------------------------------------------------------- body track
    const STAND = CharPoses.STAND;
    const segs = [];
    const segAt = t => { let s = null; for (const g of segs) { if (g.t0 <= t) s = g; else break; } return s; };
    const bodyAt = t => segAt(t).at(t);
    const x0 = (() => { const p = resolvePlace(env.x !== undefined ? env.x : env.at, 0); return p ? p[0] : width / 2; })();
    const facing0 = env.facing === -1 || env.facing === 'left' ? -1 : 1;
    const bodyEvs = evs.filter(e => e.channel === 'body');
    const offX = from => from === 'right' ? width + 0.28 * H * k : -0.28 * H * k;
    {
      const first = bodyEvs[0];
      const startX = first && first.name === 'enter' ? offX(first.args.from) : x0;
      const S = resolveKey(STAND, baseS(), {});
      S.rx = 0;
      segs.push({ t0: -Infinity, end: -Infinity, at: t => mkState(S, startX, first && first.name === 'enter' ? (first.args.from === 'right' ? -1 : 1) : facing0, { life: 1, offstage: !!(first && first.name === 'enter') }) });
    }

    function keyedSeg(t0, entry, keys, args, opts) {
      opts = opts || {};
      const E = rebase(entry), ks = [];
      let prev = E.S, tt = t0;
      for (const key of keys) {
        const S = resolveKey(key, prev, args);
        ks.push({ t0: tt, dur: Math.max(0.01, key.dur || 0.3), ease: key.ease || 'inOut', from: prev, S });
        tt += Math.max(0.01, key.dur || 0.3); prev = S;
      }
      const end = tt;
      return { t0, end, at(t) {
        let S, life = 0;
        if (t >= end) { S = cloneS(prev); life = smooth((t - end) / 0.6); }
        else { let kk = ks[0]; for (const q of ks) if (q.t0 <= t) kk = q; S = trans(kk.from, kk.S, (t - kk.t0) / kk.dur, kk.ease); }
        return mkState(S, E.x, E.facing, { life, loop: opts.loop || null, loopT0: end });
      } };
    }
    // ---------------------------------------------------------------- clips (motion as data, clips.js)
    // A clip is pose keys on a time line. Every field is its own spline (Hermite with Catmull-Rom
    // tangents, flat at keys marked flat), fields may lag the body (overlap), feet are pinned inside
    // their contact marks, x is root motion. A clip segment cross-fades from the segment before it.
    const NUMF = ['x', 'h', 'lean', 'tilt', 'twist', 'neck', 'head', 'bend', 'chest', 'stretch', 'squash', 'near', 'far', 'armN', 'armF', 'turn'];
    const STF = { x: 0, h: STAND.h, lean: STAND.lean, tilt: STAND.tilt, twist: STAND.twist, neck: STAND.neck, head: STAND.head, bend: 0, chest: 1, stretch: 1,
      squash: [1, 1], near: STAND.near, far: STAND.far, armN: STAND.armN, armF: STAND.armF };
    const prepCache = new Map();
    function prepClip(name) {
      const c = typeof name === 'string' ? CharClips[name] : name;
      if (!c || !Array.isArray(c.keys) || !c.keys.length) return null;
      if (prepCache.has(c)) return prepCache.get(c);
      const keys = c.keys.slice().sort((a, b) => a.t - b.t);
      const dur = c.dur || keys[keys.length - 1].t || 0.01;
      const cyc = !!(c.loop && c.loop[0] <= 0 && c.loop[1] >= dur - 1e-6);
      const chs = {};
      for (const f of NUMF) {
        const T = [], V = [], F = [];
        for (const q of keys) {
          const v = q[f];
          if (v === undefined || v === null || typeof v === 'string') continue;
          T.push(q.t); F.push(!!q.flat);
          V.push(Array.isArray(v) ? (f === 'squash' ? [0, 1] : [0, 1, 2]).map(j => +v[j] || 0) : +v);
        }
        if (T.length) chs[f] = { T, V, F };
      }
      const disc = f => keys.filter(q => q[f] !== undefined).map(q => [q.t, q[f]]);
      const P = { c, dur, cyc, ch: chs, hands: disc('hands'), mouth: disc('mouth'), lag: c.lag || {}, contacts: c.contacts || {} };
      prepCache.set(c, P);
      return P;
    }
    function splComp(C, t, cyc, dur, j) {
      const T = C.T, n = T.length, val = i => j < 0 ? C.V[i] : C.V[i][j];
      if (n === 1) return val(0);
      if (cyc) t = ((t % dur) + dur) % dur;
      if (t <= T[0]) return val(0);
      if (t >= T[n - 1]) return val(n - 1);
      let i = 0;
      while (i < n - 2 && T[i + 1] <= t) i++;
      const tan = q => {
        if (C.F[q]) return 0;
        let tp, vp, tn, vn;
        if (q > 0) { tp = T[q - 1]; vp = val(q - 1); } else if (cyc) { tp = T[n - 2] - dur; vp = val(n - 2); } else return (val(1) - val(0)) / Math.max(1e-6, T[1] - T[0]);
        if (q < n - 1) { tn = T[q + 1]; vn = val(q + 1); } else if (cyc) { tn = T[1] + dur; vn = val(1); } else return 0;
        const d0 = Math.max(1e-6, T[q] - tp), d1 = Math.max(1e-6, tn - T[q]);
        return ((val(q) - vp) / d0 * d1 + (vn - val(q)) / d1 * d0) / (d0 + d1);
      };
      const h = Math.max(1e-6, T[i + 1] - T[i]), u = clamp((t - T[i]) / h, 0, 1), u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * val(i) + (u3 - 2 * u2 + u) * h * tan(i) + (3 * u2 - 2 * u3) * val(i + 1) + (u3 - u2) * h * tan(i + 1);
    }
    function spl(P, f, t) {
      const C = P.ch[f];
      if (!C) { const d = STF[f]; return Array.isArray(d) ? d.slice() : d; }
      t -= P.lag[f] || 0;
      const v0 = C.V[0];
      return Array.isArray(v0) ? v0.map((_, j) => splComp(C, t, P.cyc, P.dur, j)) : splComp(C, t, P.cyc, P.dur, -1);
    }
    const discAt = (list, t, def) => { let v = def; for (const q of list) if (q[0] <= t + 1e-9) v = q[1]; return v; };
    const rotX = (p, a) => p[0] * Math.cos(a) - p[1] * Math.sin(a);
    function blendS(A0, B0, w) {
      const S = cloneS(B0);
      S.rx = lerp(A0.rx, B0.rx, w); S.ry = lerp(A0.ry, B0.ry, w);
      for (const f of ['lean', 'tilt', 'twist', 'neck', 'head', 'bend']) S[f] = lerp(A0[f] || 0, B0[f] || 0, w);
      S.chest = lerp(A0.chest || 1, B0.chest || 1, w); S.stretch = lerp(A0.stretch || 1, B0.stretch || 1, w); S.faceTurn = lerp(A0.faceTurn || 0, B0.faceTurn || 0, w);
      S.squash = [lerp(A0.squash[0], B0.squash[0], w), lerp(A0.squash[1], B0.squash[1], w)];
      for (const s of SIDES) {
        for (let j = 0; j < 3; j++) S.arms[s][j] = lerp(A0.arms[s][j], B0.arms[s][j], w);
        const a = A0.feet[s], b = B0.feet[s];
        S.feet[s] = { x: lerp(a.x, b.x, w), y: lerp(a.y, b.y, w), a: lerp(a.a, b.a, w) };
      }
      if (w < 0.5) { S.hands = Object.assign({}, A0.hands); S.mouth = A0.mouth; }
      return S;
    }
    // one segment that plays clip P from state `entry` at t0, cross-fading from segment `prev`.
    // opts: times (loop repeats), dist (leg lengths to jump), hm (jump height factor)
    const UPSTAND = { lean: STAND.lean * D2R, bend: 0, twist: STAND.twist * D2R, head: STAND.head * D2R, neck: STAND.neck * D2R };
    function clipSeg(t0, entry, prev, P, opts) {
      opts = opts || {};
      const c = P.c, E = rebase(entry);
      const ts = opts.ts || 1, blendIn = (c.blendIn === undefined ? 0.15 : c.blendIn) * ts;
      const lp = !P.cyc && c.loop ? c.loop : null;
      const extra = lp ? Math.max(0, Math.round(opts.times || 1) - 1) * (lp[1] - lp[0]) : 0;
      const fl = c.flight || null;
      const xs = opts.xs || 1, rawX = tc => spl(P, 'x', tc) * xs;
      let tf = 0, Hj = 0, Df = 0;
      if (fl) {
        const hm = clamp(opts.hm || 1, 0.3, 3), Dl = opts.dist === undefined ? rawX(P.dur) - rawX(0) : opts.dist;
        tf = ((fl[1] - fl[0]) + (c.flightPerL || 0) * Dl) * Math.sqrt(hm);
        Hj = (c.height || 0.5) * L * hm;
        Df = Math.max(0, Dl - (rawX(fl[0]) - rawX(0) + rawX(P.dur) - rawX(fl[1])));
      }
      const ftime = fl ? tf - (fl[1] - fl[0]) : 0;
      const total = (P.dur + extra + ftime) * ts;
      const clipT = tau0 => {
        if (P.cyc) return tau0 / ts;
        const tau = tau0 / ts;
        let q = tau;
        if (lp && q > lp[1]) q = q < lp[1] + extra ? lp[0] + ((q - lp[1]) % (lp[1] - lp[0])) : q - extra;
        if (fl && q > fl[0]) q = q < fl[0] + tf ? fl[0] + (q - fl[0]) * (fl[1] - fl[0]) / tf : q - ftime;
        return clamp(q, 0, P.dur);
      };
      const rootX = tc => {
        if (!fl || tc <= fl[0]) return rawX(tc);
        if (tc < fl[1]) return rawX(fl[0]) + Df * (tc - fl[0]) / (fl[1] - fl[0]);
        return rawX(tc) - rawX(fl[1]) + rawX(fl[0]) + Df;
      };
      const footRaw = (side, tc) => { const r = spl(P, side, tc); return { x: (rootX(tc) + r[0]) * L, lift: r[1] * L, a: r[2] * D2R }; };
      const pins = {};
      function pin(side, j) {
        const key = side + j;
        if (pins[key]) return pins[key];
        const iv = P.contacts[side][j];
        let x0, a0;
        if (iv[0] <= 1e-9) { x0 = E.S.feet[side].x; a0 = E.S.feet[side].a; } else { const f = footRaw(side, iv[0]); x0 = f.x; a0 = f.a; }
        // the pivot the foot stands on now stays put; the other one is placed where it lands when flat
        let heelW = x0 + rotX(pr.heel, a0), toeW = x0 + rotX(pr.toe, a0), lift0 = iv[0] <= 1e-9 ? 0 : footRaw(side, iv[0]).lift;
        if (a0 < 0) heelW = toeW - pr.toe[0] + pr.heel[0]; else toeW = heelW - pr.heel[0] + pr.toe[0];
        const at = a => a < 0 ? toeW - rotX(pr.toe, a) : heelW - rotX(pr.heel, a);
        const fe = footRaw(side, iv[1]);
        return (pins[key] = { at, off: at(fe.a) - fe.x, lift: lift0 });
      }
      function footAt(side, tc, air) {
        const f = footRaw(side, tc), ivs = P.contacts[side] || [];
        for (let j = 0; j < ivs.length; j++) if (tc >= ivs[j][0] - 1e-9 && tc <= ivs[j][1] + 1e-9) { const pj = pin(side, j); return { x: pj.at(f.a), y: footY(pj.lift || 0, f.a), a: f.a }; }
        let x = f.x, lift = f.lift;
        for (let j = 0; j < ivs.length; j++) {
          const d = tc - ivs[j][1], e = ivs[j][0] - tc;
          if (d > 0 && d < 0.15) { x += pin(side, j).off * (1 - smooth(d / 0.15)); lift *= smooth(d / 0.1); }   // lift off smoothly
          if (e > 0 && e < 0.1) lift *= smooth(e / 0.1);                                                    // and touch down
        }
        return { x, y: footY(lift, f.a) + air, a: f.a };
      }
      function poseAt(tc) {
        const S = cloneS(E.S);
        let air = 0, airborne = false;
        if (fl && tc > fl[0] && tc < fl[1]) { const u = (tc - fl[0]) / (fl[1] - fl[0]); air = Hj * 4 * u * (1 - u); airborne = true; }
        S.rx = rootX(tc) * L;
        S.ry = A + spl(P, 'h', tc) * L + air;
        S.faceTurn = P.ch.turn ? spl(P, 'turn', tc) : 0;
        for (const f of ['lean', 'tilt', 'twist', 'neck', 'head', 'bend']) S[f] = spl(P, f, tc) * D2R;
        S.chest = spl(P, 'chest', tc); S.stretch = clamp(spl(P, 'stretch', tc), 1, 1.12); S.squash = spl(P, 'squash', tc);
        S.arms.near = spl(P, 'armN', tc).map(d => d * D2R); S.arms.far = spl(P, 'armF', tc).map(d => d * D2R);
        for (const side of SIDES) S.feet[side] = footAt(side, tc, air);
        const hs = discAt(P.hands, tc, null);
        S.hands = typeof hs === 'string' ? { near: hs, far: hs } : Array.isArray(hs) ? { near: hs[0], far: hs[1] } : Object.assign({}, E.S.hands);
        S.mouth = discAt(P.mouth, tc, null);
        return { S, airborne };
      }
      const yA = groundAt(E.x), yB = fl ? groundAt(E.x + E.facing * rootX(P.dur) * L * k) : yA;
      const lifeAmt = c.life || 0;
      const inW = (w, x) => !!w && w.some(q => x >= q[0] && x <= q[1]);
      let flipX = null;
      return { t0, end: t0 + (P.cyc ? blendIn : total), clip: P, at(t) {
        const tau = t - t0, tc = clipT(Math.max(0, tau));
        let { S, airborne } = poseAt(tc);
        if (opts.upper) {
          const U = cloneS(E.S);
          for (const f of ['lean', 'bend', 'twist', 'head', 'neck']) U[f] = (E.S[f] || 0) + (S[f] || 0) - (UPSTAND[f] || 0);
          U.arms = { near: S.arms.near.slice(), far: S.arms.far.slice() }; U.hands = Object.assign({}, S.hands);
          U.mouth = S.mouth; U.faceTurn = S.faceTurn; U.chest = S.chest;
          S = U; airborne = false;
        }
        if (tau < blendIn) {
          let src = null;
          if (prev) {
            const ps = prev.at(t);
            if (ps.facing === E.facing) { const d = (ps.x - E.x) * E.facing / k - ps.S.rx; src = cloneS(ps.S); src.rx += d; for (const s of SIDES) src.feet[s].x += d; }
          }
          S = blendS(src || E.S, S, smooth(Math.max(0, tau) / blendIn));
        }
        const flipped = c.flip !== undefined && tc >= c.flip;
        // turning round mirrors the body about the planted foot (flipAbout: 'near' | 'far') or the root
        if (flipped && flipX === null) flipX = c.flipAbout === 'near' || c.flipAbout === 'far' ? footAt(c.flipAbout, c.flip, 0).x : rootX(c.flip) * L;
        const life = P.cyc ? lifeAmt : tau > total ? smooth((tau - total) / 0.6) : lifeAmt * smooth(tau / 0.5);
        const st = mkState(S, flipped ? E.x + 2 * E.facing * k * flipX : E.x, flipped ? -E.facing : E.facing, { life, fling: c.fling && tau < total + 0.5 ? c.fling : 1, kind: c === CharClips.idle ? 'idle' : 'clip',
          aim: c.aim ? { near: inW(c.aim.near, tc), far: inW(c.aim.far, tc) } : null, reach: reachKeys(c, tc) });
        if (fl) st.y = airborne ? lerp(yA, yB, (tc - fl[0]) / (fl[1] - fl[0])) : (tc <= fl[0] ? yA : yB);
        st.airborne = airborne;
        return st;
      } };
    }
    // hand-target keys near clip time tc: { side, spec, w } (w = 1 within 0.1 s of the key, 0 beyond 0.35 s)
    function reachKeys(c, tc) {
      let out = null;
      const ks = c.keys || [];
      for (let i = 0; i < ks.length; i++) for (const sd of SIDES) {
        const q = ks[i], spec = q['_tg' + sd];
        if (!spec) continue;
        const d = Math.abs(tc - q.t);
        // a hand on a partner stays there until the next key that does not name the same place
        const nx = spec.who !== undefined && tc >= q.t ? ks.slice(i + 1).find(k2 => k2['_tg' + sd] || k2[sd === 'near' ? 'armN' : 'armF']) : null;
        if (nx && nx['_tg' + sd] && nx['_tg' + sd].at === spec.at && tc <= nx.t) (out = out || []).push({ side: sd, spec, w: 1 });
        else if (d < 0.35) (out = out || []).push({ side: sd, spec, w: 1 - smooth((d - 0.1) / 0.25) });
      }
      return out;
    }
    function clipLoopT(P, tau, times) {
      if (P.c.loop && !P.cyc && times > 1) { const a = P.c.loop[0], b = P.c.loop[1], ex = (Math.round(times) - 1) * (b - a); if (tau > b) tau = tau < b + ex ? a + ((tau - b) % (b - a)) : tau - ex; }
      return tau;
    }
    function clipArmVals(P, tau, times) {
      tau = clipLoopT(P, tau, times);
      const tc = clamp(tau, 0, P.dur), has = f => !!P.ch[f], hs = discAt(P.hands, tc, null);
      const ang = f => has(f) ? spl(P, f, tc) * D2R : 0;
      return { N: has('armN') ? spl(P, 'armN', tc).map(d => d * D2R) : null, F: has('armF') ? spl(P, 'armF', tc).map(d => d * D2R) : null,
        hands: hs ? (typeof hs === 'string' ? [hs, hs] : hs) : null,
        add: { lean: ang('lean'), head: ang('head'), twist: ang('twist'), neck: ang('neck'), bend: ang('bend'), turn: has('turn') ? spl(P, 'turn', tc) : 0, h: has('h') ? spl(P, 'h', tc) * L : 0 },
        stretch: has('stretch') ? spl(P, 'stretch', tc) : 1, wig: [], bob: null };
    }
    // ---------------------------------------------------------------- action files (docs/ACTIONS.md)
    // An action file is key poses in body terms. Here it becomes a clip for THIS body: hand targets
    // named by landmarks are solved by IK on this body's proportions at each key, then the clip
    // plays as usual (splines, overlap lag, contacts, cross-fade, weight and mood tempo).
    function applyPosture(S) { if (MO.posture) { const q = MO.posture; S.lean += 0.2 * q; S.bend = (S.bend || 0) + 0.28 * q; S.neck += 0.3 * q; S.head -= 0.35 * q; S.ry -= 0.03 * L * Math.max(0, q); } }
    const rotv = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
    const handR = Math.max(0.05, (ch.body ? pr.hand : 0.23) * 0.35);
    const LANDMARKS = ['top', 'forehead', 'eye', 'mouth', 'chin', 'ear', 'backhead', 'neck', 'chest', 'belly', 'hip', 'back', 'seat', 'knee', 'ground', 'front', 'up', 'out', 'down', 'wall', 'wallHigh', 'wallLow', 'face', 'shoulder', 'waist', 'side', 'torso'];
    // where a partner's landmark is expected before the stage puts the hand on the real one (docs/PAIRS.md):
    // the partner stands 'apart' head heights ahead, facing this body, 'size' times as tall
    const PGUESS = { front: [-0.08, 0.3], knee: [-0.05, 0.27], around: [0, 0.7], side: [0, 0.6], head: [0, 0.93], top: [0, 0.98], face: [-0.06, 0.88], shoulder: [0, 0.8], chest: [-0.07, 0.7], belly: [-0.08, 0.55], back: [0.07, 0.68], waist: [0.06, 0.55], hip: [0, 0.5], hand: [-0.5, 0.48], arm: [-0.3, 0.62] };
    function partnerGuess(S, spec) {
      const g = PGUESS[spec.at.slice(8)] || PGUESS.chest, Hp = (spec.size || 1) * H, d = (spec.apart || 1);
      const x = spec.at === 'partner.hand' || spec.at === 'partner.arm' ? d * (1 + g[0]) : d + g[0] * Hp;
      if (spec.at === 'partner.hand') return [x - S.rx, Math.min(H, Hp) * 0.8 - 0.4];   // as the stage meets hands: the shorter one's chest
      return [x - S.rx, g[1] * Hp];
    }
    function landmark(S, side, name, wallD, spec) {
      if (/^partner\./.test(name)) return partnerGuess(S, spec || { at: name });
      const pose = poseOf({ S, x: 0, y: 0, facing: 1 }), sol = CharRig.solve(ch, pose);
      return lmOn(sol, side, name, wallD, S.rx);
    }
    // the front of the torso as the skin draws it (curves flattened), torso frame; -Infinity without parts
    let drawnF = null;
    function drawnFront() {
      if (drawnF !== null) return drawnF;
      drawnF = new Array(13).fill(-Infinity);   // heights -0.2 .. 1.0 of the torso (an apron hangs below it)
      const T = pr.torso;
      for (const e of [].concat((ch.parts || {}).torso || [])) if (e && e.d && CharRig.parsePath) {
        let cur = [0, 0];
        const see = p => { const i = Math.round((p[1] / T + 0.2) / 0.1); if (i >= 0 && i < 13) drawnF[i] = Math.max(drawnF[i], p[0]); };
        for (const s of CharRig.parsePath(e.d)) {
          if (s[0] === 'M') cur = s[1];
          else if (s[0] === 'L') { see(s[2]); cur = s[2]; }
          else if (s[0] === 'C') { for (let i = 1; i <= 10; i++) { const u = i / 10, v = 1 - u; see([v * v * v * cur[0] + 3 * v * v * u * s[1][0] + 3 * v * u * u * s[2][0] + u * u * u * s[3][0], v * v * v * cur[1] + 3 * v * v * u * s[1][1] + 3 * v * u * u * s[2][1] + u * u * u * s[3][1]]); } cur = s[3]; }
          else if (s[0] === 'Q') { for (let i = 1; i <= 10; i++) { const u = i / 10, v = 1 - u; see([v * v * cur[0] + 2 * v * u * s[1][0] + u * u * s[2][0], v * v * cur[1] + 2 * v * u * s[1][1] + u * u * s[2][1]]); } cur = s[2]; }
          else if (s[0] === 'A') { see(s[5]); cur = s[5]; }
        }
      }
      return drawnF;
    }
    // a landmark on a solved pose (rig coords, root at x = 0)
    function lmOn(sol, side, name, wallD, rx) {
      const J = sol.joints, An = sol.angles;
      const W = ch.body ? ch.body.b.headWidth : 0.9, hr = handR, T = pr.torso, reach = pr.upperArm + pr.foreArm;
      const H = p => { const q = rotv(p, An.head); return [J.headBase[0] + q[0], J.headBase[1] + q[1]]; };
      const prof = ch.body ? ch.body.profile : (() => ({ front: 0.28, back: -0.28 }));
      const Tt = p => sol.spine && (sol.spine.tb !== 0 || sol.spine.ts !== 1) ? CharRig.spineWarp(sol.spine, p).p : (q => [J.root[0] + q[0], J.root[1] + q[1]])(rotv(p, An.torso));
      const sh = J['shoulder.' + side];
      switch (name) {
        case 'shoulder': return [sh[0] - 0.02, sh[1] + 0.12 + hr];
        case 'shoulderJoint': return sh.slice();
        case 'waist': return Tt([prof(0.22 * T).back - hr, 0.22 * T]);
        case 'torso': case 'torsoLine': {   // the most forward point of the torso as drawn (a skin's apron or belly counts), no hand radius
          const df = drawnFront();
          const line = []; for (let i = 0; i < 13; i++) { const f = -0.2 + 0.1 * i; if (f < 0 && !isFinite(df[i])) continue; line.push(Tt([Math.max(f >= 0 ? prof(f * T).front : -Infinity, df[i]), f * T])); }
          return name === 'torsoLine' ? line : line.reduce((b, p) => p[0] > b[0] ? p : b); }
        case 'side': { const q = prof(0.5 * T); return Tt([0.55 * q.back + 0.45 * q.front, 0.5 * T]); }   // the flank, halfway through the body
        case 'face': return H([0.45 * W + hr, 0.45]);
        case 'wrist.near': case 'wrist.far': return J[name].slice();
        case 'hand': return J['wrist.' + side].slice();
        case 'arm': { const e = J['elbow.' + side], w = J['wrist.' + side]; return [(e[0] + w[0]) / 2, (e[1] + w[1]) / 2]; }
        case 'top': return H([0, (ch.headTop || 1.04) + hr]);
        case 'forehead': return H([0.45 * W + hr, 0.78]);
        case 'eye': return H([0.44 * W + hr, 0.55]);
        case 'mouth': return H([0.5 * W + hr, 0.25]);
        case 'chin': return H([0.3 * W, -hr]);
        case 'ear': return H([-0.06 * W, 0.5]);
        case 'backhead': return H([-0.55 * W - hr, 0.55]);
        case 'neck': { const q = rotv([0.08 + hr, 0.03], An.neck); return [J.neckBase[0] + q[0], J.neckBase[1] + q[1]]; }
        case 'chest': return Tt([prof(0.72 * T).front + hr, 0.72 * T]);
        case 'belly': return Tt([prof(0.4 * T).front + hr, 0.4 * T]);
        case 'hip': return Tt([0.05, 0.1 * T]);
        case 'back': return Tt([prof(0.55 * T).back - hr, 0.55 * T]);
        case 'seat': return Tt([prof(0.05 * T).back - hr, 0.05 * T]);
        case 'knee': return [J['knee.near'][0] + 0.1, J['knee.near'][1] + 0.05];
        case 'ground': return [J.root[0] + 0.5 * L, hr];
        case 'front': return [sh[0] + 0.85 * reach, sh[1] - 0.05 * reach];
        case 'up': return [sh[0] + 0.15 * reach, sh[1] + 0.85 * reach];
        case 'out': return [sh[0] + 0.6 * reach, sh[1] + 0.6 * reach];
        case 'down': return [sh[0] + 0.05, sh[1] - 0.92 * reach];
        // a wall `wall` leg lengths ahead of where the action started (negative: behind), surface side
        case 'wall': case 'wallHigh': case 'wallLow': {
          const wx = (wallD || 0) * L - (rx || 0), toward = wallD >= 0 ? -1 : 1;
          const y = name === 'wall' ? sh[1] : name === 'wallHigh' ? J.headBase[1] + 0.5 : J.root[1] + 0.1 * T;
          return [wx + toward * hr, y];
        }
      }
      return null;
    }
    // a hand target: 'chin' | ['chin', dx, dy] | { at: 'chin', dx, dy }; dx forward, dy up, head heights
    function targetOf(S, side, spec) {
      const s = typeof spec === 'string' ? { at: spec } : Array.isArray(spec) ? { at: spec[0], dx: spec[1], dy: spec[2] } : (spec || {});
      const p = landmark(S, side, s.at, s.wall, s);
      return p ? [p[0] + (+s.dx || 0), p[1] + (+s.dy || 0)] : null;
    }
    // shoulder and elbow angles (radians, as in S.arms) that put this side's wrist on a point
    function armTo(S, side, tgt) {
      const sol = CharRig.solve(ch, poseOf({ S, x: 0, y: 0, facing: 1 })), sh = sol.joints['shoulder.' + side], ta = sol.angles.torso;
      let best = null;
      for (const sd of [-1, 1]) {
        const r = CharRig.ik2(sh, tgt, pr.upperArm, pr.foreArm, sd);
        const ua = Math.atan2(r.mid[1] - sh[1], r.mid[0] - sh[0]), fa = Math.atan2(r.end[1] - r.mid[1], r.end[0] - r.mid[0]);
        const el = wrapA(fa - ua);
        if (el >= -1e-6 && (!best || sd < 0)) best = [wrapA(ua - ta + Math.PI / 2), el];
      }
      return best;
    }
    const userActs = () => { const g = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : {}); return g.CharActions || {}; };
    const actCache = new Map();
    // poses that actions can start from, pass through or end in: the built-in sit, kneel and crouch, a
    // lying pose (on the back, legs out ahead), standing. Fields as in a clip key; feet relative to the pelvis.
    const presetCache = {};
    function presetOf(name) {
      if (presetCache[name] !== undefined) return presetCache[name];
      const run = ks => { let s = resolveKey(STAND, baseS(), {}); for (const q of ks) s = resolveKey(q, s, { on: 0 }); return s; };
      let S = null;
      if (name === 'stand') S = resolveKey(STAND, baseS(), {});
      else if (name === 'sit') S = run(ACTIONS.sit.keys);
      else if (name === 'kneel') S = run(ACTIONS.kneel.keys);
      else if (name === 'squat') S = run(ACTIONS.crouch.keys);
      else if (name === 'heels') {   // both knees down, sitting back on the heels: an adult at a child's height
        S = resolveKey(STAND, baseS(), {});
        const ry = 0.5 * L, a = 1.35;
        S.ry = ry; S.lean = 0.08; S.bend = 0; S.head = 0.1; S.neck = 0.05; S.twist = 0; S.tilt = 0; S.rx = 0;
        S.feet.near = { x: -0.5 * L, y: -minRotY(a) + 0.01, a }; S.feet.far = { x: -0.44 * L, y: -minRotY(a) + 0.01, a };
        S.arms.near = [0.2, 0.5, 0]; S.arms.far = [0.25, 0.5, 0];
      }
      else if (name === 'lie') {
        S = resolveKey(STAND, baseS(), {});
        const ry = Math.max(0.65 * pr.radius.hip, 0.12), a = 1.2, fy = -minRotY(a);
        S.ry = ry; S.lean = -1.5; S.bend = 0; S.head = -0.12; S.neck = 0; S.twist = 0; S.tilt = 0; S.rx = 0;
        const ext = Math.sqrt(Math.max(0.01, Math.pow(L * 0.97, 2) - Math.pow(ry - fy, 2)));
        S.feet.near = { x: ext, y: fy, a }; S.feet.far = { x: ext - 0.08 * L, y: fy, a };
        S.arms.near = [0.22, 0.12, 0]; S.arms.far = [0.18, 0.12, 0];
      }
      if (!S) return (presetCache[name] = null);
      const f = { h: (S.ry - A) / L, lean: S.lean / D2R, bend: (S.bend || 0) / D2R, twist: S.twist / D2R, head: S.head / D2R, neck: S.neck / D2R, tilt: S.tilt / D2R,
        chest: S.chest || 1, armN: S.arms.near.map(v => v / D2R), armF: S.arms.far.map(v => v / D2R) };
      const ft = sd => { const q = S.feet[sd]; return [(q.x - S.rx) / L, Math.max(0, (q.y + minRotY(q.a)) / L), q.a / D2R]; };
      return (presetCache[name] = { f, dx: S.rx / L, near: ft('near'), far: ft('far') });
    }
    const BODYF = ['lean', 'bend', 'twist', 'head', 'neck', 'tilt', 'chest', 'squash', 'x', 'h'];
    function actionClip(def, args) {
      const key = def.name + JSON.stringify(args || {});
      if (actCache.has(def) && actCache.get(def).has(key)) return actCache.get(def).get(key);
      const body = def.channel !== 'arms', val = v => typeof v === 'function' ? v(args || {}, { L, heads: H }) : v;
      // a key's low: {...} replaces its fields when the partner is under 0.6 of this body's height (a child), high: {...} over 1.65
      const sz = args && isFinite(+args.size) ? +args.size : 1;
      // the role's own low / high replace those fields in every key that names no pose and is not 'stand'
      // a role with no low of its own that puts a hand on a much smaller partner kneels on the heels by default
      const isRole = /^w+.(a|b)$/.test(def.name || ''), touchesPartner = (def.keys || []).some(q => /partner./.test(JSON.stringify([q.handNear, q.handFar])));
      const roleV = v => def[v] || (v === 'low' && isRole && touchesPartner ? { pose: 'heels' } : null);
      const variant = k0 => { const v = sz < 0.6 ? 'low' : sz > 1.65 ? 'high' : null; if (!v) return k0; const all = roleV(v) && !k0.pose && !k0.stand ? roleV(v) : null; return all || k0[v] ? Object.assign({}, k0, all || {}, k0[v] || {}) : k0; };
      const keys = (def.keys || []).map(variant).map(k0 => { const q = {}; for (const f of Object.keys(k0)) if (f !== 'low' && f !== 'high') q[f] = val(k0[f]); return q; }).filter(q => isFinite(+q.t)).sort((a, b) => a.t - b.t);
      const standK = body ? { lean: STAND.lean, bend: 0, twist: STAND.twist, head: STAND.head, neck: STAND.neck, tilt: STAND.tilt, chest: 1, squash: [1, 1], x: 0, h: STAND.h, armN: STAND.armN.slice(), armF: STAND.armF.slice() }
        : { lean: 0, head: 0, twist: 0, neck: 0, h: 0, armN: STAND.armN.slice(), armF: STAND.armF.slice() };
      const out = [Object.assign({ t: 0 }, JSON.parse(JSON.stringify(standK)))];
      const aim = { near: [], far: [] };
      let lastCrouch = 0, lastY = 0, curX = 0;
      const step = def.step || null;
      const footSpec = f => {   // [ahead, lift, angle] | 'step' | ['step', dx] | 'ground' | ['ground', dx]
        const nm = typeof f === 'string' ? f : (Array.isArray(f) && typeof f[0] === 'string' ? f[0] : null);
        if (!nm) return f.slice();
        const dx = Array.isArray(f) ? (+f[1] || 0) : 0;
        return nm === 'step' && step ? [(+step.ahead || 0.4) + 0.12 + dx, +step.height || 0.2, 0] : [STAND.near[0] + dx, 0, 0];
      };
      for (const k of keys) {
        const c = { t: Math.max(0.02, +k.t) };
        if (k.hold) c.flat = true;
        if (k.stand) Object.assign(c, JSON.parse(JSON.stringify(standK)));
        if (body && k.pose) { const p = presetOf(k.pose); if (p) { const bx = (k.x !== undefined ? +k.x : curX) + p.dx; Object.assign(c, JSON.parse(JSON.stringify(p.f))); c.x = bx; if (!k.footNear) c._fN = [p.near[0] + bx, p.near[1], p.near[2]]; if (!k.footFar) c._fF = [p.far[0] + bx, p.far[1], p.far[2]]; lastCrouch = 0; lastY = 0; } }
        if (k.turn !== undefined) c.turn = clamp(+k.turn, -1, 1);
        for (const f of ['lean', 'bend', 'twist', 'head', 'neck', 'tilt']) if (k[f] !== undefined) c[f] = +k[f];
        if (isRole && c.lean !== undefined && !(k.pose === 'lie')) c.lean = clamp(c.lean, -60, 50);   // a paired role bends, it never topples
        if (k.chest !== undefined) c.chest = +k.chest;
        if (k.squash !== undefined) c.squash = k.squash;
        if (k.x !== undefined) c.x = +k.x;
        if (body && (k.crouch !== undefined || k.y !== undefined)) {   // pelvis height: crouch lowers it, y raises the whole body (a step, a ledge)
          if (k.crouch !== undefined) lastCrouch = clamp(+k.crouch, 0, 1);
          if (k.y !== undefined) lastY = +k.y;
          c.h = 0.975 - 0.45 * lastCrouch + lastY;
        }
        if (body && k.rise !== undefined) {   // up on the toes: heels lift (the toes stay planted), pelvis rises
          const r = clamp(+k.rise, 0, 1);
          c.h = 0.975 + 0.06 * r;
          if (!k.footNear) c._fN = [STAND.near[0], 0, -32 * r];
          if (!k.footFar) c._fF = [STAND.far[0], 0, -32 * r];
        }
        if (!body && k.bob !== undefined) c.h = +k.bob / L;
        if (k.armNear) c.armN = k.armNear.slice(); if (k.armFar) c.armF = k.armFar.slice();
        if (body && k.footNear) c._fN = footSpec(k.footNear); if (body && k.footFar) c._fF = footSpec(k.footFar);
        if (k.hands) c.hands = typeof k.hands === 'string' ? k.hands : [k.hands.near || 'relaxed', k.hands.far || 'relaxed'];
        if (k.mouth !== undefined) c.mouth = k.mouth;
        const norm = h => { const s = typeof h === 'string' ? { at: h } : Array.isArray(h) ? { at: h[0], dx: h[1], dy: h[2] } : Object.assign({}, h); if (def.wall !== undefined) s.wall = +def.wall;
          if (/^partner\./.test(s.at)) { s.who = (args && args.with) || ''; s.apart = args && isFinite(+args.apart) ? +args.apart : 1; s.size = sz; }
          return s; };
        if (k.handNear) { c._hN = norm(k.handNear); aim.near.push(c.t); }
        if (k.handFar) { c._hF = norm(k.handFar); aim.far.push(c.t); }
        if (c.x !== undefined) curX = c.x;
        out.push(c);
      }
      // an action whose first key names a pose starts in it (getup from lying, standup from sitting)
      if (body && keys.length && keys[0].pose && out.length > 1) { const c1 = out[1]; for (const f of Object.keys(c1)) if (f !== 't' && f !== 'flat' && !f.startsWith('_h')) out[0][f] = JSON.parse(JSON.stringify(c1[f])); }
      // feet are written from where the pelvis started (leg lengths ahead, lift, toe angle); a foot
      // that is down at two keys in the same place is planted between them (no slide)
      const autoC = { near: [], far: [] };
      if (body) {
        let x = 0;
        const last = { _fN: [STAND.near[0], 0, 0], _fF: [STAND.far[0], 0, 0] }, down = { _fN: 0, _fF: 0 };
        const anyFeet = out.some(c => c._fN || c._fF) || out.some(c => c.x);
        for (const c of out) {
          if (c.x !== undefined) x = c.x;
          for (const [fk, side, ck] of [['_fN', 'near', 'near'], ['_fF', 'far', 'far']]) {
            const f = c[fk] || (anyFeet ? last[fk] : null);
            if (!f) continue;
            const same = Math.abs(f[0] - last[fk][0]) < 0.02 && Math.abs((f[1] || 0) - (last[fk][1] || 0)) < 0.01;
            const onSurface = (f[1] || 0) <= 1e-6 || (step && Math.abs((f[1] || 0) - (+step.height || 0.2)) < 0.01);
            if (c[fk] && onSurface && same && c.t > 0) autoC[side].push([down[fk], c.t]);
            if (!onSurface || !same) down[fk] = c.t;
            c[ck] = [f[0] - x, f[1] || 0, f[2] || 0];
            last[fk] = f.slice(); delete c[fk];
          }
        }
      }
      // hand targets: the body pose at that key (without arms), then IK on this body
      const plain = out.map(c => { const q = Object.assign({}, c); delete q._hN; delete q._hF; return q; });
      const probe = prepClip({ dur: Math.max(0.05, plain[plain.length - 1].t), keys: plain, blendIn: 0 });
      const entry = mkState(resolveKey(STAND, baseS(), {}), 0, 1);
      const pseg = body ? clipSeg(0, entry, null, probe, {}) : null;
      for (const c of out) for (const [hk, side, ak] of [['_hN', 'near', 'armN'], ['_hF', 'far', 'armF']]) {
        if (!c[hk]) continue;
        let S;
        if (body) S = cloneS(pseg.at(c.t).S);
        else { S = resolveKey(STAND, baseS(), {}); for (const f of ['lean', 'head', 'twist', 'neck']) S[f] += (c[f] || 0) * D2R; }
        applyPosture(S);
        let tg = targetOf(S, side, c[hk]), a = tg && armTo(S, side, tg);
        // too far for this arm: bring the landmark to the hand (head nods toward it, body leans or
        // crouches toward the ground); what is still out of reach is reached as far as the arm goes
        const lmName = c[hk].at;
        const reachOK = () => { const sol = CharRig.solve(ch, poseOf({ S, x: 0, y: 0, facing: 1 })), sh = sol.joints['shoulder.' + side]; return Math.hypot(tg[0] - sh[0], tg[1] - sh[1]) < 0.97 * (pr.upperArm + pr.foreArm); };
        const HEADL = { top: 1, forehead: 1, eye: 1, mouth: 1, chin: 1, ear: 1, backhead: 1 };
        if (c._assisted) { S.lean += c._assisted.lean; S.ry += c._assisted.ry; S.neck += c._assisted.neck; S.head += c._assisted.head; tg = targetOf(S, side, c[hk]); }
        const as0 = { lean: 0, ry: 0, neck: 0, head: 0 };
        for (let i = 0; tg && !c._assisted && i < 4 && !reachOK(); i++) {
          if (HEADL[lmName]) { S.neck += 0.07; S.head += 0.06; as0.neck += 0.07; as0.head += 0.06; }
          else if (lmName === 'ground' || lmName === 'knee') { S.lean += 0.08; S.ry -= 0.04 * L; as0.lean += 0.08; as0.ry -= 0.04 * L; }
          else if (/^partner./.test(lmName) && tg[1] < S.ry + 0.6 * pr.torso) { S.lean += 0.1; S.ry -= 0.05 * L; as0.lean += 0.1; as0.ry -= 0.05 * L; }   // a smaller partner: bend down to them
          else break;
          tg = targetOf(S, side, c[hk]);
        }
        if (!c._assisted && (as0.lean || as0.neck)) {
          c._assisted = as0;
          if (as0.neck) { c.neck = (c.neck !== undefined ? c.neck : STAND.neck) + as0.neck / D2R; c.head = (c.head !== undefined ? c.head : STAND.head) + as0.head / D2R; }
          if (as0.lean) { c.lean = (c.lean !== undefined ? c.lean : STAND.lean) + as0.lean / D2R; c.h = (c.h !== undefined ? c.h : STAND.h) + as0.ry / L; }
          if (isRole && c.lean !== undefined) c.lean = clamp(c.lean, -60, 50);
        }
        a = tg && armTo(S, side, tg);
        if (tg) (c._pts = c._pts || {})[side] = tg;
        if (a) c[ak] = [a[0] / D2R, a[1] / D2R, c[ak] && c[ak][2] !== undefined ? c[ak][2] : 0];
        c['_tg' + side] = c[hk];
        delete c[hk];
      }
      // anticipation: a small counter-move before the first key; settle: a small overshoot after the last
      const NUM = ['lean', 'bend', 'twist', 'head', 'neck', 'tilt', 'x', 'h', 'armN', 'armF'];
      const an = def.anticipation === undefined ? 1 : +def.anticipation, se = def.settle === undefined ? 1 : +def.settle;
      if (an > 0 && out.length > 1) {
        const k1 = out[1], pre = { t: Math.min(0.14, 0.45 * k1.t) };
        if (pre.t > 0.04) {
          for (const f of NUM) if (k1[f] !== undefined && out[0][f] !== undefined) pre[f] = Array.isArray(k1[f]) ? k1[f].map((v, j) => out[0][f][j] - 0.18 * an * (v - out[0][f][j])) : out[0][f] - 0.18 * an * (k1[f] - out[0][f]);
          out.splice(1, 0, pre);
        }
      }
      // loop: true repeats forever unless the script gives times= or for=, then it ends like any action
      const loopAll = def.loop === true && !(+(args || {}).times > 0 || +(args || {}).for > 0);
      if (body && def.end !== 'hold' && !loopAll) {
        // end state: back to standing (default), or into a sit, kneel, squat or lying pose that holds
        const last = out[out.length - 1], endP = def.end && def.end !== 'stand' ? presetOf(def.end) : null;
        let lx = 0; for (const q of out) if (q.x !== undefined) lx = q.x;
        const fin = Object.assign({ t: last.t + (def.back === undefined ? 0.45 : +def.back) }, JSON.parse(JSON.stringify(endP ? endP.f : standK)));
        fin.x = lx + (endP ? endP.dx : 0);
        if (endP) { fin.near = endP.near.slice(); fin.far = endP.far.slice(); }
        out.push(fin);
      }
      if (se > 0 && out.length > 2) {
        const a = out[out.length - 2], b = out[out.length - 1], over = { t: b.t + 0.13 }, fin = Object.assign({}, b, { t: b.t + 0.32 });
        for (const f of NUM) if (b[f] !== undefined && a[f] !== undefined) over[f] = Array.isArray(b[f]) ? b[f].map((v, j) => v + 0.1 * se * (v - a[f][j])) : b[f] + 0.1 * se * (b[f] - a[f]);
        delete fin.flat; delete fin._tgnear; delete fin._tgfar; delete fin._pts;
        out.push(over, fin);
      }
      const dur = out[out.length - 1].t;
      const ov = def.overlap === undefined ? 1 : +def.overlap;
      const lag = body ? { head: 0.06 * ov, neck: 0.05 * ov, armN: 0.07 * ov, armF: 0.1 * ov } : { armF: 0.05 * ov, head: 0.08 * ov, lean: 0.05 * ov };
      const pl = def.planted === undefined ? (def.travel || def.air || def.step ? 'none' : 'both') : def.planted;
      // airborne: the body flies a parabola between air[0] and air[1] (height in leg lengths), and lands with a squash
      if (body && Array.isArray(def.air)) {
        const [a0, a1] = def.air;
        if (!out.some(c => c.t > a1 && c.t <= a1 + 0.2 && c.squash)) {
          out.push({ t: a1 + 0.08, squash: [1.07, 0.93], h: 0.975 - 0.45 * 0.25 }, { t: a1 + 0.3, squash: [1, 1], h: 0.975 });
          out.sort((p, q) => p.t - q.t);
        }
      }
      const contacts = body ? { near: pl === 'both' || pl === 'near' ? [[0, dur]] : autoC.near, far: pl === 'both' || pl === 'far' ? [[0, dur]] : autoC.far } : {};
      if (body && def.travel && !keys.some(k => k.x !== undefined)) for (const c of out) c.x = def.travel * c.t / dur;
      // aim windows: while a hand goes to (or stays at) a landmark, the keep-out leaves it alone
      const win = ts => { const w = []; ts.forEach((t, i) => w.push([t - 0.3, (i + 1 < ts.length && ts[i + 1] - t < 0.8 ? ts[i + 1] : t) + 0.25])); return w; };
      const userLast = keys.length ? Math.max(...keys.map(q => +q.t)) : dur;
      const loop = loopAll ? [0, dur] : def.loop === true ? [Math.min(+keys[0].t, userLast - 0.05), userLast] : (Array.isArray(def.loop) ? def.loop : null);
      // contact: hands may touch the head and body on purpose for the whole action (no keep-out)
      const ct = def.contact ? [[-1, dur + 1]] : null;
      // start: the action eases out of whatever the actor was doing (sitting, kneeling...) over its first key
      const bIn = def.blendIn !== undefined ? def.blendIn : (body ? clamp(keys.length ? +keys[0].t : 0.15, 0.15, 0.6) : 0.15);
      const clip = { dur, keys: out, lag, contacts, blendIn: bIn, loop, life: loopAll ? 0.2 : 0,
        aim: { near: ct || win(aim.near), far: ct || win(aim.far) }, name: def.name };
      if (body && Array.isArray(def.air)) { clip.flight = def.air.slice(); clip.height = def.height === undefined ? 0.4 : +def.height; }
      if (!actCache.has(def)) actCache.set(def, new Map());
      actCache.get(def).set(key, clip);
      return clip;
    }
    // ---------------------------------------------------------------- mood layer
    const MOODMOTION = CharPoses.moodMotion || {};
    const moodEvs = evs.filter(e => e.channel === 'mood');
    function moodVec(t) {
      const v = { lean: 0, bend: 0, neck: 0, head: 0, twist: 0, chest: 0, drop: 0, shoulder: 0, elbow: 0, cadence: 0, stride: 0, swing: 0, bounce: 0, tempo: 0, fist: 0 };
      for (const e of moodEvs) {
        if (e.t > t) break;
        const m = MOODMOTION[e.args.name] || {}, s = clamp(e.args.strength === undefined ? 1 : +e.args.strength, 0, 2), u = smooth((t - e.t) / 0.6);
        for (const f of Object.keys(v)) v[f] = lerp(v[f], (m[f] || 0) * s, u);
      }
      return v;
    }
    function turnSeg(t0, entry, prev) {
      blinkAt.push(t0 + 0.12);
      const TP = ACTIONS.turn.clip && prepClip(ACTIONS.turn.clip);
      if (TP) return clipSeg(t0, entry, prev || null, TP, { ts: TS });
      const E = rebase(entry), dur = ACTIONS.turn.dur || 0.34, end = t0 + dur;
      const tuck = [10 * D2R, 50 * D2R, 0];
      return { t0, end, at(t) {
        const u = clamp((t - t0) / dur, 0, 1), su = smooth(u), b = Math.sin(Math.PI * u);
        const S = cloneS(E.S);
        S.ry -= 0.035 * L * b;
        for (const s of SIDES) for (let j = 0; j < 3; j++) S.arms[s][j] = lerp(S.arms[s][j], tuck[j], 0.6 * b);
        S.lean += 0.08 * b;
        S.squash = [S.squash[0] * (0.28 + 0.72 * Math.abs(Math.cos(Math.PI * su))), S.squash[1]];
        return mkState(S, E.x, su < 0.5 ? E.facing : -E.facing, { life: u >= 1 ? smooth((t - end) / 0.6) : 0 });
      } };
    }
    // stand back up first when coming from a low pose (kneel, sit, crouch)
    function maybeGetUp(list, t, cur) {
      if (cur.S.ry > A + 0.82 * L) return { t, cur };
      const s = keyedSeg(t, cur, [Object.assign({}, STAND, { dur: 0.42, ease: 'inOut', lean: 18, x: null })], {});
      list.push(s);
      return { t: s.end, cur: s.at(s.end) };
    }
    // beat grid step (s) at a time, 0 = none (stage.js passes env.grid from the script's clock: tempo)
    const gridAt = t => { try { const g = env.grid ? +env.grid(t) : 0; return g > 0.05 ? g : 0; } catch (e) { return 0; } };
    const onGrid = (t, g) => g ? Math.ceil(t / g - 1e-6) * g : t;
    function gaitSegs(spec, t, cur, targetX, speed, steps, endMode, prev) {
      const list = [];
      const dirn = Math.sign(targetX - cur.x) || cur.facing;
      if (Math.abs(targetX - cur.x) < 0.05 * L * k) return list;
      ({ t, cur } = maybeGetUp(list, t, cur));
      if (list.length) prev = list[list.length - 1];
      if (dirn !== cur.facing) { const s = turnSeg(t, cur, prev); list.push(s); t = s.end; cur = s.at(t); prev = s; }
      // on a beat grid every foot strikes on a grid step: the first one step after the start
      const g = gridAt(t);
      if (g && list.length) t = onGrid(t, g);
      // a start clip (anticipation) plays first; the gait cross-fades in from its last pose
      const startP = !g && spec.start ? prepClip(spec.start) : null;
      if (startP) { const s = clipSeg(t, cur, prev, startP, { ts: TS }); list.push(s); t = s.end; cur = s.at(t); prev = s; }
      // end=skid: arrive at full speed, then the skid clip slides the rest of the way
      const skidP = !g && endMode === 'skid' ? prepClip('skid') : null;
      const E = rebase(cur);
      const Dist = Math.abs(targetX - E.x) / k;
      const p = CharGait.resolve(Object.assign({}, CharGait.presets[spec.gait], spec.params || {}, { speed: clamp(speed || 1, 0.3, 2.5) }));
      // a faster run takes longer strides with a longer flight, and leans in more (not just faster legs)
      const vSpeed = p.speed;
      if (ch.body) p.cadence *= Math.pow(1 / Math.max(0.3, L), 0.35);   // longer legs step slower (built bodies)
      if (AGE === 1) { p.stride *= 0.72; p.cadence *= 1.25; p.bounce *= 1.4; p.duty = Math.min(0.75, p.duty + 0.06); p.lean -= 0.06; }
      if (AGE === 4) { p.stride *= 0.78; p.cadence *= 0.85; p.bounce *= 0.6; p.armSwing *= 0.6; p.duty = Math.max(p.duty, 0.52); p.kneeLift *= 0.6; p.heelKick *= 0.5; }
      p.bounce *= (1 - 0.5 * (MO.weight - 0.3)) * (0.8 + 0.4 * MO.energy); p.armSwing *= 0.8 + 0.4 * MO.energy;
      p.cadence *= 0.92 + 0.16 * MO.energy;
      { const mv = moodVec(t); p.cadence *= 1 + mv.cadence; p.stride *= 1 + mv.stride; p.armSwing *= Math.max(0, 1 + mv.swing); p.bounce *= Math.max(0, 1 + mv.bounce); }
      if (spec.gait === 'run') {
        p.stride *= Math.pow(vSpeed, 0.5); p.cadence *= Math.pow(vSpeed, 0.35);
        p.duty = clamp(p.duty - 0.06 * (vSpeed - 1), AGE === 4 ? 0.52 : 0.2, 0.6); p.lean += 0.07 * (vSpeed - 1);
        p.kneeLift *= 0.85 + 0.15 * vSpeed; p.heelKick *= 0.85 + 0.15 * vSpeed; p.speed = 1;
      }
      const cycP = spec.cycle && !gridAt(t) ? prepClip(spec.cycle) : null;
      const sq = Math.sqrt(p.speed), rate = p.cadence * sq, d = p.duty;
      const s0 = (p.heelFrac + p.flatFrac) / 2 * d;
      const stance = E.S.feet.near.x >= E.S.feet.far.x ? 'near' : 'far';
      const other = stance === 'near' ? 'far' : 'near';
      const phS = stance === 'near' ? s0 : s0 + 0.5;
      const STD = { near: STAND.near[0] * L, far: STAND.far[0] * L };
      // choose step count and stride so the pelvis ends at the target (two passes: start and stop
      // offsets depend on the stride)
      let n = 1, S = 1, params = null, offset = 0, want = Dist;
      // the skid slides further the faster she arrives (clip x is authored for about 3.8 leg lengths/s)
      const skidXs = skidP ? clamp(p.stride * L * Math.sqrt(p.speed) * p.cadence * Math.sqrt(p.speed) / L / ((spl(skidP, 'x', 0.1) - spl(skidP, 'x', 0)) / 0.1), 1, 2.2) : 1;
      const skidL = skidP ? spl(skidP, 'x', skidP.dur) * L * skidXs : 0;
      if (skidP) {
        want = Math.max(0.3 * L, Dist - skidL);
        n = steps > 0 ? Math.round(steps) : Math.max(1, Math.round(want / (p.stride * L * sq / 2)));
        S = 2 * want / n;
        params = Object.assign({}, p, { stride: S / (L * sq) });
        offset = E.S.feet[stance].x - CharGait.pose(params, phS, ch).legs[stance].foot[0];
      }
      for (let pass = 0; pass < (skidP ? 0 : 3); pass++) {
        n = steps > 0 ? Math.round(steps) : Math.max(1, Math.round(want / (p.stride * L * sq / 2)));
        S = 2 * want / n;
        params = Object.assign({}, p, { stride: S / (L * sq) });
        const g0 = CharGait.pose(params, phS, ch);
        offset = E.S.feet[stance].x - g0.legs[stance].foot[0];
        const gE = CharGait.pose(params, phS + n / 2, ch);
        const stE = n % 2 === 0 ? stance : other;
        const footE = offset + Math.floor(phS + n / 2) * S + gE.legs[stE].foot[0];
        const finalRoot = footE - STD[stE];
        want = Math.max(0.05, want + (Dist - finalRoot));
      }
      const phE = phS + n / 2;
      const gaitS = ph => {
        const g = CharGait.pose(params, ph, ch), X = offset + Math.floor(ph) * S;
        const St = cloneS(E.S);
        St.rx = X + g.root[0]; St.ry = g.root[1];
        St.lean = g.spineLean; St.tilt = g.pelvisTilt; St.twist = g.chestTwist; St.neck = g.neck; St.head = g.headTilt;
        for (const s of SIDES) {
          St.feet[s] = { x: X + g.legs[s].foot[0], y: g.legs[s].foot[1], a: g.legs[s].footAngle };
          St.arms[s] = [g.arms[s].shoulder, g.arms[s].elbow, g.arms[s].wrist];
        }
        const hand = spec.gait === 'run' ? 'fist' : 'relaxed';
        St.hands = { near: hand, far: hand }; St.squash = [1, 1]; St.stretch = 1; St.mouth = null;
        St.bend = (spec.gait === 'run' ? 0.5 : 0.2) * g.spineLean; St.chest = 1;
        if (cycP) {
          // the cycle clip (clips.js runCycle) shapes the body over one stride: down on each landing,
          // up into the flight, head and chest taking the weight, arms pumping in opposition
          const tc = ph - Math.floor(ph), has = f => !!cycP.ch[f], amp = 0.8 + 0.25 * vSpeed;
          if (has('h')) St.ry += spl(cycP, 'h', tc) * L * (0.7 + 0.3 * vSpeed);
          for (const f of ['lean', 'head', 'neck', 'twist']) if (has(f)) St[f] += spl(cycP, f, tc) * D2R;
          if (has('bend')) St.bend = spl(cycP, 'bend', tc) * D2R;
          if (has('chest')) St.chest = spl(cycP, 'chest', tc);
          const arm = f => spl(cycP, f, tc).map((d, j) => (j === 0 ? 10 + (d - 10) * amp : d) * D2R);
          if (has('armN')) St.arms.near = arm('armN');
          if (has('armF')) St.arms.far = arm('armF');
        }
        return St;
      };
      // a start clip already did part of the speeding up: the gait's own ramp is shorter by its length
      const accel = Math.max(0.12, (spec.accel || 0.35) * (1 + 1.2 * Math.max(0, MO.weight - 0.3)) - (startP ? startP.dur * TS : 0));
      let T = n / (2 * rate) + (skidP ? accel / 2 : accel);
      const al = Math.min(0.5, accel / T);
      const P = u => u < al ? u * u / (2 * al * (1 - al)) : (u > 1 - al ? 1 - (1 - u) * (1 - u) / (2 * al * (1 - al)) : (u - al / 2) / (1 - al));
      // carry (end=skid): speed up at the start only, and keep going at full speed after T
      const Pc = u => u < al ? u * u / (2 * al * (1 - al / 2)) : (u - al / 2) / (1 - al / 2);
      const rEnd = (n / 2) / (T * (1 - al / 2));
      let phase = skidP ? (tau => tau <= T ? phS + (n / 2) * Pc(Math.max(0, tau) / T) : phE + (tau - T) * rEnd) : (tau => phS + (n / 2) * P(clamp(tau / T, 0, 1)));
      let settle = (spec.settle || 0.4) * TS;
      if (g) {
        // strikes at tau = g, 2g, .. n g (phase phS - s0 + j/2); the first step starts slower
        T = n * g + 2 * s0 * g;
        phase = tau => tau < g ? phS + (0.5 - s0) * Math.max(0, tau) / g : Math.min(phS + n / 2, phS - s0 + 0.5 * tau / g);
        settle = Math.ceil((2 * s0 * g + 0.2) / g - 1e-6) * g - 2 * s0 * g;   // stand still on a grid step
      }
      // settle target: plant the swing foot beside the last stance foot in the stand pose
      const stE = n % 2 === 0 ? stance : other, otE = stE === 'near' ? 'far' : 'near';
      const gEnd = gaitS(phE);
      const rootF = gEnd.feet[stE].x - STD[stE];
      const key = Object.assign({}, STAND, { x: rootF / L });
      key[stE] = [gEnd.feet[stE].x / L, 0, 0]; key[otE] = [(rootF + STD[otE]) / L, 0, 0];
      const standS = resolveKey(key, gEnd, {});
      {
        const g = gEnd.feet[stE], pv = g.a < 0 ? pr.toe : pr.heel;
        const px = g.x + pv[0] * Math.cos(g.a) - pv[1] * Math.sin(g.a);
        standS.feet[stE] = { x: px - pv[0], a: 0, y: footY(0, 0) };
      }
      const bi = spec.blendIn || 0, tg0 = t, tEnd = t + T + settle;
      const Sentry = E.S;
      list.push({ t0: tg0, end: tEnd, gait: true, at(tt) {
        const tau = tt - tg0;
        let St;
        if (tau <= T || skidP) {
          St = gaitS(phase(tau));
          if (bi > 0 && tau < bi) {
            const w = smooth(tau / bi);
            const G = St; St = cloneS(G);
            St.rx = lerp(Sentry.rx, G.rx, w); St.ry = lerp(Sentry.ry, G.ry, w);
            for (const f of ['lean', 'tilt', 'twist', 'neck', 'head', 'bend']) St[f] = lerp(Sentry[f] || 0, G[f], w);
            St.chest = lerp(Sentry.chest || 1, 1, w);
            for (const s of SIDES) for (let j = 0; j < 3; j++) St.arms[s][j] = lerp(Sentry.arms[s][j], G.arms[s][j], w);
            // stance foot is already where the gait wants it; the swing foot lifts first, then travels
            const fs = Sentry.feet[stance], gs = G.feet[stance];
            St.feet[stance] = { x: gs.x, y: lerp(fs.y, gs.y, w), a: lerp(fs.a, gs.a, w) };
            const fo = Sentry.feet[other], go = G.feet[other], wy = smooth(w * 1.8), wx = smooth((w - 0.3) / 0.7);
            St.feet[other] = { x: lerp(fo.x, go.x, wx), y: lerp(fo.y, go.y, wy), a: lerp(fo.a, go.a, wy) };
            if (w < 0.5) St.hands = Object.assign({}, Sentry.hands);
            const b = Math.sin(Math.PI * w);
            if (!startP) { St.lean += (spec.startLean || 0) * D2R * b; St.ry -= (spec.startDip || 0) * L * b; }
          }
        } else {
          const u = clamp((tau - T) / settle, 0, 1);
          St = trans(gEnd, standS, u, 'back');
          St.lean += (spec.stopLean || 0) * D2R * Math.sin(Math.PI * u) * (1 - 0.5 * u);
        }
        return mkState(St, E.x, E.facing, { life: tau > T + settle ? smooth((tau - T - settle) / 0.6) : 0, gait: tau <= T, gaitKind: spec.gait });
      } });
      if (skidP) {
        const gs = list[list.length - 1];
        gs.end = tg0 + T;
        list.push(clipSeg(tg0 + T, gs.at(tg0 + T), gs, skidP, { xs: skidXs, ts: TS }));
      }
      return list;
    }
    function jumpClipSegs(spec, t, cur, targetX, hm, prev) {
      const list = [];
      ({ t, cur } = maybeGetUp(list, t, cur));
      if (list.length) prev = list[list.length - 1];
      const dirn = Math.sign(targetX - cur.x) || cur.facing;
      if (dirn !== cur.facing && Math.abs(targetX - cur.x) > 0.05 * L * k) { const s = turnSeg(t, cur, prev); list.push(s); t = s.end; cur = s.at(t); prev = s; }
      // jump height: legs give it (clip heights are in leg lengths); weight, age and energy shape it
      const hmA = hm * (1 - 0.6 * (MO.weight - 0.3)) * (AGE === 4 ? 0.55 : AGE === 1 ? 0.75 : 1) * (0.85 + 0.3 * MO.energy);
      list.push(clipSeg(t, cur, prev, prepClip(spec.clip), { dist: Math.abs(targetX - cur.x) / k / L, hm: hmA, ts: TS }));
      return list;
    }
    function jumpSegs(spec, t, cur, targetX, hm, pose) {
      const list = [];
      ({ t, cur } = maybeGetUp(list, t, cur));
      const dirn = Math.sign(targetX - cur.x) || cur.facing;
      if (dirn !== cur.facing && Math.abs(targetX - cur.x) > 0.05 * L * k) { const s = turnSeg(t, cur); list.push(s); t = s.end; cur = s.at(t); }
      const E = rebase(cur);
      hm = clamp(hm || 1, 0.3, 3);
      const Dl = Math.abs(targetX - E.x) / k / L;           // distance in leg lengths
      const Kc = resolveKey(spec.crouch, E.S, {});
      const Kp = resolveKey(spec.push, Kc, {});
      for (const s of SIDES) { const a = (spec.push.toe || -35) * D2R; Kp.feet[s] = { x: Kc.feet[s].x, y: footY(0, a), a }; }
      const ck = Object.assign({}, spec.contact, { x: Dl, near: [Dl + spec.contact.near[0], 0, spec.contact.near[2]], far: [Dl + spec.contact.far[0], 0, spec.contact.far[2]] });
      const Kl = resolveKey(ck, Kp, {}); Kl.stretch = 1;
      const Kq = resolveKey(Object.assign({}, spec.land, { x: Dl + 0.05 }), Kl, {});
      const rk = Object.assign({}, STAND, spec.recover, { x: Dl + 0.03, near: [Dl + 0.03 + STAND.near[0], 0, 0], far: [Dl + 0.03 + STAND.far[0], 0, 0] });
      const Kr = resolveKey(rk, Kq, {});
      let tc = spec.crouch.dur, tp = spec.push.dur, tf = (spec.flight + spec.flightPerL * Dl) * Math.sqrt(hm);
      const tl = spec.land.dur;
      let tr = spec.recover.dur;
      const g = gridAt(t);
      if (g) {
        // on a beat grid: take off one grid step after the start, the top of the jump and the
        // landing fall on grid steps, and it stands still on a grid step
        if (list.length) t = onGrid(t, g);
        const kq = g / (tc + tp); tc *= kq; tp *= kq;
        tf = Math.max(2, 2 * Math.round(tf / g / 2)) * g;
        tr = Math.ceil((tl + tr) / g - 1e-6) * g - tl;
      }
      const T1 = t + tc, T2 = T1 + tp, T3 = T2 + tf, T4 = T3 + tl, T5 = T4 + tr;
      const Hj = spec.heightL * L * hm;
      const tuck = (pose === 'leap' && spec.leap) || spec.tuck;
      const yA = groundAt(E.x), yB = groundAt(E.x + E.facing * Dl * L * k);
      const relF = (K, s) => [K.feet[s].x - K.rx, K.feet[s].y];
      list.push({ t0: t, end: T5, at(tt) {
        let S, y = null;
        if (tt < T1) S = trans(E.S, Kc, (tt - t) / tc, spec.crouch.ease);
        else if (tt < T2) S = trans(Kc, Kp, (tt - T1) / tp, spec.push.ease);
        else if (tt < T3) {
          const u = (tt - T2) / tf, a = u < 0.5 ? smooth(u / 0.5) : smooth((u - 0.5) / 0.5);
          S = cloneS(u < 0.5 ? Kp : Kl);
          S.rx = lerp(Kp.rx, Kl.rx, u);
          S.ry = lerp(Kp.ry, Kl.ry, u) + Hj * 4 * u * (1 - u);
          const mid = { lean: tuck.lean * D2R };
          for (const f of ['lean', 'tilt', 'twist', 'neck', 'head']) {
            const m = mid[f] !== undefined ? mid[f] : (Kp[f] + Kl[f]) / 2;
            S[f] = u < 0.5 ? lerp(Kp[f], m, a) : lerp(m, Kl[f], a);
          }
          const armMid = { near: tuck.armN.map(d => d * D2R), far: tuck.armF.map(d => d * D2R) };
          SIDES.forEach((s, i) => {
            for (let j = 0; j < 3; j++) S.arms[s][j] = u < 0.5 ? lerp(Kp.arms[s][j], armMid[s][j], a) : lerp(armMid[s][j], Kl.arms[s][j], a);
            const rp = relF(Kp, s), rl = relF(Kl, s), rm = [tuck.feet[i][0] * L, tuck.feet[i][1] * L];
            // tucked foot height is relative to the pelvis
            const fy0 = rp[1] - Kp.ry, fy1 = rl[1] - Kl.ry;
            const rel = u < 0.5 ? [lerp(rp[0], rm[0], a), lerp(fy0, rm[1], a)] : [lerp(rm[0], rl[0], a), lerp(rm[1], fy1, a)];
            S.feet[s] = { x: S.rx + rel[0], y: S.ry + rel[1], a: u < 0.5 ? lerp(Kp.feet[s].a, -0.2, a) : lerp(-0.2, Kl.feet[s].a, a) };
          });
          S.squash = [lerp(Kp.squash[0], 1, smooth(u * 2)), lerp(Kp.squash[1], 1, smooth(u * 2))];
          S.stretch = lerp(Kp.stretch, 1, smooth(u * 3));
          S.hands = u < 0.4 ? Object.assign({}, Kp.hands) : { near: 'open', far: 'open' };
          S.mouth = u < 0.6 ? 'open' : null;
          y = lerp(yA, yB, u);
        } else if (tt < T4) S = trans(Kl, Kq, (tt - T3) / tl, spec.land.ease);
        else S = trans(Kq, Kr, (tt - T4) / tr, spec.recover.ease);
        const st = mkState(S, E.x, E.facing, { life: tt > T5 ? smooth((tt - T5) / 0.6) : 0 });
        if (tt < T2) st.y = yA; else if (y !== null) st.y = y; else st.y = yB;
        st.airborne = tt >= T2 && tt < T3;
        return st;
      } });
      return list;
    }

    let prevEnd = -Infinity, prevName = null;
    for (const ev of bodyEvs) {
      if (ev.t < prevEnd - 1e-4) D('overlap', ev.t, ev.line, `${ev.name} starts at ${ev.t.toFixed(2)}s but ${prevName} is still moving until ${prevEnd.toFixed(2)}s; it cuts that short. Start it at "+0" after the previous line to wait.`, 'warning');
      const cur = bodyAt(ev.t), prevSeg = segAt(ev.t);
      const spec = ev.spec;
      let list = [];
      if (ev.name === 'walk' || ev.name === 'run' || ev.name === 'sneak') {
        list = gaitSegs(spec, ev.t, cur, resolvePlace(ev.args.to, ev.t)[0], ev.args.speed, ev.args.steps, ev.args.end, prevSeg);
      } else if (ev.name === 'enter') {
        const fx = offX(ev.args.from);
        const st = Object.assign({}, cur, { x: fx, facing: ev.args.from === 'right' ? -1 : 1 });
        st.S = resolveKey(STAND, cur.S, {});
        list = gaitSegs(spec, ev.t, st, x0, ev.args.speed, ev.args.steps);
        if (!list.length) list = [{ t0: ev.t, end: ev.t, at: () => mkState(st.S, fx, st.facing) }];
      } else if (ev.name === 'jump') {
        const useClip = spec.clip && prepClip(spec.clip) && ev.args.pose !== 'leap' && !gridAt(ev.t);
        list = useClip ? jumpClipSegs(spec, ev.t, cur, resolvePlace(ev.args.to, ev.t)[0], ev.args.height, prevSeg)
          : jumpSegs(spec, ev.t, cur, resolvePlace(ev.args.to, ev.t)[0], ev.args.height, ev.args.pose);
      } else if (ev.name === 'turn') {
        list = [turnSeg(ev.t, cur, prevSeg)];
      } else if (spec.user) {
        let t = ev.t, c = cur, pv = prevSeg;
        // an action that starts in a named pose (or says from: 'any') takes over from sitting or lying as it is;
        // others stand up first
        const u = spec.user, startsPosed = u.from === 'any' || (Array.isArray(u.keys) && u.keys.length && u.keys.slice().sort((p, q) => p.t - q.t)[0].pose);
        // sitting, kneeling or lying: an action that does not start in a pose of its own plays only its
        // upper body (spine, head, arms, hands, face) on top of that pose, and the actor stays down
        const low = c.S.ry < A + 0.72 * L, upper = low && !startsPosed;
        if (!startsPosed && !upper) ({ t, cur: c } = maybeGetUp(list, t, c));
        if (list.length) pv = list[list.length - 1];
        const AP = prepClip(actionClip(spec.user, ev.args));
        let times = ev.args.times;
        if (AP.c.loop && !AP.cyc && +ev.args.for > 0) times = Math.max(1, Math.round((+ev.args.for - (AP.dur - (AP.c.loop[1] - AP.c.loop[0]))) / (AP.c.loop[1] - AP.c.loop[0])));
        // the two roles of a paired action share one clock (docs/PAIRS.md): no weight or mood tempo
        const paired = /^\w+\.(a|b)$/.test(u.name || '');
        list.push(clipSeg(t, c, pv, AP, { times, ts: paired ? 1 / Math.max(0.2, Math.min(5, +ev.args.speed || 1)) : TS * (1 + moodVec(ev.t).tempo), upper }));
      } else if (spec.clip && prepClip(spec.clip)) {
        let t = ev.t, c = cur, pv = prevSeg;
        ({ t, cur: c } = maybeGetUp(list, t, c));
        if (list.length) pv = list[list.length - 1];
        list.push(clipSeg(t, c, pv, prepClip(spec.clip), { times: ev.args.times, ts: TS * (1 + moodVec(ev.t).tempo) }));
      } else {
        list = [keyedSeg(ev.t, cur, spec.keys || [STAND], ev.args, { loop: spec.loop })];
      }
      if (!list.length) list = [keyedSeg(ev.t, cur, [Object.assign({}, STAND, { x: null, near: null, far: null, dur: 0.3 })], {})];
      // the first sub-segment starts at the event time
      list[0].t0 = ev.t;
      for (const s of list) segs.push(s);
      prevEnd = list[list.length - 1].end; prevName = ev.name;
      endOf[ev.i] = prevEnd;
      if (spec.mood) moodHints.push({ t: ev.t, mood: spec.mood, until: Infinity });
    }
    segs.sort((a, b) => a.t0 - b.t0);

    // ---------------------------------------------------------------- arms track
    // persistent hold layer + transient gestures (each new gesture blends over the previous one)
    const holds = [], gestures = [];
    for (const ev of evs.filter(e => e.channel === 'arms')) {
      const spec = ev.spec;
      if (ev.name === 'hold') {
        const keys = spec.variants[ev.args.how] || spec.variants.front;
        const dur = keys.reduce((s, q) => s + q.dur, 0);
        holds.push({ t0: ev.t, ev, keys, dur, end: Infinity, how: ev.args.how, prop: ev.args.prop });
        endOf[ev.i] = ev.t + dur;
        continue;
      }
      if (ev.name === 'drop') {
        const h = holds[holds.length - 1];
        if (!h || h.end !== Infinity) D('nothing-held', ev.t, ev.line, `drop at ${ev.t.toFixed(2)}s but nothing is held; use hold(prop) first.`, 'warning');
        else h.end = ev.t;
        if (+ev.args.quiet) { endOf[ev.i] = ev.t; continue; }
      }
      const cname = typeof spec.clip === 'function' ? spec.clip(ev.args) : spec.clip;
      const clipP = spec.user ? prepClip(actionClip(spec.user, ev.args)) : (cname ? prepClip(cname) : null);
      const keys = clipP ? [] : (spec.keys || []);
      if (clipP && clipP.c.loop && !clipP.cyc && +ev.args.for > 0) ev.args.times = Math.max(1, Math.round((+ev.args.for - (clipP.dur - (clipP.c.loop[1] - clipP.c.loop[0]))) / (clipP.c.loop[1] - clipP.c.loop[0])));   // for= seconds instead of times=
      const loopX = clipP && clipP.c.loop && !clipP.cyc ? (Math.max(1, Math.round(+ev.args.times || 1)) - 1) * (clipP.c.loop[1] - clipP.c.loop[0]) : 0;
      const kdur = clipP ? (clipP.dur + loopX) * TS : keys.reduce((s, q) => s + q.dur, 0);
      const hold = spec.hold === 'for' ? clamp(+ev.args.for || 1.5, 0, 60) : (spec.hold || 0);
      const rel = spec.release || 0.35;
      gestures.push({ t0: ev.t, ev, keys, clip: clipP, kdur, hold, rel, end: ev.t + kdur + hold + rel, cut: Infinity });
      endOf[ev.i] = ev.t + kdur + hold + rel;
      if (spec.mood) moodHints.push({ t: ev.t, mood: spec.mood, until: ev.t + kdur + hold + rel });
    }
    for (let i = 1; i < holds.length; i++) if (holds[i - 1].end > holds[i].t0) holds[i - 1].end = holds[i].t0;
    for (let i = 0; i + 1 < gestures.length; i++) gestures[i].cut = gestures[i + 1].t0 + (gestures[i + 1].keys[0] ? gestures[i + 1].keys[0].dur : 0.2);

    // value of a key sequence at time tau: { arms: {N:[..], F:[..]}, add, hands, stretch, wig }
    function keyVals(keys, tau, args, aimFn) {
      const out = { N: null, F: null, hands: null, add: { lean: 0, head: 0, twist: 0, h: 0, neck: 0 }, stretch: 1, wig: [], bob: null };
      let prev = null, tt = 0;
      const resolveK = (q0) => {
        // fields may be functions (args, body) => value, as in body keys
        const q = {};
        for (const f of Object.keys(q0)) q[f] = typeof q0[f] === 'function' ? q0[f](args || {}, B) : q0[f];
        const r = { N: q.aim ? aimFn(q.aim) : (q.armN ? q.armN.map(d => d * D2R) : null), F: q.armF ? q.armF.map(d => d * D2R) : null,
          hands: q.hands || null, add: { lean: (q.lean || 0) * D2R, head: (q.head || 0) * D2R, twist: (q.twist || 0) * D2R, h: (q.h || 0) * L, neck: (q.neck || 0) * D2R },
          stretch: q.stretch || 1 };
        if (q.aim && q.aim.lean) r.add.lean += (aimFn.lean || 0) * q.aim.lean;
        return r;
      };
      const carry = (a, b) => ({ N: b.N || a.N, F: b.F || a.F, hands: b.hands || a.hands, add: b.add, stretch: b.stretch });
      let cur = null;
      for (let i = 0; i < keys.length; i++) {
        const q = keys[i];
        const R = cur ? carry(cur, resolveK(q)) : resolveK(q);
        if (tau < tt + q.dur || i === keys.length - 1) {
          const u = i === 0 ? 1 : clamp((tau - tt) / q.dur, 0, 1), e = ease(q.ease, u);
          const P = cur || R;
          const mix = (a, b) => a && b ? a.map((v, j) => lerp(v, b[j], e)) : (b || a);
          out.N = mix(P.N, R.N); out.F = mix(P.F, R.F);
          for (const f of Object.keys(out.add)) out.add[f] = lerp(P.add ? P.add[f] : 0, R.add[f], e);
          out.hands = u < 0.4 && P.hands ? P.hands : R.hands;
          out.stretch = lerp(P.stretch || 1, R.stretch || 1, e);
          if (q.wiggle) out.wig = q.wiggle;
          if (q.bob) out.bob = q.bob;
          out.keyIndex = i;
          break;
        }
        cur = R; tt += q.dur;
      }
      return out;
    }

    // ---------------------------------------------------------------- look, face
    const looks = evs.filter(e => e.channel === 'look' && e.name === 'look');
    const nods = evs.filter(e => e.name === 'nod');
    for (const e of looks) endOf[e.i] = e.t + 0.3;
    for (const e of nods) endOf[e.i] = e.t + 0.75;
    const faces = evs.filter(e => e.channel === 'face');
    // ---- speech: say(text, for, track, words, visemes, beats) -> mouth cues per line (src/speech.js) ----
    const says = [];
    for (const e of evs.filter(q => q.channel === 'say')) {
      const a = e.args, nv = a.visemes ? String(a.visemes).split(/[\s,]+/).filter(Boolean).length : 0;
      const dur = +a.for > 0 ? +a.for : nv ? nv * 0.4 : (CharSpeech ? CharSpeech.estimate(a.text) : 1);
      const cs = CharSpeech ? CharSpeech.cues(a, dur, env.tracks || (typeof globalThis !== 'undefined' && globalThis.CharTracks) || {}) : [];
      says.push({ t: e.t, dur, cues: cs, beats: +a.beats > 0 });
      endOf[e.i] = e.t + dur;
    }
    for (let i = 0; i + 1 < says.length; i++) says[i].dur = Math.min(says[i].dur, says[i + 1].t - says[i].t);
    function speechAt(t) {
      let s = null;
      for (const q of says) if (q.t <= t && t < q.t + q.dur + 0.15) s = q;
      if (!s || !CharSpeech) return null;
      const r = CharSpeech.at(s.cues, t - s.t), fade = 1 - smooth((t - s.t - s.dur) / 0.15);
      r.open *= fade; r.beats = s.beats;
      return r;
    }
    // ---- face parameters (brows, lids, smile) blended between face/mood lines over 0.35 s ----
    const FP = CharPoses.faceParams || {};
    function faceAt(t) {
      const v = Object.assign({ browH: 0, browA: 0, lid: 1, smile: 0 }, FP[env.mood] || {});
      const evsF = faces.map(e => ({ t: e.t, m: e.args.mood, s: e.args.strength === undefined ? 1 : +e.args.strength }))
        .concat(moodEvs.map(e => ({ t: e.t, m: e.args.name, s: e.args.strength === undefined ? 1 : +e.args.strength })))
        .concat(moodHints.filter(h => h.until === Infinity || h.until > h.t).map(h => ({ t: h.t, m: h.mood, s: 1, until: h.until }))).sort((a, b) => a.t - b.t);
      for (const e of evsF) {
        if (e.t > t) break;
        const p = FP[e.m] || {}, u = smooth((t - e.t) / 0.35) * (e.until !== undefined && t >= e.until ? 0 : 1);
        for (const f of Object.keys(v)) { const base = f === 'lid' ? 1 : 0, tg = base + ((p[f] === undefined ? base : p[f]) - base) * clamp(e.s, 0, 2); v[f] += (tg - v[f]) * u; }
      }
      return v;
    }
    for (const e of faces) endOf[e.i] = e.t + 0.2;
    for (const e of looks) blinkAt.push(e.t + 0.02);
    for (const e of faces) blinkAt.push(e.t);
    for (const e of moodEvs) { endOf[e.i] = e.t + 0.6; blinkAt.push(e.t); }

    // ---------------------------------------------------------------- composition
    function poseOf(st, extraAdd) {
      const S = st.S;
      const pose = {
        root: [0, S.ry], spineLean: S.lean, pelvisTilt: S.tilt, chestTwist: S.twist, neck: S.neck, headTilt: S.head,
        legs: {}, arms: {}, stretch: S.stretch, torsoBend: S.bend || 0, torsoStretch: S.chest || 1,
      };
      const maxD = L * 0.995 * clamp(S.stretch || 1, 1, 1.12);
      for (const s of SIDES) {
        const f = S.feet[s];
        // uneven ground: each foot stands on the ground under itself, not under the pelvis
        const gy = isFinite(st.x) && isFinite(st.y) ? (st.y - groundAt(st.x + st.facing * k * (f.x - S.rx))) / k : 0;
        const dy = isFinite(gy) && Math.abs(gy) < 0.2 ? gy * smooth((S.ry - A - 0.35 * L) / (0.2 * L)) : 0;   // fades out for sitting   // gentle swells only; at a cliff edge the foot keeps the pelvis's ground
        let fy = f.y + dy;
        const m = fy + minRotY(f.a) - dy;
        if (m < 0) fy -= m;                       // feet never go below the ground
        pose.legs[s] = { foot: [f.x - S.rx, fy], footAngle: f.a };
        const dx = f.x - S.rx;
        if (!st.airborne && Math.abs(dx) < maxD) pose.root[1] = Math.min(pose.root[1], fy + Math.sqrt(maxD * maxD - dx * dx));
        pose.arms[s] = { shoulder: S.arms[s][0], elbow: S.arms[s][1], wrist: S.arms[s][2], stretch: S.armStretch && S.armStretch[s] };
      }
      pose.root[1] = Math.max(pose.root[1], 0.55 * pr.radius.hip);   // the seat never sinks into the ground
      return pose;
    }
    // stage position of a rig point for a state
    const toStage = (st, p) => [st.x + st.facing * k * p[0], st.y - k * p[1]];

    function moodAt(t) {
      let m = env.mood && MOODS[env.mood] ? env.mood : 'neutral', mt = -Infinity;
      for (const e of moodEvs) if (e.t <= t && e.t >= mt && MOODS[e.args.name]) { m = +e.args.strength === 0 ? 'neutral' : e.args.name; mt = e.t; }
      for (const e of faces) if (e.t <= t && e.t >= mt) { m = e.args.mood; mt = e.t; }
      for (const h of moodHints) if (h.t <= t && t < h.until && h.t >= mt) { m = h.mood; mt = h.t; }
      return m;
    }

    // core(t): body + arms + look, no follow-through chains or life (those are polish)
    function core(t) {
      const st0 = bodyAt(t);
      const S = cloneS(st0.S);
      const st = Object.assign({}, st0, { S });
      const life = st.life || 0;
      // moving hold / idle loop
      if (st.loop && life > 0) {
        const lt = t - (st.loopT0 || 0);
        for (const f of Object.keys(st.loop)) {
          const [amp, per, ph] = st.loop[f], w = Math.sin(TAU * (lt / per + (ph || 0))) * life;
          if (f === 'x') S.rx += amp * L * w;
          else if (f === 'armN') S.arms.near[0] += amp * D2R * w;
          else if (f === 'armF') S.arms.far[0] += amp * D2R * w;
          else S[f] += amp * D2R * w;
        }
      }
      if (life > 0) {
        S.lean += 0.012 * life * Math.sin(t * 0.71 + 1.3);
        S.head += 0.03 * life * Math.sin(t * 0.53 + 0.4);
        S.arms.near[0] += 0.035 * life * Math.sin(t * 0.61 + 2.1);
        S.arms.far[0] += 0.03 * life * Math.sin(t * 0.67);
      }
      // breathing
      const br = Math.sin(TAU * t / 3.3);
      S.lean -= 0.012 * br; S.ry += 0.004 * L * br;
      S.arms.near[0] += 0.015 * br; S.arms.far[0] += 0.015 * br;
      S.head += 0.01 * br;
      // posture: + stoops (rounded back, neck forward, head up to look ahead), - stands proud
      applyPosture(S);
      // a toddler walks and runs with the arms held out for balance, leaning back a little
      if (AGE === 1) {
        let aw = 0;   // eased in and out over 0.35 s at the start and end of each walk or run
        for (const g of segs) if (g.gait && t > g.t0 - 0.35 && t < g.end + 0.35) aw = Math.max(aw, Math.min(smooth((t - g.t0) / 0.35), smooth((g.end - t) / 0.35)));
        if (aw > 0) { for (const s of SIDES) { S.arms[s][0] = lerp(S.arms[s][0], S.arms[s][0] * 0.5 + 0.55, aw); S.arms[s][1] += 0.35 * aw; } S.lean -= 0.05 * aw; }
      }
      // mood: posture, head carriage, shoulders and arms, fists (docs/ACTIONS.md)
      if (moodEvs.length) {
        const mv = moodVec(t);
        S.lean += mv.lean; S.bend = (S.bend || 0) + mv.bend; S.neck += mv.neck; S.head += mv.head; S.twist += mv.twist;
        S.chest = (S.chest || 1) * (1 + mv.chest); S.ry += mv.drop * L;
        for (const s of SIDES) if (mv.fist > 0.5 && S.hands[s] === 'relaxed') S.hands[s] = 'fist';
      }
      const aimS = { near: false, far: false }, gestReach = [];
      // ---- arms layers ----
      const add = { lean: 0, head: 0, twist: 0, h: 0, neck: 0, bend: 0, turn: 0 };
      let heldInfo = null;
      const handsOut = Object.assign({}, S.hands);
      const armStretch = { near: 1, far: 1 };
      // hold layer
      let holdArm = null;
      for (const h of holds) {
        if (h.t0 > t || t >= h.end + 0.2) continue;
        const v = keyVals(h.keys, t - h.t0, h.ev.args, null);
        const fade = t >= h.end ? 1 - smooth((t - h.end) / 0.2) : 1;
        const w = smooth((t - h.t0) / (h.keys[0].dur || 0.3)) * fade;
        if (v.N) S.arms.near = S.arms.near.map((a, j) => lerp(a, v.N[j], w));
        if (v.F) S.arms.far = S.arms.far.map((a, j) => lerp(a, v.F[j], w));
        for (const f of Object.keys(add)) add[f] += (v.add[f] || 0) * w;
        if (v.hands && w > 0.5) { handsOut.near = v.hands[0]; if (v.F) handsOut.far = v.hands[1]; }
        const wt = clamp(+h.ev.args.weight || 0, 0, 1);   // a heavy load (docs/PROPS.md): lean back against it, knees give
        if (wt > 0 && t < h.end) { add.lean -= 0.3 * wt * w; add.h -= 0.05 * L * wt * w; }
        if (t >= h.t0 + (+h.ev.args.quick ? 0 : 0.6 * h.dur) && t < h.end + 0.1) heldInfo = { prop: h.prop, how: h.how, side: 'near' };
        if (t < h.end) holdArm = h.how === 'front' ? null : 'near';
      }
      // gestures
      const solveNow = () => CharRig.solve(ch, poseOf(Object.assign({}, st, { S })));
      for (const g of gestures) {
        if (g.t0 > t || t >= Math.min(g.end, g.cut)) continue;
        const args = g.ev.args, tau = t - g.t0;
        let main = args.hand === 'far' ? 'far' : 'near';
        if (holdArm && g.ev.name !== 'drop' && g.ev.name !== 'cheer' && args.hand !== 'both') main = holdArm === 'near' ? 'far' : 'near';
        const otherA = main === 'near' ? 'far' : 'near';
        // aim the main arm at args.at
        let aimFn = null;
        if (args.at !== undefined) {
          const sol = solveNow();
          const sh = sol.joints['shoulder.' + main];
          const tp = resolvePlace(args.at, t);
          let th = 0;
          if (tp) {
            const dx = (tp[0] - st.x) * st.facing / k - sh[0], dy = (st.y - tp[1]) / k - sh[1];
            th = Math.atan2(dy, dx);
          }
          const ta = -S.lean;
          aimFn = q => { const e = (q.elbow || 0) * D2R; return [wrapA(th - ta + Math.PI / 2 - e / 2 + (q.off || 0) * D2R), e, 0]; };
          aimFn.lean = clamp(-th * 0.9, -0.25, 0.7) + 0.12;
          if (Math.abs(wrapA(th)) > Math.PI / 2) aimFn.lean = 0;
        }
        if (g.clip) for (const r of reachKeys(g.clip.c, clipLoopT(g.clip, tau / TS, +g.ev.args.times || 1)) || []) gestReach.push({ side: r.side === 'near' ? main : otherA, spec: r.spec, w: r.w });
        if (g.clip && g.clip.c.aim) for (const sd of SIDES) if (g.clip.c.aim[sd].some(q => tau / TS >= q[0] && tau / TS <= q[1])) aimS[sd === 'near' ? main : otherA] = true;
        const v = g.clip ? clipArmVals(g.clip, tau / TS, +g.ev.args.times || 1) : keyVals(g.keys, tau, args, aimFn || (() => [0.3, 0.3, 0]));
        const kEnd = g.kdur + g.hold;
        let w = g.clip ? smooth(tau / Math.max(0.01, g.clip.c.blendIn === undefined ? 0.12 : g.clip.c.blendIn))
          : g.keys[0] ? ease(g.keys[0].ease === 'back' ? 'out' : g.keys[0].ease, tau / g.keys[0].dur) : 1;
        if (tau > kEnd) w *= 1 - smooth((tau - kEnd) / g.rel);
        const both = args.hand === 'both' && !g.clip;
        const apply = (side, vals) => { if (vals) S.arms[side] = S.arms[side].map((a, j) => lerp(a, vals[j], w)); };
        apply(main, v.N);
        apply(otherA, both ? v.N : v.F);
        // oscillations ride on top (scaled by the envelope)
        for (const wg of v.wig || []) {
          const side = wg.arm === 'N' || both ? main : otherA;
          const o = wg.amp * D2R * Math.sin(TAU * (wg.hz * tau + (wg.ph || 0))) * w;
          S.arms[side][wg.j] += o;
          if (both && wg.arm === 'N') S.arms[otherA][wg.j] += o;
        }
        if (v.bob) add.h += v.bob[0] * L * Math.abs(Math.sin(Math.PI * v.bob[1] * tau)) * w;
        for (const f of Object.keys(add)) add[f] += (v.add[f] || 0) * w;
        if (v.hands && w > 0.5) { handsOut[main] = v.hands[0]; if (v.hands[1] && (v.F || both)) handsOut[otherA] = both ? v.hands[0] : v.hands[1]; }
        if (v.stretch > 1) armStretch[main] = lerp(1, v.stretch, w);
      }
      S.lean += add.lean; S.head += add.head; S.twist += add.twist; S.ry += add.h; S.neck += add.neck; S.bend = (S.bend || 0) + add.bend; S.faceTurn = (S.faceTurn || 0) + add.turn;
      S.aim = { near: aimS.near || !!(st.aim && st.aim.near), far: aimS.far || !!(st.aim && st.aim.far) };
      // hands that a key sends to a landmark land on it on THIS body in THIS pose (posture, mood, lean)
      const rk = (st.reach || []).concat(gestReach), contacts = [];
      for (const sd of SIDES) {
        let best = null;
        for (const r of rk) if (r.side === sd && (!best || r.w > best.w)) best = r;
        if (!best || best.w <= 0) continue;
        if (best.spec.who) contacts.push({ side: sd, at: best.spec.at.slice(8), dx: +best.spec.dx || 0, dy: +best.spec.dy || 0, who: best.spec.who, w: best.w });
        const tg = targetOf(S, sd, best.spec), a = tg && armTo(S, sd, tg);
        if (a) { S.arms[sd][0] = lerp(S.arms[sd][0], a[0], best.w); S.arms[sd][1] = lerp(S.arms[sd][1], a[1], best.w); }
      }
      // arm offsets that would pull a hand off its landmark apply only to free arms: the belly clearance
      // and the mood's shoulders and elbows
      { const mv = moodEvs.length ? moodVec(t) : null;
        for (const s of SIDES) if (!S.aim[s]) { S.arms[s][0] += ARMBIAS + (mv ? mv.shoulder : 0); S.arms[s][1] += mv ? mv.elbow : 0; } }
      S.hands = handsOut;
      S.armStretch = armStretch;
      // speech: a small nod on stressed syllables, beat gestures of the free near hand (beats=1)
      const spk = speechAt(t);
      if (spk) {
        const mvS = moodEvs.length ? moodVec(t) : { tempo: 0 };
        S.head += 0.1 * spk.stress * (1 - 0.5 * clamp(mvS.tempo, 0, 1)) + 0.05 * spk.emph; S.neck += 0.04 * spk.stress; S.lean += 0.02 * spk.stress;
        if (spk.beats && !aimS.near && !gestures.some(g => g.t0 <= t && t < Math.min(g.end, g.cut))) { S.arms.near[0] += 0.22 * spk.stress + 0.1; S.arms.near[1] += 0.35 * spk.stress + 0.4; S.hands.near = 'open'; }
      }
      // ---- look ----
      const lk = lookAt(t, st, S);
      S.neck += -0.22 * lk.th; S.head += -0.4 * lk.th; S.lean += -0.04 * Math.max(0, lk.th);
      for (const e of nods) {
        const tau = t - e.t;
        if (tau >= 0 && tau < 0.75) S.head += 0.2 * Math.sin(TAU * 2.67 * tau) * Math.sin(Math.PI * tau / 0.75) + 0.06 * Math.sin(Math.PI * tau / 0.75);
      }
      return { st, S, held: heldInfo, eye: lk.eye, lookTh: lk.th, contacts };
    }

    // look value at t: pitch th (+ up) and eye offset; blends over 0.3 s from the previous look
    function lookTarget(e, t, st, S) {
      const at = e.args.at;
      if (at === 'up') return { th: 0.75, back: 0 };
      if (at === 'down') return { th: -0.7, back: 0 };
      if (at === 'front' || at === undefined) return { th: 0, back: 0 };
      if (at === 'back') return { th: 0, back: 1 };
      if (at === 'left' || at === 'right') return { th: 0, back: (at === 'left' ? -1 : 1) === st.facing ? 0 : 1 };
      const tp = resolvePlace(at, t);
      if (!tp) return { th: 0, back: 0 };
      const hx = st.x, hy = st.y - k * (S.ry + pr.torso + pr.neck + 0.5);
      const dx = (tp[0] - hx) * st.facing, dy = hy - tp[1];
      return { th: clamp(Math.atan2(dy, Math.abs(dx) + 0.3 * k), -0.4, 0.55), back: dx < -0.4 * k ? 1 : 0 };   // a person is looked at in the eyes; the pitch stays modest
    }
    function lookAt(t, st, S) {
      let i = -1;
      for (let j = 0; j < looks.length; j++) if (looks[j].t <= t) i = j;
      const val = j => {
        if (j < 0) return { th: 0, back: 0 };
        const cur = lookTarget(looks[j], t, st, S);
        const u = (t - looks[j].t) / 0.3;
        if (u >= 1) return cur;
        const prev = val(j - 1);
        const e = smooth(u);
        return { th: lerp(prev.th, cur.th, e), back: lerp(prev.back, cur.back, e) };
      };
      const v = val(i);
      const ex = lerp(0.6, -1, v.back), ey = clamp(v.th / 0.7, -1, 1) * 0.9;
      return { th: v.th * (1 - 0.6 * v.back), eye: [ex, ey] };
    }

    function blinkAmount(t) {
      let b = 0;
      const shape = d => d < 0 ? 0 : d < 0.06 ? d / 0.06 : d < 0.17 ? 1 - (d - 0.06) / 0.11 : 0;
      const P = 2.9, j0 = Math.floor(t / P);
      for (let j = j0 - 1; j <= j0 + 1; j++) {
        const bt = j * P + 0.4 + hash(j) * 1.7;
        b = Math.max(b, shape(t - bt));
        if (hash(j + 91) > 0.78) b = Math.max(b, shape(t - bt - 0.24));
      }
      for (const bt of blinkAt) b = Math.max(b, shape(t - bt));
      return b;
    }
    function dartAt(t) {
      const P = 1.3, j = Math.floor((t + 0.37) / P);
      const v = q => [(hash(q * 3.1) - 0.5) * 0.5, (hash(q * 5.7 + 2) - 0.5) * 0.4];
      const a = v(j - 1), b = v(j), u = smooth(((t + 0.37) - j * P) / 0.07);
      return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
    }

    // ---------------------------------------------------------------- simulation: springs
    // Spring chains (hair tufts, scarf, backpack, hem) driven by the real motion of their bone, with
    // gravity, air drag and wind; a light spring overlap on the arms, the head and the torso (bend
    // and squash, keeping area). Fixed steps of 1/60 s (4 substeps each) from t = 0, with cached
    // snapshots every 0.5 s: sample(t) gives the same frame in any order.
    const chainSpecs = skin.chains || {};
    const chainNames = Object.keys(chainSpecs);
    const stiffOf = s => s.stiff === undefined ? 0.3 : s.stiff;
    const simNames = chainNames.filter(n => chainSpecs[n] && stiffOf(chainSpecs[n]) < 1 && Array.isArray(chainSpecs[n].seg) && chainSpecs[n].seg.length);
    const SPR = Object.assign({ arms: 1, head: 1, torso: 1 + 1.5 * Math.max(0, MO.weight - 0.3) }, skin.springs || {});
    const SDT = 1 / 60, SUB = 4, SNAP = 30, GRAV = 16, WINDK = 2;
    const useSim = simNames.length > 0 || SPR.arms > 0 || SPR.head > 0 || SPR.torso > 0;
    // wind: env.wind(t) -> amount (+ blows toward +x of the set; 1 = a strong gust) or [vx, vy] in head units/s
    const windOf = t => {
      let w = 0;
      try { w = typeof env.wind === 'function' ? env.wind(t) : (env.wind || 0); } catch (e) { w = 0; }
      if (Array.isArray(w)) return [+w[0] || 0, +w[1] || 0];
      w = +w || 0;
      return [w * 8, Math.abs(w) * 1.6];
    };
    // angle springs: armN shoulder, elbow, armF shoulder, elbow, head, torso bend, torso stretch
    const AHZ = [2.8, 3.2, 2.8, 3.2, 3.4, 3.2, 3.6, 1.8], AZ = [0.4, 0.38, 0.4, 0.38, 0.42, 0.36, 0.32, 0.28];
    const ALIM = [0.7, 0.7, 0.7, 0.7, 0.4, 0.35, 0.14, 0.6];
    function simInputs(n) {
      const t = n * SDT, c = core(t), st = c.st, S = c.S;
      const sol = CharRig.solve(ch, poseOf(Object.assign({}, st, { S })));
      const f = st.facing, W = p => [st.x / k + f * p[0], -st.y / k + p[1]];
      const wa = a => f > 0 ? a : Math.PI - a;
      const chains = {};
      for (const name of simNames) {
        const spec = chainSpecs[name], b = CharRig.chainBase(ch, sol, spec), curl = (spec.curl || 0) * D2R;
        chains[name] = { p: W(b.p), a: spec.seg.map((_, i) => wa(b.angle + curl * i)) };
      }
      return { t, f, cx: st.x / k, pel: W(sol.joints.root), chains, lean: S.lean, fling: st.fling || 1,
        tgt: [S.arms.near[0], S.arms.near[1], S.arms.far[0], S.arms.far[1], S.head, 0, 0, 0] };
    }
    // each segment is a damped pendulum hanging from the end of the one before: a spring pulls it to
    // its rest direction (in the bone's frame), gravity, wind and air drag push it, and the pivot's
    // acceleration swings it (inertia). Gravity counts relative to the rest shape, so a chain sits in
    // its drawn shape when the body stands still upright, and hangs, swings and sags as it moves.
    function chainsStep(st, I0, I1, s, h, t) {
      const wind = windOf(t);
      for (const name of simNames) {
        const spec = chainSpecs[name], C = st.ch[name], A0 = I0.chains[name], A1 = I1.chains[name];
        const stiff = stiffOf(spec), K0 = Math.pow(TAU * (spec.freq || (0.8 + 4 * stiff)), 2);
        const grav = GRAV * (spec.gravity === undefined ? 1 : spec.gravity);
        const drag = spec.drag === undefined ? 4 + 2 * stiff + 0.25 * Math.sqrt(K0) : spec.drag, wk = spec.wind === undefined ? 1 : spec.wind;
        const inert = (spec.inertia === undefined ? 0.6 : spec.inertia) * lerp(I0.fling, I1.fling, s), lp = Math.min(1, h * 25);
        const lim = (spec.limit === undefined ? 120 : spec.limit) * D2R;
        const n = spec.seg.length;
        const seed = hash(name.length * 7.3 + name.charCodeAt(0) + name.charCodeAt(n > 1 ? 1 : 0) * 0.37);
        let px = lerp(A0.p[0], A1.p[0], s), py = lerp(A0.p[1], A1.p[1], s), rPrev = 0;
        for (let i = 0; i < n; i++) {
          const l = spec.seg[i], th = C.th[i], r = A0.a[i] + wrapA(A1.a[i] - A0.a[i]) * s;
          const vx = (px - C.pp[i][0]) / h, vy = (py - C.pp[i][1]) / h;
          // pivot acceleration, smoothed (the anchor moves in 1/60 s steps)
          const pa = C.pa[i];
          pa[0] += (clamp((vx - C.pv[i][0]) / h, -400, 400) - pa[0]) * lp; pa[1] += (clamp((vy - C.pv[i][1]) / h, -400, 400) - pa[1]) * lp;
          const ax = pa[0] * inert, ay = pa[1] * inert;
          C.pp[i] = [px, py]; C.pv[i] = [vx, vy];
          const nx = -Math.sin(th), ny = Math.cos(th);
          const turb = 1 + 0.35 * Math.sin(TAU * (1.7 * t + 0.31 * i + seed)) + 0.2 * Math.sin(TAU * (3.9 * t + 0.53 * i + 2 * seed));
          const wx = wind[0] * wk * turb, wy = wind[1] * wk * (0.6 + 0.6 * Math.sin(TAU * (2.3 * t + 0.4 * i + seed)));
          const tvx = vx + C.om[i] * l * nx, tvy = vy + C.om[i] * l * ny;
          const fx = WINDK * wx - drag * tvx - ax, fy = WINDK * wy - drag * tvy - ay - grav;
          const Ki = K0 * (1 - 0.35 * i / n);
          // the spring pulls mostly toward the parent segment's direction plus the rest bend (so the
          // chain bends as one piece), a little toward the bone's rest; bending is damped
          const rel = i > 0 ? wrapA(C.th[i - 1] + (r - rPrev) - th) : wrapA(r - th);
          const tgt = i > 0 ? 0.7 * rel + 0.3 * wrapA(r - th) : rel;
          const bendD = i > 0 ? 6 * (C.om[i] - C.om[i - 1]) : 0;
          const alpha = (fx * nx + fy * ny + grav * Math.cos(r)) / l + Ki * tgt - bendD;
          C.om[i] = clamp(C.om[i] + alpha * h, -25, 25);
          rPrev = r;
          let nt = th + C.om[i] * h;
          const d = wrapA(nt - r);
          if (Math.abs(d) > lim) { nt = r + Math.sign(d) * lim; C.om[i] *= -0.2; }
          C.th[i] = nt;
          px += Math.cos(nt) * l; py += Math.sin(nt) * l;
        }
      }
    }
    function angStep(st, I0, I1, s, h, acc) {
      const aF = acc[0] * I1.f, aY = acc[1];
      const vF = (I1.pel[0] - I0.pel[0]) / SDT * I1.f, wnd = windOf(I1.t)[0] * I1.f;
      for (let j = 0; j < 8; j++) {
        const x = st.ang[j], T = lerp(I0.tgt[j], I1.tgt[j], s), w = TAU * AHZ[j];
        let c = 0;
        if (j === 0 || j === 2) { const ph = I1.lean + x[0]; c = -1.6 * (aY * Math.sin(ph) + aF * Math.cos(ph)); }
        else if (j === 1 || j === 3) { const ph = I1.lean + st.ang[j - 1][0] + x[0]; c = -1.0 * (aY * Math.sin(ph) + aF * Math.cos(ph)) - 0.3 * st.ang[j - 1][1] * w; }
        else if (j === 4) { const ph = x[0]; c = 0.5 * (aY * Math.sin(ph) - aF * Math.cos(ph)) + 0.25 * aY; }
        else if (j === 5) c = -0.8 * aF;
        else if (j === 6) c = -0.5 * aY;
        else c = -1.2 * aF - 1.2 * vF + 0.35 * wnd;   // skirt hem: lags the motion, blown by the wind
        x[1] += (-w * w * (x[0] - T) - 2 * AZ[j] * w * x[1] + c) * h;
        x[0] += x[1] * h;
        const d = x[0] - T;
        if (Math.abs(d) > ALIM[j]) { x[0] = T + Math.sign(d) * ALIM[j]; x[1] *= 0.5; }
      }
    }
    const cloneSim = s => ({ n: s.n, I: s.I, pelPrev: s.pelPrev, ang: s.ang.map(a => a.slice()),
      ch: Object.fromEntries(Object.keys(s.ch).map(nm => { const c = s.ch[nm]; return [nm, { th: c.th.slice(), om: c.om.slice(), pp: c.pp.map(q => q.slice()), pv: c.pv.map(q => q.slice()), pa: c.pa.map(q => q.slice()) }]; })) });
    function simInit() {
      const I = simInputs(0);
      const st = { n: 0, I, pelPrev: I.pel, ang: I.tgt.map(x => [x, 0]), ch: {} };
      for (const name of simNames) {
        const spec = chainSpecs[name], Ac = I.chains[name], p = [Ac.p.slice()];
        for (let i = 0; i < spec.seg.length; i++) p.push([p[i][0] + Math.cos(Ac.a[i]) * spec.seg[i], p[i][1] + Math.sin(Ac.a[i]) * spec.seg[i]]);
        st.ch[name] = { th: Ac.a.slice(), om: Ac.a.map(() => 0), pp: p.slice(0, -1), pv: Ac.a.map(() => [0, 0]), pa: Ac.a.map(() => [0, 0]) };
      }
      // pre-roll 1.5 s holding the first pose, so chains have settled under gravity when the film starts
      for (let j = 0; j < 180; j++) chainsStep(st, I, I, 1, 1 / 120, 0);
      return st;
    }
    function simStep(s0) {
      const st = cloneSim(s0), I0 = s0.I, I1 = simInputs(s0.n + 1);
      if (I1.f !== I0.f) for (const name of simNames) {   // turned round: mirror the chains
        const c = st.ch[name];
        for (let i = 0; i < c.th.length; i++) { c.th[i] = wrapA(Math.PI - c.th[i]); c.om[i] *= -1; c.pp[i][0] = 2 * I1.cx - c.pp[i][0]; c.pv[i][0] *= -1; c.pa[i][0] *= -1; }
      }
      const acc = [0, 1].map(j => clamp((I1.pel[j] - 2 * I0.pel[j] + s0.pelPrev[j]) / (SDT * SDT), -120, 120));
      const h = SDT / SUB;
      for (let j = 0; j < SUB; j++) { const s = (j + 1) / SUB; chainsStep(st, I0, I1, s, h, I0.t + s * SDT); angStep(st, I0, I1, s, h, acc); }
      st.n = s0.n + 1; st.I = I1; st.pelPrev = I0.pel;
      return st;
    }
    const snaps = new Map();
    let recent = [];
    function simAt(n) {
      n = Math.max(0, n);
      for (const r of recent) if (r.n === n) return r;
      let s = null;
      for (const r of recent) if (r.n < n && (!s || r.n > s.n)) s = r;
      let m = Math.floor(n / SNAP) * SNAP;
      while (m > 0 && !snaps.has(m)) m -= SNAP;
      if (!snaps.has(0)) snaps.set(0, simInit());
      if (!s || snaps.get(m).n > s.n) s = snaps.get(m);
      while (s.n < n) { s = simStep(s); if (s.n % SNAP === 0 && !snaps.has(s.n)) snaps.set(s.n, s); }
      recent = [s].concat(recent.filter(r => r !== s)).slice(0, 3);
      return s;
    }
    // what the springs add at time t: angle offsets and chain point positions (world)
    function simOffsets(t, facing) {
      const x = Math.max(0, t) / SDT, n = Math.floor(x), u = x - n;
      const A0 = simAt(n), B0 = simAt(n + 1);
      const off = A0.ang.map((a, j) => lerp(a[0] - A0.I.tgt[j], B0.ang[j][0] - B0.I.tgt[j], u));
      const okA = A0.I.f === facing, okB = B0.I.f === facing;
      const pts = {};
      for (const name of simNames) {
        const pa = A0.ch[name].th, pb = B0.ch[name].th;
        pts[name] = okA && okB ? pa.map((q, i) => q + wrapA(pb[i] - q) * u) : (okB ? pb : pa);
      }
      return { off, pts };
    }

    // hands keep out of the head and the torso (built bodies): a hand that would sit inside the head
    // circle or inside the chest or belly is moved to just outside it, and the arm follows by IK
    // a walking stick (parts.holdNear with use: 'cane'): planted beside the near foot when standing or
    // walking (the hand goes to its top by IK, the tip steps with the foot); carried in the hand in
    // runs, jumps, gestures and sitting. The switch eases over about 0.2 s.
    const CANE = (() => { const e = [].concat((ch.parts || {}).holdNear || []).find(q => q && q.use === 'cane'); if (!e) return null;
      let len = +e.length; if (!(len > 0)) { let m = 0; try { for (const s of CharRig.parsePath(e.d || '')) for (const p of s.slice(1)) if (Array.isArray(p)) m = Math.min(m, p[1]); } catch (er) { m = -1; } len = -m || 1; }
      return { len }; })();
    function caneCond(t) {
      const st = bodyAt(t);
      if (!st || st.airborne || st.gaitKind === 'run' || (st.kind === 'clip') || st.S.ry < A + 0.8 * L) return 0;
      for (const g of gestures) if (g.t0 - 0.15 <= t && t < Math.min(g.end, g.cut)) return 0;
      for (const h of holds) if (h.t0 <= t && t < h.end) return 0;
      return 1;
    }
    function caneAt(t, st, S) {
      const w = (caneCond(t - 0.2) + caneCond(t - 0.1) + caneCond(t) + caneCond(t + 0.1) + caneCond(t + 0.2)) / 5;
      if (w <= 0) return null;
      const pose = poseOf(Object.assign({}, st, { S })), f = pose.legs.near.foot;
      const lift = Math.max(0, f[1] - pr.ankleHeight - 0.01);
      const tip = [f[0] + 0.3 * L, Math.min(0.6 * lift, 0.3 * L)];
      const wristT = [tip[0] - 0.05 * CANE.len, tip[1] + CANE.len + 0.08];
      const a = armTo(S, 'near', wristT), e = smooth(w);
      if (a) { S.arms.near[0] = lerp(S.arms.near[0], a[0], e); S.arms.near[1] = lerp(S.arms.near[1], a[1], e); S.arms.near[2] = lerp(S.arms.near[2], -0.15, e); }
      if (S.hands.near === 'relaxed') S.hands.near = 'grip';
      return w > 0.5 ? { tip } : null;
    }
    function clearArms(st, S) {
      const B = ch.body, hr = Math.max(0.05, (pr.hand || 0.25) * 0.35);
      for (const side of SIDES) {
        const pose = poseOf(Object.assign({}, st, { S })), sol = CharRig.solve(ch, pose), J = sol.joints;
        const sh = J['shoulder.' + side], wr = J['wrist.' + side], ta = sol.angles.torso;
        let tgt = null;
        const hc = add2(J.headBase, rot2([-0.02, 0.52], sol.angles.head)), R = 0.56 * Math.max(0.8, B.b.headWidth) + hr;
        const dh = [wr[0] - hc[0], wr[1] - hc[1]], dl = Math.hypot(dh[0], dh[1]);
        if (dl < R) {
          // out to the head circle, turning toward the front if the arm cannot reach straight out
          const a0 = Math.atan2(dh[1], dh[0]), fwd = sol.angles.head, reach = 0.97 * (pr.upperArm + pr.foreArm);
          for (let j = 0; j <= 12; j++) {
            const a = a0 + wrapA(fwd - a0) * j / 12, c = [hc[0] + Math.cos(a) * R, hc[1] + Math.sin(a) * R];
            tgt = c;
            if (Math.hypot(c[0] - sh[0], c[1] - sh[1]) < reach) break;
          }
          // arms too short to clear the head (a toddler): wave low, the hand out in front of the chest
          if (Math.hypot(tgt[0] - sh[0], tgt[1] - sh[1]) >= reach) { const o = rot2([reach, -0.1 * reach], ta); tgt = [sh[0] + o[0], sh[1] + o[1]]; }
        }
        else {
          const q = rot2([wr[0] - J.root[0], wr[1] - J.root[1]], -ta), y = q[1];
          if (y > 0.22 * pr.torso && y < pr.torso * 0.95) {   // chest and belly; hands may hang at the hips
            const p = B.profile(y);
            const mid = p.front - 0.45 * (p.front - p.back);   // the hand may lie over the front of the belly, not deep in it
            if (q[0] < mid && q[0] > p.back + 0.4 * (p.front - p.back)) {
              // just in front of the body at this height, or lower down the front if the arm is too short
              const reach = 0.97 * (pr.upperArm + pr.foreArm);
              // the lowest point in front of the body's middle that the hand can reach: the arm hangs as
              // low as it can over the belly instead of sinking into it
              for (let j = 0; j < 30; j++) {
                const yy = -0.4 * pr.torso + j * 0.0455 * pr.torso;
                const pp = B.profile(Math.max(0, yy)), pf = yy > 0 ? pp.front - 0.45 * (pp.front - pp.back) + hr : Math.max(q[0], pp.front * 0.6);
                const o = rot2([pf, yy], ta), c = [J.root[0] + o[0], J.root[1] + o[1]];
                if (Math.hypot(c[0] - sh[0], c[1] - sh[1]) < reach) { tgt = c; break; }
              }
              if (!tgt) { const o2 = rot2([reach, -0.15 * reach], ta); tgt = [sh[0] + o2[0], sh[1] + o2[1]]; }   // arms too short: held out in front
            }
          }
        }
        if (!tgt || (S.aim && S.aim[side])) continue;   // a hand sent to a landmark on purpose stays there
        let best = null;
        for (const sd of [-1, 1]) {
          const r = CharRig.ik2(sh, tgt, pr.upperArm, pr.foreArm, sd);
          const ua = Math.atan2(r.mid[1] - sh[1], r.mid[0] - sh[0]), fa = Math.atan2(r.end[1] - r.mid[1], r.end[0] - r.mid[0]);
          const el = wrapA(fa - ua);
          if (el >= -1e-6 && (!best || sd < 0)) best = [wrapA(ua - ta + Math.PI / 2), el];
        }
        if (best) { const a = S.arms[side]; a[0] = a[0] + wrapA(best[0] - a[0]); a[1] = best[1]; }
      }
    }
    const rot2 = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
    // how far forward a relaxed arm must hang to clear the chest and belly (built bodies), found once
    const ARMBIAS = (() => {
      if (!ch.body) return 0;
      const B = ch.body, S0 = resolveKey(STAND, baseS(), {});
      for (let d = 0; d <= 1.2; d += 0.04) {
        const S = cloneS(S0); for (const s of SIDES) S.arms[s][0] += d;
        const sol = CharRig.solve(ch, poseOf({ S, x: 0, y: 0, facing: 1 })), J = sol.joints, ta = sol.angles.torso;
        let inside = false;
        for (const s of SIDES) {
          const w = J['wrist.' + s], q = rot2([w[0] - J.root[0], w[1] - J.root[1]], -ta);
          if (q[1] > 0.22 * pr.torso && q[1] < 0.95 * pr.torso) { const p = B.profile(q[1]); if (q[0] < p.front - 0.45 * (p.front - p.back) && q[0] > p.back + 0.4 * (p.front - p.back)) inside = true; }
        }
        if (!inside) return d;
      }
      return 0;
    })();
    const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
    function sample(t) {
      t = Number(t);
      if (!isFinite(t)) t = 0;
      const c = core(t);
      const st = c.st, S = c.S;
      const sim = useSim ? simOffsets(t, st.facing) : null;
      if (sim) {
        const o = sim.off, ka = SPR.arms, kh = SPR.head, kt = SPR.torso;
        const kn = ka * (S.aim && S.aim.near ? 0.25 : 1), kf = ka * (S.aim && S.aim.far ? 0.25 : 1);   // a hand on a landmark barely wobbles
        S.arms.near[0] += o[0] * kn; S.arms.near[1] += o[1] * kn; S.arms.far[0] += o[2] * kf; S.arms.far[1] += o[3] * kf;
        S.head += o[4] * kh; S.bend = (S.bend || 0) + o[5] * kt; S.chest = (S.chest || 1) * (1 + o[6] * kt);
      }
      if (ch.body) clearArms(st, S);
      const cane = CANE ? caneAt(t, st, S) : null;
      const pose = poseOf(Object.assign({}, st, { S }));
      if (sim && sim.off[7]) pose.skirtSway = sim.off[7];
      if (cane) pose.cane = cane;
      const mood = MOODS[moodAt(t)] || MOODS.neutral;
      const blink = blinkAmount(t);
      const dart = dartAt(t);
      const eye = [clamp(c.eye[0] + dart[0], -1.2, 1.2), clamp(c.eye[1] + dart[1], -1.2, 1.2)];
      // a hand that holds an object (parts.holdNear / holdFar) grips it unless an action shapes the hand
      const cp = ch.parts || {};
      if (cp.holdNear && S.hands.near === 'relaxed') S.hands.near = 'grip';
      if (cp.holdFar && S.hands.far === 'relaxed') S.hands.far = 'grip';
      const sp = speechAt(t), fp = faceAt(t);
      const swaps = { hand: S.hands.near, handFar: S.hands.far, mouth: sp ? (sp.u < 0.5 ? sp.a : sp.b) : (S.mouth || mood.mouth), eye: mood.eye, brow: mood.brow };
      pose.face = { blink, eye, mouth: swaps.mouth, turn: S.faceTurn || 0, browH: fp.browH, browLift: sp ? sp.emph : 0, browA: fp.browA, lid: fp.lid, smile: fp.smile, speaking: !!sp };
      if (sp) Object.assign(pose.face, { open: sp.open, wide: sp.wide, round: sp.round, teeth: sp.teeth, tongue: sp.tongue, viseme: [sp.a, sp.b, sp.u] });
      pose.swaps = { hand: { near: S.hands.near, far: S.hands.far }, mouth: swaps.mouth, eye: swaps.eye, brow: swaps.brow };
      pose.squash = S.squash.slice();
      const chains = {};
      if (sim && simNames.length) {
        const sol = CharRig.solve(ch, pose);
        for (const name of simNames) {
          const spec = chainSpecs[name], b = CharRig.chainBase(ch, sol, spec), curl = (spec.curl || 0) * D2R, th = sim.pts[name];
          chains[name] = spec.seg.map((_, i) => wrapA((st.facing > 0 ? th[i] : Math.PI - th[i]) - (b.angle + curl * i)));
        }
      }
      pose.secondary = { chains, hair: 0.1, cloth: 0.05 };
      let held = null;
      if (c.held) {
        const sol = CharRig.solve(ch, pose);
        const side = c.held.side, wr = sol.joints['wrist.' + side], ha = sol.angles['hand.' + side];
        const g = skin.grip || [0.1, 0];
        const gp = [wr[0] + g[0] * Math.cos(ha) - g[1] * Math.sin(ha), wr[1] + g[0] * Math.sin(ha) + g[1] * Math.cos(ha)];
        const sp = toStage(st, gp);
        const hd = Math.atan2(-Math.sin(ha), st.facing * Math.cos(ha)) / D2R;     // stage degrees, y down
        // angle: rotation for a prop drawn upright with its grip at the origin; it tilts a little
        // with the hand instead of spinning with it
        const rest = { side: 90, up: -90 }[c.held.how];
        const tilt = rest === undefined ? 0 : clamp(0.25 * wrapA((hd - rest) * D2R) / D2R, -30, 30);
        held = { prop: c.held.prop, how: c.held.how, joint: sp, angle: tilt, handAngle: hd, hand: side, flip: st.facing };
      }
      return { x: st.x, y: st.y, facing: st.facing, pose, swaps, held, scale: k, height: H * k, offstage: !!st.offstage, mood: moodAt(t), airborne: !!st.airborne,
        contacts: c.contacts && c.contacts.length ? c.contacts : null };
    }

    return {
      // for tests and tools: where an action's hand targets are (rig coords) and when (s from its start)
      // where a landmark is on the body at time t (rig coords, root at x = 0), as hand targets see it
      _actionClip(name, args) { const sp = specOf(name); return sp && sp.user ? actionClip(sp.user, Object.assign({}, sp.args, args || {})) : null; },
      landmarkAt(t, side, spec) { const c = core(t); return targetOf(c.S, side, spec); },
      // a landmark of this body in a sample, in stage px (for the partner's hands: docs/PAIRS.md)
      pointOf(smp, name, side) {
        const sol = CharRig.solve(ch, smp.pose), p = lmOn(sol, side || 'near', name, 0, 0);
        const W = q => [smp.x + smp.facing * smp.scale * q[0], smp.y - smp.scale * q[1]];
        return p ? (Array.isArray(p[0]) ? p.map(W) : W(p)) : null;
      },
      // put this side's wrist on a stage point (weight w), changing only that arm of the sample's pose;
      // true when the point is within reach
      reach(smp, side, P, w) {
        const pose = smp.pose, sol = CharRig.solve(ch, pose), sh = sol.joints['shoulder.' + side], ta = sol.angles.torso;
        const tg = [(P[0] - smp.x) / (smp.facing * smp.scale), (smp.y - P[1]) / smp.scale];
        const reach = 0.995 * (pr.upperArm + pr.foreArm), d = Math.hypot(tg[0] - sh[0], tg[1] - sh[1]);
        if (d > reach) { tg[0] = sh[0] + (tg[0] - sh[0]) * reach / d; tg[1] = sh[1] + (tg[1] - sh[1]) * reach / d; }
        let best = null;
        for (const sd of [-1, 1]) {
          const r = CharRig.ik2(sh, tg, pr.upperArm, pr.foreArm, sd);
          const ua = Math.atan2(r.mid[1] - sh[1], r.mid[0] - sh[0]), fa = Math.atan2(r.end[1] - r.mid[1], r.end[0] - r.mid[0]), el = wrapA(fa - ua);
          if (el >= -1e-6 && (!best || sd < 0)) best = [wrapA(ua - ta + Math.PI / 2), el];
        }
        if (!best) return false;
        const a = pose.arms[side], u = clamp(w, 0, 1);
        a.shoulder = a.shoulder + wrapA(best[0] - a.shoulder) * u; a.elbow = a.elbow + wrapA(best[1] - a.elbow) * u;
        return d <= reach * 1.01;
      },
      actionTargets(name, args) {
        const sp = specOf(name);
        if (!sp || !sp.user) return [];
        const c = actionClip(sp.user, Object.assign({}, sp.args, args || {})), out = [];
        for (const q of c.keys) if (q._pts) for (const side of SIDES) if (q._pts[side]) out.push({ side, t: q.t * TS, target: q._pts[side], at: q['_tg' + side] });
        return out;
      },
      sample,
      end(i) { return endOf[i] !== undefined ? endOf[i] : (events && events[i] && isFinite(+events[i].t) ? +events[i].t : 0); },
      diagnostics,
      scale: k, height: H * k, timeScale: TS, armReach: (pr.upperArm + pr.foreArm) * k,
      duration: Math.max(0, ...Object.values(endOf).filter(isFinite)),
    };
  }

  function lev(a, b) {
    const m = a.length, n = b.length, d = [];
    for (let i = 0; i <= m; i++) d[i] = [i];
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }

  // SVG for one actor in its own space: origin = its feet (place it at sample.x, sample.y)
  function draw(skin, sample) {
    if (!sample || !sample.pose) return '';
    const ch = isSkin(skin) ? skin : CharRig.skinCharacter(skin || {});
    return CharRig.render(ch, sample.pose, { x: 0, y: 0, scale: sample.scale, facing: sample.facing, squash: sample.pose.squash, layers: sample._layers });
  }

  return { get actions() { return vocab(); }, compile, draw, moods: Object.keys(CharPoses.moods), specOf };
});

}).call(G);

// ---- src/script.js ----
(function (module, exports, require) {
// script.js - the char-lab film script language (STAGE.md section 4).
// UMD: window.CharScript in the browser, module.exports in Node. No dependencies.
//
//   CharScript.parse(text, opts?)      -> { film, sets, actors, puppets, props, tracks, statements, diagnostics }
//   CharScript.validate(parsed, lib)   -> extra diagnostics that need the library (sets, skins, puppets, props)
//   CharScript.timeline(parsed, endOf) -> resolves "+n" times with exact end times (the stage calls this)
//
// Every problem becomes a diagnostic { code, line, severity, message } whose message says what to
// write instead. parse() never throws.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.CharScript = factory(root);
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  const REQ = null;   // an argument default of null means "required"

  // Actor vocabulary used when CharPerform is not loaded (mirrors STAGE.md section 2).
  const STANDIN_ACTIONS = {
    walk: { channel: 'body', args: { to: REQ, speed: 1 }, moves: true, doc: 'walk to a place' },
    run: { channel: 'body', args: { to: REQ, speed: 1 }, moves: true, doc: 'run to a place' },
    sneak: { channel: 'body', args: { to: REQ }, moves: true, doc: 'tiptoe to a place' },
    jump: { channel: 'body', args: { to: REQ, height: 1 }, moves: true, doc: 'jump to a place' },
    turn: { channel: 'body', args: {}, moves: false, doc: 'turn around' },
    enter: { channel: 'body', args: { from: 'left' }, moves: true, doc: 'walk in from off screen' },
    stand: { channel: 'body', args: {}, moves: false, doc: 'stand still' },
    idle: { channel: 'body', args: {}, moves: false, doc: 'stand with small life' },
    kneel: { channel: 'body', args: {}, moves: false, doc: 'kneel' },
    crouch: { channel: 'body', args: {}, moves: false, doc: 'crouch' },
    recoil: { channel: 'body', args: {}, moves: false, doc: 'step back in fear' },
    sit: { channel: 'body', args: {}, moves: false, doc: 'sit on the ground' },
    wave: { channel: 'arms', args: { hand: 'near' }, moves: false, doc: 'wave' },
    point: { channel: 'arms', args: { at: REQ }, moves: false, doc: 'point at something' },
    reach: { channel: 'arms', args: { at: REQ }, moves: false, doc: 'reach toward something' },
    cheer: { channel: 'arms', args: {}, moves: false, doc: 'both arms up' },
    hold: { channel: 'arms', args: { prop: REQ, how: 'front' }, moves: false, doc: 'hold a prop: how=up|front|side' },
    drop: { channel: 'arms', args: {}, moves: false, doc: 'let go of the held prop' },
    face: { channel: 'face', args: { mood: 'neutral' }, moves: false, doc: 'mood=happy|scared|determined|surprised|sad|neutral' },
    look: { channel: 'look', args: { at: 'front' }, moves: false, doc: 'look at=<name>|up|down|front' },
    nod: { channel: 'look', args: {}, moves: false, doc: 'nod' },
  };

  const CAM = {
    pan: { channel: 'pos', args: { to: REQ, over: 1.5 }, doc: 'move the camera centre to x, an anchor or an actor' },
    follow: { channel: 'pos', args: { target: REQ, over: 0.8 }, doc: 'keep an actor or puppet centred until the next pan/cut' },
    cut: { channel: 'pos', args: { to: REQ, zoom: 0 }, doc: 'jump instantly (zoom=0 keeps the zoom)' },
    zoom: { channel: 'zoom', args: { to: REQ, over: 1 }, doc: 'zoom level, 1 = whole frame, 1.5 = closer' },
    shake: { channel: 'shake', args: { amount: 8, over: 0.6 }, doc: 'shake in px, dying away' },
    fade: { channel: 'fade', args: { dir: 'out', over: 0.6 }, doc: 'fade to black (out) or back (in)' },
    frame: { channel: 'frame', args: { on: REQ, top: 'head', bottom: 'thigh', x: 0.35, over: 1.2, pad: 0.1 }, doc: 'close-up on an actor (or two: on=Kai+Tess keeps both whole, heads and hands): the frame height runs from top to bottom (head|chin|chest|waist|hip|thigh|knee|feet) and the actor stands at x (0 = left edge, 1 = right edge of the frame); keeps tracking the actor until home()' },
    home: { channel: 'frame', args: { over: 1.2 }, doc: 'leave a frame() close-up: back to the pan/zoom/follow camera' },
  };
  const CAPTION = {
    show: { channel: 'text', args: { text: REQ, for: 3, at: 'bottom', by: '' }, doc: 'caption text; by=<actor> makes a speech bubble' },
    clear: { channel: 'text', args: {}, doc: 'remove the caption now' },
  };
  const CARD = {
    show: { channel: 'card', args: { text: REQ, for: 0, sub: '', fade: 0.7, bg: '' }, doc: 'full-frame card; for=0 = to the end; fade = seconds to fade in; bg = a colour, or none to show the scene' },
  };
  // the film clock: a beat grid that poses snap to, and freezes of the world (the set's sky can keep moving)
  const CLOCK = {
    tempo: { channel: 'tempo', args: { bpm: 120, div: 1, snap: 0.3, who: '' }, doc: 'from now on poses land on a beat grid (bpm, div = steps per beat, snap = share of a step spent moving); bpm=0 = smooth; who=<actor> for one actor only' },
    freeze: { channel: 'freeze', args: { for: 1 }, doc: 'stop the world for= seconds (actors, puppets, water); sets may keep the sky moving' },
  };
  // wind for the spring chains (hair, scarf, cloth); sets do not handle wind
  const WIND = {
    gust: { channel: 'gust', args: { amount: 1, over: 1.5, from: 'right' }, doc: 'a gust that rises fast and dies away over `over` s; amount 1 = strong; from = right | left' },
    blow: { channel: 'blow', args: { amount: 0.3, over: 1, from: 'right' }, doc: 'a steady wind from now on, reached over `over` s; amount 0 = calm' },
  };
  const LEVELS = ['head', 'chin', 'chest', 'waist', 'hip', 'thigh', 'knee', 'feet'];
  const ENUMS = { 'frame.top': LEVELS, 'frame.bottom': LEVELS, 'fade.dir': ['in', 'out'], 'show.at': ['bottom', 'top'], 'gust.from': ['left', 'right'], 'blow.from': ['left', 'right'] };
  const PLACE_KEYS = { to: 1, at: 1, from: 1, target: 1, by: 1, on: 1 };   // keys that accept names of places or things
  const LOOK_WORDS = ['up', 'down', 'front', 'back', 'left', 'right'];

  // ---------- small helpers ----------
  function lev(a, b) {
    const m = a.length, n = b.length, d = [];
    for (let i = 0; i <= m; i++) { d[i] = [i]; }
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1));
    return d[m][n];
  }
  function suggest(word, names) {
    let best = null, bd = 99;
    for (const n of names) { const d = lev(String(word), n); if (d < bd) { bd = d; best = n; } }
    return best && bd <= Math.max(2, Math.floor(String(word).length / 3)) ? ` Did you mean '${best}'?` : '';
  }
  const list = names => names.length ? names.join(', ') : '(none)';
  const fmt = v => typeof v === 'string' ? (/^[A-Za-z_][\w-]*$/.test(v) ? v : JSON.stringify(v)) : String(v);
  function callText(c) {
    const a = Object.keys(c.given || {}).map(k => `${k}=${fmt(c.given[k])}`);
    return `${c.name}(${a.join(', ')})`;
  }

  // split on a separator at bracket depth 0 and outside quotes
  function splitTop(s, sep) {
    const out = []; let depth = 0, q = false, cur = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"' && s[i - 1] !== '\\') q = !q;
      if (!q) { if (ch === '(') depth++; else if (ch === ')') depth--; }
      if (ch === sep && depth === 0 && !q) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out.map(x => x.trim()).filter(x => x.length);
  }
  function stripComment(s) {
    let q = false;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '"' && s[i - 1] !== '\\') q = !q;
      if (s[i] === '#' && !q) return s.slice(0, i);
    }
    return s;
  }
  function value(raw) {
    raw = raw.trim();
    const m = raw.match(/^"((?:[^"\\]|\\.)*)"$/);
    if (m) return { v: m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'), kind: 'string' };
    if (/^-?\d+(\.\d+)?s?$/.test(raw) || /^-?\.\d+s?$/.test(raw)) return { v: parseFloat(raw), kind: 'number' };
    if (/^[A-Za-z_][\w-]*(\+[A-Za-z_][\w-]*)?$/.test(raw)) return { v: raw, kind: 'name' };   // A+B: two actors (cam frame)
    return { v: raw, kind: 'bad' };
  }
  // "name(args)" | "name" | "\"text\""  ->  { name, pos:[{v,kind}], named:{k:{v,kind}} } or { error }
  function parseCall(src) {
    src = src.trim();
    if (/^"/.test(src)) {
      const v = value(src);
      if (v.kind !== 'string') return { error: `unclosed quote in ${src}` };
      return { name: 'show', pos: [v], named: {}, text: src };
    }
    const m = src.match(/^([A-Za-z_]\w*)\s*(?:\((.*)\))?$/);
    if (!m) return { error: `cannot read '${src}'. Write name(arg, key=value), for example walk(to=420) or face(happy).` };
    const pos = [], named = {};
    for (const part of splitTop(m[2] || '', ',')) {
      const kv = part.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
      if (kv) named[kv[1]] = value(kv[2]);
      else pos.push(value(part));
    }
    return { name: m[1], pos, named, text: src };
  }

  // bind a raw call to a schema entry: fills defaults, checks names and types
  function bind(raw, schema, ctx) {
    const where = ctx.where;
    const keys = Object.keys(schema.args);
    const given = {};
    const errs = [];
    raw.pos.forEach((p, i) => {
      if (i >= keys.length) { errs.push(`${raw.name} takes ${keys.length ? keys.length + ' argument(s): ' + keys.join(', ') : 'no arguments'}; remove '${fmt(p.v)}'.`); return; }
      given[keys[i]] = p;
    });
    for (const k of Object.keys(raw.named)) {
      if (!(k in schema.args) && !(schema.channel && (k === 'on' || k === 'prop'))) {   // any action can name a prop it uses (docs/PROPS.md)
        errs.push(`${raw.name} has no argument '${k}'.${suggest(k, keys)} Valid: ${list(keys)}.`); continue; }
      given[k] = raw.named[k];
    }
    const args = {}, out = {};
    for (const k of keys) {
      const def = schema.args[k];
      if (!(k in given)) {
        if (def === REQ) errs.push(`${raw.name} needs ${k}=... (for example ${raw.name}(${k}=${k === 'text' ? '"..."' : (k === 'prop' ? 'lantern' : (k === 'to' ? '400' : 'x'))})).`);
        else args[k] = def;
        continue;
      }
      const g = given[k];
      if ((k === 'text' || k === 'sub') && g.kind !== 'string') {   // spoken and printed text is always in quotes
        const show = (v, key) => v.kind === 'string' || key === 'text' || key === 'sub' ? JSON.stringify(String(v.v)) : String(v.v);
        const fixed = raw.name + '(' + raw.pos.map((p, i) => show(p, keys[i])).concat(Object.keys(raw.named).map(n => n + '=' + show(raw.named[n], n))).join(', ') + ')';
        errs.push(`${raw.name}: the ${k} must be in quotes, got ${g.v}. Write: ${ctx.prefix || ''}${fixed}`); continue;
      }
      if (g.kind === 'bad') { errs.push(`cannot read value '${g.v}' for ${k}. Use a number, a name, or "text in quotes".`); continue; }
      if (typeof def === 'number' && g.kind !== 'number' && !PLACE_KEYS[k] && !(k === 'on' && g.kind !== 'bad' && typeof g.v === 'string')) { errs.push(`${raw.name}: ${k} must be a number, got '${g.v}'.`); continue; }
      const en = ENUMS[raw.name + '.' + k];
      if (en && en.indexOf(g.v) < 0) { errs.push(`${raw.name}: ${k}=${g.v} is not valid. Use one of: ${en.join(', ')}.`); continue; }
      args[k] = g.v; out[k] = g.v;
    }
    for (const k of ['on', 'prop']) if (k in given && !(k in schema.args) && given[k].kind !== 'bad') { args[k] = given[k].v; out[k] = given[k].v; }
    return { args, given: out, errs };
  }

  // ---------- parse ----------
  function parse(text, opts) {
    opts = opts || {};
    const G = typeof globalThis !== 'undefined' ? globalThis : root;
    const actions = opts.actions || (G.CharPerform && G.CharPerform.actions) || (G.CharPoses && G.CharPoses.actions) || STANDIN_ACTIONS;
    const P = { film: { title: '', duration: null, line: 0 }, sets: [], actors: [], puppets: [], props: [], tracks: {}, statements: [], diagnostics: [] };
    const D = (code, line, message, severity, extra) => P.diagnostics.push(Object.assign({ code, line, severity: severity || 'error', message }, extra || {}));
    const names = {};   // Name -> 'actor' | 'puppet' | 'prop'
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const timed = [];

    lines.forEach((rawLine, i) => {
      const ln = i + 1;
      const s = stripComment(rawLine).trim();
      if (!s) return;
      let m;
      if ((m = s.match(/^film\b\s*(.*)$/))) {
        const mm = m[1].match(/^"((?:[^"\\]|\\.)*)"\s*(?:(\d+(?:\.\d+)?)\s*s?)?\s*$/);
        if (!mm) { D('syntax', ln, `write the film line as: film "Title" 30s`); return; }
        P.film = { title: mm[1], duration: mm[2] ? parseFloat(mm[2]) : null, line: ln };
        if (!mm[2]) D('syntax', ln, `the film needs a length: film "${mm[1]}" 30s`);
        return;
      }
      if ((m = s.match(/^stage\b\s*(.*)$/))) {   // bare stage: stage width=2400 ground=600 scale=68
        const st = { line: ln };
        for (const w of m[1].split(/\s+/).filter(Boolean)) {
          const kv = w.match(/^(width|ground|scale)=(\d+(?:\.\d+)?)$/);
          if (kv) st[kv[1]] = parseFloat(kv[2]); else D('syntax', ln, `unexpected '${w}'. Write: stage width=2400 ground=600 scale=68 (all optional)`);
        }
        P.stage = st;
        return;
      }
      if ((m = s.match(/^set\b\s*(.*)$/))) {
        const w = m[1].split(/\s+/).filter(Boolean);
        if (!w.length || !/^[A-Za-z_][\w-]*$/.test(w[0])) { D('syntax', ln, `write: set <name> [variant], for example: set hillside dusk`); return; }
        if (P.sets.length) D('one-set', ln, `only one set per film (already 'set ${P.sets[0].name}' on line ${P.sets[0].line}). Delete this line or make a second film.`);
        else P.sets.push({ name: w[0], variant: w[1] || null, line: ln });
        return;
      }
      if ((m = s.match(/^(actor|puppet)\b\s*(.*)$/))) {
        const kind = m[1];
        const re = kind === 'actor'
          ? /^([A-Za-z_]\w*)\s*=\s*skin\s+([A-Za-z_][\w-]*)\s+at\s+(\S+)(.*)$/
          : /^([A-Za-z_]\w*)\s*=\s*([A-Za-z_][\w-]*)\s+at\s+(\S+)(.*)$/;
        const mm = m[2].match(re);
        if (!mm) {
          D('syntax', ln, kind === 'actor' ? `write: actor Kai = skin kai at 120 [facing left] [scale=1]` : `write: puppet Pip = bird at branch [facing left] [scale=1]`);
          return;
        }
        const decl = { name: mm[1], line: ln, at: value(mm[3]).v, facing: 1, scale: 1 };
        if (kind === 'actor') decl.skin = mm[2]; else decl.kind = mm[2];
        const rest = mm[4].trim().split(/\s+/).filter(Boolean);
        for (let k = 0; k < rest.length; k++) {
          const w = rest[k];
          if (w === 'facing') { const f = rest[++k]; if (f === 'left') decl.facing = -1; else if (f === 'right') decl.facing = 1; else D('syntax', ln, `facing must be left or right, got '${f}'.`); }
          else if (/^scale=/.test(w)) { decl.scale = parseFloat(w.slice(6)); if (!(decl.scale > 0)) { D('syntax', ln, `scale must be a positive number, for example scale=0.8`); decl.scale = 1; } }
          else D('syntax', ln, `unexpected '${w}' at the end. Allowed: facing left|right, scale=<n>.`);
        }
        if (names[decl.name]) { D('duplicate', ln, `the name '${decl.name}' is already used for a ${names[decl.name]}. Pick another name.`); return; }
        if (/^(cam|caption|card|clock|wind)$/.test(decl.name)) { D('reserved', ln, `'${decl.name}' is a reserved target. Pick another name.`); return; }
        names[decl.name] = kind;
        (kind === 'actor' ? P.actors : P.puppets).push(decl);
        P.tracks[decl.name] = [];
        return;
      }
      if ((m = s.match(/^prop\b\s*(.*)$/))) {
        const mm = m[1].match(/^([A-Za-z_][\w-]*)(?:\s+as\s+([A-Za-z_]\w*))?(?:\s+at\s+(\S+))?\s*$/);
        if (!mm) { D('syntax', ln, `write: prop lantern [as Lamp] [at 300]`); return; }
        const decl = { kind: mm[1], name: mm[2] || mm[1], at: mm[3] !== undefined ? value(mm[3]).v : null, line: ln };
        if (names[decl.name]) { D('duplicate', ln, `the name '${decl.name}' is already used for a ${names[decl.name]}. Use: prop ${decl.kind} as OtherName`); return; }
        names[decl.name] = 'prop';
        P.props.push(decl);
        return;
      }
      if ((m = s.match(/^(\+?)(\d+(?:\.\d+)?|\.\d+)s?\s+([A-Za-z_]\w*)\s*:\s*(.*)$/))) {
        timed.push({ ln, rel: m[1] === '+', num: parseFloat(m[2]), target: m[3], body: m[4] });
        return;
      }
      if (/^[+\d.]/.test(s)) D('syntax', ln, `write a timed line as: <time> <target>: call(args), for example: 2.5 Kai: walk(to=400)  or  +0.5 cam: zoom(1.3)`);
      else D('syntax', ln, `cannot read this line. Start it with film, set, actor, puppet, prop, or a time such as 3.0 or +0.5.`);
    });

    if (!P.film.line) D('no-film', 1, `the script needs a first line like: film "Title" 30s`);
    if (!P.sets.length) D('no-set', 1, `no set line: the stage is bare (transparent, flat ground, no scenery). To add scenery write, for example: set hillside`, 'info');

    const targets = () => Object.keys(names).filter(n => names[n] !== 'prop').concat(['cam', 'caption', 'card', 'clock', 'wind']);
    for (const L of timed) {
      const ln = L.ln;
      const kind = L.target === 'cam' ? 'cam' : L.target === 'caption' ? 'caption' : L.target === 'card' ? 'card' : L.target === 'clock' ? 'clock' : L.target === 'wind' ? 'wind' : names[L.target];
      if (!kind || kind === 'prop') {
        D('unknown-target', ln, kind === 'prop'
          ? `'${L.target}' is a prop; props cannot act. Make an actor hold it: <time> Kai: hold(${L.target}).`
          : `unknown target '${L.target}'.${suggest(L.target, targets())} Valid targets: ${list(targets())}. Declare actors with 'actor Name = skin x at 100'.`);
        continue;
      }
      const st = { line: ln, target: L.target, kind, t: L.rel ? null : L.num, rel: L.rel ? L.num : null, calls: [] };
      const schema = kind === 'actor' ? actions : kind === 'cam' ? CAM : kind === 'caption' ? CAPTION : kind === 'card' ? CARD : kind === 'clock' ? CLOCK : kind === 'wind' ? WIND : null;
      const chans = {};
      const parts = splitTop(L.body, ',');
      // "key=value" parts at the top level belong to the call before them: caption: "Hi", for=2
      const merged = [];
      for (const p of parts) {
        if (/^[A-Za-z_]\w*\s*=/.test(p) && merged.length) merged[merged.length - 1].extra.push(p);
        else merged.push({ src: p, extra: [] });
      }
      if (!merged.length) { D('syntax', ln, `nothing after '${L.target}:'. Write a call, for example ${L.target}: ${kind === 'actor' ? 'wave()' : kind === 'cam' ? 'pan(to=800)' : '"text"'}`); continue; }
      for (const mp of merged) {
        const raw = parseCall(mp.src);
        if (raw.error) { D('syntax', ln, raw.error); continue; }
        for (const e of mp.extra) { const kv = e.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/); raw.named[kv[1]] = value(kv[2]); }
        if (kind === 'puppet') {   // states come from the puppet file: validated by validate()
          const given = {};
          for (const k of Object.keys(raw.named)) given[k] = raw.named[k].v;
          if (raw.pos.length) given._pos = raw.pos.map(p => p.v);
          st.calls.push({ name: raw.name, args: Object.assign({}, given), given, channel: 'state', raw });
          if (chans.state) D('channel-clash', ln, `${L.target} can do one state per line ('${chans.state}' and '${raw.name}'). Put '${raw.name}' on its own line, for example +0 ${L.target}: ${raw.name}.`);
          chans.state = raw.name;
          continue;
        }
        const sc = schema[raw.name];
        if (!sc) {
          const valid = Object.keys(schema);
          const extra = kind === 'card' || kind === 'caption' ? ` For text write ${L.target}: "your text".` : '';
          D('unknown-action', ln, `${L.target} has no action '${raw.name}'.${suggest(raw.name, valid)} Valid for ${kind === 'actor' ? 'actors' : L.target}: ${list(valid)}.${extra}`);
          continue;
        }
        const b = bind(raw, sc, { where: L.target, prefix: `${L.rel ? '+' : ''}${L.num} ${L.target}: ` });
        for (const e of b.errs) D('bad-arg', ln, e);
        if (b.errs.length) continue;
        const call = { name: raw.name, args: b.args, given: b.given, channel: sc.channel, moves: !!sc.moves };
        if (chans[sc.channel]) {
          D('channel-clash', ln, `${chans[sc.channel]} and ${raw.name} both use the ${sc.channel} channel, so they cannot start on one line. Move ${raw.name} to its own line, for example: +0 ${L.target}: ${callText(call)}`);
          continue;
        }
        chans[sc.channel] = raw.name;
        st.calls.push(call);
      }
      if (!st.calls.length) continue;
      P.statements.push(st);
      (P.tracks[L.target] = P.tracks[L.target] || []).push(st);
    }

    // first pass of times with estimated actor durations; the stage redoes this exactly
    timeline(P, estimator(P, actions));
    return P;
  }

  // rough end times used before the performer exists: px/s for moves, fixed times for gestures
  function estimator(P, actions) {
    const xs = {};
    for (const a of P.actors) xs[a.name] = typeof a.at === 'number' ? a.at : null;
    const speed = { walk: 125, run: 330, sneak: 70, jump: 260, enter: 125 };
    return st => {
      if (st.kind !== 'actor') return builtinEnds(st);
      return st.calls.map(c => {
        if (c.moves) {
          const x0 = xs[st.target], to = c.args.to;
          if (typeof to === 'number') {
            xs[st.target] = to;
            if (x0 !== null) return st.t + Math.abs(to - x0) / (speed[c.name] || 125) / (c.args.speed || 1) + 0.3;
          } else xs[st.target] = null;
          return { t: st.t + 2, approx: true };
        }
        return st.t + (c.channel === 'face' || c.channel === 'look' ? 0.3 : 0.8);
      });
    };
  }
  // exact ends for cam, caption, card; puppets get theirs from the stage
  function builtinEnds(st) {
    return st.calls.map(c => {
      if (st.kind === 'cam') return st.t + (c.name === 'cut' ? 0 : (c.args.over || 0));
      if (st.kind === 'caption') return st.t + (c.name === 'clear' ? 0 : c.args.for);
      if (st.kind === 'card') return st.t + (c.args.for || 0.6);
      if (st.kind === 'clock') return st.t + (c.name === 'freeze' ? c.args.for : 0);
      if (st.kind === 'wind') return st.t + (c.args.over || 0);
      return { t: st.t + 1, approx: true };
    });
  }

  // Resolve times in source order. endOf(statement) -> array of per-call end times (numbers, or
  // {t, approx}). Recomputes the timing diagnostics (codes time-order, overlap, past-end).
  function timeline(P, endOf) {
    P.diagnostics = P.diagnostics.filter(d => !d.timing);
    const D = (code, line, message, severity) => P.diagnostics.push({ code, line, severity: severity || 'error', message, timing: true });
    const last = {};
    for (const st of P.statements) {
      const prev = last[st.target];
      if (st.rel !== null) st.t = +(((prev ? prev.end : 0) + st.rel).toFixed(4));
      else if (prev && prev.pairOf && st.t < prev.end - 1e-4) D('overlap', st.line, `${st.target} is busy with ${prev.pairOf.target}'s ${prev.pairOf.calls[0].name} from line ${prev.pairOf.line} until ${prev.end.toFixed(2)}s; this line at ${st.t}s cuts it short. Start it with +0 (or at ${prev.end.toFixed(1)}).`, 'warning');
      else if (prev && st.t < prev.t) D('time-order', st.line, `${st.target}'s statements must go forward in time: ${st.t}s is before line ${prev.line} (${prev.t}s). Move this line above line ${prev.line} or change its time.`);
      const ends = endOf(st) || [];
      st.callEnds = ends.map(e => typeof e === 'number' ? e : e.t);
      st.approx = ends.some(e => e && e.approx);
      st.end = Math.max(st.t, ...st.callEnds);
      last[st.target] = st;
      // a pair line (A: hug(with=B)) occupies B too: B's next '+n' line waits for it
      if (st.kind === 'actor') for (const c of st.calls) {
        const B = c.args && typeof c.args.with === 'string' ? c.args.with : null;
        if (B && B !== st.target && (!last[B] || last[B].end < st.end)) last[B] = { t: st.t, end: st.end, line: st.line, target: B, pairOf: st };
      }
      const dur = P.film.duration;
      if (dur && st.t >= dur) D('past-end', st.line, `this starts at ${st.t.toFixed(2)}s but the film is ${dur}s long. Make the film longer (film "${P.film.title}" ${Math.ceil(st.t + 2)}s) or move the line earlier.`);
    }
    // a statement whose motion is still running when the next statement on the same channel starts
    for (const name of Object.keys(P.tracks)) {
      const tr = P.tracks[name];
      for (let i = 0; i < tr.length - 1; i++) {
        const a = tr[i];
        if (a.approx) continue;
        a.calls.forEach((c, ci) => {
          const long = a.kind === 'actor' ? c.moves : (a.kind === 'cam' ? c.name !== 'cut' && c.name !== 'follow' : a.kind === 'puppet');
          if (!long) return;
          const e = a.callEnds[ci];
          for (let j = i + 1; j < tr.length; j++) {
            const b = tr[j];
            if (b.t >= e - 1e-4) break;   // start times are rounded to 0.1 ms
            const clash = b.calls.find(bc => bc.channel === c.channel);
            if (clash) {
              const what = a.kind === 'actor' ? `${name}'s ${c.name}` : `${name} ${c.name}`;
              D('overlap', b.line, `${what} from line ${a.line} runs until ${e.toFixed(2)}s, but this line starts ${clash.name} at ${b.t.toFixed(2)}s and cuts it short. Start this line with +0 (or at ${e.toFixed(1)}), or shorten line ${a.line}.`);
              break;
            }
          }
        });
      }
    }
    let end = 0;
    for (const st of P.statements) end = Math.max(end, st.end);
    P.contentEnd = end;
    return P;
  }

  // ---------- validate against the library ----------
  // lib: { sets, skins, puppets, props } objects keyed by name. anchors come from the set.
  function validate(P, lib) {
    lib = lib || {};
    const out = [];
    const D = (code, line, message, severity) => out.push({ code, line, severity: severity || 'error', message });
    const sets = lib.sets || {}, skins = lib.skins || {}, pups = lib.puppets || {}, props = lib.props || {};
    let set = null;
    if (P.sets.length) {
      const s = P.sets[0];
      set = sets[s.name];
      if (!set) D('unknown-set', s.line, `unknown set '${s.name}'.${suggest(s.name, Object.keys(sets))} Available sets: ${list(Object.keys(sets))}. Add sets/${s.name}.js to make a new one.`);
      else if (s.variant && !(set.variants && set.variants[s.variant])) D('unknown-variant', s.line, `set ${s.name} has no variant '${s.variant}'. Variants: ${list(Object.keys(set.variants || {}))}.`);
    }
    const anchors = set && set.anchors ? Object.keys(set.anchors) : [];
    const things = P.actors.map(a => a.name).concat(P.puppets.map(a => a.name), P.props.map(a => a.name));
    const place = (v, line, what, extraWords) => {
      if (typeof v === 'number' || v === null || v === undefined || v === '') return;
      const ok = anchors.concat(things, extraWords || []);
      if (ok.indexOf(v) < 0) D('unknown-place', line, `${what}: '${v}' is not a number, an anchor or a name.${suggest(v, ok)} Anchors in this set: ${list(anchors)}. Names: ${list(things)}.`);
    };
    for (const a of P.actors) {
      if (!skins[a.skin]) {
        const have = Object.keys(skins);
        D('unknown-skin', a.line, `unknown skin '${a.skin}'.${suggest(a.skin, have)} Available skins: ${list(have)}. ${have.length ? '' : 'The default character is drawn instead.'}`, have.length ? 'error' : 'warning');
      }
      place(a.at, a.line, `actor ${a.name} at`);
    }
    for (const p of P.puppets) {
      const def = pups[p.kind];
      if (!def) { D('unknown-puppet', p.line, `unknown puppet '${p.kind}'.${suggest(p.kind, Object.keys(pups))} Available puppets: ${list(Object.keys(pups))}.`); continue; }
      place(p.at, p.line, `puppet ${p.name} at`);
      for (const st of P.tracks[p.name] || []) for (const c of st.calls) {
        const states = Object.keys(def.states || {}).concat(['turn']);
        if (states.indexOf(c.name) < 0) { D('unknown-action', st.line, `puppet ${p.name} (${p.kind}) has no state '${c.name}'.${suggest(c.name, states)} Valid: ${list(states)}.`); continue; }
        const sd = (def.states || {})[c.name] || {};
        const okArgs = ['for'].concat(sd.travel ? ['to', 'speed'] : []);
        for (const k of Object.keys(c.given)) {
          if (k === '_pos') {
            if (sd.travel && c.given._pos.length === 1) { c.args.to = c.given._pos[0]; continue; }
            D('bad-arg', st.line, `write ${c.name} arguments as key=value. Valid keys: ${okArgs.join(', ')}.`); continue;
          }
          if (okArgs.indexOf(k) < 0) D('bad-arg', st.line, `${p.kind} state '${c.name}' has no argument '${k}'. Valid: ${okArgs.join(', ')}.${sd.travel ? '' : ' Only moving states (' + Object.keys(def.states).filter(n => def.states[n].travel).join(', ') + ') take to=.'}`);
        }
        delete c.args._pos;
        if (sd.travel && (c.args.to === undefined)) D('bad-arg', st.line, `${c.name} needs to=<x or anchor>, for example ${p.name}: ${c.name}(to=${anchors[0] || 400}).`);
        place(c.args.to, st.line, `${p.name}: ${c.name} to`);
      }
    }
    for (const pr of P.props) {
      if (!props[pr.kind]) D('unknown-prop', pr.line, `unknown prop '${pr.kind}'.${suggest(pr.kind, Object.keys(props))} Available props: ${list(Object.keys(props))}.`);
      place(pr.at, pr.line, `prop ${pr.name} at`);
    }
    const movers = P.actors.map(a => a.name).concat(P.puppets.map(a => a.name));
    for (const st of P.statements) for (const c of st.calls) {
      if (st.kind === 'actor') {
        if (c.name === 'hold') {
          const names = P.props.map(p => p.name);
          if (names.indexOf(c.args.prop) < 0) D('unknown-prop', st.line, `${st.target} cannot hold '${c.args.prop}': declare it first with 'prop ${c.args.prop}'.${suggest(c.args.prop, names)} Declared props: ${list(names)}.`);
        }
        for (const k of ['to', 'at', 'from']) if (k in c.given) {
          if (c.name === 'enter' && k === 'from') { if (['left', 'right'].indexOf(c.args.from) < 0) D('bad-arg', st.line, `enter(from=left) or enter(from=right).`); continue; }
          place(c.given[k], st.line, `${st.target}: ${c.name} ${k}`, k === 'at' ? LOOK_WORDS : []);
        }
      } else if (st.kind === 'cam') {
        if (c.name === 'follow' && movers.indexOf(c.args.target) < 0) D('unknown-place', st.line, `cam can follow only an actor or puppet. Names: ${list(movers)}.`);
        if (c.name === 'frame' && String(c.args.on).split('+').some(n => P.actors.every(a => a.name !== n))) D('unknown-place', st.line, `cam frame(on=...) needs an actor, or two joined with + (on=Kai+Tess). Actors: ${list(P.actors.map(a => a.name))}.`);
        if (c.name === 'pan' || c.name === 'cut') place(c.args.to, st.line, `cam ${c.name} to`);
        if (c.name === 'zoom' && c.args.to < 1) D('bad-arg', st.line, `zoom below 1 would show past the edge of the set; use 1 for the whole frame or more to go closer.`);
      } else if (st.kind === 'clock') {
        if (c.args.who && P.actors.every(a => a.name !== c.args.who)) D('unknown-place', st.line, `clock: who=${c.args.who} is not an actor. Actors: ${list(P.actors.map(a => a.name))}.`);
        if (c.name === 'freeze' && st.rel !== null) D('bad-arg', st.line, `write freeze at an absolute time (for example 20.5 clock: freeze(for=1)), not a + time.`);
        if (c.name === 'tempo' && (c.args.div < 1 || c.args.snap <= 0 || c.args.snap > 1)) D('bad-arg', st.line, `tempo: div must be 1 or more and snap between 0 and 1.`);
      } else if (st.kind === 'caption' && c.args.by) {
        if (movers.indexOf(c.args.by) < 0) D('unknown-place', st.line, `by=${c.args.by}: speech bubbles need an actor or puppet. Names: ${list(movers)}.`);
      }
    }
    return out;
  }

  return { parse, validate, timeline, builtinEnds, STANDIN_ACTIONS, CAM, CAPTION, CARD, CLOCK, WIND, suggest };
});

}).call(G);

// ---- src/stage.js ----
(function (module, exports, require) {
// stage.js - composes a parsed film script into frames (STAGE.md sections 4-5).
// UMD: window.CharStage in the browser, module.exports in Node.
//
//   CharStage.compile(parsed, lib) -> film { duration, diagnostics, frame(t) -> SVG string, ...helpers for tools }
//   CharStage.mount(el, parsed, lib) -> { seek(t), duration, diagnostics, film }
//
// lib = { skins, sets, puppets, props } (defaults to the globals CharSkins, CharSets, CharPuppets, CharProps).
// Everything is a pure function of time: frame(t) reads no state left by an earlier frame.
// Actors are driven by CharPerform when it is loaded, otherwise by the small Standin below.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root, require('./script.js'));
  else root.CharStage = factory(root, root.CharScript);
})(typeof self !== 'undefined' ? self : this, function (root, CharScript) {
  'use strict';
  const G = typeof globalThis !== 'undefined' ? globalThis : root;
  function dep(name, file) {
    if (G[name]) return G[name];
    if (typeof require === 'function' && file) { try { const m = require(file); G[name] = m; return m; } catch (e) { /* not available */ } }
    return null;
  }
  const FW = 1280, FH = 720;   // frame size

  // ---------- math ----------
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const ease = u => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const fx = v => (Math.round(v * 100) / 100).toString();
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function lerpObj(a, b, u) {   // numeric blend of two plain objects/arrays; non-numbers switch at the middle
    if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * u;
    if (Array.isArray(a) && Array.isArray(b)) return b.map((v, i) => lerpObj(a[i] === undefined ? v : a[i], v, u));
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const o = {};
      for (const k of Object.keys(b)) o[k] = k in a ? lerpObj(a[k], b[k], u) : b[k];
      for (const k of Object.keys(a)) if (!(k in b)) o[k] = a[k];
      return o;
    }
    return u < 0.5 ? (a === undefined ? b : a) : b;
  }
  function blinkAt(t, seed) {   // irregular deterministic blinks, 0..1 closed
    const P = 2.7, k = Math.floor(t / P + seed);
    let b = 0;
    for (const j of [k - 1, k]) {
      const bt = (j - seed) * P + 0.3 + hash(j + seed * 13) * (P - 0.6);
      const d = Math.abs(t - bt);
      if (d < 0.09) b = Math.max(b, 1 - d / 0.09);
    }
    return b;
  }

  // ---------- skins -> rig character ----------
  const charCache = new WeakMap();
  function charOf(skin) {
    const R = dep('CharRig', './rig.js');
    if (!skin) return R.defaultCharacter();
    if (charCache.has(skin)) return charCache.get(skin);
    if (R.skinCharacter) { const c = R.skinCharacter(skin); charCache.set(skin, c); return c; }
    const ch = R.defaultCharacter();
    const pr = skin.proportions || {};
    ch.proportions = Object.assign({}, ch.proportions, pr, { radius: Object.assign({}, ch.proportions.radius, pr.radius || {}) });
    if (skin.palette) ch.palette = Object.assign({}, ch.palette, skin.palette);
    if (skin.style) ch.style = Object.assign({}, ch.style, skin.style);
    if (skin.hair) ch.hair = skin.hair;
    charCache.set(skin, ch);
    return ch;
  }

  // ======================================================================================
  // Standin performer: used only when CharPerform is not loaded. Stand, idle breathing,
  // walk/run/sneak/enter through CharGait (no foot slide while moving), turn, hold/drop,
  // wave/cheer, face moods via the mouth. Other actions are shown as standing.
  // ======================================================================================
  const Standin = {
    standin: true,
    actions: CharScript.STANDIN_ACTIONS,
    compile(skin, events, env) {
      const R = dep('CharRig', './rig.js'), Gt = dep('CharGait', './gait.js');
      const ch = charOf(skin), pr = ch.proportions, s = env.scale || 62;
      const ground = typeof env.ground === 'function' ? env.ground : () => env.ground;
      const anchors = env.anchors || {};
      const diagnostics = [];
      const gaitOf = (preset, speed) => {
        const prm = { preset, speed: speed || 1 }, p = Gt.resolve(prm);
        const S = p.stride * (pr.thigh + pr.shin) * Math.sqrt(p.speed);
        return { prm, S, v: S * Gt.cycleRate(prm) * s };   // v in px/s
      };
      let x = env.x === undefined ? 200 : env.x, facing = env.facing || 1;
      const moves = [], arms = [], faces = [], turns = [], ends = [];
      const placeX = v => typeof v === 'number' ? v : anchors[v] ? anchors[v][0] : null;
      events.forEach((ev, i) => {
        const a = ev.args || {};
        let end = ev.t + 0.25;
        const mv = { walk: 'walk', run: 'run', sneak: 'sneak', enter: 'walk', jump: 'run' }[ev.action];
        if (mv) {
          let x0 = x, to = placeX(a.to);
          if (ev.action === 'enter') { to = x; x0 = clamp(x + (a.from === 'right' ? 700 : -700), -90, (env.width || 2000) + 90); }
          if (to === null) { diagnostics.push({ code: 'bad-arg', t: ev.t, line: ev.line, message: `cannot find place '${a.to}'.` }); to = x; }
          const g = gaitOf(mv, a.speed);
          const dur = Math.abs(to - x0) / g.v;
          if (dur > 0.01) {
            const dir = Math.sign(to - x0);
            moves.push({ t0: ev.t, t1: ev.t + dur, x0, x1: to, dir, g });
            turns.push({ t: ev.t, f: dir });
            facing = dir;
            end = ev.t + dur + 0.3;
          }
          x = to;
          if (ev.action === 'jump') diagnostics.push({ code: 'standin', t: ev.t, line: ev.line, severity: 'info', message: 'stand-in performer: jump shown as a run' });
        } else if (ev.action === 'turn') { facing = -facing; turns.push({ t: ev.t, f: facing }); end = ev.t + 0.3; }
        else if (ev.action === 'hold') arms.push({ t: ev.t, kind: 'hold', prop: a.prop, how: a.how || 'front' });
        else if (ev.action === 'drop') arms.push({ t: ev.t, kind: 'drop' });
        else if (ev.action === 'wave' || ev.action === 'cheer' || ev.action === 'point' || ev.action === 'reach') { arms.push({ t: ev.t, kind: ev.action, dur: 1.6 }); end = ev.t + 1.6; }
        else if (ev.action === 'face') { faces.push({ t: ev.t, mood: a.mood }); end = ev.t + 0.2; }
        else if (ev.action === 'stand' || ev.action === 'idle' || ev.action === 'look' || ev.action === 'nod') { /* standing is the default */ }
        else diagnostics.push({ code: 'standin', t: ev.t, line: ev.line, severity: 'info', message: `stand-in performer: '${ev.action}' shown as standing` });
        ends[i] = end;
      });

      function stand(t, rootX) {
        const br = Math.sin(t * 2.1) * 0.012;
        return {
          root: [rootX, pr.thigh + pr.shin + pr.ankleHeight - 0.045 + br],
          pelvisTilt: 0, spineLean: 0.03 + br, chestTwist: 0, neck: 0, headTilt: 0.02 + br,
          legs: { near: { foot: [rootX + 0.12, pr.ankleHeight], footAngle: 0 }, far: { foot: [rootX - 0.13, pr.ankleHeight], footAngle: 0 } },
          arms: { near: { shoulder: 0.1 + br, elbow: 0.28, wrist: 0.1 }, far: { shoulder: -0.1, elbow: 0.32, wrist: 0.1 } },
          face: { blink: 0, mouth: 'neutral', eye: [0.3, 0], brow: 0.2 },
          secondary: { hair: 0.05, hair2: 0.05, cloth: 0.03 },
        };
      }
      function walkPose(m, t) {
        const d = m.g.v * clamp(t - m.t0, 0, m.t1 - m.t0), cyc = d / (m.g.S * s);
        return { pose: Gt.pose(m.g.prm, cyc - Math.floor(cyc), ch), x: m.x0 + m.dir * d };
      }
      function bodyAt(t) {
        let m = null;
        for (const mm of moves) if (mm.t0 <= t) m = mm;
        if (!m) return { pose: stand(t, 0), x: env.x === undefined ? 200 : env.x, walking: false };
        const w = walkPose(m, t);
        if (t <= m.t1) {   // blend in from standing over 0.2 s
          const u = smooth((t - m.t0) / 0.2);
          return { pose: u < 1 ? lerpObj(stand(t, w.pose.root[0]), w.pose, u) : w.pose, x: w.x, walking: true };
        }
        const u = smooth((t - m.t1) / 0.3);   // settle into standing
        return { pose: u < 1 ? lerpObj(w.pose, stand(t, w.pose.root[0]), u) : stand(t, w.pose.root[0]), x: m.x1, walking: false };
      }
      const ARM = {
        hold: { up: { shoulder: 2.5, elbow: 0.25, wrist: -0.2 }, front: { shoulder: 1.05, elbow: 0.75, wrist: -0.3 }, side: { shoulder: 0.25, elbow: 0.15, wrist: 0 } },
        cheer: { shoulder: 2.8, elbow: 0.2, wrist: 0 },
        point: { shoulder: 1.5, elbow: 0.05, wrist: 0 },
        reach: { shoulder: 1.3, elbow: 0.2, wrist: 0 },
      };
      function armsAt(t, base) {
        const near = Object.assign({}, base.near), far = Object.assign({}, base.far);
        let held = null, holdW = 0, holdArm = null;
        // the latest hold/drop before t decides what the near hand carries
        for (const a of arms) if (a.t <= t && (a.kind === 'hold' || a.kind === 'drop')) {
          if (a.kind === 'hold') { held = a; holdW = smooth((t - a.t) / 0.3); holdArm = ARM.hold[a.how] || ARM.hold.front; }
          else { holdW = held ? 1 - smooth((t - a.t) / 0.3) : 0; held = null; }
        }
        let out = holdArm ? lerpObj(near, holdArm, holdW) : near;
        let outFar = far;
        for (const a of arms) if (a.dur && t >= a.t && t < a.t + a.dur) {
          const w = smooth((t - a.t) / 0.3) * smooth((a.t + a.dur - t) / 0.3);
          let tgt = a.kind === 'wave' ? { shoulder: 2.55, elbow: 0.55 + 0.45 * Math.sin((t - a.t) * 15), wrist: 0.2 } : ARM[a.kind];
          if (a.kind === 'cheer') outFar = lerpObj(far, { shoulder: 2.7, elbow: 0.25, wrist: 0 }, w);
          if (!held) out = lerpObj(out, tgt, w); else outFar = lerpObj(outFar, tgt, w);
        }
        return { near: out, far: outFar, held: held && t >= held.t + 0.15 ? held : null };
      }
      const MOUTH = { happy: 'smile', scared: 'open', surprised: 'open', determined: 'neutral', sad: 'neutral', neutral: 'neutral' };
      function sample(t) {
        const b = bodyAt(t), pose = b.pose;
        let f = env.facing || 1;
        for (const tr of turns) if (tr.t <= t) f = tr.f;
        const ar = armsAt(t, pose.arms);
        pose.arms = { near: ar.near, far: ar.far };
        let mood = null;
        for (const fc of faces) if (fc.t <= t) mood = fc.mood;
        pose.face = Object.assign({}, pose.face, { blink: blinkAt(t, (env.x || 0) % 7), mouth: mood ? MOUTH[mood] || 'neutral' : pose.face.mouth || 'neutral' });
        // feet follow uneven ground: each foot target is moved by the ground height under it
        const gx = ground(b.x);
        let drop = 0;
        for (const side of ['near', 'far']) {
          const L = pose.legs[side], wx = b.x + f * (L.foot[0] - pose.root[0]) * s;
          const dy = (ground(wx) - gx) / s;   // + = ground lower under this foot
          L.foot = [L.foot[0], L.foot[1] - dy];
          drop = Math.max(drop, dy);
        }
        pose.root = [pose.root[0], pose.root[1] - drop * 0.8];
        const held = ar.held ? { prop: ar.held.prop, joint: 'wrist.near', angle: 0 } : null;
        return { x: b.x, y: gx, facing: f, pose, swaps: { hand: held ? 'grip' : 'relaxed', mouth: pose.face.mouth, eye: 'open', brow: 'neutral' }, held, scale: s };
      }
      return { sample, end: i => ends[i] === undefined ? 0 : ends[i], diagnostics };
    },
    draw(skin, smp) {
      const R = dep('CharRig', './rig.js'), s = smp.scale || 62;
      const drawn = skin && (skin.parts || skin.swaps || skin.chains || skin.build) ? skin : charOf(skin);   // rig.js draws skins itself
      return `<g transform="scale(${smp.facing || 1} 1)">${R.render(drawn, smp.pose, { x: -smp.pose.root[0] * s, y: 0, scale: s })}</g>`;
    },
  };

  // rig joints of a sample in stage px (used for held props and by tools/check.cjs)
  // Convention (CharPerform.draw): rig point p maps to (x + facing*p.x*scale*sq.x, y - p.y*scale*sq.y).
  // The stand-in draws its gait pose shifted by -root.x instead (standin = true).
  function jointsOf(skin, smp, scale, standin) {
    const R = dep('CharRig', './rig.js');
    if (!smp || !smp.pose || !smp.pose.root) return null;
    const ch = charOf(skin), sol = R.solve(ch, smp.pose), J = sol.joints;
    const s = smp.scale || scale, f = smp.facing || 1, r0 = standin ? smp.pose.root[0] : 0;
    const sq = (!standin && smp.pose.squash) || [1, 1];
    const W = p => [smp.x + f * (p[0] - r0) * s * sq[0], smp.y - p[1] * s * sq[1]];
    const out = { root: W(J.root), head: W([J.headBase[0], J.headBase[1] + ch.proportions.head * 1.1]), feet: {}, hands: {} };
    for (const side of ['near', 'far']) {
      const fp = R.footPoints(ch, J['ankle.' + side], sol.angles['foot.' + side]);
      out.feet[side] = { heel: W(fp.heel), toe: W(fp.toe), ankle: W(J['ankle.' + side]), low: Math.max(...fp.ground.map(p => W(p)[1])) };
      const ha = sol.angles['hand.' + side], hs = (ch.proportions.hand || 1) * 0.1;
      const wr = J['wrist.' + side];
      out.hands[side] = W([wr[0] + Math.cos(ha) * hs, wr[1] + Math.sin(ha) * hs]);
    }
    return out;
  }

  // ---------- fallback set ----------
  const PLAIN_SET = {
    name: 'plain', width: 1280, height: 720, ground: 600, actorScale: 62, anchors: { left: 200, center: 640, right: 1080 },
    layers: [{ depth: 0, draw: () => '<rect x="-50" y="-50" width="1380" height="820" fill="#cfe3ee"/><rect x="-50" y="600" width="1380" height="200" fill="#8fb37a"/>' }],
  };

  // bare stage (a film with no set line): transparent, flat ground, no scenery. stage width= ground= scale=
  function bareSet(st) {
    st = st || {};
    return { name: 'bare', bare: true, width: st.width || 2400, height: FH, ground: st.ground || 600, actorScale: st.scale || 68, anchors: { left: 200, center: 640, right: 1080 }, layers: [] };
  }

  function normalizeLib(lib) {
    lib = lib || {};
    return {
      skins: lib.skins || G.CharSkins || {}, sets: lib.sets || G.CharSets || {},
      puppets: lib.puppets || G.CharPuppets || {}, props: lib.props || G.CharProps || {},
    };
  }

  // text helpers for captions, bubbles and cards
  function wrap(text, size, maxW) {
    const cw = size * 0.53, out = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const w of para.split(/\s+/)) {
        const tryL = line ? line + ' ' + w : w;
        if (tryL.length * cw > maxW && line) { out.push(line); line = w; } else line = tryL;
      }
      out.push(line);
    }
    return { lines: out, width: Math.max(...out.map(l => l.length * cw)) };
  }
  const FONT = `'Trebuchet MS', 'Segoe UI', Verdana, sans-serif`;
  const SERIF = `Georgia, 'Palatino Linotype', 'Times New Roman', serif`;

  // ======================================================================================
  function compile(parsed, libIn, opts) {
    opts = opts || {};
    if (typeof parsed === 'string') parsed = CharScript.parse(parsed);
    const P = parsed, lib = normalizeLib(libIn);
    const realPerf = dep('CharPerform', null);
    const Perf = opts.standin ? Standin : (realPerf || Standin);
    const libDiag = CharScript.validate(P, lib);

    // ----- set -----
    const sdecl = P.sets[0] || { name: 'plain' };
    const set = P.sets[0] ? (lib.sets[sdecl.name] || PLAIN_SET) : bareSet(P.stage);
    const variantName = (sdecl.variant && set.variants && set.variants[sdecl.variant]) ? sdecl.variant : (set.defaultVariant || null);
    const pal = Object.assign({}, set.palette || {}, (set.variants && variantName && set.variants[variantName]) || {});
    const W = set.width || FW, H = set.height || FH;
    const ground = typeof set.ground === 'function' ? (x => set.ground(x)) : (() => (set.ground === undefined ? H - 120 : set.ground));
    const actorScale = set.actorScale || 62;
    const anchors = {};
    for (const k of Object.keys(set.anchors || {})) {
      const v = set.anchors[k];
      anchors[k] = Array.isArray(v) ? [v[0], v[1] === undefined || v[1] === null ? ground(v[0]) : v[1]] : [v, ground(v)];
    }
    const placeOf = v => typeof v === 'number' ? [v, ground(v)] : (anchors[v] ? (typeof anchors[v] === 'function' ? anchors[v](0).slice() : anchors[v].slice()) : null);
    // declared puppets, props and actors are also places (where they were put at the start)
    for (const d of P.puppets.concat(P.props, P.actors)) { const p = placeOf(d.at); if (p && !anchors[d.name]) anchors[d.name] = p; }

    // ----- mistakes the page would only show as a wrong picture: errors with the line to change -----
    {
      const acts = (typeof globalThis !== 'undefined' ? globalThis : {}).CharActions || {};
      const actorNames = P.actors.map(d => d.name);
      const stageX = v => { const p = typeof v === 'number' ? [v] : (anchors[v] && typeof anchors[v] !== 'function' ? anchors[v] : null); return p ? p[0] : null; };
      for (const st of P.statements) if (st.kind === 'actor') for (const c of st.calls) {
        // a body move must end on the stage: 0 .. width
        if (c.moves && c.given && 'to' in c.given) {
          const x = stageX(c.given.to);
          if (x !== null && (x < 0 || x > W)) {
            const edge = x < 0 ? 0 : W, what = typeof c.given.to === 'number' ? '' : ` ('${c.given.to}' is at x=${Math.round(x)})`;
            libDiag.push({ code: 'off-stage', line: st.line, severity: 'error', message: `${st.target}: ${c.name}(to=${c.given.to}) is off the stage${what}; the stage is ${W} wide. Write a place from 0 to ${W}, for example ${c.name}(to=${edge}).` });
          }
        }
        // a pair action needs a partner who is another actor
        const pd = acts[c.name];
        if (pd && typeof pd === 'object' && pd.pair) {
          const w = c.given && c.given.with, others = actorNames.filter(n => n !== st.target);
          const eg = `${c.name}(with=${others[0] || 'Name'})`;
          if (w === undefined || w === '') libDiag.push({ code: 'pair-partner', line: st.line, severity: 'error', message: `${st.target}: ${c.name} needs a partner. Write ${eg}. Actors it could be: ${others.length ? others.join(', ') : '(none, declare a second actor first)'}.` });
          else if (others.indexOf(w) < 0) libDiag.push({ code: 'pair-partner', line: st.line, severity: 'error', message: `${st.target}: ${c.name}(with=${w}) names ${w === st.target ? 'itself' : 'no actor'}.${w === st.target ? '' : CharScript.suggest(w, others)} Write ${eg}. Actors it could be: ${others.length ? others.join(', ') : '(none, declare a second actor first)'}.` });
        }
      }
    }

    // ----- clock: beat grids (tempo) and world freezes -----
    // Script times are real (film) time. Actors, puppets and the water live in world time, which
    // stands still during a freeze: world = real minus the frozen time before it. On a beat grid an
    // actor's pose holds between grid steps and moves quickly into the next one, landing on it.
    const freezes = [], tempos = [];
    for (const st of P.tracks.clock || []) for (const c of st.calls) {
      if (!isFinite(st.t)) continue;
      if (c.name === 'freeze') freezes.push({ t: st.t, d: Math.max(0, +c.args.for || 0) });
      else if (c.name === 'tempo') tempos.push({ t: st.t, bpm: +c.args.bpm || 0, div: Math.max(1, Math.round(+c.args.div || 1)), snap: clamp(+c.args.snap || 0.3, 0.02, 1), who: c.args.who || '' });
    }
    freezes.sort((a, b) => a.t - b.t); tempos.sort((a, b) => a.t - b.t);
    const toWorld = r => { let w = r; for (const f of freezes) w -= clamp(r - f.t, 0, f.d); return w; };
    const toReal = w => { let r = w; for (const f of freezes) if (w > toWorld(f.t) + 1e-9) r += f.d; return r; };
    const gridAt = (name, r) => {
      let g = null;
      for (const q of tempos) if (q.t <= r + 1e-6 && (!q.who || q.who === name)) g = q;
      return g && g.bpm > 0 ? { g: 60 / g.bpm / g.div, snap: g.snap } : null;
    };
    const quant = (name, r) => {
      const G = gridAt(name, r);
      if (!G) return r;
      const g = G.g, sn = G.snap * g, n = Math.ceil(r / g - 1e-7), rn = n * g;
      return (n - 1) * g + (r >= rn - sn ? g * smooth((r - (rn - sn)) / sn) : 0);
    };

    // ----- wind (script target `wind`): amount at real time r, + blows toward +x. Performers read it
    // for their spring chains (hair, scarf, cloth). gust: up in the first quarter, gone by the end.
    const windAt = r => {
      const list = [];
      for (const st of P.tracks.wind || []) for (const c of st.calls) if (isFinite(st.t)) list.push({ t: st.t, c });
      list.sort((a, b) => a.t - b.t);
      let base = 0, g = 0;
      for (const { t, c } of list) {
        if (t > r) break;
        const a = (+c.args.amount || 0) * (c.args.from === 'left' ? 1 : -1), u = (r - t) / Math.max(0.05, +c.args.over || 0);
        if (c.name === 'blow') base = lerp(base, a, smooth(u));
        else if (u < 1) g += a * smooth(u / 0.25) * (1 - smooth((u - 0.35) / 0.65));
      }
      return base + g;
    };

    // ----- actors -----
    // a skin may say extends: '<other skin>' and change only some keys (usually the palette);
    // a key set to null in parts, swaps or chains removes that item of the base skin
    const skinOf = name => {
      const s = lib.skins[name];
      if (!s || !s.extends || !lib.skins[s.extends] || s.extends === name) return s || null;
      const base = skinOf(s.extends);
      const m = Object.assign({}, base, s);
      for (const k of ['palette', 'proportions', 'swaps', 'parts', 'chains', 'build', 'motion', 'springs']) if (base[k] && s[k]) m[k] = Object.assign({}, base[k], s[k]);
      for (const k of ['parts', 'swaps', 'chains']) if (m[k]) { m[k] = Object.assign({}, m[k]); for (const q of Object.keys(m[k])) if (m[k][q] === null) delete m[k][q]; }
      delete m.extends;
      return m;
    };
    const actors = P.actors.map(a => {
      let skin = skinOf(a.skin);
      if (skin && set.silhouette) skin = Object.assign({}, skin, { silhouette: set.silhouette });   // a silhouette set draws every figure in one colour
      const start = placeOf(a.at) || [200, ground(200)];
      const env = { ground, anchors, scale: actorScale * a.scale, x: start[0], facing: a.facing, width: W, height: H,
        grid: w => { const G = gridAt(a.name, toReal(w)); return G ? G.g : 0; },
        wind: w => windAt(toReal(w)) };   // beat grid step (s) at world time w, 0 = none
      return { name: a.name, decl: a, skin, env, events: [], perf: null, P: Perf };
    });
    const actorBy = {};
    actors.forEach(A => { actorBy[A.name] = A; });
    // an actor as a place is where it is at that moment, at the height of its eyes (look, point, reach at it)
    for (const A of actors) {
      const start = anchors[A.name];
      let busy = false;
      anchors[A.name] = t => {
        if (!A.perf || busy || !isFinite(t)) return start;
        busy = true;
        try { const s = A.perf.sample(t); return [s.x, s.y - (s.height || 3 * A.env.scale) * 0.82]; } catch (e) { return start; } finally { busy = false; }
      };
    }
    // the performer wants events sorted by time; A.order maps a source-order index to the sorted one
    const compileActor = A => {
      const idx = A.events.map((e, i) => i).sort((a, b) => A.events[a].t - A.events[b].t || a - b);
      A.order = [];
      idx.forEach((orig, k) => { A.order[orig] = k; });
      A.sorted = idx.map(i => A.events[i]);
      try { return A.P.compile(A.skin, A.sorted, A.env); }
      catch (e) {
        libDiag.push({ code: 'performer', line: A.decl.line, severity: 'error', message: `the performer failed for ${A.name}: ${e.message}. The stand-in is used instead.` });
        A.P = Standin;
        return Standin.compile(A.skin, A.sorted, A.env);
      }
    };

    // ----- puppets: state changes and moves, built in order while times resolve -----
    const puppets = P.puppets.map(p => {
      const def = lib.puppets[p.kind] || null;
      const start = placeOf(p.at) || [300, ground(300)];
      const initial = def ? (def.initial || Object.keys(def.states)[0]) : 'none';
      return { name: p.name, decl: p, def, scale: p.scale, changes: [{ t: -1e9, state: initial }], moves: [], turns: [], start, pending: null, facing0: p.facing };
    });
    const pupBy = {};
    puppets.forEach(p => { pupBy[p.name] = p; });
    function pupPos(U, t) {
      let m = null;
      for (const mm of U.moves) if (mm.t0 <= t) m = mm;
      if (!m) return { x: U.start[0], y: U.start[1], moving: false };
      if (t >= m.t1) return { x: m.to[0], y: m.to[1], moving: false };
      const u = (t - m.t0) / (m.t1 - m.t0);
      let pu;
      if (m.step) { const n = m.n, k = Math.min(n - 1, Math.floor(u * n)), f = u * n - k; pu = (k + smooth(f)) / n; }
      else pu = ease(u);
      const x = lerp(m.from[0], m.to[0], pu);
      let y;
      const onGround = Math.abs(m.from[1] - ground(m.from[0])) < 3 && Math.abs(m.to[1] - ground(m.to[0])) < 3;
      if (m.travel === 'air') y = lerp(m.from[1], m.to[1], pu) - m.arc * Math.sin(Math.PI * pu);
      else y = onGround ? ground(x) : lerp(m.from[1], m.to[1], pu);
      return { x, y, moving: true, dir: Math.sign(m.to[0] - m.from[0]) };
    }
    function pupEnds(st) {
      const U = pupBy[st.target], c = st.calls[0];
      if (!U || !U.def) return [st.t];
      if (U.pending && U.pending.t <= st.t) U.changes.push(U.pending);
      U.pending = null;
      if (c.name === 'turn') { U.turns.push({ t: st.t }); return [st.t + 0.2]; }
      const sd = U.def.states[c.name];
      if (!sd) return [st.t];
      U.changes.push({ t: st.t, state: c.name });
      let end = st.t;
      if (sd.travel && c.args.to !== undefined) {
        const from = pupPos(U, st.t);
        // cut short any move still running
        for (const mm of U.moves) if (mm.t1 > st.t) { mm.to = [from.x, from.y]; mm.t1 = st.t; }
        let to = placeOf(c.args.to) || [from.x, from.y];
        const dist = Math.hypot(to[0] - from.x, to[1] - from.y);
        const mv = { t0: st.t, from: [from.x, from.y], to, travel: sd.travel, arc: sd.travel === 'air' ? Math.min(160, 0.3 * dist + 30) : 0 };
        if (sd.step) { mv.n = Math.max(1, Math.round(dist / (sd.stepLength || 40))); mv.step = sd.step; mv.t1 = st.t + mv.n * sd.step; }
        else mv.t1 = st.t + (c.args.for || dist / (c.args.speed || sd.speed || 200));
        if (dist < 0.5) mv.t1 = st.t;
        U.moves.push(mv);
        end = mv.t1;
      } else if (c.args.for || sd.dur) end = st.t + (c.args.for || sd.dur);
      if (end > st.t && (sd.then || (!sd.loop && !sd.travel))) U.pending = { t: end, state: sd.then || U.changes[0].state, auto: true };
      return [end];
    }

    // ----- paired actions (docs/PAIRS.md): 'A: hug(with=B)' -----
    // A walks (or turns) to the distance the pair file asks for, B turns to face A, then both play their
    // role from the same moment: A 'hug.a', B 'hug.b'. Each role is told how far apart the two stand
    // (apart, in its own head heights), how tall the partner is (size, partner / self) and how heavy
    // (push, partner / self), so keys can kneel for a child or stagger more for a heavier shove.
    const pairDef = name => { const g = typeof globalThis !== 'undefined' ? globalThis : {}; const p = (g.CharActions || {})[name]; return p && p.pair && p.a && p.b ? p : null; };
    function bodyOf(A, smp) {
      const ch = charOf(A.skin), pr = ch.proportions, k = smp.scale || A.env.scale;
      const front = ch.body ? Math.max(...[0.25, 0.4, 0.55, 0.7, 0.85].map(f => ch.body.profile(f * pr.torso).front)) : 0.28;   // the belly counts
      const b = ch.body ? ch.body.b : {}, mot = (A.skin && A.skin.motion) || {};
      const mass = Math.pow(smp.height || 3 * k, 2) * (0.5 + (b.chest || 0.9) + 0.8 * (b.belly || 0)) * (0.7 + 0.6 * (mot.weight === undefined ? 0.5 : mot.weight));
      return { k, front: front * k, arm: (pr.upperArm + pr.foreArm) * k, height: smp.height || 3 * k, mass };
    }
    // speed=2 plays both roles twice as fast; for=s sets the length of the action itself (not the walk-up)
    const roleLen = pd => Math.max(...['a', 'b'].map(r => Math.max(0, ...(pd[r].keys || []).map(k => +k.t || 0))));
    function pairSpeed(c) {
      const pd = pairDef(c.name), f = +c.args.for, sp = +c.args.speed;
      if (f > 0) return Math.max(0.2, Math.min(5, roleLen(pd) / f));
      return sp > 0 ? Math.max(0.2, Math.min(5, sp)) : 1;
    }
    const lastEnd = A => { const i = A.events.length - 1; try { const e = A.perf.end(A.order[i]); return isFinite(e) ? e : A.events[i].t; } catch (e) { return A.events[i].t; } };
    // the closest the two torsos come while both play their roles (px; negative = they overlap)
    // free space between two facing torsos (px; negative = overlap), compared height by height where both
    // torsos are (a child's head does not count); a child's front against a grown-up's knee
    function torsoGap(A, B, sA, sB, side) {
      const la = A.perf.pointOf(sA, 'torsoLine'), lb = B.perf.pointOf(sB, 'torsoLine');
      let g = Infinity;
      for (const p of la) for (let i = 0; i + 1 < lb.length; i++) {
        const q = lb[i], r = lb[i + 1], lo = Math.min(q[1], r[1]), hi = Math.max(q[1], r[1]);
        if (p[1] < lo || p[1] > hi || hi - lo < 1e-6) continue;
        const x = q[0] + (r[0] - q[0]) * (p[1] - q[1]) / (r[1] - q[1]);
        g = Math.min(g, side * x - side * p[0]);
      }
      if (!isFinite(g)) {
        const aHigh = Math.max(...la.map(p => -p[1])) > Math.max(...lb.map(p => -p[1]));
        g = aHigh ? side * B.perf.pointOf(sB, 'torso')[0] - side * A.perf.pointOf(sA, 'knee')[0] : side * B.perf.pointOf(sB, 'knee')[0] - side * A.perf.pointOf(sA, 'torso')[0];
      }
      return g;
    }
    function clearance(A, B, t0, t1, side) {
      let m = Infinity, mc = Infinity, miss = 0, lastT = Infinity;
      // overlap counts until the first touch has landed: after a hit the partner's reaction (a stagger, a fall) is its own
      for (let t = t0; t <= t1 + 1e-6; t += 0.08) { const a = A.perf.sample(t), b = B.perf.sample(t); if ([a, b].some(s => s.contacts && s.contacts.some(q => q.w > 0.99))) { lastT = t; break; } }
      if (!isFinite(lastT)) lastT = t1;   // over the whole role, while a hand is on the partner; how far a hand falls short (px)
      for (let t = t0; t <= t1 + 1e-6; t += 0.08) {
        const sA = A.perf.sample(t), sB = B.perf.sample(t);
        if (!A.perf.pointOf || !B.perf.pointOf) return Infinity;
        const touching = [sA, sB].some(s => s.contacts && s.contacts.some(q => q.w > 0.5));
        const g = torsoGap(A, B, sA, sB, side);
        if (t <= lastT + 0.1 || [sA, sB].some(s => s.contacts && s.contacts.some(q => q.w > 0.99))) m = Math.min(m, g);   // while holding on; after a hit lets go the partner may fall anywhere
        if (touching) mc = Math.min(mc, g);
        if (touching) for (const X of [A, B]) { const s = contactSolve(X, t); for (const q of (s && s.contactErr) || []) if (q.w > 0.99 && !q.reachable) miss = Math.max(miss, q.err * s.scale); }
      }
      return { all: m, touch: isFinite(mc) ? mc : m, miss };
    }
    function playPair(A, B, c, wt, line) {
      if (!A.perf) A.perf = compileActor(A);
      const nA = A.events.length, nB = B.events.length;
      const sA = A.perf.sample(wt), sB = B.perf.sample(wt), bA = bodyOf(A, sA), bB = bodyOf(B, sB);
      const pd = pairDef(c.name), want = (pd.gap === undefined ? 0.5 : +pd.gap) * Math.min(bA.arm, bB.arm);
      let dist = bA.front + bB.front + want, end = wt;
      // the pair file's gap is the closest the torsos come during the action: play it, measure, correct
      // then: torsos never overlap; a hand that falls short brings the two closer while there is room
      const tol = 0.03 * Math.min(bA.k, bB.k);
      const tried = [];
      const replay = dd => { A.events.length = nA; B.events.length = nB; A.perf = compileActor(A); B.perf = compileActor(B); return placePair(A, B, c, wt, line, dd, bA, bB); };
      for (let i = 0; i < 6; i++) {
        const r = replay(dist);
        end = r.end;
        const m = clearance(A, B, r.t, r.end, r.side);
        if (!isFinite(m.touch)) break;
        tried.push({ dist, end, bad: (m.all < -tol ? 1e6 + -m.all : 0) + Math.max(0, m.miss - tol) });
        let d = 0;
        if (m.all < -tol) d = -m.all;
        else if (m.miss > tol && m.all > tol) d = -Math.min(m.miss, m.all);
        else if (Math.abs(want - m.touch) > tol && !(m.miss > tol && want > m.touch)) d = want - m.touch;
        if (Math.abs(d) < tol) break;
        dist += d;
      }
      // keep the best try: no overlap first, then the hands closest to their targets
      const best = tried.reduce((p, q) => q.bad < p.bad - 1e-6 ? q : p, tried[tried.length - 1] || { dist });
      if (tried.length && best !== tried[tried.length - 1]) end = replay(best.dist).end;
      // the release leaves them apart: if they would stand closer than a third of an arm, A steps back
      if (A.perf.pointOf && B.perf.pointOf) {
        const side = Math.sign(B.perf.sample(end).x - A.perf.sample(end).x) || 1, rest = Math.max(0.35 * Math.min(bA.arm, bB.arm), want);
        const g = torsoGap(A, B, A.perf.sample(end + 0.3), B.perf.sample(end + 0.3), side);
        if (isFinite(g) && g < rest - tol) {
          const prA = charOf(A.skin).proportions, Lpx = (prA.thigh + prA.shin) * bA.k;
          A.events.push({ t: end, action: 'stepback', args: { dist: Math.max(0.15, Math.min(1.5, (rest - g) / Lpx)) }, line });
          A.perf = compileActor(A); end = Math.max(end, lastEnd(A));
        }
      }
      return end;
    }
    // get A to x facing 'side': a walk when it is more than a leg length away, else a turn and one or two
    // small steps (forward or back), so a short adjustment does not cost a whole walk
    function approach(A, sA, tx, side, t, line) {
      const pr = charOf(A.skin).proportions, Lpx = (pr.thigh + pr.shin) * (sA.scale || A.env.scale), d = tx - sA.x;
      const hasStep = !!((typeof globalThis !== 'undefined' ? globalThis : {}).CharActions || {}).stepback;   // actions/stepback.js loaded (pages made by check.cjs always load it)
      if (Math.abs(d) > (hasStep ? 1.0 : 0.1) * Lpx) { A.events.push({ t, action: 'walk', args: { to: tx }, line }); A.perf = compileActor(A); t = lastEnd(A); }
      if ((A.perf.sample(t).facing || 1) !== side) { A.events.push({ t, action: 'turn', args: {}, line }); A.perf = compileActor(A); t = lastEnd(A); }
      const d2 = tx - A.perf.sample(t).x;
      if (hasStep && Math.abs(d2) > 0.06 * Lpx && Math.abs(d2) <= 1.05 * Lpx) { A.events.push({ t, action: 'stepback', args: { dist: -(d2 * side) / Lpx }, line }); A.perf = compileActor(A); t = lastEnd(A); }
      return t;
    }
    function placePair(A, B, c, wt, line, dist, bA, bB) {
      const sA = A.perf.sample(wt), sB = B.perf.sample(wt);
      const side = Math.sign(sB.x - sA.x) || sA.facing || 1;
      const tx = sB.x - side * dist;
      let t = approach(A, sA, tx, side, wt, line);
      if ((B.perf.sample(t).facing || 1) !== -side) { B.events.push({ t: Math.max(wt, t - 0.35), action: 'turn', args: {}, line }); B.perf = compileActor(B); t = Math.max(t, lastEnd(B)); }
      const xA = A.perf.sample(t).x, xB = B.perf.sample(t).x, apart = Math.abs(xB - xA);
      const extra = Object.assign({}, c.args); delete extra.with;
      extra.speed = pairSpeed(c); delete extra.for;
      const clampR = v => Math.max(0.2, Math.min(5, v));
      A.events.push({ t, action: c.name + '.a', args: Object.assign({}, extra, { with: B.name, apart: apart / bA.k, size: bB.height / bA.height, push: clampR(bB.mass / bA.mass) }), line });
      B.events.push({ t, action: c.name + '.b', args: Object.assign({}, extra, { with: A.name, apart: apart / bB.k, size: bA.height / bB.height, push: clampR(bA.mass / bB.mass) }), line });
      A.perf = compileActor(A); B.perf = compileActor(B);
      const end = Math.max(lastEnd(A), lastEnd(B));
      pairProps(A, B, Object.assign({ line }, c), t);
      return { t, side, end };
    }

    // ----- props in actions (docs/PROPS.md) -----
    const flights = [];   // { prop, t0, t1, A, B }: a thrown prop between a release and a catch
    const propDecl = n => n ? P.props.find(p => p.name === n) || null : null;
    const propDefOf = pd => pd ? (lib.props || {})[pd.kind] || null : null;
    const keyTime = (def, test) => { const k = (def && def.keys || []).find(test); return k ? +k.t : null; };
    // the moments a pair's roles hand over, throw or catch a prop: keys with give / take / release / catch
    // a giver or thrower who does not hold the prop yet picks it up first (from where it lies)
    function holding(A, pr, t) {
      let h = false;
      for (const e of A.events.slice().sort((p, q) => p.t - q.t)) if (e.t <= t + 1e-6) { if (e.action === 'hold') h = e.args.prop === pr; else if (e.action === 'drop') h = false; }
      return h;
    }
    function ensureHeld(A, c, wt, line) {
      const pdf = pairDef(c.name), pr = c.args.prop;
      if (!pr || !propDecl(pr) || !keyTime(pdf.a, k => k.give || k.release)) return wt;
      if (!A.perf) A.perf = compileActor(A);
      if (holding(A, pr, wt)) return wt;
      const e = playProp(A, { name: 'pickup', args: { prop: pr } }, wt, line);
      return e === null ? wt : e;
    }
    function pairProps(A, B, c, t) {
      const pdf = pairDef(c.name), pr = c.args.prop, pd = propDecl(pr);
      if (!pd) return;
      const tsA = 1 / pairSpeed(c), tsB = tsA;   // paired roles share one clock
      const tg = keyTime(pdf.a, k => k.give || k.release), tk = keyTime(pdf.b, k => k.take || k.catch);
      if (tg === null || tk === null) return;
      const def = propDefOf(pd), weight = def && def.weight || 0;
      A.events.push({ t: t + tg * tsA, action: 'drop', args: { quiet: 1 }, line: c.line });
      B.events.push({ t: t + tk * tsB, action: 'hold', args: { prop: pr, how: 'front', weight, quick: 1 }, line: c.line });   // taken from the hand: no reach, no jump
      if (keyTime(pdf.a, k => k.release) !== null) flights.push({ prop: pr, t0: t + tg * tsA, t1: t + tk * tsB, A, B });
      A.perf = compileActor(A); B.perf = compileActor(B);
    }
    // 'A: pickup(prop=box)' walks to the prop and takes it at the key marked grab (or the first that
    // reaches the ground); 'A: sit(on=chair)' sits on a seat prop; 'A: knock(on=door)' stands at the
    // action's wall distance from an upright prop. Returns the end time, or null when not a prop call.
    function playProp(A, c, wt, line) {
      const pd = propDecl(c.args.prop) || propDecl(c.args.on), def = propDefOf(pd);
      if (!pd || !def) return null;
      if (!A.perf) A.perf = compileActor(A);
      const g = typeof globalThis !== 'undefined' ? globalThis : {}, adef = (g.CharActions || {})[c.name] || null;
      const place = pd.at !== null ? placeOf(pd.at) : null;
      if (!place) return null;
      const s0 = A.perf.sample(wt), b = bodyOf(A, s0), Lpx = (charOf(A.skin).proportions.thigh + charOf(A.skin).proportions.shin) * b.k;
      const args = Object.assign({}, c.args); delete args.prop; delete args.on;
      let tx, face = 0;
      const side = Math.sign(place[0] - s0.x) || s0.facing || 1;
      if (c.name === 'sit' && def.seat) {   // the sitter's back to the chair's back (the chair faces +x)
        tx = place[0] + 0.12 * Lpx; face = 1;
        args.on = Math.max(1, (def.base ? def.base[1] : 0) - def.seat[1]);
      } else if (def.upright && adef && adef.wall !== undefined) tx = place[0] - side * (+adef.wall) * Lpx;
      else if (adef && c.args.prop) tx = place[0] - side * (b.front + 0.3 * b.arm);
      else return null;
      const n0 = A.events.length;
      let t, end;
      const go = () => {
        A.events.length = n0; A.perf = compileActor(A); t = approach(A, s0, tx, face || side, wt, line);
        A.events.push({ t, action: c.name, args, line }); A.perf = compileActor(A);
        end = lastEnd(A);
      };
      go();
      for (let i = 0; face && A.perf.pointOf && i < 3; i++) {   // seated: the hips land over the seat (measured, corrected)
        const hip = A.perf.pointOf(A.perf.sample(end + 0.5), 'hip'), dx = place[0] + (def.seat[0] || 0) - hip[0];
        if (Math.abs(dx) < 0.05 * b.k) break;
        tx += dx; go();
      }
      if (c.args.prop && adef) {
        const kg = keyTime(adef, k => k.grab) ?? keyTime(adef, k => [k.handNear, k.handFar].some(h => h === 'ground' || (Array.isArray(h) && h[0] === 'ground')));
        if (kg !== null) { A.events.push({ t: t + kg * (A.perf.timeScale || 1), action: 'hold', args: { prop: pd.name, how: 'front', weight: def.weight || 0 }, line }); A.perf = compileActor(A); }
      }
      return end;
    }

    // ----- resolve times with exact ends -----
    CharScript.timeline(P, st => {
      if (st.kind === 'actor') {
        const A = actorBy[st.target];
        if (!A) return [st.t];
        const wt = toWorld(st.t);
        const withB = c => { const B = c.args && actorBy[c.args.with]; if (!pairDef(c.name) || !B || B === A) return null; if (!B.perf) B.perf = compileActor(B); return B; };
        const propCall = c => !withB(c) && (propDecl(c.args && c.args.prop) || propDecl(c.args && c.args.on));
        if (st.calls.some(withB) || st.calls.some(propCall)) return st.calls.map(c => {
          const B = withB(c);
          if (B) return toReal(playPair(A, B, c, ensureHeld(A, c, wt, st.line), st.line));
          if (propCall(c)) { const e = playProp(A, c, wt, st.line); if (e !== null) return toReal(e); }
          A.events.push({ t: wt, action: c.name, args: Object.assign({}, c.args), line: st.line }); A.perf = compileActor(A);
          return toReal(lastEnd(A));
        });
        const first = A.events.length;
        for (const c of st.calls) A.events.push({ t: wt, action: c.name, args: Object.assign({}, c.args), line: st.line });
        A.perf = compileActor(A);
        return st.calls.map((c, i) => { try { const e = A.perf.end(A.order[first + i]); return isFinite(e) ? toReal(e) : st.t; } catch (e) { return st.t; } });
      }
      if (st.kind === 'puppet') return pupEnds(Object.assign({}, st, { t: toWorld(st.t) })).map(toReal);
      return CharScript.builtinEnds(st);
    });
    for (const U of puppets) if (U.pending) U.changes.push(U.pending);
    for (const A of actors) if (!A.perf) A.perf = compileActor(A);
    const duration = P.film.duration || Math.ceil((P.contentEnd || 0) + 1);

    const diagnostics = P.diagnostics.concat(libDiag);
    for (const A of actors) for (const d of (A.perf.diagnostics || [])) diagnostics.push(Object.assign({ severity: d.severity || 'warning' }, d, { message: `${A.name}: ${d.message}` }));
    if (Perf === Standin && actors.length) diagnostics.push({ code: 'standin', line: 0, severity: 'info', message: 'CharPerform is not loaded; actors use the stand-in performer (stand, walk, run, sneak, turn, hold, wave).' });

    // contacts (docs/PAIRS.md): after each body has done everything else (breath, springs, mood), a hand
    // that a key puts on a partner is moved onto that partner's landmark as the partner is drawn
    function contactSolve(A, w) {
      const s = A.perf.sample(w);
      if (!s || !s.contacts || !A.perf.reach) return s;
      if (A._cs && A._cs.w === w && A._cs.perf === A.perf) return A._cs.smp;
      const out = Object.assign({}, s, { pose: Object.assign({}, s.pose, { arms: { near: Object.assign({}, s.pose.arms.near), far: Object.assign({}, s.pose.arms.far) } }) });
      const order = s.contacts.slice().sort((p, q) => (p.at === 'hand' || p.at === 'arm') - (q.at === 'hand' || q.at === 'arm'));
      for (const c of order) {
        const B = actorBy[c.who];
        if (!B || !B.perf || !B.perf.pointOf) continue;
        const sB = B.perf.sample(w);
        let P, own = false;   // own: the point already carries this hand's offsets
        if (c.at === 'hand' || c.at === 'arm') {   // a hand meeting a hand: both go to the middle; else to the partner's hand as drawn
          const mutual = sB.contacts && sB.contacts.find(q => q.who === A.name && (q.at === 'hand' || q.at === 'arm'));
          if (mutual && c.at === 'hand' && mutual.at === 'hand') {   // hands meet halfway, at the shorter one's chest (plus both keys' offsets, averaged)
            const a = A.perf.pointOf(s, 'shoulder', c.side), b = B.perf.pointOf(sB, 'shoulder', mutual.side), kk = Math.min(s.scale, sB.scale);
            const fa = A.perf.pointOf(s, 'torso'), fb = B.perf.pointOf(sB, 'torso');   // halfway between the two fronts
            P = [(fa[0] + fb[0]) / 2, Math.max(a[1], b[1]) + 0.55 * kk - (c.dy * s.scale + mutual.dy * sB.scale) / 2]; own = true;
            // a point both arms reach, if there is one (alternate projections onto the two reach circles)
            const sa = A.perf.pointOf(s, 'shoulderJoint', c.side), sb = B.perf.pointOf(sB, 'shoulderJoint', mutual.side), ra = 0.95 * (A.perf.armReach || 1e9), rb = 0.95 * (B.perf.armReach || 1e9);
            for (let i = 0; i < 6; i++) for (const [o, r] of [[sa, ra], [sb, rb]]) { const d = Math.hypot(P[0] - o[0], P[1] - o[1]); if (d > r) P = [o[0] + (P[0] - o[0]) * r / d, o[1] + (P[1] - o[1]) * r / d]; }
          }
          else {
            const sB2 = mutual ? sB : contactSolve(B, w), act = sB2.contacts && sB2.contacts.find(q => q.who === A.name);
            P = B.perf.pointOf(sB2, c.at, act ? act.side : 'near');
          }
        } else if (c.at === 'front') {   // the partner's front (body or knee) at my own shoulder height: what a child reaches on a grown-up
          const sh = A.perf.pointOf(s, 'shoulderJoint', c.side), lb = B.perf.pointOf(sB, 'torsoLine');
          // the nearest point of the partner's front (torso line, knee) to my shoulder
          const cand = [B.perf.pointOf(sB, 'knee', 'near')];
          for (let i = 0; i + 1 < lb.length; i++) for (let u = 0; u <= 1; u += 0.25) cand.push([lb[i][0] + (lb[i + 1][0] - lb[i][0]) * u, lb[i][1] + (lb[i + 1][1] - lb[i][1]) * u]);
          P = cand.reduce((p, q) => Math.hypot(q[0] - sh[0], q[1] - sh[1]) < Math.hypot(p[0] - sh[0], p[1] - sh[1]) ? q : p);
        } else if (c.at === 'around') {   // round the partner's body at my own shoulder height (kept within their torso)
          const fl = B.perf.pointOf(sB, 'side', 'near'), lo = B.perf.pointOf(sB, 'waist', 'near')[1], hi = B.perf.pointOf(sB, 'shoulder', 'near')[1] + 0.1 * sB.scale;
          const my = A.perf.pointOf(s, 'shoulder', c.side)[1] + 0.65 * s.scale;
          P = [fl[0], Math.max(hi, Math.min(lo, my))];
          // as far round as this arm goes: a short arm stops on the partner's near side
          const sh = A.perf.pointOf(s, 'shoulderJoint', c.side), Rr = 0.95 * (A.perf.armReach || 1e9), dx = P[0] - sh[0], dy = P[1] - sh[1];
          if (Math.hypot(dx, dy) > Rr) P = Math.abs(dy) < Rr ? [sh[0] + Math.sign(dx) * Math.sqrt(Rr * Rr - dy * dy), P[1]] : [sh[0] + dx * Rr / Math.hypot(dx, dy), sh[1] + dy * Rr / Math.hypot(dx, dy)];
        } else P = B.perf.pointOf(sB, c.at, 'near');
        if (!P) continue;
        if (!own) P = [P[0] + s.facing * c.dx * s.scale, P[1] - c.dy * s.scale];
        const w0 = out.held && out.held.hand === c.side && Array.isArray(out.held.joint) ? A.perf.pointOf(out, 'hand', c.side) : null;
        if (c.side === 'near') out.pose = Object.assign({}, out.pose, { cane: null, caneTuck: Math.max(out.pose.caneTuck || 0, c.w) });   // a walking stick in a busy hand is tucked
        const ok = A.perf.reach(out, c.side, P, c.w);
        const wr = A.perf.pointOf(out, 'hand', c.side);
        (out.contactErr = out.contactErr || []).push({ side: c.side, at: c.at, w: c.w, reachable: ok, err: Math.hypot(wr[0] - P[0], wr[1] - P[1]) / s.scale });
        if (w0) { const w1 = A.perf.pointOf(out, 'hand', c.side); out.held = Object.assign({}, out.held, { joint: [out.held.joint[0] + w1[0] - w0[0], out.held.joint[1] + w1[1] - w0[1]] }); }
      }
      A._cs = { w, smp: out, perf: A.perf };
      return out;
    }
    // a prop with two grips (a box): the far hand goes to its far grip, wherever the near hand holds it
    function gripSolve(A, s) {
      if (!s || !s.held || !s.held.prop || !A.perf.reach || !Array.isArray(s.held.joint)) return s;
      const pd = P.props.find(p => p.name === s.held.prop), def = pd && (lib.props || {})[pd.kind];
      if (!def || !def.grips || !def.grips.far || !def.grips.near) return s;
      const f = s.facing || 1, hp = s.held.joint, g0 = def.grips.near, g1 = def.grips.far;
      const out = Object.assign({}, s, { pose: Object.assign({}, s.pose, { arms: { near: Object.assign({}, s.pose.arms.near), far: Object.assign({}, s.pose.arms.far) } }) });
      A.perf.reach(out, 'far', [hp[0] + f * (g1[0] - g0[0]), hp[1] + (g1[1] - g0[1])], 1);
      return out;
    }
    const sampleActor = (A, t) => gripSolve(A, contactSolve(A, toWorld(quant(A.name, t))));   // real time -> what is drawn
    const drawActor = (A, smp) => (A.P.draw || Standin.draw)(A.skin, smp);
    const handOf = (A, smp) => {
      if (A.P.hand) { const h = A.P.hand(A.skin, smp); if (h) return h; }
      if (smp.held && Array.isArray(smp.held.joint)) return smp.held.joint;   // CharPerform gives the grip point in stage px
      const j = jointsOf(A.skin, smp, A.env.scale, A.P.standin);
      if (!j) return [smp.x, smp.y - 100];
      const side = smp.held && /far/.test(smp.held.joint || '') ? 'far' : 'near';
      return j.hands[side];
    };

    // ----- props -----
    const props = P.props.map(pd => {
      const def = lib.props[pd.kind] || null;
      const holds = [];
      for (const A of actors) {
        let cur = null;
        for (const ev of A.events.slice().sort((a, b) => a.t - b.t)) {
          if (ev.action === 'hold') { if (cur) { cur.t1 = ev.t; cur = null; } if (ev.args.prop === pd.name) { cur = { A, t0: ev.t, t1: Infinity }; holds.push(cur); } }
          else if (ev.action === 'drop' && cur) { cur.t1 = ev.t; cur = null; }
        }
      }
      holds.sort((a, b) => a.t0 - b.t0);
      // the moment the performer's hand actually closes on it (after its reach), found once here
      for (const h of holds) {
        h.attach = Infinity;
        for (let t = h.t0; t < Math.min(h.t1, h.t0 + 4); t += 1 / 60) {
          const s = h.A.perf.sample(t);
          if (s.held && s.held.prop === pd.name) { h.attach = t; break; }
        }
      }
      return { name: pd.name, decl: pd, def, rest: pd.at !== null ? placeOf(pd.at) : null, holds };
    });
    // where the grip of a prop is while nobody holds it: its start place, or where it was dropped
    function looseAt(R, t) {   // t: world time
      const base = (R.def && R.def.base) || [0, 0];
      for (const f of flights) if (f.prop === R.name && t >= f.t0 && t <= f.t1 + 0.3) {   // thrown: an arc from hand to hand
        const p0 = handOf(f.A, sampleActor(f.A, toReal(f.t0))), p1 = handOf(f.B, sampleActor(f.B, toReal(f.t1)));
        const u = clamp((t - f.t0) / Math.max(0.05, f.t1 - f.t0), 0, 1), hgt = 0.25 * Math.abs(p1[0] - p0[0]) + 20;
        return [lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u) - 4 * hgt * u * (1 - u)];
      }
      let last = null;
      for (const hh of R.holds) if (hh.t1 <= t && hh.attach < hh.t1) last = hh;
      if (last) {   // dropped: falls from the hand to the ground under it
        const hp = handOf(last.A, last.A.perf.sample(last.t1 - 1e-3));
        const gy = ground(hp[0]) - base[1], u = clamp((t - last.t1) / 0.35, 0, 1);
        return [hp[0], lerp(hp[1], gy, u * u)];
      }
      return R.rest ? [R.rest[0], R.rest[1] - base[1]] : null;
    }
    function propState(R, t) {   // t: real time; holds are in world time
      const w = toWorld(t);
      let h = null;
      for (const hh of R.holds) if (hh.t0 <= w && w < hh.t1) h = hh;
      if (h && w >= h.attach) {
        const smp = sampleActor(h.A, t);
        let hp = handOf(h.A, smp), swing = 0;
        if (R.def && R.def.hang) {   // a hanging prop trails the hand: lagged horizontal velocity
          const a = handOf(h.A, sampleActor(h.A, Math.max(0, t - 0.16))), b = handOf(h.A, sampleActor(h.A, Math.max(0, t - 0.06)));
          swing = clamp(-(b[0] - a[0]) * 1.2, -28, 28) + 3 * Math.sin(t * 2.3);
        } else swing = (smp.held && smp.held.angle) || 0;   // degrees in stage space
        const u = (w - h.attach) / 0.2, from = u < 1 ? looseAt(R, h.attach) : null;
        if (from) { const e = smooth(u); hp = [lerp(from[0], hp[0], e), lerp(from[1], hp[1], e)]; swing *= e; }   // picked up, not teleported
        if (R.def && R.def.grips && R.def.grips.near) { const f = smp.facing || 1, g = R.def.grips.near; hp = [hp[0] - f * g[0], hp[1] - g[1]]; swing = 0; }   // two-handed: the near hand on its grip
        return { held: true, at: hp, swing };
      }
      const p = looseAt(R, w);
      return p ? { held: false, at: p, swing: 0 } : null;
    }

    // ----- camera -----
    const camSet = set.camera || {};
    const sc = actorScale / 68;
    const home = { x: camSet.x !== undefined ? camSet.x : FW / 2, focusY: camSet.focusY !== undefined ? camSet.focusY : null,
      lift: camSet.lift || [54 * sc, 192 * sc] };   // centre = ground - lift[0] - lift[1] / zoom
    const posMoves = [], zoomMoves = [], shakes = [], fades = [], frames = [];
    for (const st of P.tracks.cam || []) for (const c of st.calls) {
      if (c.name === 'pan') posMoves.push({ t: st.t, kind: 'pan', to: c.args.to, over: c.args.over });
      else if (c.name === 'follow') posMoves.push({ t: st.t, kind: 'follow', target: c.args.target, over: c.args.over });
      else if (c.name === 'cut') { posMoves.push({ t: st.t, kind: 'pan', to: c.args.to, over: 0 }); if (c.args.zoom) zoomMoves.push({ t: st.t, to: c.args.zoom, over: 0 }); }
      else if (c.name === 'zoom') zoomMoves.push({ t: st.t, to: Math.max(1, c.args.to), over: c.args.over });
      else if (c.name === 'shake') shakes.push({ t: st.t, amount: c.args.amount, over: c.args.over });
      else if (c.name === 'fade') fades.push({ t: st.t, to: c.args.dir === 'out' ? 1 : 0, over: c.args.over });
      else if (c.name === 'frame' || c.name === 'home') frames.push(Object.assign({ t: st.t, kind: c.name }, c.args));
    }
    // depth-aware zoom (set field dolly: true): the camera moves closer instead of magnifying, so a
    // layer of depth d < 1 grows by 1 / (1 - d (1 - 1/z)) (the sky hardly at all); d >= 1 and the
    // actors keep 1 + (z - 1) d (= z at d = 1). Without the field every layer grows by 1 + (z - 1) d.
    const dolly = !!(set.dolly || camSet.dolly);
    const layerZ = (z, d) => dolly && d < 1 ? 1 / Math.max(0.12, 1 - d * (1 - 1 / z)) : 1 + (z - 1) * d;
    // frame(on, top, bottom, x): a close-up that tracks an actor; home() goes back to the base camera
    const levelsOf = A => {
      const chA = charOf(A.skin), pr = chA.proportions, k = A.perf.scale || 1, R0 = dep('CharRig', './rig.js');
      // the real top of the drawing (a hat, a bun) rather than the head's nominal top
      const H0 = (A.perf.height || 3 * k) / k, Hh = H0 + (R0.headTopOf ? Math.max(0, R0.headTopOf(chA) - (chA.headTop || 1.04)) : 0);
      const kn = pr.ankleHeight + pr.shin, hip = kn + pr.thigh, nb = hip + pr.torso;
      return { k, H0, lv: { feet: 0, knee: kn, thigh: kn + 0.45 * pr.thigh, hip, waist: hip + 0.3 * pr.torso, chest: hip + 0.75 * pr.torso, chin: nb + pr.neck + 0.12 * pr.head, head: Hh } };
    };
    // two actors: both whole from the higher head top (plus hands raised over it) to the feet, side by side
    function frameTwo(m, t, names) {
      const box = [Infinity, Infinity, -Infinity, -Infinity];
      for (const n of names) {
        const A = actorBy[n];
        if (!A || !A.perf) return null;
        const { k, lv } = levelsOf(A), s = sampleActor(A, t), j = jointsOf(A.skin, s, A.env.scale, A.P.standin), reach = (A.perf.armReach || 1.2 * k);
        const pts = [[s.x - 0.5 * k, s.y - k * lv.head], [s.x + 0.5 * k, s.y]];
        if (j) for (const sd of ['near', 'far']) pts.push(j.hands[sd]);
        for (const p of pts) { box[0] = Math.min(box[0], p[0]); box[1] = Math.min(box[1], p[1]); box[2] = Math.max(box[2], p[0]); box[3] = Math.max(box[3], p[1]); }
        void reach;
      }
      const pad = 1 + Math.max(0.3, +m.pad || 0), w = (box[2] - box[0]) * pad, h = (box[3] - box[1]) * pad;   // at least 30% room round the two
      const z = Math.max(1, Math.min(FH / h, FW / w));
      return { x: (box[0] + box[2]) / 2, y: (box[1] + box[3]) / 2, z };
    }
    function frameView(m, t) {
      if (String(m.on).includes('+')) return frameTwo(m, t, String(m.on).split('+'));
      const A = actorBy[m.on];
      if (!A || !A.perf) return null;
      const { k, H0, lv } = levelsOf(A), smp = A.perf.sample(toWorld(t));
      const a = lv[m.top] !== undefined ? lv[m.top] : lv.head, b = lv[m.bottom] !== undefined ? lv[m.bottom] : lv.thigh;
      const hi = Math.max(a, b), lo = Math.min(a, b), z = Math.max(1, FH / (k * (hi - lo) * (1 + (m.pad === undefined ? 0.1 : Math.max(0, +m.pad))) + 1));
      // a close-up follows where the head really is (a stoop, a bow, a lean), not just the standing levels
      let hx = 0, hy = 0;
      if (!A.P.standin && smp.pose && smp.pose.root) {
        const R = dep('CharRig', './rig.js'), sol = R.solve(charOf(A.skin), smp.pose), J = sol.joints, ha = sol.angles.head, sq = smp.pose.squash || [1, 1];
        const hc = [J.headBase[0] - 0.5 * Math.sin(ha), J.headBase[1] + 0.5 * Math.cos(ha)];   // head centre, rig units
        const w = clamp(((hi + lo) / 2 - lv.hip) / Math.max(0.01, H0 - 0.5 - lv.hip), 0, 1);
        hx = smp.facing * k * sq[0] * hc[0] * w; hy = (-k * sq[1] * hc[1] + k * (H0 - 0.5)) * w;
      }
      return { x: smp.x + hx - ((+m.x || 0) * FW - FW / 2) / z, y: smp.y - k * (hi + lo) / 2 + hy, z };
    }
    const mixView = (p, q, u) => ({ x: lerp(p.x, q.x, u), y: lerp(p.y, q.y, u), z: Math.exp(lerp(Math.log(p.z), Math.log(q.z), u)) });
    function framedAt(i, t, base) {   // view if frames[i] were the last command, or null = base camera
      if (i < 0) return null;
      const m = frames[i], u = m.over > 0 ? ease((t - m.t) / m.over) : 1;
      const to = m.kind === 'frame' ? frameView(m, t) : null;
      if (u >= 1) return to;
      const from = framedAt(i - 1, t, base) || base;
      return mixView(from, to || base, u);
    }
    const thingX = (name, t) => {
      if (actorBy[name]) return actorBy[name].perf.sample(toWorld(t)).x;   // smooth: the camera does not snap to the beat
      if (pupBy[name]) return pupPos(pupBy[name], toWorld(t)).x;
      const p = placeOf(name);
      return p ? p[0] : null;
    };
    function tween(list, t, initial, valueOf) {   // sequential tweens; each starts from where the last one was
      let v = initial;
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (m.t > t) break;
        if (m.from === undefined) m.from = tween(list.slice(0, i), m.t, initial, valueOf);
        const target = valueOf ? valueOf(m, t) : m.to;
        const u = m.over > 0 ? (t - m.t) / m.over : 1;
        v = lerp(m.from, target === null ? m.from : target, ease(u));
      }
      return v;
    }
    const camX = t => tween(posMoves, t, home.x, (m, tt) => m.kind === 'follow' ? thingX(m.target, tt) : (typeof m.to === 'number' ? m.to : thingX(m.to, tt)));
    function camera(t) {
      const z = Math.max(1, tween(zoomMoves, t, 1));
      const want = camX(t);
      const hw = FW / 2 / z, hh = FH / 2 / z;
      // height: follows the ground under the camera. Zoom 1-2 keeps whole actors in frame with
      // the ground near the bottom; above that it frames the upper body (a close-up).
      let x = clamp(want, hw, W - hw);
      let y = clamp(home.focusY !== null ? home.focusY : ground(x) - home.lift[0] - home.lift[1] / z, hh, H - hh);
      let zz = z;
      if (frames.length) {
        let i = -1;
        for (let j = 0; j < frames.length; j++) if (frames[j].t <= t) i = j;
        const f = framedAt(i, t, { x, y, z });
        if (f) { zz = Math.max(1, f.z); x = clamp(f.x, FW / 2 / zz, W - FW / 2 / zz); y = clamp(f.y, FH / 2 / zz, H - FH / 2 / zz); }
      }
      let sx = 0, sy = 0;
      for (const sk of shakes) if (t >= sk.t && t < sk.t + sk.over) {
        const a = sk.amount * Math.pow(1 - (t - sk.t) / sk.over, 2);
        sx += a * (0.6 * Math.sin(t * 47.3) + 0.4 * Math.sin(t * 83.1 + 1.3));
        sy += a * (0.6 * Math.sin(t * 53.9 + 0.7) + 0.4 * Math.sin(t * 71.7 + 2.1));
      }
      return { x, y, z: zz, sx, sy, want, clamped: !frames.length && Math.abs(want - x) > 2 ? want - x : 0 };
    }
    const fadeAt = t => clamp(tween(fades, t, 0), 0, 1);
    function toScreen(p, cam, depth) {
      const d = depth === undefined ? 1 : depth, zd = layerZ(cam.z, d);
      const cx = FW / 2 + (cam.x - FW / 2) * d, cy = FH / 2 + (cam.y - FH / 2) * d;
      return [(p[0] - cx) * zd + FW / 2 + cam.sx, (p[1] - cy) * zd + FH / 2 + cam.sy];
    }
    function layerTransform(cam, d) {
      const zd = layerZ(cam.z, d), cx = FW / 2 + (cam.x - FW / 2) * d, cy = FH / 2 + (cam.y - FH / 2) * d;
      return `translate(${fx(FW / 2 + cam.sx)} ${fx(FH / 2 + cam.sy)}) scale(${fx(zd * 1000) / 1000}) translate(${fx(-cx)} ${fx(-cy)})`;
    }

    // ----- captions and cards -----
    const caps = [], cards = [];
    for (const st of P.tracks.caption || []) for (const c of st.calls) caps.push({ t: st.t, line: st.line, name: c.name, args: c.args });
    for (const st of P.tracks.card || []) for (const c of st.calls) cards.push({ t: st.t, args: c.args });
    function activeCaptions(t) {
      const slots = {};
      for (let i = 0; i < caps.length; i++) {
        const c = caps[i];
        if (c.t > t) continue;
        if (c.name === 'clear') { for (const k of Object.keys(slots)) if (slots[k].t1 > c.t) slots[k].t1 = c.t; continue; }
        const slot = c.args.by ? 'by:' + c.args.by : c.args.at;
        slots[slot] = { c, t0: c.t, t1: c.t + c.args.for };   // a new caption in the same place replaces the old one
      }
      return Object.values(slots).filter(s => t < s.t1).map(s => Object.assign({}, s, { a: Math.min(smooth((t - s.t0) / 0.2), smooth((s.t1 - t) / 0.25)) }));
    }

    const staticCache = {};
    const layers = (set.layers || []).slice().sort((a, b) => a.depth - b.depth);
    // contacts: every moment a foot touches down on or lifts off the ground, in world time, found
    // once by sampling (sets use them for ripples and splashes). { t, x, y, kind: down|up, speed px/s, air (s in the air before a touch-down), actor, facing }
    let contactCache = null;
    function contacts() {
      if (contactCache) return contactCache;
      const out = [], dt = 1 / 60, wEnd = toWorld(duration);
      for (const A of actors) {
        const prev = {};
        for (let i = 0; i * dt <= wEnd + 1e-9; i++) {
          const w = i * dt, smp = A.perf.sample(w), j = jointsOf(A.skin, smp, A.env.scale, A.P.standin);
          if (!j) continue;
          for (const side of ['near', 'far']) {
            const f = j.feet[side], mx = (f.heel[0] + f.toe[0]) / 2, h = ground(mx) - f.low;
            const p = prev[side] || (prev[side] = { h, on: h <= 1.5 });
            const v = (p.h - h) / dt;   // + = moving down
            if (!p.on && h <= 1.5) { p.on = true; out.push({ t: w, x: mx, y: ground(mx), kind: 'down', speed: Math.max(0, v, p.vd || 0), air: w - (p.up || 0), actor: A.name, facing: smp.facing }); }
            else if (p.on && h > 3) { p.on = false; p.up = w; out.push({ t: w, x: mx, y: ground(mx), kind: 'up', speed: Math.max(0, -v), actor: A.name, facing: smp.facing }); }
            p.vd = Math.max(0, v); p.h = h;
          }
        }
      }
      contactCache = out.sort((a, b) => a.t - b.t);
      return contactCache;
    }
    // ctx.t is real time (skies keep moving through a freeze); ctx.wt is world time (water, splashes)
    const ctxOf = t => ({ t, wt: toWorld(t), W, H, pal, ground, anchors, variant: variantName, contacts });

    function drawCaption(s, cam) {
      const { c, a } = s;
      if (a <= 0.01) return '';
      if (c.args.by) {
        let head = null;
        if (actorBy[c.args.by]) {
          const A = actorBy[c.args.by], smp = sampleActor(A, s.tNow);
          const j = jointsOf(A.skin, smp, A.env.scale, A.P.standin);
          head = smp.height ? [j ? j.head[0] : smp.x, smp.y - smp.height] : (j ? j.head : [smp.x, smp.y - 3.4 * A.env.scale]);
        } else if (pupBy[c.args.by]) {
          const U = pupBy[c.args.by], p = pupPos(U, toWorld(s.tNow)), h = ((U.def && U.def.height) || 40) * U.scale;
          head = [p.x, p.y - h];
        }
        if (!head) return '';
        const hp = toScreen(head, cam);
        const size = 26, wr = wrap(c.args.text, size, 380), bw = wr.width + 36, bh = wr.lines.length * size * 1.25 + 22;
        const bx = clamp(hp[0] - bw / 2 + 30, 12, FW - bw - 12), by = clamp(hp[1] - bh - 34, 12, FH - bh - 60);
        const tx = clamp(hp[0], bx + 18, bx + bw - 18);
        let o = `<g opacity="${fx(a)}"><path d="M${fx(tx - 12)} ${fx(by + bh - 2)} L${fx(tx + 4)} ${fx(Math.min(hp[1] - 8, by + bh + 26))} L${fx(tx + 12)} ${fx(by + bh - 2)} Z" fill="#fffdf6" stroke="#2b2622" stroke-width="3" stroke-linejoin="round"/>`;
        o += `<rect x="${fx(bx)}" y="${fx(by)}" width="${fx(bw)}" height="${fx(bh)}" rx="18" fill="#fffdf6" stroke="#2b2622" stroke-width="3"/>`;
        o += `<rect x="${fx(tx - 10)}" y="${fx(by + bh - 4)}" width="20" height="5" fill="#fffdf6"/>`;
        wr.lines.forEach((l, i) => { o += `<text x="${fx(bx + bw / 2)}" y="${fx(by + 11 + size * 0.95 + i * size * 1.25)}" font-family="${FONT}" font-size="${size}" font-weight="700" fill="#2b2622" text-anchor="middle">${esc(l)}</text>`; });
        return o + '</g>';
      }
      const size = 34, wr = wrap(c.args.text, size, 1040), bw = wr.width + 56, lh = size * 1.28, bh = wr.lines.length * lh + 26;
      const by = c.args.at === 'top' ? 34 : FH - 44 - bh, bx = (FW - bw) / 2;
      let o = `<g opacity="${fx(a)}"><rect x="${fx(bx)}" y="${fx(by)}" width="${fx(bw)}" height="${fx(bh)}" rx="14" fill="#120f1a" fill-opacity="0.66"/>`;
      wr.lines.forEach((l, i) => { o += `<text x="${FW / 2}" y="${fx(by + 13 + size * 0.92 + i * lh)}" font-family="${FONT}" font-size="${size}" font-weight="700" fill="#fffaf0" stroke="#120f1a" stroke-width="5" stroke-opacity="0.55" paint-order="stroke" text-anchor="middle">${esc(l)}</text>`; });
      return o + '</g>';
    }
    function drawCard(t) {
      let o = '';
      for (const cd of cards) {
        if (t < cd.t || (cd.args.for && t >= cd.t + cd.args.for)) continue;
        const fd = cd.args.fade === undefined ? 0.7 : Math.max(0.01, +cd.args.fade), bg = cd.args.bg || '';
        const a = Math.min(smooth((t - cd.t) / fd), cd.args.for ? smooth((cd.t + cd.args.for - t) / Math.min(0.5, fd)) : 1);
        const size = 54, wr = wrap(cd.args.text, size, 980), lh = size * 1.3;
        const sub = cd.args.sub ? wrap(cd.args.sub, 28, 900) : null;
        const total = wr.lines.length * lh + (sub ? 30 + sub.lines.length * 36 : 0);
        let y = FH / 2 - total / 2 + size * 0.8;
        o += `<g opacity="${fx(a)}">` + (bg === 'none' ? '' : `<rect x="-10" y="-10" width="${FW + 20}" height="${FH + 20}" fill="${bg ? esc(bg) : 'url(#cardbg)'}"/>`);
        o += `<rect x="${FW / 2 - 60}" y="${fx(FH / 2 - total / 2 - 46)}" width="120" height="3" rx="1.5" fill="#e9c46a" opacity="0.85"/>`;
        const ta = smooth((t - cd.t - 0.36 * fd) / (1.14 * fd)), dy = (1 - ta) * 14;
        for (const l of wr.lines) { o += `<text x="${FW / 2}" y="${fx(y + dy)}" opacity="${fx(ta)}" font-family="${SERIF}" font-size="${size}" font-style="italic" fill="#fbf4e4" text-anchor="middle">${esc(l)}</text>`; y += lh; }
        if (sub) { y += 18; for (const l of sub.lines) { o += `<text x="${FW / 2}" y="${fx(y)}" opacity="${fx(ta)}" font-family="${FONT}" font-size="28" fill="#cbbfa8" text-anchor="middle" letter-spacing="2">${esc(l)}</text>`; y += 36; } }
        o += '</g>';
      }
      return o;
    }

    function drawPuppet(U, t) {
      if (!U.def) return '';
      t = toWorld(t);
      const pos = pupPos(U, t);
      let f = U.facing0;
      let last = null;
      for (const m of U.moves) if (m.t0 <= t && m.to[0] !== m.from[0]) last = m;
      // facing: the direction of the latest move, flipped by any later turn
      const evs = [];
      for (const m of U.moves) if (m.to[0] !== m.from[0]) evs.push({ t: m.t0, f: Math.sign(m.to[0] - m.from[0]) });
      for (const tr of U.turns) evs.push({ t: tr.t, flip: true });
      evs.sort((a, b) => a.t - b.t);
      for (const e of evs) if (e.t <= t) f = e.flip ? -f : e.f;
      let ci = 0;
      for (let i = 0; i < U.changes.length; i++) if (U.changes[i].t <= t) ci = i;
      const cur = U.changes[ci], since = t - Math.max(0, cur.t);
      const def = U.def, BL = def.blend || 0.25;
      let body;
      if (def.pose && def.render) {
        let prm = def.pose(cur.state, since, t, pos);
        if (ci > 0 && since < BL) {
          const prev = U.changes[ci - 1];
          const pp = def.pose(prev.state, t - Math.max(0, prev.t), t, pos);
          prm = lerpObj(pp, prm, smooth(since / BL));
        }
        body = def.render(prm, t);
      } else body = def.draw(t, cur.state, since);
      const sc = U.scale;
      return `<g transform="translate(${fx(pos.x)} ${fx(pos.y)}) scale(${fx(f * sc)} ${fx(sc)})">${body}</g>`;
    }
    function drawProp(R, t, glows) {
      if (!R.def) return '';
      const st = propState(R, t);
      if (!st) return '';
      const tr = st.at, ang = st.swing;
      const body = R.def.draw(t, { held: !!st.held, swing: ang });
      if (R.def.glow) {
        const g = R.def.glow, a = ang * Math.PI / 180, gx = g.at[0] * Math.cos(a) - g.at[1] * Math.sin(a), gy = g.at[0] * Math.sin(a) + g.at[1] * Math.cos(a);
        const fl = 1 + 0.06 * Math.sin(t * 9.1) + 0.04 * Math.sin(t * 23.7 + 1.1);
        const k = pal.glow === undefined ? 1 : pal.glow;   // sets dim lights in daylight
        glows.push({ p: [tr[0] + gx, tr[1] + gy], r: g.r * fl * (0.6 + 0.4 * Math.min(1, k)), color: g.color, strength: (g.strength || 0.8) * k });
      }
      return `<g transform="translate(${fx(tr[0])} ${fx(tr[1])}) rotate(${fx(ang)})">${body}</g>`;
    }

    const CharRig0 = () => dep('CharRig', './rig.js');
    function frame(tIn) {
      const t = clamp(+tIn || 0, 0, duration);
      const cam = camera(t), ctx = ctxOf(t);
      const parts = [];
      parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FW} ${FH}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block;background:${set.bare ? 'transparent' : '#000'}">`);
      parts.push(`<defs><linearGradient id="cardbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1828"/><stop offset="1" stop-color="#0d0b12"/></linearGradient>`);
      if (set.defs) parts.push(set.defs(ctx));
      parts.push(`</defs><clipPath id="frameclip"><rect width="${FW}" height="${FH}"/></clipPath><g clip-path="url(#frameclip)">`);
      const layerSvg = L => {
        if (L.static) { const k = (L.name || layers.indexOf(L)) + '|' + variantName; if (!(k in staticCache)) staticCache[k] = L.draw(ctx); return staticCache[k]; }
        return L.draw(ctx);
      };
      for (const L of layers) if (!L.front && !L.pass) parts.push(`<g transform="${layerTransform(cam, L.depth)}">${layerSvg(L)}</g>`);
      const smps = new Map();
      for (const A of actors) smps.set(A, sampleActor(A, t));
      // reflections: set.reflect = { opacity, color, level (water y; default the ground under the actor), filter }
      if (set.reflect) {
        const R = set.reflect, ref = [];
        for (const A of actors) {
          const smp = smps.get(A);
          if (smp.offstage) continue;
          const yw = typeof R.level === 'number' ? R.level : ground(smp.x);
          if (!A.reflSkin) A.reflSkin = Object.assign({}, A.skin, { silhouette: R.color || set.silhouette || '#000' });
          ref.push(`<g transform="translate(0 ${fx(2 * yw)}) scale(1 -1) translate(${fx(smp.x)} ${fx(smp.y)})">${drawActor(Object.assign({}, A, { skin: A.reflSkin }), smp)}</g>`);
        }
        parts.push(`<g transform="${layerTransform(cam, 1)}"><g opacity="${R.opacity === undefined ? 0.5 : R.opacity}"${R.filter ? ` filter="${R.filter}"` : ''}>${ref.join('')}</g></g>`);
      }
      // layers with pass: 'water' lie over the reflections and under the actors (ripples, glitter)
      for (const L of layers) if (!L.front && L.pass === 'water') parts.push(`<g transform="${layerTransform(cam, L.depth)}">${layerSvg(L)}</g>`);
      // world: resting props, then actors and puppets in the order they were declared
      const glows = [];
      const world = [];
      const items = actors.map(A => ({ line: A.decl.line, A })).concat(puppets.map(U => ({ line: U.decl.line, U }))).sort((a, b) => a.line - b.line);
      const heldNow = {};
      for (const R of props) { const st = propState(R, t); if (st && st.held) heldNow[R.name] = 1; else world.push(drawProp(R, t, glows)); }
      // actors in contact are drawn together in three passes: their far arms, their bodies, their near
      // arms, so an arm round a partner's back goes behind the partner and the near arm over them
      const groupOf = new Map();
      for (const A of actors) { const s = smps.get(A); if (s.contacts) for (const c of s.contacts) { const B = actorBy[c.who]; if (B && c.w > 0.02) { const g = groupOf.get(A) || groupOf.get(B) || new Set(); g.add(A); g.add(B); groupOf.set(A, g); groupOf.set(B, g); } } }
      const drawnG = new Set();
      const LBODY = CharRig0().LAYERS ? CharRig0().LAYERS.filter(l => l !== 'arm.far' && l !== 'arm.near') : null;
      for (const it of items) {
        if (it.U) { world.push(drawPuppet(it.U, t)); continue; }
        const A = it.A, smp = smps.get(A), g = groupOf.get(A);
        if (g && LBODY) {
          if (drawnG.has(g)) continue;
          drawnG.add(g);
          const mem = items.filter(q => q.A && g.has(q.A)).map(q => q.A);
          const put = (M, pass) => { const s = smps.get(M); world.push(`<g transform="translate(${fx(s.x)} ${fx(s.y)})">${drawActor(M, Object.assign({}, s, { _layers: pass }))}</g>`); };
          const byH = mem.slice().sort((p, q) => (smps.get(q).height || 0) - (smps.get(p).height || 0));
          for (const M of mem) put(M, ['arm.far']);
          const wraps = (smps.get(byH[0]).contacts || []).some(q => q.side === 'near' && /around|back|waist|side/.test(q.at));
          if (byH.length === 2 && wraps && (smps.get(byH[1]).height || 0) < 0.6 * (smps.get(byH[0]).height || 1)) {
            // a grown-up with a child: the grown-up's near arm goes behind the child's head and shows on its back
            put(byH[0], LBODY); put(byH[0], ['arm.near']); put(byH[1], LBODY); put(byH[1], ['arm.near']);
          } else { for (const M of mem) put(M, LBODY); for (const M of mem) put(M, ['arm.near']); }
          for (const M of mem) { const s = smps.get(M); for (const R of props) if (heldNow[R.name] && s.held && s.held.prop === R.name) world.push(drawProp(R, t, glows)); }
          continue;
        }
        world.push(`<g transform="translate(${fx(smp.x)} ${fx(smp.y)})">${drawActor(A, smp)}</g>`);
        for (const R of props) if (heldNow[R.name] && smp.held && smp.held.prop === R.name) world.push(drawProp(R, t, glows));
      }
      parts.push(`<g transform="${layerTransform(cam, 1)}">${world.join('')}</g>`);
      for (const L of layers) if (L.front) parts.push(`<g transform="${layerTransform(cam, L.depth)}">${layerSvg(L)}</g>`);
      if (set.overlay) parts.push(set.overlay(ctx));
      if (glows.length) {
        parts.push(`<g transform="${layerTransform(cam, 1)}" style="mix-blend-mode:screen">`);
        glows.forEach((g, i) => {
          parts.push(`<radialGradient id="glow${i}"><stop offset="0" stop-color="${g.color}" stop-opacity="0.95"/><stop offset="0.18" stop-color="${g.color}" stop-opacity="0.55"/><stop offset="0.5" stop-color="${g.color}" stop-opacity="0.18"/><stop offset="1" stop-color="${g.color}" stop-opacity="0"/></radialGradient>`);
          parts.push(`<circle cx="${fx(g.p[0])}" cy="${fx(g.p[1])}" r="${fx(g.r)}" fill="url(#glow${i})" opacity="${fx(g.strength)}"/>`);
        });
        parts.push('</g>');
      }
      for (const s of activeCaptions(t)) { s.tNow = t; parts.push(drawCaption(s, cam)); }
      parts.push(drawCard(t));
      const fa = fadeAt(t);
      if (fa > 0.001) parts.push(`<rect x="-10" y="-10" width="${FW + 20}" height="${FH + 20}" fill="#000" opacity="${fx(fa)}"/>`);
      parts.push('</g></svg>');
      return parts.join('');
    }

    return {
      duration, diagnostics, set, W, H, ground, anchors, camera, toScreen, frame, standin: Perf === Standin,
      actors: actors.map(A => ({
        name: A.name, decl: A.decl, events: A.sorted || [], perf: A.perf, scale: A.env.scale, skin: A.skin,   // events sorted as the performer saw them
        sample: t => sampleActor(A, t),
        joints: t => jointsOf(A.skin, sampleActor(A, t), A.env.scale, A.P.standin),
      })),
      puppets: puppets.map(U => ({ name: U.name, pos: t => pupPos(U, toWorld(t)), def: U.def })),
      toWorld, toReal, contacts,
      statements: P.statements,
    };
  }

  function mount(el, parsed, lib) {
    const film = compile(parsed, lib);
    return {
      film, duration: film.duration, diagnostics: film.diagnostics,
      seek(t) { el.innerHTML = film.frame(t); },
    };
  }

  // Char.mount(element, { script, skins, width, height }) -> { duration, seek(t), destroy() }
  // For host pages: draws only the characters on a transparent layer (a bare stage unless the script has a set line).
  G.Char = {
    mount(el, o) {
      o = o || {};
      const film = compile(CharScript.parse(o.script || ''), o.skins ? { skins: o.skins } : undefined);
      if (o.width) el.style.width = typeof o.width === 'number' ? o.width + 'px' : o.width;
      if (o.height) el.style.height = typeof o.height === 'number' ? o.height + 'px' : o.height;
      return { duration: film.duration, diagnostics: film.diagnostics, film, seek(t) { el.innerHTML = film.frame(t); }, destroy() { el.innerHTML = ''; } };
    },
  };

  return { compile, mount, Standin, jointsOf, charOf, lerpObj, blinkAt };
});

}).call(G);

// ---- src-extra/element.js ----
(function (module, exports, require) {
// element.js - the <char-stage> web component. Appended to the bundle by tools/build.cjs.
// Attributes: src (film script URL; or put the script text inside the element), skins, actions (space/comma
// separated script URLs), width, height, autoplay, loop, controls. Methods: seek(t), play(), pause().
// Property: duration. Event: ready. Transparent background; the host supplies the scenery.
(function (module, exports, require) {
  const G = typeof globalThis !== 'undefined' ? globalThis : this;
  if (typeof G.HTMLElement === 'undefined' || !G.customElements || !G.document) return;   // no DOM (Node)
  const loaded = {};
  const loadScript = url => loaded[url] || (loaded[url] = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = url; s.onload = () => res(); s.onerror = () => rej(Error('cannot load ' + url));
    document.head.appendChild(s);
  }));
  const list = v => (v || '').split(/[\s,]+/).filter(Boolean);

  class CharStage extends HTMLElement {
    static get observedAttributes() { return ['src', 'skins', 'actions', 'width', 'height', 'controls']; }
    constructor() {
      super();
      this._m = null; this._t = 0; this._playing = false; this._t0 = 0; this._raf = 0; this._gen = 0; this._ready = false;
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = '<style>:host{display:inline-block;position:relative;background:transparent}' +
        '#layer{position:relative;width:100%;height:100%}#layer svg{display:block;width:100%;height:100%}' +
        '#bar{position:absolute;left:0;right:0;bottom:0;display:none;gap:8px;align-items:center;padding:4px 8px;background:rgba(0,0,0,.45);font:12px sans-serif;color:#fff}' +
        ':host([controls]) #bar{display:flex}#bar input{flex:1}#bar button{font:inherit}</style>' +
        '<div id="layer"></div><div id="bar"><button id="pp">play</button><input id="r" type="range" min="0" max="1" step="0.01" value="0"></div>';
      this._layer = root.getElementById('layer');
      this._pp = root.getElementById('pp'); this._r = root.getElementById('r');
      this._pp.onclick = () => this._playing ? this.pause() : this.play();
      this._r.oninput = () => { this.pause(); this.seek(+this._r.value); };
    }
    connectedCallback() { this._size(); this._load(); }
    disconnectedCallback() { this.pause(); this._gen++; if (this._m) this._m.destroy(); this._m = null; }
    attributeChangedCallback(n) { if (!this.isConnected) return; if (n === 'width' || n === 'height') this._size(); else if (n !== 'controls') this._load(); }
    get duration() { return this._m ? this._m.duration : 0; }
    get currentTime() { return this._t; }
    get ready() { return this._ready; }
    get diagnostics() { return this._m ? this._m.diagnostics : []; }
    _size() {
      const w = this.getAttribute('width'), h = this.getAttribute('height');
      const px = v => /^\d+(\.\d+)?$/.test(v) ? v + 'px' : v;
      if (w) this.style.width = px(w); if (h) this.style.height = px(h);
    }
    async _load() {
      const gen = ++this._gen;
      this.pause(); this._ready = false;
      try {
        for (const u of list(this.getAttribute('skins')).concat(list(this.getAttribute('actions')))) await loadScript(new URL(u, document.baseURI).href);
        let script = this.getAttribute('src');
        if (script) script = await (await fetch(new URL(script, document.baseURI))).text();
        else { const s = this.querySelector('script'); script = (s || this).textContent; }
        if (gen !== this._gen) return;
        if (this._m) this._m.destroy();
        const el = document.createElement('div'); el.style.cssText = 'width:100%;height:100%';
        this._layer.textContent = ''; this._layer.appendChild(el);
        this._m = G.Char.mount(el, { script, skins: G.CharSkins });
        this._r.max = this._m.duration;
        this.seek(0);
        this._ready = true;
        this.dispatchEvent(new CustomEvent('ready', { detail: { duration: this._m.duration } }));
        if (this.hasAttribute('autoplay')) this.play();
      } catch (e) { console.warn('<char-stage>: ' + e.message); this.dispatchEvent(new CustomEvent('error', { detail: e })); }
    }
    seek(t) {
      if (!this._m) return;
      this._t = Math.max(0, Math.min(this._m.duration, +t || 0));
      this._m.seek(this._t); this._r.value = this._t;
    }
    play() {
      if (!this._m || this._playing) return;
      this._playing = true; this._t0 = 0; this._pp.textContent = 'pause';
      const tick = now => {
        if (!this._playing) return;
        if (!this._t0) this._t0 = now - this._t * 1000;
        let t = (now - this._t0) / 1000;
        if (t >= this._m.duration) {
          if (this.hasAttribute('loop')) { t = 0; this._t0 = now; } else { this.seek(this._m.duration); this.pause(); return; }
        }
        this.seek(t);
        this._raf = requestAnimationFrame(tick);
      };
      this._raf = requestAnimationFrame(tick);
    }
    pause() { this._playing = false; if (this._raf) cancelAnimationFrame(this._raf); this._raf = 0; this._pp.textContent = 'play'; }
  }
  if (!customElements.get('char-stage')) customElements.define('char-stage', CharStage);
}).call(this);

}).call(G);

})();
const G = globalThis;
export const Char = G.Char;
export default G.Char;
export const CharRig = G.CharRig, CharScript = G.CharScript, CharStage = G.CharStage;
