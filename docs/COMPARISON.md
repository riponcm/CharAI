# With and without CharAI

"Without CharAI" means an AI agent hand-codes each film (SVG, canvas or three.js), with or without a style library. The measured baseline is the style-library workflow (Lemo-Opuscar). Figures are from [`EVIDENCE.md`](EVIDENCE.md).

| | Without CharAI | With CharAI |
| --- | --- | --- |
| A character | re-coded inside every film; in the baseline runs the agent rebuilt a body and its poses each time (13.9 KB of figures and 27.6 KB of poses in the silhouette film) | one skin file of 1.3 to 2.2 KB, reused unchanged in every scene |
| Cost of a new character | part of each film's cost, not separable | about 41,800 Claude Sonnet tokens and about 40 seconds |
| Animation code for a 30-second episode | 28.6 to 29.1 KB | 5.9 to 6.3 KB (script plus new actions) |
| Two 30-second episodes on Claude Sonnet | 667,202 tokens, 74 minutes | 425,057 tokens, 25 minutes |
| Two 30-second episodes on Claude Opus | 532,368 tokens, 39 minutes | 477,333 tokens, 33 minutes |
| A new action | key poses written into the film's own code | a 0.4 to 0.7 KB file, about 8,200 Sonnet tokens, fitted by the engine to every body |
| Spring physics, moods, lip sync, hugs and handovers | written again per film, if at all | built in; one script line each |
| On a smaller model | the smaller model cost more tokens and time than the larger one (667,202 against 532,368) | the smaller model was the cheapest run of all, working from the documents alone |
| Changing one moment afterwards | prompt again and regenerate; the rest may change too | edit one script line and render again; the same script always gives the same frames, so only what follows from your edit changes |
| A scenery-rich one-off film (30-second silhouette, Opus) | 318,987 tokens, 24.7 minutes, and the better-looking film | 391,611 tokens, 35.7 minutes: CharAI lost |
| Scenery, lighting, painted styles | whatever the agent or style library draws | none: characters only, the host supplies scenery |
| Views and 3D | anything the agent can code | side view only, no 3D |

These are single runs. The baseline's setup is not counted. The one-time cost of building the engine is on the evidence page and is not in these rows. The 5.9 to 6.3 KB is script plus new actions for episode 2 (2,349 + 3,551 and 2,054 + 4,264 bytes); the 28.6 to 29.1 KB is the baseline's animation code for the same episode.

## Use CharAI when

- you have recurring characters across scenes or episodes
- the video is long
- you have a token budget or a smaller model
- you need to change one moment without regenerating
- you want characters inside another tool's film

## Do not use CharAI when

- you want a single showpiece shot
- you want painted, photographic or 3D looks
- you need front or three-quarter views
- non-human characters are the main subject

## Why an engine, when new models can animate freehand? (November 2026)

Code-made animation by frontier models is improving fast, and one-off demos are impressive. Those films are generated from scratch each time, so the cost is paid again for every film and every change, and characters are re-drawn each time. CharAI does the repeated part once, which is what the rows above measure. It has been tried only with the Claude models named in the evidence page and has not been compared with any unreleased or newer model.

Full measurements, including the test CharAI lost: [`EVIDENCE.md`](EVIDENCE.md).
