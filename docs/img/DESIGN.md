# DESIGN.md: the readme graphics

All files live in `docs/img/`. Every graphic has a light and a dark version; GitHub picks one with
`<picture>` and `prefers-color-scheme`. Paths below are relative to the repository root (the readme).
Animated graphics are animated WebP at 30 fps (frame times alternate 33 and 34 ms; identical still frames are
merged, so a file with long pauses can have fewer frames), looping forever, seamless. Colours: cream and warm sand in light,
deep navy in dark, amber accent. Characters are the engine's own (`films/cast`, `skins/`), drawn live by the engine.

## Files

| File | Size | Notes |
| --- | --- | --- |
| `badge-apache-2-dark.svg` | 886 B | static SVG |
| `badge-apache-2-light.svg` | 888 B | static SVG |
| `badge-no-dependencies-dark.svg` | 873 B | static SVG |
| `badge-no-dependencies-light.svg` | 875 B | static SVG |
| `badge-side-view-dark.svg` | 917 B | static SVG |
| `badge-side-view-light.svg` | 919 B | static SVG |
| `btn-agent-skill-dark.svg` | 952 B | static SVG |
| `btn-agent-skill-light.svg` | 954 B | static SVG |
| `btn-docs-dark.svg` | 932 B | static SVG |
| `btn-docs-light.svg` | 934 B | static SVG |
| `btn-evidence-dark.svg` | 913 B | static SVG |
| `btn-evidence-light.svg` | 915 B | static SVG |
| `btn-gallery-dark.svg` | 991 B | static SVG |
| `btn-gallery-light.svg` | 993 B | static SVG |
| `btn-quick-start-dark.svg` | 847 B | static SVG |
| `btn-quick-start-light.svg` | 849 B | static SVG |
| `contribute-dark.webp` | 296.2 KB | 1280x300, 156 frames, 5.20 s loop, 30.0 fps |
| `contribute-light.webp` | 348.7 KB | 1280x300, 156 frames, 5.20 s loop, 30.0 fps |
| `feature-any-body-from-numbers-dark.webp` | 359.4 KB | 420x260, 90 frames, 3.00 s loop, 30.0 fps |
| `feature-any-body-from-numbers-light.webp` | 459.5 KB | 420x260, 90 frames, 3.00 s loop, 30.0 fps |
| `feature-characters-that-touch-dark.webp` | 262.6 KB | 420x260, 120 frames, 4.00 s loop, 30.0 fps |
| `feature-characters-that-touch-light.webp` | 293.4 KB | 420x260, 120 frames, 4.00 s loop, 30.0 fps |
| `feature-moods-change-the-walk-dark.webp` | 136.4 KB | 420x260, 118 frames, 3.93 s loop, 30.0 fps |
| `feature-moods-change-the-walk-light.webp` | 143.2 KB | 420x260, 118 frames, 3.93 s loop, 30.0 fps |
| `feature-one-line-of-script-dark.webp` | 115.6 KB | 420x260, 120 frames, 4.00 s loop, 30.0 fps |
| `feature-one-line-of-script-light.webp` | 119.1 KB | 420x260, 120 frames, 4.00 s loop, 30.0 fps |
| `feature-physics-that-settles-dark.webp` | 108.3 KB | 420x260, 104 frames, 4.00 s loop, 26.0 fps |
| `feature-physics-that-settles-light.webp` | 113.1 KB | 420x260, 104 frames, 4.00 s loop, 26.0 fps |
| `feature-speech-and-lip-sync-dark.webp` | 276.3 KB | 420x260, 96 frames, 3.20 s loop, 30.0 fps |
| `feature-speech-and-lip-sync-light.webp` | 323.8 KB | 420x260, 96 frames, 3.20 s loop, 30.0 fps |
| `header-dark.webp` | 1020.4 KB | 1280x360, 210 frames, 7.00 s loop, 30.0 fps |
| `header-light.webp` | 1277.0 KB | 1280x360, 210 frames, 7.00 s loop, 30.0 fps |

Total of the new graphics: **5.53 MB** (32 files). The old `header.svg` and `btn-*.svg` (no theme suffix) are untouched.

## Snippets to paste

### Header

```html
<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/header-dark.webp"><img src="docs/img/header-light.webp" alt="CharAI: draw any person as data, direct them with a script" width="1280"></picture>
</p>
```

### Button row

The links are the ones the readme already uses; change them if the targets move.

