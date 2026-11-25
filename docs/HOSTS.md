# Using CharAI from other tools and pages

CharAI draws characters only, on a transparent layer. The host supplies the scenery.

## Build

```
node tools/build.cjs        # dist/char.js (global Char) and dist/char.esm.js
```

Re-run it whenever `src/` changes. The bundle has no dependencies and loads in Node without a DOM.

## Web component

```html
<script src="dist/char.js"></script>
<char-stage width="1280" height="720" skins="skins/kai.js" actions="actions/hi.js" autoplay loop controls>
  <script type="text/plain">film "x" 4s
actor Kai = skin kai at 200
0 Kai: walk(to=900)</script>
</char-stage>
```

Attributes: `src` (film script URL, needs http, not file://; or inline script text), `skins`, `actions`
(space separated script URLs), `width`, `height`, `autoplay`, `loop`, `controls`.
Methods `seek(t)`, `play()`, `pause()`; properties `duration`, `currentTime`; events `ready`, `error`.
Put the page's ground line at the script's `ground=`. See `examples/page.html`.

## Page-owned clock

`Char.mount(el, { script, skins })` returns `{ duration, seek(t), destroy() }`. `seek` is a pure
function of t and may be called in any order. `examples/timeline.html` follows the film page
contract: `window.seek(t)`, `?static=1`, `?t=`. Load skin and action files before mounting.

## Transparent video

```
node tools/export.cjs films/bare-test out.webm --format=webm --fps=30   # VP9 with alpha
node tools/export.cjs films/bare-test out.mov  --format=mov            # ProRes 4444 with alpha
node tools/export.cjs films/bare-test frames   --format=png            # PNG sequence
```

Optional `--w --h --from --to`. Films with a `set` line draw their own scenery; use bare-stage films.
ffprobe shows a WebM as yuv420p: the alpha is stored separately (tag `alpha_mode=1`); decode it with
`-c:v libvpx-vp9`.

## Other hosts (untested snippets)

**Remotion** (untested): mount once, seek per frame.
```jsx
const ref = useRef(); const frame = useCurrentFrame(), { fps } = useVideoConfig();
useEffect(() => { ref.current.m ??= Char.mount(ref.current, { script, skins: CharSkins, width: 1280, height: 720 });
  ref.current.m.seek(frame / fps); });
return <div ref={ref} />;
```

**HyperFrames** (untested): register a seek on the composition timeline.
```js
const m = Char.mount(document.getElementById('chars'), { script, skins: CharSkins });
window.__timelines["main"].eventCallback?.("onUpdate", () => m.seek(tl.time()));
```

**GSAP** (untested): tween a number and seek on update.
```js
const o = { t: 0 };
gsap.to(o, { t: m.duration, duration: m.duration, ease: "none", onUpdate: () => m.seek(o.t) });
```

## Animated SVG

```
node tools/svgloop.cjs films/header out.svg --fps=10 --crop=0,360,1280,360 --round=24
```

Writes one SVG that plays a time range of a bare-stage film as a loop: real vector frames from the
engine, shown one at a time by a CSS animation. No script, no external file, so it also works in an
`<img>` tag on GitHub. Options: `--from --to --fps --crop=x,y,w,h --round --under --over --still
--decimals` (see the top of the tool). The motion stops under `prefers-reduced-motion`, showing the
`--still` frame. The frame at `--to` must equal the frame at `--from`, or the loop will jump. Each
frame stores the characters in full, so keep it short: the header, 7 s at 10 fps with two small
characters, is about 840 KB. `films/header` and `docs/img/src/` hold the header's film and artwork.
