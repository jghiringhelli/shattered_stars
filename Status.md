# Status.md

## Last Updated: 2026-09-02 (harness correction session)
## Session Summary
This file had drifted badly — last real update was 2026-06-09 while many sessions of
real work (capital subsystem damage, gunship ordnance fix, Dogfight player controls,
commander crew role, role matchup matrix, beginner-aid UX, etc.) landed without a
Status.md update. Flagging that drift here rather than reconstructing history we
can't verify — the git log is the source of truth for what changed between
2026-06-09 and today; this file resumes accurate tracking from today forward.

This session (per the GS/harness discipline — see docs/specs/verify-loop.md):
- Reviewed the project's existing GS-style harness (`CLAUDE.md` sentinel,
  `docs/spec-map.md` routing index, `.claude/hooks/` pre-commit gates,
  `scripts/verify_loop.ts` collapse→recover→verify→regenerate loop) against the
  published Generative Specification methodology (pragmaworks.dev) — it already
  closely matches the brownfield process; no wholesale rebuild needed.
- Found and fixed two real harness gaps: `ShipTelemetry` (INV-5 no-teleport data
  source) was only wired into ArcadeBattleScene/ContinuousTacticalScene —
  `survival-solo` was silently reporting 0 telemetry samples. Wired it into
  SurvivalScene and DogfightScene too.
- DogfightScene had zero verify-loop coverage (its `create()` only shows a setup
  screen). Added a `postStartMethod` mechanism to `scripts/verify_loop.ts` so a
  scenario can call a scene method (`startMatch()`) right after boot, and added
  the `dogfight-1v1` scenario. Full loop now: 5/5 scenarios PASS.
- Corrected `docs/specs/verify-loop.md` and this file's stale test counts
  (1717 unit → 2078; 183/11 e2e → 216/20 e2e).
- **Critical finding from playing Dogfight/Survival with the corrected harness**: both
  scenes' HUD promised "Arrow keys: Move" but the player ship was 100% AI-piloted
  (Dogfight already fixed in a prior session; Survival's `updateAI()` had a
  `// Player ships also use simple AI if not controlled` block with no actual input
  path — the flagship could not be steered or fire manually at all). Verified impact:
  a scripted playthrough died at Wave 1 / Score 0 in ~20s before the fix; after wiring
  real keyboard control (UP/DOWN speed, LEFT/RIGHT bank, SPACE to fire — same scheme as
  Dogfight) the same script survived Wave 1, scored 100, and reached Wave 2.
- Fixed: SurvivalScene flagship now takes real player input (escorts keep seek-AI);
  both DogfightScene and SurvivalScene cameras now follow the player ship (manual
  toroid-aware lerp, matching ArcadeBattleScene) instead of staying fixed at the
  battlefield center.

Current test counts (verified this session): 2078 unit tests (`npm test -- --run`,
79 files), 216 e2e tests (`npx playwright test --list`, 20 spec files).


## Project Structure
```
src/
  arcade/         ArcadeStress, ArcadeOrdnance, ArcadeTurret — pure arcade systems
  scenes/         ArcadeBattleScene, SurvivalScene, CampaignBattleScene, etc.
  systems/        CombatSystem, FlightControlSystem, MovementSystem, OrdnanceSystem, etc.
  data/           ShipDefinitions (101 ships), ShipLoadouts, ModeBalancing, CampaignData
  core/           types.ts, ArcadeControls (cycle system), errors.ts
  ai/             AIBrain, AIShipFactory, AIDifficulty, ArcadeAI
  multiplayer/    OnlineTurnManager, BattleStateSerializer
  services/       NetworkService (P2P WebSocket)
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

## Known Bugs
- This table (and the Balance Results / Roadmap / ADR Log sections below) predate the
  2026-09-02 drift noted above — treat as historical, not current. Known live issues as
  of this session: none blocking for Dogfight/Survival after the control + camera fixes
  above; wave-difficulty/balance tuning for Survival not yet re-validated post-fix.

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
- Blocked by: nothing
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
