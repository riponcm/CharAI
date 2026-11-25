---
name: charai
description: CharAI is a 2D character animation engine and agent skill that draws and animates side-view cartoon people with a deterministic engine (seek(t) gives the same frame in any order). Use it to design a character as a data file, write a short animated film as a text .char script (walk, run, jump, emotions, speech with lip sync, hugs, props), add a new action, export video or animated SVG, or place animated characters over another tool's scenery. Characters only; no scenery, no 3D, side view only.
---

# CharAI: where to start

You draw the character; CharAI moves it. Run everything from this folder with Node. Read the document for
your job, then loop: write, check, look at the picture, fix.

| Job | Read | Check and look |
| --- | --- | --- |
| Draw a character (a skin file: numbers plus a few SVG paths) | `docs/CHARACTER.md`, then `docs/RIG.md` for every field | `node tools/skincheck.cjs skins/x.js`, `node tools/cast.cjs skins/x.js x.png` |
| Write a film (a `film.char` script: actors, actions, camera, captions) | `docs/AUTHORING.md` | `node tools/check.cjs films/x`, `node tools/sheet.cjs films/x` |
| Add an action (a few key poses in a small file) | `docs/ACTIONS.md` | `node tools/actioncheck.cjs actions/x.js`, `node tools/action.cjs x out.png` |

## Also

- **Speech and faces**: `docs/SPEECH.md`. `say("text", for=2)` lip-syncs from text alone; a timing track
  from a voice tool makes it tighter. `tools/say.cjs` shows the mouth shapes.
- **Voices**: `docs/VOICE-WINDOWS.md` makes a voice track on Windows; `node tools/render.cjs films/x out.mp4 --audio=voice.wav`
  adds the sound.
- **Two characters** (handshake, hug, shove, hand over): `docs/PAIRS.md`.
- **Props** (pick up, carry, throw, sit on, lean on): `docs/PROPS.md`; props in pairs are in `docs/PAIRS.md`.
- **Embed in another tool** (web component `<char-stage>`, `Char.mount`, page-owned clock, transparent
  PNG, WebM or ProRes export): `docs/HOSTS.md`. Build the bundle with `npm run build`.

## Rules that save time

- Start a skin by extending `mannequin` and setting numbers; draw only the head, hair, clothes and
  accessories. Never copy helper code from another skin; a skin is plain data.
- A film needs no scenery line. The host paints the scenery; keep its ground line at the script's `ground=`.
- Never say it is done before the check passes and you have looked at the picture.
- `npm install` is only for the screenshot and render tools.

Limits: side view only, flat cartoon styles, believable (not simulated) physics, simple hands. See
`README.md` and `docs/KNOWN-ISSUES.md`.
