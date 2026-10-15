# ADR-0006: Split the battle scenes into a shared BattleCore and thin scene adapters

- Status: Accepted (plan); step 0 (shipping the lazy-scene seam) done, extraction steps open
- Date: 2026-10-15
- Context source: professionalization audit 2 (A-1, A-2, A-3), see docs/ROADMAP.md

## Context

Seven battle scenes hold 12.3k lines: ArcadeBattleScene 2,680, SurvivalScene 2,252, EpicBattleScene 2,037,
CampaignBattleScene 1,992, DogfightScene 1,842, AceDuelScene 1,506, ContinuousTacticalScene 1,196. Each has
30-70 methods and 40-90 imports. Survival, Campaign and Arcade (and partly Epic, Dogfight, Ace Duel) re-implement
the same battle runtime under the same names: `createHealthBar`, `setupInput`, `togglePause`,
`updateCameraFollow`, `weaponsLink`, `applyWeaponHit`, `findTarget`, `flyShips`, `flyBot`, `applyMarkRequest`,
`fireAt`, `killShip`/`destroyShip`, `updateAI`. Consequences:

- a bug fix has to land 3-6 times (the combat unification of the last waves needed it everywhere);
- scenes and `src/ui` are excluded from unit coverage (11 % / 15 %), so the largest, riskiest files have the
  weakest safety net (e2e only);
- the quality ratchet baseline (`scripts/quality-baseline.json`) records them as the largest offenders.

The deterministic parts already live outside the scenes (`src/arcade/**`, `src/net/**`, `src/campaign/**`,
`src/systems/**`). What stays in the scenes is the glue that mixes simulation steps with Phaser objects.

## Decision

Introduce a Phaser-free battle layer, `src/battle/`, and reduce every battle scene to presentation glue plus
its mode rules.

```
Scene (Phaser)                          src/battle (pure, injected, unit-tested)
  create/update/shutdown                  BattleSession   owns ships, teams, clock, seeded rng, tick order
  input -> intents                        BattleCore      one fixed step: fly -> weapons -> primary fire -> damage -> deaths
  views (ShipVisual, HUD, camera)         services:  WeaponsService (WeaponsDriver + hit routing)
  mode rules (waves, objectives, ...)                DamageService (hit/blast, shields, repair events)
                                                     MarkService (SquadMark + assistMark)
                                                     AuraService (resolveTeamAuras)
                                                     TelemetryService (match stats, hit ledger)
                                                     MusicHooks (tension, stingers: events only)
                                                     PauseController (pause state machine, no UI)
        <- events (BattleEvent stream) ------
```

Rules of the split:

1. **Dependency direction**: scenes import `src/battle`; `src/battle` never imports Phaser or `src/scenes`.
   Ports (clock, rng, event sink, audio, telemetry) are interfaces defined in `src/battle`, implemented by scene
   adapters (`scenes/battleUi/*`, `scenes/arcadeBattle/*`).
2. **Events out, never views in**: the session emits `BattleEvent`s (shot, hit, destroyed, repaired, mark,
   phase); scenes subscribe and render. This is what lets the HUD, overlay and audio be shared too.
3. **Determinism preserved**: the session steps on the sim clock and seeded, saveable RNGs exactly like the
   online `step(tick, inputs)` path does today. No `time.now`, `Math.random` or `Date.now` in `src/battle`
   (enforced by an ESLint `no-restricted-properties` rule for that directory).
4. **Mode rules stay in the modes**: waves, belt and bosses (Survival); objectives, director and hero powers
   (Campaign); reinforcement pools, scenario rules and netcode (Arcade); rounds (Dogfight/Ace Duel); raid
   sections (Epic).
5. **Online paths last**: `ArcadeBattleScene`'s netcode (`scenes/arcadeBattle/online/*`: hash, graph, restore,
   join) is only touched after the offline scenes run on the shared core and the lockstep hash tests plus
   `tests/e2e/online-battle.spec.ts` are green with the new module in the graph.

