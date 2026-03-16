# Status.md

## Last Updated: 2026-03-16
## Session Summary
Core arcade gameplay loop complete and visually verified via Playwright QA pipeline.

## Project Structure
```
src/
  scenes/         ArcadeBattleScene, CampaignBattleScene, TurnBasedBattleScene, etc.
  systems/        CombatSystem, MovementSystem, FlightControlSystem, OrdnanceSystem, etc.
  data/           ShipDefinitions (18 ships), PilotData (15 pilots), CampaignData
  core/           types.ts, BattleManager, ArcadeControls, errors.ts
  ai/             AIBrain, AIShipFactory, AIDifficulty, Considerations
  ui/             HealthBar, Minimap, HUD
  audio/          AudioManager
public/
  assets/ships/   100 PNG sprites across 5 factions (SD-generated, ADD blend mode)
  assets/portraits/ Pilot portraits (512×768) for all 15 campaign pilots
tests/
  unit/           1575 tests, 82.4% line coverage
  e2e/            29/29 Playwright tests passing (headless Chromium, port 3003)
scripts/
  visual_qa.ts    Playwright QA pipeline: tours all scenes, screenshots + console log
  qa_debug.ts     Boot diagnostic for headless runs
```

## Feature Tracker
| Feature | Status | Branch | Notes |
|---------|--------|--------|-------|
| ArcadeBattleScene | ✅ Done | master | Ships, AI, HUD, pause, VICTORY/DEFEAT |
| AceDuelScene | ✅ Done | master | 6 matchups, AI difficulty |
| EpicBattleScene | ✅ Done | master | Capital assault mode |
| TurnBasedBattleScene | ✅ Done | master | Full X-Wing style combat |
| CampaignScene | ✅ Done | master | 5 factions, 15 missions, branches |
| CreditsScene | ✅ Done | master | Scrolling credits |
| SettingsScene | ✅ Done | master | Audio/visual sliders |
| Squad Builder | ✅ Done | master | Squad building + arcade routing |
| Ship PNGs | ✅ Done | master | 100 sprites via SD pipeline |
| Pilot portraits | ✅ Done | master | 30 portraits (base + talk) |
| Ship faction select (Arcade) | ⬚ Not Started | | Hardcoded to Confed vs Terran |
| Pilot cards | ⬚ Not Started | | No in-game display yet |
| Epic ships (huge size) | ⬚ Not Started | | Epic format only |
| Multiplayer | ⬚ Not Started | | Networking not started |

## Known Bugs
| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| 1 | SurvivalScene starting ship hardcoded to confed_falcon | Low | Open |
| 2 | SquadBuilderScene UI cramped (faction numbers overlap faction names) | Low | Open |
| 3 | EpicBattleScene has ~100px blank gap at top | Low | Open |

## Technical Debt
| Item | Impact | Effort | Priority |
|------|--------|--------|----------|
| CampaignData.ts 1813 lines (static data) — 0% test coverage | Low | Med | Low |
| ShipDefinitions.ts 2129 lines | Low | Med | Low |
| BattleManager.ts ~29% coverage (Phaser dependency) | Med | High | Low |
| AudioManager.ts 0% coverage (Phaser dependency) | Low | High | Low |

## Current Context
- Working on: forgecraft-mcp setup + AI arcade improvements
- Blocked by: nothing
- Decisions pending: which mode/feature to tackle next
- Next steps:
  1. Ship faction/loadout select for Arcade mode
  2. Generate ship PNG art for remaining factions used in other scenes
  3. Pilot card display UI

## Architecture Decision Log
| Date | Decision | Rationale | Status |
|------|----------|-----------|--------|
| 2026-03-16 | Camera zoom removed from ArcadeBattleScene | scrollFactor(0) HUD clips off-screen with zoom | Implemented |
| 2026-03-16 | AI decision timer 300-500ms | Prevents per-frame target jitter, each ship locks onto target | Implemented |
| 2026-03-16 | ADD blend mode for ship PNGs | SD-generated ships have dark backgrounds; ADD = transparent darks | Implemented |
| 2026-03-16 | forgecraft-mcp UNIVERSAL+GAME tags | Engineering standards for game dev | Implemented |
