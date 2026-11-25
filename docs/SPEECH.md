# SPEECH.md: CharAI faces and talking

Any actor can show feeling and speak a line from one script line. CharAI draws pictures
only; sound is added at render time (section 5).

## 1. Script calls

| Call | Channel | Meaning |
| --- | --- | --- |
| `face(mood, strength=1)` | face | brows, lids, smile and the face swaps of a mood, blended over 0.35 s. Moods: neutral, happy, excited, sad, angry, scared, surprised, determined, tired, proud, shy. strength 0..2 |
| `mood(name, strength=1)` | mood | the body's mood (`docs/ACTIONS.md`); it also sets the face, unless a later `face` line changes it |
| `say("text", for=0, track="", words="", beats=0)` | say | speak a line. `for` = seconds (0 = estimated, about 4.5 syllables a second plus pauses). `beats=1` adds small beat gestures of the near hand on stressed syllables |

Speech runs beside everything else: an actor can walk, wave or sit while talking. A new `say`
cuts the previous one. Automatic life is always on: blinks (also on every face change), small
eye darts, a nod on each stressed syllable, a brow lift on emphasis (the last strong word before
`!`, or a word in CAPITALS).

```
0    cam: frame(on=Mia, top=head, bottom=chest, x=0.4, over=0)
0.2  Mia: face(happy)
0.4  Mia: say("Good morning, little one!", for=1.8)
+0.3 Mia: face(sad, strength=0.7)
+0   Mia: say("I lost my hat.")
```

## 2. Timing sources, best first

1. **A track**: `say("text", track="lines/hello.json")`, a file in the film folder. Either
   Rhubarb Lip Sync JSON (`{"mouthCues":[{"start":0,"end":0.1,"value":"X"}, ...]}`; values A-H
   and X) or a plain list `[{"t": 0.0, "v": "rest"}, {"t": 0.12, "v": "mbp"}, ...]` with the
   nine names below. Give `for` the length of the clip.
2. **Word timings**: `words="0:Good 0.32:morning 0.9:little 1.15:one"`, start time and word,
   separated by spaces. Each word's mouth shapes are spelled out inside its slot.
3. **Text only**: the engine spells out the mouth shapes (English rules: m, b, p close the
   lips; f, v show the teeth on the lip; o, oo, w round the lips; ee, i, s, t show the teeth;
   l lifts the tongue; vowels open; the stressed syllable of each word opens wider and longer;
   commas and full stops rest the mouth). Text in other scripts (no Latin letters) gets a
   language-neutral open-close rhythm, one opening per character. The mouth rests at the end.

**Getting timings from voice tools** (nothing is downloaded by the engine): Rhubarb Lip Sync
(`rhubarb -f json -o hello.json hello.wav`) gives a track directly; forced aligners (Montreal
Forced Aligner, Gentle, aeneas) and most text-to-speech services that return word or phoneme
times give word timings: write them as `words="t:word ..."`. Without audio, text only is fine.

## 3. Mouth shapes (visemes)

Nine shapes, by name: `rest` (closed, relaxed), `mbp` (lips pressed), `ah` (wide open), `ee`
(wide, teeth), `oh` (round, open), `oo` (small, pursed), `fv` (upper teeth on the lower lip),
`l` (open, tongue up), `wq` (rounded, small). A mouth blends into the next over 70 ms, and a
closed `mbp` is always reached.

## 4. What a skin needs

- **The mannequin's head** (a skin with `build` and no `swaps.mouth`) draws all nine shapes from
  numbers, and draws brows, lids and a smile-to-frown blend from the face parameters. Nothing
  to add.
- **A drawn head** gives `swaps.mouth` (see `docs/RIG.md`, "Face swaps"). Any of the nine names
  it lacks falls back to the nearest shape it has, scaled: `ah` -> `open`; `ee` -> `grit`, else
  `open` squashed; `oh` -> `o`, else `open` narrowed; `oo` and `wq` -> each other, `o` or a
  small `open`; `fv` -> `grit` squashed, else closed; `l` -> `open` squashed; `rest` and `mbp`
  -> `neutral` or `closed`. So a skin with just `open` and `closed` talks acceptably, and one
  with the seven mood mouths (neutral, smile, open, o, worried, grit, sad) talks well.
- **A beard or a mask**: any `parts.head` or `parts.hair` piece whose point box has bottom below
  0.12, top below 0.62, height at least 0.12 and centre below 0.32 drops with the jaw while
  speaking, so a bearded face talks through its beard even with its mouth hidden.
- **Brows and eyes of a drawn head**: the face picks `brow` and `eye` swaps by mood (up, down,
  worried; wide, narrow, sad, happy, closed) and lifts the brows on emphasis.

## 5. Check and render

```
node tools/say.cjs shapes.png --skin=mia --shapes                 # the nine mouths of a skin
node tools/say.cjs line.png --skin=mia --text="Good morning!" --for=1.5 --mood=happy,sad
node tools/say.cjs line.png --skin=mia --film=myfilm --track=lines/hello.json --text="Hello"
node tools/render.cjs films/<film> out.mp4 --fps=30 --audio=films/<film>/lines/all.wav
```

`--audio` muxes a sound file under the picture (ffmpeg); its time 0 is the film's time 0, so
place each line's `say` at the time the line starts in the sound file.

## 6. Rules of thumb

- Frame talking close-ups with `cam: frame(on=X, top=head, bottom=chest)`; the camera follows
  the head, so a stoop or a nod stays in frame.
- Give `for` from the real line when there is audio; without audio, leave it out.
- Put `face(...)` just before `say`, and change it between lines, not inside one.
- Keep lines under about 4 seconds; split long speeches into several `say` lines with `+0.2`.
