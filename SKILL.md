---
name: charai
description: Animate 2D cartoon people (side view) from a text script. Use when the user wants to animate a character, make a short film or cartoon of people walking, talking, hugging or waving, lip sync a line, write or fix a .char file, design a character (a fat chef, a child, an elder), add a new action such as a cartwheel, render to MP4, transparent WebM, ProRes, PNG frames or animated SVG, or put characters over Remotion, HyperFrames or a web page. Deterministic engine, Node only. Draws characters only; no scenery, no 3D, no front or three-quarter view.
---

# CharAI

CharAI is a 2D character animation engine. You write a `.char` script (who, what, when) and a skin file (what a person looks like); the engine supplies skeleton, motion, hair and cloth physics, lip sync and contact. It draws people only: no scenery, no 3D, side view only. Run every command from the engine folder (the one holding this file).

## Setup (three commands)

```
node --version                                          # v18 or higher
node tools/check.cjs examples/hello.char                # last line: OK: 0 errors, N warning(s). Wrote examples\hello.html
node tools/sheet.cjs examples/hello.char hello.png --n=8   # last line: ... 8 frames of 8s (no page errors)
```

It worked if the second prints `OK:` and the third writes the PNG. Sheet, render, export and cast need `puppeteer-core` plus Chrome or Edge (MP4 also needs ffmpeg); only if the third fails on puppeteer, run `npm install` once. The check tools need nothing.

## Pick your job

| The user says | Do this |
| --- | --- |
| "make a 10-second film of a girl waving" | Write a film |
| "a fat chef with a moustache", "an old man with a cane" | Draw a character |
| "make him do a cartwheel", "she should facepalm" | Add an action (`ls actions/` first) |
| "they hug", "hand over a loaf" | Write a film (pair and prop calls) |
| "put the character on my page", "MP4", "transparent video" | Embed or export |

## Write a film

1. Pick the cast. Skins: `tess`, `kai`; in `examples/skins/`: `tot` (toddler), `baker`, `captain`, `duchess`, `gramps`, `skye`, `vera`. Props: `ball box chair door lantern loaf thorn`.
2. Make `films/<name>/film.char`. Copy any skins you use into `films/<name>/skins/`.
3. Write the header, then timed lines (below). Start from `examples/skill-demo.char`.
4. Check: `node tools/check.cjs films/<name> --timeline`. Success: last line `OK: 0 errors`. Fix every ERROR; read every WARNING. `--timeline` prints real end times for `+n`.
5. Look: `node tools/sheet.cjs films/<name> sheet.png --n=12`, then open `sheet.png`. Success: every actor visible, nobody inside another, the end card shows.
6. Render: `node tools/render.cjs films/<name> out.mp4 --fps=24`. Success: `wrote out.mp4: N frames` .

`examples/skill-demo.char`:

```
film "Fresh loaf" 14s        # title, length
stage width=1400 ground=600 scale=60    # bare stage: no scenery
actor Baker = skin baker at 700 facing left
actor Tot = skin tot at 150
prop loaf at 850     # a prop lying at x=850

0.0  cam: cut(to=500, zoom=1.4) # absolute time
0.0  Baker: mood(happy), idle() # two channels, one line
0.0  Tot: face(happy)
0.5  Tot: run(to=420)
0.5  Baker: say("Hello, little one!", for=1.8)  # lip sync from the text
0.5  caption: "Hello, little one!", by=Baker, for=1.8   # a speech bubble
+0   Baker: give(with=Tot, prop=loaf, speed=2.5)  # pair action: one line drives both
+0   Tot: face(proud)
2.0  cam: frame(on=Tot+Baker, over=1.2)  # close-up on both
+0.5 Tot: wave() # 0.5 s after Tot's last line ends
9.5  cam: home(over=1.0) # leave the close-up
9.5  cam: pan(to=600, over=1.0)
11.6 card: "Fresh loaf" # end card
```

### Grammar

One statement per line; `#` starts a comment; names are case-sensitive.

| Header line | Meaning |
| --- | --- |
| `film "Title" 12s` | first line: title, length |
| `stage width=2400 ground=600 scale=68` | bare stage (defaults shown); `scale` = px per head height |
| `set hillside [dusk]` | scenery; variants `day dawn dusk night` |
| `actor N = skin S at X [facing left] [scale=1]` | a person. `X` = pixels, an anchor, or a name |
| `puppet N = bird at X` | animal: `bird bear lamb` |
| `prop K [as N] [at X]` | object; without `at` it appears when first held |

