# Shattered Stars — Development Roadmap with Claude Prompts

> **How to use this document**: Each step below is a self-contained prompt you paste into a fresh Claude session. Work through them in order. Each prompt produces a testable deliverable. After completing a step, commit your code before starting the next.
>
> **Important**: Steps marked [DEPENDS ON: Step X] require that step to be completed first. Steps without dependencies within a phase can be done in any order.
>
> **New session per step**: Start a fresh Claude Code session for each step. The prompts contain all context needed.

---

## Phase 0: Project Bootstrap

### Step 0.1 — Initialize Project

**Deliverable**: Empty Phaser 3 + TypeScript + Vite project that runs in the browser showing a black canvas with "Shattered Stars" text.

```
TASK: Initialize a new web game project called "shattered-stars" using the following exact stack:

TECH STACK:
- Runtime: Phaser 3 (latest stable) — 2D game framework
- Language: TypeScript (strict mode)
- Bundler: Vite (latest stable)
- Testing: Vitest
- Package Manager: pnpm
- Linting: ESLint + Prettier

STEPS:
1. Run `pnpm create vite shattered-stars --template vanilla-ts`
2. Install dependencies:
   - pnpm add phaser
   - pnpm add -D vitest @vitest/coverage-v8 eslint prettier eslint-config-prettier
3. Configure tsconfig.json with:
   - "strict": true
   - "noUncheckedIndexedAccess": true
   - "target": "ES2020"
   - "module": "ESNext"
   - "moduleResolution": "bundler"
   - "lib": ["ES2020", "DOM"]
4. Configure vite.config.ts with:
   - base: './'
   - build.target: 'es2020'
   - server.port: 3000
   - server.open: true
5. Create src/main.ts as the Phaser entry point:
   - Create a Phaser.Game instance with config:
     - type: Phaser.AUTO
     - width: 1280, height: 720
     - backgroundColor: '#0a0a1a'
     - scale.mode: Phaser.Scale.FIT
     - scale.autoCenter: Phaser.Scale.CENTER_BOTH
   - Create a single BootScene that displays "Shattered Stars" centered in white text
6. Update index.html to be a clean game container (no default Vite content)
7. Add scripts to package.json: dev, build, preview, test, lint
8. Verify `pnpm dev` opens browser and shows the black canvas with text

DO NOT use Phaser's physics engines (Arcade or Matter). This game uses chart-based movement, not physics.
DO NOT add any game logic yet. This is purely project scaffolding.
```

---

### Step 0.2 — Project Structure & CLAUDE.md

**Deliverable**: Complete folder structure and CLAUDE.md for the new project.

```
TASK: Set up the project folder structure and create a CLAUDE.md file for the "shattered-stars" Phaser 3 + TypeScript game project.

CONTEXT: This is a tactical dogfighting arcade game — top-down, sprite-based, 2D. Ships move using discrete maneuver charts (like the X-Wing Miniatures board game), NOT physics. The player controls one ship while an AI Director commands their fleet. 5 asymmetric factions, 79 ships, evolution trees, and campaign mode.

CREATE THIS FOLDER STRUCTURE (empty files with TODO comments are fine):
```
src/
├── main.ts                  # Entry point (already exists from Step 0.1)
├── config.ts                # Game constants, balance values
├── core/                    # Framework-agnostic core systems
│   ├── EventBus.ts          # Typed publish/subscribe
│   ├── GameStore.ts         # Immer-based state management
│   ├── GameClock.ts         # Fixed timestep + interpolation
│   └── types.ts             # Shared type exports
├── data/                    # All game data definitions
│   ├── index.ts             # Re-exports
│   ├── factions.ts          # Faction definitions & abilities
│   ├── ships.ts             # Ship stat blocks
│   ├── evolutions.ts        # Evolution trees
│   ├── abilities.ts         # Special abilities & auras
│   ├── maneuvers.ts         # Maneuver templates & dials
│   ├── upgrades.ts          # Upgrade cards & slots
│   └── campaign.ts          # Mission definitions
├── entities/                # Game entity definitions
│   ├── Ship.ts
│   ├── Projectile.ts
│   ├── Pilot.ts
│   └── Fleet.ts
├── systems/                 # Game logic systems
│   ├── MovementSystem.ts
│   ├── CombatSystem.ts
│   ├── AbilitySystem.ts
│   ├── AuraSystem.ts
│   ├── StressSystem.ts
│   ├── EvolutionSystem.ts
│   └── VictorySystem.ts
├── ai/                      # AI systems
│   ├── AIDirector.ts
│   ├── ShipAI.ts
│   ├── UtilityScorer.ts
│   └── factions/            # Per-faction AI profiles
│       ├── HegemonyAI.ts
│       ├── ConfederationAI.ts
│       ├── CollectiveAI.ts
│       ├── CorsairsAI.ts
│       └── AscendantAI.ts
├── scenes/                  # Phaser scenes
│   ├── BootScene.ts
│   ├── MainMenuScene.ts
│   ├── BattleScene.ts
│   └── ResultsScene.ts
├── ui/                      # UI components
│   ├── HUD.ts
│   ├── HealthBar.ts
│   └── Minimap.ts
├── rendering/               # Visual presentation
│   ├── ShipRenderer.ts
│   ├── ProjectileRenderer.ts
│   └── CameraController.ts
└── save/                    # Persistence
    ├── SaveManager.ts
    └── SaveSchema.ts

tests/
├── unit/
│   ├── systems/
│   ├── ai/
│   └── data/
└── integration/
```

THEN create CLAUDE.md at the project root with these key sections:
- Project Identity: shattered-stars, TypeScript, Phaser 3, 2D tactical dogfighting arcade
- Tech Stack: Phaser 3, TypeScript strict, Vite, Vitest, pnpm, Immer for state
- CRITICAL RULES:
  - NO Phaser physics (Arcade/Matter). Movement is chart-based.
  - All game data as TypeScript const objects with `as const`
  - Immer for state management, typed EventBus for communication
  - Pure functions for game logic (combat, movement resolution)
  - ECS-inspired: entities are data, systems are behavior
- Code Standards: 50-line max functions, 300-line max files, intention-revealing names
- Testing: Vitest for all game logic, minimum 80% coverage
- 5 Factions: Terran Hegemony, Free Confederation, Synthetic Collective, Void Corsairs, Ascendant Empire
- Movement System: Discrete maneuver charts — 10 directions × 5 speeds × 3 difficulty colors

Create empty files in each directory with a single-line comment describing what goes there. Don't implement anything yet.
```

---

## Phase 1: Core Engine

### Step 1.1 — Event Bus & Game Store

**Deliverable**: Typed event bus and Immer-based state store with tests.

```
TASK: Implement the core EventBus and GameStore for the "shattered-stars" Phaser 3 + TypeScript game.

CONTEXT: This is a 2D tactical dogfighting arcade game. Systems communicate through a typed event bus. State is managed with Immer for immutable updates.

FILE 1: src/core/EventBus.ts
Create a strongly-typed publish/subscribe event bus:
- Generic type parameter for event map: EventBus<EventMap>
- Methods: on(event, handler), off(event, handler), emit(event, payload), once(event, handler)
- Priority system: handlers can register with priority (higher = called first)
- Type safety: event names and payload types checked at compile time
- No external dependencies

Define the game event map type:
```typescript
export interface GameEventMap {
  'ship:damaged': { shipId: string; damage: number; source: string };
  'ship:destroyed': { shipId: string; destroyedBy: string };
  'ship:moved': { shipId: string; fromX: number; fromY: number; toX: number; toY: number; angle: number };
  'combat:attack': { attackerId: string; defenderId: string; result: unknown };
  'combat:dice_rolled': { dice: unknown[]; type: 'attack' | 'defense' };
  'action:performed': { shipId: string; action: string };
  'turn:start': { turnNumber: number };
  'turn:end': { turnNumber: number };
  'battle:start': { playerFaction: string; enemyFaction: string };
  'battle:end': { winner: string; stats: unknown };
  'ui:update': { component: string; data: unknown };
}
```

FILE 2: src/core/GameStore.ts
Create an Immer-based game state store:
- Install immer: `pnpm add immer`
- Define GameState interface with slices: battle, fleet, campaign, ui, settings
- Methods: getState(), update(producer), subscribe(selector, callback), reset()
- The update method uses Immer's produce() for immutable updates
- Selectors are memoized — only notify subscribers when selected slice changes
- Serializable to JSON for save/load

Define initial state structure:
```typescript
export interface GameState {
  battle: {
    ships: Map<string, ShipState>;
    projectiles: Map<string, ProjectileState>;
    turnNumber: number;
    phase: 'planning' | 'execution' | 'combat' | 'cleanup';
    isActive: boolean;
  };
  fleet: {
    playerSquad: string[];
    enemySquad: string[];
    reserves: string[];
  };
  campaign: {
    currentMission: number;
    completedMissions: string[];
    resources: Record<string, number>;
    research: string[];
  };
  ui: {
    selectedShip: string | null;
    hoveredShip: string | null;
    showMinimap: boolean;
    menuOpen: boolean;
  };
  settings: {
    musicVolume: number;
    sfxVolume: number;
    difficulty: 'easy' | 'normal' | 'hard' | 'veteran';
  };
}
```

FILE 3: tests/unit/core/EventBus.test.ts
Tests:
- Emitting event calls all registered handlers
- Handler receives correct payload type
- off() removes handler
- once() handler fires exactly once
- Priority ordering works (higher priority first)
- Emitting unlistened event does nothing (no error)

FILE 4: tests/unit/core/GameStore.test.ts
Tests:
- getState() returns current state
- update() produces new immutable state
- subscribe() notifies on state change
- subscribe() does NOT notify when unrelated slice changes
- reset() restores initial state
- State is serializable to JSON

Run `pnpm test` to verify all tests pass.
```

