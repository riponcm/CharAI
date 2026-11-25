// Performer tests (STAGE.md sections 2 and 3). Run: node --test tests/perform.test.cjs
const test = require('node:test');
const assert = require('node:assert');
const CharRig = require('../src/rig.js');
const CharPerform = require('../src/perform.js');
const tess = require('../skins/tess.js');

const ch = CharRig.skinCharacter(tess);
const pr = ch.proportions;
const LEG = pr.thigh + pr.shin;
const GROUND = 500;
const env = { ground: GROUND, x: 300, anchors: { tree: 700, nest: [650, 200], mover: t => [400 + 50 * t, 300] } };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// stage-space foot contact points for one sample
function feetStage(s) {
  const out = {};
  for (const side of ['near', 'far']) {
    const leg = s.pose.legs[side];
    const fp = CharRig.footPoints(ch, leg.foot, leg.footAngle);
    const st = p => [s.x + s.facing * s.scale * p[0], s.y - s.scale * p[1]];
    out[side] = { heel: st(fp.heel), toe: st(fp.toe), a: leg.footAngle, heelH: fp.heel[1], toeH: fp.toe[1], ground: fp.ground };
  }
  return out;
}

// one representative script per action (the action under test starts at t = 0.5)
const scripts = {
  walk: [{ t: 0.5, action: 'walk', args: { to: 620 } }],
  run: [{ t: 0.5, action: 'run', args: { to: 800 } }],
  sneak: [{ t: 0.5, action: 'sneak', args: { to: 520 } }],
  jump: [{ t: 0.5, action: 'jump', args: { to: 'tree', height: 1.5 } }],
  turn: [{ t: 0.5, action: 'turn' }],
  enter: [{ t: 0.5, action: 'enter', args: { from: 'right' } }],
  stand: [{ t: 0.1, action: 'kneel' }, { t: 1.5, action: 'stand' }],
  idle: [{ t: 0.5, action: 'idle' }],
  kneel: [{ t: 0.5, action: 'kneel' }],
  crouch: [{ t: 0.5, action: 'crouch' }],
  recoil: [{ t: 0.5, action: 'recoil' }],
  sit: [{ t: 0.5, action: 'sit' }, { t: 3, action: 'sit', args: { on: 40 } }],
  wave: [{ t: 0.5, action: 'wave', args: { hand: 'both' } }],
  point: [{ t: 0.5, action: 'point', args: { at: 'nest' } }],
  reach: [{ t: 0.5, action: 'reach', args: { at: 'mover' } }],
  cheer: [{ t: 0.5, action: 'cheer' }],
  hold: [{ t: 0.5, action: 'hold', args: { prop: 'lantern', how: 'up' } }, { t: 1.5, action: 'wave' }],
  drop: [{ t: 0.1, action: 'hold', args: { prop: 'box', how: 'front' } }, { t: 1, action: 'drop' }],
  face: [{ t: 0.5, action: 'face', args: { mood: 'scared' } }],
  look: [{ t: 0.5, action: 'look', args: { at: 'nest' } }, { t: 1, action: 'look', args: { at: 'up' } }, { t: 1.5, action: 'look', args: { at: 'back' } }],
  nod: [{ t: 0.5, action: 'nod' }],
  peer: [{ t: 0.5, action: 'peer' }, { t: 2, action: 'recoil' }],
  breathe: [{ t: 0.1, action: 'recoil' }, { t: 1.2, action: 'breathe' }],
  wobble: [{ t: 0.1, action: 'jump', args: { to: 500 } }, { t: 1.6, action: 'wobble' }],
  clench: [{ t: 0.5, action: 'clench', args: { for: 1 } }],
  pet: [{ t: 0.1, action: 'kneel' }, { t: 1.2, action: 'pet', args: { at: 'tree' } }],
  fallsit: [{ t: 0.5, action: 'fallsit' }, { t: 2.2, action: 'stand' }],
  hesitate: [{ t: 0.5, action: 'hesitate', args: { at: 'nest' } }],
  tug: [{ t: 0.5, action: 'tug', args: { at: 'nest', for: 1 } }],
  shield: [{ t: 0.5, action: 'shield', args: { for: 1 } }],
  laugh: [{ t: 0.5, action: 'laugh', args: { for: 1 } }],
  backstep: [{ t: 0.5, action: 'backstep' }],
  clap: [{ t: 0.5, action: 'clap', args: { for: 1.5 } }],
  waveover: [{ t: 0.5, action: 'waveover', args: { hand: 'both' } }],
  psych: [{ t: 0.5, action: 'psych' }],
  cheerbeat: [{ t: 0.5, action: 'cheerbeat', args: { alt: 2 } }],
  bounce: [{ t: 0.5, action: 'bounce', args: { times: 2 } }],
  skid: [{ t: 0.3, action: 'run', args: { to: 900, end: 'skid' } }, { t: 4, action: 'skid' }],
  say: [{ t: 0.3, action: 'say', args: { text: 'Good morning, little one!', for: 1.8 } }, { t: 2.4, action: 'say', args: { text: 'Hm.', beats: 1 } }],
  mood: [{ t: 0.2, action: 'mood', args: { name: 'sad' } }, { t: 0.5, action: 'walk', args: { to: 600 } }, { t: 4, action: 'mood', args: { name: 'angry', strength: 1.5 } }],
};
const span = (pf, evs) => [0, Math.max(...evs.map((e, i) => pf.end(i))) + 0.8];
function allFinite(v, path) {
  if (typeof v === 'number') { assert.ok(Number.isFinite(v), `not finite at ${path}: ${v}`); return; }
  if (Array.isArray(v)) v.forEach((x, i) => allFinite(x, path + '[' + i + ']'));
  else if (v && typeof v === 'object') for (const k of Object.keys(v)) allFinite(v[k], path + '.' + k);
}

