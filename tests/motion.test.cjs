// node --test tests/motion.test.cjs : clips (motion as data), spring simulation, soft skin, camera framing.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const CharRig = require('../src/rig.js');
const CharPerform = require('../src/perform.js');
const kai = require('../skins/kai.js');
const tess = require('../skins/tess.js');

const env = { ground: 500, x: 300, anchors: { far: 1500 } };
const ch = CharRig.skinCharacter(kai);
const LEG = ch.proportions.thigh + ch.proportions.shin;
const story = [
  { t: 0, action: 'idle' }, { t: 1, action: 'bounce', args: { times: 2 } },
  { t: 3, action: 'run', args: { to: 700 } }, { t: 5.2, action: 'jump', args: { to: 900 } },
  { t: 7.2, action: 'run', args: { to: 1300, end: 'skid' } }, { t: 11, action: 'wave', args: { hand: 'both' } },
];
const J = s => CharRig.solve(ch, s.pose).joints;
const stagePt = (s, p) => [s.x + s.facing * s.scale * p[0], s.y - s.scale * p[1]];

test('springs: the same frame for any seek order (fixed step, cached snapshots)', () => {
  const e = Object.assign({}, env, { wind: t => (t > 0.5 && t < 2.5 ? -1 : 0.2) });
  const A = CharPerform.compile(kai, story, e), B = CharPerform.compile(kai, story, e);
  const times = [9.3, 0.4, 12.1, 5.55, 2.2, 7.01, 10.6, 0.02];
  const first = times.map(t => JSON.stringify(A.sample(t)));
  for (let i = 0; i < 150; i++) A.sample((i * 7.31) % 13);
  const again = times.slice().reverse().map(t => JSON.stringify(A.sample(t))).reverse();
  assert.deepStrictEqual(again, first);
  assert.deepStrictEqual(times.map(t => JSON.stringify(B.sample(t))), first);
});

test('springs: chains rest in their drawn shape, and wind and motion move them', () => {
  const still = CharPerform.compile(kai, [], env);
  for (const v of Object.values(still.sample(3).pose.secondary.chains)) for (const d of v) assert.ok(Math.abs(d) < 0.08, 'still chain near rest');
  const windy = CharPerform.compile(kai, [], Object.assign({}, env, { wind: () => -1 }));
  const sc = windy.sample(3).pose.secondary.chains.scarf;
  assert.ok(Math.max(...sc.map(Math.abs)) > 0.25, 'wind moves the scarf');
  const run = CharPerform.compile(kai, [{ t: 0, action: 'run', args: { to: 1200, end: 'skid' } }], env);
  let swing = 0;
  for (let t = 0; t < run.end(0) + 1; t += 0.05) swing = Math.max(swing, Math.abs(run.sample(t).pose.secondary.chains.scarf[0]));
  assert.ok(swing > 0.4, 'the scarf swings when he runs and stops');
});

test('clips: cross-fades leave no pops (joints move smoothly through every action change)', () => {
  const pf = CharPerform.compile(kai, story, env);
  // a pop is a step much bigger than the steps just before and after it (fast but smooth swings are fine)
  let prev = null;
  const steps = [];
  for (let t = 0; t < 13; t += 1 / 120) {
    const s = pf.sample(t), j = J(s), pts = ['root', 'neckBase', 'wrist.near', 'wrist.far', 'ankle.near', 'ankle.far'].map(n => stagePt(s, j[n]));
    const d = prev && prev.facing === s.facing ? Math.max(...pts.map((p, i) => Math.hypot(p[0] - prev.pts[i][0], p[1] - prev.pts[i][1]))) / s.scale : null;
    steps.push({ t, d });
    prev = { pts, facing: s.facing };
  }
  for (let i = 2; i < steps.length - 2; i++) {
    const d = steps[i].d, n = [steps[i - 2].d, steps[i - 1].d, steps[i + 1].d, steps[i + 2].d];
    if (d === null || n.some(x => x === null)) continue;
    assert.ok(d < 2.5 * Math.max(...n) + 0.02, `pop of ${d.toFixed(3)} head units at ${steps[i].t.toFixed(3)} s (neighbours ${n.map(x => x.toFixed(3)).join(', ')})`);
  }
});

test('clips: jump has crouch, flight, landing squash; skid stops at the target; bounce stays planted', () => {
  const pf = CharPerform.compile(kai, [{ t: 0, action: 'jump', args: { to: 600 } }], env);
  const stand = pf.sample(0).pose.root[1];
  let low1 = Infinity, high = -Infinity, tHigh = 0, low2 = Infinity;
  for (let t = 0; t <= pf.end(0); t += 0.01) { const r = pf.sample(t).pose.root[1]; if (r > high) { high = r; tHigh = t; } }
  for (let t = 0; t <= pf.end(0); t += 0.01) { const r = pf.sample(t).pose.root[1]; if (t < tHigh) low1 = Math.min(low1, r); else low2 = Math.min(low2, r); }
  assert.ok(low1 < stand - 0.15 && high > stand + 0.3 && low2 < stand - 0.2);
  assert.ok(Math.abs(pf.sample(pf.end(0) + 0.5).x - 600) < 10);
  const sk = CharPerform.compile(kai, [{ t: 0, action: 'run', args: { to: 1200, end: 'skid' } }], env);
  assert.ok(Math.abs(sk.sample(sk.end(0) + 0.5).x - 1200) < 0.35 * LEG * sk.scale, 'skid ends near the target');
  const b = CharPerform.compile(kai, [{ t: 0.2, action: 'bounce', args: { times: 3 } }], env);
  const toe0 = stagePt(b.sample(0.2), CharRig.footPoints(ch, b.sample(0.2).pose.legs.near.foot, 0).toe);
  for (let t = 0.2; t < b.end(0); t += 0.02) {
    const s = b.sample(t), leg = s.pose.legs.near, toe = stagePt(s, CharRig.footPoints(ch, leg.foot, leg.footAngle).toe);
    assert.ok(Math.abs(toe[0] - toe0[0]) < 1.5, `toe stays put while bouncing (t=${t.toFixed(2)})`);
  }
});