---

### Step 1.2 — Game Clock & Fixed Timestep

**Deliverable**: Fixed timestep game clock that decouples logic from rendering.

```
TASK: Implement a fixed-timestep game clock for "shattered-stars" (Phaser 3 + TypeScript).

CONTEXT: This is a 2D tactical game. Game logic must run at a fixed 60Hz timestep, decoupled from the render frame rate. Phaser's scene update() provides deltaTime from the render loop — we need to accumulate it and consume in fixed steps.

FILE: src/core/GameClock.ts

Requirements:
- FIXED_TIMESTEP = 1000/60 (16.667ms) for game logic
- Accumulate elapsed time from Phaser's update(time, delta) callback
- Consume accumulated time in fixed steps, calling registered update functions
- Cap accumulated time to prevent spiral of death (max 5 fixed steps per frame)
- Provide interpolation alpha for rendering between fixed steps (smooth visuals)
- Support time scale factor (1.0 = normal, 0.0 = paused, 0.5 = slow motion, 2.0 = fast forward)
- Track total elapsed game time (not wall time)

Interface:
```typescript
export class GameClock {
  constructor(fixedTimestep?: number); // Default 16.667ms

  /** Called from Phaser scene update(). Returns number of fixed steps consumed. */
  tick(deltaMs: number): number;

  /** Register a function to be called every fixed step */
  onFixedUpdate(callback: (dt: number) => void): void;

  /** Get interpolation alpha (0-1) for rendering between states */
  getAlpha(): number;

  /** Time scale: 0=paused, 1=normal, 2=fast */
  timeScale: number;

  /** Total game time elapsed in ms */
  readonly totalTime: number;

  /** Current fixed step number */
  readonly stepCount: number;
}
```

FILE: tests/unit/core/GameClock.test.ts
Tests:
- Accumulates time correctly
- Fires fixed update at correct intervals
- Multiple fixed steps fire when enough time accumulated
- Caps at max steps per frame (no spiral of death)
- TimeScale 0 pauses updates
- TimeScale 2 doubles update rate
- Interpolation alpha returns correct value between steps
- totalTime tracks game time (affected by timeScale, not wall time)

Show how to integrate with a Phaser scene:
```typescript
// In BattleScene.ts update():
update(time: number, delta: number) {
  this.gameClock.tick(delta);
  // Rendering uses this.gameClock.getAlpha() for interpolation
}
```
```

---

### Step 1.3 — Scene Flow & State Machine

**Deliverable**: Phaser scenes with transitions: Boot → MainMenu → Battle → Results → MainMenu.

```
TASK: Implement the scene flow for "shattered-stars" (Phaser 3 + TypeScript).

CONTEXT: This is a 2D tactical dogfighting arcade game with 5 factions. The scene flow is:
Boot (load assets) → MainMenu (faction select) → Battle (gameplay) → Results (stats) → MainMenu

The game uses Phaser 3 scenes. Each scene is a separate class extending Phaser.Scene.

IMPLEMENT THESE SCENES:

1. src/scenes/BootScene.ts
   - Displays "Loading..." text centered on screen
   - Preloads placeholder assets (generate colored rectangles as textures in code — NO external image files needed)
   - Creates placeholder textures: 'ship_blue' (32x32 blue rect), 'ship_red' (32x32 red rect), 'laser_blue' (4x16 cyan rect), 'laser_red' (4x16 red rect)
   - Use `this.textures.createCanvas()` or `this.make.graphics()` to generate textures at runtime
   - When loading complete, transitions to MainMenuScene

2. src/scenes/MainMenuScene.ts
   - Dark background (#0a0a1a)
   - Title "SHATTERED STARS" in large white text, centered top
   - Subtitle "The Galactic Schism" smaller, below title
   - 3 buttons as clickable text (no images needed):
     - "SKIRMISH" → starts BattleScene with default squads
     - "CAMPAIGN" → shows "Coming Soon" text (placeholder)
     - "SETTINGS" → shows "Coming Soon" text (placeholder)
   - Faction display: Show 5 faction names with their colors:
     - Terran Hegemony (#2E4A99)
     - Free Confederation (#FF6B35)
     - Synthetic Collective (#0080FF)
     - Void Corsairs (#4B0082)
     - Ascendant Empire (#228B22)
   - Clicking a faction name highlights it (selected faction for skirmish)
   - Pressing SKIRMISH launches BattleScene with selected faction vs random enemy

3. src/scenes/BattleScene.ts
   - For now, just a dark play area with:
     - 3 blue rectangles (player ships) on the left
     - 3 red rectangles (enemy ships) on the right
     - Ships should be Phaser GameObjects (sprites using the generated textures)
     - Player can click a ship to select it (highlight with a white border)
     - Selected ship can be moved with WASD (simple movement for testing — chart-based movement comes later)
     - Press ESC to end battle → transition to ResultsScene
   - Display "BATTLE" text at top center and turn counter
   - This is a PLACEHOLDER. Real battle logic comes in later steps.

4. src/scenes/ResultsScene.ts
   - Shows "BATTLE COMPLETE" text
   - Shows placeholder stats: "Ships Destroyed: 0" etc.
   - "RETURN TO MENU" button → transitions to MainMenuScene

SCENE TRANSITIONS:
- Use this.scene.start('SceneName', data) for transitions
- Pass data between scenes (faction selection, battle results)
- Fade transitions if easy with Phaser's camera

Register all scenes in main.ts Phaser game config.

DO NOT implement any game logic, combat, or AI. This is purely scene flow and navigation.
```

---

## Phase 2: Ship Foundation

### Step 2.1 — Ship Data Model

**Deliverable**: Complete TypeScript data definitions for all 5 factions with 2 starter ships each (10 ships total for MVP).

