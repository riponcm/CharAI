// node --test tests/body.test.cjs : the mannequin over the whole range of bodies (2.2 to 8 heads,
// thin to obese, baby to elder, a long skirt), with every locomotion and the big gestures.
const test = require('node:test');
const assert = require('node:assert');
const CharRig = require('../src/rig.js');
const CharPerform = require('../src/perform.js');
const mannequin = require('../skins/mannequin.js');

const GROUND = 500;
const env = { ground: GROUND, x: 300, scale: 50, width: 4000 };
const mk = (name, build, motion, parts) => Object.assign({}, mannequin, { name, build: Object.assign({}, build), motion: Object.assign({}, mannequin.motion, motion || {}), parts: parts || undefined });
const BODIES = [
  mk('toddler', { heads: 2.2 }, { age: 'baby', energy: 0.8 }),
  mk('child', { heads: 3.4 }, { age: 'child' }),
  mk('thin adult', { heads: 8, chest: 0.7, waist: 0.5, hips: 0.7, arm: 0.09, leg: 0.15 }),
  mk('obese', { heads: 5.6, belly: 0.6, chest: 1.1, waist: 1.05, hips: 1.0, arm: 0.18, leg: 0.32 }, { weight: 1 }),
  mk('elder', { heads: 6.6 }, { age: 'elder' }),
  mk('athlete', { heads: 7.6, muscle: 1 }, { energy: 1 }),
  mk('long skirt', { heads: 7.4 }, {}, { skirt: { skirt: true, length: 1, flare: 0.25, fill: 'suit' } }),
];
const span = pf => [0, pf.end(0) + 0.6];
const stagePt = (s, p) => [s.x + s.facing * s.scale * p[0], s.y - s.scale * p[1]];

