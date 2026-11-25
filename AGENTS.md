# AGENTS.md

CharAI is a 2D character animation engine and agent skill. You draw a human as a small skin file, direct it with a `.char` script, and the engine supplies skeleton, motion, physics, lip sync and contact. Characters only, side view only. Apache 2.0, no runtime dependencies. Start with `SKILL.md`.

## Three jobs

| Job | Read first |
| --- | --- |
| Draw a character (skin file) | `docs/CHARACTER.md`, then `docs/RIG.md` |
| Write a film (`.char` script) | `docs/AUTHORING.md` |
| Add an action | `docs/ACTIONS.md` |

Speech `docs/SPEECH.md`; two characters `docs/PAIRS.md`; props `docs/PROPS.md`; other tools `docs/HOSTS.md`.

## Commands

```
node --test tests/*.cjs                 # test suite
node tools/skincheck.cjs skins/x.js     # check a skin
node tools/actioncheck.cjs actions/x.js # check an action
node tools/check.cjs films/x            # check a film
node tools/sheet.cjs films/x            # contact sheet to look at
npm run build                           # rebuild dist/char.js after editing src/
npm run llms                            # regenerate llms.txt and llms-full.txt
```

Screenshot and render tools need `npm install` (puppeteer-core); do not run it otherwise.

## Rules

- Run the check and the tests before saying a job is done.
- Look at the picture (cast sheet, contact sheet) before claiming it looks right.
- Side view only; do not draw scenery; do not claim untested host support.
- A skin is plain data; extend `mannequin`, never copy helper code.
