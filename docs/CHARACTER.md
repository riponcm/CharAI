# CHARACTER.md: draw a character for CharAI

You write ONE file, a **skin**: numbers for the body and SVG paths for what is distinctive (head,
hair, clothes, accessories). CharAI supplies skeleton, motion and the physics of hair and cloth.
Full fields and recipes: `docs/RIG.md`. Follow this page in order.

## Commands

```
node tools/skincheck.cjs skins/mia.js          # rules check; fix every ERROR it prints
node tools/cast.cjs skins/mia.js mia.png       # picture: standing, walk, run, jump, wave, sit
```

Check after every edit; cast and LOOK at the whole picture after every step. Both accept
`films/<film>/skins/mia.js`.

## Units and directions

- One unit = one head height, for every length and path coordinate. Not pixels.
- Side view, **facing right**: +x is forward (face, toes, belly), **-x is the back** (ponytail,
  backpack, hood), **+y is up**.
- Head, hair: origin at the top of the neck, the head
  spans y = 0 (chin) to 1 (crown), x from -0.5 (back of skull) to +0.5 (nose). The generated face:
  eye centre (0.3, 0.55), brow (0.3, 0.68), mouth (0.38, 0.24), ear (-0.06, 0.5). Torso: origin at the hip line, y up to the neck base; height 0.4 at 2.2 heads, 0.84 at 3,
  1.8 at 5, 2.6 at 7, 2.9 at 8.

## The skin file

File name, `name` and key are the same word.

```js
(function (g) {
  (g.CharSkins = g.CharSkins || {}).mia = { name: 'mia', extends: 'mannequin',
    build:   { heads: 5.5 },
    motion:  { weight: 0.3, energy: 0.6 },
    palette: { skin: '#d9a07a', hair: '#2b1d16', suit: '#2f6f6a' },
    parts:   { },
    chains:  { } };
})(typeof self !== 'undefined' ? self : this);
```

`extends: 'mannequin'` gives a complete person from your numbers; `parts` draw ON TOP of it.

## The loop

1. Copy the template. Check, cast, look.
2. Set `build` and `motion` (next section). Check, cast, look. Do not draw anything until the
   body shape, stride and stoop suit the person.
3. Palette. `skin`, `hair`, `shoe` recolour the body. **Set `suit` to the colour of the main
   garment (or the skin)**: the body wears a grey suit that shows at the neck, shoulders and hips
   wherever clothes leave a gap. Every `fill` must be a palette name or a literal `'#rrggbb'`.
   `fooShade` is made automatically, but only if `foo` exists.
4. Head, only if the generated one is wrong. 5. Hair. 6. Garments, one at a time, then
   accessories. Check, cast, look after each.
7. Final look at all SIX poses (standing, walk, run, jump, wave, sit).

Look for: grey at neck, shoulders or hips (set `suit`); hair or a hat floating off the head; a
garment poking past a limb; a long coat as a torso cover (use a skirt); an invisible chain (wrong
`layer`); a hem swallowing the feet; magenta (unknown colour).

## Choosing numbers

`build.heads` is height in heads; everything else defaults from it, so set only what differs.
Chest, shoulders, waist, hips are side-view DEPTH. Long neck: `neckLength` 0-1.2 (the torso shortens to keep the height). Ranges: `arm` 0.05-0.3, `leg` 0.1-0.45, depths 0.35-1.3, `belly` 0-0.7, `heads` 2.2-8, `muscle` 0-1 (RIG.md section 4).

| Person | build | motion |
| --- | --- | --- |
| toddler | `{ heads: 2.3 }` | `{ age: 'baby', energy: 0.8, weight: 0.2 }` |
| teen | `{ heads: 6.2 }` | `{ energy: 0.7 }` |
| heavy adult | `{ heads: 5.6, belly: 0.55, chest: 1.05, waist: 1.0, hips: 0.98, seat: 0.1, arm: 0.17, leg: 0.3 }` | `{ weight: 0.9, energy: 0.35 }` |
| elder | `{ heads: 6.6, belly: 0.14, arm: 0.11, leg: 0.19 }` | `{ age: 'elder', posture: 0.7, energy: 0.3 }` |
| tall thin adult | `{ heads: 8, chest: 0.72, waist: 0.52, hips: 0.78, arm: 0.1, leg: 0.16 }` | `{ weight: 0.1, energy: 0.5 }` |

A child is `{ heads: 3.5 }`, `age: 'child'`; an athlete `{ heads: 7.4, muscle: 1 }`. `weight` 0 light to 1 heavy; `energy` 0 tired to 1
lively; `age` baby, child, adult, elder; `posture` -1 proud to 1 stooped.

## Head, face and hair cap

The generated head has a hair cap in `palette.hair`:
- **Bald or your own hair shape:** `build: { heads: 6, hide: ['hair'] }` removes only the cap
  (`hide: ['head']` removes the whole head, face included). Then draw `parts.hair`. Always hide
  the cap under a hat, or it shows below the brim.
- **Different skull:** `parts.head` replaces the generated head: skin shape, then the face swaps:

