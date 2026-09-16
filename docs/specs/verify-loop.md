# Verify Loop — Phase Collapse → Recover → Verify → Regenerate

<!-- GS spec | domain: verification harness | runner: scripts/verify_loop.ts -->

## Purpose

Operationalize the Generative-Specification verify step for the running game: drive
the real application at its boundary, detect divergence from this specification, and —
on failure — **regenerate from the spec**, not patch the symptom. "A broken
implementation is a complete specification with a bad executor; replace the executor."

This is the harness the project owner asked for: *collapse → recover → regenerate →
verify*, using Playwright + the game's expose-to-window hooks + optional Claude vision.

## The cycle

1. **COLLAPSE** — Force the game into a known scene and deterministic state by injecting
   a `battleConfig` into `game.registry` and starting the target scene. No menu
   navigation (removes flakiness). A fixed RNG seed makes the run reproducible.
2. **RECOVER** — Let the simulation run a fixed wall-clock window, then capture:
   ship states (`scene.ships`), projectile count (`scene.projectiles`), per-frame
   telemetry (`window.__shipTelemetry` via `?debug=1`), console/page errors, and a
   screenshot.
3. **VERIFY** — Assert the invariants below. Optionally add a Claude-vision check on the
   screenshot. Cross-check captured telemetry against the X-Wing reference
   (`docs/specs/telemetry-xwing-reference.md`).
4. **REGENERATE** — On any FAIL, the runner prints a regeneration block naming the
   failing invariant, the scene, and the exact spec + source files to reload (via
   `docs/spec-map.md`). The fix is a spec-grounded regeneration of that slice with full
   current file context, then the loop re-runs. Never weaken an invariant to pass.

## Invariants (gates)

- **INV-1 (MUST)** — Ship count in the live scene MUST equal the injected config total.
- **INV-2 (MUST)** — At least one player-owned ship MUST exist in player scenarios.
- **INV-3 (MUST)** — Every ship position and angle MUST be finite (no NaN/Infinity).
- **INV-4 (MUST)** — Every ship hull MUST satisfy `0 ≤ hull ≤ maxHull`.
- **INV-5 (MUST)** — Max per-frame telemetry step MUST be ≤ `5×SPEED_SCALE_FACTOR +
  SHIP_SIZES.huge` px (no teleport/tunneling); telemetry MUST contain no NaN steps.
- **INV-6 (MUST)** — No uncaught *fatal* console/page errors (WebGL/favicon noise and
  known re-entry logs filtered — see § Error classification).
- **INV-6b (SHOULD)** — No known re-entry noise. Reported, never fails the run.
- **INV-6c (SHOULD)** — No optional-asset load/decode failures. Reports the failing
  asset keys as an actionable worklist for the asset audit; never fails the run.
- **INV-7 (SHOULD)** — Vision check: the screenshot SHOULD show ships and HUD present
  and free of obvious rendering glitches. Skipped when `ANTHROPIC_API_KEY` is unset.

## Error classification

COLLAPSE forces a scene restart via registry injection. Phaser's `TextureManager.checkKey`
logs `Texture key already in use: ship_<id>` at error level when a runtime-loaded ship PNG
is re-added on scene re-entry. This is a **harness-induced re-entry artifact**, not a
gameplay-state defect: all state and motion invariants (INV-1…INV-5) stay green.

It is therefore classified as **known re-entry noise** (`KNOWN_REENTRY_ERRORS` in the
runner) and surfaced under INV-6b (SHOULD), not INV-6 (MUST). This mirrors the MOV-5/MOV-6
SHOULD deviations in the telemetry reference: documented and tracked, never silently
hidden. The genuine fix — idempotent scene texture registration so re-entry never re-adds —
is a tracked follow-up; it MUST NOT be resolved by weakening a MUST invariant.

Optional encyclopedia/ship art that fails to load or decode (`Failed to process file`,
`Failed to load resource`) is classified as **asset gaps** (`KNOWN_ASSET_ERRORS`) and
surfaced under INV-6c. The game already treats missing art as expected (BootScene silences
the warning and falls back to placeholders), so it is not a gameplay-state defect — but
each failing key names a real asset the asset-audit step must (re)generate. INV-6c prints
the deduped keys so the audit has a concrete worklist.

## Scenarios

Defined in `scripts/verify_loop.ts`. Each scenario boots its scene at the game boundary
via one of three start strategies: `registry` (set `battleConfig`, then `scene.start`),
`init` (`scene.start(key, data)`), or `hook` (call a DEV-only `window.__verify*` function
that assembles config from game modules — see `src/debug/verifyHooks.ts`). Scenarios with a
fixed roster set `expected`; dynamic-spawn modes omit it and INV-1 becomes "≥1 ship".
A scenario may also set `postStartMethod` — a scene method called once right after boot,
for scenes whose `create()` shows a setup screen instead of starting play directly
(e.g. Dogfight's ship/format picker) rather than starting an active match.

- **arcade-2v2** — ArcadeBattleScene (registry), 2 player + 2 AI, 3s. Core real-time smoke.
- **continuous-2v2** — ContinuousTacticalScene (registry), 2 player + 2 AI, 3s.
- **survival-solo** — SurvivalScene (init `{factionId}`), dynamic roster, 3.5s. Wave spawn.
- **campaign-mission1** — CampaignBattleScene (hook `__verifyStartCampaign`), mission 1 with
  a fresh save; ships read from the battle manager state, 2.5s.
- **dogfight-1v1** — DogfightScene (init `{}` + `postStartMethod: "startMatch"` to skip the
  setup screen), 1 player + 1 AI, 3s.

Not yet covered (UI-driven setup screens — need button-clicking or a start hook):
EpicBattleScene, AceDuelScene.

`ShipTelemetry` (INV-5's data source) is wired into ArcadeBattleScene, ContinuousTacticalScene,
SurvivalScene, DogfightScene, and CampaignBattleScene — every real-time scene the loop drives.
Campaign moved off its old turn-based engine (BattleManager/TurnSystem, removed) onto the same
real-time combat model as the other modes, so INV-5 now gets samples there too.

## Running

Requires the Vite dev server on port 3003 (`npm run dev`).

```
npm run verify:loop                 # all scenarios, invariants only
ANTHROPIC_API_KEY=... npm run verify:loop   # + vision (INV-7)
```

Exit code is non-zero if any MUST invariant fails. A JSON report is written under
`screenshots/verify/<timestamp>/report.json`.
