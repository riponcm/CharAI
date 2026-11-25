# ACTIONS.md: the CharAI action catalogue, moods, and writing a new action

An **action** (`2.0 Mia: bow()`) is a small file of key poses in body terms, so one file works on
a toddler, a fat man and a tall thin woman. CharAI adds smooth curves, trailing head and
arms, anticipation and settle, weight, mood, hand keep-out, planted feet and blending.

## 1. Catalogue

Built in (see `docs/AUTHORING.md` for arguments): body `walk`, `run`, `sneak`, `enter`, `jump`,
`turn`, `stand`, `idle`, `kneel`, `crouch`, `recoil`, `sit`, `peer`, `breathe`, `wobble`,
`fallsit`, `backstep`, `bounce`, `skid`; arms `wave`, `point`, `reach`, `cheer`, `hold`, `drop`,
`clench`, `pet`, `hesitate`, `tug`, `shield`, `laugh`; face `face`; look `look`, `nod`.

Action files in `actions/` (shared) and `films/<film>/actions/` (that film only, wins); a file
with a built-in name replaces the built-in. The reference files show each feature: `bow` (angles,
an argument), `clap` (landmarks, a loop), `stumble` (travel, feet), `getup` and `standup` (start
in a pose), `stepup` (a step, `y`), `lean` (a wall), `jumpjoy` (`air`), `skip`, `hi` (raw arm
angles, `turn`), `scratchhead` (`contact`). Start a new action by copying the closest one.

## 2. Moods

`Mia: mood(sad)` or `mood(name=angry, strength=1.5)` colours everything she does until the next
`mood` line: posture, head, arms, step length and tempo, arm swing, action speed, face. It
blends over 0.6 s; `strength` 0..2. Moods: `neutral`, `happy`, `sad`, `angry`, `scared`,
`tired`, `proud`, `shy`. `face(...)` still changes just the face. Set the mood before a walk:
its step length and tempo are fixed when it starts (the posture still changes).

## 3. Writing an action

