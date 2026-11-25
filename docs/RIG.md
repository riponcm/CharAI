# RIG.md: the CharAI skin contract

A **skin** is one JavaScript file of plain data that tells CharAI what a character looks
like. CharAI owns the skeleton and all motion; the skin only says how big the body is, what
it is like to move, and what to draw on each bone. This file is the complete reference: every
field, which ones are required, and every default.

## 1. The file

```js
// skins/<name>.js   (or films/<film>/skins/<name>.js, which wins for that film)
(function (g) {
  (g.CharSkins = g.CharSkins || {}).NAME = { name: 'NAME', /* fields below */ };
})(typeof self !== 'undefined' ? self : this);
```

`name` must equal the file name and the key. A film uses it with
`actor Mia = skin NAME at 400 [scale=1]`.

## 2. Units and frames

- **Unit: head heights.** 1 = the height of the head. All lengths, radii and path coordinates
  are in head heights; the stage converts (px per head = the stage `scale` times the actor's
  `scale=`; default 68 px).
- **Side view, facing right.** +x is forward (the way the character faces), **+y is up**,
  angles are degrees counter-clockwise from +x. Draw everything facing right; the engine
  mirrors it.
- **Frames (`parent` and `pivot`).** Every part is drawn in the frame of the bone it is
  attached to; the part's key names that bone (its parent), the frame origin is the pivot,
  and the frame turns with the bone (its rotation):

| Part key | Origin (pivot) | Axes, scale |
| --- | --- | --- |
| `head`, `hair`, `hairBack` | top of the neck (the jaw hinge) | x forward, y up; the head spans y = 0..1 |
| `neck` | base of the neck | x forward, y up |
| `torso` | the pelvis (hip joint level) | x forward, y up; the torso runs y = 0..`proportions.torso`. The engine bends and squashes this frame (spine), so draw closed shapes |
| `pelvis` | the pelvis | x forward, y up |
| `arm`, `leg` | whole limb | a tube through shoulder-elbow-wrist or hip-knee-ankle (see 5) |
| `upperArm`, `foreArm`, `thigh`, `shin` | the upper joint | x runs 0..1 along the bone, y across it in head units times bone length |
| `foot` | the ankle | x along the sole (forward), y up; the sole is at y = -`ankleHeight` |
| hand swaps, `hand`, `holdNear`, `holdFar` | the wrist | x along the fingers, +y = thumb side |

**Which way is the back.** -x is always the back: a backpack, a ponytail or a hood hangs at
negative x; the face, toes and belly are at positive x.

**Frame sizes for a generated body** (`build` only; read them off this table or from
`proportions` if you set it):

| heads | torso height | shoulder below torso top | thigh | shin | ankle height | upper arm | forearm | hand | foot | chest depth | hip depth |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.2 | 0.40 | 0.10 | 0.32 | 0.30 | 0.08 | 0.22 | 0.20 | 0.20 | 0.42 | 0.52 | 0.52 |
| 3 | 0.84 | 0.13 | 0.48 | 0.44 | 0.10 | 0.33 | 0.29 | 0.26 | 0.51 | 0.58 | 0.57 |
| 4 | 1.36 | 0.16 | 0.70 | 0.64 | 0.12 | 0.49 | 0.43 | 0.33 | 0.62 | 0.65 | 0.63 |
| 5 | 1.82 | 0.20 | 0.94 | 0.87 | 0.15 | 0.66 | 0.59 | 0.40 | 0.74 | 0.73 | 0.68 |
| 6 | 2.23 | 0.23 | 1.22 | 1.12 | 0.17 | 0.86 | 0.76 | 0.48 | 0.85 | 0.80 | 0.74 |
| 7 | 2.59 | 0.27 | 1.51 | 1.40 | 0.20 | 1.07 | 0.95 | 0.55 | 0.97 | 0.88 | 0.80 |
| 8 | 2.90 | 0.30 | 1.84 | 1.70 | 0.22 | 1.30 | 1.16 | 0.62 | 1.08 | 0.95 | 0.86 |

