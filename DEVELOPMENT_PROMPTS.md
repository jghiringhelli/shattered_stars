# Shattered Stars: Development Prompts Roadmap
## Self-Contained Session Prompts for Building the Complete Game

**Purpose:** Each section below is a standalone prompt you can paste into Claude Code to drive a focused development session. Sessions are ordered by dependency — complete earlier phases before later ones.

**How to use:**
1. Copy the prompt for the phase/task you want to work on
2. Paste it into a new Claude Code session
3. Claude will have context from the codebase and specs to execute

---

## Phase 0: Foundation (COMPLETED)
✅ Project scaffolding (Vite + TypeScript + Phaser 3)
✅ Core systems (EventBus, GameStore, GameClock)
✅ BattleScene with placeholder ships
✅ Basic camera and input controls

---

## Phase 1: Core Combat

### 1.1 Movement System
```
Implement the movement system for Shattered Stars based on specs/tech_spec_and_roadmap.md Section 4 (Movement System).

Requirements:
1. Create src/systems/MovementSystem.ts with:
   - ManeuverTemplate definitions for all 10 directions (straight, bank_left, bank_right, turn_left, turn_right, kturn, segnor_left, segnor_right, tallon_left, tallon_right)
   - resolveManeuver() function that converts maneuver + current position/angle into target position/angle
   - Bezier curve path points for smooth movement animation

2. Create src/data/maneuvers.ts with:
   - MANEUVER_TEMPLATES constant with all direction templates
   - Speed scaling factors (speed 1-5)

3. Integrate with BattleScene:
   - When a ship is selected, show available maneuvers (simple UI for now)
   - On maneuver selection, tween the ship along the path
   - Ship rotation should animate smoothly during the maneuver

4. Add stress tracking:
   - Red maneuvers add stress
   - Green maneuvers remove stress
   - Stressed ships cannot perform red maneuvers

Test by selecting a ship and executing different maneuvers. Verify the paths look correct for banks, turns, and K-turns.
```

### 1.2 Maneuver Dial UI
```
Create the maneuver dial UI for ship movement selection.

Requirements:
1. Create src/ui/ManeuverDial.ts:
   - Radial dial showing available maneuvers for the selected ship
   - Color-coded by difficulty (green/white/red)
   - Speed indicated by distance from center (speed 1 inner, speed 5 outer)
   - Grayed out maneuvers that are unavailable (red when stressed)

2. Create src/data/shipDials.ts:
   - Define maneuver dials for each ship type
   - Start with 4 ships per faction (light fighter, heavy fighter, interceptor, bomber)
   - Reference X-Wing miniatures dials as baseline

3. Integration:
   - Show dial when player's ship is selected
   - Click maneuver to select it
   - Show ghost preview of where ship will end up
   - Confirm button to execute maneuver
   - Hide dial during maneuver execution

4. Add keyboard shortcuts:
   - Number keys 1-5 for speed
   - Arrow keys to rotate dial selection
   - Enter to confirm

The dial should feel responsive and intuitive.
```

### 1.3 Combat System - Dice
```
Implement the dice-based combat system from specs/tech_spec_and_roadmap.md Section 4 (Combat System).

Requirements:
1. Create src/systems/CombatSystem.ts:
   - Attack dice rolling (faces: hit, critical, focus, blank)
   - Defense dice rolling (faces: evade, focus, blank)
   - Dice probabilities: attack (hit: 3/8, crit: 1/8, focus: 2/8, blank: 2/8)
   - Defense probabilities: (evade: 3/8, focus: 2/8, blank: 3/8)

2. Create resolveAttack() pure function:
   - Input: attacker stats, defender stats, range (1-3), modifiers
   - Roll attack dice based on attacker's attack value
   - Roll defense dice based on defender's agility + range bonus
   - Apply focus tokens (convert focus to hit/evade)
   - Cancel hits with evades (evades cancel hits before crits)
   - Apply damage: shields absorb hits, crits bypass shields to hull
   - Return detailed result object

3. Range bonuses:
   - Range 1: attacker +1 die
   - Range 2: no modifier
   - Range 3: defender +1 die

4. Create src/utils/random.ts:
   - Seeded random number generator for deterministic testing
   - Default to Math.random() for gameplay

5. Unit tests in tests/unit/systems/CombatSystem.test.ts:
   - Test dice distribution over 10000 rolls
   - Test damage application (shields then hull)
   - Test range modifiers
   - Test focus token conversion
   - Test crit bypass shields

Use Vitest for testing. All combat logic must be pure functions with no side effects.
```

### 1.4 Combat System - Targeting & Arcs
```
Implement targeting, firing arcs, and attack execution.

Requirements:
1. Create src/systems/TargetingSystem.ts:
   - calculateRange(ship1, ship2): returns range band (1, 2, or 3) or null if out of range
   - isInArc(attacker, target, arcType): checks if target is in attacker's firing arc
   - Arc types: front (90°), rear (90°), full (360°/turret)
   - getValidTargets(attacker, allShips): returns ships in range and arc

2. Add firing arc visualization:
   - When ship selected, show firing arc overlay
   - Highlight valid targets in green
   - Show range bands as concentric circles

3. Attack flow integration:
   - Player selects target from valid targets
   - Show attack preview (dice count, range, modifiers)
   - Execute attack on confirm
   - Show dice roll results (animated dice or result display)
   - Apply damage to target
   - Emit events: ATTACK_DECLARED, ATTACK_RESOLVED

4. Add to ship state:
   - Primary weapon arc (front for most ships)
   - Secondary weapon arc (if applicable)
   - Turret capability (full arc)

5. Visual feedback:
   - Laser/projectile effect from attacker to target
   - Shield flash on shield damage
   - Hull spark on hull damage
   - Explosion on destruction

Test by selecting ships and attacking targets at different ranges and angles.
```

