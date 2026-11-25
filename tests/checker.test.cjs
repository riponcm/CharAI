// node --test tests/checker.test.cjs : four mistakes the film checker must catch as errors, each with the
// line, what is wrong and what to write, and the valid form of each that must still pass.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { check } = require('../tools/check.cjs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'charcheck-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
let n = 0;
// run the checker on a script made of these lines; the header and two actors come first (the first body line is line 5)
function run(...body) {
  const f = path.join(dir, `t${n++}.char`);
  fs.writeFileSync(f, ['film "t" 20s', 'stage width=1400 ground=600 scale=60', 'actor Kai = skin kai at 200', 'actor Tess = skin tess at 600', ...body, ''].join('\n'));
  return check(f);
}
const errorsOf = r => r.out.filter(o => o.sev === 'error');

// 1. a body move beyond the stage
test('walk(to=5000) on a stage 1400 wide is an error naming the line, the width and what to write', () => {
  const r = run('1 Kai: walk(to=5000)');
  assert.strictEqual(r.ok, false);
  const e = errorsOf(r)[0];
  assert.strictEqual(e.line, 5);
  assert.match(e.msg, /walk\(to=5000\) is off the stage; the stage is 1400 wide\. Write a place from 0 to 1400, for example walk\(to=1400\)\./);
});
test('a move below 0, and a move to a named place beyond the stage, are errors too', () => {
  assert.match(errorsOf(run('1 Kai: run(to=-20)'))[0].msg, /run\(to=-20\) is off the stage.*for example run\(to=0\)/);
  const r = run('prop loaf at 5000', '1 Kai: walk(to=loaf)');
  assert.match(errorsOf(r)[0].msg, /walk\(to=loaf\) is off the stage \('loaf' is at x=5000\); the stage is 1400 wide/);
});
test('the set width counts when a set is used', () => {
  const f = path.join(dir, 'set.char');
  fs.writeFileSync(f, 'film "t" 8s\nset hillside\nactor Kai = skin kai at 200\n1 Kai: walk(to=99999)\n');
  const r = check(f), e = errorsOf(r)[0];
  assert.ok(e && /is off the stage; the stage is \d+ wide/.test(e.msg), r.text);
});
test('moves inside the stage, up to its edges, pass', () => {
  const r = run('1 Kai: walk(to=1400)', '+0.2 Kai: walk(to=0)', '8 Tess: run(to=900)');
  assert.strictEqual(errorsOf(r).length, 0, r.text);
});

// 2. a pair action without its partner
test('every pair action without with= is an error listing the actors it could be', () => {
  for (const [line, name] of [['1 Kai: hug()', 'hug'], ['1 Kai: handshake()', 'handshake'], ['1 Kai: give(prop=loaf)', 'give']]) {
    const r = run('prop loaf', line);
    const e = errorsOf(r)[0];
    assert.ok(e, r.text);
    assert.strictEqual(e.msg, `Kai: ${name} needs a partner. Write ${name}(with=Tess). Actors it could be: Tess.`);
  }
});
test('with= naming nobody, or the actor itself, is an error with the nearest name', () => {
  assert.match(errorsOf(run('1 Kai: hug(with=Tes)'))[0].msg, /hug\(with=Tes\) names no actor\. Did you mean 'Tess'\? Write hug\(with=Tess\)\. Actors it could be: Tess\./);
  assert.match(errorsOf(run('1 Kai: hug(with=Kai)'))[0].msg, /hug\(with=Kai\) names itself\./);
});
test('a pair action with a real partner passes', () => {
  const r = run('prop loaf', '0.2 Kai: hold(loaf)', '1 Kai: give(with=Tess, prop=loaf)', '+0.5 Tess: handshake(with=Kai)');
  assert.strictEqual(errorsOf(r).length, 0, r.text);
});

// 3. text without quotation marks
test('say(hello) without quotes is an error showing the line with quotes', () => {
  const r = run('1 Kai: say(hello)');
  assert.strictEqual(r.ok, false);
  const e = errorsOf(r)[0];
  assert.strictEqual(e.line, 5);
  assert.match(e.msg, /say: the text must be in quotes, got hello\. Write: 1 Kai: say\("hello"\)/);
  assert.match(errorsOf(run('2.5 Kai: say(text=hi, for=2)'))[0].msg, /Write: 2\.5 Kai: say\(text="hi", for=2\)/);
});
test('caption and card text without quotes are errors the same way', () => {
  assert.match(errorsOf(run('1 caption: show(hello), for=2'))[0].msg, /show: the text must be in quotes, got hello\. Write: 1 caption: show\("hello", for=2\)/);
  assert.match(errorsOf(run('1 card: show(text=The, for=2)'))[0].msg, /Write: 1 card: show\(text="The", for=2\)/);
  assert.match(errorsOf(run('1 card: show("The End", sub=soon)'))[0].msg, /the sub must be in quotes, got soon\. Write: 1 card: show\("The End", sub="soon"\)/);
});
test('quoted say, caption and card text pass', () => {
  const r = run('1 Kai: say("Hello there", for=2)', '4 caption: "Hi!", by=Tess, for=2', '8 card: "The End", sub="thanks"');
  assert.strictEqual(errorsOf(r).length, 0, r.text);
});

// 4. a misspelt mood or face name
test('mood(grumpy) and face(happyy) are errors with the nearest name and the valid ones', () => {
  const m = errorsOf(run('1 Kai: mood(grumpy)'))[0];
  assert.strictEqual(m.line, 5);
  assert.match(m.msg, /Kai: mood: 'grumpy' is not a mood name\. Nearest valid name is '\w+', so write mood\(\w+\)\. Valid: neutral, happy, sad, angry, scared, tired, proud, shy\./);
  const f = errorsOf(run('1 Kai: face(happyy)'))[0];
  assert.match(f.msg, /Kai: face: 'happyy' is not a face name\. Nearest valid name is 'happy', so write face\(happy\)\. Valid: neutral, happy, excited,/);
  assert.match(errorsOf(run('1 Kai: face(mood=sadd)'))[0].msg, /Nearest valid name is 'sad'/);
});
test('valid moods and faces pass', () => {
  const r = run('1 Kai: mood(happy), face(excited)', '3 Tess: mood(angry)', '+0 Tess: face(mood=determined)');
  assert.strictEqual(errorsOf(r).length, 0, r.text);
});