The torso frame runs from y = 0 (hip line) to y = torso height (base of the neck); its front edge
is at about +depth/2 and its back at -depth/2 (plus `belly` at the front around 0.36 of the
height, `seat` at the back near 0). A cover's `[from, to]` uses fractions of this height.

**The generated head** (head frame, W = `build.headWidth`): eye centre (0.3 W, 0.55), brow just
above it (0.3 W, 0.68), mouth (0.38 W, 0.24), ear centre (-0.06 W, 0.5), jaw line from the chin
(0.14 W, 0.02) to (0.32 W, 0.12), nose tip (0.52 W, 0.47), top of the skull y = 1.02, back of the
skull x = -0.53 W. The hair cap covers the top and back, from (-0.48 W, 0.66) over the crown to
(0.43 W, 0.76). A hat sits on y = 0.95-1.05; glasses at the eye height.

## 3. Top-level fields

| Field | Required | Default | Meaning |
| --- | --- | --- | --- |
| `name` | yes | | the skin's name |
| `extends` | no | | name of a skin to start from; this skin's keys replace or (for `palette`, `proportions`, `build`, `motion`, `parts`, `swaps`, `chains`, `springs`) merge into its keys. `extends: 'mannequin'` is the normal start |
| `build` | no (yes for a generated body) | see 4 | the body from numbers. With `build`, the engine draws a whole body and the skin adds to it |
| `motion` | no | `{ weight: 0.3, energy: 0.5, age: 'adult', posture: 0 }` | how the body moves (see 6) |
| `proportions` | no | from `build.heads`, else the default figure (about 3.4 heads) | bone lengths (see 4) |
| `headTop` | no | 1.04 | top of the hair above the head origin (height, framing) |
| `outline` | no | 0.03 with `build`, else 0 | ink line width in head units (0 = flat; 0.04 = bold) |
| `farShade` | no | 0.85 | the far arm and leg are darkened by this factor |
| `palette` | no | the mannequin's | colour names to `#rrggbb` (see 7) |
| `parts` | no | the generated body | what to draw on each bone (see 5) |
| `swaps` | no | generated faces and hands | drawings that change with the action or mood (see 8) |
| `chains` | no | | spring chains: hair locks, scarf tails, backpacks, hems (see 9) |
| `springs` | no | `{ arms: 1, head: 1, torso: 1 }` | body overlap: arms lag, head nods, torso squashes (0 = off, 2 = rubbery) |
| `grip` | no | [0.1, 0] | where a held prop sits, in the hand frame |
| `handZ` | no | 1 | 1 = hand over the forearm, -1 = under it |

## 4. `build`: a body from numbers

`build.heads` sets the height and, with it, defaults for everything else; any other number
overrides one default. Only `heads` and `muscle` are clamped; other numbers outside the range still draw but look wrong. Depths are side-view thicknesses (front to back), radii are limb radii,
all in head heights. With u = (heads - 2.2) / 5.8, clamped to 0..1, each default is
`toddler + (adult - toddler) * u`:

| Field | Default at 2.2 heads | at 8 heads | Sensible range | Meaning |
| --- | --- | --- | --- | --- |
| `heads` | | | 2.2 .. 8 (the engine clamps to 2 .. 9) | total height in head heights, 2.2 (toddler) to 8 (tall adult); default 3 |
| `legs` | 0.32 | 0.47 | 0.28 .. 0.52 | share of the height that is leg (sole to hip) |
| `arms` | 0.28 | 0.385 | 0.25 .. 0.45 | share of the height that is arm (shoulder to fingertip) |
| `neck` | 0.075 | 0.11 | 0.05 .. 0.2 | neck radius |
| `neckLength` | 0.06 | 0.3 | 0 .. 1.2 | neck length (base to jaw); a longer neck shortens the torso so the height stays `heads` |
| `shoulders` | 0.5 | 0.92 | 0.4 .. 1.3 | torso depth at the shoulders |
| `chest` | 0.52 | 0.95 | 0.4 .. 1.3 | torso depth at the chest |
| `waist` | 0.5 | 0.78 | 0.35 .. 1.3 | torso depth at the waist |
| `hips` | 0.52 | 0.86 | 0.4 .. 1.3 | torso depth at the hips |
| `belly` | 0.07 | 0 | 0 .. 0.7 | extra forward bulge of the belly (0.5 = very fat) |
| `seat` | 0.03 | 0.06 | 0 .. 0.2 | backward bulge of the bottom |
| `bust` | 0 | 0 | 0 .. 0.15 | forward bulge of the chest (0.05-0.1) |
| `arm` | 0.08 | 0.2 | 0.05 .. 0.3 | upper-arm radius (elbow 0.76x, wrist 0.58x) |
| `leg` | 0.135 | 0.31 | 0.1 .. 0.45 | thigh radius (knee 0.68x, ankle 0.49x) |
| `muscle` | 0 | 0 | 0 .. 1 (clamped) | 0..1: thicker arms (+45%) and legs (+30%), deeper chest and shoulders |
| `hand` | 1 | 1 | 0.6 .. 1.5 | hand size factor (hand length is 0.2 head at 2.2 heads, 0.62 at 8) |
| `foot` | 1 | 1 | 0.6 .. 1.5 | foot size factor (foot length 0.42 head at 2.2, 1.08 at 8) |
| `headWidth` | 0.96 | 0.8 | 0.7 .. 1.1 | front-to-back size of the generated head |
| `hide` | [] | | list | generated groups to leave out: any of `head` (the whole generated head with its face and hair cap), `hair` (only the hair cap: bald), `neck`, `torso`, `pelvis`, `arm`, `leg`, `foot` |

Typical bodies: toddler `{ heads: 2.3 }`; child `{ heads: 3.5 }`; teen `{ heads: 6.2 }`; adult
`{ heads: 7.5 }`; fat `{ belly: 0.55, chest: 1.05, waist: 1.0, hips: 0.98, arm: 0.17, leg: 0.3 }`;
thin `{ chest: 0.72, waist: 0.52, hips: 0.78, arm: 0.1, leg: 0.16 }`; muscular `{ muscle: 1, shoulders: 1.05 }`.

`proportions` (optional, overrides what `build` derives; required numbers if a skin has no
`build`): `head` 1, `neck`, `torso`, `shoulderDrop` (shoulder below the torso top),
`upperArm`, `foreArm`, `thigh`, `shin`, `ankleHeight`, `heel` and `toe` (pivots in the foot
frame), `footGround` (contact points in the foot frame), `farShoulder` ([x, y] offset of the
far shoulder), `radius` (`hip`, `knee`, `shoulder`, `elbow`, `wrist`, `neck`, `hem`).

**What the generated body draws** (palette names in brackets): arm and leg tubes [skin,
skinShade], a torso and pelvis in a plain body suit with short legs [suit, suitShade], a neck
[skin], shoes [shoe, sole], a plain head with ear, cheek, a hair cap [hair] and face swaps, and
hand swaps sized to the body. Everything the skin's own `parts` give for a group is drawn **on
top of** the generated group, so garments go straight on. A skin that gives `parts.head`
replaces the generated head; `swaps.eye` (etc.) replace that generated swap.

## 5. `parts`

`parts` maps a part key (2) to one entry or a list of entries, drawn in order. Entry kinds:

| Entry | Meaning |
| --- | --- |
| `{ d, fill, opacity }` | a filled SVG path in the part's frame (`M L C Q A Z`, absolute or relative) |
| `{ d, stroke, w }` | a stroked path, width `w` head units, round caps |
| `{ swap: 'eye' }` | draw the current eye / mouth / brow swap here (head only; added at the end if missing) |
| `{ tube: [r0, r1, r2], from, to, flat, inset, fill }` | (`arm`, `leg`) a soft limb: one continuous shape through the joint, radii at the three joints. `from`/`to` = fractions of the limb length (0 = shoulder or hip, 1 = wrist or ankle, up to 1.1). `flat`: 'start', 'end' or 'both' cuts an end straight. `inset: -0.35` = a strip along the back edge (+ = front) |
| `{ cap: [r0, r1], from, to, inset, fill }` or `{ cap: [r0, rMid, r1], mid, ... }` | (`upperArm` .. `shin`) a tapered capsule on one bone; with 3 radii `mid` (default 0.45) is where the middle radius sits along the bone |
| `{ ..., upright: true }` | (`holdNear`, `holdFar` only) draw this entry in an upright frame at the grip point instead of the hand frame, so it hangs straight down whatever the hand does (a lantern, a bag) |
| `{ ..., use: 'cane', length }` | (`holdNear` only) a walking stick: planted in step with the walk, carried in other actions (see the recipe) |

**Hands and held objects.** `parts.hand` replaces the hand swaps for **both** hands with one
fixed drawing (a mitten or a hook); usually leave it out and let the swaps change. `parts.holdNear`
and `parts.holdFar` draw an object in that hand through every action (hand frame, or
`upright: true`); the hand closes to `grip` while it holds, unless an action shapes the hand.
The grip point is `grip` (default [0.1, 0] in the hand frame).

**Garments** (they need `build`; they follow the body's own shape, so they fit any numbers):

| Garment | Entry | Examples |
| --- | --- | --- |
| sleeve, cuff, glove | `arm: { cover: [from, to] or true, loose, fill, flat, inset }` (0 = shoulder, 1 = wrist) | short sleeve `[0, 0.3]`, long sleeve `[0, 0.95]` |
| shorts, trousers, socks, boots | `leg: { cover: [from, to] or true, loose, fill, flat, inset }` (0 = hip, 1 = ankle) | shorts `[0, 0.35]`, trousers `[0, 1]`, boots `[0.78, 1.02]` |
| top, bodice, coat body | `torso: { cover: [from, to], loose, fill }` or `cover: true` | from/to = fractions of the torso height (0 = hip line, 1 = shoulders; `true` = the whole torso, -0.06 .. 1.1) |
| skirt, dress, kilt, robe | `skirt: { skirt: true, length, top, flare, loose, fill, shade, hem: { fill, w } }` | see below |

`loose` is extra thickness in head units (default 0). A cover drawn twice with `inset` gives
its shade strip. Covers are drawn in the order written, so a later cover lies on an earlier one
(a cardigan over a shirt). A torso cover stops at the hip line; anything that hangs lower (a
coat tail, a long apron, a tunic) is a `skirt`, because only the skirt bends at the hip and
follows the thighs when the body sits.

**Skirt.** Cloth from the waist round **both** legs down to `length` (0 = at the hips,
0.5 = knee, 1 = ankle, fraction of the leg), drawn over the legs. It is traced every frame from
the legs' real positions: it hangs and curves in slowly below the widest point, lies over the
thighs and shins when the body sits, widens with the stride but only as far as the cloth allows
(in a long run the lower legs come out from under the hem), and its hem trails on a spring (wind
moves it too). A skirt also makes coat tails, a long apron (`top: 0`) or a tunic skirt. `top` = waist height as a fraction of the torso (default 0.38); `flare` = how far the
hem spreads past the legs, as a fraction of the skirt length (default 0.15; 0.25-0.35 for a
long full dress); `loose` = ease round the legs (default 0.04); `shade` = a **colour name** for the far
leg's half (optional; note a chain's `shade` is a number); `hem` = a band along the hem (optional). Draw the bodice with
`torso: { cover: [0.3, 1.1], fill }` in the same colour. Below the hem the legs and shoes show.