### 1.5 Actions System
```
Implement the action system for Focus, Evade, Target Lock, Barrel Roll, and Boost.

Requirements:
1. Create src/systems/ActionSystem.ts:
   - Each action is a function that modifies ship state
   - Actions are performed after movement, before combat

2. Implement core actions:
   - Focus: grants focus token (convert focus results on dice)
   - Evade: grants evade token (adds 1 evade result to defense)
   - Target Lock: lock onto enemy ship (allows rerolls on attack)
   - Barrel Roll: lateral repositioning (move sideways without changing facing)
   - Boost: forward repositioning (execute a speed-1 straight or bank)

3. Action economy:
   - Ships get 1 action per turn (some get 2 with upgrades)
   - Available actions defined per ship type
   - Some actions are red (cause stress)

4. Create src/ui/ActionBar.ts:
   - Horizontal bar showing available actions for selected ship
   - Grayed out if action not available or already used
   - Tooltips explaining each action

5. Token visualization:
   - Show focus token near ship (circular icon)
   - Show evade token (hexagonal icon)
   - Show target lock line to locked target
   - Tokens clear at end of round (except target lock persists)

6. Integration:
   - After maneuver completes, prompt for action
   - Execute selected action
   - Then proceed to combat phase

Test each action and verify tokens apply correctly to combat.
```

### 1.6 Turn Structure
```
Implement the complete turn structure and phase management.

Requirements:
1. Update GameStore battle state with phase tracking:
   - Planning: all ships select maneuvers (player + AI)
   - Activation: ships execute maneuvers in initiative order
   - Combat: ships attack in initiative order
   - End: cleanup, advance turn counter

2. Create src/systems/TurnSystem.ts:
   - advancePhase(): moves to next phase
   - getActivationOrder(): returns ships sorted by pilot skill (high to low)
   - processPhase(): handles phase-specific logic

3. Initiative (Pilot Skill):
   - Higher PS activates later in Activation (advantage: see where enemies go)
   - Higher PS attacks first in Combat (advantage: shoot first)
   - Add PS to ship definitions (1-9 range)

4. Simultaneous fire rule:
   - Ships destroyed during combat phase still get to attack that round
   - Damage applied at end of combat phase
   - Track "pending destruction" state

5. End phase cleanup:
   - Remove evade and focus tokens
   - Process stress (if green maneuver, remove 1 stress)
   - Check victory conditions
   - Advance turn counter
   - Emit TURN_ENDED event

6. UI updates:
   - Phase indicator in HUD
   - Current ship highlight during activation
   - "Waiting for orders" state during planning

Test a full turn cycle with multiple ships moving, acting, and attacking.
```

---

## Phase 2: AI & Fleet Combat

### 2.1 Ship AI - Utility Scoring
```
Implement the utility AI system for individual ship decision-making per specs/tech_spec_and_roadmap.md Section 5.

Requirements:
1. Create src/ai/UtilityScorer.ts:
   - scoreManeuver(maneuver, context): returns 0-1 score
   - Context includes: self, target, allies, enemies, objective

2. Implement scoring considerations:
   - Offensive: distance to target, target in arc after maneuver
   - Defensive: avoid being in enemy arcs
   - Formation: maintain distance to allies (faction-weighted)
   - Objective: move toward assigned objective
   - Stress: penalize red maneuvers, bonus green when stressed

3. Create src/ai/FactionWeights.ts with FACTION_WEIGHTS:
   - terran_hegemony: high formation (0.9), low unpredictability (0.1)
   - free_confederation: high ally support (0.8), medium unpredictability (0.4)
   - synthetic_collective: high swarming (0.9), high objective compliance (0.95)
   - void_corsairs: high flanking (0.9), high unpredictability (0.8)
   - ascendant_empire: balanced weights

4. Create src/ai/ShipAI.ts:
   - selectManeuver(ship, context): evaluate all maneuvers, pick highest score
   - selectAction(ship, context): choose best action based on situation
   - selectTarget(ship, enemies): pick target using priority scoring

5. Add noise for unpredictability:
   - Random factor scaled by faction unpredictability weight
   - Prevents AI from being perfectly predictable

6. Unit tests:
   - Verify Hegemony ships prefer formation-maintaining maneuvers
   - Verify Corsairs prefer flanking positions
   - Verify stressed ships pick green maneuvers

Test by running battles and observing AI behavior matches faction identity.
```

### 2.2 AI Director - Fleet Level
```
Implement the AI Director for fleet-level decision making.

Requirements:
1. Create src/ai/AIDirector.ts:
   - Manages objectives for all AI ships in a fleet
   - Runs each decision tick (not every frame)

2. Implement objective assignment:
   - Interceptors: hunt priority targets or harass
   - Bombers: always target largest enemy ship
   - Support: stay near most damaged ally
   - Fighters: engage nearest or defend zone
   - Gunships: hold position and fire

3. Create src/ai/ThreatAssessor.ts:
   - calculateThreat(enemy): score based on attack, range, targeting us
   - assessBattleState(): overall advantage/disadvantage
   - identifyPriorityTargets(): damaged enemies, support ships, aces

4. Implement fleet strategies:
   - Aggressive: push forward, focus fire
   - Defensive: hold formation, protect damaged ships
   - Flanking: split and attack from angles
   - Retreat: disengage damaged ships

5. Strategy selection based on battle state:
   - Winning comfortably → Aggressive
   - Even fight → faction default
   - Losing → Defensive or faction-specific (Corsairs flee)

6. Integrate with TurnSystem:
   - AI Director updates at start of Planning phase
   - Assigns objectives to all AI ships
   - Ships use objectives in utility scoring

Test 5v5 battles and verify fleets behave coherently, not as individuals.
```

