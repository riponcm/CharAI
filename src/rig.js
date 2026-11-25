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