**Draw order (`layer`)**, back to front: `back`, `arm.far`, `leg.far`, `pelvis`, `leg.near`,
`neck`, `torso` (skirt, then torso parts), `head` (head, then `hair`), `arm.near`, `front`.
Inside a layer the ink outline of every shape is drawn first and all fills after, so shapes of
one layer merge without seams. Parts of one key are drawn in the order written; chains come
after the parts of their layer. `back` is behind the whole body: something on that layer shows
only where it sticks out past the body's outline.

## 6. `motion`

| Field | Default | Effect |
| --- | --- | --- |
| `weight` | 0.3 | 0 light .. 1 heavy: slower starts and stops, lower jumps, less bounce, more squash and jiggle of the torso |
| `energy` | 0.5 | 0 tired .. 1 lively: cadence, bounce, arm swing, jump height, quicker actions |
| `age` | 'adult' | 'baby' toddles (short quick steps, arms held out, leaning back), 'child', 'adult', 'elder' (shorter slower steps, no flight in a run, low jumps, a stoop) |
| `posture` | 0 (0.5 for elder) | -1 proud .. 1 stooped: rounded back, neck forward, head up |

Always on, from the body's own numbers: stride in leg lengths and cadence slower for longer
legs; jump height in leg lengths; hands are kept out of the head and out of the chest and belly
(they rest over the front of a big belly, or are held out when the arms are short); feet stand on
the ground. Every action in `docs/AUTHORING.md` works from 2.2 to 8 heads and thin to obese.

## 7. `palette`

Colour names used by parts. Any `<name>Shade` that is not in the palette is made
automatically by darkening `<name>` by `palette.shade` (default 0.82), so `jeansShade` works as
soon as `jeans` exists. A fill may also be a literal `#rrggbb`; an unknown name draws magenta.

The generated body uses: `skin`, `skinShade` (limbs, neck, face), `suit`, `suitShade` (the
plain body suit on torso, pelvis and the top of the legs: it is **grey** (#8a94a6) unless you
set it, and shows at the neck, shoulders and hips wherever your garments leave gaps, so set
`suit` to the colour of the main garment or the skin; `suitShade` and `skinShade` follow
`suit` and `skin` automatically unless you set them), `shoe`, `sole`, `hair` (the generated
hair cap and the brows), `eye`, `white` (eye highlights, teeth), `mouth`, `cheek`, and
`outline` (the ink line).

## 8. `swaps`

Named drawings the engine picks per frame. Kinds and the names actions ask for (a missing name
falls back to the first one):

| Kind | Frame | Names |
| --- | --- | --- |
| `hand` | hand frame | `relaxed`, `fist`, `open`, `point`, `grip`, `thumb` (thumb up) |
| `eye` | head frame | `open`, `wide`, `narrow`, `closed`, `happy`, `sad` (an entry with `look: 1` follows the gaze) |
| `brow` | head frame | `neutral`, `up`, `down`, `worried` |
| `mouth` | head frame | `neutral`, `smile`, `open`, `o`, `worried`, `grit`, `sad` |

Syntax: each kind maps names to one entry or a list of entries (any part entry kind); brows
are strokes in the head frame just above the eye (the generated ones sit at y = 0.67-0.72):

```js
swaps: {
  eye: {
    open:   [{ d: 'M0.24 0.55A0.05 0.07 0 1 0 0.34 0.55A0.05 0.07 0 1 0 0.24 0.55Z', fill: 'eye', look: 1 },
             { d: 'M0.3 0.58A0.015 0.015 0 1 0 0.33 0.58A0.015 0.015 0 1 0 0.3 0.58Z', fill: 'white', look: 1 }],
    closed: { d: 'M0.24 0.56Q0.29 0.52 0.34 0.56', stroke: 'eye', w: 0.022 },
    happy:  { d: 'M0.24 0.54Q0.29 0.6 0.34 0.54', stroke: 'eye', w: 0.026 },
  },
  brow: { neutral: { d: 'M0.22 0.67Q0.28 0.7 0.36 0.68', stroke: 'brow', w: 0.035 },
          up:      { d: 'M0.22 0.71Q0.28 0.75 0.36 0.72', stroke: 'brow', w: 0.035 },
          down:    { d: 'M0.21 0.7Q0.28 0.69 0.37 0.63', stroke: 'brow', w: 0.04 },
          worried: { d: 'M0.22 0.65Q0.28 0.67 0.35 0.72', stroke: 'brow', w: 0.034 } },
  mouth: { neutral: { d: 'M0.33 0.24Q0.37 0.235 0.41 0.25', stroke: 'mouth', w: 0.02 },
           smile:   { d: 'M0.32 0.27Q0.36 0.2 0.42 0.25', stroke: 'mouth', w: 0.022 } },
}
```

A skin's swaps replace the generated ones kind by kind (giving `eye` keeps the generated
mouth and brows). Where they draw: the `{ swap: 'eye' }` entries in `parts.head`, or on top
of the head if `parts.head` has none.

