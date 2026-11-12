# Telemetry Reference — tabletop Geometric Fidelity

<!-- GS spec | domain: core gameplay / movement | verify gate: tests/unit/simulation/XWingTelemetryReference.test.ts -->

## Purpose

Define the authoritative geometric reference that the game's per-cycle movement
(`resolveManeuver` in [src/systems/MovementSystem.ts](../../src/systems/MovementSystem.ts))
MUST reproduce, so that in-game speed, turn radius, and facing change match the
Tabletop **classic tabletop dogfighting games 2.0** the game is based on.

This is a **Verifiable** GS artifact: every load-bearing obligation below is a
capitalized RFC 2119 keyword, and each `MUST` is asserted by the gate test
`XWingTelemetryReference.test.ts`. The analyzer `scripts/analyze_telemetry.ts`
reports live/simulated telemetry against this table.

## 1. Physical reference (tabletop, official components)

Tabletop uses cardboard **maneuver templates** and plastic **ship bases**. A ship
executes a maneuver by fitting the template between the front of its base and the
back of the base at the destination. Center-to-center displacement therefore equals
**template length + one base size**.

### 1.1 Straight maneuver templates (millimetres)

| Speed | Template length (mm) |
|------:|---------------------:|
| 1     | 40                   |
| 2     | 80                   |
| 3     | 120                  |
| 4     | 160                  |
| 5     | 200                  |

Straight template length = `speed × 40 mm`. (Community-measured official templates;
the 1-straight template is ~40 mm and each speed adds one 40 mm segment.)

### 1.2 Ship bases (millimetres, square)

| Base   | tabletop (mm) |
|--------|----------------:|
| small  | 40              |
| medium | 60              |
| large  | 80              |

### 1.3 Turn angles

| Maneuver | Facing change |
|----------|--------------:|
| straight | 0°            |
| bank     | 45°           |
| turn (hard) | 90°        |
| K-turn (Koiogran) | 180° |
| Segnor's Loop | bank, then rotate 180° → +135° for a left loop, −135° right |
| Tallon Roll | 90° template, 180° facing |

### 1.4 Turn/bank chord geometry (true circular arc)

A bank/turn template is a circular arc. For an arc that changes facing by θ, the
straight-line **chord** from entry to exit makes an angle of **θ/2** with the entry
heading. Therefore the normalized chord unit vector (screen coords, forward = −Y) is:

- **bank (θ = 45°)**: chord angle = 22.5° → `(sin 22.5°, −cos 22.5°) = (0.3827, −0.9239)`
- **turn (θ = 90°)**: chord angle = 45° → `(sin 45°, −cos 45°) = (0.7071, −0.7071)`

## 2. Derived screen mapping

The game's straight template length is `speed × SPEED_SCALE_FACTOR` with
`SPEED_SCALE_FACTOR = 40` ([src/config.ts](../../src/config.ts)). This yields the
canonical scale:

> **S = 1 px per 1 mm** (straight templates map 1:1 to tabletop).

At S = 1 px/mm the reference base sizes are small 40 px, medium 60 px, large 80 px.

## 3. Normative obligations (gates)

- **MOV-1 (MUST)** — Straight displacement magnitude MUST equal
  `speed × 40 + baseSize` px for every speed 1–5. *(matches tabletop straight template
  at S = 1 px/mm.)*
- **MOV-2 (MUST)** — Facing change MUST be: straight 0°, bank ±45°, turn ±90°,
  K-turn 180°, Segnor left +135° / right −135° (bank then rotate 180°, nose
  back toward the start), Tallon ±180°.
- **MOV-3 (MUST)** — The 90° turn chord unit vector MUST equal `(±0.7071, −0.7071)`
  within ±0.001 (true circular quarter-arc).
- **MOV-4 (MUST)** — Per-cycle displacement MUST be constant across cycles for a
  fixed (speed, direction, baseSize); no acceleration/tunneling. Cycle duration MUST
  be `CYCLE_DURATION_MS = 500`.
- **MOV-5 (MUST)** — The bank chord unit vector MUST equal `(±0.3827, −0.9239)`
  (true 45° arc). *(Resolved 2026-10: banks previously used a 30° chord.)*
- **MOV-15 (MUST)** — During a cycle the ship MUST ride the template's true
  circular arc with its nose tangent to it. A 90° turn sweeps 180°/s on radius
  L/√2; a 45° bank sweeps 90°/s on radius L/(2·sin 22.5°) ≈ 1.31·L. K-turn,
  Segnor and Tallon add their extra rotation progressively, in the arc's
  direction, while the ship keeps moving. Fighters fly the arc at a constant
  rate; capitals ease in (t²).
