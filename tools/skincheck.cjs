// Check a skin file against docs/RIG.md.
// Usage: node tools/skincheck.cjs skins/<name>.js        (or films/<film>/skins/<name>.js)
//   Loads the skin, resolves `extends`, and reports every problem with the field name and what to write.
//   Prints ERROR / WARN lines, then `OK: 0 errors, N warnings` (exit 0) or `FAIL: ...` (exit 1).
// Also exports { checkSkinFile, loadSkinFile, parsePath } for tools/cast.cjs and the tests.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');

// ---------- loading ----------
function loadSkinFile(file) {
  const sb = {}; sb.self = sb; sb.CharSkins = {};
  // skins written as add-ons to another skin (CharSkins.kai.something) need the shared skins loaded first
  const pre = path.join(ROOT, 'skins');
  if (path.dirname(path.resolve(file)) !== pre && fs.existsSync(pre)) for (const f of fs.readdirSync(pre).filter(f => f.endsWith('.js'))) {
    try { vm.runInNewContext('(function (module, exports, require) {' + fs.readFileSync(path.join(pre, f), 'utf8') + '\n}).call(this)', sb); } catch (e) { /* ignore */ }
  }
  const before = new Set(Object.keys(sb.CharSkins));   // hide module/exports so the UMD wrapper registers in sb.CharSkins
  vm.runInNewContext('(function (module, exports, require) {' + fs.readFileSync(file, 'utf8') + '\n}).call(this)', sb, { filename: file });
  const keys = Object.keys(sb.CharSkins || {}).filter(k => !before.has(k) || k === path.basename(file, '.js'));
  return { skins: sb.CharSkins || {}, keys };
}
// the same merge as src/stage.js skinOf
function resolveSkin(skin, dirs, errs, seen) {
  seen = seen || [];
  if (!skin.extends) return skin;
  if (seen.includes(skin.extends)) { errs.push(['extends', `'${skin.extends}' extends itself in a loop. Remove one \`extends\`.`]); return skin; }
  let base = null;
  for (const d of dirs) {
    const f = path.join(d, skin.extends + '.js');
    if (fs.existsSync(f)) { try { const L = loadSkinFile(f); base = L.skins[skin.extends] || L.skins[L.keys[0]]; } catch (e) { errs.push(['extends', `cannot load '${skin.extends}' (${f}): ${e.message}`]); } break; }
  }
  if (!base) { errs.push(['extends', `no skin file '${skin.extends}.js' found in ${dirs.map(d => path.relative(process.cwd(), d) || '.').join(' or ')}. Write extends: 'mannequin'.`]); return skin; }
  base = resolveSkin(base, dirs, errs, seen.concat(skin.extends));
  const m = Object.assign({}, base, skin);
  for (const k of ['palette', 'proportions', 'swaps', 'parts', 'chains', 'build', 'motion', 'springs']) if (base[k] && skin[k]) m[k] = Object.assign({}, base[k], skin[k]);
  for (const k of ['parts', 'swaps', 'chains']) if (m[k]) { m[k] = Object.assign({}, m[k]); for (const q of Object.keys(m[k])) if (m[k][q] === null) delete m[k][q]; }
  delete m.extends;
  return m;
}

// ---------- helpers ----------
const isNum = v => typeof v === 'number' && isFinite(v);
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const HEX = /^#[0-9a-fA-F]{6}$/;
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function nearest(name, list) {
  let best = null, bd = 1e9;
  for (const c of list) { const dd = lev(String(name).toLowerCase(), c.toLowerCase()); if (dd < bd) { bd = dd; best = c; } }
  return best !== null && bd <= Math.max(2, Math.floor(String(name).length / 3)) ? best : null;
}
const q = v => JSON.stringify(v);

