# Course visual spec — the squared eighteen

Art direction for every course in the game. One footprint, six skins.

Machine-readable companions — treat these as the source of truth for numbers; this document
explains the reasoning behind them:

- [`course-themes.json`](./course-themes.json) — layout, route, terraces, archetypes, budgets
  and all six theme blocks.
- [`course-holes.json`](./course-holes.json) — per-hole geometry: tee, cup, every solid, water,
  ramp, tunnel and mover as coordinates in metres, plus the intended line for each hole.

Visual reference:

- Plot plan, palette plates, per-theme mock scenes —
  <https://claude.ai/code/artifact/ff04515e-6a7f-4c07-85f8-1544bfd3cdd6>
- All eighteen hole plans drawn to scale —
  <https://claude.ai/code/artifact/e6b27b50-8839-4841-824c-2cb5b2cb510a>

---

## 1. The plot

Every course is the same **108 × 108 m walled square**, divided into a **6 × 6 grid of 18 m
cells**. Holes take the dark squares of a checkerboard — 18 of the 36 cells. The light squares
are planting, paths and the two built pieces.

```
      A     B     C     D     E     F
   ┌─────┬─────┬─────┬─────┬─────┬─────┐
 1 │ 11  │  ·  │ 10  │ ◆LM │  9  │  ·  │   tier 2  (+1.2 m)
   ├─────┼─────┼─────┼─────┼─────┼─────┤
 2 │  ·  │ 12  │  ·  │  7  │  ·  │  8  │   tier 2
   ├─────┼─────┼─────┼─────┼─────┼─────┤
 3 │ 13  │  ·  │ 14  │  ·  │  6  │  ·  │   tier 1  (+0.6 m)
   ├─────┼─────┼─────┼─────┼─────┼─────┤
 4 │  ·  │ 15  │  ·  │  5  │  ·  │  4  │   tier 1
   ├─────┼─────┼─────┼─────┼─────┼─────┤
 5 │ 16  │  ·  │ 17  │  ·  │  3  │  ·  │   tier 0  (ground)
   ├─────┼─────┼─────┼─────┼─────┼─────┤
 6 │  ·  │ 18  │ HUT │  1  │  ·  │  2  │   tier 0
   └─────┴─────┴──▲──┴─────┴─────┴─────┘
                  entry
```

**The loop.** Holes 1–9 climb the east half, holes 10–18 come back down the west half. The two
halves meet at the halfway landmark (D1), which the walk from 9 to 10 passes straight through.
Both ends of the loop touch the hut, so the 18th green is close enough to the hut terrace that
people sitting there can watch it. No route segment crosses another, and no transition is more
than two cells.

**The climb.** Three terraces of 0.6 m rising toward the north landmark. The walk out is uphill,
the walk back is downhill, and the round finishes at the low point by the hut. This is the
course's readable spine — it gives an otherwise uniform grid a direction.

### Dimensions

| Element | Dimension |
| --- | --- |
| Plot, walled | 108 × 108 m |
| Cell | 18 × 18 m |
| Hole pad | 12 × 12 m |
| Planting collar | 3 m all round |
| Rail | 0.35 m high, 0.25 m thick |
| Terrace step | 0.6 m |
| Path | 3 m wide |
| Perimeter wall | 1.6 m, inset 1 m |
| Hut (C6) | 10 × 10 m, ridge 6 m |
| Landmark (D1) | 14 m max, never culled |

**Why 18 m cells.** The cell size is set by the camera, not the golf. A 12 × 12 m pad inside an
18 m cell leaves a 3 m collar on every side, which is exactly the room the third-person camera
needs to sit behind the player without clipping a rail or the perimeter wall. If the pad grows,
the camera starts punching through geometry on tee shots aimed at the plot edge.

---

## 2. The kit

Flat-shaded, vertex-coloured, **no albedo textures anywhere**. Identity comes from colour and
silhouette. That is what makes six full skins affordable.

- **One material per theme**, plus three specials: water, emissive, foliage alpha.
- **Ball** — 28 mm radius, about 30% oversized, used for *physics and render alike* so bounces
  match what you see. Near-white, with a contact-shadow disc that is always drawn even when the
  ball is in shadow, or it vanishes against dark turf.
- **Character** — 1.7 m, rim light from the key, own contact ellipse.
- **Camera** — 6.5 m behind, 2.5 m up, 18° down, 55° FOV. Frames a full 12 m pad from the tee
  with the character in the lower third.
