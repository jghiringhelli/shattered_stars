# Status.md

### 2026-10-11 — One AI everywhere; roguelite Survival; SC2 campaign; scenarios; polish
- Every battle mode's AI is the skill-gate bots (BotPilot + SquadCommand + squad mark);
  old AI stack and difficulty stat cheats removed. Mark assist for wingmen; novice squads
  don't mark; bots flee the Survival belt; campaign act 1 is the learning act.
- Per-ship holo overlay (shield segments, hull ticks, damage/repair cues, side by shape),
  repair events + repair drones, hull repair knob (Mechanic, Patch Astromech, auras).
- Survival roguelite: seeded sector maps, shops/docks/events/relics/mutations, ascension,
  meta-progression, save/resume, history; spawn-in-belt bug and speed power fixed.
- Campaign: real objectives, mission scripting, 78 missions redesigned, hero powers (V/B),
  armory + research, hub, save v3 with consequences, completion epilogue.
- X-Wing 2.0 Scenario mode in Skirmish (4 scenarios, control + destruction scoring).
- P0 polish: settings/rebinding/colorblind/volumes, Flight School, menu juice, local
  telemetry. Plan: docs/PROFESSIONALIZATION_PLAN.md.
- Tests: 4159 unit/balance/sim + 374 e2e (4 skipped) + 24 skill-gate tests green.

### 2026-10-10 — One flight engine, real-time pilots, quick builds everywhere
- Every battle mode (Skirmish, Dogfight, Ace Duel, Survival, Campaign, Boss Raid,
  Continuous) flies the X-Wing cycle engine (`src/arcade/systems/CycleFlight.ts`,
  `PlayerFlightPilot.ts`, `AiPursuit.ts`); the template-lerp engine is gone
  (the turn-based balance sim keeps its own `SimManeuvers`).
- Controls fix: Q/E hard turns and K-turn/Segnor/Tallon stay queued until they
  fly; holding a key banks once, then drifts.
- All 55 pilot-card abilities (+17 campaign abilities) act in real time
  (`pilotAbilityEffects.ts`, conditional knobs in `ShotConditions.ts`); pilot
  surcharge derived from the effect (`abilityPricing.ts`).
- Every mode equips quick builds (`QuickBuildEquip.ts`, `DiceAttack.ts`);
  Dogfight/Ace Duel/Survival setups let the player pick them; the picker shows
  slots, pilot, initiative and ability summaries.
- Lifecycle fixes: scenes bind shutdown() (no stacked input handlers), Dogfight
  restarts clean, weapons go live with the round (not during the banner).
- Tests: 2904 unit/balance/sim + 278 e2e green.

### 2026-10-10 — Ship variants rebalance (phase 5)
- New `src/data/shipPricing.ts` (+ `dialPermissiveness.ts`): bare-hull price =
  role anchor + catalogue-priced lever deltas; spec `docs/specs/ship-variants.md`.
- Reskin clusters differentiated with hull/shield/speed/dial/stat trades
  (`tuneDial` variant dials); 52 hull prices set from the heuristic.
- `ShipVariants.test.ts` gates: no identical variants, no dominated variant at
  ≤ price, every price within max(3, 5%) of the heuristic.
- Presets recomposed (th_300, sc_150, sc_300, vc_200). Headless 500-battle
  matrix: faction spread 60/18 → 37/24 (no >60% outliers left).

## Last Updated: 2026-09-17 (Campaign real-time conversion + SFX/balance session)
## Session Summary
Continuation of extensive playthrough-driven QA across all 6 game modes (Skirmish,
Survival, Epic Format, Dogfight, Ace Duel, Campaign). Highlights:
- **Campaign's turn-based engine removed entirely.** `src/core/BattleManager.ts` +
  `src/systems/TurnSystem.ts` deleted; `CampaignBattleScene.ts` rewritten from scratch
  as a real-time scene (flagship + escort AI, continuous maneuvers, autofire) matching
  every other mode's combat model — no more mode-switch jarring the player mid-game.
  Found and fixed 3 real bugs in the old engine before deciding to replace it outright:
  maneuver buttons unclickable at non-1.0 zoom, turns freezing forever on 0-enemy
  missions, and the asteroid belt tightening too fast for long survive-type missions.
