// Finding a skin file for the preview tools (action.cjs, say.cjs).
// A spec is either a path (anything with a slash or ending in .js: films/talk/skins/baker.js) or a name.
// A name is looked up in this order: the --film's own skins/, then skins/, then every films/*/skins/.
// When the name exists in more than one film and no --film is given, the first is used and the others are
// named in a warning, so the choice is never silent.
const fs = require('node:fs'), path = require('node:path');

function finder(ROOT, film) {
  const filmsDir = path.join(ROOT, 'films');
  const filmDirs = fs.readdirSync(filmsDir).filter(f => !f.startsWith('.')).map(f => path.join(filmsDir, f));
  const own = film ? path.join(filmsDir, String(film), 'skins') : null;
  const dirs = (own ? [own] : []).concat([path.join(ROOT, 'skins')],
    filmDirs.map(d => path.join(d, 'skins')).filter(d => fs.existsSync(d) && d !== own));
  const byName = name => dirs.map(d => path.join(d, name + '.js')).filter(f => fs.existsSync(f));
  return {
    // -> { name, file, warn } or null
    find(spec) {
      spec = String(spec).trim();
      if (/[\\/]/.test(spec) || spec.endsWith('.js')) {
        const f = [path.resolve(spec), path.resolve(ROOT, spec)].find(p => fs.existsSync(p));
        return f ? { name: path.basename(f, '.js'), file: f } : null;
      }
      const all = byName(spec);
      if (!all.length) return null;
      const warn = !own && all.length > 1 && path.dirname(all[0]) !== path.join(ROOT, 'skins')
        ? `'${spec}' exists in ${all.map(f => path.relative(ROOT, f)).join(', ')}; using the first (pass a path or --film= to choose)` : '';
      return { name: spec, file: all[0], warn };
    },
    // a name another skin extends: the same film first, then the usual order
    parent(name, nearFile) {
      const near = path.join(path.dirname(nearFile), name + '.js');
      return fs.existsSync(near) ? near : (byName(name)[0] || null);
    },
    isRoot: f => path.dirname(f) === path.join(ROOT, 'skins'),
  };
}
module.exports = { finder };
