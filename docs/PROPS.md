# PROPS.md: objects the CharAI actors use

A prop is one file in `extras/props/` (shared) or a film's `props/`, drawn in stage pixels at the usual
actor scale (a 7-head grown-up is about 420 px tall at `scale=60`). Copy `extras/props/box.js`.

## 1. The grip contract

| Field | Meaning |
|---|---|
| `name` | as the file |
| grip | the point the hand closes on is the origin (0, 0) of the drawing; draw around it, y down |
| `base` | `[x, y]` of the point that rests on the ground |
| `size` | `[w, h]` px, for reach and layout |
| `weight` | 0 (a loaf, a ball) .. 1 (a door). Over 0 the holder leans back by `0.3 * weight` rad and the knees give |
| `grips` | optional `{ near: [x, y], far: [x, y] }`: where two hands go on a big object (a box) |
| `seat` | optional `[x, y]`: where a sitter's hips go (a chair; relative to the grip). The sitter faces +x, the chair back is on the left |
| `upright` | optional `true`: it stands on the ground and is walked up to, knocked on, leaned on (a door, a wall). Its face is x = 0 of the drawing |
| `hang` | true: hangs and swings from the hand (a lantern, a bag); false: turns with the hand |
| `glow` | optional light, as in `lantern.js` |
| `draw(t, ctx)` | SVG string; `ctx = { held, swing }`. A pure function of `t` |

The five reference props: `loaf` (one hand, 0.05), `ball` (one hand, 0.03, spins), `box` (two hands,
0.6), `chair` (a seat, 0.35), `door` (an upright, 1).

## 2. In the script

```
prop box at 900
prop chair at 1300
prop door at 1700
1.0  Kai: pickup(prop=box)        walks up, squats, takes it at the key that reaches the ground, holds it at the chest
+0.5 Kai: putdown()               bends down to the ground
+0   Kai: drop(quiet=1)           lets go there (drop() alone lets it fall from the hand)
+0   Kai: sit(on=chair)           walks to it, turns, sits with the hips over the seat at its height
+1   Kai: standup()
+0   Kai: knock(on=door)          stands at the action's wall distance from the door's face
```

- `prop=<name>` on an action whose file reaches the ground (or has a key with `grab: true`): the
  actor walks so the hand lands on the prop, and holds it from that key (`hold(prop, weight)`).
- `on=<seat prop>` with `sit`: the seat height comes from the prop (`base` minus `seat`).
- `on=<upright prop>` with an action that has `wall:` (knock, lean, push): the actor stands that many
  leg lengths from the prop's face.
- `give(with=B, prop=loaf)` and `throwto(with=B, prop=ball)` are paired actions (`docs/PAIRS.md`):
  the prop changes hands at the keys marked `give`/`take`, or flies on an arc between `release`
  and `catch`. A giver who does not hold the prop walks to it and picks it up first; the taker
  holds it from the moment of the handover (`hold(prop, quick=1)`), so it never jumps.
- A prop with `grips` (the box) is held with the near hand on `grips.near` and the far hand on
  `grips.far`.
- Pages made by `tools/check.cjs` always load `actions/stepback.js` and `actions/pickup.js`, which the
  stage adds itself; a page built by hand must load them too.
- A prop is found at its `at` place; a prop already moved by an earlier action is taken from where
  the script placed it, not where it was dropped (place it again with a new `prop` line if needed).

## 3. Check and look

```
node tools/action.cjs "pickup(prop=box)" out.png --skin=gramps,tot --props=box@900 --fixed
node tools/action.cjs "sit(on=chair)" out.png --skin=vera,tot --props=chair@900 --fixed
node tools/action.cjs throwto out.png --skin=vera+skye --props=ball --hold=ball --zoom=0.9 --at=900
```

Not yet: pushing or pulling a heavy object along the ground (the prop does not move with the push),
a chair that faces left, a prop taken back from wherever it was dropped (it is taken from its `at`).