Timed line: `<time> <target>: call(args), call(args)`. Time is absolute seconds (`4.5`) or `+n` = n seconds after the same target's previous line finishes. A target's lines must go forward in time. Targets: an actor or puppet name, `cam`, `caption`, `card`, `wind`, `clock`. Arguments: positional (`wave(both)`) or `key=value`; text in `"quotes"`.

Channels: calls on one line start together and must use different channels. Actor channels: `body` (one at a time; start the next body line with `+0`), `arms`, `face`, `mood`, `look`, `say`; all but `body` run beside a walk. Camera channels: pos (`pan follow cut`), `zoom`, `shake`, `fade`, frame (`frame home`).

| Group | Calls (required arguments first) |
| --- | --- |
| moving | `walk(to, speed=1)` `run(to, speed=1, end=stop\|skid)` `sneak(to)` `enter(from=left)` `jump(to, height=1)` `turn()` `bounce(times=3)` |
| poses | `idle()` `stand()` `kneel()` `crouch()` `sit(on=0)` `recoil()` |
| gestures | `wave(hand=near\|far\|both)` `point(at, for=1.5)` `reach(at, for=1.2)` `cheer()` `bow()` `shrug()` `clap(times=4)` `dance()` |
| feelings | `mood(name, strength=1)` neutral happy sad angry scared tired proud shy; `face(mood, strength=1)` adds excited surprised determined |
| face, speech | `look(at=front)` a name or up down front back; `nod()`; `say("text", for=0, beats=0)` |
| pairs | `hug(with)` `handshake(with)` `highfive(with)` `pat(with)` `shove(with)` `give(with, prop)` `throwto(with, prop)`; `speed=` or `for=` sets length |
| props | `pickup(prop)` `putdown()` `hold(prop, how=front\|up\|side)` `drop()` `sit(on=chair)` `knock(on=door)` |
| camera | `cam: pan(to, over=1.5)` `follow(target)` `cut(to, zoom=0)` `zoom(to, over=1)` `shake(amount=8)` `fade(dir=out\|in)` `frame(on, top=head, bottom=thigh, x=0.35)` `home()` |
| text | `caption: "text", for=3, by=Name, at=top` `caption: clear` `card: "text", for=0, sub="..."` |
| world | `wind: gust(amount=1, over=1.5)` `wind: blow(amount=0.3)` |

Levels for `frame`: head chin chest waist hip thigh knee feet. Full tables: `docs/AUTHORING.md`.

## Draw a character

A character is a skin file: numbers plus a few SVG paths on top of the `mannequin` body.

1. Copy the template to `films/<film>/skins/mia.js`. File name, `name` and key are the same word.
2. Set `build` and `motion` from the table. Do not draw anything yet.
3. Check: `node tools/skincheck.cjs films/<film>/skins/mia.js`. Success: `OK: 0 errors, 0 warnings`.
4. Look: `node tools/cast.cjs films/<film>/skins/mia.js mia.png`, open `mia.png`: six poses (standing, walk, run, jump, wave, sit) of one whole person.
5. Add one thing at a time in this order, repeating steps 3 and 4 after each: palette (`suit` = main garment colour, else grey shows at neck, shoulders, hips), head only if the generated one is wrong, hair (`hide: ['hair']`, your own path or a chain), clothes, accessories.
6. If you draw your own head, also give `swaps.mouth` (minimum `open`, `closed`). A beard is its own path in `parts.head` below y 0.32. Test: `node tools/say.cjs shapes.png --skin=mia --shapes`.

| Person | `build` | `motion` |
| --- | --- | --- |
| toddler | `{ heads: 2.3 }` | `{ age: 'baby', energy: 0.8, weight: 0.2 }` |
| child | `{ heads: 3.5 }` | `{ age: 'child', energy: 0.8 }` |
| adult | `{ heads: 7 }` | `{ weight: 0.4, energy: 0.6 }` |
| heavy adult | `{ heads: 5.6, belly: 0.55, chest: 1.05, waist: 1.0, hips: 0.98, seat: 0.1, arm: 0.17, leg: 0.3 }` | `{ weight: 0.9, energy: 0.35 }` |
| tall thin adult | `{ heads: 8, chest: 0.72, waist: 0.52, hips: 0.78, arm: 0.1, leg: 0.16 }` | `{ weight: 0.1, energy: 0.5 }` |
| elder | `{ heads: 6.6, belly: 0.14, arm: 0.11, leg: 0.19 }` | `{ age: 'elder', posture: 0.7, energy: 0.3 }` |

