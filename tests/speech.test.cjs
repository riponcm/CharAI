// node --test tests/speech.test.cjs : mouth cues from text, tracks and word timings; fallbacks; faces.
const test = require('node:test');
const assert = require('node:assert');
const S = require('../src/speech.js');
const CharRig = require('../src/rig.js');
const CharPerform = require('../src/perform.js');
const mannequin = require('../skins/mannequin.js');

test('text: m, b and p close the mouth; pauses and the end are at rest; stressed syllables open', () => {
  const dur = 2.2, cs = S.fromText('Mama bought pepper, maybe.', dur);
  assert.ok(cs.length > 10);
  for (const c of cs) assert.ok(S.VISEMES.includes(c.v) && c.t >= 0 && c.t <= dur);
  const closes = cs.filter(c => c.v === 'mbp');
  assert.ok(closes.length >= 6, 'every m, b, p closes the lips');
  for (const c of closes) assert.ok(S.at(cs, c.t + 0.02).open < 0.05, `closed at ${c.t.toFixed(2)}`);
  assert.ok(cs.some(c => c.v === 'rest' && c.t > 0.5 && c.t < dur - 0.3), 'the comma rests');
  assert.strictEqual(cs[cs.length - 1].v, 'rest');
  assert.ok(S.at(cs, dur - 0.02).open < 0.05, 'the mouth is at rest at the end');
  assert.ok(cs.some(c => c.stress && (c.v === 'ah' || c.v === 'oh')), 'a stressed open vowel');
  assert.ok(Math.abs(S.estimate('Good morning, little one!') - 2.2) < 1);
});

test('text: non-Latin scripts fall back to an open-close rhythm', () => {
  const cs = S.fromText('こんにちは、元気ですか？', 1.5);
  assert.ok(cs.filter(c => c.v === 'ah' || c.v === 'oh' || c.v === 'ee').length >= 5);
  assert.ok(cs.some(c => c.v === 'rest'));
});

test('tracks: Rhubarb JSON and a plain list; word timings', () => {
  const rh = { mouthCues: [{ start: 0, end: 0.1, value: 'X' }, { start: 0.1, end: 0.2, value: 'A' }, { start: 0.2, end: 0.4, value: 'D' }, { start: 0.4, end: 0.5, value: 'F' }, { start: 0.5, end: 0.7, value: 'X' }] };
  assert.deepStrictEqual(S.fromTrack(rh, 0.7).map(c => c.v), ['rest', 'mbp', 'ah', 'oo', 'rest']);
  assert.deepStrictEqual(S.fromTrack([{ t: 0, v: 'EE' }, { t: 0.2, v: 'wq' }], 0.5).map(c => c.v), ['ee', 'wq', 'rest']);
  const w = S.fromWords('0:Good 0.5:morning', 'Good morning', 1.4);
  assert.ok(w.some(c => c.v === 'mbp' && c.t >= 0.5), 'morning starts with m at its word time');
  assert.ok(w.every((c, i) => i === 0 || c.t >= w[i - 1].t));
});

test('a skin with only an open and a closed mouth still talks; the mannequin draws all nine shapes', () => {
  const two = Object.assign({}, mannequin, { name: 'two', swaps: { mouth: { closed: { d: 'M0.3 0.24L0.45 0.24', stroke: 'mouth', w: 0.02 }, open: { d: 'M0.3 0.26L0.45 0.26L0.42 0.18L0.32 0.19Z', fill: 'mouth' } } } });
  const pf = CharPerform.compile(two, [{ t: 0, action: 'say', args: { visemes: 'rest mbp ah ee oh oo fv l wq', for: 3.6 } }], { ground: 500, x: 300, scale: 60 });
  const seen = new Set();
  for (let i = 0; i < 9; i++) {
    const s = pf.sample((i + 0.5) * 0.4), svg = CharPerform.draw(two, s);
    assert.ok(!/NaN|#ff00ff/.test(svg), 'no missing shape');
    const op = svg.match(/<path d="M0.3 0.26[^>]*>/g) || [];
    seen.add(svg.includes('d="M0.3 0.24') ? 'closed' : op.some(p => /scale\(/.test(p)) ? 'open-scaled' : op.length ? 'open' : 'none');
  }
  assert.ok(seen.size >= 3, 'open, closed and scaled-open shapes all appear');
  const gen = CharPerform.compile(mannequin, [{ t: 0, action: 'say', args: { visemes: 'rest mbp ah ee oh oo fv l wq', for: 3.6 } }], { ground: 500, x: 300, scale: 60 });
  const mouths = new Set();
  for (let i = 0; i < 9; i++) { const s = gen.sample((i + 0.6) * 0.4); mouths.add(JSON.stringify([s.pose.face.open, s.pose.face.wide, s.pose.face.round].map(v => +(+v).toFixed(2)))); }
  assert.ok(mouths.size >= 8, 'nine distinct mouth shapes from numbers');
});

test('speech: deterministic, nods on stress, rests after the line', () => {
  const evs = [{ t: 0.3, action: 'face', args: { mood: 'happy' } }, { t: 0.4, action: 'say', args: { text: 'Good morning, little one!', for: 1.8 } }];
  const A = CharPerform.compile(mannequin, evs, { ground: 500, x: 300, scale: 60 }), B = CharPerform.compile(mannequin, evs, { ground: 500, x: 300, scale: 60 });
  const times = [1.1, 0.5, 2.0, 0.9, 1.6];
  const first = times.map(t => JSON.stringify(A.sample(t)));
  for (let i = 0; i < 30; i++) A.sample((i * 0.37) % 2.5);
  assert.deepStrictEqual(times.map(t => JSON.stringify(A.sample(t))), first);
  assert.deepStrictEqual(times.map(t => JSON.stringify(B.sample(t))), first);
  assert.ok(!A.sample(2.6).pose.face.speaking, 'quiet after the line');
  let hMin = Infinity, hMax = -Infinity;
  for (let t = 0.4; t < 2.2; t += 0.02) { const h = A.sample(t).pose.headTilt; hMin = Math.min(hMin, h); hMax = Math.max(hMax, h); }
  assert.ok(hMax - hMin > 0.03, 'the head bobs while speaking');
  assert.ok(A.sample(1.0).pose.face.smile > 0.5, 'a happy face smiles');
});