- **Edges** — baked vertex AO along every rail base and terrace edge. It is the only shading
  trick used and it does most of the work.
- **Sky** — two-colour gradient dome. The theme's two sky values *are* the whole sky.

### Invariants — what a theme may not change

Six skins over one kit only works if the invariants really are invariant. A theme changes
colour, silhouette and prop; never geometry a player has learned to read.

1. The 36-cell grid, the route, the hut cell and the landmark cell are identical in every theme.
   Course-select is a repaint, not a relayout.
2. Pad 12 × 12 m, rail 0.35 m, same restitution. A bank shot learned on hole 4 works on hole 4 of
   every course.
3. Same three terraces on the same holes.
4. Same cup: diameter, black interior, pale lip ring, 0.9 m pole. Only the flag colour is themed.
5. **Turf stays between L\* 42 and 62** so a white ball and a character silhouette both read
   against it. Neon Arcade is the sole exception and pays for it with emissives.

### Budget, per frame

| Measure | Target |
| --- | --- |
| Draw calls | < 120 |
| Triangles on screen | < 150 k |
| Materials per theme | 4 |
| Shadow | 1 cascade, 1024, 50 m |
| LOD 0 — full detail | current + next hole |
| LOD 1 — props culled | within 40 m |
| LOD 2 — silhouette | beyond 40 m |
| Instanced | rails, tee plinths, flags, trees |

The landmark is the one object never culled. It is the player's compass on a course where every
hole is a similar square, and it is why it gets a 14 m allowance while nothing else clears 6 m.

---

## 3. Six mechanics, eighteen holes

Holes are built from six obstacle archetypes with fixed physics. Themes reskin them; they never
redefine them. Each appears exactly three times per course.

| Archetype | Physics | Shape |
| --- | --- | --- |
| **Bank** | restitution 0.62 | Angled kicker wall on one side. The teaching shape — it is hole 1 for a reason. |
| **Dogleg** | restitution 0.55 | L-shaped play area inside the square pad, corner blocked by a solid mass. |
| **Carry** | restitution 0.55 | Gap in the surface with an island green. Ball in the gap resets to the last safe point, +1 stroke. |
| **Ramp** | restitution 0.55 | Bridges a 0.6 m terrace step. Placed only where the tier actually changes, so the geometry explains itself. |
| **Tunnel** | restitution 0.55 | Enclosed run, entrance *and* exit visible from the tee. Ball hidden for at most 1.2 s or players think it has been eaten. |
| **Mover** | restitution 0.70, imparts velocity | One rotating or sliding blocker on a fixed 4 s cycle, phase-locked to the tee so a player can time it. |

Holes **6, 12 and 18** are signature holes and get the theme's hero prop at full scale. Hole 18
is a carry directly beside the hut — the finish is the one everybody watches.

| Hole | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cell | D6 | F6 | E5 | F4 | D4 | E3 | D2 | F2 | E1 | C1 | A1 | B2 | A3 | C3 | B4 | A5 | C5 | B6 |
| Tier | 0 | 0 | 0 | 1 | 1 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 1 | 0 | 0 | 0 |
| Type | bank | dogleg | carry | ramp | tunnel | **mover** | dogleg | mover | ramp | bank | tunnel | **carry** | dogleg | mover | ramp | tunnel | bank | **carry** |
| Par | 2 | 3 | 3 | 2 | 2 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 2 | 2 | 3 | 3 |

Front nine par 24, back nine par 24, **course par 48**.

### Hole plans

Each hole is a 12 × 12 m pad with the tee on the south edge and the cup somewhere in the
northern half. Full geometry — every solid, water body, ramp, tunnel mouth and mover, plus tee,
cup and intended line — is in [`course-holes.json`](./course-holes.json) in metres, origin at
the pad's bottom-left corner, y up. Shape kinds:

| Kind | Meaning |
| --- | --- |
| `mass` | Solid block. Rails apply; ball rebounds. |
| `water` | Ball resets to the last safe point, +1 stroke. |
| `up` | Raised shelf, +0.6 m above the pad floor. |
| `turf` | Surface restored over water — islands, causeways, bridges. |
| `ramp` | Climbs or descends the 0.6 m step. |
| `riser` | The step face itself. Stops a ball that misses the ramp. |
| `mover` | `gate` (sweeping, timable), `slide` (oscillating bar), `spin` (continuous, no gap). |