test('every action in CharPerform.actions has a test script', () => {
  for (const name of Object.keys(CharPerform.actions)) assert.ok(scripts[name], `no script for ${name}`);
  for (const name of Object.keys(CharPerform.actions)) {
    const a = CharPerform.actions[name];
    assert.ok(['body', 'arms', 'face', 'look', 'mood', 'say'].includes(a.channel), name + ' channel');
    assert.strictEqual(typeof a.doc, 'string');
  }
});

for (const name of Object.keys(scripts)) {
  test(`${name}: compiles, samples and draws without NaN; no diagnostics`, () => {
    const evs = scripts[name];
    const pf = CharPerform.compile(tess, evs, env);
    assert.deepStrictEqual(pf.diagnostics.filter(d => d.severity === 'error'), []);
    const [a, b] = span(pf, evs);
    for (let t = a; t <= b; t += 0.05) {
      const s = pf.sample(t);
      allFinite({ x: s.x, y: s.y, pose: s.pose, held: s.held }, `${name}@${t.toFixed(2)}`);
      assert.ok(s.facing === 1 || s.facing === -1);
      for (const k of ['hand', 'mouth', 'eye', 'brow']) assert.strictEqual(typeof s.swaps[k], 'string', `${name} swap ${k}`);
    }
    const svg = CharPerform.draw(tess, pf.sample((a + b) / 2));
    assert.ok(svg.length > 1000 && !/NaN|undefined|Infinity/.test(svg), 'draw output is clean');
    for (let i = 0; i < evs.length; i++) assert.ok(pf.end(i) >= evs[i].t, 'end after start');
  });

  test(`${name}: feet never under the ground, limb lengths within the stretch limit`, () => {
    const evs = scripts[name];
    const pf = CharPerform.compile(tess, evs, env);
    const [a, b] = span(pf, evs);
    for (let t = a; t <= b; t += 1 / 60) {
      const s = pf.sample(t);
      const f = feetStage(s);
      for (const side of ['near', 'far']) for (const q of f[side].ground) assert.ok(q[1] > -1e-6, `${name} ${side} foot ${q[1].toFixed(4)} below ground at ${t.toFixed(3)}`);
      const J = CharRig.solve(ch, s.pose).joints;
      for (const side of ['near', 'far']) {
        const segs = [['hip', 'knee', pr.thigh], ['knee', 'ankle', pr.shin], ['shoulder', 'elbow', pr.upperArm], ['elbow', 'wrist', pr.foreArm]];
        for (const [p, c, l] of segs) {
          const r = dist(J[p + '.' + side], J[c + '.' + side]) / l;
          assert.ok(r > 1 - 1e-9 && r <= 1.12 + 1e-9, `${name} ${side} ${p}-${c} stretch ${r.toFixed(4)} at ${t.toFixed(3)}`);
        }
      }
    }
  });
}

