# Spec Map — Shattered Stars

<!-- GS navigational index. Load only the slice a task needs. Keep this file < ~60 lines. -->

The sentinel (`CLAUDE.md`) is the door; this map routes each concern to the exact
artifacts and code to load. Run `npm run sentinel` for a live status + next action.

## Concern → where it lives

| Concern | Load these (spec) | Code |
|---|---|---|
| Movement / maneuver geometry | [docs/specs/telemetry-xwing-reference.md](specs/telemetry-xwing-reference.md), [adr/ADR-0001](adr/ADR-0001-xwing-geometric-scale.md) | [src/systems/MovementSystem.ts](../src/systems/MovementSystem.ts), [src/config.ts](../src/config.ts), [src/simulation/XWingReference.ts](../src/simulation/XWingReference.ts) |
| Telemetry fidelity gate | telemetry-xwing-reference.md §3 | [scripts/analyze_telemetry.ts](../scripts/analyze_telemetry.ts), test `XWingTelemetryReference.test.ts` |
| Arcade control cycle | CLAUDE.md → ArcadeControls | [src/core/ArcadeControls.ts](../src/core/ArcadeControls.ts) |
| Combat / dice / actions | specs/advanced_mechanics.md | src/systems/CombatSystem.ts, ActionsSystem.ts, TargetingSystem.ts |
| Squad building | — | src/systems/SquadBuilder.ts, src/scenes/SquadBuilderScene.ts, ShipPickerScene.ts |
| Upgrade catalog / slots / loadout pricing | [docs/specs/upgrades-and-slots.md](specs/upgrades-and-slots.md) | src/data/upgrades/, src/core/CombatModifiers.ts, src/arcade/ArcadeUpgradeEffects.ts, src/data/ShipLoadouts.ts |
| Progression / XP / unlocks | [docs/specs/progression.md](specs/progression.md), [adr/ADR-0002](adr/ADR-0002-player-progression.md) | src/systems/CampaignSaveManager.ts, src/systems/PlayerProfile.ts, src/data/ProgressionData.ts |
| Ships / factions data | docs/scifi_factions.md | src/data/ShipDefinitions.ts, src/data/ModeBalancing.ts |
| Verify loop (collapse→recover→verify) | [docs/specs/verify-loop.md](specs/verify-loop.md) | scripts/verify_loop.ts, scripts/vqa_helpers.ts, tests/e2e/helpers/game.ts |
| Vision QA | — | scripts/gameplay_vision_qa.ts, scripts/analyze_qa_screenshots.ts |
| Headless balance / perf | — | scripts/headless_sim.ts, scripts/headless_arcade_perf.ts |
| Assets (art / audio) | CLAUDE.md → Art/Music | scripts/generate_ship_art.py, scripts/sd_queue.py |

## Verify gates (definition of done)

- `npm run typecheck` — 0 errors.
- `npm test -- --run` — full unit + integration suite green.
- `npm run analyze:telemetry` — 0 FAIL (WARN allowed only if tracked by an ADR).
- Pre-commit hooks (`.claude/hooks`) pass: compile, coverage, format, function-length,
  import-cycles, prod-quality, secrets, tdd-check, conventional commit message.

## Bound prompts (unit of work)

See [DEVELOPMENT_PROMPTS.md](../DEVELOPMENT_PROMPTS.md) — each task carries its own
Load / Scope / Acceptance / Commit. Do not start work from a task title alone.
