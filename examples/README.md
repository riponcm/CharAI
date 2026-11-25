# Examples: one `.char` file, one film

Each file is a complete short film that runs with the shared library plus `examples/skins/` and
`examples/actions/`. Run any of them from the engine folder:

```
node tools/check.cjs examples/hello.char                  # checks it, writes examples/hello.html (open to play)
node tools/render.cjs examples/hello.char hello.mp4       # 1280x720 MP4 (needs ffmpeg and Chrome or Edge)
node tools/sheet.cjs examples/hello.char sheet.png --n=8  # a contact sheet of 8 frames
```

| File | Shows | Length |
| --- | --- | --- |
| `hello.char` | the smallest film: walk in, wave, a speech bubble | 8 s |
| `walk-run-jump.char` | walk, run, jump, skid; camera `cut`, `follow`, `zoom`, `pan` | 13 s |
| `moods.char` | the same walk under four `mood` lines | 14 s |
| `conversation.char` | `say` plus captions with `by=`, `look`, `face` | 13 s |
| `hug-and-handover.char` | paired actions `hug` and `give` with a prop | 15 s |
| `montage.char` | fifteen catalogue actions on five actors | 14 s |
| `local-action.char` | an action file next to the film: `actions/jig.js` | 9 s |

## The language in one page

```
film "Hello" 8s                  # header: title and length (first line)
set hillside                     # scenery (or: stage width=2400 ground=600 scale=68 for a bare stage)
actor Tess = skin tess at 640    # who, drawn by which skin, standing where (x in pixels or an anchor)
puppet Pip = bird at branch      # an animal; prop lantern at 532 adds an object

0.0  Tess: enter(from=left)      # a timed line:  <time> <target>: call(args), call(args)
+0.2 Tess: wave()                # +n = n seconds after Tess's previous line has finished
4.1  caption: "Hello!", by=Tess  # targets: an actor, a puppet, cam, caption, card, wind
```

- **Calls on one line start together**, so they must use different channels. Actors have
  `body` (walk, run, jump, idle, bow...), `arms` (wave, point, hold...), `face`, `mood`, `look` and `say`.
- **Body moves chain** with `+0`; a body line that starts too early cuts the previous one short.
- **The camera** (`cam`) has `pan`, `follow`, `cut`, `zoom`, `shake`, `fade` and `frame`/`home`.
- **Pairs**: `Kai: hug(with=Tot)` drives both actors. Actions are files in `actions/`.
- `#` starts a comment. Names are case-sensitive.

Full reference: [docs/AUTHORING.md](../docs/AUTHORING.md), with [docs/ACTIONS.md](../docs/ACTIONS.md),
[docs/SPEECH.md](../docs/SPEECH.md) and [docs/PAIRS.md](../docs/PAIRS.md).

## Colours in VS Code

1. Copy `editors/char.tmLanguage.json` into a folder `char-syntax/syntaxes/` with a `package.json` that
   declares a language `char` (extension `.char`) and a grammar for `source.char` pointing at it.
2. Put that folder in `~/.vscode/extensions/` and restart VS Code.