### 2.3 Difficulty System
```
Implement difficulty scaling for AI opponents.

Requirements:
1. Create src/ai/DifficultySystem.ts with profiles:
   - Apprentice: slow reactions, suboptimal choices, weak targeting
   - Veteran: good decisions, occasional mistakes
   - Ace: near-optimal play, coordinated attacks
   - Mythic: perfect information usage, punishing

2. Difficulty affects:
   - Reaction time: ticks between AI decisions (8 → 4 → 2 → 1)
   - Maneuver accuracy: chance to pick optimal (0.4 → 0.7 → 0.9 → 0.98)
   - Targeting accuracy: priority target selection quality
   - Ability usage: how well AI uses focus/evade/locks
   - Formation quality: how well formations are maintained

3. Implementation:
   - Add noise to utility scores inversely proportional to difficulty
   - Higher difficulty = less noise = more optimal choices
   - Apprentice AI occasionally picks suboptimal maneuvers intentionally

4. Create difficulty selector:
   - Stored in GameStore
   - Selectable in battle setup (when we have menus)
   - Affects all AI ships equally

5. Balance testing:
   - Run 100 battles at each difficulty
   - Apprentice should lose 70%+ to competent play
   - Mythic should win 70%+ against unguided player ships

Test by playing against each difficulty and feeling the difference.
```

### 2.4 Fleet Battles
```
Implement full fleet battles with player + AI allies vs AI enemies.

Requirements:
1. Update battle initialization:
   - Player controls 1 ship directly
   - 3-4 AI allies controlled by AIDirector
   - 4-5 AI enemies controlled by opposing AIDirector

2. Player fleet AI:
   - Friendly AI ships follow player's general strategy
   - Can assign simple commands: Attack my target, Defend me, Free hunt
   - AI allies use same utility system but with player as "leader"

3. Create src/ui/FleetCommands.ts:
   - Simple command buttons for directing allies
   - Visual indicator showing ally assignments

4. Update HUD for fleet battles:
   - Ally health bars (smaller, positioned at screen edge)
   - Enemy count indicator
   - Squadron status overview

5. Minimap implementation:
   - Show all ships as faction-colored dots
   - Player ship highlighted
   - Selected target marked
   - Camera viewport indicator

6. Victory conditions:
   - Elimination: destroy all enemy ships
   - Track both sides' remaining ships
   - Emit BATTLE_ENDED when condition met

Test 5v5 battles running to completion with victory/defeat determination.
```

---

## Phase 3: Faction Identity

### 3.1 Faction Passive Abilities
```
Implement faction-specific passive abilities from specs/scifi_factions.md.

Requirements:
1. Create src/systems/FactionSystem.ts:
   - Applies faction bonuses during relevant game phases
   - Checks faction conditions (nearby allies, formation, etc.)

2. Implement Terran Hegemony passives:
   - Formation Discipline: +1 defense die when 2+ allies at Range 1
   - Shield Harmonics: recover 1 shield when nearby ally recovers shields

3. Implement Free Confederation passives:
   - Heroic Inspiration: nearby allies get +1 attack when this ship is damaged
   - Adaptive Tactics: can change action after seeing enemy maneuvers

4. Implement Synthetic Collective passives:
   - Network Targeting: share target locks across all Collective ships
   - Processing Efficiency: calculate action is always available

5. Implement Void Corsairs passives:
   - Intimidation: damaged enemies at Range 1 roll 1 fewer defense die
   - Dirty Fighting: bonus attack die when attacking from outside enemy arc

6. Implement Ascendant Empire passives:
   - Bio-Regeneration: recover 1 hull at end of round if not attacked
   - Psionic Link: coordinate action has unlimited range

7. Visual indicators:
   - Show when passive is active (glow, icon)
   - Explain bonus in combat preview

Test each faction's passive and verify it activates correctly.
```

### 3.2 Faction Exclusive Mechanics
```
Implement the unique mechanic for each faction per specs/advanced_mechanics.md.

Requirements:
1. Terran Hegemony - Military Doctrine System:
   - Choose doctrine before battle (Aggressive, Defensive, Electronic Warfare)
   - Doctrine affects all Hegemony ships
   - Create doctrine selection UI

2. Free Confederation - Heroic Moment System:
   - Track heroic momentum (damage taken, allies saved, outnumbered fights)
   - At thresholds, trigger heroic moments (bonuses, reinforcements)
   - Visual fanfare on heroic moment

3. Synthetic Collective - Adaptive Protocol System:
   - Collective learns from enemy patterns during battle
   - Unlocks counter-protocols as battle progresses
   - Show "Analyzing..." progress indicator

4. Void Corsairs - Reputation & Crew System:
   - Track reputation during battle (kills, intimidation, plunder)
   - Higher reputation unlocks crew bonuses
   - Reputation levels: Unknown → Notorious → Infamous → Legendary

5. Ascendant Empire - Bio-Evolution System:
   - Ships evolve MID-BATTLE based on triggers
   - Combat Pressure: hull <25% → +2 hull
   - Speed: evade 5 attacks → +1 agility
   - Weapon: score 3 crits → +1 attack

6. Each mechanic needs:
   - State tracking in GameStore
   - Trigger detection
   - Effect application
   - UI feedback

Test each faction's unique mechanic activates and provides the intended bonus.
```