## 8b. Face swaps (expressions and speech)

All face swaps are drawn in the head frame (origin top of the neck, x forward, y up, 1 = head
height). On the generated head the mouth is at (0.38 W, 0.24), the eye at (0.3 W, 0.55), the brow
at y 0.67-0.72 (W = `build.headWidth`, about 0.8-0.95). On a **drawn profile head** measure from
F, the x of the face's front edge at that height (the cheek line, not the nose tip): mouth centre at
(F - 0.15, 0.18-0.22), eye centre at (F - 0.2, 0.55-0.6), brow centred over the eye at y 0.68-0.72
and 0.14 wide. A head whose face edge is at 0.4 therefore wants the mouth near (0.25, 0.21), not
(0.38, 0.24), which would float in front of the lips. Check with `node tools/say.cjs out.png
--skin=films/<film>/skins/<name>.js --shapes`.

| Kind | Names the engine asks for | When |
| --- | --- | --- |
| `mouth` | `rest`, `mbp`, `ah`, `ee`, `oh`, `oo`, `fv`, `l`, `wq` | speaking (`docs/SPEECH.md`) |
| `mouth` | `neutral`, `smile`, `open`, `o`, `worried`, `grit`, `sad` | faces and moods, and action keys (`mouth: 'o'`) |
| `eye` | `open`, `closed`, `wide`, `narrow`, `happy`, `sad` | blinks use `closed`; moods use the others |
| `brow` | `neutral`, `up`, `down`, `worried` | moods; lifted a little on spoken emphasis |

**Fallbacks.** A missing name never breaks a face. Eyes and brows fall back to `open` and
`neutral`; mood mouths to `neutral` or `smile`; a missing speech mouth to the nearest shape the
skin has, scaled about its centre (`ah` -> `open`, `ee` -> `grit` or a squashed `open`,
`oh` -> `o` or a narrowed `open`, `oo`/`wq` -> each other, `o` or a small `open`, `fv` ->
`grit` or closed, `l` -> a squashed `open`, `rest`/`mbp` -> `neutral` or `closed`). The
smallest set that talks: `open` and `closed` (or `neutral`). Recommended: the seven mood mouths;
best: all nine speech mouths as well. The swap name `closed` is a synonym the fallbacks know for
a shut mouth.

**The generated face** (a skin with `build` that gives no `swaps.mouth`, `swaps.brow` or eye
swaps of its own) is drawn from numbers instead: a mouth from open, width and roundness with
teeth and tongue, a smile-to-frown blend, brows with height and angle, and upper lids that
close by degrees. A skin that gives `swaps.mouth` keeps the generated brows and eyes, and the
other way round (each kind is replaced on its own).

**Beards.** A `parts.head` or `parts.hair` piece moves with the jaw while speaking exactly when
the box of its path's points (control points included) has bottom below y 0.12, top below 0.62,
height at least 0.12 and vertical centre below 0.32. A beard reaching the chin passes. A
moustache (bottom above 0.12) does not: it stays on the upper lip, as a real one does, and so does
anything reaching above 0.62 (hair joined to a beard). Draw a beard as its own path, separate from
the hair and the moustache, so it is found.

