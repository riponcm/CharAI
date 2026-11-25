// Validate an action file against docs/ACTIONS.md and try it on two bodies.
// Usage: node tools/actioncheck.cjs actions/<name>.js     (or films/<film>/actions/<name>.js)
// Every message names the field and says what to write. Exit code 1 on errors.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

const LANDMARKS = ['top', 'forehead', 'eye', 'mouth', 'chin', 'ear', 'backhead', 'neck', 'chest', 'belly', 'hip', 'back', 'seat', 'knee', 'ground', 'front', 'up', 'out', 'down', 'wall', 'wallHigh', 'wallLow', 'face', 'shoulder', 'waist', 'side'];
// on the partner, in a paired action (docs/PAIRS.md)
const PARTNER = ['head', 'top', 'face', 'shoulder', 'chest', 'belly', 'back', 'waist', 'side', 'hip', 'knee', 'hand', 'arm', 'around', 'front'].map(n => 'partner.' + n);
const PAIR_TOP = { pair: 1, doc: 1, gap: 1, args: 1, a: 1, b: 1 };
const PAIR_ROLE = { low: 1, high: 1 };
const PAIR_KEY = ['low', 'high', 'give', 'take', 'release', 'catch', 'grab'];
const HANDS = ['relaxed', 'fist', 'open', 'point', 'grip', 'thumb'];
const POSES = ['stand', 'sit', 'kneel', 'squat', 'lie', 'heels'];
const MOODS = ['neutral', 'happy', 'excited', 'scared', 'surprised', 'determined', 'sad', 'angry', 'tired', 'proud', 'shy'];
const TOP = { channel: 1, doc: 1, args: 1, keys: 1, planted: 1, end: 1, loop: 1, travel: 1, anticipation: 1, settle: 1, overlap: 1, face: 1, hold: 1, release: 1, blendIn: 1, back: 1, name: 1, contact: 1, air: 1, height: 1, step: 1, wall: 1, from: 1 };
const KEY_BODY = ['t', 'hold', 'stand', 'pose', 'lean', 'bend', 'twist', 'head', 'neck', 'tilt', 'turn', 'chest', 'squash', 'x', 'y', 'crouch', 'rise', 'armNear', 'armFar', 'handNear', 'handFar', 'footNear', 'footFar', 'hands', 'mouth'];
const KEY_ARMS = ['t', 'hold', 'lean', 'bend', 'head', 'twist', 'neck', 'turn', 'bob', 'armNear', 'armFar', 'handNear', 'handFar', 'hands', 'mouth'];
const lev = (a, b) => { const d = [...Array(b.length + 1).keys()]; for (let i = 1; i <= a.length; i++) { let p = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } } return d[b.length]; };
const near = (w, list) => { let b = null, bd = 9; for (const n of list) { const d = lev(w, n); if (d < bd) { bd = d; b = n; } } return b && bd <= 2 ? ` Did you mean '${b}'?` : ''; };