```
TASK: Define the complete ship data model for "shattered-stars" (Phaser 3 + TypeScript) and create 10 MVP ships (2 per faction).

CONTEXT: This is a 2D tactical dogfighting game based on X-Wing Miniatures board game mechanics. Ships have stats (attack, agility, hull, shields), actions (focus, evade, target lock, barrel roll, boost), maneuver dials (discrete movement options at different speeds and difficulties), and upgrade slots. Movement is NOT physics-based — ships select maneuvers from a chart.

5 FACTIONS:
- Terran Hegemony: Military discipline, formations, +shields. Colors: Blue/Silver (#2E4A99)
- Free Confederation: Versatile heroes, adaptable. Colors: Orange/Green (#FF6B35)
- Synthetic Collective: AI swarm, networked, expendable. Colors: Gray/Cyan (#2F2F2F)
- Void Corsairs: Pirates, dirty tricks, crits from behind. Colors: Purple/Crimson (#4B0082)
- Ascendant Empire: Bio-tech, psionic, regeneration. Colors: Green/Gold (#228B22)

FILE: src/data/types.ts — Core type definitions
```typescript
export type FactionId = 'terran_hegemony' | 'free_confederation' | 'synthetic_collective' | 'void_corsairs' | 'ascendant_empire';
export type ShipSize = 'small' | 'medium' | 'large' | 'huge';
export type ShipRole = 'light_fighter' | 'heavy_fighter' | 'interceptor' | 'bomber' | 'support' | 'gunship' | 'capital';
export type ActionType = 'focus' | 'evade' | 'target_lock' | 'barrel_roll' | 'boost' | 'coordinate' | 'jam' | 'cloak' | 'slam' | 'calculate' | 'reinforce' | 'rotate_arc';
export type ManeuverDirection = 'straight' | 'bank_left' | 'bank_right' | 'turn_left' | 'turn_right' | 'kturn' | 'segnor_left' | 'segnor_right' | 'tallon_left' | 'tallon_right';
export type ManeuverDifficulty = 'green' | 'white' | 'red';
export type UpgradeSlotType = 'torpedo' | 'missile' | 'cannon' | 'turret' | 'bomb' | 'crew' | 'system' | 'modification' | 'talent' | 'astromech' | 'illicit' | 'tech' | 'title';
```

Define full interfaces for: ShipStats, ManeuverDefinition, ShipDefinition, FactionDefinition, FactionPalette

FILE: src/data/ships.ts — 10 MVP ships (2 per faction)
Use these balance baselines (from X-Wing Miniatures, adapted):

TERRAN HEGEMONY:
1. Talon-class Fighter — light_fighter (2 ATK, 3 AGI, 3 HUL, 2 SHD, 17 pts)
   Actions: focus, evade, target_lock, barrel_roll
   Dial: speed 1-5, mostly white, turns at speed 1-2, banks 1-3, straights 1-5, kturn at 4 (red)
2. Vanguard Heavy Fighter — heavy_fighter (2 ATK, 3 AGI, 3 HUL, 4 SHD, 23 pts)
   Actions: focus, evade, target_lock, barrel_roll
   Dial: speed 1-4, more greens at low speed, kturn red

FREE CONFEDERATION:
1. Comet-class Fighter — light_fighter (2 ATK, 2 AGI, 2 HUL, 2 SHD, 16 pts)
   Actions: focus, target_lock
   Dial: speed 1-4, balanced white/green
2. Phoenix-class Starfighter — heavy_fighter (3 ATK, 2 AGI, 4 HUL, 2 SHD, 21 pts)
   Actions: focus, target_lock, barrel_roll
   Dial: speed 1-4, straights green, turns white, kturn red

SYNTHETIC COLLECTIVE:
1. Hunter-class Drone — light_fighter (2 ATK, 2 AGI, 2 HUL, 2 SHD, 15 pts)
   Actions: calculate, target_lock (NOTE: calculate instead of focus — Collective-specific)
   Dial: speed 1-4, many greens (efficient machines)
2. Interceptor Drone — interceptor (3 ATK, 2 AGI, 4 HUL, 1 SHD, 20 pts)
   Actions: calculate, target_lock, barrel_roll
   Dial: speed 1-5, aggressive

VOID CORSAIRS:
1. Ghost-class Infiltrator — light_fighter (2 ATK, 2 AGI, 5 HUL, 0 SHD, 13 pts)
   Actions: focus, barrel_roll (NO target lock — pirates don't plan)
   Dial: speed 1-3, mostly green (sneaky)
2. Razor-class Raider — heavy_fighter (3 ATK, 3 AGI, 4 HUL, 1 SHD, 22 pts)
   Actions: focus, evade, target_lock, barrel_roll, boost
   Dial: speed 1-5, aggressive mix

ASCENDANT EMPIRE:
1. Symbiont-class Fighter — light_fighter (2 ATK, 2 AGI, 4 HUL, 1 SHD, 17 pts)
   Actions: focus, target_lock
   Dial: speed 1-4, balanced
2. Evolved Interceptor — interceptor (2 ATK, 3 AGI, 2 HUL, 2 SHD, 19 pts)
   Actions: focus, evade, target_lock, boost
   Dial: speed 1-5, many greens

FILE: src/data/factions.ts — 5 faction definitions
Each faction needs: id, name, motto, colorPalette (primary, secondary, accent, energy, glow), playstyle description, exclusive mechanic name and type.

FILE: src/data/maneuvers.ts — Maneuver template definitions
Define the spatial templates for each maneuver direction:
- straight: (0, -1) normalized, 0° angle change
- bank_left: (-0.4, -0.9), -45°
- bank_right: (0.4, -0.9), +45°
- turn_left: (-0.7, -0.7), -90°
- turn_right: (0.7, -0.7), +90°
- kturn: (0, -1), +180° (always red)
- segnor_left: (-0.4, -0.9), +135°
- segnor_right: (0.4, -0.9), -135°
- tallon_left: (-0.7, -0.7), +180°
- tallon_right: (0.7, -0.7), +180°
These templates get scaled by speed and rotated by current facing.

FILE: tests/unit/data/ships.test.ts — Data validation tests
- All ships have valid stat ranges (ATK 1-4, AGI 0-3, HUL 1-12, SHD 0-6)
- All ships have at least 1 action
- All maneuver dials have at least 1 green maneuver
- All ships have a point cost > 0
- No duplicate ship IDs
- Every ship references a valid faction
```

---

### Step 2.2 — Movement System

**Deliverable**: Chart-based movement system where ships select maneuvers and execute them via tweens. This is THE core mechanic.

```
TASK: Implement the discrete maneuver chart movement system for "shattered-stars" (Phaser 3 + TypeScript).

CONTEXT: This is THE core mechanic of the game. Ships do NOT move with physics or WASD. Instead:
1. Player selects a maneuver from their ship's dial (e.g., "Speed 3 Bank Left")
2. The maneuver maps to a fixed spatial template (offset + angle change)
3. The template is scaled by speed and rotated by the ship's current facing
4. The ship tweens smoothly from start position to end position along a curved path

This is faithful to the X-Wing Miniatures board game — discrete, deterministic movement.

FILE: src/systems/MovementSystem.ts

SPEED_SCALE_FACTOR: 50 pixels per speed unit (so speed 3 straight = 150px forward)

Core function — resolveManeuver():
```typescript
interface ManeuverResult {
  targetX: number;
  targetY: number;
  targetAngle: number;      // degrees, 0 = facing up
  pathPoints: { x: number; y: number }[];  // For curved tween path
  difficulty: ManeuverDifficulty;
}

function resolveManeuver(
  currentX: number, currentY: number, currentAngle: number,
  maneuver: ManeuverDefinition
): ManeuverResult
```

This function:
1. Looks up the maneuver template (deltaX, deltaY, deltaAngle) from maneuvers.ts
2. Scales the delta by speed × SPEED_SCALE_FACTOR
3. Rotates the delta by currentAngle (so "straight" always means "forward relative to ship")
4. Returns target position, angle, and path points for the tween

Path generation for curved maneuvers:
- Straight: linear path (just start and end point)
- Banks: quadratic bezier curve (control point offset to the turn side)
- Turns: tighter quadratic bezier
- K-turn: linear path forward, then 180° rotation at destination

ALSO implement:
- getAvailableManeuvers(shipId): returns the ship's dial, filtered by stress (stressed ships cannot do red maneuvers)
- getManeuverPreview(shipId, maneuver): returns the ManeuverResult for UI preview (ghost position)
- executeManeuver(shipId, maneuver): applies the maneuver to game state + returns tween config

The executeManeuver function should:
1. Resolve the maneuver to get target position
2. Update game state (ship position, angle, stress)
3. Return a Phaser tween configuration object for smooth visual movement
4. Emit 'ship:moved' event via EventBus

Stress rules:
- Green maneuver: remove 1 stress token
- White maneuver: no stress change
- Red maneuver: add 1 stress token
- Stressed ships CANNOT select red maneuvers

FILE: tests/unit/systems/MovementSystem.test.ts
Tests:
- Straight speed 1: ship facing up moves 50px forward (0, -50)
- Straight speed 3: ship moves 150px forward
- Bank left speed 2: ship moves forward-left and turns -45°
- Turn right speed 1: ship moves right and turns +90°
- K-turn: ship moves forward then faces opposite direction
- Ship facing 90° (right): straight moves to the right, not up
- Ship facing 180° (down): straight moves downward
- Stressed ship: red maneuvers filtered from available list
- Green maneuver removes stress
- Red maneuver adds stress
- All 10 maneuver directions produce correct offsets

FILE: Integration in BattleScene.ts
Update the placeholder BattleScene:
- Selected ship shows available maneuvers as ghost positions (semi-transparent previews)
- Click a ghost position to execute that maneuver
- Ship tweens smoothly to the new position along the curved path
- After movement, the maneuver dial refreshes
- Show the maneuver dial as a simple list of text buttons: "S1↑ S2↑ S3↑ BL2↗ BR2↗" etc.

This replaces the WASD placeholder movement from Step 1.3.

IMPORTANT: Movement resolution must be a PURE FUNCTION (resolveManeuver). No side effects. No Phaser dependency. The Phaser scene just reads the result and creates tweens.
```

---

### Step 2.3 — Combat System (Dice & Damage)

**Deliverable**: Complete attack resolution with dice rolls, focus/evade modifiers, and shield/hull damage.

