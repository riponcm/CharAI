# PAIRS.md: CharAI actions for two

One script line drives two actors:

```
2.0  Kai: hug(with=Tot)
+0   Vera: give(with=Skye, prop=loaf)
```

Kai walks (or turns) to the right distance, Tot turns to face Kai, then both play their role from the
same moment on one clock. The line ends when both roles end and occupies both actors: a later `+0`
line of either one waits for it (`check --timeline` lists the line under both names), and an absolute
time inside it warns that it cuts the pair short.

## 1. The file

A paired action is one file in `actions/` (or a film's `actions/`), like a single action with two roles:

```js
(function (g) { (g.CharActions = g.CharActions || {}).hug = {
  pair: true, doc: 'arms round each other, a squeeze, let go', gap: 0,
  a: {                                     // the one the line names (Kai)
    low: { pose: 'heels', lean: 20 },      // when the partner is a child
    keys: [
      { t: 0.45, handNear: ['front', -0.15, 0.05], hands: 'open' },
      { t: 0.9, lean: 9, handNear: 'partner.around', handFar: ['partner.around', 0, 0.1] },
      { t: 1.25, lean: 14, chest: 0.96, handNear: 'partner.around', handFar: ['partner.around', 0, 0.1] },
      { t: 1.95, lean: 9, handNear: 'partner.around', handFar: ['partner.around', 0, 0.1] },
      { t: 2.45, pose: 'stand', hands: 'relaxed' },
    ] },
  b: { keys: [ ... ] },                    // the partner (Tot), same clock
}; })(typeof self !== 'undefined' ? self : this);
```

| Field | Meaning |
|---|---|
| `pair: true` | this file is a pair |
| `doc` | one line |
| `gap` | the closest the two torsos come while a hand is on the partner, in arm lengths of the shorter arm: 0 a hug, 0.3 a shove, 0.5 a handshake or a hand-over, 0.7 a punch, 4 a throw |
| `args` | extra arguments both roles get, for example `{ prop: '' }` |
| `a`, `b` | the two roles. Each is an action as in `docs/ACTIONS.md`: `keys`, `planted`, `end`, `face`, `anticipation` and so on |

Everything in `docs/ACTIONS.md` works in a role. Write each role as if the partner stood in front,
facing you. Both roles share one clock: a key at 0.6 in `a` and a key at 0.6 in `b` happen together,
whatever the two bodies weigh or feel (moods still colour posture, not timing).

## 2. Hands on the partner

A hand target can be a place on the partner: `handNear: 'partner.back'`, or with an offset
`['partner.shoulder', 0, -0.4]` (forward, up, in your own head heights).

| Target | Where |
|---|---|
| `partner.head`, `partner.top`, `partner.face` | the head; the top of it (a pat on a child's head); the face |
| `partner.shoulder` | on top of the shoulder (offset down for the upper arm) |
| `partner.chest`, `partner.belly` | the front of the body |
| `partner.back`, `partner.waist` | the back at chest height; the lower back |
| `partner.side` | the flank, halfway through the body |
| `partner.around` | round the body at your own chest height, as far as your arm goes: the hug target |
| `partner.front` | the nearest point of the partner's front, body or knee: what a child can reach on a grown-up |
| `partner.hip`, `partner.knee` | |
| `partner.hand` | if the partner's key also says `partner.hand`, both hands meet halfway, at the shorter one's chest (a handshake; offsets raise it: a high five uses `['partner.hand', 0, 1.2]`). Otherwise the partner's hand as drawn (a block meets the fist) |
| `partner.arm` | the partner's forearm |

How it works: a key aims the arm at where the partner is expected; then, every frame, after both
bodies have breathed, swayed and taken their mood, the stage puts the hand exactly on the partner's
point as drawn. A hand stays on the partner from a key that names a place until the next key on that
hand that names something else, so two keys with the same target hold the contact between them.

## 3. Different sizes

The engine tells each role how the two compare:

- `low: { ... }` on a role: fields that replace those of every key (except `pose` and `stand` keys)
  when the partner is under 0.6 of your height (a grown-up with a child). Typical:
  `low: { pose: 'heels', lean: 20 }` (both knees down) or `low: { crouch: 0.4, lean: 20 }`.
- `high: { ... }` the same when the partner is over 1.65 of your height (a child with a grown-up),
  typically `high: { handNear: 'partner.front' }`.
- `low` and `high` inside one key replace that key's fields only and win over the role's.
  Put hand targets in key-level `low`/`high` (on the keys that touch), and posture in the role's.
- Keys may be functions of the arguments: `x: a => -0.3 * a.push`. A role gets `a.size` (partner
  height / yours), `a.push` (partner weight / yours, 0.2..5), `a.apart` (distance at the start, your
  head heights) and the line's own arguments.
- A taller body also leans down by itself when a key's target on the partner is out of reach.

Scale reactions with `push`: a shove moves the partner `-0.55 * s(a)` leg lengths where
`s = a => Math.max(0.35, Math.min(2.2, a.push))`. Keep the receiver still (`x: 0`) until the hit
lands, so the hit lands.

## 4. Placement, layering, contact

- A walks to the distance where the torsos come `gap` apart while touching, measured on the drawn
  bodies (a belly or an apron counts), then corrected: torsos never overlap, and a hand that falls
  short brings the two closer while there is room.
- While a hand is on the partner the two are drawn together: both far arms, then both bodies, then
  both near arms. An arm round a back goes behind the partner; the near arm lies over them.
- A gap of less than a leg length is closed with a quick step (`stepback`, forward or back) instead of
  a walk. After the release, if the two would stand closer than a third of an arm (or `gap`), A
  steps back, so two actors never rest inside each other.
- After a hit lets go, the partner may stagger or fall anywhere; their feet follow their own keys
  (`planted: 'none'` on a staggering role).
- A role that touches a partner under 0.6 of its height and has no `low` kneels on the heels; a
  role's lean is kept within 50 degrees forward, so reaching down never topples.
- A grown-up's arm round a child's back is drawn behind the child (it shows on the child's back,
  not across its face). A walking stick in a hand that touches the partner is tucked along the forearm.
- `cam: frame(on=A+B)` keeps both whole, heads, feet and hands, for any two sizes (`pad=` widens it).

## 5. Props in pairs

A key with `give: true` in role `a` and `take: true` in role `b` hands the line's `prop` over at those
moments. `release: true` and `catch: true` throw it: it flies on an arc from the hand to the catching
hands. See `docs/PROPS.md`.

## 6. The reference pairs and how long they take

Every pair takes `speed=` (2 = twice as fast) or `for=` (seconds for the action itself). A line lasts:
the walk-up (about 0.6 s for a step, a walk at the actor's pace, often 1-2 s, for more than a leg
length), plus the action below at speed 1, plus about 0.45 s to stand, plus 0.6 s if A steps back.

| Name | Gap | Action | What |
|---|---|---|---|
| `hug` | 0 | 2.5 s | arms round each other, a squeeze, let go; a grown-up kneels on the heels for a child |
| `handshake` | 0.55 | 2.0 s | hands meet halfway, three pumps |
| `highfive` | 0.6 | 1.3 s | hands raised, slapped above the shorter one's head |
| `pat` | 0.45 | 1.6 s | three pats on the shoulder; a child's head; a grown-up's knee from a child |
| `shove` | 0.3 | 1.6 s | two hands to the chest, the partner staggers back by weight |
| `punchblock` | 0.7 | 1.2 s | a play punch at the face, met by the forearm |
| `punchfall` | 0.65 | 1.3 s | a cartoon punch, the partner falls on the back and stays down |
| `give` | 0.5 | 1.3 s | hand over a prop: `give(with=B, prop=loaf)`; a giver not holding it picks it up first (+2-4 s) |
| `throwto` | 4 | 1.8 s | throw a prop, the partner catches it: `throwto(with=B, prop=ball)` |

A film that writes its own pairs (as `films/together/` does) times them the same way.

Not expressible yet: walking hand in hand, lifting and carrying a person (one body would have to move
the other's root), a chain of more than two.

## 7. Check and look

```
node tools/actioncheck.cjs actions/hug.js                 fields, partner targets, a toddler and an adult both ways
node tools/action.cjs hug out.png --skin=captain+tot,vera+skye     a strip per pair (with= is added)
node tools/action.cjs give out.png --skin=vera+skye --props=loaf --hold=loaf
```

Look at the strips: hands on the partner, no body through another, the smaller one not lost behind
the bigger, the reaction size fitting the weights.
