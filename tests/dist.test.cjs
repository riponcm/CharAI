// The bundle builds, loads in Node without a DOM, and exposes Char.mount.
const test = require('node:test'), assert = require('node:assert'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const { build } = require('../tools/build.cjs');

test('bundle builds and loads without a DOM', () => {
  const r = build();
  assert.ok(r.classic > 10000);
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'dist', 'char.js'), 'utf8'), sandbox, { filename: 'dist/char.js' });
  assert.strictEqual(typeof sandbox.Char, 'object');
  assert.strictEqual(typeof sandbox.Char.mount, 'function');
  assert.strictEqual(typeof sandbox.CharScript.parse, 'function');
  assert.strictEqual(sandbox.document, undefined);
});

test('the ESM file exports Char', () => {
  const t = fs.readFileSync(path.join(ROOT, 'dist', 'char.esm.js'), 'utf8');
  assert.match(t, /export default G\.Char/);
});

test('a bare-stage film mounts into a fake element and seeks', () => {
  const sandbox = {}; sandbox.globalThis = sandbox; vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'dist', 'char.js'), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'skins', 'kai.js'), 'utf8'), sandbox);
  const el = { style: {}, innerHTML: '' };
  const m = sandbox.Char.mount(el, { script: 'film "t" 3s\nactor Kai = skin kai at 120\n0.0 Kai: walk(to=600)', skins: sandbox.CharSkins, width: 800, height: 450 });
  assert.ok(m.duration > 0);
  m.seek(1);
  assert.match(el.innerHTML, /<svg/);
});
