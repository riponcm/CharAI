// node --test tests/actions.test.cjs : every action file (actions/) on every drawn cast body, plus moods.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { loadEngine, ROOT } = require('../tools/check.cjs');
const { CharScript, CharStage, lib } = loadEngine(path.join(ROOT, 'films', 'cast'));
// the re-test bodies live in another film: register them too
for (const f of fs.readdirSync(path.join(ROOT, 'films', 'retest', 'skins'))) vm.runInThisContext('(function (module, exports, require) {' + fs.readFileSync(path.join(ROOT, 'films', 'retest', 'skins', f), 'utf8') + '\n})').call(globalThis);
const CharRig = globalThis.CharRig;
const BODIES = ['tot', 'gramps', 'baker', 'vera', 'titan', 'skye', 'captain', 'duchess'];
const ACTS = Object.keys(globalThis.CharActions || {}).filter(n => !globalThis.CharActions[n].pair).sort();   // pairs: tests/pairs.test.cjs
const film = (body, lines) => {
  const P = CharScript.parse(`film "t" 30s\nstage width=5000 ground=600 scale=60\nactor A = skin ${body} at 800\n${lines}\n`);
  return { P, F: CharStage.compile(P, lib) };
};

test('the action library is there and every body exists', () => {
  for (const a of ['bow', 'shrug', 'clap', 'pickup', 'stomp', 'slump', 'lookaround', 'stumble']) assert.ok(ACTS.includes(a), 'missing action ' + a);
  for (const b of BODIES) assert.ok(lib.skins[b], 'missing body ' + b);
});

for (const act of ACTS) {
  test(`${act}: on every body: clean values, planted feet stay, hand targets reached, hands out of the head`, () => {
    const def = globalThis.CharActions[act];
    for (const body of BODIES) {
      const { P, F } = film(body, `0.4 A: ${act}()`);
      assert.deepStrictEqual(P.diagnostics.filter(d => d.severity === 'error').map(d => d.message), [], `${act} on ${body}`);
      const A = F.actors[0], ch = CharRig.skinCharacter(A.skin), pr = ch.proportions, end = P.statements.find(s => s.kind === 'actor').end;
      const reach = pr.upperArm + pr.foreArm, W = ch.body ? ch.body.b.headWidth : 0.9;
      const headAim = !!def.contact || (def.keys || []).some(k => [k.handNear, k.handFar].some(h => h && /top|forehead|eye|mouth|chin|ear|backhead/.test(JSON.stringify(h))));
      const planted = def.channel !== 'arms' && (def.planted === undefined ? !def.travel && !def.air && !def.step : def.planted === 'both');
      let first = null;
      for (let t = 0.4; t <= end + 0.4; t += 1 / 30) {
        const s = A.perf.sample(t);
        assert.ok(!/NaN|null/.test(JSON.stringify([s.x, s.y, s.pose.root, s.pose.arms, s.pose.legs])), `${act} on ${body}: bad value at ${t.toFixed(2)}`);
        const sol = CharRig.solve(ch, s.pose), J = sol.joints;
        if (planted && t > 0.6 && t < end - 0.05) {
          const feet = ['near', 'far'].map(sd => { const fp = CharRig.footPoints(ch, s.pose.legs[sd].foot, s.pose.legs[sd].footAngle); return [s.x + s.facing * s.scale * fp.toe[0], s.x + s.facing * s.scale * fp.heel[0]]; });
          if (!first) first = feet;
          for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) assert.ok(Math.abs(feet[i][j] - first[i][j]) < 2.5, `${act} on ${body}: planted foot moved ${Math.abs(feet[i][j] - first[i][j]).toFixed(1)}px at ${t.toFixed(2)}`);
        }
        if (!headAim) {
          const a = sol.angles.head, hc = [J.headBase[0] - 0.02 * Math.cos(a) - 0.52 * Math.sin(a), J.headBase[1] - 0.02 * Math.sin(a) + 0.52 * Math.cos(a)];
          for (const sd of ['near', 'far']) assert.ok(Math.hypot(J['wrist.' + sd][0] - hc[0], J['wrist.' + sd][1] - hc[1]) > 0.4 * Math.max(0.8, W), `${act} on ${body}: ${sd} hand in the head at ${t.toFixed(2)}`);
        }
      }
      // hand targets: the wrist comes within reach-scaled distance of each reachable target near its key
      const ev = A.events.find(e => e.action === act), t0 = ev ? ev.t : 0.4;
      for (const g of A.perf.actionTargets(act)) {
        const s0 = A.perf.sample(t0 + g.t), sh = CharRig.solve(ch, s0.pose).joints['shoulder.' + g.side];
        if (Math.hypot(g.target[0] - sh[0], g.target[1] - sh[1]) > 0.95 * reach) continue;   // out of reach on this body
        let best = Infinity;
        for (let dt = -0.3; dt <= 0.35; dt += 0.025) {
          const w = CharRig.solve(ch, A.perf.sample(t0 + g.t + dt).pose).joints['wrist.' + g.side], tg = A.perf.landmarkAt(t0 + g.t + dt, g.side, g.at) || g.target;
          best = Math.min(best, Math.hypot(w[0] - tg[0], w[1] - tg[1]));
        }
        assert.ok(best < Math.max(0.15, 0.15 * reach), `${act} on ${body}: ${g.side} hand ${best.toFixed(2)} from ${JSON.stringify(g.at)}`);
      }
    }
  });
}

