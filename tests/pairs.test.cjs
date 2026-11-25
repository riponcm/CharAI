// node --test tests/pairs.test.cjs : paired actions (docs/PAIRS.md) and props (docs/PROPS.md) on pairs of
// drawn bodies of every size: hands meet their targets, torsos stay apart, planted feet stay, and a frame
// is the same whatever order the frames are asked in.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { loadEngine, ROOT } = require('../tools/check.cjs');
const { CharScript, CharStage, lib } = loadEngine(path.join(ROOT, 'films', 'cast'));
for (const f of fs.readdirSync(path.join(ROOT, 'films', 'retest', 'skins'))) vm.runInThisContext('(function (module, exports, require) {' + fs.readFileSync(path.join(ROOT, 'films', 'retest', 'skins', f), 'utf8') + '\n})').call(globalThis);
for (const f of fs.readdirSync(path.join(ROOT, 'extras', 'props'))) vm.runInThisContext('(function (module, exports, require) {' + fs.readFileSync(path.join(ROOT, 'extras', 'props', f), 'utf8') + '\n})').call(globalThis);
lib.props = Object.assign({}, globalThis.CharProps, lib.props || {});
const ACTS = globalThis.CharActions;
const PAIRS = Object.keys(ACTS).filter(n => ACTS[n].pair).sort();
const SIZES = [['captain', 'tot'], ['tot', 'baker'], ['gramps', 'titan'], ['vera', 'skye']];
const PROP = { give: 'loaf', throwto: 'ball' };

function play(act, a, b) {
  const pr = PROP[act];
  const lines = [`film "t" 30s`, `stage width=5000 ground=600 scale=60`, `actor A = skin ${a} at 700`, `actor B = skin ${b} at 1000 facing left`];
  if (pr) lines.push(`prop ${pr}`, `0.2 A: hold(${pr})`);
  lines.push(`0.8 A: ${act}(with=B${pr ? ', prop=' + pr : ''})`);
  const P = CharScript.parse(lines.join('\n') + '\n');
  return { P, F: CharStage.compile(P, lib) };
}

test('the reference pairs are there', () => {
  for (const n of ['hug', 'handshake', 'highfive', 'pat', 'shove', 'punchblock', 'punchfall', 'give', 'throwto']) assert.ok(PAIRS.includes(n), 'missing pair ' + n);
});

for (const act of PAIRS) for (const [a, b] of SIZES) {
  test(`${act}: ${a} with ${b}: contacts meet, torsos apart, both play their role`, () => {
    const { P, F } = play(act, a, b);
    assert.deepStrictEqual(F.diagnostics.filter(d => d.severity === 'error').map(d => d.message), [], `${act} ${a}+${b}`);
    const [A, B] = F.actors;
    const ev = A.events.find(e => e.action === act + '.a');
    assert.ok(ev, `${a} plays ${act}.a`);
    assert.ok(B.events.some(e => e.action === act + '.b'), `${b} plays ${act}.b`);
    const end = Math.max(...P.statements.filter(s => s.kind === 'actor').map(s => s.end));
    let touched = 0;
    for (let t = ev.t; t <= end; t += 1 / 30) {
      for (const X of [A, B]) {
        const s = X.sample(t);
        for (const c of s.contactErr || []) if (c.w > 0.99 && c.reachable) { touched++; assert.ok(c.err < 0.05, `${act} ${a}+${b}: ${X.name} ${c.side} hand ${c.err.toFixed(3)} heads off the partner's ${c.at} at ${t.toFixed(2)}`); }
      }
      // torsos: compared height by height, a little give allowed
      const sA = A.sample(t), sB = B.sample(t), la = A.perf.pointOf(sA, 'torsoLine'), lb = B.perf.pointOf(sB, 'torsoLine'), side = Math.sign(sB.x - sA.x) || 1;
      for (const p of la) for (let i = 0; i + 1 < lb.length; i++) {
        const q = lb[i], r = lb[i + 1];
        if (p[1] < Math.min(q[1], r[1]) || p[1] > Math.max(q[1], r[1]) || q[1] === r[1]) continue;
        const x = q[0] + (r[0] - q[0]) * (p[1] - q[1]) / (r[1] - q[1]);
        assert.ok(side * (x - p[0]) > -0.12 * Math.min(sA.scale, sB.scale), `${act} ${a}+${b}: torsos overlap by ${(side * (p[0] - x)).toFixed(1)} px at ${t.toFixed(2)}`);
      }
    }
    if (!['throwto'].includes(act)) assert.ok(touched > 0, `${act} ${a}+${b}: no hand ever reached the partner`);
  });
}

test('the partner of a hug or a handshake keeps its feet planted', () => {
  for (const act of ['hug', 'handshake', 'pat']) {
    const { P, F } = play(act, 'gramps', 'vera');
    const B = F.actors[1], ev = B.events.find(e => e.action === act + '.b'), end = P.statements.find(s => s.kind === 'actor').end;
    const foot = t => F.actors[1].joints(t).feet.near.heel;
    const f0 = foot(ev.t + 0.05);
    for (let t = ev.t + 0.05; t < end - 0.3; t += 0.1) assert.ok(Math.abs(foot(t)[0] - f0[0]) < 3, `${act}: vera's near heel slides at ${t.toFixed(2)}`);
  }
});

test('a shove moves a light partner further than a heavy one', () => {
  const dx = (a, b) => { const { F } = play('shove', a, b), B = F.actors[1]; return Math.abs(B.sample(12).x - B.sample(0.5).x) / B.perf.height; };   // in body heights
  assert.ok(dx('titan', 'tot') > 1.5 * dx('tot', 'titan'), 'reaction does not scale with weight');
});