### 3.3 All Five Factions Complete
```
Ensure all five factions are fully playable with complete rosters.

Requirements:
1. Create src/data/ships/ with one file per faction:
   - terranHegemony.ts (17 ships)
   - freeConfederation.ts (16 ships)
   - syntheticCollective.ts (15 ships)
   - voidCorsairs.ts (15 ships)
   - ascendantEmpire.ts (17 ships)

2. Each ship needs:
   - Full stats (hull, shields, attack, agility, speed range)
   - Maneuver dial
   - Available actions
   - Point cost
   - Faction ability keyword
   - Sprite key (placeholder for now)

3. Create src/data/ships/index.ts:
   - Export all ships
   - Lookup functions: getShipById, getShipsByFaction, getShipsByRole

4. Balance pass:
   - Point costs should reflect power level
   - No ship should be strictly better than another at same cost
   - Roles should feel distinct

5. Update placeholder sprite generation:
   - Different shapes for different roles
   - Fighter: triangle
   - Interceptor: diamond
   - Bomber: rectangle
   - Support: circle
   - Gunship: hexagon
   - Capital: large star

Reference specs/ship_stats_reference.md for stat blocks.
```

---

## Phase 4: Progression & Evolution

### 4.1 Ship Evolution System
```
Implement the ship evolution system from specs/evolution_mechanics.md.

Requirements:
1. Create src/systems/EvolutionSystem.ts:
   - Track XP per ship (10 per kill, 5 assist, 25 objective)
   - Evolution paths defined per ship
   - Trigger evolution when XP threshold met

2. Create src/data/evolutions.ts:
   - Evolution trees for each base ship
   - Each path: target ship, XP required, stat changes, new abilities
   - Visual tier: base → evolved → elite

3. Evolution flow:
   - Ship reaches XP threshold
   - Player chooses evolution path (if multiple)
   - Ship transforms: stats change, new abilities unlock
   - Visual change (sprite swap when we have art)

4. Evolution UI:
   - Show XP progress on ship card
   - Evolution choice modal when threshold reached
   - Evolution tree view showing all paths

5. Persistence:
   - Evolution state saved with ship
   - Evolved ships carry over between battles (in campaign)

6. Balance:
   - Evolved ships cost more points
   - Evolution should feel meaningful but not overpowered

Start with 1 evolution tree per faction to test the system.
```

### 4.2 Pilot Progression
```
Implement pilot skill progression and specialization trees.

Requirements:
1. Create src/systems/PilotSystem.ts:
   - Pilots have PS level (1-9)
   - PS increases through campaign play
   - Higher PS = later activation, earlier combat

2. Create src/data/pilots.ts:
   - Named pilots with unique abilities
   - Generic pilots at each PS level
   - Pilot abilities (one per named pilot)

3. Specialization trees:
   - Ace: combat bonuses, attack abilities
   - Bomber: ordnance bonuses, target lock improvements
   - Support: coordinate abilities, ally buffs

4. Specialization unlocks:
   - Choose specialization at PS 3
   - Unlock abilities at PS 5, 7, 9
   - Can only pick one tree per pilot

5. UI:
   - Pilot card showing PS, specialization, abilities
   - Specialization tree view
   - XP to next PS level

6. Integration:
   - Pilot assigned to ship
   - Pilot abilities apply to that ship
   - Pilot can be reassigned to different ships

Start with 3 named pilots per faction.
```

### 4.3 Campaign Act I
```
Implement Campaign Act I: The Convergence (5 tutorial missions).

Requirements:
1. Create src/data/campaign/actI.ts:
   - 5 mission definitions
   - Each mission: objective, starting ships, enemies, new mechanic introduced

2. Mission structure:
   - Mission 1: Basic flight (1 ship, no enemies, maneuver tutorial)
   - Mission 2: First combat (1v1, combat tutorial)
   - Mission 3: Formation flying (2 ships, allies tutorial)
   - Mission 4: First evolution choice (evolve after victory)
   - Mission 5: Multi-faction encounter (3v4, fleet combat)

3. Create src/scenes/CampaignScene.ts:
   - Mission selection map
   - Mission briefing modal
   - Victory/defeat results

4. Create src/systems/MissionSystem.ts:
   - Load mission configuration
   - Spawn ships per mission spec
   - Track objectives
   - Trigger victory/defeat

5. Save system integration:
   - Track completed missions
   - Track ship XP and evolution
   - Track pilot progression

6. Rewards:
   - XP for completion
   - Bonus for optional objectives
   - Unlock next mission

Playtest all 5 missions in sequence.
```