for (const sk of BODIES) {
  const ch = CharRig.skinCharacter(sk), pr = ch.proportions, LEG = pr.thigh + pr.shin;
  test(`${sk.name}: feet on the ground, no slide, legs within reach (walk, run, run fast)`, () => {
    for (const [action, args] of [['walk', { to: 900 }], ['run', { to: 1100 }], ['run', { to: 1400, speed: 2 }]]) {
      const pf = CharPerform.compile(sk, [{ t: 0, action, args }], env);
      assert.deepStrictEqual(pf.diagnostics.filter(d => d.severity === 'error'), []);
      const [a, b] = span(pf), tol = Math.max(1.5, 0.015 * LEG * pf.scale), eps = 0.004 * LEG, anchor = { near: {}, far: {} };
      let planted = 0;
      for (let t = a; t <= b; t += 1 / 120) {
        const s = pf.sample(t), J = CharRig.solve(ch, s.pose).joints;
        for (const side of ['near', 'far']) {
          const leg = s.pose.legs[side], fp = CharRig.footPoints(ch, leg.foot, leg.footAngle);
          for (const q of fp.ground) assert.ok(q[1] > -1e-6, `${sk.name} ${action}: foot under the ground at ${t.toFixed(2)}`);
          const reach = Math.hypot(J['ankle.' + side][0] - J['hip.' + side][0], J['ankle.' + side][1] - J['hip.' + side][1]);
          assert.ok(reach <= LEG * 1.12 + 1e-6, `${sk.name} ${action}: leg over-stretched at ${t.toFixed(2)}`);
          const A = anchor[side];
          for (const [pt, h, ok] of [['heel', fp.heel[1], leg.footAngle >= -1e-9], ['toe', fp.toe[1], leg.footAngle <= 1e-9]]) {
            if (ok && h < eps) {
              const P = stagePt(s, fp[pt]);
              if (!A[pt]) A[pt] = P;
              assert.ok(Math.abs(P[0] - A[pt][0]) < tol, `${sk.name} ${action}: ${side} ${pt} slid ${Math.abs(P[0] - A[pt][0]).toFixed(2)}px at ${t.toFixed(3)}`);
              planted++;
            } else A[pt] = null;
          }
        }
      }
      assert.ok(planted > 50, `${sk.name} ${action}: feet were planted`);
    }
  });

  test(`${sk.name}: hands stay out of the chest and belly in a walk, out of the head in a wave`, () => {
    const B = ch.body, T = pr.torso;
    const walk = CharPerform.compile(sk, [{ t: 0, action: 'walk', args: { to: 800 } }], env);
    for (let t = 0.2; t < walk.end(0); t += 0.05) {
      const s = walk.sample(t), sol = CharRig.solve(ch, s.pose), J = sol.joints, ta = sol.angles.torso;
      for (const side of ['near', 'far']) {
        const w = J['wrist.' + side], d = [w[0] - J.root[0], w[1] - J.root[1]];
        const q = [d[0] * Math.cos(-ta) - d[1] * Math.sin(-ta), d[0] * Math.sin(-ta) + d[1] * Math.cos(-ta)];
        if (q[1] <= 0.25 * T || q[1] >= 0.93 * T) continue;   // chest and belly (hands may hang at the hips)
        const p = B.profile(q[1]);
        assert.ok(!(q[0] < p.front - 0.47 * (p.front - p.back) && q[0] > p.back + 0.45 * (p.front - p.back)), `${sk.name}: ${side} hand inside the torso at ${t.toFixed(2)}`);
      }
    }
    const wave = CharPerform.compile(sk, [{ t: 0, action: 'wave', args: { hand: 'both' } }], env);
    for (let t = 0; t < wave.end(0); t += 0.05) {
      const s = wave.sample(t), sol = CharRig.solve(ch, s.pose), J = sol.joints, a = sol.angles.head;
      const hc = [J.headBase[0] - 0.02 * Math.cos(a) - 0.52 * Math.sin(a), J.headBase[1] - 0.02 * Math.sin(a) + 0.52 * Math.cos(a)];
      for (const side of ['near', 'far']) {
        const w = J['wrist.' + side];
        assert.ok(Math.hypot(w[0] - hc[0], w[1] - hc[1]) > 0.45 * Math.max(0.8, B.b.headWidth), `${sk.name}: ${side} hand inside the head at ${t.toFixed(2)}`);
      }
    }
  });

  test(`${sk.name}: a jump leaves the ground and lands on its target; draws clean; seek order free`, () => {
    const pf = CharPerform.compile(sk, [{ t: 0, action: 'jump', args: { to: 600 } }], env);
    const stand = pf.sample(0).pose.root[1];
    let hi = -Infinity;
    for (let t = 0; t < pf.end(0); t += 0.02) hi = Math.max(hi, pf.sample(t).pose.root[1]);
    assert.ok(hi > stand + 0.1 * LEG, `${sk.name}: airborne`);
    assert.ok(Math.abs(pf.sample(pf.end(0) + 0.5).x - 600) < 10, `${sk.name}: lands on target`);
    const evs = [{ t: 0, action: 'run', args: { to: 900 } }, { t: 3, action: 'wave', args: { hand: 'both' } }, { t: 4.5, action: 'turn' }];
    const A = CharPerform.compile(sk, evs, env), Bp = CharPerform.compile(sk, evs, env);
    const times = [3.3, 0.2, 5.1, 1.7, 4.6];
    const first = times.map(t => JSON.stringify(A.sample(t)));
    for (let i = 0; i < 40; i++) A.sample((i * 2.37) % 6);
    assert.deepStrictEqual(times.map(t => JSON.stringify(A.sample(t))), first);
    assert.deepStrictEqual(times.map(t => JSON.stringify(Bp.sample(t))), first);
    const svg = CharPerform.draw(sk, A.sample(1.2));
    assert.ok(svg.length > 2000 && !/NaN|undefined|Infinity/.test(svg));
  });
}

test('mannequin: height follows build.heads; the skirt covers the legs down to its hem', () => {
  for (const h of [2.2, 4, 6, 8]) assert.ok(Math.abs(CharRig.heightOf(CharRig.skinCharacter(mk('h', { heads: h }))) - h) < 1e-6);
  const sk = BODIES[BODIES.length - 1];
  const pf = CharPerform.compile(sk, [{ t: 0, action: 'run', args: { to: 1200, speed: 2 } }], env);
  const svg = CharPerform.draw(sk, pf.sample(1.1));
  assert.ok(!/NaN|undefined/.test(svg) && svg.includes(CharRig.skinCharacter(sk).palette.suit));
});