```
TASK: Implement the dice-based combat system for "shattered-stars" (Phaser 3 + TypeScript).

CONTEXT: Combat uses dice — the same system as X-Wing Miniatures. Attacker rolls red dice (attack), defender rolls green dice (defense). Hits minus evades = damage. Damage goes to shields first, then hull. Critical hits bypass shields. Focus tokens convert ambiguous results.

ALL combat resolution MUST be pure functions. No side effects. No Phaser dependency. The combat system takes inputs and returns results — the game state and rendering layers consume those results.

FILE: src/systems/CombatSystem.ts

DICE SYSTEM:
Attack Die (d8 simulated):
- Faces 1-2: blank (25% — miss)
- Faces 3-5: focus_result (37.5% — hit only if attacker has Focus token)
- Faces 6-7: hit (25% — always hits)
- Face 8: critical (12.5% — bypasses shields)

Defense Die (d8 simulated):
- Faces 1-2: blank (25% — no evade)
- Faces 3-5: focus_result (37.5% — evade only if defender has Focus token)
- Faces 6-8: evade (37.5% — always evades)

SEEDED RANDOM: Use a seedable RNG (simple linear congruential generator or pass in a random function) so combat is reproducible for testing and replays.

ATTACK RESOLUTION — resolveAttack(context, rng):
Input: AttackContext { attacker stats, defender stats, range (1-3), modifiers }
Process:
1. Roll attackDice (= attacker.attack stat, modified by abilities)
2. Roll defenseDice (= defender.agility stat + range bonus: +1 die at range 3, +0 at range 2, -0 at range 1)
3. Apply focus: if attacker has focus token, convert all focus_result → hit
4. Apply evade: if defender has focus token, convert all focus_result → evade. If defender has evade token, add 1 automatic evade.
5. Cancel: each evade cancels one hit (hits before crits)
6. Remaining hits → shield damage (reduce shields)
7. Remaining damage after shields → hull damage
8. Critical hits bypass shields entirely → hull damage directly
9. Hull ≤ 0 → ship destroyed

Output: AttackResult { attackRoll, defenseRoll, hitsLanded, critsLanded, shieldDamage, hullDamage, shipDestroyed }

RANGE CALCULATION:
- Range = Euclidean distance between ships / RANGE_BAND_SIZE
- RANGE_BAND_SIZE = 200 pixels (so Range 1 = 0-200px, Range 2 = 200-400px, Range 3 = 400-600px)
- Beyond Range 3: cannot attack

FIRING ARC CHECK:
- Standard: 90° forward arc (ship's facing ± 45°)
- Function: isInFiringArc(attacker, target) → boolean
- Check if target is within attacker's forward arc AND within Range 3

ALSO implement:
- canAttack(attackerState, defenderState): checks range, arc, and team
- calculateRange(ship1, ship2): returns range band 1-3 or null if out of range
- applyDamage(shipState, hitsLanded, critsLanded): returns new ship state with damage applied

FILE: tests/unit/systems/CombatSystem.test.ts
Tests (use seeded RNG for deterministic tests):
- Attack with 3 dice, all blanks: 0 damage
- Attack with 3 dice, all hits, defender rolls all blanks: 3 damage to shields then hull
- Critical hit bypasses shields: 1 crit vs ship with 2 shields → 0 shield damage, 1 hull damage
- Focus token converts focus_results to hits
- Evade token adds 1 automatic evade
- Range 3 gives defender +1 defense die
- Out of range: canAttack returns false
- Firing arc: target behind attacker → not in arc
- Ship destroyed when hull reaches 0
- Damage applies to shields first, overflow to hull
- Expected damage distribution over 1000 rolls matches probability (statistical test)

FILE: Integration in BattleScene.ts
After a ship completes its maneuver:
- Check if any enemy is in range and arc
- If yes, automatically fire (for now — action economy comes later)
- Show dice roll results as floating text
- Apply damage and update health display
- Destroyed ships fade out and remove from play
```

---

## Phase 3: First Playable

### Step 3.1 — AI Ship Control

**Deliverable**: AI-controlled enemy ships that select maneuvers and fire using Utility AI scoring.

```
TASK: Implement AI ship control for enemy ships in "shattered-stars" (Phaser 3 + TypeScript).

CONTEXT: The player controls one ship by selecting maneuvers. ALL other ships (enemy AND the rest of the player's fleet) are controlled by AI. The AI uses a Utility AI scoring system — each possible maneuver gets a score based on weighted considerations, and the highest-scoring maneuver is chosen.

Each faction has different weight profiles making their AI behave differently:
- Hegemony: Formation-focused, disciplined (high formationMaintenance, low unpredictability)
- Confederation: Heroic, protects allies (high allySupport, moderate unpredictability)
- Collective: Swarm, calculated (high swarming, almost zero unpredictability)
- Corsairs: Flanking, self-interested (high flanking, high unpredictability)
- Ascendant: Balanced, adapts mid-battle (moderate everything)

FILE: src/ai/UtilityScorer.ts
```typescript
interface ScoringContext {
  self: ShipState;
  target: ShipState | null;
  allies: ShipState[];
  enemies: ShipState[];
  factionWeights: FactionWeightProfile;
}

interface FactionWeightProfile {
  aggressiveness: number;       // 0-1: value offensive positioning
  selfPreservation: number;     // 0-1: avoid danger
  formationMaintenance: number; // 0-1: stay near allies
  objectiveCompliance: number;  // 0-1: follow director orders
  allySupport: number;          // 0-1: protect allies
  flanking: number;             // 0-1: get behind enemies
  swarming: number;             // 0-1: cluster on targets
  unpredictability: number;     // 0-1: random noise
}
```

scoreManeuver(maneuver, context) → 0.0 to 1.0:
- Offensive score: How well does this maneuver put an enemy in my firing arc at range 1-2?
- Defensive score: How many enemy arcs am I NOT in after this maneuver?
- Formation score: How close am I to the average ally position?
- Flanking score: Am I getting behind the enemy (outside their forward arc)?
- Swarming score: Am I moving toward the same target as my allies?
- Stress penalty: Red maneuvers score lower; green maneuvers score higher when stressed
- Random noise: ± unpredictability weight

FILE: src/ai/ShipAI.ts
For each AI ship per turn:
1. Get available maneuvers (from their dial, filtered by stress)
2. Score every maneuver using UtilityScorer
3. Pick the highest-scoring maneuver (with noise for variety)
4. Execute the maneuver
5. After movement: if an enemy is in range+arc, attack the best target

Target selection: Attack the enemy in arc that has the lowest remaining HP (focus fire on wounded).

FILE: src/ai/factions/ — One file per faction with weight profiles
```typescript
// HegemonyAI.ts
export const HEGEMONY_WEIGHTS: FactionWeightProfile = {
  aggressiveness: 0.5, selfPreservation: 0.6,
  formationMaintenance: 0.9, objectiveCompliance: 0.8,
  allySupport: 0.7, flanking: 0.3, swarming: 0.4, unpredictability: 0.1,
};
```
Define all 5 faction profiles.

FILE: Update BattleScene.ts
- Turn-based flow: Player selects maneuver → all AI ships select maneuvers → all ships execute simultaneously → combat phase → next turn
- Show a "PLANNING" phase where player picks maneuver
- Show an "EXECUTION" phase where all ships tween to new positions
- Show a "COMBAT" phase where all ships in range fire
- Enemy ships use ShipAI for all decisions
- Player's OTHER ships (if more than 1) also use ShipAI with the player's faction weights

TESTS: tests/unit/ai/UtilityScorer.test.ts
- Hegemony AI strongly prefers maneuvers that maintain formation
- Corsairs AI strongly prefers flanking maneuvers
- Collective AI strongly prefers swarming maneuvers
- Stressed ship AI avoids red maneuvers
- AI with target in arc scores offensive position highly
- Unpredictability adds variance to decisions
```

---

### Step 3.2 — Battle HUD & Health Bars

**Deliverable**: In-battle UI showing ship health, turn counter, faction colors, and selected maneuver.

```
TASK: Implement the battle HUD for "shattered-stars" (Phaser 3 + TypeScript).

CONTEXT: During battle, the player needs to see:
- Health bars (shields + hull) for all visible ships
- Selected ship indicator
- Available maneuvers for the selected player ship
- Turn counter and battle phase
- Minimap showing all ship positions

All UI should use faction colors:
- Terran Hegemony: #2E4A99 (blue)
- Free Confederation: #FF6B35 (orange)
- Synthetic Collective: #0080FF (cyan-blue)
- Void Corsairs: #4B0082 (purple)
- Ascendant Empire: #228B22 (green)

FILE: src/ui/HealthBar.ts
- Phaser GameObjects (graphics + rectangles) attached above each ship
- Shield bar (faction energy color) on top, Hull bar (red/green gradient) below
- Width proportional to current/max value
- Flash when taking damage
- Disappear when ship is at full health (declutter)
- Shield bar hidden if ship has 0 max shields

FILE: src/ui/ManeuverDial.ts
- Panel on the left side of screen when a player ship is selected
- Shows all available maneuvers organized by speed (rows) and direction (columns)
- Color-coded: green maneuvers in green, white in white, red in red
- Unavailable maneuvers (red when stressed) shown grayed out
- Click a maneuver to select it
- Selected maneuver shown highlighted
- Ghost preview of ship's destination appears on the battlefield when hovering a maneuver

FILE: src/ui/HUD.ts
- Top center: Turn counter ("Turn 3 — Planning Phase")
- Top left: Player faction name and emblem (just colored text for now)
- Top right: Enemy faction name
- Bottom center: "Execute" button (confirms maneuver selection, starts execution)
- Bottom right: Minimap (200x200px rectangle showing ship positions as colored dots)

FILE: src/ui/Minimap.ts
- Small rectangle in corner showing the full battlefield
- Player ships as faction-colored dots
- Enemy ships as their faction-colored dots
- Current view rectangle shown as white border
- Click minimap to move camera

FILE: src/rendering/CameraController.ts
- Camera follows the selected player ship by default
- Mouse wheel zooms in/out (0.5x to 2.0x)
- Right-click drag to pan camera
- Press Space to snap camera back to selected ship
- Smooth follow with lerp (not instant snap)

UPDATE BattleScene.ts to integrate all HUD elements.

No new game logic — this is purely visual/UI work building on existing systems.
```

