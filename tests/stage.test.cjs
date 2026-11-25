// node --test tests/stage.test.cjs : script language, diagnostics, stage determinism.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadEngine, ROOT } = require('../tools/check.cjs');
const { CharScript, CharStage, lib } = loadEngine(path.join(ROOT, 'films', 'demo'));

const HEAD = 'film "T" 20s\nset hillside\nactor Kai = skin tess at 200\npuppet Pip = bird at branch\nprop lantern at 500\n';
const parse = body => CharScript.parse(HEAD + body);
const codes = P => P.diagnostics.map(d => d.code);
const find = (P, code) => P.diagnostics.find(d => d.code === code);
const LINE = 6;   // first line after HEAD

test('header statements', () => {
  const P = CharScript.parse('# comment\nfilm "The Bridge" 30s\nset hillside dusk\nactor Kai = skin tess at 120 facing left scale=0.9\npuppet Pip = bird at branch\nprop lantern as Lamp at 300\n');
  assert.deepStrictEqual(P.film, { title: 'The Bridge', duration: 30, line: 2 });
  assert.deepStrictEqual(P.sets, [{ name: 'hillside', variant: 'dusk', line: 3 }]);
  assert.strictEqual(P.actors[0].name, 'Kai'); assert.strictEqual(P.actors[0].skin, 'tess');
  assert.strictEqual(P.actors[0].at, 120); assert.strictEqual(P.actors[0].facing, -1); assert.strictEqual(P.actors[0].scale, 0.9);
  assert.deepStrictEqual([P.puppets[0].name, P.puppets[0].kind, P.puppets[0].at], ['Pip', 'bird', 'branch']);
  assert.deepStrictEqual([P.props[0].kind, P.props[0].name, P.props[0].at], ['lantern', 'Lamp', 300]);
  assert.deepStrictEqual(P.diagnostics, []);
});

test('timed statements of every target kind', () => {
  const P = parse([
    '1.0 Kai: walk(to=420), face(scared)   # two channels on one line',
    '2 Pip: hop(to=600)',
    '3.5 cam: pan(to=hilltop, over=2), zoom(1.3)',
    '4 caption: "He had never crossed it.", for=2',
    '5 card: "The end"',
    '6 cam: shake(5), fade(out, over=0.5)',
    '7 caption: show("Hi", by=Kai)',
    '8 Pip: perch',
  ].join('\n'));
  assert.deepStrictEqual(P.diagnostics, []);
  const [w, pip, cam, cap, card, cam2, bub, perch] = P.statements;
  assert.deepStrictEqual([w.t, w.calls.map(c => c.name), w.calls[0].args.to, w.calls[1].args.mood], [1, ['walk', 'face'], 420, 'scared']);
  assert.strictEqual(pip.calls[0].name, 'hop'); assert.strictEqual(pip.calls[0].given.to, 600);
  assert.deepStrictEqual([cam.calls[0].args, cam.calls[1].args], [{ to: 'hilltop', over: 2 }, { to: 1.3, over: 1 }]);
  assert.deepStrictEqual(cap.calls[0].args, { text: 'He had never crossed it.', for: 2, at: 'bottom', by: '' });
  assert.strictEqual(card.calls[0].args.text, 'The end');
  assert.deepStrictEqual([cam2.calls[0].args.amount, cam2.calls[1].args.dir], [5, 'out']);
  assert.strictEqual(bub.calls[0].args.by, 'Kai');
  assert.strictEqual(perch.calls[0].name, 'perch');
});

test('relative times start after the target\'s previous statement ends', () => {
  const P = parse('1 cam: pan(to=900, over=2)\n+0.5 cam: zoom(1.2, over=1)\n+0 cam: shake()\n2 caption: "a", for=1.5\n+1 caption: "b"');
  const [a, b, c, d, e] = P.statements;
  assert.strictEqual(b.t, 3.5);      // pan 1..3, +0.5
  assert.strictEqual(c.t, 4.5);      // zoom 3.5..4.5, +0
  assert.strictEqual(e.t, 4.5);      // caption 2..3.5, +1
  // actors: the stage resolves "+" with the performer's exact end time
  const P2 = parse('0 Kai: walk(to=600)\n+0.25 Kai: wave()');
  const film = CharStage.compile(P2, lib);
  const walk = P2.statements[0], wave = P2.statements[1];
  assert.ok(walk.end > 1, 'a 400 px walk takes more than a second');
  assert.ok(Math.abs(wave.t - (walk.end + 0.25)) < 1e-3, `wave at ${wave.t}, walk ends ${walk.end}`);
  assert.ok(film.duration === 20);
});