// ---------- path parsing ----------
const ARGN = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
// returns { error } or { pts: [[x,y]...] } (endpoints and control points, in the path's own units)
function parsePath(d) {
  if (typeof d !== 'string' || !d.trim()) return { error: 'is empty' };
  const toks = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
  const rest = d.replace(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?|[\s,]/g, '');
  if (rest) return { error: `contains the unexpected character '${rest[0]}'` };
  let i = 0, cmd = null, cx = 0, cy = 0, sx = 0, sy = 0, first = true; const pts = [];
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) {
      cmd = toks[i++];
      if (!(cmd.toUpperCase() in ARGN)) return { error: `uses the unknown command '${cmd}' (allowed: M L H V C S Q T A Z)` };
      if (first && cmd.toUpperCase() !== 'M') return { error: `must start with M (moveto), it starts with '${cmd}'` };
      first = false;
      if (cmd.toUpperCase() === 'Z') { cx = sx; cy = sy; continue; }
    } else if (!cmd) return { error: 'must start with M' };
    else if (cmd.toUpperCase() === 'Z') return { error: 'has numbers after Z; start a new subpath with M' };
    const U = cmd.toUpperCase(), rel = cmd !== U, n = ARGN[U], a = [];
    for (let k = 0; k < n; k++) {
      if (i >= toks.length || /[a-zA-Z]/.test(toks[i])) return { error: `command '${cmd}' needs ${n} numbers but got ${k}` };
      a.push(+toks[i++]);
    }
    const ox = rel ? cx : 0, oy = rel ? cy : 0;
    if (U === 'M' || U === 'L' || U === 'T') { cx = ox + a[0]; cy = oy + a[1]; pts.push([cx, cy]); if (U === 'M') { sx = cx; sy = cy; cmd = rel ? 'l' : 'L'; } }
    else if (U === 'H') { cx = ox + a[0]; pts.push([cx, cy]); }
    else if (U === 'V') { cy = oy + a[0]; pts.push([cx, cy]); }
    else if (U === 'C') { pts.push([ox + a[0], oy + a[1]], [ox + a[2], oy + a[3]], [ox + a[4], oy + a[5]]); cx = ox + a[4]; cy = oy + a[5]; }
    else if (U === 'S' || U === 'Q') { pts.push([ox + a[0], oy + a[1]], [ox + a[2], oy + a[3]]); cx = ox + a[2]; cy = oy + a[3]; }
    else if (U === 'A') { cx = ox + a[5]; cy = oy + a[6]; pts.push([cx, cy]); }
  }
  if (!pts.length) return { error: 'has no drawing commands' };
  return { pts };
}

// ---------- vocabulary (docs/RIG.md) ----------
const TOP = ['name', 'extends', 'build', 'motion', 'proportions', 'headTop', 'outline', 'farShade', 'palette', 'parts', 'swaps', 'chains', 'springs', 'grip', 'handZ'];
const PART_KEYS = ['head', 'hair', 'hairBack', 'neck', 'torso', 'pelvis', 'arm', 'leg', 'upperArm', 'foreArm', 'thigh', 'shin', 'foot', 'hand', 'holdNear', 'holdFar', 'skirt'];
const BUILD = { // key: [min, max] = the "Sensible range" column of RIG.md section 4; outside it the body is drawn but looks wrong
  heads: [2.2, 8], legs: [0.28, 0.52], arms: [0.25, 0.45], neck: [0.05, 0.2], neckLength: [0, 1.2],
  shoulders: [0.4, 1.3], chest: [0.4, 1.3], waist: [0.35, 1.3], hips: [0.4, 1.3],
  belly: [0, 0.7], seat: [0, 0.2], bust: [0, 0.15], arm: [0.05, 0.3], leg: [0.1, 0.45],
  muscle: [0, 1], hand: [0.6, 1.5], foot: [0.6, 1.5], headWidth: [0.7, 1.1],
};
const HOLD = ['holdNear', 'holdFar'];
const HIDE = ['head', 'hair', 'neck', 'torso', 'pelvis', 'arm', 'leg', 'foot'];
const MOTION = { weight: [0, 1], energy: [0, 1], posture: [-1, 1] };
const AGES = ['baby', 'child', 'adult', 'elder'];
const PROP_NUM = ['head', 'neck', 'torso', 'shoulderDrop', 'upperArm', 'foreArm', 'thigh', 'shin', 'ankleHeight'];
const PROP_PAIR = ['heel', 'toe', 'farShoulder'];
const PROP_ALL = PROP_NUM.concat(PROP_PAIR, ['footGround', 'radius']);
const RADIUS = ['hip', 'knee', 'shoulder', 'elbow', 'wrist', 'neck', 'hem'];
const LAYERS = ['back', 'arm.far', 'leg.far', 'pelvis', 'leg.near', 'neck', 'torso', 'head', 'arm.near', 'front'];
const SWAPS = { hand: ['relaxed', 'fist', 'open', 'point', 'grip', 'thumb'], eye: ['open', 'wide', 'narrow', 'closed', 'happy', 'sad'], brow: ['neutral', 'up', 'down', 'worried'], mouth: ['neutral', 'smile', 'open', 'o', 'worried', 'grit', 'sad', 'closed', 'rest', 'mbp', 'ah', 'ee', 'oh', 'oo', 'fv', 'l', 'wq'] };
const ENTRY_KEYS = {
  path: ['d', 'fill', 'stroke', 'w', 'opacity', 'look', 'upright'], swap: ['swap'],
  tube: ['tube', 'from', 'to', 'flat', 'inset', 'fill'], cap: ['cap', 'from', 'to', 'inset', 'fill', 'mid'],
  cover: ['cover', 'loose', 'fill', 'flat', 'inset'], skirt: ['skirt', 'length', 'top', 'flare', 'loose', 'fill', 'shade', 'hem'],
};
const CHAIN_KEYS = ['bone', 'at', 'rest', 'curl', 'seg', 'width', 'fill', 'shade', 'shadeSide', 'layer', 'tip', 'stiff', 'limit', 'gravity', 'drag', 'wind', 'inertia', 'freq', 'end', 'endUpright'];
const CHAIN_BONES = ['head', 'neck', 'torso', 'pelvis'];
// soft frame bounds per part key (head units): [xmin, xmax, ymin, ymax]. A hard error is any coordinate beyond +-8.
const FRAME = {
  head: [-2.5, 2.5, -1.5, 3], hair: [-2.5, 2.5, -1.5, 3], hairBack: [-2.5, 2.5, -1.5, 3], neck: [-1.5, 1.5, -1.5, 1.5],
  torso: [-3, 3, -2.5, 4], pelvis: [-3, 3, -2.5, 2.5], foot: [-2, 3, -1.5, 2], hand: [-1.5, 2, -1.5, 1.5], holdNear: [-3, 3, -6, 3], holdFar: [-3, 3, -6, 3],
  arm: [-2, 3, -3, 3], leg: [-2, 3, -3, 3], upperArm: [-1.5, 2.5, -3, 3], foreArm: [-1.5, 2.5, -3, 3], thigh: [-1.5, 2.5, -3, 3], shin: [-1.5, 2.5, -3, 3],
};

