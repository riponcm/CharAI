# CharAI: known issues

What is known to be wrong, missing or untested in the first release. Agents wrote all of the
code; no person has reviewed it line by line yet.

## Not in this release

- **Views.** Side view only. No three-quarter or front view, so arms cannot cross in depth and
  elbows cannot point out sideways.
- **Two-character actions not built:** walking hand in hand, lifting and carrying a child,
  pushing or pulling a heavy object, and chains of more than two characters.
- **One airborne phase per action.** A double hop needs two actions.

## Faults you may see

- **Hug with a small child.** A grown-up's arm is drawn behind the child but still passes the
  back of its head. A toddler's arms are too short to go round a large belly, so its hands
  rest on the front.
- **Very different sizes.** A toddler's punch can fall short of a grown-up's knee. A very fat,
  short-armed character reaches a toddler only by kneeling on the heels.
- **Handover.** The two hands meet slightly off the object. An object is taken from where the
  script placed it, not from where it was last dropped.
- **Long garments.** A standing ankle-length skirt follows the legs too closely. A large belly
  overlaps raised thighs.
- **Speech.** Lip sync matches the words but is not polished: mouths are small in side view,
  head nods are guessed from the text and not taken from the audio, and the mouth rests for
  about half a second at commas. A beard hides most mouth movement.
- **Foot slides.** The film checker warns of planted feet sliding 3 to 12 px for a single
  frame in several example films. These are warnings, not errors.
- **Paired actions are long.** With the walk-up they take 3 to 5 seconds. The table in
  `PAIRS.md` gives each length; use `speed=` or `for=` to change it.

## Untested

- The Remotion, HyperFrames and GSAP snippets in `HOSTS.md`.
- `<char-stage>` inside a real host application, and its `src` attribute over http.
- Any system other than Windows, and any Node version other than the one used to build it
  (Node 18 or newer is assumed).
- `tools/winvoice.cjs` works on Windows only, because it uses Windows speech.
- Films longer than 30 seconds.

## Documents longer than intended

`ACTIONS.md` and `PAIRS.md` are longer than their targets (about 1,900 and 1,550 words), which
costs an agent more tokens to read.