test('syntax and header diagnostics carry the line and what to write', () => {
  let P = CharScript.parse('set hillside\n');
  assert.ok(codes(P).includes('no-film'));
  P = CharScript.parse('film "x" 5s\n');
  assert.ok(codes(P).includes('no-set'));
  P = parse('set meadow');
  assert.strictEqual(find(P, 'one-set').line, LINE);
  P = parse('actor Kai = skin tess at 50');
  assert.match(find(P, 'duplicate').message, /already used/);
  P = parse('actor cam = skin tess at 50');
  assert.ok(codes(P).includes('reserved'));
  P = parse('walk Kai to 300');
  assert.strictEqual(find(P, 'syntax').line, LINE);
  P = parse('2.0 Kai walk(to=3)');
  assert.match(find(P, 'syntax').message, /<time> <target>: call/);
  P = parse('actor Bo = tess at 10');
  assert.match(find(P, 'syntax').message, /actor Kai = skin kai at 120/);
});

test('unknown target and action list the valid names and suggest a fix', () => {
  let P = parse('1 Kia: walk(to=300)');
  let d = find(P, 'unknown-target');
  assert.strictEqual(d.line, LINE);
  assert.match(d.message, /Did you mean 'Kai'/);
  assert.match(d.message, /Valid targets: Kai, Pip, cam, caption, card/);
  P = parse('1 Kai: wlak(to=300)');
  d = find(P, 'unknown-action');
  assert.match(d.message, /Did you mean 'walk'/);
  assert.match(d.message, /Valid for actors: .*wave/);
  P = parse('1 cam: dolly(to=3)');
  assert.match(find(P, 'unknown-action').message, /pan, follow, cut, zoom, shake, fade/);
  P = parse('1 lantern: wave()');
  assert.match(find(P, 'unknown-target').message, /hold\(lantern\)/);
});

test('argument diagnostics', () => {
  let P = parse('1 Kai: walk(to=300, sped=2)');
  assert.match(find(P, 'bad-arg').message, /no argument 'sped'.*Did you mean 'speed'/);
  P = parse('1 Kai: walk()');
  assert.match(find(P, 'bad-arg').message, /needs to=/);
  P = parse('1 cam: pan(to=300, over=slow)');
  assert.match(find(P, 'bad-arg').message, /over must be a number/);
  P = parse('1 cam: fade(sideways)');
  assert.match(find(P, 'bad-arg').message, /Use one of: in, out/);
  P = parse('1 cam: zoom(1.2, 3, 4)');
  assert.match(find(P, 'bad-arg').message, /takes 2 argument/);
});

test('channel clash on one line', () => {
  const P = parse('1 Kai: walk(to=300), run(to=500)');
  const d = find(P, 'channel-clash');
  assert.strictEqual(d.line, LINE);
  assert.match(d.message, /both use the body channel/);
  const Q = parse('1 cam: pan(to=900), follow(Kai)');
  assert.ok(codes(Q).includes('channel-clash'));
});

test('time order, overlap and past-end', () => {
  let P = parse('5 Kai: wave()\n3 Kai: face(happy)');
  assert.strictEqual(find(P, 'time-order').line, LINE + 1);
  P = parse('1 cam: pan(to=1200, over=4)\n2 cam: pan(to=300)');
  const d = find(P, 'overlap');
  assert.strictEqual(d.line, LINE + 1);
  assert.match(d.message, /runs until 5.00s.*\+0/);
  P = parse('25 caption: "late"');
  assert.match(find(P, 'past-end').message, /film is 20s long/);
  // actor overlap is found by the stage with exact walk times
  P = parse('0 Kai: walk(to=1500)\n1 Kai: run(to=200)');
  const film = CharStage.compile(P, lib);
  assert.ok(film.diagnostics.some(x => x.code === 'overlap' && x.line === LINE + 1));
});

