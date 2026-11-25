# Getting started with CharAI

Pick the path that fits you. Each goes from nothing to something you can see.

You need Node 18 or newer. For pictures and video you also need Chrome or Edge and, for MP4, [ffmpeg](https://ffmpeg.org/) on your PATH. The repository is https://github.com/riponcm/CharAI.

## Path A: use it from Claude Code (the skill)

CharAI has only been tried with Claude models. Any agent that can read a skill file and run Node may work, but that is untested.

1. Clone it into a skills folder. For one project, from the project root:
   ```
   git clone https://github.com/riponcm/CharAI .claude/skills/charai
   ```
   For all your projects, clone into `~/.claude/skills/charai` instead (`%USERPROFILE%\.claude\skills\charai` on Windows).
2. Install the screenshot and render tools once:
   ```
   cd .claude/skills/charai
   npm install
   ```
   This adds `puppeteer-core` only.
3. Start Claude Code and ask. The agent finds the skill, reads `SKILL.md`, then the one document for the job. Try one of these:
   - "Use CharAI to draw a character: a tall grandmother with a silver bun, a green cardigan and a walking stick. Show me her cast sheet."
   - "Use CharAI to write a 15-second film with two characters: a courier and a baker meet at a door, he hands over a parcel, she is delighted. Render it to an MP4."
   - "Use CharAI to add a new action called `shrug`."

   What the agent does: it writes a file, runs the check (`skincheck`, `check` or `actioncheck`), looks at the picture it makes, fixes what it sees, and repeats. You get a skin file in `skins/` and a cast sheet PNG; a film folder with `film.char`, a contact sheet and an MP4; or an action file in `actions/` and a strip image. Costs: [EVIDENCE.md](EVIDENCE.md).

## Path B: use the engine yourself

1. Clone and install:
   ```
   git clone https://github.com/riponcm/CharAI
   cd CharAI
   npm install
   ```
2. Check and render the smallest film:
   ```
   node tools/check.cjs examples/hello.char
   node tools/render.cjs examples/hello.char hello.mp4
   ```
   You should see `OK: 0 errors, 2 warning(s). Wrote examples\hello.html.` (the two warnings are known and harmless), then `hello.mp4`: eight seconds, a girl walks in, waves and says hello. Open `examples/hello.html` in a browser to play it live.
3. Edit one line. In `examples/hello.char`, change `Tess: wave()` to `Tess: bow()`, save, and render again. Only the wave becomes a bow.
4. Make a character. Create `skins/mia.js`:
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
5. Check it and look at it:
   ```
   node tools/skincheck.cjs skins/mia.js
   node tools/cast.cjs skins/mia.js mia.png
   ```
   You should see `OK: 0 errors, 0 warnings`, then `mia.png`: one person in six poses (standing, walk, run, jump, wave, sit). Use her: in `examples/hello.char` change `skin tess` to `skin mia`. Add hair, clothes and accessories as in [CHARACTER.md](CHARACTER.md).

## Path C: put characters in your own page or tool

1. Copy `dist/char.js` and the skin files you need next to your page. It has no dependencies.
2. Save this as `my-page.html` in the repository folder:
   ```html
   <!doctype html>
   <html><head><meta charset="utf-8"><title>My page</title>
   <style>body { margin: 0; background: #f7d6a8; }</style></head>
   <body>
   <char-stage id="cs" width="1280" height="720" skins="skins/mannequin.js skins/kai.js" autoplay loop controls>
   <script type="text/plain">
   film "Mine" 5s
   stage width=1280 ground=600 scale=68
   actor Kai = skin kai at 160
   0.0 Kai: walk(to=800)
   +0.2 Kai: wave()
   </script>
   </char-stage>
   <script src="dist/char.js"></script>
   <script>
     const cs = document.getElementById('cs');
     window.seek = t => { cs.pause(); cs.seek(+t || 0); };
   </script>
   </body></html>
   ```
3. See it without a browser window:
   ```
   node tools/shot.cjs my-page.html my-page.png --t=3 --w=1280 --h=720
   ```
   `my-page.png` shows Kai mid-walk on your colour, with a play bar. Or open the file in a browser. Keep your own ground line at the script's `ground=`.
4. For code control, `Char.mount(el, { script, skins })` returns `{ duration, seek(t), destroy() }`; `seek` is a pure function of time, so a timeline can call it in any order.
5. For a video editor, export with transparency (use a film with no `set` line):
   ```
   node tools/export.cjs films/bare-test out.webm --format=webm
   ```
   More hosts (Remotion, HyperFrames, GSAP snippets are untested) and the other formats: [HOSTS.md](HOSTS.md).

## When something goes wrong

- **"No Chrome/Edge found" or "No browser would start".** Set `BROWSER_PATH` to the browser program, for example `export BROWSER_PATH="/c/Program Files/Google/Chrome/Application/chrome.exe"` (PowerShell: `$env:BROWSER_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"`).
- **"puppeteer-core not found".** Run `npm install` in the CharAI folder. In the skill folder, that is `.claude/skills/charai`.
- **"ffmpeg exited" or ffmpeg not found.** Install ffmpeg and open a new terminal so it is on the PATH (`ffmpeg -version` must work). Checks, sheets and PNG pictures do not need it.
- **The check prints `ERROR`.** Read the line number and the sentence: it says what to write. Example: `this starts at 24.44s but the film is 8s long` means lengthen the film header or move the line. Fix, run the check again, and only then render. `WARNING` lines do not block a render.
- **A character is out of frame or off screen.** The check says `is outside the frame`. Add `cam: follow(Name)` or `cam: pan(to=Name)`, or give the actor a closer `at` place. On your own page, match the stage `width=` to the page.