// ---------- the checker ----------
function checkSkin(raw, o) {
  // raw: the skin object as written; o: { fileBase, registeredKeys, dirs }
  const E = [], W = [];
  const err = (field, msg) => E.push({ field, msg }), warn = (field, msg) => W.push({ field, msg });
  const pre = [];
  const skin = resolveSkin(raw, o.dirs || [path.join(ROOT, 'skins')], pre);
  for (const [f, m] of pre) err(f, m);
  const hasBuild = isObj(skin.build);

  const num = (field, v, lo, hi, what) => {   // hard-range number
    if (!isNum(v)) { err(field, `must be a number, got ${q(v)}. ${what || ''}`.trim()); return false; }
    if (v < lo || v > hi) { err(field, `is ${v}, outside ${lo}..${hi}. Write a number from ${lo} to ${hi}.`); return false; }
    return true;
  };
  const unknownKeys = (field, obj, valid, extra) => {
    for (const k of Object.keys(obj)) if (!valid.includes(k)) {
      const n = nearest(k, valid);
      err(field ? field + '.' + k : k, `unknown field '${k}'.` + (n ? ` Did you mean '${n}'?` : ` Valid fields: ${valid.join(', ')}.`) + (extra || ''));
    }
  };
  const pair = (field, v, what) => {
    if (!Array.isArray(v) || v.length !== 2 || !v.every(isNum)) { err(field, `must be two numbers [x, y]${what ? ' (' + what + ')' : ''}, got ${q(v)}.`); return false; }
    return true;
  };

  // name
  if (typeof raw.name !== 'string' || !raw.name) err('name', `is required. Write name: '${o.fileBase}'.`);
  else if (raw.name !== o.fileBase) err('name', `is '${raw.name}' but the file is ${o.fileBase}.js. Write name: '${o.fileBase}' (or rename the file).`);
  if (o.registeredKeys && o.registeredKeys.length && !o.registeredKeys.includes(o.fileBase))
    err('CharSkins', `the skin is registered as '${o.registeredKeys.join("', '")}' but the file is ${o.fileBase}.js. Register it as (g.CharSkins = g.CharSkins || {}).${o.fileBase} = { name: '${o.fileBase}', ... }.`);
  if (raw.extends !== undefined && typeof raw.extends !== 'string') err('extends', `must be a skin name string, e.g. extends: 'mannequin'.`);
  unknownKeys('', raw, TOP);

  // build
  if (raw.build !== undefined && !isObj(raw.build)) err('build', `must be an object like { heads: 5 }.`);
  if (hasBuild) {
    unknownKeys('build', skin.build, Object.keys(BUILD).concat('hide'));
    for (const [k, v] of Object.entries(skin.build)) {
      if (k === 'hide') {
        if (!Array.isArray(v) || v.some(x => !HIDE.includes(x))) err('build.hide', `must be a list of ${HIDE.join(', ')}. Write for example hide: ['head'].`);
        continue;
      }
      const r = BUILD[k]; if (!r) continue;
      num('build.' + k, v, r[0], r[1], 'RIG.md gives this range; outside it the body looks wrong.');
    }
  }
  // motion
  if (raw.motion !== undefined && !isObj(raw.motion)) err('motion', `must be an object like { weight: 0.3, energy: 0.5, age: 'adult', posture: 0 }.`);
  else if (isObj(skin.motion)) {
    unknownKeys('motion', skin.motion, ['weight', 'energy', 'age', 'posture']);
    for (const [k, r] of Object.entries(MOTION)) if (skin.motion[k] !== undefined) num('motion.' + k, skin.motion[k], r[0], r[1]);
    if (skin.motion.age !== undefined && !AGES.includes(skin.motion.age)) err('motion.age', `is ${q(skin.motion.age)}. Write one of 'baby', 'child', 'adult', 'elder'.`);
  }
  // proportions
  if (raw.proportions !== undefined && !isObj(raw.proportions)) err('proportions', `must be an object of bone lengths.`);
  else if (isObj(skin.proportions)) {
    const P = skin.proportions;
    unknownKeys('proportions', P, PROP_ALL);
    for (const k of PROP_NUM) if (P[k] !== undefined) num('proportions.' + k, P[k], 0, 3, 'In head heights.');
    if (isNum(P.head) && P.head !== 1) warn('proportions.head', `is ${P.head}; the unit is the head, so write head: 1.`);
    for (const k of PROP_PAIR) if (P[k] !== undefined) pair('proportions.' + k, P[k], k === 'farShoulder' ? 'offset of the far shoulder' : 'pivot in the foot frame');
    if (P.footGround !== undefined && (!Array.isArray(P.footGround) || P.footGround.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(isNum))))
      err('proportions.footGround', `must be a list of [x, y] points in the foot frame, e.g. [[-0.13, -0.1], [0.4, -0.1]].`);
    if (P.radius !== undefined) {
      if (!isObj(P.radius)) err('proportions.radius', `must be an object with ${RADIUS.join(', ')}.`);
      else { unknownKeys('proportions.radius', P.radius, RADIUS); for (const [k, v] of Object.entries(P.radius)) num('proportions.radius.' + k, v, 0, 1); }
    }
    if (!hasBuild) {
      const miss = PROP_NUM.concat(PROP_PAIR, 'footGround').filter(k => P[k] === undefined);
      if (miss.length) err('proportions', `a skin without \`build\` must give every bone length; missing: ${miss.join(', ')}. Easier: add extends: 'mannequin' and build: { heads: 5 }.`);
      if (P.radius === undefined) warn('proportions.radius', `missing: limb joints will use defaults. Add radius: { hip, knee, shoulder, elbow, wrist, neck, hem } or use \`build\`.`);
    }
  } else if (!hasBuild) err('build', `the skin has neither \`build\` nor \`proportions\`. Add extends: 'mannequin' and build: { heads: 5 }.`);
  // scalars
  if (raw.headTop !== undefined) num('headTop', raw.headTop, 0.8, 3, 'Top of the hair above the head origin (default 1.04).');
  if (raw.outline !== undefined) { if (num('outline', raw.outline, 0, 0.2) && raw.outline > 0.06) warn('outline', `${raw.outline} is very bold; 0.03 is normal, 0.04 bold.`); }
  if (raw.farShade !== undefined) num('farShade', raw.farShade, 0, 1, 'Default 0.85.');
  if (raw.handZ !== undefined && raw.handZ !== 1 && raw.handZ !== -1) err('handZ', `must be 1 (hand over the forearm) or -1 (under it), got ${q(raw.handZ)}.`);
  if (raw.grip !== undefined) pair('grip', raw.grip, 'where a held prop sits in the hand frame, default [0.1, 0]');
  if (raw.springs !== undefined) {
    if (!isObj(raw.springs)) err('springs', `must be an object { arms: 1, head: 1, torso: 1 }.`);
    else { unknownKeys('springs', raw.springs, ['arms', 'head', 'torso']); for (const [k, v] of Object.entries(raw.springs)) num('springs.' + k, v, 0, 2, '0 = off, 2 = rubbery.'); }
  }

  // palette
  const pal = isObj(skin.palette) ? skin.palette : {};
  if (raw.palette !== undefined && !isObj(raw.palette)) err('palette', `must be an object of colour names to '#rrggbb'.`);
  for (const [k, v] of Object.entries(pal)) {
    if (k === 'shade') { num('palette.shade', v, 0, 1, 'The darkening factor for auto shades (default 0.82).'); continue; }
    if (typeof v !== 'string' || !HEX.test(v)) err('palette.' + k, `is ${q(v)}. Write a six-digit hex colour like '#c68642'.`);
  }
  const colourOk = c => typeof c === 'string' && (HEX.test(c) || c in pal || (/Shade$/.test(c) && c.slice(0, -5) in pal));
  const colour = (field, c, required) => {
    if (c === undefined) { if (required) err(field, `is required. Write a palette name (define it in palette) or a '#rrggbb' colour.`); return; }
    if (typeof c !== 'string') { err(field, `must be a palette name or '#rrggbb', got ${q(c)}.`); return; }
    if (colourOk(c)) return;
    const names = Object.keys(pal).filter(k => k !== 'shade');
    const n = nearest(c.replace(/Shade$/, ''), names);
    err(field, `colour '${c}' is not in the palette.` + (n ? ` Did you mean '${n}'? Or add ${c}: '#rrggbb' to palette.` : ` Add ${c}: '#rrggbb' to palette, or use a hex colour.`));
  };

  // entries
  const pathCheck = (field, d, frame) => {
    const r = parsePath(d);
    if (r.error) { err(field + '.d', `path ${r.error}. Use only M L H V C S Q T A Z with numbers in head units.`); return; }
    let xmin = 1e9, xmax = -1e9, ymin = 1e9, ymax = -1e9;
    for (const [x, y] of r.pts) { xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
    const big = Math.max(Math.abs(xmin), Math.abs(xmax), Math.abs(ymin), Math.abs(ymax));
    if (big > 8) { err(field + '.d', `path reaches ${Math.round(big * 100) / 100}, far outside the part frame. Coordinates are in head heights (the head is about 1 wide and 1 tall), not pixels: divide by the head height in pixels.`); return; }
    const F = frame && FRAME[frame];
    if (F && (xmin < F[0] || xmax > F[1] || ymin < F[2] || ymax > F[3]))
      warn(field + '.d', `path spans x ${+xmin.toFixed(2)}..${+xmax.toFixed(2)}, y ${+ymin.toFixed(2)}..${+ymax.toFixed(2)}, outside the usual ${F[0]}..${F[1]} by ${F[2]}..${F[3]} for '${frame}'. Check that it is in head units, facing right, y up.`);
  };
  const flatOk = (field, v) => { if (v !== undefined && !['start', 'end', 'both'].includes(v)) err(field, `is ${q(v)}. Write 'start', 'end' or 'both'.`); };
  const range01 = (field, v, lo, hi) => { if (v !== undefined) num(field, v, lo, hi); };
  function entry(field, e, key, o2) {
    o2 = o2 || {};
    if (!isObj(e)) { err(field, `must be an object such as { d: 'M0 0L1 0L1 1Z', fill: 'skin' }, got ${q(e)}.`); return; }
    const kind = e.swap !== undefined ? 'swap' : e.tube !== undefined ? 'tube' : e.cap !== undefined ? 'cap' : e.cover !== undefined ? 'cover' : e.skirt !== undefined ? 'skirt' : e.d !== undefined ? 'path' : null;
    if (!kind) {
      const all = [].concat(...Object.values(ENTRY_KEYS));
      const bad = Object.keys(e).map(k => nearest(k, all) ? `'${k}' (did you mean '${nearest(k, all)}'?)` : `'${k}'`).join(', ');
      err(field, `is not a drawing: it needs one of d (a path), swap, tube, cap, cover or skirt. Its keys are ${bad || 'none'}.`);
      return;
    }
    unknownKeys(field, e, ENTRY_KEYS[kind].filter(k => k !== 'upright' && (k !== 'look' || o2.eye)).concat('upright', 'use', 'length'));   // upright, use, length are judged separately below
    if (e.upright !== undefined && !HOLD.includes(key)) err(field + '.upright', `only works in parts.holdNear and parts.holdFar. Remove it.`);
    if (e.use !== undefined && key !== 'holdNear') err(field + '.use', `only works in parts.holdNear (a walking stick for the near hand). Remove it.`);
    else if (e.use !== undefined && e.use !== 'cane') err(field + '.use', `is ${q(e.use)}. The only value is 'cane'.`);
    if (kind === 'path' && e.length !== undefined && !(HOLD.includes(key) && e.use !== undefined)) err(field + '.length', `only goes with use: 'cane' in parts.holdNear. Remove it, or add use: 'cane'.`);
    else if (kind === 'path' && e.length !== undefined) num(field + '.length', e.length, 0.2, 8, 'Cane length in head heights, about 0.45 x heads.');
    if (e.upright !== undefined && HOLD.includes(key) && e.upright !== true) err(field + '.upright', `must be true (or leave it out).`);
    const needBuild = () => { if (!hasBuild) err(field, `a ${kind} needs a generated body. Add extends: 'mannequin' and build: { heads: ... } to the skin.`); };
    if (kind === 'path') {
      pathCheck(field, e.d, key);
      if (e.fill === undefined && e.stroke === undefined) err(field, `has a path but no colour. Add fill: '<palette name>' (a shape) or stroke: '<palette name>', w: 0.03 (a line).`);
      if (e.fill !== undefined && e.stroke !== undefined) warn(field, `has both fill and stroke; only the stroke is drawn. Split it into two entries.`);
      if (e.fill !== undefined) colour(field + '.fill', e.fill);
      if (e.stroke !== undefined) { colour(field + '.stroke', e.stroke); if (e.w === undefined) warn(field + '.w', `a stroke needs a width. Write w: 0.03 (head units).`); }
      if (e.w !== undefined && e.stroke === undefined) err(field + '.w', `is ignored on a filled shape (only strokes have a width). Remove w, or change fill to stroke.`);
      else if (e.w !== undefined) num(field + '.w', e.w, 0.001, 0.5, 'Line width in head units, 0.02-0.06 is normal.');
      if (e.opacity !== undefined) { if (e.opacity === 0) err(field + '.opacity', `0 is ignored by the engine, so the shape would be fully visible. Remove the entry, or write a value above 0 up to 1.`); else num(field + '.opacity', e.opacity, 0, 1); }
    } else if (kind === 'swap') {
      if (key !== 'head') err(field, `swap entries only work in parts.head. Move it there.`);
      if (!['eye', 'mouth', 'brow'].includes(e.swap)) err(field + '.swap', `is ${q(e.swap)}. Write 'eye', 'mouth' or 'brow'.`);
    } else if (kind === 'tube') {
      if (key !== 'arm' && key !== 'leg') err(field, `tube only works in parts.arm and parts.leg (it spans the whole limb). Use cap in upperArm, foreArm, thigh or shin.`);
      if (!Array.isArray(e.tube) || e.tube.length !== 3 || !e.tube.every(isNum) || e.tube.some(r => r <= 0 || r > 1)) err(field + '.tube', `must be three radii [joint0, joint1, joint2] in head units, each 0..1, e.g. [0.1, 0.08, 0.06].`);
      range01(field + '.from', e.from, 0, 1.1); range01(field + '.to', e.to, 0, 1.1); flatOk(field + '.flat', e.flat); range01(field + '.inset', e.inset, -1, 1);
      colour(field + '.fill', e.fill, true);
    } else if (kind === 'cap') {
      if (!['upperArm', 'foreArm', 'thigh', 'shin'].includes(key)) err(field, `cap only works in parts.upperArm, foreArm, thigh and shin. Use tube in arm or leg.`);
      if (!Array.isArray(e.cap) || (e.cap.length !== 2 && e.cap.length !== 3) || !e.cap.every(isNum) || e.cap.some(r => r <= 0 || r > 1)) err(field + '.cap', `must be two radii [start, end] (or three, with mid) in head units, each 0..1, e.g. [0.09, 0.07].`);
      range01(field + '.from', e.from, 0, 1.1); range01(field + '.to', e.to, 0, 1.1); range01(field + '.inset', e.inset, -1, 1); range01(field + '.mid', e.mid, 0, 1);
      colour(field + '.fill', e.fill, true);
    } else if (kind === 'cover') {
      needBuild();
      if (!['arm', 'leg', 'torso'].includes(key)) err(field, `cover only works in parts.arm, parts.leg and parts.torso.`);
      const c = e.cover;
      if (c !== true && !(Array.isArray(c) && c.length === 2 && c.every(isNum))) err(field + '.cover', `must be [from, to] as fractions (sleeve [0, 0.3], trousers [0, 1]) or true for the whole part, got ${q(c)}.`);
      else if (c !== true) {
        if (c[0] >= c[1]) err(field + '.cover', `from must be smaller than to, got [${c}]. Write for example [0, 0.3].`);
        else if (c[0] < -0.1 || c[1] > 1.2) err(field + '.cover', `[${c}] is outside -0.1..1.2. Fractions run 0..1 along the part.`);
      }
      range01(field + '.loose', e.loose, 0, 0.5); if (isNum(e.loose) && e.loose > 0.15) warn(field + '.loose', `${e.loose} is very baggy; 0.02-0.08 is normal.`);
      flatOk(field + '.flat', e.flat); range01(field + '.inset', e.inset, -1, 1); colour(field + '.fill', e.fill, true);
    } else if (kind === 'skirt') {
      needBuild();
      if (key !== 'skirt') err(field, `a skirt entry belongs in parts.skirt, not parts.${key}.`);
      if (e.skirt !== true) err(field + '.skirt', `must be true.`);
      if (e.length === undefined) warn(field + '.length', `missing: write length: 0.5 (knee) .. 1 (ankle).`); else num(field + '.length', e.length, 0, 1.1, '0 = hips, 0.5 = knee, 1 = ankle.');
      range01(field + '.top', e.top, 0, 1); range01(field + '.flare', e.flare, 0, 0.8); if (isNum(e.flare) && e.flare > 0.4) warn(field + '.flare', `${e.flare} is very wide; 0.15-0.35 is normal.`);
      range01(field + '.loose', e.loose, 0, 0.5);
      colour(field + '.fill', e.fill, true); if (e.shade !== undefined) colour(field + '.shade', e.shade);
      if (e.hem !== undefined) {
        if (!isObj(e.hem)) err(field + '.hem', `must be { fill: '<palette name>', w: 0.05 }.`);
        else { unknownKeys(field + '.hem', e.hem, ['fill', 'w']); colour(field + '.hem.fill', e.hem.fill, true); range01(field + '.hem.w', e.hem.w, 0.001, 0.5); }
      }
    }
  }
  const entries = (field, v, key) => {
    if (Array.isArray(v)) v.forEach((e, i) => entry(`${field}[${i}]`, e, key)); else entry(field, v, key);
  };

  // parts
  if (raw.parts !== undefined && !isObj(raw.parts)) err('parts', `must be an object keyed by bone, e.g. { head: [...], hair: {...} }.`);
  else if (isObj(skin.parts)) {
    for (const [k, v] of Object.entries(skin.parts)) {
      if (!PART_KEYS.includes(k)) {
        const n = nearest(k, PART_KEYS);
        err('parts.' + k, `unknown part '${k}'.` + (n ? ` Did you mean '${n}'?` : ` Valid parts: ${PART_KEYS.join(', ')}.`)); continue;
      }
      entries('parts.' + k, v, k);
    }
  }
  // swaps
  if (raw.swaps !== undefined && !isObj(raw.swaps)) err('swaps', `must be an object { eye: {...}, mouth: {...} }.`);
  else if (isObj(skin.swaps)) {
    for (const [kind, set] of Object.entries(skin.swaps)) {
      if (!SWAPS[kind]) { const n = nearest(kind, Object.keys(SWAPS)); err('swaps.' + kind, `unknown swap kind '${kind}'.` + (n ? ` Did you mean '${n}'?` : ` Valid kinds: hand, eye, brow, mouth.`)); continue; }
      if (!isObj(set)) { err('swaps.' + kind, `must be an object of named drawings, e.g. { ${SWAPS[kind][0]}: [...] }.`); continue; }
      for (const [name, v] of Object.entries(set)) {
        if (!SWAPS[kind].includes(name)) { const n = nearest(name, SWAPS[kind]); err(`swaps.${kind}.${name}`, `'${name}' is never requested.` + (n ? ` Did you mean '${n}'?` : '') + ` Names for ${kind}: ${SWAPS[kind].join(', ')}.`); continue; }
        const list = Array.isArray(v) ? v : [v];
        list.forEach((e, i) => {
          const f = `swaps.${kind}.${name}` + (Array.isArray(v) ? `[${i}]` : '');
          entry(f, e, kind === 'hand' ? 'hand' : 'head', { eye: kind === 'eye' });
        });
      }
    }
  }
  if (isObj(skin.parts) && skin.parts.head !== undefined && !(isObj(skin.swaps) && skin.swaps.mouth))
    warn('swaps.mouth', `the skin draws its own head but has no mouth swaps, so it will talk with the generated mouth (which may not fit your face) or not visibly. Add swaps.mouth with at least open and closed; best all of rest mbp ah ee oh oo fv l wq (docs/SPEECH.md).`);
  // chains
  if (raw.chains !== undefined && !isObj(raw.chains)) err('chains', `must be an object of named chains.`);
  else if (isObj(skin.chains)) {
    for (const [name, c] of Object.entries(skin.chains)) {
      const f = 'chains.' + name;
      if (!isObj(c)) { err(f, `must be an object { bone: 'head', at: [x, y], rest: 180, seg: [..], width: [..], fill: '..' }.`); continue; }
      unknownKeys(f, c, CHAIN_KEYS);
      if (c.bone === undefined) err(f + '.bone', `is required: the bone the chain hangs from. Write one of ${CHAIN_BONES.map(b => "'" + b + "'").join(', ')}.`);
      else if (!CHAIN_BONES.includes(c.bone)) { const n = nearest(c.bone, CHAIN_BONES); err(f + '.bone', `'${c.bone}' is not an anchor bone.` + (n ? ` Did you mean '${n}'?` : '') + ` Write one of ${CHAIN_BONES.join(', ')}.`); }
      if (c.at === undefined) err(f + '.at', `is required: [x, y] anchor in the ${c.bone || 'bone'} frame, in head units.`);
      else if (pair(f + '.at', c.at, 'anchor in the bone frame') && (Math.abs(c.at[0]) > 4 || Math.abs(c.at[1]) > 4)) err(f + '.at', `${q(c.at)} is far outside the frame; use head units (head is 1 tall).`);
      if (c.rest !== undefined && num(f + '.rest', c.rest, -360, 720) && (c.rest < 0 || c.rest > 360)) warn(f + '.rest', `${c.rest}: write degrees 0..360 (0 forward, 90 up, 180 back, 270 down).`);
      if (c.rest === undefined) warn(f + '.rest', `missing: write the resting direction in degrees (180 = hangs back, 270 = hangs down).`);
      if (c.curl !== undefined) num(f + '.curl', c.curl, -180, 180);
      if (!Array.isArray(c.seg) || !c.seg.length || !c.seg.every(x => isNum(x) && x > 0 && x <= 2)) err(f + '.seg', `is required: a list of segment lengths in head units, e.g. [0.2, 0.18, 0.14], got ${q(c.seg)}.`);
      if (!Array.isArray(c.width) || !c.width.every(x => isNum(x) && x >= 0 && x <= 2)) err(f + '.width', `is required: a list of widths, one MORE than seg, e.g. [0.2, 0.15, 0.09, 0.01], got ${q(c.width)}.`);
      else if (Array.isArray(c.seg) && c.width.length !== c.seg.length + 1) err(f + '.width', `has ${c.width.length} numbers but seg has ${c.seg.length}; width needs exactly ${c.seg.length + 1} (a width at each joint).`);
      if (c.fill === undefined) err(f + '.fill', `is required. Write a palette name or '#rrggbb'.`); else colour(f + '.fill', c.fill);
      if (c.shade !== undefined) { if (typeof c.shade === 'string') colour(f + '.shade', c.shade); else num(f + '.shade', c.shade, 0, 1, 'Shade strength 0..1 (or a colour name).'); }
      if (c.shadeSide !== undefined && c.shadeSide !== 1 && c.shadeSide !== -1) err(f + '.shadeSide', `must be 1 or -1.`);
      if (c.layer !== undefined && !LAYERS.includes(c.layer)) { const n = nearest(c.layer, LAYERS); err(f + '.layer', `'${c.layer}' is not a layer.` + (n ? ` Did you mean '${n}'?` : '') + ` Layers, back to front: ${LAYERS.join(', ')}.`); }
      if (c.tip !== undefined) num(f + '.tip', c.tip, 0, 1);
      if (c.stiff !== undefined) num(f + '.stiff', c.stiff, 0, 1, '0 loose .. 1 rigid.');
      if (c.limit !== undefined) num(f + '.limit', c.limit, 0, 360, 'Maximum swing in degrees (default 120).');
      for (const k of ['gravity', 'drag', 'wind', 'inertia', 'freq']) if (c[k] !== undefined) num(f + '.' + k, c[k], 0, 20);
      if (c.endUpright !== undefined && typeof c.endUpright !== 'boolean') err(f + '.endUpright', `must be true or false.`);
      if (c.end !== undefined) (Array.isArray(c.end) ? c.end : [c.end]).forEach((e, i) => {
        const g = f + '.end' + (Array.isArray(c.end) ? `[${i}]` : '');
        if (isObj(e) && e.d !== undefined) entry(g, e, null); else err(g, `must be a drawing { d: '...', fill: '...' } in the chain tip's frame.`);
      });
    }
  }
  return { errors: E, warnings: W };
}