### 4.4 Save System
```
Implement persistent save system for campaign progress.

Requirements:
1. Create src/save/SaveSchema.ts:
   - Versioned save data structure
   - Campaign progress (completed missions, current act)
   - Fleet state (ships, evolution, XP)
   - Pilot roster (pilots, PS, specializations)
   - Settings (audio, difficulty, keybinds)

2. Create src/save/SaveManager.ts:
   - save(): serialize state to localStorage
   - load(): deserialize from localStorage
   - Auto-save after each battle
   - Manual save slots (3 slots)

3. Create src/save/Migration.ts:
   - Handle save version upgrades
   - Never break old saves
   - Migration functions per version

4. Save triggers:
   - After battle results processed
   - After evolution choice
   - After pilot assignment
   - On game exit

5. Load flow:
   - Check for existing save on boot
   - Offer continue or new game
   - Load state into GameStore

6. Error handling:
   - Corrupted save detection
   - Backup save before overwrite
   - Recovery options

Test save/load cycle across multiple sessions.
```

---

## Phase 5: Testing Infrastructure

### 5.1 Unit Test Suite
```
Build comprehensive unit test coverage for game systems.

Requirements:
1. Set up Vitest in the project:
   - Configure vitest.config.ts
   - Add test scripts to package.json
   - Set up coverage reporting

2. Test files structure:
   tests/
   ├── unit/
   │   ├── systems/
   │   │   ├── MovementSystem.test.ts
   │   │   ├── CombatSystem.test.ts
   │   │   ├── ActionSystem.test.ts
   │   │   └── TurnSystem.test.ts
   │   ├── ai/
   │   │   ├── UtilityScorer.test.ts
   │   │   ├── ShipAI.test.ts
   │   │   └── AIDirector.test.ts
   │   └── data/
   │       ├── ships.test.ts (validate all ship data)
   │       └── evolutions.test.ts (validate evolution paths)

3. Test patterns:
   - Pure functions should have 100% coverage
   - Use seeded RNG for deterministic combat tests
   - Property-based tests for combat edge cases
   - Snapshot tests for ship data validation

4. Key test cases:
   - Every maneuver direction produces correct offset
   - Combat damage never goes negative
   - Stress prevents red maneuvers
   - Evolution paths reference valid ships
   - Point costs are within expected range

5. CI integration:
   - Tests run on every commit
   - Coverage threshold: 80% for systems, 100% for pure functions

Run: npm test
Coverage: npm run test:coverage
```

### 5.2 Integration Tests
```
Build integration tests for multi-system interactions.

Requirements:
1. Create tests/integration/:
   - battle/fullTurnCycle.test.ts
   - battle/fleetBattle.test.ts
   - campaign/missionFlow.test.ts
   - save/saveLoadCycle.test.ts

2. Test scenarios:
   - Full turn: planning → activation → combat → end
   - Fleet battle: 5v5 runs to completion
   - Mission: load mission → battle → results → save
   - Evolution: ship gains XP → evolves → stats change

3. Mock strategies:
   - Mock Phaser for headless testing
   - Use GameStore directly without rendering
   - Simulate time with manual clock ticks

4. Create tests/helpers/:
   - createTestBattle(): set up a battle state
   - createTestShip(): create ship with defaults
   - simulateTurns(n): run n turns headlessly
   - getWinner(): determine battle outcome

5. Assertions:
   - Battle reaches conclusion
   - No ships have negative health
   - Turn count is reasonable (not infinite)
   - Events fire in correct order

These tests catch issues where systems interact incorrectly.
```

### 5.3 Balance Simulation
```
Build headless simulation system for automated balance testing.

Requirements:
1. Create src/balance/SimulationRunner.ts:
   - Run battles without rendering
   - Configurable: factions, point budget, difficulty, iterations

2. Create src/balance/HeadlessBattle.ts:
   - Minimal battle execution (no Phaser)
   - Uses same game logic as real battles
   - Deterministic with seeded RNG

3. Simulation scenarios:
   - Every faction vs every faction (25 matchups)
   - Multiple point budgets (100, 200, 300)
   - All difficulty levels
   - 100+ battles per matchup for statistical significance

4. Create src/balance/BalanceReport.ts:
   - Win rates per faction pair
   - Average battle duration
   - Ship survival rates
   - Most/least effective ships

5. Expected outcomes:
   - No faction > 55% win rate overall
   - Rock-paper-scissors relationships hold
   - Higher point budget doesn't favor any faction

6. CLI interface:
   - npm run balance -- --factions terran,confed --iterations 1000
   - Output: JSON report + console summary

7. CI integration:
   - Run balance check weekly or on data changes
   - Alert if faction exceeds 57% win rate

This catches balance issues before players find them.
```

### 5.4 Playwright E2E Tests
```
Set up Playwright for end-to-end browser testing.

Requirements:
1. Install and configure Playwright:
   - npm install -D @playwright/test
   - Configure playwright.config.ts
   - Set up test browsers (Chrome, Firefox)

2. Create tests/e2e/:
   - smoke.spec.ts: game loads, shows title
   - battle.spec.ts: can start and complete a battle
   - navigation.spec.ts: menu navigation works
   - settings.spec.ts: settings persist

3. Test scenarios:
   - Game loads without console errors
   - Can select a ship with mouse click
   - Can pan camera with keyboard
   - Can zoom with scroll wheel
   - Battle ends with victory/defeat screen

4. Visual regression (optional):
   - Screenshot comparison for UI elements
   - Catch unintended visual changes

5. Helpers:
   - Page object models for common interactions
   - Wait for game to be ready
   - Trigger game events for testing

6. CI integration:
   - Run E2E tests on PR
   - Run against built game (not dev server)
   - Upload screenshots on failure

Run: npx playwright test
Debug: npx playwright test --debug
```

