# Authoring a CharAI film

A film is a folder with one script, `film.char`. CharAI draws the set, the actors, the
camera and the text from it. You write what happens and when; you never draw frames.

```
films/<name>/film.char        the script (required)
films/<name>/skins|sets|puppets|props/*.js   your own library files (optional; they win over shared ones)
```

## Layout, bare stage and Char.mount

Run everything from the engine folder. Paths: engine files in `src/`, example skins in `skins/`
(`tess.js kai.js mannequin.js`, worked examples, not a character library), optional scenery and
creatures in `extras/sets|puppets|props/`, regression films in `films/`, a host page in
`examples/host.html`. A film's own `skins|sets|puppets|props/` still win over the shared ones.
Tests: `node --test tests/*.cjs`. `tools/shot.cjs` needs `puppeteer-core` (installed in this
folder, or set `CHAR_PUPPETEER`, or `"puppeteer"` in the untracked `.char-local.json`; run `npm install` otherwise).

**Bare stage (characters only).** A film needs no `set` line. Without one the background is
transparent, the ground is flat and there is no scenery. Optional header line, all parts optional:

```
stage width=2400 ground=600 scale=68    # world width px, ground y px, px per head height (these are the defaults)
```

Anchors `left`, `center`, `right` (x 200, 640, 1080) exist; plain numbers work too. With a
`set` line nothing changes. See `films/bare-test/film.char`.

**Char.mount (for a host page).** Load `src/rig.js gait.js poses.js clips.js perform.js`, your
skin files, then `src/script.js stage.js`. Then:

```js
const m = Char.mount(document.getElementById('chars'), { script: text, skins: CharSkins, width: 1280, height: 720 });
m.duration; m.seek(t); m.destroy();   // seek(t) is a pure function of t, any order
```

It draws only the characters on a transparent SVG layer, so the host paints its own scenery
behind it (keep the host's ground line at the script's `ground=`). See `examples/host.html`.

## Commands (run from the engine folder)

```
node tools/check.cjs films/<name> [--timeline]   # errors + motion problems; writes index.html; exit 1 on errors
node tools/sheet.cjs films/<name> sheet.png --n=12   # one PNG of 12 evenly spaced frames with timestamps
node tools/sheet.cjs films/<name> jump.png --n=12 --from=5.6 --to=7.4   # a close strip of one action
node tools/render.cjs films/<name> out.mp4 --fps=24  # 1280x720 MP4 (about 1.4 s per second of film)
```

Work in this loop: write the script, `check` until it says `OK`, look at one `sheet`, fix, then
`render`. `--timeline` prints when every line starts and ends, useful for `+` times. Every
message names the line to change and what to write. Open `index.html` in a browser to play.

## Example (`films/demo`)

```
film "Lantern Light" 10s
set hillside dusk
actor Tess = skin tess at 230
actor Ren = skin ren at 1160 facing left
puppet Pip = bird at branch facing left
prop lantern at 532

0.0  Tess: walk(to=490), face(happy)
+0.1 Tess: hold(lantern)              # 0.1 s after Tess's walk ends
0.4  caption: "Dusk on the hill.", for=2.4
2.0  Ren: look(at=down), face(sad)
3.0  cam: pan(to=1040, over=3), zoom(1.2, over=3)
+0.2 Tess: walk(to=860, speed=1.4)
3.4  Pip: fly(to=1290)
+0.3 Pip: hop(to=1236)
4.8  Ren: look(at=Tess), face(surprised)
+0.3 Ren: wave()
5.6  caption: "There you are!", by=Ren, for=2
+0.1 Tess: face(happy)
7.6  Ren: face(happy)
8.6  card: "Light finds friends."
```

A second example with the new motion (a hero close-up in a gust, then running, a hop, a skid):

```
film "Gust" 14s
set hillside
actor Kai = skin kai at 380
0    cam: cut(to=Kai, zoom=2), frame(on=Kai, top=head, bottom=thigh, x=0.35, over=0)
0    Kai: idle()
0.4  wind: gust(amount=1, over=1.8)
1.6  Kai: face(happy)
2.6  cam: home(over=1.2)
2.6  cam: follow(Kai, over=0.8)
3.0  Kai: bounce(times=3)
+0   Kai: run(to=700)
+0   Kai: jump(to=900, height=1.2)
+0   Kai: run(to=1200, end=skid)
+0.15 Kai: turn()
+0.05 Kai: wave(hand=both), face(excited)
```

