// node --test tests/skincheck.test.cjs : tools/skincheck.cjs on one good skin and three broken ones.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { spawnSync } = require('node:child_process');
const TOOL = path.join(__dirname, '..', 'tools', 'skincheck.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skincheck-'));
const wrap = (name, body) => `(function (g) { (g.CharSkins = g.CharSkins || {}).${name} = ${body}; })(typeof self !== 'undefined' ? self : this);`;
const run = (name, src) => {
  const f = path.join(dir, name + '.js'); fs.writeFileSync(f, src);
  const r = spawnSync(process.execPath, [TOOL, f], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout };
};
const mq = path.join(__dirname, '..', 'skins');   // extends 'mannequin' resolves from skins/

test('a correct dressed skin passes', () => {
  const r = run('good', wrap('good', `{ name: 'good', extends: 'mannequin', build: { heads: 6 }, motion: { age: 'elder', weight: 0.6 },
    palette: { coat: '#445566', hair: '#999999' },
    parts: { torso: { cover: true, fill: 'coat' }, skirt: { skirt: true, length: 0.8, flare: 0.25, fill: 'coat' },
      hair: { d: 'M-0.5 0.6C-0.55 1.0 0.1 1.15 0.42 0.82Z', fill: 'hair' } },
    chains: { tail: { bone: 'head', at: [-0.45, 0.85], rest: 200, seg: [0.25, 0.22], width: [0.16, 0.14, 0.04], fill: 'hair' } } }`));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /OK: 0 errors, \d+ warnings/);
});

test('misspelled fields, wrong types, ranges and name are reported with the fix', () => {
  const r = run('bad1', wrap('bad1', `{ name: 'other', extends: 'mannequin', bulid: { heads: 9 }, build: { heads: 12, musle: 1, belly: 'big' },
    motion: { age: 'old', energy: 3 }, palete: {} }`));
  assert.equal(r.code, 1);
  assert.match(r.out, /name: .*bad1/);
  assert.match(r.out, /Did you mean 'build'/);
  assert.match(r.out, /Did you mean 'muscle'/);
  assert.match(r.out, /build\.heads: .*2\.2\.\.8/);
  assert.match(r.out, /build\.belly: must be a number/);
  assert.match(r.out, /motion\.age: .*'elder'/);
  assert.match(r.out, /motion\.energy: .*0\.\.1/);
  assert.match(r.out, /FAIL: /);
});

test('undefined palette keys and paths drawn in pixels or unparsable are reported', () => {
  const r = run('bad2', wrap('bad2', `{ name: 'bad2', extends: 'mannequin', palette: { hair: '#112233', coat: 'red' },
    parts: { hair: { d: 'M0 0L1 0L1 1Z', fill: 'hiar' }, head: [{ d: 'M200 300L260 300L260 380Z', fill: 'hair' }, { d: 'M0 0L1 Q', fill: 'hair' }],
      torso: { cover: [0, 1], fill: 'jumper' } } }`));
  assert.equal(r.code, 1);
  assert.match(r.out, /parts\.hair\.fill: colour 'hiar' is not in the palette\. Did you mean 'hair'/);
  assert.match(r.out, /palette\.coat: .*hex colour/);
  assert.match(r.out, /parts\.head\[0\]\.d: .*not pixels/);
  assert.match(r.out, /parts\.head\[1\]\.d: .*needs/);
  assert.match(r.out, /parts\.torso\.fill: colour 'jumper'/);
});

test('chains need an anchor bone and the right width count; garments need a build', () => {
  const r = run('bad3', wrap('bad3', `{ name: 'bad3', palette: { hair: '#112233' },
    proportions: { head: 1, neck: 0.07, torso: 0.6, shoulderDrop: 0.12, upperArm: 0.33, foreArm: 0.31, thigh: 0.5, shin: 0.46, ankleHeight: 0.1,
      heel: [-0.1, -0.1], toe: [0.3, -0.1], footGround: [[0, -0.1]], farShoulder: [0, 0] },
    parts: { leg: { cover: [0, 1], fill: 'hair' } },
    chains: { a: { at: [0, 1], rest: 180, seg: [0.2, 0.2], width: [0.2, 0.1], fill: 'hair' },
      b: { bone: 'hed', at: [0, 1], rest: 180, seg: [0.2], width: [0.2, 0.1], fill: 'hair', layr: 'back' } } }`));
  assert.equal(r.code, 1);
  assert.match(r.out, /chains\.a\.bone: is required/);
  assert.match(r.out, /chains\.a\.width: has 2 numbers but seg has 2; width needs exactly 3/);
  assert.match(r.out, /chains\.b\.bone: 'hed' is not an anchor bone\. Did you mean 'head'/);
  assert.match(r.out, /Did you mean 'layer'/);
  assert.match(r.out, /parts\.leg: a cover needs a generated body/);
});

test('every worked example skin passes', () => {
  const root = path.join(__dirname, '..');
  const files = [];
  for (const d of ['skins', 'films/lineup/skins', 'films/rig-example/skins', 'films/recipes/skins', 'films/cast/skins', 'films/retest/skins']) for (const f of fs.readdirSync(path.join(root, d))) if (f.endsWith('.js')) files.push(path.join(root, d, f));
  for (const f of files) { const r = spawnSync(process.execPath, [TOOL, f], { encoding: 'utf8' }); assert.equal(r.status, 0, f + '\n' + r.stdout); }
});

test('hold parts, upright, hide hair, shade colours, ignored fields and syntax errors', () => {
  const ok = run('good2', wrap('good2', `{ name: 'good2', extends: 'mannequin', build: { heads: 6, hide: ['hair'] }, palette: { wood: '#553311', dress: '#334455' },
    parts: { holdNear: { upright: true, d: 'M-0.025 0.05L0.025 0.05L0.025 -2.6L-0.025 -2.6Z', fill: 'wood' }, skirt: { skirt: true, length: 1, fill: 'dress', shade: 'dressShade' }, arm: { cover: true, fill: 'dress' } } }`));
  assert.equal(ok.code, 0, ok.out);
  const bad = run('bad4', wrap('bad4', `{ name: 'bad4', extends: 'mannequin', palette: { hair: '#112233' },
    parts: { torso: [{ cover: true, fill: 'hoodieShade' }, { d: 'M0 0L1 0L1 1Z', fill: 'hair', opacity: 0 }], neck: { d: 'M0 0L1 0L1 1Z', fill: 'hair', upright: true } } }`));
  assert.equal(bad.code, 1);
  assert.match(bad.out, /hoodieShade' is not in the palette/);
  assert.match(bad.out, /opacity: 0 is ignored/);
  assert.match(bad.out, /upright: only works in parts\.holdNear/);
  const syn = run('syn', "(function (g) {\n  (g.CharSkins = g.CharSkins || {}).syn = { name: 'syn',\n    build: { heads: 5 }\n    motion: {} };\n})(this);");
  assert.equal(syn.code, 1);
  assert.match(syn.out, /syn\.js line 4: [^\n]*\n\s+the line reads: motion: \{\}/);
});