test('a handed-over prop ends with the partner; a thrown one flies and is caught', () => {
  for (const act of ['give', 'throwto']) {
    const { F } = play(act, 'vera', 'skye');
    const B = F.actors[1], s = B.sample(12);
    assert.ok(s.held && s.held.prop === PROP[act], `${act}: skye does not hold the ${PROP[act]} at the end`);
  }
});

test('frames are the same in any seek order', () => {
  const { F } = play('hug', 'baker', 'tot');
  const ts = [1, 2.5, 3.3, 4.1, 4.6, 5.2, 6];
  const fwd = ts.map(t => F.frame(t));
  const { F: F2 } = play('hug', 'baker', 'tot');
  const rev = ts.slice().reverse().map(t => F2.frame(t)).reverse();
  assert.deepStrictEqual(rev, fwd);
});

test('a chair is sat on at its seat, a door knocked on from the action\'s distance', () => {
  const P = CharScript.parse(`film "t" 20s\nstage width=5000 ground=600 scale=60\nactor A = skin gramps at 500\nprop chair at 900\nprop door at 1400\n0.5 A: sit(on=chair)\n+1 A: knock(on=door)\n`);
  const F = CharStage.compile(P, lib);
  assert.deepStrictEqual(F.diagnostics.filter(d => d.severity === 'error').map(d => d.message), []);
  const A = F.actors[0], ev = A.events.find(e => e.action === 'sit');
  assert.ok(ev && ev.args.on > 60, 'sit got the chair seat height');
  const sx = A.perf.pointOf(A.sample(ev.t + 1.5), 'hip')[0];   // the hips, not the feet
  assert.ok(Math.abs(sx - 900) < 0.4 * A.perf.scale, 'sat at the chair: ' + sx.toFixed(1));
  assert.ok(A.events.some(e => e.action === 'knock'), 'knocks');
});

test('a pair line occupies the partner: the partner\'s +0 waits for it', () => {
  const P = CharScript.parse(`film "t" 30s\nstage width=5000 ground=600 scale=60\nactor A = skin vera at 700\nactor B = skin skye at 1000 facing left\n0.5 A: hug(with=B)\n+0 B: wave()\n`);
  CharStage.compile(P, lib);
  const [h, w] = P.statements.filter(s => s.kind === 'actor');
  assert.ok(w.t >= h.end - 1e-3, `B's +0 starts at ${w.t} before the hug ends at ${h.end}`);
});

test('after a pair the two stand apart; chained pairs never leave them inside each other', () => {
  const P = CharScript.parse(`film "t" 40s\nstage width=5000 ground=600 scale=60\nactor A = skin skye at 700\nactor B = skin titan at 1000 facing left\n0.5 A: shove(with=B)\n+0 B: punchblock(with=A)\n+0 A: fistbump(with=B)\n+0 A: hug(with=B)\n`);
  const F = CharStage.compile(P, lib), [A, B] = F.actors;
  const end = Math.max(...P.statements.map(s => s.end)) + 1;
  const sA = A.sample(end), sB = B.sample(end), la = A.perf.pointOf(sA, 'torso'), lb = B.perf.pointOf(sB, 'torso');
  assert.ok(Math.sign(sB.x - sA.x) * (lb[0] - la[0]) > 0.1 * sA.scale, `they rest overlapping: fronts ${la[0].toFixed(0)} and ${lb[0].toFixed(0)}`);
});

test('give picks the prop up first when the giver does not hold it, and the taker ends holding it', () => {
  const P = CharScript.parse(`film "t" 30s\nstage width=5000 ground=600 scale=60\nactor A = skin vera at 700\nactor B = skin skye at 1100 facing left\nprop loaf at 820\n0.5 A: give(with=B, prop=loaf)\n`);
  const F = CharStage.compile(P, lib), [A, B] = F.actors;
  assert.ok(A.events.some(e => e.action === 'pickup'), 'the giver picks it up');
  const take = B.events.find(e => e.action === 'hold');
  assert.ok(take && take.args.quick, 'the taker takes it from the hand');
  assert.strictEqual((B.sample(take.t + 0.05).held || {}).prop, 'loaf', 'held at once, no jump');
});

test('speed and for set the length of a pair; cam frame(on=A+B) parses', () => {
  const len = extra => { const P = CharScript.parse(`film "t" 30s\nstage width=5000 ground=600 scale=60\nactor A = skin vera at 700\nactor B = skin skye at 900 facing left\n0.5 A: handshake(with=B${extra})\n0 cam: frame(on=A+B)\n`); assert.deepStrictEqual(P.diagnostics.filter(d => d.severity === 'error').map(d => d.message), []); CharStage.compile(P, lib); const s = P.statements.find(q => q.kind === 'actor'); return s.end - s.t; };
  const n = len(''), f = len(', speed=2'), g = len(', for=4');
  assert.ok(f < n - 0.5 && g > n, `lengths ${n.toFixed(2)} ${f.toFixed(2)} ${g.toFixed(2)}`);
});

test('a much taller partner reaching down bends or kneels, never topples', () => {
  for (const act of ['handshake', 'pat', 'hug']) {
    const P = CharScript.parse(`film "t" 30s\nstage width=5000 ground=600 scale=60\nactor A = skin titan at 700\nactor B = skin tot at 1000 facing left\n0.5 A: ${act}(with=B)\n`);
    const F = CharStage.compile(P, lib), A = F.actors[0];
    for (let t = 0.5; t < 8; t += 0.1) { const j = A.joints(t); assert.ok(j.head[1] < j.root[1], `${act}: titan's head is below the hips at ${t.toFixed(1)}`); }
  }
});
