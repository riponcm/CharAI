# DESIGN.md: the readme graphics

All files live in `docs/img/`. Every graphic has a light and a dark version; GitHub picks one with
`<picture>` and `prefers-color-scheme`. Paths below are relative to the repository root (the readme).
Cards and the contribute graphic are animated WebP at 30 fps, looping forever, seamless. The header is an animated SVG (a vector flip-book from `tools/svgloop.cjs`, 10 fps). Characters are the engine's own (`films/cast`, `skins/`), drawn live by the engine.

## Palette

Unslop's warm ramp plus one ember accent. The characters are the only colourful thing; a thin ink ground line they stand on is the signature in every graphic that has characters. No gradients between hues, no radial washes or glows. Type weights 400 and 500 (600 for the wordmark only), sentence case.

| Role | Light | Dark |
| --- | --- | --- |
| Panel / page | `#f7f4ee` | `#161513` (page `#12110f`) |
| Card | `#fdfbf7` | `#1c1a18` |
| Raised | `#efe9df` | `#262421` |
| Primary text, ground line | `#1f1b16` | `#efe9de` |
| Secondary text | `#5e554a` | `#aaa398` |
| Muted text | `#7b7266` | `#8a847a` |
| Hairline | primary at 8% | primary at 8% |
| Accent (ember), one small mark per graphic | `#c2410c` | `#f08a4b` |

Radius: panels 20, cards 14, buttons 10, badges 8. Accent use: header short bar above the wordmark; each card a 3 px bar beside its title; contribute a short bar above the title; "Quick start" button fill.

Colours follow unslop by Damir Sokolovsky (https://github.com/heydamir/unslop), CC BY 4.0.

## Files

| File | Size | Notes |
| --- | --- | --- |
| `badge-apache-2-dark.svg` | 699 B | static SVG |
| `badge-apache-2-light.svg` | 881 B | static SVG |
| `badge-no-dependencies-dark.svg` | 688 B | static SVG |
| `badge-no-dependencies-light.svg` | 870 B | static SVG |
| `badge-side-view-dark.svg` | 731 B | static SVG |
| `badge-side-view-light.svg` | 913 B | static SVG |
| `btn-agent-skill-dark.svg` | 768 B | static SVG |
| `btn-agent-skill-light.svg` | 950 B | static SVG |
| `btn-docs-dark.svg` | 749 B | static SVG |
| `btn-docs-light.svg` | 931 B | static SVG |
| `btn-evidence-dark.svg` | 729 B | static SVG |
| `btn-evidence-light.svg` | 911 B | static SVG |
| `btn-gallery-dark.svg` | 809 B | static SVG |
| `btn-gallery-light.svg` | 991 B | static SVG |
| `btn-quick-start-dark.svg` | 651 B | static SVG |
| `btn-quick-start-light.svg` | 836 B | static SVG |
| `contribute-dark.webp` | 287.1 KB | 1280x300, 156 frames, 5.20 s loop, 30 fps |
| `contribute-light.webp` | 344.3 KB | 1280x300, 156 frames, 5.20 s loop, 30 fps |
| `feature-any-body-from-numbers-dark.webp` | 343.4 KB | animated WebP, 420x260, 30 fps |
| `feature-any-body-from-numbers-light.webp` | 453.6 KB | animated WebP, 420x260, 30 fps |
| `feature-characters-that-touch-dark.webp` | 252.4 KB | animated WebP, 420x260, 30 fps |
| `feature-characters-that-touch-light.webp` | 294.0 KB | animated WebP, 420x260, 30 fps |
| `feature-moods-change-the-walk-dark.webp` | 131.7 KB | animated WebP, 420x260, 30 fps |
| `feature-moods-change-the-walk-light.webp` | 149.1 KB | animated WebP, 420x260, 30 fps |
| `feature-one-line-of-script-dark.webp` | 104.4 KB | animated WebP, 420x260, 30 fps |
| `feature-one-line-of-script-light.webp` | 116.2 KB | animated WebP, 420x260, 30 fps |
| `feature-physics-that-settles-dark.webp` | 103.3 KB | animated WebP, 420x260, 30 fps |
| `feature-physics-that-settles-light.webp` | 116.6 KB | animated WebP, 420x260, 30 fps |
| `feature-speech-and-lip-sync-dark.webp` | 263.3 KB | animated WebP, 420x260, 30 fps |
| `feature-speech-and-lip-sync-light.webp` | 317.5 KB | animated WebP, 420x260, 30 fps |
| `header-dark.svg` | 837.5 KB | animated SVG flip-book, 70 frames at 10 fps, 7.00 s loop, 1280x360, reduced-motion still kept |
| `header-light.svg` | 837.5 KB | animated SVG flip-book, 70 frames at 10 fps, 7.00 s loop, 1280x360, reduced-motion still kept |

The header is a vector SVG (no downloaded fonts: `system-ui, "Segoe UI", Helvetica, Arial, sans-serif`); everything else with characters is animated WebP.

## Snippets to paste

### Header

```html
<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/header-dark.svg"><img src="docs/img/header-light.svg" alt="CharAI: draw any person as data, direct them with a script" width="1280"></picture>
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
  `films/header` (header SVG, panel and text from `src/header-under.svgfrag`), `films/header-contribute` and `films/card-*` (needs Chrome or Edge, puppeteer-core and ffmpeg with libwebp; the header needs none).
- A loop is seamless when the film starts and ends at the same still pose (or with the character out of frame). The moods card is cut
  from a longer walk (film seconds 1.97 to 5.90) where the gait matches at both ends.
- ffprobe cannot read animated WebP; frame times are in the file's ANMF chunks, and Pillow reads the frames.