## Grammar

One statement per line. `#` starts a comment. Names are case-sensitive.

Header lines (before or between timed lines):

| Line | Meaning |
| --- | --- |
| `film "Title" 30s` | title and length in seconds (required, first) |
| `set <name> [variant]` | one set per film, e.g. `set hillside dusk` |
| `actor <Name> = skin <skin> at <place> [facing left] [scale=1]` | a person drawn by a skin |
| `puppet <Name> = <kind> at <place> [facing left] [scale=1]` | an animal or creature |
| `prop <kind> [as <Name>] [at <place>]` | an object; without `at` it appears when first held |

Timed lines: `<time> <target>: call(args)[, call(args)]`

- `<time>`: absolute seconds (`3`, `4.5`) or `+n`: n seconds after the **same target's**
  previous line has finished (a walk finishes when the actor arrives and settles). `+0` = right after.
- Calls on one line start together and must use different channels (see tables).
- Arguments: positional in the listed order, or `key=value`. Values: numbers, names, `"text"`.
  `face(scared)` = `face(mood=scared)`.
- A target's lines must go forward in time. A new line on the same channel before a move
  finishes is an error (the move would be cut): use `+0` or a later time.

**Places** (`at`, `to`, `pan`): an x in set pixels (0 = left edge of the set), an anchor
of the set, or the name of an actor, puppet or prop (where it was placed at the start).
`y` comes from the ground, or from the anchor.

## Actors

Channels: **body** (one at a time, holds until the next body action), **arms** (gesture over
the body), **face**, **look**. Required arguments have no `=`.

| Channel | Call | Notes |
| --- | --- | --- |
| body | `walk(to, speed=1)` | speed 0.5..2 |
| body | `run(to, speed=1, end=stop)` | a pumping run (speed 0.5..2.5, see Speeds below); starts with an anticipation beat; `end=skid` arrives at full speed and skids to a stop at `to` |
| body | `sneak(to, speed=1)` | tiptoe, crouched |
| body | `enter(from=left, speed=1)` | walk in from off screen to the `at` place |
| body | `jump(to, height=1)` | crouch, stretch, tuck, squash on landing, recover; height 2 = big; `to` = where she lands (to hop over something, aim about 1.5 leg lengths past it) |
| body | `skid()` | stop from a run on the spot: brace, slide, overshoot, settle (`run(..., end=skid)` is usually better) |
| body | `bounce(times=3)` | bounce on the toes, `times` bobs |
| body | `turn()` | face the other way: a quick dip and hop-pivot on the back foot, the feet re-planted under her (0.48 s) |
| body | `stand()`, `idle()` | idle = standing with life (weight shifts, a glance, breathing); holds until the next body line |
| body | `kneel()`, `crouch()`, `recoil()` | recoil = flinch and step back in fear |
| body | `sit(on=0)` | on = seat height in px |
| arms | `wave(hand=near)` | near, far or both (both = flung up, out of step, a laughing bob) |
| arms | `point(at, for=1.5)`, `reach(at, for=1.2)` | at = a place or name |
| arms | `cheer()` | both arms up |
| arms | `hold(prop, how=front)` | how = up, front, side; keeps holding |
| arms | `drop()` | the prop falls to the ground (`quiet=1`: no gesture) |
| pair | `hug(with=B, speed=1)` | a paired action: A walks up, both play their role (docs/PAIRS.md): hug, handshake, highfive, pat, shove, punchblock, punchfall, give(prop=), throwto(prop=). `speed=` or `for=` (seconds) set the length; the line occupies both actors, so either one's next `+0` waits for it; afterwards they stand apart |
| props | `pickup(prop=box)`, `sit(on=chair)`, `knock(on=door)` | walks to the prop first; grip, weight, seat, upright: docs/PROPS.md |
| face | `face(mood=neutral)` | happy, scared, determined, surprised, sad, neutral, excited, angry, tired, proud, shy |
| mood | `mood(name=neutral, strength=1)` | colours every motion until the next mood line: neutral, happy, sad, angry, scared, tired, proud, shy (`docs/ACTIONS.md`) |
| body / arms | action files | `bow`, `shrug`, `clap`, `pickup`, `stomp`, `slump`, `lookaround`, `stumble` and any file in `actions/` or the film's `actions/`: see `docs/ACTIONS.md` |
| look | `look(at=front)` | a place or name, or up, down, front, back. At a name the head aims at that actor's eyes and follows them; the pitch stays within about 25 degrees down and 30 up. It holds until the next `look`: `look(at=front)` releases it |
| look | `nod()` | |