One file per action, `actions/<name>.js` (or in a film's `actions/` folder). The name in the
file must match the file name.

```js
(function (g) { (g.CharActions = g.CharActions || {}).NAME = {
  channel: 'body', doc: 'one line for authors', args: { deep: 1 },
  keys: [
    { t: 0.4, lean: 30, head: 10 },
    { t: 1.0, hold: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
```

**Options** (all optional except `keys`):

| Field | Default | Meaning |
| --- | --- | --- |
| `channel` | 'body' | 'body' moves the whole body; 'arms' is a gesture over whatever the body does |
| `doc`, `args` | | one line for authors; arguments with defaults (`{ deep: 1 }`; a key value may be `a => 30 * a.deep`) |
| `planted` | 'both' | body: feet that stay exactly where they are: 'both', 'near', 'far', 'none' ('none' when `travel`, `air` or `step` is set) |
| `end` | 'stand' | body only: after the last key, ease back to standing (in `back` s, 0.45), or finish in a pose that holds: 'sit', 'kneel', 'squat', 'lie'; 'hold' keeps the last key |
| `loop` | none | `true`: repeat all keys until the next body line (`end` is then ignored); `[from, to]`: repeat that stretch (args `times`, or `for` = seconds), then go on to `end` |
| `travel` | 0 | body: leg lengths moved over the action (negative = backwards), spread evenly if no key sets `x`. The camera follows only if the script says `cam: follow(...)` |
| `air`, `height` | none, 0.4 | body: airborne from `air[0]` to `air[1]` s on a parabola `height` leg lengths high, landing with a squash (unless a key just after sets `squash`) |
| `step` | none | body: a step `{ ahead, height }` in leg lengths in front; feet go onto it with `footNear: 'step'` |
| `wall` | none | a wall this many leg lengths ahead (negative = behind) for the `wall` landmarks |
| `contact` | false | `true`: the hands touch the head or body on purpose; the keep-out leaves them alone all through |
| `from` | | 'any': start from whatever pose the actor is in (else a sitting or lying actor stands first, unless the first key has a `pose`) |
| `anticipation`, `settle`, `overlap` | 1 | 0..2: the counter-move before the first key, the overshoot after the last, how much head and arms trail |
| `face` | none | a mood face while it plays (`happy`, `sad`, ...) |
| `hold`, `release` | 0, 0.35 | arms: seconds to hold the last key, seconds to ease back out (arms actions never use `end`) |

**Key fields.** `t` (seconds after the action starts, above 0, increasing) is required. Each
other field is its own smooth curve through the keys that set it; a field never set stays at
standing (or at the first key's `pose`). A key with only `t` and `hold: true` is a pause.

| Field | Channel | Meaning |
| --- | --- | --- |
| `pose` | body | 'stand', 'sit' (on the ground), 'kneel', 'squat', 'heels' (both knees down), 'lie' (on the back): a whole pose for this body; other fields in the key adjust it |
| `lean`, `bend` | both | upper body forward (+) or back (-); round (+) or arch (-) the back, degrees |
| `twist`, `tilt` | both / body | turn the chest; tip the hips, degrees |
| `head`, `neck` | both | chin down (+) / up (-); neck forward (+), degrees |
| `turn` | both | -1..1: the face turns toward (+) or away from (-) the camera (features squeeze and slide); a "no" = 0.5, -0.5, 0.5 |
| `crouch` | body | 0 standing .. 1 deep squat (knees bend, feet stay) |
| `y` | body | raise the pelvis by this many leg lengths (onto a step, a ledge; 0.25 = a stair) |
| `rise` | body | 0..1: up on the toes |
| `bob` | arms | lift (+) or drop (-) the whole body, head heights |
| `x` | body | pelvis forward from where THIS action started, leg lengths (not cumulative across actions) |
| `chest`, `squash` | body | torso stretch (1 normal, 0.9 squashed, 1.1 tall); whole body `[width, height]` |
| `handNear`, `handFar` | both | put that wrist at a **landmark** (below), solved for this body |
| `armNear`, `armFar` | both | raw angles `[shoulder, elbow, wrist]`: shoulder 0 hanging down, 90 forward, 180 up; elbow 0 straight .. 140 folded, bending the forearm forward and up; `[90, 90, 0]` puts the hand in front of the face on any body |
| `footNear`, `footFar` | body | `[ahead, lift, toe angle]` in leg lengths from where the pelvis started (standing: `[0.12, 0, 0]`, `[-0.08, 0, 0]`), or `'step'` / `['step', dx]`. A foot down in the same place at two keys is planted between them |
| `hands` | both | `'open'` or `{ near: 'open', far: 'fist' }`: relaxed, fist, open, point, grip, thumb (thumb up) |
| `mouth` | both | a mouth swap while this key plays (`'o'`, `'open'`, `'grit'`), `null` back to the mood |
| `hold`, `stand` | both / body | `true`: arrive and leave with zero speed; `true`: this key is the standing pose |

"Near" = the arm or foot on the camera side.

**Landmarks** for `handNear` / `handFar`: `'chin'`, `['chest', dx, dy]` or
`{ at: 'chest', dx: 0.3, dy: 0 }`, dx forward and dy up in head heights, measured on the actor
at that moment (after lean, crouch, posture and mood). A head is 1 head height tall, so
dy 0.1-0.3 is a small shift.

| Landmark | Where |
| --- | --- |
| `top`, `forehead`, `eye`, `mouth`, `chin`, `ear`, `backhead` | on the surface of the head (`ear` is over the ear, `backhead` behind the head) |
| `neck`, `chest`, `belly`, `hip`, `back`, `seat` | on the body (`hip` = hand on the hip, `seat` = behind the bottom) |
| `knee`, `ground` | in front of the near knee; on the ground half a leg length ahead |
| `front`, `up`, `out`, `down` | at full arm's length from that shoulder: straight ahead, straight up, up and forward, down. Use them for reaching; for a hand near the head use a head landmark with dx, dy |
| `wall`, `wallHigh`, `wallLow` | on the `wall` (option) at shoulder, head and hip height |

A hand sent to a landmark lands on it at that key on every body. If it is out of reach, the
body helps (the head nods toward a hand going to the head; the body leans and crouches toward
the ground), and what is still too far is reached as far as the arm goes. The keep-out (hands
out of the head, chest and belly) moves only hands that are not on a landmark and not in a
`contact: true` action.

**Details.**
- Raw arm angles are relative to the torso (a `lean` tips the arms with it); hand targets are not.
  Arms are also moved by the mood, belly clearance and keep-out (free hands only), small springs
  and a walking stick.
- Body-only: `chest`, `squash`, `crouch`, `rise`, `y`, `x`, `pose`, feet. Arms actions add `lean`,
  `bend`, `head`, `neck`, `twist`, `turn`, `bob` to the body.
- A wall landmark is reached only within arm's length: wall 0.5-0.9 leg lengths ahead.
- `loop: [a, b]` plays to b, repeats a..b, then plays on to the last key and `end`; `loop: true`
  does the same with `times=`/`for=`, else repeats until the next body line.
- Started while sitting or lying, an action without a starting `pose` plays only its upper body.
- Moods slow or speed actions and steps: sad 30%/22% slower, tired 35%/28%, shy 15%/10%;
  happy and angry about 10% quicker.
- `+0.2` in a script = 0.2 s after the same actor's previous line ends.
- `check` calls a foot more than 6 px up outside a `jump` or `air` time "floats".

## 4. Worked examples

**Clap** (arms, landmarks, a repeating stretch):

```js
(function (g) { (g.CharActions = g.CharActions || {}).clap = {
  channel: 'arms', doc: 'clap (times = claps)', args: { times: 4, for: 0 }, loop: [0.3, 0.56], face: 'happy',
  keys: [
    { t: 0.3, handNear: ['chest', 0.35, 0.12], handFar: ['chest', 0.3, -0.08], hands: 'open' },
    { t: 0.43, handNear: ['chest', 0.32, 0.02], handFar: ['chest', 0.32, 0.0] },
    { t: 0.56, handNear: ['chest', 0.35, 0.12], handFar: ['chest', 0.3, -0.08] },
  ] }; })(typeof self !== 'undefined' ? self : this);
```

**Stand up from sitting** (start in a pose, pass through another, hand on the ground):

```js
(function (g) { (g.CharActions = g.CharActions || {}).standup = {
  channel: 'body', doc: 'stand up from sitting on the ground', planted: 'none', anticipation: 0,
  keys: [
    { t: 0.25, pose: 'sit', hold: true },
    { t: 0.7, pose: 'squat', lean: 34, handNear: 'ground', hands: 'open' },
    { t: 1.3, stand: true },
  ] }; })(typeof self !== 'undefined' ? self : this);
```

## 5. Rules of thumb

2-4 keys; 0.3 s between keys for a big move, 0.12 s for a hit; `hold: true` on the pose to read.

## 6. Check and look

`node tools/actioncheck.cjs actions/<name>.js` names each error and what to write.
`node tools/action.cjs <name> out.png --skin=tot,baker,vera` draws a strip; add `--mood=sad,angry`,
`--fixed` (a still camera, so travel shows), `--film=<film>` (that film's own actions), or a
sequence `"sit(); <name>()"`. A declared wall or step is drawn in grey. Test bodies: `tot`, `baker`,
`vera`, `gramps`, `titan`, `skye`, `captain` (walking stick), `duchess`.