---

### Step 3.3 — Skirmish Mode (First Playable Game)

**Deliverable**: A complete playable skirmish: pick faction, build squad within point budget, fight AI to destruction, see results.

```
TASK: Implement the complete Skirmish game mode for "shattered-stars" (Phaser 3 + TypeScript). This is the FIRST FULLY PLAYABLE VERSION of the game.

CONTEXT: Skirmish is a quick battle mode:
1. Player selects their faction and builds a squad within a point budget
2. AI opponent's faction and squad are generated
3. Battle plays out turn by turn
4. Game ends when one side is eliminated
5. Results screen shows stats

BUILD ON EXISTING SYSTEMS: EventBus, GameStore, MovementSystem, CombatSystem, ShipAI, HUD

FILE: src/scenes/SquadSelectScene.ts (NEW)
- Player selects faction (5 faction buttons with colors)
- Shows available ships for that faction (2 ships per faction from Step 2.1 data)
- Point budget: 100 points
- Click ships to add to squad (show running point total)
- Can add multiple of the same ship
- "READY" button starts battle when squad is valid (>0 ships, ≤100 points)
- AI squad auto-generated: random enemy faction, random ships up to 100 points

FILE: src/systems/VictorySystem.ts
- Check victory conditions each turn:
  - All enemy ships destroyed → PLAYER WINS
  - All player ships destroyed → PLAYER LOSES
  - Turn limit (30 turns) reached → side with more ships wins; tie = draw
- Emit 'battle:end' event with winner and statistics

FILE: src/systems/BattleStatistics.ts
- Track per-battle stats:
  - Total turns
  - Ships destroyed (player + enemy)
  - Total damage dealt / received
  - Maneuvers executed
  - Shots fired / hits landed
- Calculate accuracy percentage
- Calculate efficiency (damage dealt per point spent)

FILE: Update ResultsScene.ts
- Show winner (faction name + color)
- Show statistics from BattleStatistics
- "PLAY AGAIN" → SquadSelectScene
- "MAIN MENU" → MainMenuScene

FILE: Update main.ts scene flow
Boot → MainMenu → SquadSelect → Battle → Results → (SquadSelect or MainMenu)

TURN FLOW (detailed):
1. PLANNING PHASE:
   - Player selects maneuver for their controlled ship (click on maneuver dial)
   - AI selects maneuvers for ALL other ships (player fleet + enemy fleet)
   - "Execute" button becomes active when player has selected a maneuver
2. EXECUTION PHASE:
   - All ships execute maneuvers simultaneously (tweens)
   - Camera follows player ship
   - Wait for all tweens to complete
3. COMBAT PHASE:
   - Each ship checks if any enemy is in range + arc
   - Attacks resolve in initiative order (higher pilot skill first, or random if equal)
   - Dice roll results shown as floating text
   - Damage applied, health bars update
   - Destroyed ships explode (simple scale-down + fade)
4. CLEANUP PHASE:
   - Check victory conditions
   - Advance turn counter
   - Return to PLANNING PHASE

SHIP SPAWNING:
- Player ships spawn on the left side of the battlefield (x: 200, y: evenly spaced)
- Enemy ships spawn on the right side (x: 1080, y: evenly spaced)
- All ships face the center initially
- Battlefield is 2000x1500 pixels (larger than screen, camera scrolls)

This should be a PLAYABLE GAME when this step is done. You can select a faction, build a squad, fight the AI, and see who wins. The movement is chart-based, combat is dice-based, and the AI uses utility scoring.
```

---

## Phase 4: Faction Identity

### Step 4.1 — Faction Mechanics

**Deliverable**: Each faction's unique mechanic implemented and active during battle.

```
TASK: Implement the 5 faction-exclusive mechanics for "shattered-stars" (Phaser 3 + TypeScript).

CONTEXT: Each faction has a unique mechanic that fundamentally changes how they play. These are the CORE differentiators that make each faction feel different.

BUILD ON: Existing Skirmish mode from Step 3.3, EventBus, GameStore, CombatSystem.

MECHANIC 1: TERRAN HEGEMONY — Military Doctrine System
FILE: src/systems/factions/DoctrineSystem.ts
- Before battle starts, Hegemony player chooses 1 doctrine (shown in SquadSelect):
  - "Defensive Formation": All ships get +1 defense die when at Range 1 of an ally
  - "Aggressive Assault": All ships get +1 attack die on their first attack each turn
  - "Electronic Warfare": All ships gain the Jam action
  - "Strategic Withdrawal": Ships below 25% hull can disengage (removed from battle, not destroyed)
- Doctrine applies to ALL Hegemony ships for the entire battle
- AI Hegemony selects doctrine based on enemy composition

MECHANIC 2: FREE CONFEDERATION — Heroic Moment System
FILE: src/systems/factions/HeroicMomentSystem.ts
- Confederation accumulates "Momentum" during battle:
  - +1 when a Confederation ship takes damage
  - +2 when fighting while outnumbered (fewer ships than enemy)
  - +3 when saving an ally (moving to block an attack angle)
- Spend Momentum on heroic interventions:
  - "Against All Odds" (3 Momentum): All allied ships get +2 ATK and +2 AGI for 1 turn
  - "Miracle Shot" (4 Momentum): Next attack automatically hits with 1 critical
  - "Inspiring Sacrifice" (5 Momentum): One near-death ship's destruction makes all allies +1 ATK permanently
  - "The Cavalry Arrives" (7 Momentum): 1-2 Comet-class reinforcement ships appear at map edge
- UI: Show momentum counter on HUD. When threshold reached, "Heroic Moment!" button appears.
- AI Confederation triggers heroic moments based on battle situation

MECHANIC 3: SYNTHETIC COLLECTIVE — Adaptive AI Protocols
FILE: src/systems/factions/AdaptiveProtocolSystem.ts
- Collective ships use Calculate instead of Focus (always consistent, no luck)
- Calculate: convert exactly 1 focus_result per calculate token (focus converts ALL)
- Network Bonus: when 2+ Collective ships target the same enemy, +1 attack die each
- Adaptive Protocols (auto-activates based on enemy behavior):
  - If enemy uses lots of green maneuvers → "Predictive Targeting": +1 ATK vs ships that moved this turn
  - If enemy clusters together → "Area Denial": attacks deal 1 splash damage to enemies at Range 1 of target
  - If enemy uses heavy ordnance → "Point Defense": +2 defense dice against torpedo/missile
- Protocol adaptation happens automatically — Collective "learns" after 3 turns of observing patterns
- UI: Show active protocol name on Collective ships

MECHANIC 4: VOID CORSAIRS — Reputation & Dirty Fighting
FILE: src/systems/factions/ReputationSystem.ts
- Corsairs earn Reputation during battle:
  - +1 per enemy ship destroyed
  - +2 for destroying a ship from behind (outside its forward arc)
  - +3 for destroying a ship worth more points than the attacker
- Reputation thresholds provide passive bonuses:
  - 0-5 "Unknown": No bonus
  - 6-10 "Notorious": -1 to enemy pilot skill (enemies are spooked)
  - 11-20 "Infamous": Critical hits deal +1 extra hull damage
  - 21+ "Legendary": Enemy ships below 25% hull have 25% chance to flee each turn
- Dirty Fighting passive: All Corsair attacks from behind enemy's arc get +1 crit chance
- UI: Show reputation counter and current rank

MECHANIC 5: ASCENDANT EMPIRE — Bio-Evolution
FILE: src/systems/factions/BioEvolutionSystem.ts
- Ascendant ships regenerate 1 shield per turn (if not at max)
- Bio-Evolution triggers (tracked per ship, permanent for the battle):
  - "Combat Pressure" (hull drops below 25%): +2 hull (grows armor)
  - "Speed Evolution" (evades 5+ attacks): +1 AGI and gain Boost action
  - "Weapon Evolution" (scores 3+ critical hits): +1 ATK
  - "Psionic Awakening" (3+ allies use Coordinate): Coordinate ignores range restrictions
- Only 1 evolution per ship per battle (first trigger that fires)
- Visual: Ship sprite pulses with green glow when evolved
- UI: Show evolution progress bars on Ascendant ships

INTEGRATION:
- FactionSystem.ts orchestrates all faction mechanics
- Register with EventBus to listen for relevant events
- Each system is self-contained and only activates for its faction
- Update BattleScene to show faction-specific UI elements
- Update AI to understand and use faction mechanics (Hegemony AI uses doctrines, Corsair AI targets rear arcs, etc.)

TESTS for each system:
- Hegemony: Defensive Formation grants +1 defense die
- Confederation: Momentum accumulates correctly, heroic moments activate
- Collective: Calculate converts exactly 1 result, network bonus applies
- Corsairs: Reputation increases on kill, bonuses apply at thresholds
- Ascendant: Shield regen works, evolution triggers fire correctly
```

