# AGENTS.md

CharAI is a 2D character animation engine and agent skill. You draw a human as a small skin file, direct it with a `.char` script, and the engine supplies skeleton, motion, physics, lip sync and contact. Characters only, side view only. **Read `SKILL.md` first**: it holds the procedures, a complete example film, the grammar and the fixes for common check failures.

## Four jobs (all in `SKILL.md`)

| Job | Deeper reference |
| --- | --- |
| Write a film (`.char` script) | `docs/AUTHORING.md` |
| Draw a character (skin file) | `docs/CHARACTER.md`, `docs/RIG.md` |
| Add an action | `docs/ACTIONS.md` |
| Embed or export | `docs/HOSTS.md` |

Speech `docs/SPEECH.md`; pairs `docs/PAIRS.md`; props `docs/PROPS.md`.

## Commands

```
node --test tests/*.cjs                 # test suite
node tools/check.cjs films/x            # check a film (or a .char file)
node tools/sheet.cjs films/x s.png      # contact sheet to look at
node tools/skincheck.cjs skins/x.js     # check a skin
node tools/cast.cjs skins/x.js x.png    # six-pose picture of a skin
node tools/actioncheck.cjs actions/x.js # check an action
npm run build                           # rebuild dist/char.js after editing src/
npm run llms                            # regenerate llms.txt and llms-full.txt
```

Sheet, cast, render and export need puppeteer-core (`npm install` only if missing).

## Rules

- Run the check and the tests before saying a job is done; look at the picture.
- Side view only; no scenery; do not claim untested host support.
- A skin is plain data; extend `mannequin`, never copy helper code.
