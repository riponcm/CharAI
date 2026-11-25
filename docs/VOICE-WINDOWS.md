# Voicing a CharAI film with Windows speech

No download needed: `tools/winvoice.cjs` uses the built-in Windows voices (David male,
Zira female) and turns their viseme events into an engine timing track.

1. Make one folder `films/<name>/lines/`.
2. For each line:
   `node tools/winvoice.cjs "Fresh bread!" films/<name>/lines/b1.wav --voice=David --rate=-1`
   It writes `b1.wav`, `b1.json` (the `{t, v}` track) and `b1.words.json` (word start
   times), and prints the duration in seconds. `--rate` is -10..10; slightly negative
   suits a heavy character, positive a quick one.
3. In `film.char`, give each line `say("text", for=<duration>, track="lines/b1.json")`.
   Add a matching `caption:` line with the same start time.
4. Retime: start each line when the previous one ended plus about 0.4 s, so nothing
   overlaps. Keep camera, face and gesture lines near their line.
5. Build one sound file, placing each wav at its start time (milliseconds in `adelay`):
   `ffmpeg -i b1.wav -i s1.wav -filter_complex "[0]adelay=1100:all=1[a];[1]adelay=4800:all=1[b];[a][b]amix=inputs=2:normalize=0,apad=whole_dur=21[o]" -map "[o]" all.wav`
   Set `apad` to the film length so audio and video end together.
6. `node tools/check.cjs films/<name>` then
   `node tools/render.cjs films/<name> films/<name>/film.mp4 --fps=24 --audio=films/<name>/lines/all.wav`
7. Check sync: `node tools/sheet.cjs films/<name> strip.png --n=12 --from=T0 --to=T1`
   around an m, b or p (lips must be closed in the frame at start time plus the track time).

Viseme mapping: silence rest; p,b,m mbp; f,v fv; l, th, t, d, n l; ah, aa, ae, aw, ay,
h, k, g ah; ao, ow, oy oh; eh, iy, ih, s, z ee; w, uw oo; er, r, sh, ch wq.

Notes: the track covers the whole clip, so `for` should equal the duration. Speech
pauses at commas can be long (about 0.5 s), which the mouth rests through.