---

## Phase 5: Ship Actions & Stress

### Step 5.1 — Action Economy & Stress

**Deliverable**: Full action system where ships perform 1 action per turn (Focus, Evade, Target Lock, Barrel Roll, Boost) with stress management.

```
TASK: Implement the action economy system for "shattered-stars" (Phaser 3 + TypeScript).

CONTEXT: After executing a maneuver each turn, each ship performs exactly 1 action. Actions are the core tactical decisions beyond movement:
- Focus: Gain a Focus token (converts focus_result dice to hits/evades)
- Evade: Gain an Evade token (adds 1 automatic evade result to next defense roll)
- Target Lock: Lock onto an enemy ship (spend to reroll any number of attack dice)
- Barrel Roll: Lateral repositioning (move sideways without changing facing)
- Boost: Move forward an extra short distance (straight or bank)

STRESS RULES (building on movement stress from Step 2.2):
- Stressed ships CANNOT perform actions (skip action phase)
- Green maneuvers remove 1 stress, allowing action next turn
- Some abilities can grant "free actions" that don't count as the ship's 1 action

TOKEN RULES:
- Focus token: Lasts until used or end of turn (whichever first)
- Evade token: Lasts until used or end of turn
- Target Lock token: Persists until used (doesn't expire at end of turn)
- A ship can have at most 1 Focus + 1 Evade + 1 Target Lock at a time
- Using Focus on attack: convert ALL focus_result → hit
- Using Focus on defense: convert ALL focus_result → evade
- Using Evade on defense: add 1 automatic evade result
- Using Target Lock on attack: reroll any number of dice (once)

FILE: src/systems/ActionSystem.ts
- performAction(shipId, actionType): Apply the action's effect
- getAvailableActions(shipId): Returns actions this ship can do (from ship data, minus stress restriction)
- Barrel Roll: move ship 50px left or right perpendicular to facing (player chooses direction)
- Boost: move ship 50px forward (straight, bank-left, or bank-right — player chooses)

FILE: src/systems/StressSystem.ts (update from Step 2.2)
- Centralize all stress logic
- trackStress(shipId): get current stress count
- addStress(shipId): increment stress
- removeStress(shipId): decrement stress (from green maneuver)
- isStressed(shipId): boolean check

FILE: src/systems/TokenSystem.ts
- Manage all tokens (Focus, Evade, Target Lock)
- grantToken(shipId, tokenType)
- spendToken(shipId, tokenType): consume and apply effect
- hasToken(shipId, tokenType): boolean check
- clearExpiredTokens(): called at end of turn, removes Focus and Evade

UPDATE CombatSystem.ts:
- Before rolling: check for Target Lock (allow reroll UI)
- After rolling attack: check for Focus token (auto-convert focus_results)
- After rolling defense: check for Focus and Evade tokens

UPDATE BattleScene turn flow:
PLANNING → EXECUTION → ACTION → COMBAT → CLEANUP
- New ACTION phase between movement and combat:
  - Player selects action for their ship (UI buttons: Focus, Evade, TL, Barrel Roll, Boost)
  - AI selects actions for all other ships
  - Barrel Roll and Boost show position previews before confirming

UPDATE ManeuverDial UI:
- After maneuver, show action buttons
- Show token indicators on ships (small colored circles: blue=Focus, green=Evade, red=Target Lock)
- Stressed ships show a red "STRESSED" indicator and skip action phase

AI ACTION SELECTION:
- Offensive context (enemy in arc + range): prefer Target Lock > Focus
- Defensive context (in enemy arcs): prefer Evade > Focus
- Neutral context: prefer Focus
- Need repositioning: prefer Barrel Roll or Boost
- Stressed: forced skip (clear stress with green maneuver next turn)

TESTS:
- Focus converts all focus_results on attack
- Evade adds 1 automatic evade on defense
- Target Lock allows reroll of chosen dice
- Stressed ship cannot perform action
- Green maneuver clears stress, then ship can act
- Barrel Roll moves ship laterally
- Boost moves ship forward
- Tokens expire at end of turn (Focus, Evade) except Target Lock
```

---

## Phase 6: Content & Polish

### Step 6.1 — Expanded Ship Roster (All 79 Ships)

```
TASK: Define the complete ship data for all 79 ships across 5 factions in "shattered-stars" (Phaser 3 + TypeScript).

CONTEXT: The game has 79 unique ship types organized into 5 factions with 15-17 ships each, across 3 evolution tiers (base, evolved, elite). Each ship has full stats, maneuver dials, actions, and upgrade slots.

USE THIS BALANCE REFERENCE for stat ranges (adapted from X-Wing Miniatures):
- Budget fighters (13-17 pts): 2 ATK, 2-3 AGI, 2-3 HUL, 0-2 SHD
- Standard fighters (18-25 pts): 2-3 ATK, 2-3 AGI, 3-5 HUL, 1-3 SHD
- Heavy/elite ships (26-40 pts): 3 ATK, 1-3 AGI, 4-8 HUL, 2-5 SHD
- Capital ships (40-100 pts): 3-4 ATK, 0-1 AGI, 8-36 HUL, 4-9 SHD

FACTION SHIP ROSTERS (from design docs):

TERRAN HEGEMONY (17 ships):
Tier 1 (Base): Talon Fighter (15pts), Storm Fighter (17pts), Devastator Bomber (16pts), Hawk Assault Fighter (16pts)
Tier 2 (Evolved): Raptor Interceptor (18pts), Vanguard Heavy (21pts), Tempest Multi-role (25pts), Reaper Support (28pts), Siege Bomber (21pts)
Tier 3 (Elite): Phantom Stealth (25pts), Aegis Superiority (30pts), Harbinger Strike (52pts)
Large/Capital: Command Shuttle (16pts), Dreadnought Corvette (40pts), Hegemony Battlecruiser (100pts epic)
All Hegemony ships get +1 shield (minimum 1). Upgrade slot: "discipline"

FREE CONFEDERATION (16 ships):
Tier 1: Comet Fighter (16pts), Ranger Patrol (16pts), Stinger Light (20pts)
Tier 2: Phoenix Starfighter (21pts), Vortex Interceptor (17pts), Meteor Bomber (18pts), Comet Striker (22pts), Atlas Transport (32pts)
Tier 3: Nova Advanced (20pts), Thunderbolt (27pts), Tornado Bomber (25pts)
Large: Millennium Transport (46pts), Constellation Freighter (36pts), Liberty Command (40pts)
Capital: Freedom Corvette (90pts epic), Supply Runner (30pts epic)
All Confederation ships get +1 modification slot. Upgrade slot: "adaptation"

SYNTHETIC COLLECTIVE (15 ships):
Tier 1: Hunter Drone (15pts), Scout Probe (14pts), Assault Drone MkII (16pts)
Tier 2: Interceptor Drone (20pts), Guardian Fighter (18pts), Devastator Bomber Drone (25pts), Coordinator Support (22pts)
Tier 3: Titan Destroyer (36pts), Fortress Bomber (32pts), Siege Heavy Drone (26pts)
Support: Relay Command (16pts), Gunboat Destroyer (52pts), Command Nexus (25pts)
Capital: ARC Heavy Fighter (32pts), Collective Mothership (35pts epic)
All Collective ships use Calculate instead of Focus. Upgrade slot: "protocol"

VOID CORSAIRS (15 ships):
Tier 1: Ghost Infiltrator (13pts), Dart Scout (14pts), Wraith Fighter (16pts)
Tier 2: Razor Raider (22pts), Fang Interceptor (20pts), Scythe Fighter (20pts), Saboteur Bomber (32pts)
Tier 3: Marauder Assault (38pts), Predator Heavy (42pts), Specter Destroyer (34pts)
Support: Phantom Gunship (23pts), Havoc Gunship (26pts), Reaver Support (25pts)
Capital: Corsair Battleship (36pts), Pirate Mothership (35pts epic)
All Corsair ships get +1 crit damage from rear arc attacks. Upgrade slot: "illicit"

ASCENDANT EMPIRE (17 ships):
Tier 1: Symbiont Fighter (17pts), Spore Bomber (18pts), Metamorph Striker (16pts)
Tier 2: Evolved Interceptor (19pts), Hybrid Heavy (21pts), Plague Bomber (16pts), Thought Coordinator (28pts)
Tier 3: Adaptation Fighter (27pts), Mind Psi-Fighter (25pts), Virus Siege (25pts), Mutation Assault (22pts)
Large: Leviathan Destroyer (40pts), Bio-Cruiser (42pts), Organism Transport (32pts)
Psionic: Cerebral Command (16pts), Imperial Command (60pts)
Capital: Ascendant Dreadnought (23pts epic)
All Ascendant ships get +1 hull. Passive: regenerate 1 shield/turn. Upgrade slot: "evolution"

For each ship, define:
- Full stats (ATK, AGI, HUL, SHD, pointCost, size, role)
- Maneuver dial (appropriate for role: interceptors get speed 5, bombers limited to speed 3-4)
- Actions list
- Upgrade slots
- Faction keyword
- Evolution paths (which ships evolve from/to)
- Description text

FILE: src/data/ships.ts (expand from 10 to 79 ships)
FILE: src/data/evolutions.ts (define all evolution trees)
FILE: tests/unit/data/ships.test.ts (validate all 79 ships)
```

