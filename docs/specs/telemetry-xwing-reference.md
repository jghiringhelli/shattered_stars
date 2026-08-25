# Telemetry Reference — X-Wing 2.0 Geometric Fidelity

<!-- GS spec | domain: core gameplay / movement | verify gate: tests/unit/simulation/XWingTelemetryReference.test.ts -->

## Purpose

Define the authoritative geometric reference that the game's per-cycle movement
(`resolveManeuver` in [src/systems/MovementSystem.ts](../../src/systems/MovementSystem.ts))
MUST reproduce, so that in-game speed, turn radius, and facing change match the
tabletop **X-Wing Miniatures Game 2.0** the game is based on.

This is a **Verifiable** GS artifact: every load-bearing obligation below is a
capitalized RFC 2119 keyword, and each `MUST` is asserted by the gate test
`XWingTelemetryReference.test.ts`. The analyzer `scripts/analyze_telemetry.ts`
reports live/simulated telemetry against this table.

## 1. Physical reference (X-Wing 2.0, official components)

X-Wing 2.0 uses cardboard **maneuver templates** and plastic **ship bases**. A ship
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

| Base   | X-Wing 2.0 (mm) |
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
| Segnor's Loop | 135° reversed |
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

> **S = 1 px per 1 mm** (straight templates map 1:1 to X-Wing 2.0).

At S = 1 px/mm the reference base sizes are small 40 px, medium 60 px, large 80 px.

## 3. Normative obligations (gates)

- **MOV-1 (MUST)** — Straight displacement magnitude MUST equal
  `speed × 40 + baseSize` px for every speed 1–5. *(matches X-Wing straight template
  at S = 1 px/mm.)*
- **MOV-2 (MUST)** — Facing change MUST be: straight 0°, bank ±45°, turn ±90°,
  K-turn 180°, Segnor ±135°, Tallon ±180°.
- **MOV-3 (MUST)** — The 90° turn chord unit vector MUST equal `(±0.7071, −0.7071)`
  within ±0.001 (true circular quarter-arc).
- **MOV-4 (MUST)** — Per-cycle displacement MUST be constant across cycles for a
  fixed (speed, direction, baseSize); no acceleration/tunneling. Cycle duration MUST
  be `CYCLE_DURATION_MS = 500`.
- **MOV-5 (SHOULD)** — The bank chord unit vector SHOULD equal `(±0.3827, −0.9239)`
  (true 45° arc). **KNOWN DEVIATION:** the current template uses `(±0.5, −0.866)`
  (30° chord), making banks ~13 mm wider laterally at speed 1. Tracked by ADR-0001.
- **MOV-6 (SHOULD)** — Ship base sizes SHOULD use S = 1 px/mm (small 40, medium 60,
  large 80). **KNOWN DEVIATION:** `SHIP_SIZES` uses small 32, medium 48, large 64
  (S = 0.8 px/mm on bases while templates use S = 1.0). Ships therefore travel ~25%
  farther relative to their own footprint than the tabletop. Tracked by ADR-0001.

## 4. Real-time interpretation

X-Wing 2.0 is turn-based. The game plays one maneuver per `CYCLE_DURATION_MS = 500 ms`
cycle. The equivalent continuous speed for a straight is:

`v = (speed × 40 mm) / 0.5 s = speed × 80 mm/s` at tabletop scale.

This is the reference "real-time" speed used when narrating telemetry; it is a
derived quantity, not an independent gate.

## 5. Verification

- Pure-function gate: `tests/unit/simulation/XWingTelemetryReference.test.ts`.
- Live/simulated report: `npx tsx scripts/analyze_telemetry.ts`
  (optionally `--samples <telemetry.json>` from a Playwright `?debug=1` run to
  confirm the running game matches the pure function).