- **Audio feedback gaps closed**: `hull_hit` SFX was defined but never played anywhere;
  `shield_hit` only wired into 1 of 7 combat scenes. Wired both into all real-time
  scenes' damage code, plus a reused `powerup` cue for ordnance-ready and aura-gained
  (rising-edge, player-ship-only).
- **Survival threat curve retuned** (`src/data/survival/threat.ts`): median run length
  was 4-5 waves (most players died before their first Hangar milestone at wave 5).
  Softened `THREAT_PER_LEVEL`/`THREAT_PER_SHIP` — median now 6-10 waves depending on
  build policy, capstones/cross-powers now reachable in a meaningful fraction of runs.
- **HUD bleed-through fixed** across all 6 modes' end screens (score/timer/minimap/
  stress bar/controls-hint were never hidden behind the semi-transparent victory/
  defeat overlay).
- Fixed a real (not flaky) e2e bug: `game-modes-tour.spec.ts`'s SURVIVAL case was
  waiting for the wrong scene (`SquadBuilderScene`) — Survival routes through its own
  `SurvivalSetupScene`.
- All 6 modes played to completion via real Playwright UI+keyboard simulation this
  session with zero console/page errors. `npm run build` (production) verified clean.
- Work was committed retroactively in 13 atomic commits after being left uncommitted
  for the whole session — `scripts/sentinel.ts` now warns explicitly against
  squash-committing when >15 files are dirty.