### 5.5 Manual Testing Checklist
```
Create comprehensive manual testing checklist for QA.

Requirements:
1. Create docs/TESTING_CHECKLIST.md with sections:

## Pre-Release Checklist

### Core Mechanics
- [ ] All 10 maneuver directions execute correctly
- [ ] Stress system prevents/removes as expected
- [ ] Combat dice rolls are visually shown
- [ ] Damage applies to shields then hull
- [ ] Ships are destroyed at 0 hull
- [ ] All 5 actions work (Focus, Evade, Lock, Roll, Boost)

### Factions
- [ ] Each faction has distinct color scheme
- [ ] Each faction passive triggers correctly
- [ ] Each faction exclusive mechanic works
- [ ] AI exhibits faction-specific behavior

### Fleet Combat
- [ ] 5v5 battles run smoothly (60fps)
- [ ] AI allies follow fleet commands
- [ ] Victory/defeat triggers correctly
- [ ] Minimap shows all ships

### Modes (per mode)
- [ ] Mode can be started from menu
- [ ] Mode-specific rules apply
- [ ] Mode completes with results screen
- [ ] Rewards are granted

### Campaign
- [ ] All Act I missions completable
- [ ] Evolution triggers at XP threshold
- [ ] Save/load preserves progress
- [ ] Mission briefings display correctly

### Visual/Audio
- [ ] No placeholder art in release build
- [ ] All sound effects play
- [ ] No visual glitches on camera zoom
- [ ] Performance acceptable on target hardware

### Edge Cases
- [ ] Simultaneous destruction (both ships fire, both die)
- [ ] All ships destroyed same frame
- [ ] Maximum stress accumulation
- [ ] 0-hull ship completes its attack

2. Version this checklist and update as features added.
```

---

## Phase 6: Game Feel & Polish

### 6.1 Camera Effects
```
Implement dynamic camera effects for game feel.

Requirements:
1. Create src/rendering/CameraController.ts (expand existing):
   - Smooth follow with configurable lerp
   - Zoom tween for cinematic moments
   - Screen shake with intensity and duration
   - Slow motion (time scale manipulation)

2. Speed zoom effect:
   - Detect when selected ship executing speed 4-5 maneuver
   - Zoom in 10-15% during maneuver
   - Slight motion blur in direction of travel (shader or sprite trail)
   - Zoom back out on maneuver complete

3. Impact shake:
   - Shake on taking damage (intensity = damage amount)
   - Bigger shake for hull damage than shield
   - Maximum shake on critical hit

4. Kill camera:
   - On enemy destruction, brief slow-mo (0.3x time scale for 0.5s)
   - Zoom toward explosion
   - Resume normal speed and zoom
   - Only for player kills (not AI vs AI)

5. Combat focus:
   - When attacking, slight zoom toward combat
   - When being attacked, subtle pan to show attacker

6. Stress pulse:
   - On gaining stress, quick zoom out + red vignette flash
   - Visual representation of pilot strain

Test all effects and tune for feel (not too intrusive, not too subtle).
```

### 6.2 Visual Effects
```
Implement weapon effects, explosions, and status visuals.

Requirements:
1. Create src/rendering/VFXManager.ts:
   - Particle emitter pooling
   - Effect spawning by type
   - Auto-cleanup on complete

2. Weapon effects:
   - Laser: line with glow, faction color
   - Missile: sprite with smoke trail
   - Torpedo: larger, slower projectile
   - Collision: spark burst on hit

3. Create faction weapon colors:
   - Hegemony: blue-white beams
   - Confederation: orange-gold bolts
   - Collective: cyan pulses
   - Corsairs: purple-crimson chaotic
   - Empire: green bio-beams

4. Status effects:
   - Shield shimmer when active
   - Shield flash on absorbing damage
   - Hull spark on hull damage
   - Focus glow (yellow aura)
   - Evade spin (green particle ring)
   - Target lock line (red dashed)

5. Explosions:
   - Size based on ship size
   - Faction-tinted explosion core
   - Debris particles
   - Lingering smoke

6. Engine effects:
   - Thruster glow (faction energy color)
   - Intensity based on speed
   - Trail during boost

Use Phaser's particle emitter system.
```

### 6.3 Audio System
```
Implement audio system with faction-specific sounds.

Requirements:
1. Create src/audio/AudioManager.ts:
   - Music playback (looping, crossfade)
   - SFX playback (pooled, positional)
   - Volume controls (master, music, SFX)
   - Mute toggle

2. Sound categories:
   - Weapons: laser, missile, torpedo (per faction)
   - Impacts: shield hit, hull hit, explosion
   - UI: button click, menu navigate, confirm, cancel
   - Ambient: engine hum, space ambience
   - Stingers: victory, defeat, evolution

3. Positional audio:
   - Sounds louder when camera near source
   - Pan based on screen position
   - Range-based volume falloff

4. Music system:
   - Menu theme
   - Battle theme (per faction or generic)
   - Intensity layers (add layers as battle intensifies)
   - Victory/defeat stingers

5. Create placeholder sounds:
   - Use web audio synthesis for basic sounds
   - Square wave for lasers
   - Noise burst for explosions
   - Note this as placeholder in code

6. Settings integration:
   - Save volume preferences
   - Respect system mute
   - Keyboard shortcut for quick mute (M)
```