Moving actors face the way they go. Walking speed depends on the skin's legs (about
80-130 px/s for walk); `check --timeline` shows the real end times.

**Chaining body lines.** A body line whose time falls before the previous body move has finished
is an error in `check` ("... runs until 6.02s, but this line starts ... and cuts it short"). To
chain moves write `+0` (starts the moment the previous one ends) or `+0.2` (a small pause);
use `check --timeline` to see when each move really ends.

**Speeds and timing** (a child skin of about 2.7 heads at actorScale 68; scale with actorScale):

| Move | speed=1 | speed=2 |
| --- | --- | --- |
| walk | 100 px/s | 200 px/s |
| run (top speed) | about 285 px/s | about 515 px/s (longer stride, a flight phase, more lean) |
| run 500 px, `end=stop` | 2.7 s | 2.0 s |
| run 500 px, `end=skid` (the last ~90-170 px are the skid) | 3.1 s | 2.2 s |

A run spends about 0.4 s getting up to speed (an anticipation beat, then the ramp) and 0.5 s
stopping (`end=stop`) or 1.35 s skidding and settling (`end=skid`). A jump takes about
1.1 s + 0.05 s per leg length of distance on the ground, times sqrt(height): 150 px = 1.6 s,
300 px = 1.75 s, 450 px = 1.9 s at height 1 (a leg length is about 65 px here). `turn` takes
0.48 s, `bounce(times=n)` 0.9 s + 0.4 s per bob, `wave` 1.75 s (both hands 1.9 s).

How it moves (nothing to write, but good to know): `idle`, `bounce`, `jump`, `skid`, `turn`,
the start of `run` and `wave` are played from motion clips (`clips.js`: pose keys on a time line,
splines, the head and arms trailing the hips, feet planted by contact marks). Each action
cross-fades from whatever came before, including from a running gait. On top of that the
engine simulates springs from t = 0: hair tufts, scarf, backpack and hem swing with the body's
real motion, gravity and wind; arms and head lag a little and settle; the torso squashes on
landings. Every frame is still the same whatever order you seek in. Write `+0` between body
lines: a body line that starts before the previous one has finished cuts it short.

## Wind: `wind`

| Call | Meaning |
| --- | --- |
| `gust(amount=1, over=1.5, from=right)` | a gust: rises in the first quarter of `over`, dies away by the end. amount 1 = strong (lifts hair and scarf well clear), 0.4 = a breath. `from=right` blows toward the left. |
| `blow(amount=0.3, over=1, from=right)` | a steady wind from now on, reached over `over` s; `blow(amount=0)` calms it |

Gusts add to the steady wind. Only spring chains feel the wind (sets draw their own weather).

## Puppets

A puppet does one state per line: `Pip: fly(to=branch)`. States that move need `to=`; the
others take `for=<seconds>`. `turn` flips it. States switch smoothly.

`bird` (44 px tall): `perch` (default, holds), `hop(to)` (hops along the ground), `flap`
(1.2 s), `fly(to)` (arcs through the air, 260 px/s), `peck` (1.35 s), `sing` (1.5 s). After
a timed or moving state it returns to `perch`.

## Camera: `cam`

| Call | Channel | Meaning |
| --- | --- | --- |
| `pan(to, over=1.5)` | pos | centre the camera on a place or name |
| `follow(target, over=0.8)` | pos | keep an actor or puppet centred until the next pan or cut |
| `cut(to, zoom=0)` | pos | jump instantly (zoom=0 keeps the zoom) |
| `zoom(to, over=1)` | zoom | 1 = whole frame (minimum), 1.5 = closer |
| `shake(amount=8, over=0.6)` | shake | px, dying away |
| `fade(dir=out, over=0.6)` | fade | `out` to black, `in` back |
| `frame(on, top=head, bottom=thigh, x=0.35, over=1.2)` | frame | close-up on an actor (or two: `on=Kai+Tess` keeps both whole, heads, feet and hands, for any sizes; `pad=` widens it): the frame height runs from `top` to `bottom` and the actor stands at `x` of the frame width (0 = left edge, 0.5 = centre). It tracks the actor until `home()`. Levels: head, chin, chest, waist, hip, thigh, knee, feet. `over=0` = a cut. |
| `home(over=1.2)` | frame | leave the close-up: back to the pan / zoom / follow camera, which kept running underneath |