### Carried over from 2026-09-02 (harness correction session)
This file had drifted badly before that session too — see git log for anything not
captured here. That session fixed `ShipTelemetry` wiring gaps (Survival/Dogfight had
0 samples for verify-loop's INV-5), added a `postStartMethod` mechanism so Dogfight's
setup-screen boot could be scripted, and gave SurvivalScene's flagship real keyboard
control (it was silently 100% AI-piloted before, despite the HUD promising "Arrow
keys: Move").

Current test counts (verified 2026-09-17): 2092 unit tests (`npm test -- --run`,
81 files), 237 e2e tests (`npx playwright test --list`, 21 spec files).



## Project Structure
```
src/
  arcade/         ArcadeStress, ArcadeOrdnance, ArcadeTurret — pure arcade systems
  scenes/         ArcadeBattleScene, SurvivalScene, CampaignBattleScene, etc.
  systems/        CombatSystem, FlightControlSystem, MovementSystem, OrdnanceSystem, etc.
  data/           ShipDefinitions (101 ships), ShipLoadouts, ModeBalancing, CampaignData
  core/           types.ts, ArcadeControls (cycle system), errors.ts
  ai/             AIBrain, AIShipFactory, AIDifficulty, ArcadeAI
  multiplayer/    BattleStateSerializer (legacy)
  net/            Online play: protocol, NetClient, LockstepSession, lobby, battle link
  services/       ImageGenerator
  simulation/     BattleSimulator, BalanceAnalyzer
  ui/             HealthBar, Minimap, SquadCard, ShipPickerScene components
public/
  assets/ships/   Ship sprites across 5 factions (SD-generated, ADD blend mode)
tests/
  unit/           2078 tests, 79 files
  e2e/            216 Playwright tests (20 spec files)
  balance/        Balance analysis suite
  simulation/     ArcadeMovementSim — all 101 ships × all dial maneuvers
scripts/
  p2p_server.ts   WebSocket relay server (Railway-deployable)
  generate_ship_art.py  SD queue batch art pipeline
```

## Feature Tracker
| Feature | Status | Notes |
|---------|--------|-------|
| ArcadeBattleScene | ✅ Done | Ships, ordnance, turrets, crew mode, HUD, pause |
| Ordnance system | ✅ Done | Missiles, torpedoes, bombs — charges + cooldowns + homing |
| Turret auto-targeting | ✅ Done | 360° auto-aim; crew mode for large/huge ships (G key) |
| Squad Builder | ✅ Done | Multi-team, loadout choices, faction filter |
| Ship roster | ✅ Done | 101 ships (20/faction + synth_gestalt capital) |
| Epic format | ✅ Done | 400pt, huge ships allowed, synth_gestalt boss |
| SurvivalScene | ✅ Done | Wave-based with faction starter ships |
| CampaignScene | ✅ Done | 5 factions, branches |
| EpicBattleScene | ✅ Done | Gap at top fixed |
| Multiplayer (P2P) | ✅ Done | WebSocket relay, invite codes, late-join, lobby chat |
| Ship PNGs | ✅ Done | SD-generated sprites with ADD blend mode |
| Movement arcs | ✅ Done | True circular arcs for bank/turn/segnor/tallon |
| Mutation testing | ✅ Done | Stryker configured; 63%+ mutation score |
| README | ✅ Done | Game description, controls, setup, structure |
| CI pipeline | ✅ Done | GitHub Actions: typecheck → unit tests → build |
| Discrete cycle movement | ✅ Done | 500ms X-Wing cycles; SPEED_SCALE_FACTOR + baseSize geometry |
| ArcadeStress system | ✅ Done | Dial-based difficulty, stress bar HUD, ring pulse, K-turn + boost spikes |
| Cloak / stealth | ✅ Done | C key, 8s timer, 12% alpha on enemies, damage halving, breaks on fire |
| Action redistribution | ✅ Done | barrel_roll added to 11 interceptors/light fighters; 23→34 total |
| Movement simulation tests | ✅ Done | ArcadeMovementSim: all 101 ships × all dial entries verified |
| Segnor/tallon key bindings | ✅ Done | Shift+Q/E = segnor loop, T/Shift+T = tallon roll |
| Wingman formation AI | ✅ Done | FormationAI.ts; first 2 allies hold wing slots, blend to combat at 350px |
| E2E tests: stress + cloak | ✅ Done | arcade_systems.spec.ts — 6 new tests for stress HUD + cloak alpha |
| Campaign real-time combat | ✅ Done | Turn-based BattleManager/TurnSystem removed; same engine as other modes |
| Shield/hull/ordnance/aura SFX | ✅ Done | Wired into all 6 combat scenes (AudioManager.ts) |
| Survival threat curve retune | ✅ Done | Median run length 4-5 → 6-10 waves |
| Ship art unified (ShipVisual) | ✅ Done | Single renderer for all 6 battle scenes; ShipRenderer.ts deleted |

## Known Bugs / Open Items
- This table (and the Balance Results / Roadmap / ADR Log sections below) predate the
  2026-09-02 drift noted above — treat as historical, not current.
- **`EpicBattleScene.ts` is orphaned dead code** — a fully-built standalone boss-raid
  scene, registered in `main.ts`, with its own tests, but nothing routes to it ("EPIC
  FORMAT" on the main menu goes through `SquadBuilderScene` → `ArcadeBattleScene`
  instead). Needs an owner decision: wire it into the menu as a real mode, or delete it.
- **`tests/balance/BattleSimulator.test.ts` "reasonable draw rates (<90%)"** is
  genuinely flaky by design (unseeded RNG, small 50-battle samples, already-relaxed
  threshold per its own TODO comments) — can occasionally fail a commit's test hook.
  Not touched; needs an intentional balance pass + seeding to fix properly, not a
  quick patch.
- `game-modes-tour.spec.ts` SURVIVAL routing bug (was waiting on the wrong scene) —
  fixed 2026-09-17.

## Balance Results (2026-06-09, 300 battles/matchup, upgraded sim — action tokens + ordnance + stealth, spawn-side randomized)

### Position-averaged true win rates (target: 38–62% all matchups)
```
              TH    FC    SC    VC    AE    Avg
TH           —   54.7% 61.7% 52.0% 53.4%  55.4%
FC        45.3%    —   52.2% 43.5% 43.3%  46.1%
SC        38.3% 47.8%    —   41.2% 44.8%  43.0%
VC        48.0% 56.5% 58.8%    —   50.0%  53.3%
AE        46.7% 56.7% 55.2% 50.0%    —    52.1%
```
All pairwise win rates within 38–62% target. SC vs TH (38.3%) is tightest margin.

**Sim improvements in this pass**: action economy (focus/evade/TL), ordnance charges (missiles/torps),
conditional stealth device, spawn-side alternation to cancel positional bias.

**Caveat**: sim doesn't model pilot special abilities or real-game maneuver denial. In actual play,
VC ordnance (concussion missiles) and SC coordination abilities are more impactful than sim shows.
Playtest confirmation recommended before final balance sign-off.

**Preset changes**: SC_200 uses synth_predator backbone (atk=4); AE_200 uses ascendant_crusader (atk=4);
VC_200 uses corsair_marauder (atk=4); TH_200 switched to gladius+2×viper composition (eff_atk=12, all focus).

## Technical Debt
| Item | Impact | Effort | Priority |
|------|--------|--------|----------|
| ArcadeBattleScene.ts ~1800 lines | Med | High | Med |
| CampaignData.ts ~1800 lines (static data) | Low | Med | Low |
| ShipDefinitions.ts ~2300 lines | Low | Med | Low |
| AudioManager.ts 0% coverage (Phaser dependency) | Low | High | Low |
| SC/AE/VC faction balance (sim flags) | Med | Med | Med |

## Current Context
- Working on: feat/arcade-pivot branch
- Blocked by: nothing — `npm run build`, `npx tsc --noEmit`, full unit + e2e suites all
  verified clean 2026-09-17. All 6 game modes played to completion with zero errors.
- Pending owner decisions: EpicBattleScene.ts fate (wire in or delete), whether to
  publish (Vercel/GitHub Pages — infra ready, not yet triggered).
- Next: see Roadmap section below

## Roadmap
| Priority | Item | Effort | Notes |
|----------|------|--------|-------|
| 1 | SC/AE/VC faction balance pass | Med | Sim flags SC dominant, AE weak; needs playtest confirmation |
| 2 | Vercel/GitHub Pages publish | Low | User-directed when ready |
| 3 | More ship art (remaining PNGs) | High | Needs SD server up; run generate_ship_art.py |

## Architecture Decision Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-16 | ADD blend mode for ship PNGs | SD-generated dark backgrounds; ADD = transparent |
| 2026-04-17 | animateManeuver — single tween | Replaced 10 micro-tweens; true circular arcs |
| 2026-05-21 | ArcadeTurret separate from TurretSystem | Turn-based system uses hasFired/rounds; arcade needs ms cooldowns |
| 2026-05-21 | Turrets 360° in arcade | Directional arcs are turn-based-only concept; all arcade turrets auto-aim |
| 2026-05-21 | Crew mode on G key (not Tab) | Tab already cycles weapons; G for Gunner avoids conflict |
| 2026-06-09 | Discrete cycle movement (500ms) | Replaced continuous angular velocity with X-Wing maneuver cycles; deterministic geometry |
| 2026-06-09 | SPEED_SCALE_FACTOR + baseSize template length | Larger ships travel further per cycle at same speed — matches X-Wing TMG large-base rules |
| 2026-06-09 | ArcadeStress: per-cycle update not per-frame | Stress classification maps to dial difficulty at cycle end; avoids noisy frame-by-frame jitter |
| 2026-06-09 | Cloak damage halving over evasion roll | Arcade has no defense dice; floor(damage/2) is intuitive and predictable for players |
| 2026-06-09 | C key for cloak (not toggle off) | One-shot activation; timer auto-expires; re-press blocked while active |
| 2026-06-09 | Segnor: Shift+Q/E; Tallon: T/Shift+T | Reuses existing Shift key; Q/E unmodified remain sharp turn; T is unused — minimal key conflicts |
| 2026-06-09 | FormationAI: blend not hard-switch | Smooth lerp from formation→combat as enemies close; avoids jerky AI behaviour at ENGAGE_RADIUS boundary |
| 2026-06-09 | Keep ws relay; defer Colyseus | Colyseus requires server-authoritative rewrite (60%+ effort); ws relay works; real-time arcade MP not in scope |