Run `node scripts/validate-holes.mjs` after any change to the geometry. It checks, without
needing a physics engine, that every tee and cup sits on playable surface, no line passes
through a solid, every mid-line bend happens at a real wall and obeys the reflection law, water
is only crossed where a hole is meant to carry it, risers are only crossed by a ramp, and no
hole's intended route needs more strokes than its par. CI runs it on every push.

It caught three real bugs on its first run, all since fixed:

- **Hole 1's funnel bounce was 24° off a true mirror.** A ball arriving that steeply is thrown
  back down the pad, not gathered into the cup.
- **Hole 5's second tunnel was unreachable.** The mouth is vertical and the tee sits at x=6, so
  no ball can enter it on the fly; the "quicker" route actually took three strokes on a par 2.
  The hole now has one 2 m mouth.
- **Hole 7's chamfer sat above the bottom corridor.** The tee shot ran almost parallel to the
  face, so the rebound went straight back into the block. Replaced with hole 2's floor wedge,
  mirrored, which the corridor can actually reach.

All six bank lines on the course are now solved exactly — every bounce is within 0.2° of a true
mirror, so the drawn line is the line the ball takes.

Three shaping decisions worth keeping when the geometry gets tuned:

1. **Hole 1 has no obstacle at all** — two wedges funnel the top of the pad into the cup. It is
   the hole that teaches a player that walls are friendly, and it should stay almost impossible
   to fail.
2. **Hole 16 is deliberately the easiest on the course.** It sits two before the finish so the
   round lifts before 17 and 18 bite. Do not "balance" it away.
3. **Hole 17 is the only blind cup** and the only two-cushion hole. It is the difficulty peak;
   18 is a spectacle, not a test.

---

## 4. The six themes

Full palettes, lighting blocks, prop reskins, hut and landmark descriptions are in
[`course-themes.json`](./course-themes.json). Summary:

| # | Theme | Unlock | Turf | Rail | Ground | Accent | Character |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Tropical Lagoon** | default | `#4FB86A` | `#E8DCC0` | `#D9C79A` | `#FFB93B` | Sunset key at 14°, bleached bamboo, lagoon carries |
| 2 | **Alpine Pines** | course 1 | `#3E8F63` | `#6B4A32` | `#6E7C63` | `#E2574B` | High key at 42°, dark timber, snow above the treeline only |
| 3 | **Desert Mesa** | course 2 | `#6E9E4E` | `#B4653C` | `#D89A63` | `#F2A03D` | Hard key at 62°, ground out-saturates turf so rails go dark |
| 4 | **Zen Garden** | course 3 | `#5FA36B` | `#3E3A36` | `#DCD6C8` | `#C9412F` | Raked gravel and charcoal timber, one red object per view |
| 5 | **Neon Arcade** | course 4 | `#16203A` | `#0E1428` | `#090C18` | `#FFF04D` | Night, emissive-led, bloom 0.70 |
| 6 | **Haunted Grove** | all courses | `#3E6B4A` | `#4A3A46` | `#2E2A34` | `#8AE05C` | Twilight, ankle-height ground fog, pads read as lit stages |

Two themes carry a caveat, recorded in the JSON as `notes`:

- **Neon Arcade** sits below the L\* 42–62 turf band by design. The ball gets a small emissive
  halo and the character gets a fill light instead of a rim light.
- **Haunted Grove** ground fog is a separate ankle-height plane, not the distance fog. Keep it
  below the rail line so it never hides the ball.

---

## 5. Order of work

Sequenced so the visual work lines up with hole 1 being the proving ground.

1. **The kit at Tropical Lagoon values, on one pad.** Ground, rail, turf, tee plinth, cup, flag,
   ball, contact shadows, camera framing. That is the whole visual risk concentrated in one hole.
2. **The empty course.** Grid, walls, paths, hut, landmark — no holes. Walk the route. If the loop
   does not feel like a place, no amount of prop work fixes it.
3. **The six mechanics as grey blockouts**, before any theme props exist.
4. **Tropical props and lighting to final.** Lock it. This becomes the reference every other
   theme is graded against.
5. **Themes 2–6 as pure data swaps** — palette, six prop meshes, one hut skin, one landmark, one
   lighting block. If any of them needs a code change, the kit was wrong.

Schedule **Neon Arcade fifth, not last**. It is the one theme whose look depends on
post-processing rather than palette, and it will surface any assumption the renderer makes about
a lit daytime scene. You want that to happen while there is still time to act on it.