Ranges: `heads` 2.2 to 8; `arm` 0.05 to 0.3; `leg` 0.1 to 0.45; chest, waist, hips 0.35 to 1.3; `belly` 0 to 0.7. Path units: one head height, facing right, +y up. Fix body problems with numbers, not clothes. This skin passes `skincheck`:

```js
// mia.js: a tall woman in a teal dress with a ponytail
(function (g) {
  (g.CharSkins = g.CharSkins || {}).mia = { name: 'mia', extends: 'mannequin',   // a full person
    build:  { heads: 6.5 },                          // height in heads
    motion: { weight: 0.3, energy: 0.6 },            // 0 light..1 heavy; 0 tired..1 lively
    palette: { skin: '#d9a07a', hair: '#2b1d16', shoe: '#3a2a2a', suit: '#2f6f6a', dress: '#2f6f6a' },
    parts: {
      torso: { cover: [0.3, 1.1], fill: 'dress' },                      // bodice; stops at the hip line
      skirt: { skirt: true, length: 0.5, flare: 0.2, fill: 'dress' },   // below the hip: a skirt
      arm:   { cover: [0, 0.3], flat: 'end', fill: 'dress' }            // first 30% of the arm
    },
    chains: {                                                           // swings
      pony: { bone: 'head', at: [-0.45, 0.8], rest: 190, seg: [0.25, 0.22],
              width: [0.15, 0.13, 0.04], fill: 'hair', layer: 'back', stiff: 0.35 }   // width: seg + 1 numbers
    } };
})(typeof self !== 'undefined' ? self : this);
```

Every `fill` is a palette name or `'#rrggbb'`. `swap` only in `parts.head`; garments use `cover` or `skirt`; leave `outline`, `springs`, `grip`, `handZ` alone.

## Add an action

