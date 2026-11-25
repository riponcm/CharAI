<!-- previews: webp -->
# media/

Clips: 1280x720, H.264, MP4. Previews: animated WebP, 640 px wide, 24 fps, 7 s, looping (`<clip>.webp`).

## Clips

The first six were rendered on one warm backdrop with a ground line (`node tools/render.cjs <film> <out.mp4> --fps=30 --bg=warm --crf=23`), 30 fps.

| Clip | Shows | Duration | Size | Preview (7 s, from) | Preview size |
| --- | --- | --- | --- | --- | --- |
| `cast-lineup.mp4` | Six very different people in one line-up, waving and walking (films/cast) | 9 s | 1.53 MB | `cast-lineup.webp`, from 0.5 s | 1.41 MB |
| `toddler-and-captain.mp4` | The toddler runs to the captain, trips, cries, peekaboo (films/scene) | 20 s | 0.99 MB | `toddler-and-captain.webp`, from 2.5 s | 0.66 MB |
| `talk-voice.mp4` | Voiced talking scene in close-up, Windows voices, has audio (films/talk-voice); stereo AAC sound | 21 s | 1.69 MB | `talk-voice.webp`, from 0.5 s | 1.14 MB |
| `together.mp4` | Hug, loaf handover and scuffle (films/together) | 20 s | 1.54 MB | `together.webp`, from 11.5 s | 0.79 MB |
| `gallery-moods.mp4` | The same walk in four moods on three bodies (films/gallery-moods) | 24 s | 1.97 MB | `gallery-moods.webp`, from 3 s | 0.65 MB |
| `gallery-actions.mp4` | Ten catalogue actions on three bodies (films/gallery-actions) | 25 s | 1.48 MB | `gallery-actions.webp`, from 0.5 s | 0.77 MB |

## From the experiments

Original films from the measured tests in `docs/EVIDENCE.md`, made with an earlier version of the engine, before the motion clips, spring physics and soft limbs. Re-encoded from the originals to H.264 1280x720 at a lower bitrate, no sound; the Kai episodes are 24 fps, First Jump 30 fps. Token and time figures are from `docs/EVIDENCE.md`. "First Jump" was lost by CharAI on cost and looks and has not been re-run with the newer engine.

| Clip | Shows | Duration | Size | Preview (7 s, from) | Preview size |
| --- | --- | --- | --- | --- | --- |
| `kai-the-bridge.mp4` | Kai, episode 1 ("the bridge"): Claude Sonnet, 203,205 tokens, 10.9 min | 30 s | 3.17 MB | `kai-the-bridge.webp`, from 10 s | 1.00 MB |
| `kai-the-cave.mp4` | Kai, episode 2 ("the cave"): Claude Sonnet, 221,852 tokens, 13.9 min | 30 s | 3.24 MB | `kai-the-cave.webp`, from 10 s | 0.89 MB |
| `first-jump.mp4` | "First Jump" silhouette film: Claude Opus, 391,611 tokens, 35.7 min; CharAI lost this comparison on cost and looks | 30 s | 2.89 MB | `first-jump.webp`, from 12 s | 0.93 MB |
