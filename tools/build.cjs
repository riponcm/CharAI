// Build the single-file bundle from src/ (read at build time) plus src-extra/.
// Usage: node tools/build.cjs   -> dist/char.js (classic script, global Char) and dist/char.esm.js
// Each source file is a UMD file; it is wrapped so it takes its browser branch and registers its global.
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const FIRST = ['rig.js', 'gait.js', 'poses.js', 'clips.js', 'speech.js', 'perform.js'];   // same order as tools/check.cjs
const LAST = ['script.js', 'stage.js'];

function sources() {
  const all = fs.readdirSync(path.join(ROOT, 'src')).filter(f => f.endsWith('.js'));
  const middle = all.filter(f => !FIRST.includes(f) && !LAST.includes(f)).sort();   // files added later load before the script/stage pair
  const list = FIRST.concat(middle, LAST).filter(f => all.includes(f)).map(f => path.join(ROOT, 'src', f));
  const extra = path.join(ROOT, 'src-extra');
  if (fs.existsSync(extra)) for (const f of fs.readdirSync(extra).filter(f => f.endsWith('.js')).sort()) list.push(path.join(extra, f));
  return list;
}

function bundle() {
  const files = sources();
  let body = '';
  for (const f of files) {
    const name = path.relative(ROOT, f).split(path.sep).join('/');
    body += `\n// ---- ${name} ----\n(function (module, exports, require) {\n${fs.readFileSync(f, 'utf8')}\n}).call(G);\n`;
  }
  const head = '/* char.js: 2D character animation engine, one file, no dependencies. Built by tools/build.cjs from src/. */\n' +
    '(function () {\n"use strict";\nvar G = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : this;\n';
  const cjs = head + body.replace(/^/gm, '') + '\n})();\n';
  // the sources use sloppy-mode idioms in places: keep the file non-strict by dropping the directive
  const classic = cjs.replace('"use strict";\n', '');
  const esm = head.replace('"use strict";\n', '') + body + '\n})();\n' +
    'const G = globalThis;\nexport const Char = G.Char;\nexport default G.Char;\n' +
    'export const CharRig = G.CharRig, CharScript = G.CharScript, CharStage = G.CharStage;\n';
  return { classic, esm, files };
}

function build() {
  const b = bundle();
  fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'dist', 'char.js'), b.classic);
  fs.writeFileSync(path.join(ROOT, 'dist', 'char.esm.js'), b.esm);
  return { files: b.files.map(f => path.relative(ROOT, f)), classic: b.classic.length, esm: b.esm.length };
}
module.exports = { build, sources };
if (require.main === module) {
  const r = build();
  console.log('bundled ' + r.files.join(' '));
  console.log('wrote dist/char.js (' + r.classic + ' bytes), dist/char.esm.js (' + r.esm + ' bytes)');
}