test('soft skin: a limb is one closed outline; the torso keeps its area when it squashes', () => {
  const d = CharRig.tubeD([[0, 0], [0.3, -0.05], [0.45, 0.2]], [0.07, 0.06, 0.05]);
  assert.strictEqual((d.match(/M/g) || []).length, 1);
  assert.ok(/Z$/.test(d) && !/NaN/.test(d));
  const area = s => {
    const sp = { root: [0, 0], ta: 0, T: 0.6, tb: 0, ts: s, phi: 0 };
    const q = [[-0.2, 0], [0.2, 0], [0.2, 0.6], [-0.2, 0.6]].map(p => CharRig.spineWarp(sp, p).p);
    return Math.abs(q.reduce((a, p, i) => a + p[0] * q[(i + 1) % 4][1] - q[(i + 1) % 4][0] * p[1], 0) / 2);
  };
  assert.ok(Math.abs(area(0.85) - area(1)) < 1e-9 && Math.abs(area(1.15) - area(1)) < 1e-9);
  const svg = CharPerform.draw(kai, CharPerform.compile(kai, story, env).sample(6.3));
  assert.ok(svg.length > 2000 && !/NaN|undefined|Infinity/.test(svg));
  // a skin without the new fields still draws exactly as a plain skin
  assert.ok(!/NaN/.test(CharPerform.draw(tess, CharPerform.compile(tess, story, env).sample(6.3))));
});

const { loadEngine, ROOT } = require('../tools/check.cjs');
const { CharScript, CharStage, lib } = loadEngine(path.join(ROOT, 'films', 'demo'));

test('camera: a set without dolly scales layers as before; with dolly the background grows less', () => {
  const P = CharScript.parse('film "T" 6s\nset hillside\nactor Kai = skin kai at 400\n0 cam: zoom(3, over=0)\n');
  const film = CharStage.compile(P, lib);
  const cam = { x: 700, y: 400, z: 3, sx: 0, sy: 0 };
  for (const d of [0, 0.3, 0.5, 1, 1.2]) {
    const p = film.toScreen([900, 300], cam, d), zd = 1 + (cam.z - 1) * d;
    const cx = 640 + (cam.x - 640) * d, cy = 360 + (cam.y - 360) * d;
    assert.ok(Math.abs(p[0] - ((900 - cx) * zd + 640)) < 1e-9 && Math.abs(p[1] - ((300 - cy) * zd + 360)) < 1e-9, 'unchanged at depth ' + d);
  }
  const lib2 = Object.assign({}, lib, { sets: Object.assign({}, lib.sets, { hillside: Object.assign({}, lib.sets.hillside, { dolly: true }) }) });
  const f2 = CharStage.compile(P, lib2);
  const sc = (f, d) => (f.toScreen([901, 300], cam, d)[0] - f.toScreen([900, 300], cam, d)[0]);
  assert.ok(Math.abs(sc(f2, 1) - 3) < 1e-9, 'actors and depth 1 scale by the zoom');
  assert.ok(Math.abs(sc(f2, 0.5) - 1 / (1 - 0.5 * (1 - 1 / 3))) < 1e-9 && sc(f2, 0.5) < sc(film, 0.5), 'depth 0.5 grows less');
  assert.ok(sc(f2, 0.02) < 1.02, 'the sky barely changes');
});

test('camera: frame() puts the actor at x of the frame, head to thigh filling the height; home() returns', () => {
  const P = CharScript.parse('film "T" 8s\nset hillside\nactor Kai = skin kai at 600\n0 cam: frame(on=Kai, top=head, bottom=thigh, x=0.3, over=0)\n4 cam: home(over=1)\n');
  assert.deepStrictEqual(P.diagnostics.filter(d => d.severity === 'error'), []);
  const film = CharStage.compile(P, lib), c = film.camera(1);
  assert.ok(c.z > 3, 'close-up zoom ' + c.z.toFixed(2));
  const kx = film.toScreen([600, film.ground(600)], c, 1)[0];
  assert.ok(Math.abs(kx - 0.3 * 1280) < 30, 'actor at 30% of the frame width: ' + kx.toFixed(0));
  const base = CharStage.compile(CharScript.parse('film "T" 8s\nset hillside\nactor Kai = skin kai at 600\n'), lib).camera(6);
  assert.ok(Math.abs(film.camera(6).z - base.z) < 1e-9 && Math.abs(film.camera(6).y - base.y) < 1e-9, 'home() is the base camera');
});