for (const name of ['walk', 'run', 'sneak', 'enter']) {
  test(`${name}: no foot slide in stage space (planted heel or toe moves < 1% of leg length)`, () => {
    const evs = scripts[name];
    const pf = CharPerform.compile(tess, evs, env);
    const [a, b] = span(pf, evs);
    const tol = 0.01 * LEG * pf.scale, eps = 0.004 * LEG;
    let planted = 0;
    const anchor = { near: {}, far: {} };
    for (let t = a; t <= b; t += 1 / 240) {
      const s = pf.sample(t);
      if (s.offstage) continue;
      const f = feetStage(s);
      for (const side of ['near', 'far']) {
        const F = f[side], A = anchor[side];
        for (const [pt, h, ok] of [['heel', F.heelH, F.a >= -1e-9], ['toe', F.toeH, F.a <= 1e-9]]) {
          if (ok && h < eps) {
            if (!A[pt]) A[pt] = F[pt];
            const d = Math.abs(F[pt][0] - A[pt][0]);
            assert.ok(d < tol, `${name} ${side} ${pt} slid ${d.toFixed(2)} px (tol ${tol.toFixed(2)}) at t=${t.toFixed(3)}`);
            planted++;
          } else A[pt] = null;
        }
      }
    }
    assert.ok(planted > 100, 'feet were planted for a good share of the motion');
  });
}

test('locomotion arrives at its target', () => {
  for (const [name, to] of [['walk', 620], ['run', 800], ['sneak', 520]]) {
    const pf = CharPerform.compile(tess, [{ t: 0, action: name, args: { to } }], env);
    const s = pf.sample(pf.end(0) + 0.5);
    assert.ok(Math.abs(s.x - to) < 0.12 * LEG * pf.scale, `${name} ended at ${s.x.toFixed(1)}, wanted ${to}`);
  }
  const back = CharPerform.compile(tess, [{ t: 0, action: 'walk', args: { to: 100 } }], env);
  const s = back.sample(back.end(0) + 0.5);
  assert.strictEqual(s.facing, -1, 'walking left turns her round');
});

test('a kneel puts the knee on the ground', () => {
  const pf = CharPerform.compile(tess, scripts.kneel, env);
  const s = pf.sample(pf.end(0) + 0.3);
  const J = CharRig.solve(ch, s.pose).joints;
  const kneeBottom = J['knee.near'][1] - pr.radius.knee;
  assert.ok(Math.abs(kneeBottom) < 0.03, `knee bottom at ${kneeBottom.toFixed(3)} head units above the ground`);
});

test('a jump leaves the ground, with a crouch before and a squash after', () => {
  const pf = CharPerform.compile(tess, [{ t: 0, action: 'jump', args: { to: 500 } }], env);
  const stand = pf.sample(0).pose.root[1];
  let minBefore = Infinity, maxH = -Infinity, tMax = 0, minAfter = Infinity;
  for (let t = 0; t <= pf.end(0); t += 0.01) {
    const s = pf.sample(t), r = s.pose.root[1];
    if (r > maxH) { maxH = r; tMax = t; }
  }
  for (let t = 0; t < tMax; t += 0.01) minBefore = Math.min(minBefore, pf.sample(t).pose.root[1]);
  for (let t = tMax; t <= pf.end(0); t += 0.01) minAfter = Math.min(minAfter, pf.sample(t).pose.root[1]);
  assert.ok(minBefore < stand - 0.15, 'anticipation crouch');
  assert.ok(maxH > stand + 0.3, 'airborne');
  assert.ok(minAfter < stand - 0.2, 'landing squash');
  assert.ok(Math.abs(pf.sample(pf.end(0) + 0.5).x - 500) < 10, 'lands at the target');
});