test('library diagnostics: set, variant, skin, puppet, state, prop, place', () => {
  const P = CharScript.parse('film "x" 5s\nset hilside noon\nactor A = skin nobody at 100\npuppet B = dragon at 100\npuppet C = bird at nowhere\nprop bucket\n' +
    '1 C: dance\n2 C: fly()\n1 A: hold(lamp)\n2 A: walk(to=hiltop)\n3 cam: zoom(0.5)');
  const v = CharScript.validate(P, lib);
  const c = v.map(d => d.code);
  assert.match(v.find(d => d.code === 'unknown-set').message, /Did you mean 'hillside'/);
  for (const k of ['unknown-skin', 'unknown-puppet', 'unknown-prop', 'unknown-action', 'unknown-place']) assert.ok(c.includes(k), k);
  assert.match(v.find(d => d.code === 'unknown-action').message, /perch, hop, flap, fly/);
  assert.ok(v.some(d => d.code === 'bad-arg' && /fly needs to=/.test(d.message)));
  assert.ok(v.some(d => /cannot hold 'lamp'/.test(d.message)));
  assert.ok(v.some(d => /zoom below 1/.test(d.message)));
  const P2 = CharScript.parse('film "x" 5s\nset hillside noon\n');
  assert.ok(CharScript.validate(P2, lib).some(d => d.code === 'unknown-variant' && /day, dawn, dusk, night/.test(d.message)));
});

test('seek is order independent (pure function of time)', () => {
  const src = require('node:fs').readFileSync(path.join(ROOT, 'films', 'demo', 'film.char'), 'utf8');
  const a = CharStage.compile(CharScript.parse(src), lib), b = CharStage.compile(CharScript.parse(src), lib);
  const times = [0, 0.5, 1.37, 3.3, 4.04, 6.2, 7.77, 9.5];
  const fwd = times.map(t => a.frame(t));
  const order = [6, 2, 7, 0, 5, 1, 4, 3, 2, 6];
  for (const i of order) assert.strictEqual(b.frame(times[i]), fwd[i], `frame at ${times[i]} differs`);
  // mount writes the same markup into an element
  const el = { innerHTML: '' };
  const m = CharStage.mount(el, CharScript.parse(src), lib);
  m.seek(7.77); m.seek(1.37);
  assert.strictEqual(el.innerHTML, fwd[2]);
});

test('camera never shows past the edge of the set', () => {
  const P = parse('0 cam: pan(to=5000, over=1), zoom(1.5, over=1)\n3 cam: pan(to=-400, over=0.5)');
  const film = CharStage.compile(P, lib);
  for (let t = 0; t <= 6; t += 0.25) {
    const c = film.camera(t);
    assert.ok(c.x - 640 / c.z >= -1e-6 && c.x + 640 / c.z <= film.W + 1e-6, `edge visible at ${t}`);
  }
});

test('a held prop is drawn at the hand', () => {
  const P = parse('0 Kai: hold(lantern)\n1 Kai: walk(to=500)');
  const film = CharStage.compile(P, lib);
  const A = film.actors[0];
  const t = 2.0, smp = A.sample(t), svg = film.frame(t);
  const hand = smp.held && Array.isArray(smp.held.joint) ? smp.held.joint : A.joints(t).hands.near;
  const m = [...svg.matchAll(/translate\(([-\d.]+) ([-\d.]+)\) rotate\(/g)].map(x => [+x[1], +x[2]]);
  assert.ok(m.some(p => Math.hypot(p[0] - hand[0], p[1] - hand[1]) < 1.5), `no prop at hand ${hand}`);
});

test('clock: freeze holds the world, tempo snaps poses to the beat', () => {
  const src = `film "Clock" 6s
set hillside
actor Tess = skin tess at 300
0 clock: tempo(bpm=120)
0 Tess: walk(to=700, steps=6)
2 clock: freeze(for=1)`;
  const film = CharStage.compile(CharScript.parse(src), lib);
  assert.ok(!film.diagnostics.some(d => d.severity === 'error'), JSON.stringify(film.diagnostics));
  const A = film.actors[0];
  assert.deepStrictEqual(A.sample(2.2).x, A.sample(2.9).x);                 // frozen
  assert.ok(Math.abs(film.toWorld(3.5) - 2.5) < 1e-9 && Math.abs(film.toReal(2.5) - 3.5) < 1e-9);
  assert.deepStrictEqual(A.sample(0.6).pose.root, A.sample(0.8).pose.root);   // holds between beats
  assert.ok(film.contacts().length > 4);
});