```js
head: [ { d: 'M-0.42 0.5C-0.42 0.15 -0.2 0 0.1 0C0.4 0 0.5 0.2 0.5 0.5C0.5 0.85 0.3 1 0 1C-0.3 1 -0.42 0.85 -0.42 0.5Z', fill: 'skin' },
        { swap: 'brow' }, { swap: 'eye' }, { swap: 'mouth' } ],
```

Your own eyes and mouths (names in RIG.md section 8; giving `eye` keeps the generated mouth and
brows; `look: 1` follows the gaze). Brows (`neutral up down worried`) are strokes at y 0.65-0.75,
just above the eye, e.g. `brow: { neutral: { d: 'M0.22 0.67Q0.28 0.7 0.36 0.68', stroke: 'brow', w: 0.035 } }`:

```js
swaps: { eye: { open: [{ d: 'M0.24 0.55A0.05 0.07 0 1 0 0.34 0.55A0.05 0.07 0 1 0 0.24 0.55Z', fill: 'eye', look: 1 }],
                closed: { d: 'M0.24 0.56Q0.29 0.52 0.34 0.56', stroke: 'eye', w: 0.022 } } }
```

**A speaking face.** If you draw your own head, also give `swaps.mouth`, or it talks with the
generated mouth, which may not fit your face. Minimum: `open` and `closed`. Better: add
the mood mouths (`neutral smile sad o grit worried`). Best: the nine speech mouths `rest mbp ah ee oh
oo fv l wq`; missing ones fall back. Centre every mouth near (0.38, 0.24).
A beard or moustache must be its own path in `parts.head` or `parts.hair`, below y 0.32 (not
merged with the hair), so it moves with the jaw. Speech: `docs/SPEECH.md`.

A line is `{ d, stroke, w: 0.03 }`.

## Hair that moves

Static hair: a filled head-frame path in `parts.hair` (over the head) or `parts.hairBack` (behind).
Swinging hair is a **chain**:

```js
chains: { pony: { bone: 'head', at: [-0.45, 0.8], rest: 190, seg: [0.25, 0.22],
  width: [0.15, 0.13, 0.04], fill: 'hair', layer: 'back', stiff: 0.35 } }
```

`bone` head, neck, torso, pelvis; `at` anchor in that frame; `rest` degrees (0 forward, 90 up,
180 back, 270 down); `seg` lengths; `width` has ONE MORE number than `seg`; `stiff` 0 loose to 1
rigid. **`layer`**: `back` only for things hanging out behind the body (ponytail, cape,
backpack); `head` for things on the face or head (earring, fringe); `torso` for things lying on
the back or chest (braid, pendant). A scarf: bone `neck`, `stiff` 0.15. Backpack: RIG.md section 11.

## Clothes

Garments fit any body. Fractions run 0 to 1 along the part.

| Garment | Write |
| --- | --- |
| T-shirt or top | `torso: { cover: true, loose: 0.03, fill: 'shirt' }` and `arm: { cover: [0, 0.3], flat: 'end', fill: 'shirt' }` |
| long sleeves | `arm: { cover: [0, 0.95], loose: 0.03, fill: 'coat' }` |
| shorts / trousers | `leg: { cover: [0, 0.35], fill: 'jeans' }` / `leg: { cover: [0, 1], loose: 0.02, fill: 'jeans' }` |
| boots | `leg: { cover: [0.8, 1.02], loose: 0.03, flat: 'start', fill: 'boot' }` |
| skirt, dress, long coat, tunic, long apron | `skirt: { skirt: true, length: 0.5, flare: 0.2, fill: 'dress' }` plus a bodice `torso: { cover: [0.3, 1.1], fill: 'dress' }` |
| cardigan over a shirt | a list: `torso: [{ cover: true, fill: 'shirt' }, { cover: true, loose: 0.04, fill: 'coat' }]` (later covers lie on earlier ones) |

A torso cover stops at the hip line. **Anything that hangs lower is a `skirt`**, never a long
torso cover, because only the skirt follows the legs when she runs or sits. `length` 0 hips, 0.5
knee, 1 ankle; full long dress `flare` 0.25-0.35; `hem: { fill, w: 0.08 }` adds a trim; `shade` is
a colour name. A part may be a list, drawn in order.

- Hat, glasses, hood, pocket, apron, earrings, backpack: RIG.md section 11.
- Cane: `holdNear: { use: 'cane', length: 2.6, d: 'M-0.025 0.05L0.025 0.05L0.025 -2.6L-0.025 -2.6Z', fill: 'wood' }`
  (`length` about 0.45 x heads); the engine plants it in step with the walk. A bag that hangs
  straight: `holdFar: { upright: true, ... }`. Both keys only work in `holdNear`/`holdFar`.

## Rules

1. `swap` only in `parts.head`; `tube` only in `arm`, `leg`; `cap` only in `upperArm`, `foreArm`,
   `thigh`, `shin`; garments use `cover` or `skirt`.
2. Change one thing, check, look. Never write the whole character before the first cast.
3. Fix a body problem with `build` or `motion`, not with clothes. Leave `outline` (max 0.04),
   `springs`, `grip`, `handZ` alone.

Done: `OK: 0 errors, 0 warnings` and six poses of one whole person. Actions and moods are in
`docs/ACTIONS.md`.