1. Run `ls actions/`; copy the closest file to `films/<film>/actions/<name>.js` (or `actions/<name>.js`).
2. Write 2 to 4 keys; `t` is seconds and must increase. Use landmarks (`['chin', 0.05, 0.05]` = forward, up in head heights), not raw angles, so one file fits a toddler and a tall man.
3. Check: `node tools/actioncheck.cjs actions/<name>.js`. Success: `OK: 0 errors, 0 warning(s)`.
4. Look: `node tools/action.cjs <name> out.png --skin=tot,baker,vera` (add `--film=<film>` for a film's own action). Success: a sensible pose on all three.
5. Use it: `2.0 Mia: <name>()` in a film.

`actions/ponder.js` (passes `actioncheck`):

```js
(function (g) { (g.CharActions = g.CharActions || {}).ponder = {   // key = file name
  channel: 'arms',                    // 'arms' = gesture over the body; 'body' = whole body
  doc: 'hand to the chin and a slow nod (hold = seconds at the chin)',
  args: { hold: 1 },                  // script: Mia: ponder(hold=2)
  face: 'determined',                 // mood face while it plays
  contact: true,                      // the hand touches the head on purpose
  keys: [
    { t: 0.4, handNear: 'chin', hands: 'relaxed', head: 8 },          // hand to the chin, head tips down
    { t: 0.8, handNear: ['chin', 0.05, 0.05], head: 12 },
    { t: 1.2, handNear: 'chin', head: 4, hold: true },                // hold: true = the pose to read
  ] }; })(typeof self !== 'undefined' ? self : this);
```

Landmarks: top forehead eye mouth chin ear backhead neck chest belly hip back seat knee ground front up out down wall wallHigh wallLow. Pair files (`pair: true`, roles `a` and `b`): `docs/PAIRS.md`. All key fields: `docs/ACTIONS.md`.

## Embed or export

| Goal | Command or snippet |
| --- | --- |
| Web page | `node tools/build.cjs`, then `<script src="dist/char.js"></script><char-stage width="1280" height="720" skins="skins/kai.js" autoplay loop><script type="text/plain">film "x" 4s ...</script></char-stage>` |
| Page-owned clock | `const m = Char.mount(el, { script, skins: CharSkins, width: 1280, height: 720 }); m.seek(t);` (load skin files first) |
| MP4 | `node tools/render.cjs films/<name> out.mp4 --fps=24` |
| Transparent WebM | `node tools/export.cjs films/<name> out.webm --format=webm --fps=30` |
| ProRes 4444 | `node tools/export.cjs films/<name> out.mov --format=mov` |
| PNG sequence | `node tools/export.cjs films/<name> frames --format=png` |
| Animated SVG | `node tools/svgloop.cjs films/<name> out.svg --fps=10 --crop=0,360,1280,360` |
| Voice track | `node tools/render.cjs films/<name> out.mp4 --audio=voice.wav` |

Transparent output needs a bare-stage film (a `set` line paints scenery). Keep the host's ground line at the script's `ground=`. Remotion, HyperFrames and GSAP snippets are untested: `docs/HOSTS.md`.

## Check before you say it is done

- [ ] `node tools/check.cjs` prints `OK: 0 errors`, and every warning was read.
- [ ] You opened the sheet PNG (films) or cast PNG (skins) and looked at it.
- [ ] No actor is outside the frame while it acts.
- [ ] After pair actions nobody stands inside the other.
- [ ] The last line ends before the film length (`--timeline`) and the length fits the request.
- [ ] Skins pass `skincheck`, actions pass `actioncheck`; after editing `src/`, `node --test tests/*.cjs` passes.

## When a check fails

| Message (shortened) | Fix |
| --- | --- |
| `Tot has no action 'wallk'. Did you mean 'walk'?` | Use the suggested name; the message lists all valid ones. |
| `this starts at 7.00s but the film is 6s long` | Raise the length in the `film` line or move the line earlier. |
| `Tot's walk from line 5 runs until 6.79s, but this line starts run at 2.00s and cuts it short` | Start the line with `+0` (or at 6.8). |
| `unknown skin 'zed'. Available skins: ...` | Copy the skin file into `films/<name>/skins/` or fix the name. |
| `unknown target 'Bob'. Did you mean 'Tot'?` | Declare `actor Bob = skin ... at ...` or fix the name. |
| `Tot is outside the frame ... Pan the camera to Tot first` | Add `cam: follow(Tot)` or `cam: pan(to=Tot)` before the line. |
| `Kai: walk(to=5000) is off the stage; the stage is 1400 wide. Write a place from 0 to 1400, for example walk(to=1400).` | Move `to=` inside the stage (or widen `stage width=`). |
| `Kai: hug needs a partner. Write hug(with=Tess). Actors it could be: Tess.` | Add `with=<actor>` to every pair action (hug, handshake, give, ...). |
| `say: the text must be in quotes, got hello. Write: 1 Kai: say("hello")` | Put the text of say, caption and card in "quotes". |
| `Tess: face: 'happyy' is not a face name. Nearest valid name is 'happy', so write face(happy). Valid: neutral, happy, ...` | Use a listed name; `mood(...)` is the same. |
| `colour 'teal' is not in the palette` | Add `teal: '#rrggbb'` to the skin's `palette`. |
| `'pinky' is not a landmark` (actioncheck) | Use a landmark from the list above. |

Warnings do not fail the check, but `camera wants x=5000 but stops at x=760` means the script is wrong; `planted foot slides` of 3 to 13 px is known.

## Limits and known issues

- Side view only; flat cartoon styles; believable, not simulated, physics; simple hands.
- Not built: hand in hand, carrying a child, pushing a heavy object, three or more people in one action.
- Speech is text-driven, not polished; films over 30 s are untested. Details: `docs/KNOWN-ISSUES.md`.

## Where to read more

- `docs/AUTHORING.md`: an exact argument, speed, camera or set rule.
- `docs/CHARACTER.md`: hair, clothes, face of a skin. `docs/RIG.md`: a skin field not in it.
- `docs/ACTIONS.md`: action keys and landmark tables.
- `docs/SPEECH.md`: lip sync and voice tracks. `docs/VOICE-WINDOWS.md`: a voice track on Windows.
- `docs/PAIRS.md`: two-character actions. `docs/PROPS.md`: pick up, sit on, knock, throw.
- `docs/HOSTS.md`: web component, Remotion, transparent video.
- `docs/KNOWN-ISSUES.md`: something looks wrong. `examples/README.md`: one runnable example per idea.
