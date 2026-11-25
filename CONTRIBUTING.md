# Contributing to CharAI

Thank you for being here. CharAI is small and young, and the best things in it so far came from someone trying to make one more person move. You do not need to be an animator, or an engineer. If you can draw a character, write a short film, or notice that a step in a document does not work, you can help.

First, get it running: [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md).

## Ways to contribute

**Draw a character.** Characters are added as examples, not as a library: each one shows a different body or style, so a new one should add something the existing ones do not (age, build, clothes, culture). Read `docs/CHARACTER.md` and `docs/RIG.md`. Make `examples/skins/<name>.js`. Check: `node tools/skincheck.cjs examples/skins/<name>.js`. Show: `node tools/cast.cjs examples/skins/<name>.js name.png` and put the cast sheet in your pull request.

**Add an action.** Read `docs/ACTIONS.md`. Make `actions/<name>.js`, a few key poses. Check: `node tools/actioncheck.cjs actions/<name>.js`. Show: `node tools/action.cjs <name> strip.png` on two or three different bodies, and attach the strip.

**Write an example film.** Read `docs/AUTHORING.md` and `examples/README.md`. Make `examples/<name>.char`, one file, ideally showing something the others do not. Check: `node tools/check.cjs examples/<name>.char`. Show: `node tools/sheet.cjs examples/<name>.char sheet.png --n=8`, or a short clip.

**Fix a known issue.** Pick one from `docs/KNOWN-ISSUES.md` and say in an issue that you are on it. Add a test if the fix can be tested. Show a before and after picture.

**Improve a document.** Follow a document step by step as a newcomer would and fix where it fails. Say what you ran and what you saw.

**Try a host.** The Remotion, HyperFrames and GSAP snippets in `docs/HOSTS.md` are untested, and so are Linux and macOS. A report that says "this worked" or "this broke, here is the output" is a real contribution. A fixed snippet is better.

## The rules

1. **Tests pass:** `node --test tests/*.cjs`.
2. **Checks pass** for what you made (the commands above), with no errors.
3. **Look at the picture.** Open the cast sheet, strip or contact sheet and look at every pose before you ask for review. Attach it.
4. **Original designs only.** No copies of existing characters, brands or artwork, and no tracing. Inspired by is fine; the same as is not.
5. **Apache 2.0.** By opening a pull request you agree your contribution is licensed under the Apache License 2.0, like the rest of the project.
6. Keep changes small, one idea at a time. Add no runtime dependencies. Side view only, no scenery.

Be kind in discussions: see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). If an AI agent helped you make your contribution, that is welcome (this project was made that way); you are still responsible for looking at the result.

## Show what you made

Made a film, a character or a strange experiment? Share it in [GitHub Discussions](https://github.com/riponcm/CharAI/discussions) with a clip or a picture and one line about what you tried. It does not have to be polished. Seeing what people make is what keeps the project going.