The camera starts centred at the set's start x. It stops at the set's edges, so it can never
show past them (check warns when a pan wants to go further). The camera's height follows the
ground: zoom 1-2 shows whole actors, zoom 3 is a waist-up close-up.

Hero close-up, then pull back to the whole body: `0 cam: frame(on=Baker, top=head, bottom=thigh,
x=0.33, over=0)`, then `3.5 cam: home(over=1.4)` with a `cam: cut(to=..., zoom=2)` or `follow`
underneath it from the start.

`frame` works out (k = px per head height of the actor = the set's `actorScale` times the
actor's `scale`; levels in head heights above the ground, `head` = the actor's full height):
`zoom = 720 / (k * (top - bottom) * 1.1 + 1)`, camera x = actor x - (x * 1280 - 640) / zoom,
camera y = ground y under the actor - k * (top + bottom) / 2 (then kept inside the set).
For a child skin of about 2.7 heads, head to thigh gives zoom about 4.5-4.8 at actorScale 68.

## Text: `caption` and `card`

- `caption: "text", for=3` shows a subtitle at the bottom (`at=top` for the top). A new
  caption replaces the old one; `caption: clear` removes it.
- `caption: "Hi!", by=Kai` draws a speech bubble above an actor or puppet.
- `card: "text"` fades a full-frame end card in and keeps it to the end; `for=2` makes it a
  title card that fades out; `sub="smaller line"` adds a second line.

Keep captions under about 60 characters.

## Shared library

- Sets: `hillside` (2400 x 720). Anchors: `left` 150, `path` 480, `center` 800, `hilltop`
  1250 (top of a gentle hill), `tree` 1640 (beside the trunk), `branch` (on the tree, above
  the ground), `rock` 2050, `right` 2260. Variants: `day` (default), `dawn`, `dusk`, `night`.
  The camera starts at x=640; at zoom 1 it shows 1280 px of the set.
- Skins: `tess` (a girl with a ponytail and scarf); the demo adds `ren`.
- Puppets: `bird`. Props: `lantern` (glows; shines best at dusk and night).

## Adding your own

Copy the example file into your film folder (or the shared folder), rename, edit. Each file
registers itself on a global; everything must be a pure function of time (no state between
frames). The top comment of each example lists every field.

- **Set** (`sets/hillside.js`): `width`, `height` 720, `ground(x)` (y in px, y grows down),
  `anchors` (`x` or `[x, y]`), `actorScale` (px per head height), `camera`, `palette` +
  `variants`, and `layers` `[{ depth, draw(ctx), static, front }]` back to front. Depth 0
  never moves, 1 is the actors' ground, above 1 with `front: true` passes in front of actors.
  Draw each layer from x = -100 to `1280 + (width - 1280) * depth + 100`.
  **Zoom and depth.** For camera centre (cx, cy) in set px and zoom z, a point (px, py) of a
  layer of depth d lands on screen at `((px - Cx) * s + 640, (py - Cy) * s + 360)` with
  `Cx = 640 + (cx - 640) * d`, `Cy = 360 + (cy - 360) * d`. The scale s is `1 + (z - 1) * d`
  (default), or with the set field **`dolly: true`** (the camera moves closer instead of
  magnifying): `s = 1 / (1 - d * (1 - 1/z))` for d < 1, and `1 + (z - 1) * d` for d >= 1. So
  depth 1 and the actors always scale by z; with dolly at z = 4.8 a depth-0.5 layer grows only
  1.65x (2.9x without), depth 0.1 1.09x, the sky (depth near 0) hardly at all. A set without the
  field renders exactly as before.
- **Puppet** (`puppets/bird.js`): `height`, `initial`, `states` (`loop`, `dur` + `then`,
  `travel: 'ground'|'air'` + `speed`, or `step`/`stepLength` for hopping), `pose(state,
  since, t)` returning numbers and `render(params)` returning SVG facing right with the feet
  at (0, 0). The stage blends the numbers between states, so return the same keys from
  every state.
