# Shattered Stars: Game Modes Reference
## Complete Game Mode Catalog — Ported from Unity Prototype + New Designs

**Purpose:** This document describes every game mode implemented in the Unity prototype and how each translates to the new web-based Shattered Stars project. Use this as the definitive reference when implementing game modes.

---

## Table of Contents

1. [Mode Summary Matrix](#mode-summary-matrix)
2. [Skirmish](#1-skirmish)
3. [Campaign](#2-campaign)
4. [Practice](#3-practice)
5. [Survival](#4-survival)
6. [Tournament](#5-tournament)
7. [Draft](#6-draft)
8. [Dogfight](#7-dogfight)
9. [Ace Duel](#8-ace-duel)
10. [Capital Assault](#9-capital-assault)
11. [Multiplayer](#10-multiplayer)
12. [Web Port Priority & Implementation Order](#web-port-priority--implementation-order)
13. [Shared Systems Required by All Modes](#shared-systems-required-by-all-modes)
14. [Mode Lifecycle Pattern](#mode-lifecycle-pattern)

---

## Mode Summary Matrix

| Mode | Players | Session Length | Complexity | Web Priority | MVP? |
|------|---------|--------------|------------|-------------|------|
| **Skirmish** | 1 vs AI | 10–30 min | Low | P0 (Core) | Yes |
| **Campaign** | Single-player | 20–45 min/mission | High | P1 | No (Phase 4) |
| **Practice** | Single-player | 10–30 min | Low | P1 | No (Phase 2) |
| **Survival** | 1 vs Waves | 15–90+ min | Medium | P2 | No |
| **Tournament** | 2–16 players | 10–20 min/match | High | P4 (Post-launch) | No |
| **Draft** | 2–4 players | 30–50 min total | High | P4 (Post-launch) | No |
| **Dogfight** | 1v1 | 8–25 min | Low | P3 | No |
| **Ace Duel** | 1v1 | 8–15 min | Low | P3 | No |
| **Capital Assault** | 1 vs Boss | 20–45 min | Medium | P2 | No |
| **Multiplayer** | 2–8 players | 15–45 min | Very High | P5 (Future) | No |

---

## 1. Skirmish

### Overview
Quick customizable battles. The "play now" mode. This is the **core game mode** that validates whether the combat loop is fun.

### Rules
- Player builds a squadron within a point budget
- AI builds an opposing squadron (or another player in PvP)
- Battle until a victory condition is met

### Configuration Options
| Option | Values | Default |
|--------|--------|---------|
| Point Budget | 50 / 100 / 200 / 300 | 200 |
| Player Faction | Any of 5 factions | Player choice |
| Enemy Faction | Any of 5 factions / Random | Random |
| Difficulty | Apprentice / Veteran / Ace / Mythic | Veteran |
| Objective Type | See below | Elimination |
| Time Limit | None / 10 / 15 / 20 / 30 min | None |
| Epic Ships | Allowed / Not Allowed | Not Allowed |

### Objective Types (8)
1. **Elimination** — Destroy all enemy ships. Simplest mode. Default.
2. **Escort** — Protect a transport ship as it moves to a destination. Player wins if transport survives; AI wins if transport is destroyed.
3. **Control** — Capture and hold objective points (2–4 zones on the map). Score points for controlled zones each turn. First to target score wins.
4. **Assassination** — Each side has a designated "ace" ship. Destroy the enemy ace to win. Other ships are expendable.
5. **King of the Hill** — Single central objective zone. Score points for each turn you control it. First to target score wins.
6. **Extraction** — One side must move a cargo/VIP ship to an extraction point at the map edge. Opposing side must prevent extraction.
7. **Points Race** — Destroying enemy ships earns points based on their point cost. First to reach a point threshold wins.
8. **Timed Survival** — Survive for X minutes against waves. Not a separate Survival mode — this is a skirmish variant with a timer.

### Rewards
- **Victory:** 100 base XP + kill bonuses
- **Flawless Victory (no losses):** 2x multiplier
- **Defeat:** 25 base XP (participation)

### Unity Implementation Reference
```
Files:
  Core/GameModeLifecycle/SkirmishLifecycle.cs
  GameModes/Skirmish/UI/SkirmishSetupScreen.cs
  Managers/SquadBasedGameInitializer.cs (shared)
  Managers/VictoryConditionManager.cs (shared)

Flow: MainMenu → SkirmishSetup → SquadBuilder → Battle → BattleResults
```

### Web Port Notes
- **Priority: P0.** This is the first mode to implement (Phase 1 of roadmap)
- Start with Elimination only. Add other objectives in Phase 3+
- Squad builder can be simplified initially (preset squads, then custom)
- AI difficulty via utility weight multipliers (see Tech Spec Section 5)

---

## 2. Campaign

### Overview
Story-driven progression through 4 acts with persistent squadron, ship evolution, pilot development, and faction mastery. The long-term engagement hook.

### Structure

#### Act I: The Convergence (Missions 1–5) — Tutorial & Introduction
| Mission | Objective | Ships Available | New Mechanic Introduced |
|---------|-----------|-----------------|------------------------|
| 1 | Basic flight training | 1 light fighter | Movement charts |
| 2 | First combat | 1 fighter vs 1 AI | Attack/defense dice |
| 3 | Formation flying | 2 fighters | Allies, formation bonuses |
| 4 | First evolution choice | Evolved ship | Evolution system |
| 5 | Multi-faction encounter | Small squad | Enemy factions, fleet combat |

#### Act II: Rising Tensions (Missions 6–15) — Ship Evolution Focus
- Faction-specific story arcs for each of the 5 factions
- Evolution challenges unlock new ship variants
- Territory control missions introduce strategic layer
- First epic ship encounters (boss battles)
- XP/evolution focus: every mission offers meaningful progression

#### Act III: Galactic War (Missions 16–25) — Full-Scale Warfare
- Large-scale fleet battles (10v10+) using evolved ships
- Epic ship command missions (player controls capital ships)
- Faction alliance/betrayal story choices affecting available ships
- Final faction confrontation using ultimate evolved ships
- Combination system introduced (assembly, fusion, parasitic)

#### Act IV: Ascendancy (Missions 26+) — Endgame
- Faction mastery challenges unlock ultimate evolutions
- Procedural mission generation with progressive difficulty
- Player-created scenarios using full ship roster
- Cross-faction hybrid ships (earned through special achievements)

### Progression Systems Active in Campaign
- **Ship XP:** 10 per kill, 5 per assist, 25 per objective, 15 survival bonus
- **Ship Evolution:** Choose paths at missions 4, 8, 12, 16, 20
- **Pilot Development:** PS 1→9, specialization trees (Ace, Bomber, Support)
- **Faction Mastery:** Recruit → Regular → Veteran → Elite → Champion → Legend
- **Resources:** 8 types (Tibanna Gas, Durasteel, Crystals, Intel, etc.)
- **Ship Persistence:** Ships carry over between missions with damage, XP, upgrades
- **Squad Management:** Recruit/dismiss pilots, assign ships, manage reserves

### Campaign-Specific Features
- **Mission briefing screen** with objectives, recommended squad, enemy intel
- **Victory/Defeat results screen** with animated statistics, XP awards, unlock notifications
- **Mission replay** for better scores/rewards
- **Branching paths** based on player choices and performance
- **Cross-campaign consequences** (actions in one faction campaign affect others)

### Rewards (Per Mission)
- **Victory:** 150 base XP + difficulty multiplier + objective bonuses
- **Ship Survival Bonus:** 25 XP per surviving ship
- **Resources:** Mission-specific resource drops
- **Unlocks:** New ships, pilots, upgrades based on story progression

### Unity Implementation Reference
```
Files:
  Core/GameModeLifecycle/CampaignLifecycle.cs
  GameModes/Campaign/CampaignManager.cs
  GameModes/Campaign/MultiFactionCampaignData.cs (80+ mission definitions)
  GameModes/Campaign/UI/CampaignVictoryDefeatScreen.cs
  Core/Persistence/PlayerStatistics.cs (save data)

Flow: MainMenu → CampaignLanding → MissionSelection → SquadBuilder → Battle → VictoryDefeat → MissionSelection
```

### Web Port Notes
- **Priority: P1.** Campaign is the long-term engagement driver but requires evolution, progression, and save systems first
- Act I (5 missions) in Phase 4. Acts II–III in Phase 5. Act IV in Phase 6
- Save system is critical — versioned save schema from day 1
- Translate the 80+ Unity mission definitions to TypeScript data objects
- The "6 faction campaigns" from Unity become "5 faction campaigns" (Shattered Stars has 5 factions)

---

## 3. Practice

### Overview
Training system for new players and skill development. Four sub-modes with adaptive difficulty and context-sensitive hints.

### Sub-Modes

#### 3a. Tutorial
- Step-by-step guided introduction to all game mechanics
- **Movement Tutorial:** How to read the maneuver dial, execute maneuvers, manage stress
- **Combat Tutorial:** Attack/defense dice, range modifiers, focus/evade actions
- **Fleet Tutorial:** AI allies, coordinate actions, formation benefits
- **Faction Tutorial:** Faction-specific abilities and playstyle introduction
- Progress tracked; players can resume where they left off

#### 3b. Free Play
- Full roster unlocked, no restrictions, no enemies unless spawned
- Sandbox for experimenting with ship loadouts and maneuvers
- Spawn/despawn enemies at will
- Useful for testing squad builds before skirmish

#### 3c. Skill Drills
Focused exercises with scoring:
| Drill | Description | Scoring |
|-------|-------------|---------|
| Accuracy | Hit stationary and moving targets | Hits / Shots fired |
| Evasion | Survive as long as possible against AI attackers | Time survived |
| Formation Flying | Maintain formation with AI wingmen through maneuvers | Formation breaks (lower = better) |
| Energy Management | Manage stress, focus, and actions optimally | Actions per turn average |
| Advanced Maneuvers | Execute K-turns, Segnor's Loops, Tallon Rolls on target | Maneuvers landed on target zone |

#### 3d. AI Training
- Progressive difficulty opponents (Beginner → Expert)
- **Adaptive difficulty:** System tracks player performance and adjusts AI skill
  - Win 3 in a row → difficulty increases
  - Lose 3 in a row → difficulty decreases
- AI opponent variety: different ship types and behavior profiles
- Post-match analysis showing what the player could improve

### Hint System
- **Movement hints:** Suggested maneuvers highlighted on dial
- **Combat hints:** Optimal firing range indicators
- **Tactical hints:** "Enemy behind you!" / "Ally needs help!" prompts
- Hints fade as player improves (adaptive)

### Rewards
- **Reduced XP:** 25 base (practice is for learning, not farming)
- **Skill improvement bonuses:** Extra XP when performance metrics improve
- **Drill completion badges:** Tracked separately from campaign

### Unity Implementation Reference
```
Files:
  Core/GameModeLifecycle/PracticeLifecycle.cs
  GameModes/Practice/PracticeModeManager.cs
  GameModes/Practice/UI/PracticeModeUI.cs
  Assets/Scripts/Tests/PracticeModeManagerTests.cs

Flow: MainMenu → PracticeSetup → (Sub-mode selection) → Battle → PracticeResults
```

### Web Port Notes
- **Priority: P1.** Tutorial sub-mode should be available early (Phase 2) as onboarding
- Free Play is trivially implemented once BattleScene exists
- Skill Drills require custom scoring overlays — Phase 3+
- Adaptive difficulty reuses the same difficulty profiles from AI system

---

## 4. Survival

### Overview
Progressive wave-based combat. Fight increasingly difficult enemy waves. Upgrade your ships between waves. See how far you can get. The "one more wave" engagement loop.

### Wave Structure
| Wave Range | Enemy Composition | Boss Wave? |
|-----------|-------------------|-----------|
| 1–5 | Basic fighters and interceptors | Wave 5: Mini-boss (elite ace) |
| 6–10 | Mixed squadrons with bombers | Wave 10: Boss (heavy gunship) |
| 11–15 | Elite pilots and heavy ships | Wave 15: Boss (capital escort) |
| 16–20 | Epic ship sections appear | Wave 20: Boss (full capital ship) |
| 21+ | Endless scaling, maximum difficulty | Every 5th wave: Boss |

### Between-Wave Upgrades
After each wave, player chooses from upgrade options:

**Post-Wave Upgrades (choose 1 of 3):**
- **Weapons:** +1 attack die, faster fire rate, new weapon type
- **Defense:** +1 hull, +1 shield, +1 agility
- **Mobility:** New maneuver unlocked, boost/barrel roll added
- **Special:** Gain faction ability, upgrade action

**Post-Boss Major Upgrades (choose 1 of 3):**
- Evolve a ship to next tier
- Add a new ship to your squadron
- Gain a powerful unique ability

**Milestone Rewards:**
- Wave 5: Unlock faction passive ability
- Wave 10: Upgrade slot added to all ships
- Wave 15: Choose a second faction's passive ability
- Wave 20: Ultimate ability unlocked

### Scoring
- 100 points per wave survived
- Points per enemy killed (scaled by enemy point cost)
- Time bonus (faster = more points)
- Streak multiplier (consecutive waves without losing a ship)
- Leaderboard (local, eventually online)

### Rewards
- 50 XP per wave survived (exponential growth)
- Milestone bonuses at waves 5, 10, 15, 20
- High score tracking

### Unity Implementation Reference
```
Files:
  Core/GameModeLifecycle/SurvivalLifecycle.cs
  GameModes/Survival/SurvivalModeManager.cs
  GameModes/Survival/SurvivalWaveData.cs

Flow: MainMenu → SurvivalSetup → Battle (continuous) → SurvivalResults
```

### Web Port Notes
- **Priority: P2.** Survival is a great "second mode" after Skirmish — adds replayability with minimal new systems
- Wave definitions are data (JSON/TS), not code. Easy to create and tune
- Between-wave upgrade UI is a new screen not needed by other modes
- Roguelike-style upgrade selection is very engaging for web audience
- Consider this as the "play endlessly" complement to Campaign's "play through story"

---

## 5. Tournament

### Overview
Competitive bracket-based play simulating tabletop tournament structure. Swiss pairing system ensures balanced matchups.

### Tournament Formats

#### Swiss Pairing (Default)
- Players matched against opponents with similar records
- All players play every round (no elimination)
- Rounds = ceil(log2(playerCount)) + 1
- Final standings by tournament points → strength of schedule → head-to-head

#### Single Elimination
- Lose once, you're out
- Fastest format for large groups
- Bracket seeded by rating or random

#### Double Elimination
- Two losses to eliminate
- Winners bracket and losers bracket
- Losers bracket winner faces winners bracket winner in finals

#### Round Robin
- Every player plays every other player
- Most thorough but longest format
- Best for small groups (4–8 players)

### Match Settings
| Setting | Value |
|---------|-------|
| Point Budget | 100 or 200 (fixed for tournament) |
| Time Limit | 75 minutes per match |
| Faction Restriction | Pure faction or open (tournament setting) |
| Epic Ships | Allowed or banned (tournament setting) |
| Upgrade Restrictions | Standard or limited (tournament setting) |

### Scoring System
| Result | Tournament Points | Description |
|--------|------------------|-------------|
| Win | 3 | Destroyed all enemies or met victory condition |
| Modified Win | 2 | Won but lost >50% of your squad |
| Modified Loss | 1 | Lost but destroyed >50% of enemy squad |
| Loss | 0 | Decisive defeat |

### Tiebreakers (in order)
1. Tournament Points
2. Strength of Schedule (average opponent's tournament points)
3. Extended Strength of Schedule
4. Head-to-head result
5. Random

### Rewards
- 200+ base XP per match
- Round multiplier (later rounds = more XP)
- Tournament placement bonuses (1st, 2nd, 3rd, top 8)
- Perfect round bonuses

### Unity Implementation Reference
```
Files:
  Core/GameModeLifecycle/TournamentLifecycle.cs
  GameModes/Tournament/TournamentManager.cs
  GameModes/Tournament/SwissPairingSystem.cs
  GameModes/Tournament/TournamentData.cs

Flow: MainMenu → TournamentLobby → SquadBuilder → Battle → TournamentResults/Bracket
```

### Web Port Notes
- **Priority: P4 (Post-launch).** Requires multiplayer infrastructure
- Swiss pairing algorithm is pure logic — port directly
- Can be implemented as local tournament (all players on same device passing controller) as interim
- AI-filled brackets can work for single-player tournament practice
- Full online tournament requires matchmaking server — future scope

---

## 6. Draft

### Overview
Card-game-style draft where players pick ships from randomized packs, then battle with their drafted squads. Combines deck-building strategy with tactical combat.

### Draft Process

**Pack Types (6 preset packs):**
| Pack | Theme | Contents |
|------|-------|----------|
| Ace Pilots | Elite fighters | 3–4 high-skill fighters with upgrades |
| Squadron Leaders | Balanced squads | 1 leader ship + 3–4 support ships |
| Interceptor Wing | Speed | 4–5 fast interceptors |
| Bomber Squadron | Firepower | 2–3 heavy bombers + 1 escort |
| Scum Freelancers | Versatile | Mixed scum ships with illicit upgrades |
| Epic Command | Capital ships | 1 capital ship + 2–3 escorts |

**Draft Flow:**
1. Each player receives 3 random packs
2. Players simultaneously pick 1 ship from their first pack
3. Remaining ships passed to next player (snake draft)
4. Continue until all packs are empty
5. Players build squadrons from drafted ships (within point budget)
6. Battle with drafted squads

**Timer:** 60 seconds per pick, 3-minute reserve bank. Auto-pick on timeout.

### Run Structure
- Best-of-X format (configurable: best-of-1, best-of-3, best-of-5)
- Same drafted squad used for all matches in the run
- Between matches: can rearrange upgrades but not change ships

### Rewards
- 150+ base XP per match
- Round multipliers
- Draft efficiency bonuses (winning with cheap ships)
- Perfect run bonuses (undefeated)

### Unity Implementation Reference
```
Files:
  Core/GameModeLifecycle/DraftModeLifecycle.cs
  GameModes/Draft/DraftModeManager.cs
  GameModes/Draft/DraftPackDefinitions.cs

Flow: MainMenu → DraftLobby → DraftSelection → SquadBuilder (limited) → Battle → DraftResults
```

### Web Port Notes
- **Priority: P4 (Post-launch).** Requires multiplayer or good AI draft opponents
- Pack definitions are data — easy to port and expand
- Draft AI (choosing ships) is a separate AI system from combat AI
- Can be prototyped as single-player vs AI drafters first
- Great for web — draft mechanics are popular in card game communities

---

## 7. Dogfight

### Overview
Intense 1v1 quick duels. Small squads, fast rounds, best-of-X series. The "competitive" mode optimized for skill expression.

### Match Structure
| Setting | Value |
|---------|-------|
| Format | Best-of-3 or Best-of-5 |
| Squad Size | 50 points (typically 1–2 ships) |
| Round Time Limit | 3 minutes |
| Spawn Distance | Closer than Skirmish (faster engagement) |
| Camera | Tighter zoom (more intimate feel) |

### Rules
- Each round: destroy opponent's ship(s) to win
- If time expires: draw (no one scores)
- First to win majority of rounds wins the match
- Same squad used for all rounds (no between-round changes)

### Tactical Depth
- With only 1–2 ships, every maneuver decision matters enormously
- Stress management is critical — one bad K-turn can lose a round
- Action economy is tight — choosing focus vs evade vs target lock defines the encounter
- Knowledge of maneuver dials gives advantage (knowing what your opponent CAN do)

### Rewards
- 100+ base XP
- Per-round win bonuses
- Sweep bonus (winning without losing a round)
- Speed bonus (fast round victories)

### Unity Implementation Reference
```
Files:
  Core/GameModeLifecycle/DogfightLifecycle.cs
  GameModes/Dogfight/DogfightModeManager.cs

Flow: MainMenu → DogfightSetup → SquadBuilder → Battle → RoundTransition → DogfightResults
```

### Web Port Notes
- **Priority: P3.** Simple to implement once Skirmish exists — it's Skirmish with smaller squads and rounds
- Best-of-X round management is a thin wrapper around BattleScene
- Great for competitive web audience
- Can be single-player vs AI before multiplayer is ready

---

## 8. Ace Duel

### Overview
Preset iconic matchups with pre-built loadouts. No squad building — just pick a matchup and fight. The "quick play" mode for when you want instant action with a thematic twist.

### Preset Matchups

In the Unity prototype, these were Star Wars matchups. For Shattered Stars, translate to equivalent faction matchups:

| # | Hegemony Ace | vs | Opponent Ace | Ship Types |
|---|-------------|-----|-------------|-----------|
| 1 | Admiral Kronos (Aegis Superiority) | vs | Phoenix Commander (Nova Advanced) | Elite fighters |
| 2 | Raptor Squadron Leader (Raptor Interceptor) | vs | Vortex Ace (Vortex Interceptor) | Interceptor duel |
| 3 | Corsair Captain Deathmark (Marauder Assault) | vs | Confederation Freighter Captain (Millennium Transport) | Heavy ship duel |
| 4 | Collective Prime Node (Titan Destroyer) | vs | Empire Archon (Leviathan Bio-Cruiser) | Gunship duel |
| 5 | Hegemony Bomber Wing (3 Devastators) | vs | Confederation Strike Team (3 Meteors) | Bomber squadron |
| 6 | Corsair Bounty Hunter (Razor Raider) | vs | Collective Assassin Drone (Interceptor Drone) | Hunter vs hunted |

### Rules
- Best-of-3 rounds
- Preset loadouts (no squad builder)
- Ships and upgrades are pre-configured for balanced matchups
- Player chooses which side to play
- Both sides are playable against AI or local 2-player

### Special Features
- **Thematic flavor text** before each match
- **Matchup-specific battlefield** (optional: asteroid field, nebula, etc.)
- **Completion tracker:** Play all matchups as both sides to unlock achievement
- **Difficulty selection:** AI difficulty for the opponent side

### Rewards
- 150+ base XP per match
- Matchup completion bonuses
- Sweep bonuses
- Achievement: "Duelist" for completing all matchups

### Unity Implementation Reference
```
Files:
  Core/GameModeLifecycle/AceDuelLifecycle.cs
  (Matchup data defined within lifecycle)

Flow: MainMenu → AceDuelSelection → Battle → RoundTransition → AceDuelResults
```

### Web Port Notes
- **Priority: P3.** Very low implementation cost — it's just preset Dogfight configs
- Matchup definitions are pure data
- Good for onboarding: "just pick a matchup and play" — no squad building required
- Expands easily: add new matchups as content updates

---

## 9. Capital Assault

### Overview
Boss encounters. Player squadron attacks a massive capital ship defended by escort fighters. The capital ship has multiple sections, shield regeneration, and phase-based behavior changes.

### Boss Ships (Shattered Stars equivalents)

| Boss | Faction | Total HP | Sections | Escort Count | Difficulty |
|------|---------|----------|----------|-------------|-----------|
| Hegemony Battlecruiser | Terran Hegemony | 180 | 2 (Fore/Aft) | 4–8 fighters | Medium |
| Freedom Corvette | Free Confederation | 150 | 3 (Fore/Mid/Aft) | 3–6 fighters | Easy |
| Collective Mothership | Synthetic Collective | 140 | 2 (Core/Shell) | 8–12 drones | Medium |
| Pirate Mothership | Void Corsairs | 140 | 2 (Weapons/Engines) | 4–6 raiders | Medium |
| Ascendant Dreadnought | Ascendant Empire | 200 | 3 (Bio/Psionic/Core) | 3–5 bio-ships | Hard |

### Boss Mechanics

**Multi-Section Damage:**
- Each section has independent HP and can be disabled separately
- Disabling a section removes that section's weapons/abilities
- Boss is destroyed when all sections reach 0 HP (or core section in some designs)

**Phase Transitions:**
| Phase | Health Threshold | Behavior Change |
|-------|-----------------|-----------------|
| Phase 1: Full Power | 100%–60% | Standard weapons, shield regeneration active |
| Phase 2: Shields Failing | 60%–30% | Increased aggression, new weapon types, escort reinforcements |
| Phase 3: Critical | 30%–0% | Desperation attacks, self-destruct countdown, maximum firepower |

**Capital Ship Abilities:**
- **Broadside:** Area attack hitting multiple ships in a zone
- **Launch Fighters:** Spawn additional escort fighters
- **Shield Regeneration:** Recover shields over time
- **Stress Field:** Nearby enemy ships gain stress
- **Tractor Beam:** Pull one ship into close range

### Configuration Options
| Option | Values | Default |
|--------|--------|---------|
| Boss Selection | Any of 5 faction bosses | Random |
| Player Squad Points | 200 / 300 / 400 | 300 |
| Escort Count | None / Few (3) / Standard (6) / Many (10) | Standard |
| Difficulty Multiplier | Easy (0.75x) / Medium (1.0x) / Hard (1.5x) / Mythic (2.0x) | Medium |

### Victory Condition
- Destroy the capital ship (not required to destroy all escorts)
- Optional bonus: Destroy all escorts for "clean sweep" XP bonus

### Rewards
- 300+ base XP (highest of any mode)
- Difficulty multiplier applies
- Boss-specific drop: unique upgrade card themed to that faction
- Perfect victory (no ship losses) bonus
- Speed bonus (kill before Phase 3)

### Unity Implementation Reference
```
Files:
  Core/GameModeLifecycle/CapitalAssaultLifecycle.cs
  Gameplay/BossEncounterManager.cs
  Ships/EpicShips/EpicShipController.cs
  Ships/EpicShips/EpicShipData.cs

Flow: MainMenu → CapitalAssaultSetup → SquadBuilder → Battle → CapitalAssaultResults
```

### Web Port Notes
- **Priority: P2.** Boss encounters are a highlight feature and only require the combat system + boss state machine
- Boss phase AI uses state machine (see Tech Spec Section 5)
- Multi-section rendering: boss sprite with colored section overlays showing damage
- Escort fighters use standard AI — no special implementation needed
- Stress field is an aura (reuse AuraSystem)

---

## 10. Multiplayer

### Overview
Real-time networked PvP combat. 2–8 players. Multiple game types. ELO rating system.

### Game Types
| Type | Players | Description |
|------|---------|-------------|
| 1v1 Duel | 2 | Head-to-head squad combat |
| 2v2 Team | 4 | Two teams of two, coordinated play |
| Free-for-All | 3–4 | Every player for themselves |
| Team Battle | 4–8 | Larger team configurations |
| Epic Warfare | 2–8 | Capital ships included |

### Network Architecture (Unity Implementation)
- **Protocol:** Unity Netcode for GameObjects (client-server model)
- **Authority:** Server authoritative for game state and combat resolution
- **Ownership:** Player ships owned by requesting client, AI ships owned by server
- **Lobby:** Host creates room, others join via lobby browser or direct code

### Matchmaking
- ELO rating system (starting 1000, K-factor 32)
- Win/loss record tracked
- Connection quality considered for matchmaking
- Geographic proximity preference

### Private Match Variant
- Custom rule modifications (point budget, time limit, faction restrictions)
- Password-protected lobbies
- Spectator mode for observers
- Custom map/battlefield selection

### Rewards
- 200+ base XP per match
- ELO-based bonuses (beating higher-rated opponents)
- Participation XP (even in losses)
- Season rankings (future)

### Unity Implementation Reference
```
Files:
  Core/GameModeLifecycle/MultiplayerLifecycle.cs
  Network/NetworkGameManager.cs
  Network/NetworkShipFactory.cs
  Network/NetworkLobbyManager.cs
  Network/NetworkConnectionHelper.cs
  GameModes/Multiplayer/UI/MultiplayerHubScreen.cs
  GameModes/Multiplayer/NetworkStateManager.cs

Flow: MainMenu → MultiplayerHub → Lobby → SquadBuilder → Battle → MultiplayerResults
```

### Web Port Notes
- **Priority: P5 (Future).** Full real-time multiplayer is a massive undertaking
- Web options: WebSocket server (Node.js/Deno) or WebRTC for peer-to-peer
- **Intermediate step:** Local multiplayer on same device (hot-seat for maneuver selection, simultaneous for combat)
- **Simpler first:** Asynchronous multiplayer (submit squad → AI plays your squad against opponent's AI-played squad)
- Consider Colyseus (open-source WebSocket game server) if pursuing real-time multiplayer
- ELO system is pure math — port directly regardless of network architecture

---

## Web Port Priority & Implementation Order

Based on development complexity, player value, and dependency chains:

### Tier 0: Core (Phases 1–2)
1. **Skirmish (Elimination only)** — This IS the game. Everything else is built on top of it.

### Tier 1: Engagement (Phases 2–4)
2. **Practice (Tutorial sub-mode)** — Onboarding for new players
3. **Practice (Free Play)** — Sandbox (trivial once Battle exists)
4. **Campaign (Act I)** — Story hook + progression proof
5. **Skirmish (all 8 objectives)** — Variety for the core mode

### Tier 2: Replayability (Phases 4–5)
6. **Survival** — Roguelike wave combat is popular on web
7. **Capital Assault** — Spectacle mode, boss fights
8. **Campaign (Acts II–IV)** — Long-term content

### Tier 3: Competitive (Phase 5+)
9. **Dogfight** — Thin wrapper on Skirmish
10. **Ace Duel** — Preset Dogfight configs
11. **Practice (Skill Drills + AI Training)** — Competitive training

### Tier 4: Multiplayer (Post-launch)
12. **Tournament** — Requires multiplayer or AI brackets
13. **Draft** — Requires multiplayer or AI drafters
14. **Multiplayer** — Full networking stack

---

## Shared Systems Required by All Modes

Every game mode depends on these core systems:

| System | Description | Used By |
|--------|-------------|---------|
| **MovementSystem** | Maneuver chart execution | All modes |
| **CombatSystem** | Attack resolution, dice, damage | All modes |
| **StressSystem** | Maneuver restrictions | All modes |
| **ShipRenderer** | Sprite display, rotation, health bars | All modes |
| **AI (ShipAI)** | Individual ship decision-making | All modes with AI |
| **AI (AIDirector)** | Fleet-level objective assignment | All fleet modes |
| **VictorySystem** | Win/lose condition checking | All modes |
| **HUD** | In-battle UI (health, minimap, abilities) | All modes |
| **CameraController** | Follow cam, zoom, shake | All modes |
| **AudioManager** | Weapon SFX, explosions, music | All modes |

**Mode-specific systems:**

| System | Description | Used By |
|--------|-------------|---------|
| **EvolutionSystem** | Ship XP, tier upgrades | Campaign, Survival |
| **ProgressionSystem** | Pilot XP, faction mastery | Campaign |
| **SaveManager** | Persistent data | Campaign, Progression |
| **WaveManager** | Enemy wave spawning | Survival |
| **BossPhaseManager** | Capital ship phase transitions | Capital Assault, Campaign (late) |
| **TournamentBracket** | Swiss/elimination pairing | Tournament |
| **DraftManager** | Pack generation, snake draft | Draft |
| **RoundManager** | Best-of-X round tracking | Dogfight, Ace Duel |
| **NetworkManager** | Real-time synchronization | Multiplayer |
| **MatchmakingService** | ELO-based pairing | Multiplayer |

---

## Mode Lifecycle Pattern

Every game mode in the Unity project follows a consistent lifecycle. This pattern should be preserved in the web port:

```typescript
interface GameModeLifecycle {
  /** Which mode this is */
  readonly mode: GameMode;

  /** Screen shown for mode setup/configuration */
  readonly setupScreen: ScreenType;

  /** Screen shown after battle */
  readonly resultsScreen: ScreenType;

  /** Initialize mode-specific session data */
  configureSession(session: SessionData): void;

  /** Define squad builder parameters (point budget, restrictions) */
  getSquadBuilderParams(): SquadBuilderConfig;

  /** Spawn ships and configure the battle */
  initializeBattle(spawner: ShipSpawner): void;

  /** Set win/loss conditions for this mode */
  setupVictoryConditions(victory: VictorySystem): void;

  /** Calculate rewards from battle results */
  calculateRewards(results: BattleResults): BattleRewards;

  /** Process the outcome (update progression, save, etc.) */
  processResults(results: BattleResults): void;

  /** Determine which screen to show after results */
  getNextScreen(didWin: boolean): ScreenType;
}
```

**Implementation:** Each game mode implements this interface. The game engine calls these methods in order. Mode-specific logic lives inside the lifecycle class, not spread across the engine.

This pattern means adding a new game mode requires:
1. Define a new lifecycle class implementing the interface
2. Add setup and results screen
3. Register in the mode registry

No changes to the battle engine, AI, or rendering systems needed.

---

*This document catalogs all game modes from the Unity prototype with full rules, configuration options, rewards, and web port notes. Use alongside TECH_SPEC_AND_ROADMAP.md when implementing game modes in the Shattered Stars web project.*