---

### Step 6.2 — Evolution System

```
TASK: Implement the ship evolution system for "shattered-stars" (Phaser 3 + TypeScript).

CONTEXT: Ships gain XP through combat. When enough XP is accumulated, the player can evolve a ship into a more powerful form, choosing between 2-3 evolution paths. Evolution changes the ship's stats, role, actions, and appearance tier.

EVOLUTION RULES:
- Ships gain XP per battle: 10 XP per enemy destroyed, 5 per assist, 25 per mission objective, 15 for surviving
- Tier 1 → Tier 2: Requires 100 XP + player choice of path
- Tier 2 → Tier 3: Requires 250 XP + achievement requirement + player choice
- Evolution is PERMANENT — cannot revert
- Evolved ship keeps accumulated XP beyond the threshold

FILE: src/systems/EvolutionSystem.ts
- trackXP(shipId, xpGained): Add XP to a specific ship
- canEvolve(shipId): Check if ship has enough XP for next tier
- getEvolutionOptions(shipId): Return available evolution paths
- evolveShip(shipId, pathId): Apply evolution — change ship data to target ship
- Evolution applies: new stats, new maneuver dial, new actions, new role, visual tier change

FILE: src/scenes/EvolutionScene.ts (NEW — shown between battles when ships can evolve)
- Show ship with current stats on left
- Show 2-3 evolution options on right with stat comparisons
- Highlight stat changes (green for increase, red for decrease)
- Player clicks to choose evolution
- Animated "evolution" effect (placeholder: white flash + scale up)
- "Confirm" button to lock in choice

EVOLUTION TREES (from design docs):
Example: Hegemony Talon Fighter
├── Raptor Interceptor (faster, +1 AGI, -1 HUL, gains Boost)
│   └── Phantom Stealth Fighter (+Cloak action, 4 ATK)
└── Vanguard Heavy Fighter (+2 SHD, gains Target Lock)
    └── Aegis Superiority Fighter (best all-around, 3 ATK, 3 AGI, 3 SHD)

All evolution trees should be defined in src/data/evolutions.ts (from Step 6.1).

FILE: Update ResultsScene.ts
- After battle results, check if any ships can evolve
- If yes, transition to EvolutionScene before returning to menu
- Show "Ships ready to evolve!" notification

TESTS:
- XP tracking accumulates correctly
- Evolution requires minimum XP
- Evolution changes ship stats to target ship stats
- Cannot evolve below XP threshold
- Evolution path options match data definitions
- Evolved ship keeps excess XP
```

---

### Step 6.3 — Sound & Visual Polish

```
TASK: Add sound effects, particle effects, and visual polish to "shattered-stars" (Phaser 3 + TypeScript).

CONTEXT: The game currently works mechanically but looks plain. Add audio, particles, and visual feedback to make it feel like a space battle.

APPROACH: Generate all assets at runtime or use Phaser's built-in capabilities. NO external asset files needed for this step (we'll add real sprites later).

FILE: src/audio/AudioManager.ts
- Play sounds using Phaser's audio system
- For now, generate simple sounds using Web Audio API oscillators (no audio files):
  - Laser fire: short high-frequency beep (100ms, 800Hz → 400Hz sweep)
  - Explosion: noise burst + low frequency rumble (300ms)
  - Shield hit: metallic ping (50ms, 1200Hz)
  - Hull hit: thud (100ms, 200Hz)
  - Maneuver execute: whoosh (200ms, white noise sweep)
  - UI click: short click (30ms, 600Hz)
  - Turn start: chime (200ms, 500Hz + 750Hz)
- Volume controls from settings state
- Spatial audio: sounds louder when near camera center, quieter at edges

FILE: src/rendering/VFXManager.ts
Using Phaser's particle emitter system:
- Laser projectiles: small colored rectangle that travels from attacker to defender (faction energy color)
- Hit effect: small burst of particles at impact point (5-10 particles, faction color)
- Explosion effect: larger burst (20-30 particles, orange/red) + expanding circle
- Shield shimmer: brief blue flash around ship when shields absorb damage
- Engine trail: subtle particle trail behind ships during movement (faction glow color)
- Maneuver preview: dotted line showing movement path

FILE: src/rendering/ShipRenderer.ts (update)
- Ships currently are plain colored rectangles. Improve them:
  - Add a small "cockpit" detail (lighter colored pixel at front)
  - Add "engine glow" (faction energy color circle at rear, pulses gently)
  - Selected ship: white pulsing border
  - Damaged ship: slight red tint proportional to damage taken
  - Stressed ship: red pulsing glow
  - Evolved ship: gold border accent
- Ship rotation should be smooth (interpolated, not instant)
- Ship movement tween should use easeInOut for natural feel

FILE: Update BattleScene.ts
- Camera shake on explosions (proportional to explosion size)
- Screen flash (brief white overlay) on critical hits
- Floating damage numbers: "+2 DMG" in red, rising and fading
- "CRITICAL!" text in yellow for crit hits
- Turn phase text transitions: "PLANNING" → "EXECUTE!" → "COMBAT" with brief animation
- Victory/Defeat text with dramatic reveal

FILE: src/rendering/Background.ts
- Parallax starfield background (3 layers of dots at different speeds)
- Slow-moving stars for depth perception during camera movement
- Occasional "nebula" colored circles in the far background

NO EXTERNAL FILES NEEDED. All sounds are generated via Web Audio API oscillators. All visuals use Phaser's graphics, particles, and text objects.
```

---

## Phase 7: Campaign Mode

### Step 7.1 — Strategic Layer (War Room)

```
TASK: Implement the between-mission strategic layer ("War Room") for the campaign mode in "shattered-stars" (Phaser 3 + TypeScript).

CONTEXT: Between missions, the player manages their fleet, allocates resources to research, upgrades facilities, and chooses the next mission. This is the XCOM-inspired strategic layer.

THE WAR ROOM has 4 tabs:
1. STAR MAP: Choose next mission (1 primary + 1-2 optional)
2. FLEET: Manage ships, repair damage, assign pilots
3. RESEARCH: Allocate resources to unlock tech
4. FACILITIES: Upgrade base capabilities

RESOURCES (8 types tracked per campaign):
- Credits (universal currency)
- Alloys (ship construction/repair)
- Plasma Cells (weapon research)
- Data Cores (research acceleration)
- Dark Matter (advanced tech)
- Contraband (Corsair-specific upgrades)
- Intel (mission quality, enemy info)
- Salvage (repair, reverse engineering)

FILE: src/scenes/WarRoomScene.ts
- Tab navigation at top (Star Map | Fleet | Research | Facilities)
- Each tab is a sub-scene or UI panel within the WarRoom
- Back button → MainMenu (with "Abandon Campaign" confirmation)
- Resource bar at top showing all 8 resource counts

FILE: src/scenes/war-room/StarMapPanel.ts
- Show 2-3 mission options as nodes on a simple map
- Primary mission: highlighted, required for progression
- Optional missions: dimmer, offer resources or intel
- Click a mission to see briefing + expected rewards + enemy composition
- "LAUNCH" button to start the selected mission

FILE: src/scenes/war-room/FleetPanel.ts
- Show all owned ships with health bars
- Damaged ships show repair cost (Credits + Alloys)
- Click ship to see full stats
- "REPAIR" button per ship
- Show pilot assigned to each ship with XP level
- Reserve ships (not in active squad) shown in separate section

FILE: src/scenes/war-room/ResearchPanel.ts
- Show tech tree as connected nodes
- Available research highlighted, locked research dimmed
- Click a research to see: name, description, cost (RP + resources), time (turns)
- "START RESEARCH" button queues it
- Active research shows progress bar
- Maximum 1 active research at a time (upgradeable to 2-3 with facility)

FILE: src/scenes/war-room/FacilitiesPanel.ts
- Show 5 facilities with current level (1-4):
  - Hangar: Ship capacity (6/9/12/16)
  - Workshop: Repair speed (2/4/6/full per turn)
  - Intel Center: Research points per turn (50/75/100/150)
  - Training: Pilot XP bonus (+10%/+25%/+50%/+100%)
  - Faction Facility: Faction-specific (varies)
- Show upgrade cost and benefit for next level
- "UPGRADE" button per facility

FILE: src/data/campaign.ts (expand)
- Define research trees (universal + 1 per faction) as data
- Define facility upgrade costs and effects
- Define resource costs for all actions

FILE: src/systems/CampaignStateSystem.ts
- Manage persistent campaign state between missions:
  - Fleet composition and ship health
  - Resource counts
  - Research progress
  - Facility levels
  - Mission completion history
  - Story flags (branching choices)
- Save/load to localStorage via SaveManager

FLOW: MainMenu → "Campaign" → WarRoom → (manage fleet/research) → Star Map → Launch Mission → Battle → Results → WarRoom (loop)

TESTS:
- Resources deduct correctly on spend
- Research completes after correct number of turns
- Facility upgrades apply effects
- Ship repair costs calculated correctly
- Campaign state persists across save/load
```

