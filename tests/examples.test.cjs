// node --test tests/examples.test.cjs : single .char files work like film folders; every example checks clean.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path');
const { check, build, ROOT } = require('../tools/check.cjs');

const EX = path.join(ROOT, 'examples');
const files = fs.readdirSync(EX).filter(f => f.endsWith('.char')).sort();

test('examples/ holds six to eight .char files', () => assert.ok(files.length >= 6 && files.length <= 8, files.join()));

for (const f of files) test(`example ${f} checks without errors`, () => {
  const r = check(path.join(EX, f));
  assert.ok(r.ok, r.text);
  assert.ok(fs.existsSync(path.join(EX, f.replace(/\.char$/, '.html'))));
});

test('a .char path and a film folder both build', () => {
  const b = build(path.join(EX, 'hello.char'));
  assert.strictEqual(path.basename(b.out), 'hello.html');
  const d = build(path.join(ROOT, 'films', 'demo'));
  assert.strictEqual(path.basename(d.out), 'index.html');
});

test('a file-local action next to the .char wins (local-action.char needs examples/actions/jig.js)', () => {
  const r = check(path.join(EX, 'local-action.char'));
  assert.ok(r.ok && !/unknown/i.test(r.text), r.text);
});
