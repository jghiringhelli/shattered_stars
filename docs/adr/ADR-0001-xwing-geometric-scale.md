# ADR-0001 — tabletop geometric scale for movement telemetry

- **Status:** Accepted
- **Date:** 2026-03-30
- **Deciders:** Project owner (jghiringhelli)
- **Related:** [docs/specs/telemetry-xwing-reference.md](../specs/telemetry-xwing-reference.md)

## Context

The game is based on the classic tabletop dogfighting games 2.0. To claim gameplay fidelity we
must map the tabletop's physical geometry (millimetres) to screen pixels and verify
in-game movement reproduces it. Two scale factors are in play today and they disagree:

- **Maneuver templates:** `SPEED_SCALE_FACTOR = 40`. Straight speed N = `N × 40` px,
  matching tabletop's `N × 40 mm` straight template at **S = 1.0 px/mm**.
- **Ship bases:** `SHIP_SIZES` = { small 32, medium 48, large 64 } px, i.e. 0.8× the
  official 40/60/80 mm bases — **S = 0.8 px/mm**.

Consequence: displacement (`speed × 40 + baseSize`) uses a base term that is 20%
smaller than the template term implies. Ships travel ~25% farther relative to their
own footprint than on the tabletop, and banks use a 30° chord instead of the true
45°-arc 22.5° chord.

## Decision

1. Adopt **S = 1 px/mm** as the single canonical scale, anchored by the straight
   templates (already correct, and the most gameplay-salient measurement).
2. Encode the reference and tolerances in `telemetry-xwing-reference.md` with RFC 2119
   gates. Straight length and all facing changes are **MUST** (they already pass).
3. The base-size scale mismatch (MOV-6) and bank chord (MOV-5) are recorded as
   **SHOULD** deviations, **not** silently changed. Changing `SHIP_SIZES` or the bank
   template alters collision, targeting-range feel, and every balance simulation, so it
   is gated behind a deliberate follow-up, not folded into telemetry instrumentation.

## Consequences

- The telemetry analyzer and gate test can ship now and pass on the MUSTs.
- The two SHOULD deviations are tracked, visible in every analyzer run, and can be
  resolved later by either (a) rescaling bases to 40/60/80 px, or (b) rescaling
  templates to `SPEED_SCALE_FACTOR = 32` — each a balance-affecting change requiring a
  full `headless_sim.ts --matrix` re-run and visual re-QA before adoption.
- No production code changes in this ADR; it establishes the reference only.

## Amendment — 2026-10: MOV-5 resolved

Ships now fly their templates along the true circular arc in real time
(MOV-15), so a bank that turns 45° MUST have its chord at 22.5°. A 30° chord
cannot be the chord of a tangent 45° arc. The bank template moved to the true
chord, and MOV-5 is promoted to MUST. MOV-6 (base scale) remains a tracked
SHOULD.