---

### Step 7.2 — Mission System & First Campaign

```
TASK: Implement the mission system and the Terran Hegemony campaign (16 missions) for "shattered-stars" (Phaser 3 + TypeScript).

CONTEXT: Each campaign has 16 missions across 4 acts. Missions have specific objectives, enemy compositions, time limits, and narrative briefings. The Hegemony campaign "Iron Mandate" is implemented first as the template for all others.

MISSION SYSTEM:
FILE: src/systems/MissionSystem.ts
- Load mission definition from campaign data
- Track objective progress during battle
- Multiple objective types:
  - ELIMINATION: Destroy all enemy ships
  - ESCORT: Protect allied ships until they reach destination
  - SURVIVE: Last N turns against waves
  - INFILTRATION: Reach target zone without being detected (detected = attacked)
  - RECON: Scan 3 locations (move a ship within range)
  - MULTI_PHASE: Sequential objectives
- Primary objective: must complete to win
- Secondary objectives: bonus rewards if completed
- Time limit: optional countdown (in turns)
- Wave spawning: some missions spawn reinforcement enemies mid-battle

FILE: src/data/campaigns/hegemony.ts
Define all 16 Hegemony missions with full data:

ACT I (Missions 1-4):
M1 "Graduation Day": Tutorial, ELIMINATION, 2 Corsair scouts, 60pts budget
M2 "Border Incident": ELIMINATION, 2 Confederation fighters, 80pts
M3 "The Iron Wall": ESCORT, protect 3 transports, 4 Corsair attackers, 100pts
M4 "Orders From Above": CHOICE mission — 2 variants (military vs humanitarian)

ACT II (Missions 5-9):
M5 "Echoes of Choice": Varies by M4 choice
M6 "New Threat Assessment": RECON, scan Ascendant patrols, 130pts
M7 "The Sentinel Program": SURVIVE 12 turns, 3 attack waves, 150pts
M8 "The Fracture Point": MULTI_PHASE (track + capture), 160pts
M9 "Operation Thunderstrike": ELIMINATION + destroy hub, 200pts (climax)

ACT III (Missions 10-13):
M10 "Darkest Hour": SURVIVE waves (designed to cause losses), 200pts
M11 "Behind Enemy Lines": INFILTRATION + sabotage, 120pts (small elite team)
M12 "Unlikely Allies": CHOICE (Confederation alliance vs Corsair contract)
M13 "Leviathan": EPIC BATTLE, capital ships, 250pts

ACT IV (Missions 14-16):
M14 "Rally the Fleets": MULTI_PHASE (secure 3 points), 250pts
M15 "The Long March": 3 sequential battles with carry-over damage, 250pts
M16 "Iron Mandate": EPIC MULTI_PHASE final boss (3 phases), 300pts

Each mission needs:
- id, name, act, missionNumber
- briefingText (2-3 sentences of story)
- objectiveType and specific objectives
- pointLimit (player squad budget)
- timeLimitTurns (optional)
- enemyComposition: array of { shipId, count, aiDifficulty }
- rewards: { credits, primaryResource, xp, shipUnlock?, researchUnlock? }
- specialConditions: string[] (any special rules)
- choiceData?: { choices: MissionChoice[] } (for branching missions)

FILE: src/scenes/MissionBriefingScene.ts
- Show mission name, act number
- Display briefing text with faction-colored header
- Show objectives list
- Show expected enemy composition (silhouettes)
- Show rewards
- "LAUNCH MISSION" button → BattleScene with mission config
- "BACK" button → WarRoom

UPDATE BattleScene.ts:
- Load mission objectives from mission data
- Display active objectives on HUD (checklist style)
- Track objective progress during battle
- Wave spawning: spawn additional enemies at specified turn numbers
- Mission-specific victory: check objectives instead of just elimination
- On mission complete: calculate rewards based on performance

UPDATE ResultsScene.ts:
- Show mission-specific results (objectives completed/failed)
- Show rewards earned
- Show any unlocks (ships, research)
- "CONTINUE" → WarRoom (with rewards applied)

TESTS:
- Mission data loads correctly for all 16 missions
- Objective tracking works for each type
- Wave spawning creates enemies at correct turns
- Rewards calculated based on objectives completed
- Choice missions branch correctly
- Campaign progression tracks completed missions
```

---

## Remaining Phases (Brief Prompts)

### Step 7.3 — Remaining 4 Campaigns
*Repeat Step 7.2 pattern for: Confederation (16), Collective (16), Corsairs (16), Ascendant (16)*

### Step 8.1 — Survival Mode
*Wave-based endless mode. Increasing difficulty waves. Score tracking. Global leaderboard (localStorage).*

### Step 8.2 — Practice/Tutorial Mode
*Guided tutorial teaching movement, combat, actions, faction mechanics. AI difficulty slider.*

### Step 9.1 — Real Sprite Integration
*Replace colored rectangles with AI-generated sprites. Texture atlas loading. Faction-specific visual effects.*

### Step 9.2 — Music & Sound Design
*Replace oscillator sounds with real audio files. Faction-specific battle themes. Adaptive music system.*

### Step 10.1 — Multiplayer (WebSocket)
*Client-server architecture. Lobby system. Synchronized battle state. Lag compensation.*

### Step 10.2 — Tournament System
*Swiss pairing. Bracket generation. Multi-round progression. ELO rating.*

---

## Appendix: Quick Reference

### Phase Order & Dependencies

```
Phase 0: Bootstrap
  0.1 Init Project
  0.2 Structure + CLAUDE.md [depends: 0.1]

Phase 1: Core Engine
  1.1 EventBus + GameStore [depends: 0.1]
  1.2 GameClock [depends: 0.1]
  1.3 Scene Flow [depends: 0.1]

Phase 2: Ship Foundation
  2.1 Ship Data Model [depends: 0.2]
  2.2 Movement System [depends: 1.1, 2.1]
  2.3 Combat System [depends: 1.1, 2.1]

Phase 3: First Playable
  3.1 AI Ship Control [depends: 2.2, 2.3]
  3.2 Battle HUD [depends: 2.2, 2.3]
  3.3 Skirmish Mode [depends: 3.1, 3.2] ← FIRST PLAYABLE GAME

Phase 4: Faction Identity
  4.1 Faction Mechanics [depends: 3.3]

Phase 5: Actions & Stress
  5.1 Action Economy [depends: 3.3]

Phase 6: Content & Polish
  6.1 All 79 Ships [depends: 3.3]
  6.2 Evolution System [depends: 6.1]
  6.3 Sound & Visual Polish [depends: 3.3]

Phase 7: Campaign
  7.1 War Room [depends: 3.3, 6.1]
  7.2 Hegemony Campaign [depends: 7.1]
  7.3 Remaining Campaigns [depends: 7.2]

Phase 8+: Additional Modes, Multiplayer, etc.
```

### Estimated Time Per Step

| Step | Estimated Effort | Cumulative |
|------|-----------------|-----------|
| 0.1 Init | 30 min | 30 min |
| 0.2 Structure | 1 hr | 1.5 hrs |
| 1.1 EventBus/Store | 2 hrs | 3.5 hrs |
| 1.2 GameClock | 1 hr | 4.5 hrs |
| 1.3 Scenes | 2 hrs | 6.5 hrs |
| 2.1 Ship Data | 3 hrs | 9.5 hrs |
| 2.2 Movement | 4 hrs | 13.5 hrs |
| 2.3 Combat | 3 hrs | 16.5 hrs |
| 3.1 AI | 4 hrs | 20.5 hrs |
| 3.2 HUD | 3 hrs | 23.5 hrs |
| **3.3 Skirmish** | **4 hrs** | **27.5 hrs ← FIRST PLAYABLE** |
| 4.1 Factions | 6 hrs | 33.5 hrs |
| 5.1 Actions | 4 hrs | 37.5 hrs |
| 6.1 All Ships | 6 hrs | 43.5 hrs |
| 6.2 Evolution | 4 hrs | 47.5 hrs |
| 6.3 Polish | 4 hrs | 51.5 hrs |
| 7.1 War Room | 6 hrs | 57.5 hrs |
| 7.2 First Campaign | 8 hrs | 65.5 hrs |

*Estimates assume Claude Code does most of the coding. Actual times depend on debugging, iteration, and design decisions.*