- **Prop** (`props/lantern.js`): SVG with the grip at (0, 0), `base` (the point that rests on
  the ground), `hang` (swings from the hand) and optional `glow`.
- **Skin**: copy `skins/kai.js` (it uses every feature below) or `skins/tess.js` (plain, no
  outline) and read "Writing a skin" below. For a recolour, write only the difference:
  ```js
  (function (g) { (g.CharSkins = g.CharSkins || {}).ren = { name: 'ren', extends: 'tess',
    palette: { hair: '#231a16', top: '#d0573f' } }; })(globalThis);
  ```

## Writing a skin

**The full skin contract is `docs/RIG.md`** (every field, defaults, garments, the `build` body from
numbers and `motion`). The quickest correct person is a skin that `extends: 'mannequin'` and sets
`build` numbers and a palette (see `films/lineup/skins/`, `films/rig-example/` and `films/recipes/`). The notes below
cover the older hand-drawn skins (kai, tess) and spring-chain recipes.

A skin is one file of plain data (`skins/<name>.js`, registered on `CharSkins`). The rig is a
side view facing right; draw everything facing right. Units are head heights (head = 1), y up.

**Fields.** `name`; `proportions` (bone lengths: head 1, neck, torso, shoulderDrop, upperArm,
foreArm, thigh, shin, ankleHeight, heel/toe pivots and `footGround` contact points in the foot
frame, `radius`); `headTop` (top of the hair above the head origin, for height and framing);
`outline` (ink width in head units: 0 = flat, 0.022 thin, 0.035-0.045 thick and bold); `farShade`;
`palette` (`'<key>Shade'` = the darker tone of a key; `outline` = ink colour); `parts`; `swaps`
(hand: relaxed, fist, open, point, grip; eye: open, wide, narrow, closed, happy, sad; brow;
mouth: neutral, smile, open, o, worried, grit, sad); `chains`; `springs`; `grip`; `handZ`.

**Frames for parts.** torso and pelvis: origin = pelvis, x forward, y up (the torso runs up to
y = proportions.torso, the neck starts there). neck: origin = neck base. head: origin = top of
the neck. foot: origin = ankle, x along the sole. Hand swaps: origin = wrist, x along the
fingers. Per-bone limb parts (upperArm, foreArm, thigh, shin): x 0..1 along the bone. Entries:
`{ d, fill }`, `{ d, stroke, w }`, `{ cap: [r0, r1], from, to, inset, fill }`, `{ swap: 'eye' }`.

**Soft limbs (no hinge).** `parts.arm` and `parts.leg` draw a whole limb as one continuous tube
through the joint, with one unbroken outline and a soft crease inside the bend:
`{ tube: [rShoulder, rElbow, rWrist], fill }` (leg: hip, knee, ankle). `from`/`to` are fractions
of the whole limb length (0 = shoulder or hip, 1 = wrist or ankle; above 1 runs on past the
end), so a sleeve is `{ tube: [...], to: 0.3, flat: 'end', fill: 'top' }`, a boot
`{ tube: [...], from: 0.78, to: 1.01, flat: 'start', fill: 'shoe' }`. `flat`: 'start' | 'end' |
'both' cuts the end straight. `inset: -0.35` = the shade strip along the back edge (+ = front).
Per-bone parts still draw on top (seams, laces). Use these instead of per-bone `cap`s.

**Torso.** Draw the torso part in its frame as usual: the engine bends it along a short spine
and squashes or stretches it keeping its area (on landings, crouches, sudden stops), so draw it
as one or a few closed paths, not many small pieces near the top and bottom edges. Points above
y = torso follow the chest, points below 0 follow the hips. Torso-anchored chains move with it.

**Spring chains** (`chains: { name: {...} }`, drawn in the order written). Each chain is a row of
segments hanging from a bone, simulated with the body's real motion, gravity, air drag and wind,
and drawn as one tapered ribbon:

| Field | Meaning |
| --- | --- |
| `bone` | head, neck, torso or pelvis |
| `at` | anchor in that bone's frame |
| `rest` | direction at rest in degrees in the bone frame (0 = forward, 90 = up, 180 = straight back, 270 = straight down) |
| `curl` | extra bend per segment, degrees (+ curls up/counter-clockwise) |
| `seg` | segment lengths, e.g. `[0.12, 0.1]` |
| `width` | ribbon width at each point (one more than `seg`), e.g. `[0.12, 0.08, 0.02]` |
| `fill`, `shade`, `shadeSide` | colour; shade strip width 0..1 along one side (1 = back side) |
| `layer` | draw layer: `back` (behind everything), `arm.far`, `leg.far`, `pelvis`, `leg.near`, `neck`, `torso`, `head` (over the face), `arm.near`, `front` |
| `tip` | how far the tip pokes past the last point |
| `stiff` | 0 = loose cloth, 0.3 = a scarf tail, 0.4-0.5 = springy hair tufts, 0.6-0.7 = a stiff hem; 1 = rigid (no simulation: a sword) |
| `limit` | most degrees it may swing from rest (default 120; 60-80 keeps a tuft off the face, 15-25 for a hem) |
| `gravity` | 1 = normal (default), 0 = weightless. The drawn rest shape is where it settles when standing still |
| `drag`, `wind`, `inertia` | air damping (default 4 + 2 stiff), how much it catches the wind (1), how hard it swings from the body's starts and stops (0.6; 1 = full) |
| `freq` | override the spring (Hz); default 0.8 + 4 * stiff |
| `end`, `endUpright` | a part drawn at the tip. Without `endUpright` its x axis runs along the last segment; with `endUpright: true` it is drawn in the bone's upright frame (x forward, y up), turned only as far as the chain swings: use this for a backpack or pouch |

Recipes (see `skins/kai.js`):
- *Several hair tufts*: one chain per tuft on `bone: 'head'`, each its own `at`, `rest`, `curl`,
  `seg` (2 segments) and tapering `width` ending near 0, `stiff` 0.35-0.5, `limit` 60-80. Tufts
  behind the head go on layer `back`, tufts over the crown or fringe on `head`. Mix `hair` and a
  second colour (e.g. orange tips) by giving tufts different fills. Keep the main hair mass a
  head part; the tufts are what moves.
- *Bunched scarf with a tail*: draw the bunched wrap in the torso part (a few overlapping
  rounded paths at y = torso .. torso + 0.15, with a shade path); add a tail chain on
  `bone: 'torso'` at the back of the wrap, `rest` 220-235, 3-4 segments, `stiff` 0.1-0.2,
  layer `back`; a short second chain for the knot ends if you like.
- *Backpack bouncing on its strap*: draw the strap across the chest in the torso part; add a
  chain on `bone: 'torso'` at the shoulder blade, `rest` about 265, one short segment (the strap
  drop, 0.08-0.12) with a thin `width`, `stiff` 0.3, `limit` 40, layer `back`, and the pack
  itself as `end` with `endUpright: true` (drawn hanging below the origin: y from 0 down to
  about -0.4).
- *Skirt or tunic hem that sways*: the dress top in the torso part ends at the hip line; the
  skirt is a wide, short chain: `bone: 'torso'`, `at: [0, -0.1]`, `rest: 268`, `seg` two of
  0.07-0.09, `width` the skirt width at each point (widening, e.g. [0.5, 0.56, 0.62]),
  `stiff` 0.6-0.7, `limit` 15-25, layer `torso`, a `shade` strip, and the darker hem band as
  `end` with `endUpright: true` (a stroke or thin path across y = 0).
- *Thick ink outline*: `outline: 0.04` and `palette.outline: '#3a2418'` (dark brown). Every
  part, tube and chain gets it; inner seams vanish because fills are drawn over all outlines of
  the same layer.

**Body springs.** `springs: { arms: 1, head: 1, torso: 1 }` sets how much the arms lag and
settle, the head nods on impacts and the torso squashes and bends against starts and stops
(0 = off, 1 = default, 2 = rubbery). Leave it out for the default 1.

**Check a new skin** with a little film (idle, jump, `run(..., end=skid)`, turn, wave and a
`wind: gust`): `check`, then `sheet --from --to` strips around the jump and the skid.

## Rules of thumb

- Give every actor something every 4 seconds or less (check warns otherwise).
- An actor must be inside the frame when it acts: pan or `follow` first.
- Put a prop where the hand will be when `hold` starts; walk the actor next to it first.
- Leave 0.5 s between big actions; a 30 s film is usually 15-30 timed lines.