### Target modules (ArcadeBattleScene, the largest)

| New module | Takes over (current methods) |
|---|---|
| `ArcadeBattleSim` | `tickLogic`, `updateShips/AI/auras`, `applyHitDamage`, `applyBlastDamage`, `recordDestruction`, `checkVictory` (already online-stepped) |
| `ArcadeFleetSpawner` | `spawnShips`, `createBotFleet`, `adopt`, `seatHuman` |
| `ArcadeCameraRig` | `updateCameraFollow`, `cameraFocusShip`, `view*` (wraps TorusFollow) |
| `ArcadeBattleHud` | `updateHUD`, health bars, explosions |
| `ArcadeEndFlow` | finish, XP, end screen |
| `ArcadeOnlineAdapter` | hash, simGraph, restore, joinOnline |

`scenes/arcadeBattle/` (28 files) is already the right home for the Phaser-side adapters; the pure parts move to
`src/battle` when a second mode needs them.

### Other splits that ride along

- `SquadBuilder.ts` (3,353 lines) into `squad/{model,validation,pricing,persistence,shareCode,unitOps}`;
  `Date.now()` ids become an injected clock/id factory.
- `ShipDefinitions` / `ShipLoadouts` (2.6k lines each) into `data/ships/<faction>.ts` (tests already validate them).
- Module singletons that violate the DI rule: `EventBus`, `GameClock`, `GameStore` (dead, delete), the id counters of
  Devices/OrdnanceFlight/Projectile (part of sim state, see D-1).

## Order of work (smallest risk first)

Every step must keep `npm run test:skill`, the lockstep hash tests, `tests/e2e/scene-lifecycle.spec.ts`,
`key-bindings.spec.ts` and the mode's own e2e green, and must shrink `scripts/quality-baseline.json`
(`npm run quality:baseline`).

0. **Seam (done)**: scenes load lazily (`src/scenes/lazy`), so a scene can be split without touching the boot path.
1. `WeaponsService`: the identical `weaponsLink()` + `createSceneWeapons` wiring (present in 6 scenes) becomes one
   adapter around `WeaponsDriver`. Pure adapter, no netcode. Candidate first extraction.
2. `HealthBar`/ship overlay view model (`createHealthBar` in 6 scenes) into one `ShipStatusView`.
3. `PauseController` (state machine) behind the pause menu that `src/scenes/battleUi/BattlePauseMenu` renders.
4. `MarkService` and `flyBot`/`flyShips` (shared `SquadBattleAi` already exists for Survival/Campaign; move Epic,
   Dogfight, Ace Duel onto it).
5. `DamageService` and `TelemetryService`, then `BattleSession` for Survival (smallest), Campaign, Epic.
6. Arcade/Epic last, then the online adapter, with the lockstep hash comparison between the old and new path
   on the same seed as the acceptance test.

Target after step 6: no scene above 1,200 lines, no function above 50 lines in `src/battle`, scenes/ui coverage
floor measured and ratcheted (A-3).

## Why the first extraction was not done in this change

The audit allowed one low-risk extraction. At the time of writing every battle scene (Survival, Campaign, Epic,
Dogfight, Ace Duel, Continuous, Arcade) was being edited by two other workstreams (online id determinism, pause and
results screens), so any extraction would have been a merge conflict across 6 files. Step 1 is ready to start as
soon as those land: it only needs a failing test for `WeaponsService` against a fake `WeaponsDriver` first.

## Consequences

- Good: one place per battle responsibility, unit tests without Phaser, smaller diffs per fix, online
  determinism reviewable in one module.
- Cost: an event layer and ports to maintain; two-step migrations per scene; temporary duplication while a scene
  has not moved yet.
- Rejected: a Phaser `Scene` base class with all shared code. It is inheritance, keeps Phaser in the logic and
  would grow into the same god object (CLAUDE.md: composition over inheritance).