test('actions: the same frame for any seek order', () => {
  const { F } = film('baker', '0.2 A: mood(angry)\n0.4 A: stomp()\n+0.1 A: clap()\n+0.1 A: pickup()');
  const A = F.actors[0], times = [3.1, 0.5, 2.2, 4.4, 1.3];
  const first = times.map(t => JSON.stringify(A.sample(t)));
  for (let i = 0; i < 40; i++) A.sample((i * 1.37) % 5);
  assert.deepStrictEqual(times.map(t => JSON.stringify(A.sample(t))), first);
});

test('moods change the walk: sad is slower and bent, angry and proud differ, on every body', () => {
  for (const body of ['tot', 'baker', 'vera']) {
    const get = m => {
      const { F } = film(body, `0 A: mood(${m})\n0.8 A: walk(to=1600)`), A = F.actors[0], ch = CharRig.skinCharacter(A.skin);
      let lean = 0, n = 0;
      for (let t = 1.5; t < 3.5; t += 0.1) { const p = A.sample(t).pose; lean += p.spineLean + (p.torsoBend || 0) * 0.5; n++; }
      return { lean: lean / n, x: A.sample(3.5).x };
    };
    const neu = get('neutral'), sad = get('sad'), angry = get('angry'), proud = get('proud');
    assert.ok(sad.lean > neu.lean + 0.1 && sad.x < neu.x, `${body}: sad walks bent and slower`);
    assert.ok(proud.lean < neu.lean - 0.05, `${body}: proud leans back`);
    assert.ok(angry.lean > neu.lean + 0.05 && angry.x > sad.x, `${body}: angry leans in and walks faster than sad`);
  }
});

test('chained actions: the actor is drawn and sane at every moment of a hand-over', () => {
  for (const body of ['baker', 'vera', 'tot']) {
    const { P, F } = film(body, '0.4 A: liedown()\n+0.1 A: getup()\n+0.1 A: jumpjoy()\n+0.1 A: sit()\n+0.1 A: cry()\n+0.1 A: standup()\n+0.1 A: thumbsup()');
    assert.deepStrictEqual(P.diagnostics.filter(d => d.severity === 'error').map(d => d.message), []);
    const A = F.actors[0], ch = CharRig.skinCharacter(A.skin), end = Math.max(...P.statements.map(s => s.end || 0));
    for (let t = 0.3; t < end + 0.5; t += 1 / 20) {
      const s = A.sample(t), svg = F.frame(t);
      assert.ok(!/NaN|Infinity|undefined/.test(svg) && (svg.match(/<path/g) || []).length > 20, `${body}: nothing drawn at ${t.toFixed(2)}`);
      assert.ok(s.pose.root[1] > 0.3 * ch.proportions.radius.hip, `${body}: pelvis in the ground at ${t.toFixed(2)}`);
    }
  }
});

test('an action started while sitting keeps the sit and plays its upper body', () => {
  const { F } = film('tot', '0.4 A: sit()\n+0.1 A: cry()');
  const A = F.actors[0], ch = CharRig.skinCharacter(A.skin), L = ch.proportions.thigh + ch.proportions.shin;
  const sat = A.sample(2.0).pose.root[1];
  for (let t = 2.2; t < 4; t += 0.1) assert.ok(A.sample(t).pose.root[1] < sat + 0.15 * L, `stays seated at ${t.toFixed(1)}`);
});