test('sample is a pure function of t', () => {
  const evs = [
    { t: 0, action: 'enter', args: { from: 'left' } }, { t: 3, action: 'run', args: { to: 'tree' } },
    { t: 3.2, action: 'face', args: { mood: 'happy' } }, { t: 5, action: 'jump', args: { to: 500 } },
    { t: 6, action: 'wave' }, { t: 6.5, action: 'look', args: { at: 'mover' } }, { t: 7.5, action: 'kneel' },
  ];
  const A = CharPerform.compile(tess, evs, env), B = CharPerform.compile(tess, evs, env);
  const times = [4.1, 0.3, 7.7, 5.55, 2.2, 6.3, 9];
  const first = times.map(t => JSON.stringify(A.sample(t)));
  // sample in another order, many times, then again
  for (let i = 0; i < 200; i++) A.sample((i * 7.31) % 10);
  const again = times.slice().reverse().map(t => JSON.stringify(A.sample(t))).reverse();
  assert.deepStrictEqual(again, first);
  assert.deepStrictEqual(times.map(t => JSON.stringify(B.sample(t))), first);
});

test('bad scripts give diagnostics and never throw', () => {
  const codes = evs => CharPerform.compile(tess, evs, env).diagnostics.map(d => d.code);
  assert.ok(codes([{ t: 0, action: 'dance' }]).includes('unknown-action'));
  assert.match(CharPerform.compile(tess, [{ t: 0, action: 'wlak', args: { to: 3 } }], env).diagnostics[0].message, /walk/);
  assert.ok(codes([{ t: 0, action: 'walk', args: {} }]).includes('missing-arg'));
  assert.ok(codes([{ t: 0, action: 'walk', args: { to: 'nowhere' } }]).includes('unknown-place'));
  assert.ok(codes([{ t: 'soon', action: 'stand' }]).includes('bad-time'));
  assert.ok(codes([{ t: 0, action: 'face', args: { mood: 'grumpy' } }]).includes('bad-arg'));
  assert.ok(codes([{ t: 0, action: 'stand', args: { speed: 2 } }]).includes('unknown-arg'));
  assert.ok(codes([{ t: 0, action: 'walk', args: { to: 900 } }, { t: 1, action: 'kneel' }]).includes('overlap'));
  assert.ok(codes([{ t: 0, action: 'drop' }]).includes('nothing-held'));
  assert.ok(codes([null, 5, 'x']).includes('bad-event'));
  for (const [skin, evs, e] of [[null, null, null], [{}, 'nonsense', {}], [tess, [{ t: NaN }], { ground: () => { throw Error('x'); } }],
    [tess, [{ t: 1, action: 'walk', args: { to: 'mover' } }], { anchors: { mover: () => null } }]]) {
    const pf = CharPerform.compile(skin, evs, e);
    const s = pf.sample(1.5);
    allFinite({ x: s.x, y: s.y, pose: s.pose }, 'garbage');
    assert.ok(Array.isArray(pf.diagnostics));
    assert.strictEqual(typeof CharPerform.draw(skin, s), 'string');
  }
});

test('on a beat grid a walk takes the asked steps and ends on a grid step', () => {
  const g = 0.5;
  const pf = CharPerform.compile(tess, [{ t: 1, action: 'walk', args: { to: 600, steps: 6 } }, { t: 1, action: 'face', args: { mood: 'happy' } }], Object.assign({}, env, { grid: () => g }));
  const end = pf.end(0);
  assert.ok(Math.abs((end - 1) / g - Math.round((end - 1) / g)) < 1e-6, `walk ends off the grid at ${end}`);
  assert.strictEqual(Math.round((end - 1) / g), 7);   // 6 steps + the settle step
  assert.ok(Math.abs(pf.sample(end + 0.5).x - 600) < 0.12 * LEG * pf.scale);
});

test('on a beat grid a jump lands on a grid step', () => {
  const g = 0.25;
  const pf = CharPerform.compile(tess, [{ t: 1, action: 'jump', args: { to: 600, height: 1.5 } }], Object.assign({}, env, { grid: () => g }));
  const end = pf.end(0);
  assert.ok(Math.abs((end - 1) / g - Math.round((end - 1) / g)) < 1e-6, `jump ends off the grid at ${end}`);
});
