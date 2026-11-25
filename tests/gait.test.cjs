// Numeric gait tests for char-lab experiment A. Run: node --test tests/gait.test.cjs
const test = require('node:test');
const assert = require('node:assert');
const CharRig = require('../src/rig.js');
const CharGait = require('../src/gait.js');

const ch = CharRig.defaultCharacter();
const pr = ch.proportions;
const LEG = pr.thigh + pr.shin;
const N = 720;
const sides = ['near', 'far'];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

for (const name of Object.keys(CharGait.presets)) {
  const params = CharGait.presets[name];
  const pose = ph => CharGait.pose(params, ph, ch);

  test(`${name}: 1. stance foot does not slide (world space, tol 1% of leg)`, () => {
    const duty = params.duty;
    for (const [side, off] of [['near', 0], ['far', 0.5]]) {
      let anchorHeel = null, anchorToe = null, checked = 0;
      // walk the stance in unwrapped phase; world x = cycle * stride + pose x
      for (let i = 0; i <= N; i++) {
        const u = off + duty * i / N * 0.999;
        const p = pose(u);
        const cycle = Math.floor(u), S = p.meta.stride;
        const leg = p.legs[side];
        const fp = CharRig.footPoints(ch, leg.foot, leg.footAngle);
        const w = q => [q[0] + cycle * S, q[1]];
        // the pinned point is the heel while the toe is up and the toe while the heel is up;
        // when flat, both are planted
        if (leg.footAngle >= -1e-12) {
          const h = w(fp.heel);
          if (!anchorHeel) anchorHeel = h;
          assert.ok(dist(h, anchorHeel) < 0.01 * LEG, `${side} heel slid ${dist(h, anchorHeel).toFixed(4)} at phase ${u.toFixed(3)}`);
          checked++;
        }
        if (leg.footAngle <= 1e-12) {
          const t = w(fp.toe);
          if (!anchorToe) anchorToe = t;
          assert.ok(dist(t, anchorToe) < 0.01 * LEG, `${side} toe slid ${dist(t, anchorToe).toFixed(4)} at phase ${u.toFixed(3)}`);
          checked++;
        }
        if (anchorHeel && anchorToe) assert.ok(Math.abs(anchorToe[0] - anchorHeel[0] - (pr.toe[0] - pr.heel[0])) < 0.01 * LEG, 'heel and toe pivots disagree');
      }
      assert.ok(checked > N / 2);
    }
  });

  test(`${name}: 2. limb segment lengths are constant`, () => {
    const want = { thigh: pr.thigh, shin: pr.shin, upperArm: pr.upperArm, foreArm: pr.foreArm };
    for (let i = 0; i < N; i++) {
      const J = CharRig.solve(ch, pose(i / N)).joints;
      for (const s of sides) {
        const got = {
          thigh: dist(J['hip.' + s], J['knee.' + s]), shin: dist(J['knee.' + s], J['ankle.' + s]),
          upperArm: dist(J['shoulder.' + s], J['elbow.' + s]), foreArm: dist(J['elbow.' + s], J['wrist.' + s]),
        };
        for (const k in want) assert.ok(Math.abs(got[k] - want[k]) < 1e-9, `${s} ${k} = ${got[k]} at ${i / N}`);
      }
      assert.ok(Math.abs(dist(J.neckBase, J.headBase) - pr.neck) < 1e-9);
      assert.ok(Math.abs(dist(J.root, J.neckBase) - pr.torso) < 1e-9);
    }
  });

  test(`${name}: 3. IK never over-extends, knee bends forward, knee angle is continuous`, () => {
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const p = pose(i / N);
      const sol = CharRig.solve(ch, p);
      const J = sol.joints;
      for (const s of sides) {
        // the ankle reached its target exactly (no clamping happened)
        assert.ok(dist(J['ankle.' + s], p.legs[s].foot) < 1e-9, `${s} ankle target unreachable at ${i / N}`);
        const reach = dist(J['hip.' + s], J['ankle.' + s]) / LEG;
        assert.ok(reach < 0.99, `${s} leg ${reach.toFixed(4)} of full length at ${i / N}`);
        assert.ok(sol.bends['knee.' + s] > 0.15, `${s} knee nearly straight (${sol.bends['knee.' + s].toFixed(3)} rad) at ${i / N}`);
        // knee in front of the hip->ankle line
        const h = J['hip.' + s], k = J['knee.' + s], a = J['ankle.' + s];
        const cross = (a[0] - h[0]) * (k[1] - h[1]) - (a[1] - h[1]) * (k[0] - h[0]);
        assert.ok(cross > 0, `${s} knee bends backward at ${i / N}`);
      }
      if (prev) for (const s of sides) {
        const d = Math.abs(sol.bends['knee.' + s] - prev['knee.' + s]);
        assert.ok(d < 0.06, `${s} knee angle jumps ${d.toFixed(3)} rad at ${i / N}`);
      }
      prev = sol.bends;
    }
  });

  test(`${name}: 4. cycle is periodic and the second half mirrors the first`, () => {
    const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} vs ${b}`);
    const p0 = pose(0), p1 = pose(1);
    assert.deepStrictEqual(p1, p0);
    // also continuous across the wrap
    const a = pose(1 - 1e-7), b = pose(0);
    for (const s of sides) close(a.legs[s].foot[0] - a.root[0], b.legs[s].foot[0] - b.root[0], 1e-4, 'wrap ' + s);
    for (let i = 0; i < 100; i++) {
      const ph = i / 200;
      const A = pose(ph), B = pose(ph + 0.5);
      const rel = (p, s) => [p.legs[s].foot[0] - p.root[0], p.legs[s].foot[1]];
      close(B.root[1], A.root[1], 1e-9, 'pelvis height');
      close(B.spineLean, A.spineLean, 1e-9, 'lean');
      close(B.chestTwist, -A.chestTwist, 1e-9, 'twist');
      for (const [x, y] of [['near', 'far'], ['far', 'near']]) {
        close(rel(B, x)[0], rel(A, y)[0], 1e-6, 'foot x');
        close(rel(B, x)[1], rel(A, y)[1], 1e-6, 'foot y');
        close(B.legs[x].footAngle, A.legs[y].footAngle, 1e-6, 'foot angle');
        for (const k of ['shoulder', 'elbow', 'wrist']) close(B.arms[x][k], A.arms[y][k], 1e-9, 'arm ' + k);
      }
      // the solved knees mirror too, relative to the pelvis
      const JA = CharRig.solve(ch, A).joints, JB = CharRig.solve(ch, B).joints;
      for (const [x, y] of [['near', 'far'], ['far', 'near']]) {
        close(JB['knee.' + x][0] - JB.root[0], JA['knee.' + y][0] - JA.root[0], 1e-6, 'knee x');
        close(JB['knee.' + x][1], JA['knee.' + y][1], 1e-6, 'knee y');
      }
    }
  });

  test(`${name}: 5. feet never go below the ground`, () => {
    for (let i = 0; i < N; i++) {
      const p = pose(i / N);
      for (const s of sides) {
        const fp = CharRig.footPoints(ch, p.legs[s].foot, p.legs[s].footAngle);
        for (const q of fp.ground) assert.ok(q[1] > -1e-9, `${s} foot at y=${q[1]} at ${i / N}`);
      }
    }
  });
}