```html
<p align="center">
  <a href="#quick-start"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/btn-quick-start-dark.svg"><img src="docs/img/btn-quick-start-light.svg" alt="Quick start"></picture></a>
  <a href="#gallery"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/btn-gallery-dark.svg"><img src="docs/img/btn-gallery-light.svg" alt="Gallery"></picture></a>
  <a href="#evidence-in-short"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/btn-evidence-dark.svg"><img src="docs/img/btn-evidence-light.svg" alt="Evidence"></picture></a>
  <a href="docs/"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/btn-docs-dark.svg"><img src="docs/img/btn-docs-light.svg" alt="Docs"></picture></a>
  <a href="SKILL.md"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/btn-agent-skill-dark.svg"><img src="docs/img/btn-agent-skill-light.svg" alt="Agent skill"></picture></a>
</p>
```

### Badge row

```html
<p align="center">
  <a href="LICENSE"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/badge-apache-2-dark.svg"><img src="docs/img/badge-apache-2-light.svg" alt="Apache 2.0"></picture></a>
  <picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/badge-side-view-dark.svg"><img src="docs/img/badge-side-view-light.svg" alt="Side view"></picture>
  <picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/badge-no-dependencies-dark.svg"><img src="docs/img/badge-no-dependencies-light.svg" alt="No dependencies"></picture>
</p>
```

### Feature grid (centred block that wraps: two cards a row on a desktop readme, one on a phone)

```html
<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/feature-any-body-from-numbers-dark.webp"><img src="docs/img/feature-any-body-from-numbers-light.webp" alt="Any body from numbers: six very different bodies jump for joy" width="400"></picture>
  <picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/feature-physics-that-settles-dark.webp"><img src="docs/img/feature-physics-that-settles-light.webp" alt="Physics that settles: hair and scarf swing and settle after a stop" width="400"></picture>
  <picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/feature-moods-change-the-walk-dark.webp"><img src="docs/img/feature-moods-change-the-walk-light.webp" alt="Moods change the walk: happy, sad and angry" width="400"></picture>
  <picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/feature-speech-and-lip-sync-dark.webp"><img src="docs/img/feature-speech-and-lip-sync-light.webp" alt="Speech and lip sync: a close-up of a baker talking" width="400"></picture>
  <picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/feature-characters-that-touch-dark.webp"><img src="docs/img/feature-characters-that-touch-light.webp" alt="Characters that touch: a hug" width="400"></picture>
  <picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/feature-one-line-of-script-dark.webp"><img src="docs/img/feature-one-line-of-script-light.webp" alt="One line of script: the line is typed while the character does it" width="400"></picture>
</p>
```

### Feature grid as a 3x2 table (cards shrink to 280 px wide, titles get small)

```html
<table>
  <tr>
    <td align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/feature-any-body-from-numbers-dark.webp"><img src="docs/img/feature-any-body-from-numbers-light.webp" alt="Any body from numbers: six very different bodies jump for joy" width="280"></picture></td>
    <td align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/feature-physics-that-settles-dark.webp"><img src="docs/img/feature-physics-that-settles-light.webp" alt="Physics that settles: hair and scarf swing and settle after a stop" width="280"></picture></td>
    <td align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/feature-moods-change-the-walk-dark.webp"><img src="docs/img/feature-moods-change-the-walk-light.webp" alt="Moods change the walk: happy, sad and angry" width="280"></picture></td>
  </tr>
  <tr>
    <td align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/feature-speech-and-lip-sync-dark.webp"><img src="docs/img/feature-speech-and-lip-sync-light.webp" alt="Speech and lip sync: a close-up of a baker talking" width="280"></picture></td>
    <td align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/feature-characters-that-touch-dark.webp"><img src="docs/img/feature-characters-that-touch-light.webp" alt="Characters that touch: a hug" width="280"></picture></td>
    <td align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/feature-one-line-of-script-dark.webp"><img src="docs/img/feature-one-line-of-script-light.webp" alt="One line of script: the line is typed while the character does it" width="280"></picture></td>
  </tr>
</table>
```

### Contribute card

```html
<p align="center">
  <a href="CONTRIBUTING.md"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/contribute-dark.webp"><img src="docs/img/contribute-light.webp" alt="Make CharAI better: draw a character, add an action, write an example film, fix a known issue" width="1280"></picture></a>
</p>
```

## Making more

- `node tools/webploop.cjs <film or .char> out.webp --from=0 --to=4 --w=420 --h=260 --bg=light` renders any film range as a loop
  (usage in the header comment of `tools/webploop.cjs`).
- `node docs/img/src/gfx-build.cjs [header|buttons|cards|contribute|all] [--only=<id>]` rebuilds all of the above from the films
  `films/header-hero`, `films/header-contribute` and `films/card-*` (needs Chrome or Edge, puppeteer-core and ffmpeg with libwebp).
- A loop is seamless when the film starts and ends at the same still pose (or with the character out of frame). The moods card is cut
  from a longer walk (film seconds 1.97 to 5.90) where the gait matches at both ends.
- ffprobe cannot read animated WebP; frame times are in the file's ANMF chunks, and Pillow reads the frames.