- **MOV-6 (SHOULD)** — Ship base sizes SHOULD use S = 1 px/mm (small 40, medium 60,
  large 80). **KNOWN DEVIATION:** `SHIP_SIZES` uses small 32, medium 48, large 64
  (S = 0.8 px/mm on bases while templates use S = 1.0). Ships therefore travel ~25%
  farther relative to their own footprint than the tabletop. Tracked by ADR-0001.

## 4. Real-time interpretation

Tabletop is turn-based. The game plays one maneuver per `CYCLE_DURATION_MS = 500 ms`
cycle. The equivalent continuous speed for a straight is:

`v = (speed × 40 mm) / 0.5 s = speed × 80 mm/s` at tabletop scale.

This is the reference "real-time" speed used when narrating telemetry; it is a
derived quantity, not an independent gate.

## 5. Verification

- Pure-function gate: `tests/unit/simulation/XWingTelemetryReference.test.ts`.
- Live/simulated report: `npx tsx scripts/analyze_telemetry.ts`
  (optionally `--samples <telemetry.json>` from a Playwright `?debug=1` run to
  confirm the running game matches the pure function).
- Multi-cycle flight battery: `tests/unit/simulation/flight/` (see §6).

## 6. Multi-cycle flight battery

Single-maneuver checks cannot catch errors that only show up over time: drift,
dropped time, actions that get undone, wrap seams. The battery flies ships
through the **same per-tick motion step the scene runs**
(`src/arcade/systems/ShipMotion.ts`, via
`src/simulation/flight/ArcadeFlightRecorder.ts`). After every cycle it compares
the ship's pose with an independent oracle built from the tabletop rules
(`src/simulation/flight/XWingFlightOracle.ts`).

Telemetry is recorded in two frames:

- **Absolute.** Each sample is wrapped world coordinates (what the scene
  stores) plus an unwrapped track that accumulates the torus displacement, so
  a ship crossing the seam stays in one continuous frame.
- **Relative.** Pursuit tests compare two recorded flights cycle by cycle
  (separation and closing rate).

Obligations:

- **MOV-7 (MUST)** — Every ship, capitals included, MUST end each of N
  consecutive cycles of every dial maneuver on the oracle pose (±0.5 px,
  ±0.1°), starting from a non-axis heading.
- **MOV-8 (MUST)** — Speed 0 MUST hold position (no base-length hop).
- **MOV-9 (MUST)** — On the scene's fixed 60 Hz tick, a cycle MUST last
  exactly `CYCLE_DURATION_MS` unless a human's turn cuts it (MOV-16). Time past
  the boundary carries into the next cycle. The same plan MUST land on the same poses at any tick length.
- **MOV-10 (MUST)** — A boost displaces the ship and the maneuver in progress
  together. The cycle MUST finish `BOOST_DISTANCE_PX` (300 px) further along,
  not snap back.
- **MOV-11 (MUST)** — A barrel roll MUST slide the ship sideways by one
  speed-2 template plus its base (112 px on a small ship), with heading
  unchanged. It is not a bank.
- **MOV-12 (MUST)** — Crossing the battlefield seam MUST NOT jump the ship.
  A tick's displacement stays within a fraction of a template.
- **MOV-13 (MUST)** — Two ships flying the same plan keep a constant
  separation. One speed step faster closes the gap by one template unit
  (40 px) per cycle.
- **MOV-14 (MUST)** — Closed loops close: four hard turns, or two K-turns,
  bring a ship back to its start pose.
- **MOV-15 (MUST)** — An uninterrupted cycle still ends on its template
  (≤ 2 px / 1°) however many cycles a human has cut before it.
- **MOV-16 (MUST)** — A cycle a human's turn cuts ends EXACTLY on the template
  arc at the progress it was cut (`predictArcPose`, the prefix of its path), and
  the requested maneuver then flies as a full template from that pose
  (docs/specs/flight-controls.md, "Instant turns").
- **MOV-17 (MUST)** — A cut leaves no heading discontinuity (a heading step
  per 60 Hz tick never exceeds the fastest maneuver's) and no position jump.
- **MOV-18 (MUST)** — Boost and barrel-roll distances (MOV-10 / MOV-11) are
  measured by `npm run analyze:telemetry`, which exits non-zero on any FAIL.