### 6.4 UI Polish
```
Polish all UI elements for release quality.

Requirements:
1. Faction theming:
   - Menu accent colors match faction
   - Button styles consistent per faction
   - Faction logo/emblem in corners

2. Transitions:
   - Fade between scenes
   - Slide-in for panels
   - Scale-up for modals
   - Stagger for list items

3. HUD improvements:
   - Health bars with faction color trim
   - Ability cooldown indicators
   - Turn/phase indicator refined
   - Minimap border and legend

4. Typography:
   - Consistent font family
   - Clear hierarchy (title, body, label)
   - Readable at all resolutions

5. Responsive layout:
   - HUD scales with screen size
   - Minimum supported: 1024x768
   - Maximum tested: 2560x1440

6. Accessibility:
   - Colorblind mode (patterns, not just colors)
   - Text scaling option
   - High contrast mode

7. Loading states:
   - Loading indicator for async operations
   - Progress bar for long loads
   - Never blank screen

Test on multiple screen sizes and browsers.
```

---

## Phase 7: Additional Modes

### 7.1 Skirmish Full Implementation
```
Complete the Skirmish mode with all 8 objective types.

Requirements:
1. Create src/modes/SkirmishMode.ts implementing GameModeLifecycle:
   - Setup screen with all configuration options
   - Squad builder integration
   - Victory condition per objective type

2. Implement all objective types:
   - Elimination: destroy all enemies (done)
   - Escort: protect transport reaching destination
   - Control: capture and hold zones (2-4)
   - Assassination: destroy designated ace
   - King of the Hill: single central zone
   - Extraction: move VIP to map edge
   - Points Race: score by destroying ships
   - Timed Survival: survive X minutes

3. Configuration options:
   - Point budget (50/100/200/300)
   - Faction selection (player and enemy)
   - Difficulty level
   - Objective type
   - Time limit (optional)
   - Epic ships toggle

4. Create src/scenes/SkirmishSetupScene.ts:
   - All options in clean UI
   - Start battle button
   - Back to menu button

5. Create src/scenes/SquadBuilderScene.ts:
   - Select ships within point budget
   - Assign pilots
   - Equip upgrades (future)
   - Validate squad legality

6. Rewards:
   - XP based on performance
   - Victory/flawless multipliers

Test each objective type.
```

### 7.2 Survival Mode
```
Implement Survival wave-based mode.

Requirements:
1. Create src/modes/SurvivalMode.ts:
   - Wave spawning system
   - Between-wave upgrade selection
   - Endless scaling

2. Wave structure (from game_modes_reference.md):
   - Waves 1-5: basic fighters (mini-boss wave 5)
   - Waves 6-10: mixed squadrons (boss wave 10)
   - Waves 11-15: elite pilots (boss wave 15)
   - Waves 16-20: epic ships appear (boss wave 20)
   - Waves 21+: endless scaling

3. Create src/systems/WaveSystem.ts:
   - generateWave(waveNumber): enemy composition
   - Scaling formula for endless waves
   - Boss wave detection

4. Between-wave upgrades:
   - Choose 1 of 3 random upgrades
   - Weapons: +attack, new weapon
   - Defense: +hull, +shields, +agility
   - Mobility: new maneuvers, actions
   - Special: faction abilities

5. Post-boss major upgrades:
   - Evolve a ship
   - Add new ship to squad
   - Unique powerful ability

6. Scoring:
   - Points per wave
   - Points per kill
   - Time bonus
   - Streak multiplier

7. Leaderboard (local):
   - Track high scores
   - Show wave reached

Test reaching wave 20+ and verify scaling feels fair but challenging.
```

### 7.3 Capital Assault Mode
```
Implement boss battles against capital ships.

Requirements:
1. Create src/modes/CapitalAssaultMode.ts:
   - Boss selection
   - Player squad configuration
   - Multi-phase boss fight

2. Create src/entities/CapitalShip.ts:
   - Multi-section health (Fore, Mid, Aft or similar)
   - Section-specific weapons
   - Section disable on 0 HP

3. Boss phase system:
   - Phase 1 (100-60%): standard attacks
   - Phase 2 (60-30%): increased aggression, reinforcements
   - Phase 3 (30-0%): desperation attacks, maximum danger

4. Boss abilities:
   - Broadside: area damage
   - Launch fighters: spawn escorts
   - Shield regen: recover shields over time
   - Tractor beam: pull ship close
   - Stress field: nearby enemies gain stress

5. Create 5 boss fights (one per faction):
   - Hegemony Battlecruiser
   - Confederation Corvette
   - Collective Mothership
   - Corsair Pirate Ship
   - Empire Dreadnought

6. Victory:
   - Destroy capital ship (escorts optional)
   - Special rewards: faction-specific upgrades

Test each boss and tune difficulty.
```

### 7.4 Dogfight & Ace Duel
```
Implement competitive 1v1 modes.

Requirements:
1. Create src/modes/DogfightMode.ts:
   - Best-of-X rounds (configurable)
   - Small point budget (50)
   - Faster round timer (3 min)
   - Track round wins

2. Round structure:
   - Same squad all rounds
   - Win round by destroying enemy
   - Draw if time expires
   - First to majority wins match

3. Create src/modes/AceDuelMode.ts:
   - Preset matchup selection
   - No squad building
   - Pre-configured loadouts

4. Define 6 ace duel matchups:
   - Elite fighters (Hegemony vs Confederation)
   - Interceptor duel
   - Heavy ship duel
   - Gunship duel
   - Bomber squadron (3v3)
   - Hunter vs hunted

5. UI:
   - Round indicator
   - Match score display
   - Round transition screen
   - Match complete screen

6. Balance matchups:
   - Each side should have ~50% win rate
   - Different player skill should be deciding factor

Test all preset matchups for balance.
```