function check(file) {
  const out = [], E = m => out.push('ERROR ' + m), W = m => out.push('WARNING ' + m);
  const name = path.basename(file, '.js');
  const g = { CharActions: {} };
  g.self = g;
  try { vm.runInNewContext(fs.readFileSync(file, 'utf8'), g, { filename: file }); }
  catch (e) { E(`the file does not load: ${e.message}. Check brackets and commas; start from an example in docs/ACTIONS.md.`); return out; }
  const names = Object.keys(g.CharActions);
  if (!names.length) { E(`the file registers no action. Write (g.CharActions = g.CharActions || {}).${name} = { ... }.`); return out; }
  if (!g.CharActions[name]) E(`the file registers '${names[0]}' but is called ${name}.js; the name and the file must match.`);
  const a0 = g.CharActions[name] || g.CharActions[names[0]];
  if (a0.pair) {   // a paired action: the file's own fields, then each role as an action
    for (const k of Object.keys(a0)) if (!PAIR_TOP[k]) W(`${k}: unknown field of a paired action. Fields: ${Object.keys(PAIR_TOP).join(', ')}.`);
    if (typeof a0.doc !== 'string' || !a0.doc) W(`doc: write one line saying what the two do.`);
    if (a0.gap !== undefined && !(+a0.gap >= 0 && +a0.gap <= 8)) E(`gap: the closest the two torsos come, in arm lengths of the shorter arm (0 = touching, 0.5 = a handshake).`);
    for (const r of ['a', 'b']) { if (!a0[r] || typeof a0[r] !== 'object') { E(`${r}: write the role of ${r === 'a' ? 'the one who is told (A: hug(with=B))' : 'the partner'} as { keys: [...] }.`); continue; } checkRole(a0[r], r + '.', true); }
  } else checkRole(a0, '', false);
  if (!out.some(l => l.startsWith('ERROR'))) tryIt(a0);
  return out;

  function checkRole(a, pre, paired) {
  for (const k of Object.keys(a)) if (!TOP[k] && !(paired && PAIR_ROLE[k])) W(`${pre}${k}: unknown field.${near(k, Object.keys(TOP))} Fields: ${Object.keys(TOP).join(', ')}.`);
  const body = a.channel !== 'arms';
  if (a.channel !== undefined && a.channel !== 'body' && a.channel !== 'arms') E(`channel: '${a.channel}' is not valid. Write channel: 'body' (whole body) or channel: 'arms' (a gesture over whatever the body does).`);
  if (!paired && (typeof a.doc !== 'string' || !a.doc)) W(`doc: write one line saying what it does, for example doc: 'bow from the waist'.`);
  if (a.args !== undefined && (typeof a.args !== 'object' || Array.isArray(a.args))) E(`args: write an object of defaults, for example args: { deep: 1 }.`);
  if (a.planted !== undefined && !['both', 'near', 'far', 'none'].includes(a.planted)) E(`planted: write 'both', 'near', 'far' or 'none'.`);
  if (a.end !== undefined && !['stand', 'hold'].concat(POSES).includes(a.end)) E(`end: write 'stand' (the default), 'hold' (keep the last pose), or a pose to finish in: ${POSES.join(', ')}.`);
  if (a.end !== undefined && !body) W(`end: arms actions do not use end; they ease back out over release.`);
  if (a.air !== undefined && !(Array.isArray(a.air) && a.air.length === 2 && a.air[0] < a.air[1])) E(`air: write [takeoff, landing] in seconds, for example air: [0.4, 0.8].`);
  if (a.step !== undefined && !(a.step && isFinite(+a.step.ahead) && isFinite(+a.step.height))) E(`step: write { ahead: 0.35, height: 0.25 } in leg lengths.`);
  if (a.wall !== undefined && !isFinite(+a.wall)) E(`wall: a number of leg lengths ahead (negative = behind), for example wall: 0.9.`);
  if (a.from !== undefined && a.from !== 'any') E(`from: write from: 'any' (start from whatever pose the actor is in) or leave it out.`);
  if (a.contact !== undefined && typeof a.contact !== 'boolean') E(`contact: write contact: true when the hands touch the head or body on purpose.`);
  if (a.loop !== undefined && a.loop !== true && !(Array.isArray(a.loop) && a.loop.length === 2 && a.loop[0] < a.loop[1])) E(`loop: write true (loops until the next body line) or [from, to] in seconds (repeats args.times times).`);
  for (const f of ['anticipation', 'settle', 'overlap']) if (a[f] !== undefined && !(+a[f] >= 0 && +a[f] <= 2)) E(`${f}: a number 0..2 (1 = normal, 0 = none).`);
  for (const f of ['travel', 'hold', 'release', 'blendIn', 'back']) if (a[f] !== undefined && !isFinite(+a[f])) E(`${f}: must be a number.`);
  if (a.face !== undefined && !MOODS.includes(a.face)) E(`face: '${a.face}' is not a mood.${near(String(a.face), MOODS)} Moods: ${MOODS.join(', ')}.`);
  if (!Array.isArray(a.keys) || !a.keys.length) { E(`${pre}keys: write a list of key poses, for example keys: [{ t: 0.4, lean: 30 }].`); return; }
  const allowed = (body ? KEY_BODY : KEY_ARMS).concat(paired ? PAIR_KEY : []);
  let prevT = 0;
  const num = (v, where, lo, hi) => { if (typeof v === 'function') return; if (typeof v !== 'number' || !isFinite(v)) E(`${where}: must be a number, got ${JSON.stringify(v)}.`); else if (v < lo || v > hi) W(`${where}: ${v} is outside the usual range ${lo}..${hi}.`); };
  a.keys.forEach((k, i) => {
    const at = `${pre}keys[${i}]`;
    if (!k || typeof k !== 'object') { E(`${at}: each key is an object like { t: 0.4, lean: 20 }.`); return; }
    if (!(typeof k.t === 'number' && k.t > 0)) E(`${at}.t: the time of this pose in seconds after the action starts, above 0.`);
    else { if (k.t <= prevT) E(`${at}.t: ${k.t} must be later than the key before (${prevT}).`); prevT = k.t; }
    for (const f of Object.keys(k)) if (!allowed.includes(f)) {
      const other = body ? KEY_ARMS : KEY_BODY;
      if (other.includes(f)) E(`${at}.${f}: not allowed in a${body ? ' body' : 'n arms'} action.${body && f === 'bob' ? " Use crouch or rise." : !body ? ' Use channel: \'body\' to move the legs and hips.' : ''}`);
      else E(`${at}.${f}: unknown key field.${near(f, allowed)} Fields: ${allowed.join(', ')}.`);
    }
    for (const f of ['lean', 'bend', 'twist', 'head', 'neck', 'tilt']) if (k[f] !== undefined) num(k[f], `${at}.${f}`, -90, 90);
    if (k.crouch !== undefined) num(k.crouch, `${at}.crouch`, 0, 1);
    if (k.y !== undefined) num(k.y, `${at}.y`, -0.5, 1.5);
    if (k.turn !== undefined) num(k.turn, `${at}.turn`, -1, 1);
    if (k.pose !== undefined && !POSES.includes(k.pose)) E(`${at}.pose: '${k.pose}' is not a pose.${near(String(k.pose), POSES)} Poses: ${POSES.join(', ')}.`);
    if (k.rise !== undefined) num(k.rise, `${at}.rise`, 0, 1);
    if (k.x !== undefined) num(k.x, `${at}.x`, -3, 3);
    if (k.bob !== undefined) num(k.bob, `${at}.bob`, -0.3, 0.3);
    if (k.chest !== undefined) num(k.chest, `${at}.chest`, 0.8, 1.2);
    for (const f of ['armNear', 'armFar']) if (k[f] !== undefined && typeof k[f] !== 'function') {
      if (!Array.isArray(k[f]) || k[f].length !== 3) E(`${at}.${f}: write [shoulder, elbow, wrist] in degrees, for example [90, 30, 0] (0 = hanging down, 90 = forward, 180 = straight up).`);
      else k[f].forEach((v, j) => num(v, `${at}.${f}[${j}]`, -180, 200));
      if (k[f.replace('arm', 'hand')]) W(`${at}: both ${f} and ${f.replace('arm', 'hand')} are given; the hand target wins.`);
    }
    for (const f of ['footNear', 'footFar']) if (k[f] !== undefined && typeof k[f] !== 'function' && !(k[f] === 'step' || k[f] === 'ground' || (Array.isArray(k[f]) && (k[f][0] === 'step' || k[f][0] === 'ground'))) && (!Array.isArray(k[f]) || k[f].length !== 3)) E(`${at}.${f}: write [ahead, lift, toe angle] in leg lengths and degrees, for example [0.3, 0.2, 10]. Standing: footNear [0.12, 0, 0], footFar [-0.08, 0, 0].`);
    if (k.squash !== undefined && typeof k.squash !== 'function' && (!Array.isArray(k.squash) || k.squash.length !== 2)) E(`${at}.squash: write [width, height], for example [1.05, 0.95].`);
    for (const f of ['handNear', 'handFar']) if (k[f] !== undefined && typeof k[f] !== 'function') {
      const v = k[f], lm = typeof v === 'string' ? v : Array.isArray(v) ? v[0] : v && v.at;
      if (!LANDMARKS.includes(lm) && !(paired && PARTNER.includes(lm))) E(`${at}.${f}: '${lm}' is not a landmark.${near(String(lm), LANDMARKS)} Write 'chest', ['chest', 0.3, 0] (forward, up in head heights) or { at: 'chest', dx: 0.3 }. Landmarks: ${LANDMARKS.join(', ')}${paired ? '; on the partner: ' + PARTNER.join(', ') : ''}.`);
      if (Array.isArray(v) && (v.length > 3 || v.slice(1).some(n => typeof n !== 'number'))) E(`${at}.${f}: write ['${lm}', dx, dy] with two numbers.`);
    }
    if (k.hands !== undefined && typeof k.hands !== 'function') {
      const hs = typeof k.hands === 'string' ? [k.hands] : [k.hands && k.hands.near, k.hands && k.hands.far].filter(Boolean);
      if (!hs.length) E(`${at}.hands: write a hand shape ('open') or { near: 'open', far: 'fist' }.`);
      for (const h of hs) if (!HANDS.includes(h)) E(`${at}.hands: '${h}' is not a hand shape.${near(String(h), HANDS)} Shapes: ${HANDS.join(', ')}.`);
    }
  });
  if (Array.isArray(a.loop) && a.loop[1] > prevT + 1e-9) E(`loop: [${a.loop}] ends after the last key (${prevT} s).`);
  if (a.keys.some(k => k && (k.footNear === 'step' || (Array.isArray(k.footNear) && k.footNear[0] === 'step') || k.footFar === 'step' || (Array.isArray(k.footFar) && k.footFar[0] === 'step'))) && !a.step) E(`a foot goes to 'step' but there is no step: add step: { ahead: 0.35, height: 0.25 }.`);
  if (a.keys.some(k => k && [k.handNear, k.handFar].some(h => h && /wall/.test(JSON.stringify(h)))) && a.wall === undefined) E(`a hand goes to the wall but there is no wall: add wall: 0.9 (leg lengths ahead).`);
  if (body && a.travel && a.planted === 'both') W(`planted: 'both' with travel: the feet stay put while the body moves away from them. Use planted: 'none' and footNear/footFar keys.`);
  for (const v of ['low', 'high']) if (a[v] !== undefined && (typeof a[v] !== 'object' || Array.isArray(a[v]))) E(`${pre}${v}: write key fields that replace those of every key, for example { pose: 'heels', lean: 20 }.`);
  if (prevT > 6) W(`the last key is at ${prevT} s; most actions take 0.5-2.5 s.`);
  }
  // try it: two very different bodies (as a pair: a toddler and a tall adult, both ways), no missing values
  function tryIt(a) {
    if (a.pair) {
      try {
        const root = path.join(__dirname, '..'), { loadEngine } = require(path.join(root, 'tools', 'check.cjs'));
        vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
        const eng = loadEngine(path.join(root, 'films', 'cast'));
        for (const [p, q] of [['tot', 'vera'], ['vera', 'tot'], ['gramps', 'baker']]) {
          const F = eng.CharStage.compile(eng.CharScript.parse(`film "t" 20s
stage width=4000 ground=600 scale=60
actor A = skin ${p} at 700
actor B = skin ${q} at 1000 facing left
0.5 A: ${name}(with=B)
`), eng.lib);
          for (const d of F.diagnostics) if (d.severity === 'error') E(`${p} with ${q}: ${d.message}`);
          for (let t = 0.5; t < 9; t += 0.1) for (const X of F.actors) if (/NaN|null/.test(JSON.stringify(X.sample(t).pose.arms))) { E(`${p} with ${q}: ${X.name}'s arms get no value at ${t.toFixed(1)} s.`); t = 99; break; }
        }
      } catch (e) { E(`running it failed: ${e.message}`); }
      return;
    }
    try {
      globalThis.self = globalThis;
      const root = path.join(__dirname, '..');
      const P = require(path.join(root, 'src', 'perform.js')), m = require(path.join(root, 'skins', 'mannequin.js'));
      vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
      for (const b of [{ heads: 2.3 }, { heads: 7.6, belly: 0.5 }]) {
        const sk = Object.assign({}, m, { build: b }), pf = P.compile(sk, [{ t: 0.2, action: name }], { ground: 500, x: 400, scale: 50 });
        for (const d of pf.diagnostics) if (d.severity === 'error') E(`on a ${b.heads}-head body: ${d.message}`);
        for (let t = 0; t < pf.end(0) + 0.5; t += 0.05) if (/NaN|null/.test(JSON.stringify(pf.sample(t).pose.arms))) { E(`on a ${b.heads}-head body the arms get no value at ${t.toFixed(2)} s; check the arm keys.`); break; }
      }
    } catch (e) { E(`running it failed: ${e.message}`); }
  }
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node tools/actioncheck.cjs actions/<name>.js'); process.exit(2); }
  const out = check(path.resolve(file)), errs = out.filter(l => l.startsWith('ERROR')).length, warns = out.length - errs;
  console.log(path.relative(process.cwd(), file) + '\n' + out.map(l => '  ' + l).join('\n') + (out.length ? '\n' : '') +
    (errs ? `FAIL: ${errs} error(s), ${warns} warning(s). Fix the errors and run actioncheck again.` : `OK: 0 errors, ${warns} warning(s). Look at it: node tools/action.cjs ${path.basename(file, '.js')} out.png --skin=${/pair: *true/.test(fs.readFileSync(file, 'utf8')) ? 'captain+tot,vera+skye' : 'tot,baker,vera'}`));
  process.exit(errs ? 1 : 0);
}
module.exports = { check, LANDMARKS };