Swap syntax is as in section 8: `mouth: { ah: { d, fill }, mbp: { d, stroke, w }, ... }`, one
entry or a list per name. Keep each mouth in the same place so that changes do not jump.

## 9. `chains` (springs)

Hair locks, scarf tails, backpacks, hems: simulated from t = 0 with gravity, drag, wind and the
body's real motion. Fields: `bone` (head, neck, torso, pelvis), `at` (anchor in that frame),
`rest` (degrees: 0 forward, 90 up, 180 back, 270 down), `curl`, `seg` (lengths), `width` (one
more than `seg`), `fill`, `shade`, `shadeSide`, `layer`, `tip`, `stiff` (0 loose .. 1 rigid),
`limit` (max swing in degrees, default 120), `gravity` (1), `drag`, `wind` (1), `inertia`
(0.6), `freq`, `end` + `endUpright` (a part at the tip, e.g. a backpack). `shade` here is a
number 0..1 (the width of a darker strip). Details: `docs/AUTHORING.md`, "Spring chains".

**Layer for small hanging things.** The default `layer` is `back`, which is drawn behind the
whole body, so a short chain that hangs inside the body's outline (an earring, a strand over
the shoulder) is hidden. Use `layer: 'head'` for things on the head or face (earrings, a
fringe), `layer: 'torso'` for things lying on the back or chest (a braid down the back, a
necklace pendant, straps), and `back` only for things that hang out behind the body (a
ponytail, a cape, a backpack).

## 10. Minimal skins

A person from numbers only (this is already correct and well shaped):

```js
(function (g) {
  (g.CharSkins = g.CharSkins || {}).nora = { name: 'nora', extends: 'mannequin',
    build: { heads: 7, chest: 0.8, waist: 0.6, hips: 0.85 },
    motion: { energy: 0.7 },
    palette: { suit: '#3f6fa8', hair: '#5a3a28' } };
})(typeof self !== 'undefined' ? self : this);
```

The same person dressed: a T-shirt, jeans, boots, a ponytail and a skirt-free look:

```js
(function (g) {
  (g.CharSkins = g.CharSkins || {}).nora = { name: 'nora', extends: 'mannequin',
    build: { heads: 7, chest: 0.8, waist: 0.6, hips: 0.85 },
    motion: { energy: 0.7 },
    palette: { shirt: '#e2574c', jeans: '#3d5a8a', boot: '#5a3a28', hair: '#5a3a28' },
    parts: {
      torso: { cover: true, loose: 0.02, fill: 'shirt' },
      arm: { cover: [0, 0.3], loose: 0.02, flat: 'end', fill: 'shirt' },
      leg: [{ cover: [0, 1], loose: 0.02, fill: 'jeans' }, { cover: [0, 1], loose: 0.02, inset: -0.35, fill: 'jeansShade' },
        { cover: [0.8, 1.02], loose: 0.03, flat: 'start', fill: 'boot' }],
      hair: { d: 'M-0.5 0.6C-0.55 1.0 0.1 1.15 0.42 0.82C0.2 0.9 -0.1 0.85 -0.3 0.7Z', fill: 'hair' },
    },
    chains: { tail: { bone: 'head', at: [-0.45, 0.85], rest: 200, seg: [0.25, 0.22], width: [0.16, 0.14, 0.04],
      fill: 'hair', layer: 'back', stiff: 0.35 } } };
})(typeof self !== 'undefined' ? self : this);
```

## 11. Recipes

All in one skin that `extends: 'mannequin'`; coordinates for a 6-7 head body (scale by the
tables in 2).

- **Hat**: `hair: { d: 'M-0.55 0.92C-0.5 1.3 0.45 1.3 0.5 0.92Z', fill: 'hat' }` plus a brim
  `{ d: 'M-0.62 0.9L0.62 0.9L0.6 0.97L-0.6 0.97Z', fill: 'hatShade' }`. Add `build.hide: ['hair']`
  so the generated hair cap does not show under the brim, and draw any hair you want below the hat.
