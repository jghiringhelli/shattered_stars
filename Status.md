# Status.md

## Last Updated: 2026-06-09 (session 3 — GS verify loop + XP progression + deploy prep)
## Session Summary
Applied the Generative Specification (GS) method. Built the phase-collapse verify loop
(scripts/verify_loop.ts + docs/specs/verify-loop.md, `npm run verify:loop`): COLLAPSE →
RECOVER → VERIFY (INV-1..6 MUST, INV-6b/6c/7 SHOULD) → REGENERATE; live run PASS.
Added global XP progression: ProgressionData.ts (pure) + PlayerProfile.ts + 24 unit tests +
progression.md + ADR-0002. Seed profiles: player-default, dev-unlock-all, and graded
test profiles (novice/veteran/admiral). XP-gated the ship picker (locked rows dimmed with
lock badge + reason). ArcadeBattleScene now awards XP on battle end (kills*perKill + win/loss
bonus), closing the play→earn→unlock loop. BootScene honors `?profile=<id>` for testing.
Asset audit: 101 ships, only 1 missing encyclopedia art (synth_gestalt) — added `--id`
filter to generate_ship_art.py + documented one-command remedy (SD queue port 8010 required).
Prepared manual GitHub Pages deploy (.github/workflows/pages.yml, workflow_dispatch only,
does NOT auto-publish) + docs/DEPLOY.md. Build verified (exit 0, relative asset URLs).
0 TypeScript errors throughout.

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
  unit/           1717 tests, 82%+ line coverage
  e2e/            183/183 Playwright tests passing (11 spec files)
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
- None currently tracked.

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