function loadMessage(abs, e) {
  const st = String(e.stack || '').split('\n'); let line = 0, text = '';
  const m = st[0] && st[0].match(/:(\d+)$/);
  if (m) { line = +m[1]; text = (st[1] || '').trim(); }   // SyntaxError: first stack line is file:line, then the source line
  else { const r = String(e.stack).match(/skin[^\n]*?:(\d+):\d+/) || String(e.stack).match(new RegExp(abs.replace(/[\\\/.]/g, '.') + ':(\\d+)')); if (r) { line = +r[1]; } }
  if (line && !text) text = (fs.readFileSync(abs, 'utf8').split('\n')[line - 1] || '').trim();
  return `${path.relative(process.cwd(), abs)} line ${line || '?'}: ${e.message}` + (text ? `\n  the line reads: ${text.slice(0, 160)}` : '') + `\n  Fix the JavaScript (missing comma, quote or bracket on or just before that line).`;
}

function checkSkinFile(file) {
  const abs = path.resolve(file), base = path.basename(abs, '.js');
  let L;
  try { L = loadSkinFile(abs); } catch (e) { return { errors: [{ field: 'file', msg: loadMessage(abs, e) }], warnings: [] }; }
  if (!L.keys.length) return { errors: [{ field: 'file', msg: `registers no skin. Start from: (function (g) { (g.CharSkins = g.CharSkins || {}).${base} = { name: '${base}', ... }; })(typeof self !== 'undefined' ? self : this);` }], warnings: [] };
  const raw = L.skins[base] || L.skins[L.keys[0]];
  const dirs = [path.dirname(abs), path.join(ROOT, 'skins')];
  try { return checkSkin(raw, { fileBase: base, registeredKeys: L.keys, dirs }); }
  catch (e) { return { errors: [{ field: 'file', msg: `cannot evaluate the skin: ${e.message}. The skin file must be plain data (no helpers from other files).` }], warnings: [] }; }
}

module.exports = { checkSkinFile, checkSkin, loadSkinFile, parsePath, resolveSkin };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node tools/skincheck.cjs skins/<name>.js'); process.exit(2); }
  if (!fs.existsSync(file)) { console.error(`no such file: ${file}`); process.exit(2); }
  const r = checkSkinFile(file);
  console.log(path.relative(process.cwd(), path.resolve(file)));
  for (const e of r.errors) console.log(`ERROR ${e.field}: ${e.msg}`);
  for (const w of r.warnings) console.log(`WARN ${w.field}: ${w.msg}`);
  console.log(r.errors.length ? `FAIL: ${r.errors.length} error(s), ${r.warnings.length} warning(s). Fix the errors and run skincheck again.` : `OK: 0 errors, ${r.warnings.length} warnings`);
  process.exit(r.errors.length ? 1 : 0);
}