- **Moustache and brows**: in `parts.hair` (it is drawn over the face):
  `{ d: 'M0.24 0.26C0.34 0.32 0.48 0.3 0.54 0.22C0.44 0.2 0.32 0.18 0.24 0.26Z', fill: 'stache' }`;
  thick brows: `swaps.brow` with strokes of `w: 0.06` at y 0.68.
- **Glasses**: `parts.hair` entries `{ d: 'M0.24 0.55A0.08 0.08 0 1 0 0.4 0.55A0.08 0.08 0 1 0 0.24 0.55Z', stroke: 'frame', w: 0.02 }`
  and an arm `{ d: 'M0.24 0.55L-0.04 0.52', stroke: 'frame', w: 0.018 }`.
- **Apron**: a bib `torso: { cover: [0.35, 0.8], loose: 0.05, fill: 'apron' }` (after the shirt)
  and a `skirt: { skirt: true, top: 0, length: 0.55, fill: 'apron' }`.
- **Open cardigan or coat over a shirt**: `torso: [{ cover: true, fill: 'shirt' },
  { cover: true, loose: 0.04, fill: 'coat' }, { d: <a strip down the front, x from 0.15 to front>, fill: 'shirt' }]`;
  long coat tails: `skirt: { skirt: true, top: 0.25, length: 0.45, flare: 0.1, fill: 'coat' }`.
- **Hood and pocket**: hood down = a chain-free shape in `hairBack` behind the head
  (`{ d: 'M-0.2 0.1C-0.7 0.1 -0.75 0.7 -0.4 0.8L-0.1 0.4Z', fill: 'hoodie' }`); pocket = a torso path
  over the cover around y = 0.2-0.35 of the torso height, x near the front.
- **Backpack**: a strap path on the torso cover, and a chain
  `{ bone: 'torso', at: [-0.4, 0.8 * torsoHeight], rest: 265, seg: [0.1], width: [0.04, 0.04],
  fill: 'strap', layer: 'back', stiff: 0.3, limit: 40, endUpright: true, end: { d: <pack drawn
  hanging below 0, at negative x>, fill: 'pack' } }`.
- **Earrings**: a chain `{ bone: 'head', at: [-0.06, 0.4], rest: 270, seg: [0.06, 0.05],
  width: [0.02, 0.02, 0.02], fill: 'gold', layer: 'head', stiff: 0.2, end: { d: 'M0 -0.04A0.04 0.04 0 1 0 0 0.04A0.04 0.04 0 1 0 0 -0.04Z', fill: 'gold' } }`.
- **Held object**: a walking stick
  `holdNear: { use: 'cane', length: 2.6, d: 'M-0.025 0.05L0.025 0.05L0.025 -2.6L-0.025 -2.6Z', fill: 'wood' }`
  (drawn hanging down from the grip, `length` = its length, about 0.45 x heads). With
  `use: 'cane'` the engine plants its tip beside the near foot and steps it with the walk while
  standing or walking (the hand holds its top), and carries it held out forward in runs,
  jumps, gestures and sitting, never into the ground. A bag or lantern that hangs straight:
  `holdFar: { upright: true, d: <drawn hanging below 0>, fill }`; a mug in the hand frame:
  `holdNear: { d: 'M0.08 -0.06L0.22 -0.06L0.22 0.1L0.08 0.1Z', fill: 'mug' }`.

## 12. Errors

A skin with a JavaScript syntax error does not load: `node tools/check.cjs films/<film>` prints
`ERROR line 0: films/<film>/skins/<name>.js fails to load: <the JavaScript message>` and, because
the skin is then missing, an error on the `actor ... = skin <name>` line. An unknown colour name
draws magenta; an unknown part key or field is ignored (`tools/skincheck.cjs` reports it).

## 13. Glossary (common names)

part key = the **parent** bone; frame origin = the **pivot**; the frame's angle = the bone's
**rotation**, set by the engine; `layer` = draw order; `parts` = the drawings.