---

## Phase 8: Art Integration

### 8.1 SD Generation Pipeline
```
Set up and run the Stable Diffusion art generation pipeline.

Requirements:
1. Verify SD setup:
   - Docker running with A1111
   - DreamShaper XL model loaded
   - All 8 LoRAs installed and renamed correctly

2. Run sd_generate.py verify to check:
   - API accessible
   - Model loaded
   - LoRAs found

3. Generate style anchors:
   - 10 variations per faction
   - Save to C:\StableDiffusion\shattered-stars-assets\style-anchors\
   - Document seeds of good results

4. Curate anchors:
   - Select best 1-2 per faction
   - These define faction visual identity
   - Save selected seeds for consistency

5. Optional: Train faction LoRAs:
   - 20-30 images per faction
   - Train for 500-1000 steps
   - Test consistency improvement

6. Generate full ship roster:
   - Use curated prompts per ship
   - Generate 5 variants each
   - Select best for game use

Document the generation workflow for future asset creation.
```

### 8.2 Sprite Integration
```
Integrate generated sprites into the game.

Requirements:
1. Process generated images:
   - Resize to game resolution (64x64 base)
   - Ensure transparent backgrounds
   - Consistent orientation (facing up)

2. Create texture atlases:
   - One atlas per faction
   - Use TexturePacker or similar
   - Generate JSON atlas data

3. Update BootScene:
   - Load atlases instead of generating placeholders
   - Fallback to placeholders if atlas missing

4. Update ship rendering:
   - Use sprite keys from atlas
   - Add evolution tier variants
   - Verify rotation looks correct

5. Evolution visuals:
   - Base: standard sprite
   - Evolved: 10% larger + overlay details
   - Elite: 20% larger + special effects

6. Test all ships render correctly at all zoom levels.
```

### 8.3 UI Art & Effects
```
Replace UI placeholders with final art.

Requirements:
1. Generate UI elements:
   - Faction emblems
   - Button backgrounds
   - Panel frames
   - Health bar styles

2. HUD assets:
   - Minimap frame
   - Action icons
   - Status token icons
   - Phase indicators

3. Menu backgrounds:
   - Title screen art
   - Faction selection backdrop
   - Battle loading screen

4. Effect sprites:
   - Explosion frames
   - Weapon projectiles
   - Shield effects
   - Engine trails

5. Integrate all:
   - Update UI components to use new assets
   - Ensure consistent style across game
   - Test on multiple resolutions
```

---

## Maintenance Prompts

### Balance Tuning
```
Run balance analysis and tune faction/ship stats.

1. Run: npm run balance -- --iterations 1000 --output report.json

2. Analyze report:
   - Flag any faction > 55% win rate
   - Identify overperforming ships (high survival + high kills)
   - Identify underperforming ships (low pick rate, low win rate)

3. Tuning levers:
   - Point cost: expensive ships should be powerful
   - Stats: adjust hull/shields/attack/agility
   - Abilities: adjust effect strength or trigger conditions

4. Make adjustments in src/data/ships/

5. Re-run balance simulation

6. Document changes in CHANGELOG.md
```

### Bug Triage
```
Investigate and fix reported bugs.

1. Reproduce the bug:
   - Follow exact steps from report
   - Check browser console for errors
   - Check game state at time of bug

2. Identify root cause:
   - Add console.log or debugger
   - Check event bus for unexpected events
   - Verify state transitions

3. Write failing test that reproduces bug

4. Fix the bug

5. Verify test passes

6. Check for similar bugs elsewhere

7. Update CHANGELOG.md
```

### Performance Profiling
```
Profile and optimize game performance.

1. Use browser dev tools Performance tab

2. Record during a 5v5 battle

3. Identify bottlenecks:
   - Long frame times (> 16ms)
   - Excessive GC pauses
   - Heavy functions

4. Common optimizations:
   - Object pooling for frequently created objects
   - Spatial hashing for range checks
   - Batch sprite updates
   - Throttle AI calculations

5. Target: 60fps on mid-range hardware (GTX 1060 / equivalent)

6. Test on multiple browsers (Chrome, Firefox, Safari)
```

---

## Quick Reference

### File Structure
```
src/
├── main.ts              # Entry point
├── config.ts            # Constants
├── core/                # Framework-agnostic core
│   ├── EventBus.ts
│   ├── GameStore.ts
│   ├── GameClock.ts
│   └── types.ts
├── data/                # Game data
│   ├── ships/
│   ├── evolutions.ts
│   ├── pilots.ts
│   └── campaign/
├── systems/             # Game logic
│   ├── MovementSystem.ts
│   ├── CombatSystem.ts
│   ├── ActionSystem.ts
│   └── ...
├── ai/                  # AI systems
│   ├── ShipAI.ts
│   ├── AIDirector.ts
│   └── factions/
├── scenes/              # Phaser scenes
├── ui/                  # UI components
├── rendering/           # Visual systems
├── audio/               # Audio systems
├── modes/               # Game mode implementations
└── save/                # Persistence
```

### Key Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run typecheck    # Type check
npm test             # Run unit tests
npm run test:e2e     # Run Playwright tests
npm run balance      # Run balance simulation
python sd_generate.py verify  # Check SD setup
python sd_generate.py anchors # Generate style anchors
```

---

*This document is the complete development roadmap. Work through phases in order. Each prompt is self-contained — paste it into a Claude Code session to execute that task.*
