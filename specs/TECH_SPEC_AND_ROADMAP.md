# Shattered Stars: Technical Specification & Development Roadmap

## Web-Based Tactical Arcade Game — Development Bible

**Version:** 1.0
**Date:** March 2, 2026
**Author:** BusyDad Games
**Status:** Pre-Development Planning

---

## Table of Contents

1. [Executive Summary](#section-1-executive-summary)
2. [Tech Stack](#section-2-tech-stack)
3. [Asset Pipeline & Art Generation](#section-3-asset-pipeline--art-generation)
4. [Code Architecture](#section-4-code-architecture)
5. [AI System Deep Dive](#section-5-ai-system-deep-dive)
6. [Development Roadmap](#section-6-development-roadmap)
7. [MVP Definition](#section-7-mvp-definition)
8. [Risk Assessment](#section-8-risk-assessment)
9. [Development Workflow](#section-9-development-workflow)

---

# Section 1: Executive Summary

## Core Game Loop

Shattered Stars is a tactical dogfighting arcade game — top-down, sprite-based, 2D — that adapts X-Wing Miniatures tabletop mechanics into a real-time digital format with original sci-fi IP.

**The 15-minute session loop:**

1. **Select**: Choose faction, pick/evolve your squadron from roster
2. **Deploy**: Position your fleet on the battlefield
3. **Fight**: Real-time tactical combat using discrete movement charts (not physics). Player controls a lead ship; AI Director commands the rest of their fleet (5–15 ships). Maneuver selection, weapon firing, ability activation, and aura positioning happen simultaneously
4. **Evolve**: Ships earn XP. Unlock evolution paths, new abilities, pilot specializations
5. **Progress**: Advance through campaign acts, faction mastery tiers, and pilot development

**What makes it distinctive:**
- **Movement charts, not physics.** Ships select from a discrete set of maneuvers at speed settings — faithful to the tabletop. No free-aim steering
- **Five asymmetric factions** with radically different mechanics (doctrines, heroic moments, swarm protocols, reputation/crew, mid-battle bio-evolution)
- **Ship evolution trees** where a base fighter branches into interceptors, bombers, support, or stealth roles based on player choices and combat performance
- **Combination system**: Ships can physically assemble, fuse biologically, or parasitically attach to create combined entities mid-battle
- **AI-controlled fleets**: The player flies one ship while an AI Director commands their remaining squadron using faction-specific behaviors

## Target Platforms

| Priority | Platform | Deployment |
|----------|----------|------------|
| **Primary** | Web (modern browsers) | Static hosting (Netlify/Vercel/itch.io) |
| **Secondary** | Desktop | Electron wrapper |
| **Future** | Mobile | Progressive Web App or Capacitor |

## Scope Summary

| Dimension | Count | Notes |
|-----------|-------|-------|
| Factions | 5 | Hegemony, Confederation, Collective, Corsairs, Ascendant Empire |
| Ships (unique types) | 79 | 15–17 per faction across 7 combat roles |
| Evolution trees | ~25 | Branching paths with role changes |
| Ship combinations | ~15 | Assembly, fusion, parasitic, and swarm formations |
| Aura abilities | ~20 | Passive area effects per faction |
| Faction-exclusive mechanics | 5 | Doctrines, Heroic Moments, Adaptive AI, Reputation/Crew, Bio-Evolution |
| Campaign acts | 4 | ~30 missions across tutorial, evolution, war, and endgame |
| Special abilities | 6 types | Cloak, SLAM, Rotating Arc, Coordinate, Jam, Advanced Maneuvers |
| Pilot specializations | 3 trees | Ace, Bomber, Support |
| Faction resource systems | 5 | Command Points, Inspiration, Processing Power, Reputation, Evolution Energy |

---

# Section 2: Tech Stack

## Game Framework Recommendation: Phaser 3

### Framework Comparison for THIS Game

| Factor | Phaser 3 | PixiJS | Excalibur.js |
|--------|----------|--------|-------------|
| **2D Sprite Performance (100+ animated sprites)** | Excellent. WebGL renderer, batched draw calls, built-in sprite pooling | Excellent. Fastest raw rendering, but you build everything yourself | Good. Smaller community benchmarks, less battle-tested at scale |
| **Sprite Sheet/Atlas Support** | Built-in. `this.load.atlas()`, JSON/XML atlas parsers, frame-by-frame animation | Built-in. Spritesheet class, but manual animation management | Built-in. SpriteSheet resource with Animation class |
| **Movement Chart System** | Tweens + custom logic. No physics dependency. Easy to implement discrete moves | Manual. No game logic layer — you write everything from scratch | Actor system works, but movement must be entirely custom |
| **Camera System** | Built-in. Follow camera, bounds, zoom, shake, effects | Viewport only. Must build camera system from scratch | Built-in camera with follow and zoom |
| **Input Handling** | Comprehensive. Keyboard, mouse, gamepad, touch, drag, input combos | None. Must use browser events directly | Good. Built-in input mapping system |
| **TypeScript Support** | First-class. Official type definitions, all examples in TS | Excellent. Written in TS natively | Written in TS natively |
| **Community & Ecosystem** | Largest. 36k+ GitHub stars, active Discord, extensive plugins, tutorials, books | Large. 42k+ stars, but game-dev community smaller (it's a renderer) | Small. 1.5k stars, limited plugins, smaller knowledge base |
| **Maturity** | Battle-tested since 2013. Thousands of shipped games | Very mature as renderer. Not a game framework | Younger, less production use |

### Recommendation: **Phaser 3** (with Phaser 4 migration path)

**Why Phaser wins for this project:**

1. **Movement charts are the killer constraint.** Phaser's tween system + scene/game object model makes discrete maneuver execution straightforward. You set destination coordinates from a lookup table and tween to them — no physics engine fighting you. PixiJS would require building this from nothing
2. **100+ sprites is well within Phaser's capability.** WebGL batching handles this easily. The real bottleneck will be AI computation, not rendering
3. **Built-in systems save solo-dev months.** Camera follow, input management, scene transitions, audio, sprite atlases — Phaser provides all of these. With PixiJS you'd spend weeks building infrastructure before touching game logic
4. **Claude compatibility.** Phaser has the largest body of training data. AI-assisted development will be significantly more productive with Phaser than Excalibur
5. **itch.io / web deployment is trivial.** Phaser games deploy as static HTML — zip and upload

**What to watch out for:**
- Phaser's built-in physics (Arcade/Matter) should be **ignored entirely** for this game. Movement is chart-based, not physics-based
- Phaser 4 is in development. The architecture recommended here (modular, systems-based) will ease migration
- For very large battles (30+ ships), profile early. The AI decision loop, not rendering, will be the bottleneck

## Language: TypeScript

**Justification — no serious alternative for this project:**
- Type safety catches entire categories of bugs that would be devastating in a complex game state (wrong faction enum, missing evolution path, invalid stat)
- The ship/faction/evolution data model is enormous and deeply nested. TypeScript interfaces make this manageable and self-documenting
- Claude generates dramatically better TypeScript than JavaScript. Type hints provide context for correct code generation
- Phaser 3's official definitions are excellent. Full autocomplete and type checking throughout

**TypeScript Configuration:**
```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "lib": ["ES2020", "DOM"],
    "outDir": "./dist",
    "sourceMap": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

## State Management: Custom Event-Driven Store with Immer

For a game of this complexity, no off-the-shelf state management (Redux, Zustand, MobX) fits well. Games need frame-rate-sensitive state updates, not React re-renders.

**Architecture:**

```
┌──────────────────────────────────────┐
│          Game State Store            │
│  (Immutable snapshots via Immer)     │
│                                      │
│  ┌────────┐ ┌─────────┐ ┌────────┐  │
│  │ Battle │ │ Campaign│ │ Fleet  │  │
│  │ State  │ │ State   │ │ State  │  │
│  └────────┘ └─────────┘ └────────┘  │
│  ┌────────┐ ┌─────────┐ ┌────────┐  │
│  │  AI    │ │  UI     │ │ Player │  │
│  │ State  │ │ State   │ │Progress│  │
│  └────────┘ └─────────┘ └────────┘  │
└──────────────────────────────────────┘
         │ Events │ Queries │
    ┌────▼────────▼────────▼────┐
    │       Event Bus           │
    │  (Typed, prioritized)     │
    └───────────────────────────┘
```

**Why this approach:**
- **Immer** for immutable state updates without boilerplate. `produce(state, draft => { draft.ship.hull -= 3 })` — readable and safe
- **Event bus** for decoupled communication between systems (combat emits `SHIP_DAMAGED`, UI listens and updates health bars, AI listens and adjusts targeting)
- **No framework dependency.** State management is pure TypeScript. Works in Phaser scenes, in tests, and in future UI frameworks
- **Serializable.** Immer-produced state is plain objects — trivially saveable to localStorage or IndexedDB

## AI Architecture Recommendation: Utility AI with Behavior Tree Shell

See [Section 5](#section-5-ai-system-deep-dive) for the full deep dive. Summary of the recommendation:

| Level | Architecture | Why |
|-------|-------------|-----|
| **Individual Ship** | Utility AI (scoring functions) | Each faction needs different scoring weights. Utility AI makes this data-driven — change a JSON config, not code |
| **Squad/Fleet** | Behavior Tree (AI Director) | Fleet-level decisions (assign objectives, pick formations, trigger retreats) are naturally hierarchical |
| **Boss Encounters** | Phased State Machine | Capital ships have distinct phases. State machines are the clearest model |

## Build Tools

| Tool | Choice | Justification |
|------|--------|---------------|
| **Bundler** | Vite | Near-instant HMR, ESBuild for dev, Rollup for production. First-class TypeScript support. Phaser works perfectly with Vite |
| **Testing** | Vitest + Playwright | Vitest for unit/integration (same config as Vite). Playwright for E2E visual regression |
| **Linting** | ESLint + Prettier | Standard. Biome is faster but less plugin ecosystem |
| **Package Manager** | pnpm | Faster than npm, stricter than yarn, phantom dependency prevention |
| **CI** | GitHub Actions | Free for public repos, adequate for solo dev |

**Vite Configuration:**
```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          gamedata: ['./src/data/index.ts']
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
```

## Deployment

| Target | Method | Notes |
|--------|--------|-------|
| **Dev playtesting** | `vite dev` | Hot reload at localhost:3000 |
| **Web deployment** | itch.io + Netlify | itch.io for player community, Netlify for portfolio/landing page |
| **Electron desktop** | electron-builder | Single command packaging. Same codebase, no changes needed |
| **Future mobile** | Capacitor | Wraps web app in native shell. Phaser handles touch input already |

## Data Format

All game data (ships, factions, evolutions, abilities) is defined as **TypeScript const objects with `as const` assertions**, validated at compile time. No runtime JSON parsing for core game data.

**Why TypeScript over JSON:**
- Type checking catches errors at compile time (misspelled faction name, wrong stat range)
- Autocomplete when referencing data in game code
- Can include computed values and helper functions alongside data
- JSON can be generated from TypeScript data for modding/export

See [Section 4: Data Architecture](#data-architecture) for full type definitions and examples.

---

# Section 3: Asset Pipeline & Art Generation

## Art Direction

**Style:** Chris Metzen-inspired (StarCraft 1, Warcraft 2, Disciples 2). Bold chunky silhouettes, rich saturated colors, high contrast, readable at small sizes. Progressive evolution tiers showing clear visual advancement.

**Resolution targets:**
- Master sprites: 256×256px (generation/editing)
- Game sprites: 64×64px (standard ships), 96×96px (large ships), 128×64px (epic ships)
- Minimum readable size: 32×32px at maximum zoom-out

## PixelLab Integration

[PixelLab](https://www.pixellab.ai/) is an AI pixel art generator specifically designed for game sprites with style consistency features.

### Batch Generation Workflow for 80+ Ships

**Phase 1: Establish Faction Style Anchors (5 sessions)**

For each faction, generate 3 "anchor" ships (light fighter, heavy fighter, capital) that define the visual language. Use PixelLab's style consistency tools to lock these as reference.

```
Session structure per faction:
1. Generate 10-15 variations of the light fighter
2. Select best 2-3, iterate with style refinement
3. Lock the chosen design as "faction style anchor"
4. Generate heavy fighter using anchor as style reference
5. Generate capital ship using anchor as style reference
6. Export all 3 anchors as the faction's visual DNA
```

**Phase 2: Role-Based Batch Generation (20 sessions)**

With anchors established, batch-generate the remaining ships per role using the Complete Ship Sprite Generation Guide prompts. PixelLab's consistency features ensure generated ships match faction style.

```
Per faction (4 sessions each):
- Session 1: All base-tier ships (3-5 ships)
- Session 2: All evolved-tier ships (4-6 ships)
- Session 3: All elite-tier ships (2-3 ships)
- Session 4: Capital ships, combinations, special variants
```

**Phase 3: Evolution Visual Progression (5 sessions)**

Generate evolution variants showing clear tier progression:
- Base → 1.0x scale, minimal details, recruit markings
- Evolved → 1.1x scale, additional armor/weapons, veteran markings
- Elite → 1.2x scale, maximum detail, ace customization

### Faction Color Palette Reference

| Faction | Primary | Secondary | Accent | Energy | Glow |
|---------|---------|-----------|--------|--------|------|
| Terran Hegemony | `#2E4A99` Imperial Blue | `#C0C0C0` Silver | `#FFFFFF` White | `#00BFFF` Electric Blue | `#87CEEB` Light Blue |
| Free Confederation | `#FF6B35` Rebel Orange | `#2D5016` Forest Green | `#FFD700` Gold | `#FFFF00` Yellow | `#FFA500` Orange |
| Synthetic Collective | `#2F2F2F` Gunmetal | `#0080FF` Electric Blue | `#C0C0C0` Chrome | `#00FFFF` Cyan | `#4169E1` Royal Blue |
| Void Corsairs | `#4B0082` Deep Purple | `#DC143C` Crimson | `#DAA520` Brass | `#FF1493` Hot Pink | `#8B008B` Magenta |
| Ascendant Empire | `#228B22` Forest Green | `#FFD700` Gold | `#2F4F4F` Dark Slate | `#ADFF2F` Green-Yellow | `#32CD32` Lime |

### Output Requirements

- **Format:** PNG with transparent background
- **Color depth:** 32-bit RGBA
- **Generation resolution:** 256×256 (downscaled to game resolution in pipeline)
- **Naming convention:** `{faction}_{role}_{ship_name}_{tier}.png`
  - Example: `hegemony_fighter_talon_base.png`, `hegemony_fighter_talon_evolved.png`

## Sprite Pipeline

### Rotation Strategy: Runtime Rotation (NOT Pre-rendered Frames)

**Decision: Use runtime rotation, not 64 pre-rendered frames.**

| Factor | Pre-rendered 64 Frames | Runtime Rotation |
|--------|----------------------|------------------|
| **Atlas size** | 64×64×64 frames = 262,144 px² per ship. With 79 ships × 3 tiers = ~62 million px². **Prohibitive.** | 1 frame per ship variant. 79×3 = 237 sprites. Fits in 2-3 atlases |
| **Visual quality** | Perfect at each angle. No interpolation artifacts | WebGL rotation is clean at 64×64. Slight softening at extreme angles — acceptable for pixel art style |
| **Memory** | ~500MB+ for all factions loaded. Requires per-faction loading/unloading | ~5MB for all factions. Trivial |
| **Production time** | Must generate/validate 64 frames × 237 variants = 15,168 images | Generate 237 images. Done |
| **Animation** | Locked to 64 discrete angles (5.6° steps) | Smooth continuous rotation |

**Runtime rotation is the clear winner for this project.** Pre-rendered frames are a legacy optimization from hardware that couldn't rotate sprites efficiently. Modern WebGL handles 2D rotation trivially.

**Implementation:** Phaser's `sprite.setAngle()` or `sprite.setRotation()`. The maneuver system sets the target angle, Phaser tweens the rotation smoothly.

### Texture Atlas Packing

**Tool: Free Texture Packer** (free, open-source) or **TexturePacker** (paid, better optimization).

**Atlas organization:**
```
assets/
├── atlases/
│   ├── hegemony_ships.png + .json     # All Hegemony ship sprites
│   ├── confederation_ships.png + .json
│   ├── collective_ships.png + .json
│   ├── corsairs_ships.png + .json
│   ├── empire_ships.png + .json
│   ├── effects_weapons.png + .json     # All weapon/explosion effects
│   ├── effects_auras.png + .json       # Aura visual effects
│   └── ui_elements.png + .json         # HUD, menus, icons
```

**Naming convention in atlas:**
```
hegemony/fighter/talon/base
hegemony/fighter/talon/evolved
hegemony/fighter/talon/elite
hegemony/interceptor/raptor/base
hegemony/interceptor/raptor/evolved
...
```

### Evolution Visual Progression

Each evolution tier adds visual complexity:

1. **Base**: Clean silhouette, faction colors, minimal markings
2. **Evolved**: +10% scale, additional details (armor plates, sensor arrays, weapon pods), veteran markings
3. **Elite**: +20% scale, maximum detail, unique faction-specific flourishes (Hegemony: gold command trim; Corsairs: skull emblems and battle scars; Empire: psionic crystal glow)

For the sprite pipeline, generate base sprites first, then use image editing to add evolution-tier details as overlays. This ensures consistent base silhouettes across tiers.

## VFX & Particle Effects

**Approach:** Phaser's built-in particle emitter system for all effects.

**Faction weapon effects:**
| Faction | Laser Color | Trail | Impact |
|---------|------------|-------|--------|
| Hegemony | `#00BFFF` Blue beams | Geometric sparks | Blue flash |
| Confederation | `#FF6B35` Orange bolts | Warm trails | Orange burst |
| Collective | `#00FFFF` Cyan pulses | Digital fragments | Cyan ripple |
| Corsairs | `#8B008B` Purple beams | Chaotic red sparks | Violent flash |
| Empire | `#32CD32` Green bio-beams | Organic particles | Green splatter |

**Aura visuals:** Rendered as semi-transparent circle sprites with faction-colored tinting, animated with gentle pulse/rotation. Range indicators can toggle on/off.

## UI Art Direction

**Faction-themed UI**: Each faction's menus use their color palette as accent colors on a dark neutral base (`#1a1a2e` background). Ship selection, evolution trees, and upgrade screens use the faction's energy color for highlights and interactive elements.

**HUD layout** is universal (health bars, minimap, ability cooldowns) with faction-colored trim. This keeps the UI readable while maintaining faction identity.

---

# Section 4: Code Architecture

## Project Folder Structure

```
shattered-stars/
├── public/
│   ├── index.html
│   └── assets/
│       ├── atlases/           # Packed sprite atlases (.png + .json)
│       ├── audio/
│       │   ├── music/         # Faction themes, battle music
│       │   ├── weapons/       # Laser, missile, explosion SFX
│       │   └── ui/            # Click, hover, transition SFX
│       └── fonts/
│
├── src/
│   ├── main.ts                # Entry point, Phaser game config
│   ├── config.ts              # Game constants, balance values
│   │
│   ├── core/                  # Framework-agnostic core systems
│   │   ├── EventBus.ts        # Typed publish/subscribe
│   │   ├── GameStore.ts       # Immer-based state management
│   │   ├── GameClock.ts       # Fixed timestep + interpolation
│   │   └── types.ts           # Shared type exports
│   │
│   ├── data/                  # All game data (ships, factions, evolutions)
│   │   ├── index.ts           # Re-exports all data
│   │   ├── factions.ts        # Faction definitions & abilities
│   │   ├── ships.ts           # Ship stat blocks
│   │   ├── evolutions.ts      # Evolution trees & requirements
│   │   ├── abilities.ts       # Special abilities & auras
│   │   ├── combinations.ts    # Assembly/fusion/parasitic definitions
│   │   ├── pilots.ts          # Named pilots & specializations
│   │   ├── upgrades.ts        # Upgrade cards & slots
│   │   ├── campaign.ts        # Mission definitions & campaign structure
│   │   └── balance.ts         # Point costs, faction multipliers
│   │
│   ├── entities/              # Game entity definitions
│   │   ├── Ship.ts            # Ship entity (stats, state, components)
│   │   ├── Projectile.ts      # Laser/missile/torpedo
│   │   ├── Pilot.ts           # Pilot state, XP, specializations
│   │   └── Fleet.ts           # Fleet composition & formation
│   │
│   ├── systems/               # Game logic systems (ECS-inspired)
│   │   ├── MovementSystem.ts  # Maneuver chart execution
│   │   ├── CombatSystem.ts    # Attack resolution, dice, damage
│   │   ├── AbilitySystem.ts   # Cloak, SLAM, Jam, Coordinate, etc.
│   │   ├── AuraSystem.ts      # Passive area effects
│   │   ├── EvolutionSystem.ts # XP, evolution triggers, tier upgrades
│   │   ├── CombinationSystem.ts # Assembly, fusion, parasitic attach
│   │   ├── StressSystem.ts    # Stress tracking & maneuver restrictions
│   │   ├── FactionSystem.ts   # Faction-specific mechanics
│   │   ├── ProgressionSystem.ts # Pilot XP, faction mastery, unlocks
│   │   └── VictorySystem.ts   # Win condition checking
│   │
│   ├── ai/                    # AI systems
│   │   ├── AIDirector.ts      # Fleet-level objective assignment
│   │   ├── ShipAI.ts          # Individual ship decision making
│   │   ├── UtilityScorer.ts   # Utility AI scoring functions
│   │   ├── BehaviorTree.ts    # BT node types & execution
│   │   ├── formations/        # Formation patterns & maintenance
│   │   │   ├── FormationManager.ts
│   │   │   └── formations.ts  # Formation shape definitions
│   │   └── factions/          # Faction-specific AI profiles
│   │       ├── HegemonyAI.ts  # Formation discipline, coordinated fire
│   │       ├── ConfederationAI.ts  # Adaptive, heroic triggers
│   │       ├── CollectiveAI.ts    # Swarm targeting, shared data
│   │       ├── CorsairsAI.ts      # Hit-and-run, flanking
│   │       └── EmpireAI.ts        # Psionic coordination, evolution
│   │
│   ├── scenes/                # Phaser scenes
│   │   ├── BootScene.ts       # Asset preloading
│   │   ├── MainMenuScene.ts   # Title screen & faction select
│   │   ├── ShipSelectScene.ts # Squadron building & evolution
│   │   ├── BattleScene.ts     # Main gameplay scene
│   │   ├── ResultsScene.ts    # Post-battle results & rewards
│   │   ├── CampaignScene.ts   # Campaign map & mission select
│   │   └── UpgradeScene.ts    # Ship upgrades & loadout
│   │
│   ├── ui/                    # UI components (Phaser GameObjects)
│   │   ├── HUD.ts             # In-battle heads-up display
│   │   ├── HealthBar.ts       # Ship health/shield bars
│   │   ├── AbilityBar.ts      # Ability cooldowns & activation
│   │   ├── Minimap.ts         # Tactical overview
│   │   ├── EvolutionTree.ts   # Visual evolution path display
│   │   ├── ShipCard.ts        # Ship stat card component
│   │   └── FactionPanel.ts    # Faction-specific UI elements
│   │
│   ├── rendering/             # Visual presentation
│   │   ├── ShipRenderer.ts    # Ship sprite, rotation, effects
│   │   ├── ProjectileRenderer.ts
│   │   ├── AuraRenderer.ts    # Aura circle effects
│   │   ├── VFXManager.ts      # Particle effects, explosions
│   │   └── CameraController.ts # Follow cam, zoom, shake
│   │
│   ├── audio/                 # Audio management
│   │   ├── AudioManager.ts    # Music, SFX, spatial audio
│   │   └── FactionAudio.ts    # Faction-specific sound profiles
│   │
│   └── save/                  # Persistence
│       ├── SaveManager.ts     # Save/load orchestration
│       ├── LocalStorage.ts    # Browser localStorage adapter
│       └── SaveSchema.ts      # Versioned save data structure
│
├── tests/
│   ├── unit/
│   │   ├── systems/           # System logic tests
│   │   ├── ai/                # AI decision tests
│   │   └── data/              # Data validation tests
│   ├── integration/
│   │   └── battle/            # Multi-system interaction tests
│   └── balance/
│       └── SimulationRunner.ts # Automated balance testing
│
├── tools/
│   ├── sprite-pipeline/       # Asset processing scripts
│   └── balance-analyzer/      # Win rate analysis tools
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .eslintrc.json
└── CLAUDE.md                  # AI development instructions
```

## Core Systems — Module Designs

### Ship System

```typescript
// src/data/ships.ts — Ship stat definitions

export interface ShipStats {
  readonly hull: number;
  readonly shields: number;
  readonly attack: number;
  readonly agility: number;
  readonly speed: { readonly min: number; readonly max: number };
  readonly size: ShipSize;
  readonly actions: readonly ActionType[];
  readonly upgradeSlots: readonly UpgradeSlotType[];
  readonly maneuverDial: readonly ManeuverDefinition[];
  readonly pointCost: number;
}

export interface ShipDefinition {
  readonly id: ShipId;
  readonly name: string;
  readonly faction: FactionId;
  readonly role: ShipRole;
  readonly baseStats: ShipStats;
  readonly factionAbility: string;     // Faction-specific keyword
  readonly evolutionPaths: readonly EvolutionPath[];
  readonly spriteKey: string;          // Atlas frame key
  readonly description: string;
}

export type ShipSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge';
export type ShipRole = 'light_fighter' | 'heavy_fighter' | 'interceptor'
  | 'bomber' | 'support' | 'gunship' | 'capital';

export type ActionType = 'focus' | 'evade' | 'target_lock' | 'barrel_roll'
  | 'boost' | 'coordinate' | 'jam' | 'cloak' | 'slam' | 'calculate'
  | 'reinforce' | 'rotate_arc' | 'reload';

// Example ship definition
export const TALON_FIGHTER: ShipDefinition = {
  id: 'hegemony_talon_fighter',
  name: 'Talon-class Fighter',
  faction: 'terran_hegemony',
  role: 'light_fighter',
  baseStats: {
    hull: 3,
    shields: 2,
    attack: 2,
    agility: 3,
    speed: { min: 1, max: 5 },
    size: 'small',
    actions: ['focus', 'evade', 'target_lock', 'barrel_roll'],
    upgradeSlots: ['modification', 'discipline'],
    maneuverDial: TALON_MANEUVER_DIAL,
    pointCost: 17,
  },
  factionAbility: 'disciplined',
  evolutionPaths: [
    { pathId: 'interceptor', targetShip: 'hegemony_raptor_interceptor', xpRequired: 100 },
    { pathId: 'heavy', targetShip: 'hegemony_vanguard_heavy', xpRequired: 100 },
  ],
  spriteKey: 'hegemony/fighter/talon/base',
  description: 'Standard Hegemony fighter. Disciplined and reliable.',
} as const;
```

### Movement System

```typescript
// src/systems/MovementSystem.ts

export type ManeuverDirection = 'straight' | 'bank_left' | 'bank_right'
  | 'turn_left' | 'turn_right' | 'kturn' | 'segnor_left' | 'segnor_right'
  | 'tallon_left' | 'tallon_right';

export type ManeuverDifficulty = 'green' | 'white' | 'red';

export interface ManeuverDefinition {
  readonly direction: ManeuverDirection;
  readonly speed: number;             // 1-5
  readonly difficulty: ManeuverDifficulty;
}

export interface ManeuverTemplate {
  /** Offset from ship's current position in ship-local coordinates */
  readonly deltaX: number;
  readonly deltaY: number;
  /** Final facing change in degrees */
  readonly deltaAngle: number;
  /** Bezier control points for smooth movement path */
  readonly pathPoints: readonly { x: number; y: number }[];
}

/**
 * Converts a maneuver definition into world-space movement.
 * This is the core of the tabletop-to-digital translation.
 *
 * Movement is NOT physics-based. Each maneuver maps to a fixed
 * spatial template that is scaled by speed and rotated by current facing.
 */
export function resolveManeuver(
  currentX: number,
  currentY: number,
  currentAngle: number,
  maneuver: ManeuverDefinition
): ManeuverResult {
  const template = MANEUVER_TEMPLATES[maneuver.direction];
  const scale = maneuver.speed * SPEED_SCALE_FACTOR;

  // Rotate template offsets by current facing
  const cos = Math.cos(currentAngle * DEG_TO_RAD);
  const sin = Math.sin(currentAngle * DEG_TO_RAD);

  const targetX = currentX + (template.deltaX * cos - template.deltaY * sin) * scale;
  const targetY = currentY + (template.deltaX * sin + template.deltaY * cos) * scale;
  const targetAngle = currentAngle + template.deltaAngle;

  return {
    targetX,
    targetY,
    targetAngle: normalizeAngle(targetAngle),
    pathPoints: template.pathPoints.map(p => rotatePoint(p, currentAngle, scale)),
    difficulty: maneuver.difficulty,
  };
}

// Pre-defined movement templates (tabletop faithful)
const MANEUVER_TEMPLATES: Record<ManeuverDirection, ManeuverTemplate> = {
  straight:      { deltaX: 0, deltaY: -1, deltaAngle: 0,   pathPoints: [/* linear */] },
  bank_left:     { deltaX: -0.4, deltaY: -0.9, deltaAngle: -45, pathPoints: [/* curve */] },
  bank_right:    { deltaX: 0.4, deltaY: -0.9, deltaAngle: 45,  pathPoints: [/* curve */] },
  turn_left:     { deltaX: -0.7, deltaY: -0.7, deltaAngle: -90, pathPoints: [/* tight curve */] },
  turn_right:    { deltaX: 0.7, deltaY: -0.7, deltaAngle: 90,  pathPoints: [/* tight curve */] },
  kturn:         { deltaX: 0, deltaY: -1, deltaAngle: 180,  pathPoints: [/* linear */] },
  segnor_left:   { deltaX: -0.4, deltaY: -0.9, deltaAngle: 135, pathPoints: [/* curve + flip */] },
  segnor_right:  { deltaX: 0.4, deltaY: -0.9, deltaAngle: -135, pathPoints: [/* curve + flip */] },
  tallon_left:   { deltaX: -0.7, deltaY: -0.7, deltaAngle: 180, pathPoints: [/* sharp + flip */] },
  tallon_right:  { deltaX: 0.7, deltaY: -0.7, deltaAngle: 180, pathPoints: [/* sharp + flip */] },
};
```

### Combat System

```typescript
// src/systems/CombatSystem.ts

export interface AttackContext {
  readonly attacker: ShipState;
  readonly defender: ShipState;
  readonly range: number;                  // 1-3
  readonly attackDice: number;             // Modified by abilities
  readonly defenseDice: number;            // Modified by range/abilities
  readonly attackModifiers: readonly DiceModifier[];
  readonly defenseModifiers: readonly DiceModifier[];
}

export type DiceFace = 'hit' | 'critical' | 'focus' | 'blank';
export type DefenseFace = 'evade' | 'focus' | 'blank';

export interface AttackResult {
  readonly attackRoll: readonly DiceFace[];
  readonly defenseRoll: readonly DefenseFace[];
  readonly hitsLanded: number;
  readonly critsLanded: number;
  readonly shieldDamage: number;
  readonly hullDamage: number;
  readonly shipDestroyed: boolean;
}

/**
 * Pure function: resolve a complete attack.
 * No side effects — caller applies the result to game state.
 */
export function resolveAttack(context: AttackContext, rng: RandomGenerator): AttackResult {
  // Roll attack dice
  let attackRoll = rollAttackDice(context.attackDice, rng);
  attackRoll = applyModifiers(attackRoll, context.attackModifiers);

  // Roll defense dice
  const defenseDice = context.defenseDice + getRangeBonus(context.range);
  let defenseRoll = rollDefenseDice(defenseDice, rng);
  defenseRoll = applyModifiers(defenseRoll, context.defenseModifiers);

  // Cancel hits with evades
  const hits = countFaces(attackRoll, 'hit');
  const crits = countFaces(attackRoll, 'critical');
  const evades = countFaces(defenseRoll, 'evade');

  const cancelled = Math.min(evades, hits + crits);
  const hitsLanded = Math.max(0, hits - cancelled);
  const critsLanded = Math.max(0, crits - Math.max(0, cancelled - hits));

  // Apply damage: shields absorb hits first, crits bypass shields
  const shieldDamage = Math.min(hitsLanded, context.defender.shields);
  const hullFromHits = hitsLanded - shieldDamage;
  const hullDamage = hullFromHits + critsLanded;
  const remainingHull = context.defender.hull - hullDamage;

  return {
    attackRoll,
    defenseRoll,
    hitsLanded,
    critsLanded,
    shieldDamage,
    hullDamage,
    shipDestroyed: remainingHull <= 0,
  };
}
```

### Evolution System

```typescript
// src/data/evolutions.ts

export interface EvolutionPath {
  readonly pathId: string;
  readonly targetShip: ShipId;
  readonly xpRequired: number;
  readonly achievement?: AchievementId;       // Optional requirement
  readonly statChanges: Partial<ShipStats>;
  readonly roleChange?: ShipRole;             // If evolution changes role
  readonly unlockedAbilities?: readonly string[];
  readonly visualTier: 'base' | 'evolved' | 'elite';
}

export interface EvolutionTree {
  readonly rootShip: ShipId;
  readonly faction: FactionId;
  readonly branches: readonly EvolutionBranch[];
}

export interface EvolutionBranch {
  readonly fromShip: ShipId;
  readonly paths: readonly EvolutionPath[];
  readonly isReversible: boolean;             // Equipment-based roles can revert
}

// Example: Talon Fighter evolution tree
export const TALON_EVOLUTION: EvolutionTree = {
  rootShip: 'hegemony_talon_fighter',
  faction: 'terran_hegemony',
  branches: [
    {
      fromShip: 'hegemony_talon_fighter',
      isReversible: false,
      paths: [
        {
          pathId: 'interceptor',
          targetShip: 'hegemony_raptor_interceptor',
          xpRequired: 100,
          achievement: 'speed_demon',
          statChanges: { agility: 1, hull: -1 },
          roleChange: 'interceptor',
          unlockedAbilities: ['boost'],
          visualTier: 'evolved',
        },
        {
          pathId: 'heavy',
          targetShip: 'hegemony_vanguard_heavy',
          xpRequired: 100,
          achievement: 'survivor',
          statChanges: { shields: 2 },
          roleChange: 'heavy_fighter',
          unlockedAbilities: ['target_lock'],
          visualTier: 'evolved',
        },
      ],
    },
  ],
} as const;
```

### Faction System

```typescript
// src/data/factions.ts

export type FactionId = 'terran_hegemony' | 'free_confederation'
  | 'synthetic_collective' | 'void_corsairs' | 'ascendant_empire';

export interface FactionDefinition {
  readonly id: FactionId;
  readonly name: string;
  readonly motto: string;
  readonly philosophy: string;
  readonly colorPalette: FactionPalette;
  readonly playstyle: string;
  readonly passiveAbilities: readonly FactionPassive[];
  readonly shipModifications: readonly FactionShipMod[];
  readonly exclusiveMechanic: FactionMechanic;
  readonly resourceType: FactionResource;
  readonly upgradeSlotTypes: readonly UpgradeSlotType[];
  readonly aiProfile: AIProfileId;
}

export interface FactionPalette {
  readonly primary: string;
  readonly secondary: string;
  readonly accent: string;
  readonly energy: string;
  readonly glow: string;
}

export interface FactionMechanic {
  readonly name: string;
  readonly type: 'doctrine' | 'heroic_moment' | 'adaptive_protocol'
    | 'reputation_crew' | 'bio_evolution';
  readonly description: string;
}

export interface FactionResource {
  readonly name: string;                    // "Command Points", "Inspiration", etc.
  readonly generationRule: string;
  readonly maxCapacity: number;
  readonly eliteAbility: { cost: number; effect: string };
}

// Example faction
export const TERRAN_HEGEMONY: FactionDefinition = {
  id: 'terran_hegemony',
  name: 'Terran Hegemony',
  motto: 'Order Through Unity',
  philosophy: 'Military might and organized governance',
  colorPalette: {
    primary: '#2E4A99',
    secondary: '#C0C0C0',
    accent: '#FFFFFF',
    energy: '#00BFFF',
    glow: '#87CEEB',
  },
  playstyle: 'Formation flying, coordinated attacks, heavy shields',
  passiveAbilities: [
    {
      name: 'Formation Discipline',
      effect: 'Ships at Range 1 of 2+ friendly ships get +1 defense die',
    },
    {
      name: 'Shield Harmonics',
      effect: 'When a friendly at Range 1 recovers shields, this ship recovers 1 shield',
    },
  ],
  shipModifications: [
    { target: 'all', effect: '+1 shield capacity (minimum 1)' },
    { target: 'fighters', keyword: 'disciplined', effect: '+1 attack when 2+ friendlies at Range 1' },
    { target: 'capitals', keyword: 'command_node', effect: 'Coordinate range increased to 1-3' },
  ],
  exclusiveMechanic: {
    name: 'Military Doctrine System',
    type: 'doctrine',
    description: 'Choose a doctrine before battle that affects all ships',
  },
  resourceType: {
    name: 'Command Points',
    generationRule: 'Gain 1 CP per turn per command ship',
    maxCapacity: 15,
    eliteAbility: { cost: 5, effect: 'Instantly redeploy a destroyed ship' },
  },
  upgradeSlotTypes: ['command', 'shield', 'discipline'],
  aiProfile: 'formation_doctrine',
} as const;
```

### Combination System

```typescript
// src/data/combinations.ts

export type CombinationType = 'mechanical_assembly' | 'bio_fusion'
  | 'digital_integration' | 'parasitic_symbiosis' | 'temporary';

export interface CombinationDefinition {
  readonly id: string;
  readonly name: string;
  readonly faction: FactionId;
  readonly type: CombinationType;
  readonly components: readonly CombinationComponent[];
  readonly assemblyTime: number;           // Turns required
  readonly combinedStats: ShipStats;
  readonly combinedAbilities: readonly string[];
  readonly separationPenalty: SeparationPenalty;
  readonly spriteKey: string;
}

export interface CombinationComponent {
  readonly shipId: ShipId;
  readonly count: number;
  readonly role: string;                   // e.g. "weapons", "command", "support"
}

export interface SeparationPenalty {
  readonly damagePerShip: number;
  readonly stressPerShip: number;
  readonly canEmergencySeparate: boolean;
}
```

## Data Architecture: JSON Examples

### Ship Definition (Full Example)

```json
{
  "id": "confederation_phoenix_starfighter",
  "name": "Phoenix-class Starfighter",
  "faction": "free_confederation",
  "role": "heavy_fighter",
  "baseStats": {
    "hull": 4,
    "shields": 2,
    "attack": 3,
    "agility": 2,
    "speed": { "min": 1, "max": 4 },
    "size": "small",
    "pointCost": 21
  },
  "actions": ["focus", "target_lock", "barrel_roll"],
  "upgradeSlots": ["torpedo", "astromech", "modification", "adaptation"],
  "factionKeyword": "heroic",
  "maneuverDial": [
    { "direction": "straight", "speed": 1, "difficulty": "green" },
    { "direction": "straight", "speed": 2, "difficulty": "green" },
    { "direction": "straight", "speed": 3, "difficulty": "white" },
    { "direction": "straight", "speed": 4, "difficulty": "red" },
    { "direction": "bank_left", "speed": 1, "difficulty": "green" },
    { "direction": "bank_left", "speed": 2, "difficulty": "white" },
    { "direction": "bank_left", "speed": 3, "difficulty": "white" },
    { "direction": "bank_right", "speed": 1, "difficulty": "green" },
    { "direction": "bank_right", "speed": 2, "difficulty": "white" },
    { "direction": "bank_right", "speed": 3, "difficulty": "white" },
    { "direction": "turn_left", "speed": 1, "difficulty": "white" },
    { "direction": "turn_left", "speed": 2, "difficulty": "white" },
    { "direction": "turn_right", "speed": 1, "difficulty": "white" },
    { "direction": "turn_right", "speed": 2, "difficulty": "white" },
    { "direction": "kturn", "speed": 4, "difficulty": "red" }
  ],
  "evolutionPaths": [
    {
      "pathId": "advanced",
      "targetShip": "confederation_nova_advanced",
      "xpRequired": 250,
      "statChanges": { "attack": 1, "shields": 1 },
      "visualTier": "elite"
    }
  ]
}
```

### Faction Configuration (Full Example)

```json
{
  "id": "void_corsairs",
  "name": "Void Corsairs",
  "motto": "Fortune Favors the Bold",
  "colorPalette": {
    "primary": "#4B0082",
    "secondary": "#DC143C",
    "accent": "#DAA520",
    "energy": "#FF1493",
    "glow": "#8B008B"
  },
  "exclusiveMechanic": {
    "name": "Reputation & Crew System",
    "type": "reputation_crew",
    "reputationLevels": [
      { "name": "Unknown", "threshold": 0, "effects": [] },
      { "name": "Notorious", "threshold": 11, "effects": ["intimidation_range_1"] },
      { "name": "Infamous", "threshold": 26, "effects": ["recruit_defectors"] },
      { "name": "Legendary", "threshold": 51, "effects": ["enemies_flee"] }
    ],
    "crewSlots": {
      "gunner": ["crack_shot", "weapons_expert", "gunslinger"],
      "pilot_ace": ["hotshot", "navigator", "stunt_pilot"],
      "tech": ["hacker", "engineer", "saboteur"],
      "social": ["intimidator", "negotiator", "spy"]
    }
  },
  "victoryConditions": {
    "primary": "Destroy all enemy forces",
    "plunder": "Steal cargo worth 500+ credits",
    "intimidation": "Force 75% of enemy fleet to flee",
    "reputation": "Achieve Legendary status during battle"
  }
}
```

---

# Section 5: AI System Deep Dive

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  AI Director                         │
│         (Behavior Tree — Fleet Level)                │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  Objective   │  │  Formation   │  │  Threat    │ │
│  │  Assigner    │  │  Manager     │  │  Assessor  │ │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                │                 │         │
└─────────┼────────────────┼─────────────────┼─────────┘
          │                │                 │
    ┌─────▼────────────────▼─────────────────▼─────┐
    │            Ship AI (Utility AI)               │
    │                                               │
    │  ┌────────────┐  ┌─────────────────────────┐  │
    │  │  Maneuver  │  │  Action Scorer           │  │
    │  │  Selector  │  │  (weighted per faction)  │  │
    │  └────────────┘  └─────────────────────────┘  │
    └───────────────────────────────────────────────┘
```

## Individual Ship AI: Utility AI

### Why Utility AI (Not Behavior Trees or FSMs)

The existing Unity prototype uses a **lookup table** (position × dice roll → maneuver). This works for basic opponents but cannot express faction-specific behaviors, evolving difficulty, or contextual decision-making.

| Architecture | Pros | Cons | Verdict |
|-------------|------|------|---------|
| **FSM** | Simple, debuggable | Explosion of states for 5 factions × 7 roles. Hard to tune gradients of behavior | Too rigid |
| **Behavior Tree** | Hierarchical, reusable nodes | Deeply nested trees become hard to maintain. Priority-based, not gradient-based | Good for fleet, not individual |
| **GOAP** | Goal-driven, emergent behavior | Complex to implement and debug. Overkill for ship-level decisions | Over-engineered |
| **Utility AI** | Data-driven, tunable weights, handles gradients naturally. Different factions = different weight profiles | Requires careful scoring function design | **Best fit** |

### Utility AI Design

Each tick, a ship evaluates all legal maneuvers and actions by scoring them across multiple considerations:

```typescript
// src/ai/UtilityScorer.ts

export interface ScoringContext {
  readonly self: ShipState;
  readonly target: ShipState | null;
  readonly allies: readonly ShipState[];
  readonly enemies: readonly ShipState[];
  readonly objective: Objective;             // From AI Director
  readonly factionWeights: FactionWeightProfile;
  readonly difficultyLevel: number;          // 0.0 - 1.0
}

export interface FactionWeightProfile {
  readonly aggressiveness: number;       // 0-1: How much to value offensive positioning
  readonly selfPreservation: number;     // 0-1: How much to avoid danger
  readonly formationMaintenance: number; // 0-1: How much to stay in formation
  readonly objectiveCompliance: number;  // 0-1: How much to follow AI Director orders
  readonly allySupport: number;          // 0-1: How much to help allies
  readonly flanking: number;             // 0-1: How much to value arc-dodging
  readonly swarming: number;             // 0-1: How much to cluster on targets
  readonly unpredictability: number;     // 0-1: Random noise added to decisions
}

// Faction weight profiles
export const FACTION_WEIGHTS: Record<FactionId, FactionWeightProfile> = {
  terran_hegemony: {
    aggressiveness: 0.5,
    selfPreservation: 0.6,
    formationMaintenance: 0.9,     // Hegemony: formations are critical
    objectiveCompliance: 0.8,      // Disciplined, follows orders
    allySupport: 0.7,
    flanking: 0.3,
    swarming: 0.4,
    unpredictability: 0.1,         // Very predictable (disciplined)
  },
  free_confederation: {
    aggressiveness: 0.6,
    selfPreservation: 0.4,         // Heroic — willing to take risks
    formationMaintenance: 0.4,
    objectiveCompliance: 0.5,      // Independent-minded
    allySupport: 0.8,             // Protect each other
    flanking: 0.6,
    swarming: 0.3,
    unpredictability: 0.4,         // Adaptive, surprising
  },
  synthetic_collective: {
    aggressiveness: 0.7,
    selfPreservation: 0.2,         // Expendable drones
    formationMaintenance: 0.3,
    objectiveCompliance: 0.95,     // Perfect order compliance
    allySupport: 0.3,
    flanking: 0.4,
    swarming: 0.9,                 // Swarm is the strategy
    unpredictability: 0.05,        // Completely calculated
  },
  void_corsairs: {
    aggressiveness: 0.8,
    selfPreservation: 0.7,         // Self-interested
    formationMaintenance: 0.1,     // No discipline
    objectiveCompliance: 0.3,      // Do what benefits them
    allySupport: 0.2,
    flanking: 0.9,                 // Dirty fighters
    swarming: 0.2,
    unpredictability: 0.8,         // Very unpredictable
  },
  ascendant_empire: {
    aggressiveness: 0.5,
    selfPreservation: 0.5,
    formationMaintenance: 0.5,
    objectiveCompliance: 0.6,
    allySupport: 0.6,
    flanking: 0.5,
    swarming: 0.3,
    unpredictability: 0.3,
  },
};
```

### Scoring Functions

```typescript
/**
 * Score a potential maneuver for a ship.
 * Returns 0.0 (terrible) to 1.0 (optimal).
 */
export function scoreManeuver(
  maneuver: ManeuverDefinition,
  context: ScoringContext
): number {
  const w = context.factionWeights;
  const result = resolveManeuver(
    context.self.x, context.self.y, context.self.angle, maneuver
  );

  let score = 0;

  // Offensive: Am I getting into a good attack position?
  if (context.target) {
    score += w.aggressiveness * scoreOffensivePosition(result, context.target);
  }

  // Defensive: Am I avoiding being in enemy arcs?
  score += w.selfPreservation * scoreDefensivePosition(result, context.enemies);

  // Formation: Am I maintaining formation with allies?
  score += w.formationMaintenance * scoreFormation(result, context.allies);

  // Objective: Am I moving toward the AI Director's objective?
  score += w.objectiveCompliance * scoreObjectiveProgress(result, context.objective);

  // Flanking: Am I getting behind the enemy?
  score += w.flanking * scoreFlankingPosition(result, context.target);

  // Swarming: Am I grouping up on the same target as allies?
  score += w.swarming * scoreSwarmPosition(result, context.allies, context.target);

  // Stress penalty: Red maneuvers are costly when already stressed
  if (maneuver.difficulty === 'red' && context.self.isStressed) {
    return 0; // Cannot perform red when stressed
  }
  if (maneuver.difficulty === 'red') {
    score *= 0.7; // Stress cost
  }
  if (maneuver.difficulty === 'green' && context.self.isStressed) {
    score *= 1.2; // Bonus for clearing stress
  }

  // Add noise for unpredictability
  score += (Math.random() - 0.5) * w.unpredictability * 0.2;

  return clamp(score, 0, 1);
}
```

### Faction-Specific AI Behaviors

**Terran Hegemony AI — Formation Doctrine:**
```typescript
// src/ai/factions/HegemonyAI.ts

export class HegemonyFleetBehavior {
  /**
   * Hegemony ships maintain strict formation.
   * The formation is defined by the active doctrine.
   * Ships score formation maintenance extremely highly.
   */

  selectDoctrine(battleState: BattleState): Doctrine {
    // Choose doctrine based on enemy composition
    const enemySwarmCount = countSmallShips(battleState.enemies);
    const enemyCapitalCount = countLargeShips(battleState.enemies);

    if (enemyCapitalCount > 0) return DOCTRINES.aggressive_assault;
    if (enemySwarmCount > 8) return DOCTRINES.defensive_formation;
    return DOCTRINES.electronic_warfare;
  }

  assignFormationSlots(fleet: ShipState[]): FormationAssignment[] {
    // Assign each ship a position in the formation pattern
    // Command ships at center, fighters on wings, support in rear
    const sorted = sortByRole(fleet);
    return FORMATION_PATTERNS[this.activeDoctrine].assign(sorted);
  }

  coordinatedFireTarget(fleet: ShipState[], enemies: ShipState[]): ShipState {
    // Hegemony focuses fire — all ships attack the same target
    // Priority: most-damaged enemy > closest to formation center > highest threat
    return enemies
      .map(e => ({ enemy: e, score: this.targetPriorityScore(e, fleet) }))
      .sort((a, b) => b.score - a.score)[0].enemy;
  }
}
```

**Synthetic Collective AI — Swarm Protocol:**
```typescript
// src/ai/factions/CollectiveAI.ts

export class CollectiveFleetBehavior {
  /**
   * Collective ships share targeting data and swarm enemies.
   * When one ship locks a target, ALL collective ships gain benefit.
   * Individual ship survival is irrelevant — the network matters.
   */

  private targetingData: Map<ShipId, TargetAnalysis> = new Map();

  analyzeEnemy(enemy: ShipState, observingShips: ShipState[]): TargetAnalysis {
    // More observers = better analysis. Collective advantage scales with ship count
    const observerCount = observingShips.filter(s => hasLineOfSight(s, enemy)).length;
    return {
      predictedManeuver: this.predictManeuver(enemy, observerCount),
      weakPoints: this.analyzeDefenses(enemy, observerCount),
      priorityScore: this.calculateSwarmPriority(enemy),
    };
  }

  assignSwarmTargets(fleet: ShipState[], enemies: ShipState[]): Map<ShipId, ShipId> {
    // Collective concentrates fire: assign MULTIPLE ships to each target
    // Never spread fire evenly — overkill one target, then move to next
    const priorities = enemies
      .map(e => ({ enemy: e, score: this.calculateSwarmPriority(e) }))
      .sort((a, b) => b.score - a.score);

    const assignments = new Map<ShipId, ShipId>();
    let fleetIndex = 0;

    for (const { enemy } of priorities) {
      const shipsNeeded = this.estimateShipsToKill(enemy);
      for (let i = 0; i < shipsNeeded && fleetIndex < fleet.length; i++) {
        assignments.set(fleet[fleetIndex].id, enemy.id);
        fleetIndex++;
      }
    }

    return assignments;
  }

  // Adaptive protocol: learn from enemy behavior
  adaptToEnemyTactics(battleHistory: BattleEvent[]): ProtocolAdaptation {
    const patterns = this.detectPatterns(battleHistory);
    if (patterns.highAgility) return PROTOCOLS.predictive_targeting;
    if (patterns.formationFlying) return PROTOCOLS.area_denial;
    if (patterns.heavyOrdnance) return PROTOCOLS.point_defense;
    return PROTOCOLS.standard;
  }
}
```

**Void Corsairs AI — Dirty Fighting:**
```typescript
// src/ai/factions/CorsairsAI.ts

export class CorsairsFleetBehavior {
  /**
   * Corsairs fight dirty. They pick on weak targets,
   * attack from behind, and flee when outmatched.
   * No formation discipline — every pirate for themselves.
   */

  selectTarget(ship: ShipState, enemies: ShipState[]): ShipState | null {
    // Corsairs prioritize: damaged > isolated > valuable
    // Never attack the strongest enemy head-on
    return enemies
      .filter(e => !this.isTooStrongToFight(ship, e))
      .map(e => ({
        enemy: e,
        score: this.dirtyFightingScore(ship, e),
      }))
      .sort((a, b) => b.score - a.score)[0]?.enemy ?? null;
  }

  private dirtyFightingScore(self: ShipState, enemy: ShipState): number {
    let score = 0;
    // Love attacking damaged enemies
    score += (1 - enemy.hull / enemy.maxHull) * 3.0;
    // Love attacking from behind (not in their arc)
    score += isInRearArc(self, enemy) ? 2.0 : 0;
    // Avoid enemies that are targeting us
    score -= isTargetingMe(enemy, self) ? 1.5 : 0;
    // High value targets get bonus
    score += enemy.pointCost / 100;
    // Random chaos factor
    score += (Math.random() - 0.3) * 1.0;
    return score;
  }

  shouldFlee(ship: ShipState, nearbyEnemies: ShipState[]): boolean {
    // Corsairs are self-preserving — flee when things go bad
    const healthPercent = ship.hull / ship.maxHull;
    const outnumbered = nearbyEnemies.length >= 3;
    return healthPercent < 0.3 || (healthPercent < 0.5 && outnumbered);
  }
}
```

**Free Confederation AI — Heroic Adaptability:**
```typescript
// src/ai/factions/ConfederationAI.ts

export class ConfederationFleetBehavior {
  /**
   * Confederation adapts to the situation. When losing,
   * heroic moments trigger. Ships protect each other.
   */

  private heroicMomentum: number = 0;

  updateMomentum(events: BattleEvent[]): void {
    for (const event of events) {
      if (event.type === 'ship_damaged' && event.faction === 'free_confederation') {
        this.heroicMomentum += 1; // Getting damaged builds momentum
      }
      if (event.type === 'ally_saved') {
        this.heroicMomentum += 3; // Saving allies builds fast
      }
      if (event.type === 'outnumbered_engagement') {
        this.heroicMomentum += 2; // Fighting against odds
      }
    }
  }

  checkHeroicMoment(): HeroicMoment | null {
    if (this.heroicMomentum >= 7 && this.isLosingBadly()) {
      this.heroicMomentum -= 7;
      return HEROIC_MOMENTS.the_cavalry_arrives; // Reinforcements!
    }
    if (this.heroicMomentum >= 5 && this.hasNearDeathShip()) {
      this.heroicMomentum -= 5;
      return HEROIC_MOMENTS.inspiring_sacrifice;
    }
    if (this.heroicMomentum >= 3) {
      this.heroicMomentum -= 3;
      return HEROIC_MOMENTS.against_all_odds; // +2 attack/defense
    }
    return null;
  }

  // Confederation ships protect each other
  shouldIntercept(protector: ShipState, endangered: ShipState): boolean {
    // Willing to put themselves in danger for allies
    return endangered.hull < endangered.maxHull * 0.3
      && protector.hull > protector.maxHull * 0.5;
  }
}
```

**Ascendant Empire AI — Bio-Evolution:**
```typescript
// src/ai/factions/EmpireAI.ts

export class EmpireFleetBehavior {
  /**
   * Empire ships evolve MID-BATTLE based on conditions.
   * The AI tracks evolution triggers and applies adaptations.
   */

  private evolutionTrackers: Map<ShipId, EvolutionTracker> = new Map();

  checkEvolutionTriggers(ship: ShipState, battleHistory: BattleEvent[]): BioEvolution | null {
    const tracker = this.getTracker(ship.id);

    // Combat Pressure Evolution: reduced to 25% hull
    if (ship.hull <= ship.maxHull * 0.25 && !tracker.hasEvolved('combat_pressure')) {
      tracker.markEvolved('combat_pressure');
      return { type: 'combat_pressure', hullBonus: 2 };
    }

    // Speed Evolution: evaded 5+ attacks
    if (tracker.evadeCount >= 5 && !tracker.hasEvolved('speed')) {
      tracker.markEvolved('speed');
      return { type: 'speed', agilityBonus: 1, newAction: 'boost' };
    }

    // Weapon Evolution: scored 3+ crits
    if (tracker.critCount >= 3 && !tracker.hasEvolved('weapon')) {
      tracker.markEvolved('weapon');
      return { type: 'weapon', attackBonus: 1 };
    }

    return null;
  }

  // Psionic coordination: ignore range for coordinate actions
  coordinateRange(): number {
    return Infinity; // Empire psionic ships coordinate at unlimited range
  }
}
```

## Fleet/Squad AI: AI Director

```typescript
// src/ai/AIDirector.ts

export class AIDirector {
  private factionBehavior: FactionFleetBehavior;
  private objectives: Map<ShipId, Objective> = new Map();

  /**
   * Called each decision tick (not every frame).
   * Assigns high-level objectives to fleet ships.
   */
  update(battleState: BattleState): void {
    // 1. Assess overall battle situation
    const assessment = this.assessBattle(battleState);

    // 2. Determine fleet-level strategy
    const strategy = this.selectStrategy(assessment);

    // 3. Assign objectives to individual ships based on role
    for (const ship of battleState.friendlyFleet) {
      const objective = this.assignObjective(ship, strategy, battleState);
      this.objectives.set(ship.id, objective);
    }

    // 4. Check for faction-specific triggers
    this.factionBehavior.update(battleState);
  }

  private assignObjective(
    ship: ShipState,
    strategy: FleetStrategy,
    state: BattleState
  ): Objective {
    switch (ship.role) {
      case 'interceptor':
        // Fast ships chase priority targets or arc-dodge
        return strategy === 'aggressive'
          ? { type: 'hunt', target: this.findPriorityTarget(state) }
          : { type: 'harass', targets: this.findVulnerableTargets(state) };

      case 'bomber':
        // Bombers always target large/capital ships
        return { type: 'bombing_run', target: this.findLargestEnemy(state) };

      case 'support':
        // Support ships stay near the most damaged ally
        return { type: 'support', target: this.findMostDamagedAlly(state) };

      case 'gunship':
        // Gunships hold position and lay down fire
        return { type: 'hold_position', zone: this.findControlZone(state) };

      default:
        // Fighters follow fleet strategy
        return strategy === 'aggressive'
          ? { type: 'engage', target: this.findClosestEnemy(ship, state) }
          : { type: 'defend', zone: this.findDefenseZone(state) };
    }
  }
}
```

### Target Priority System

```typescript
export function calculateTargetPriority(
  target: ShipState,
  context: TargetingContext
): number {
  let priority = 0;

  // Threat level: How dangerous is this target?
  priority += target.attack * 10;

  // Vulnerability: How easy to destroy?
  const healthPercent = (target.hull + target.shields) /
    (target.maxHull + target.maxShields);
  priority += (1 - healthPercent) * 30; // Damaged targets are priority

  // Role value: Support ships are high value targets
  const roleValues: Record<ShipRole, number> = {
    support: 25, capital: 20, bomber: 15,
    gunship: 10, heavy_fighter: 8, interceptor: 5, light_fighter: 3,
  };
  priority += roleValues[target.role];

  // Proximity: Closer targets are higher priority
  const distance = distanceBetween(context.self, target);
  priority += Math.max(0, 30 - distance * 5);

  return priority;
}
```

### Difficulty Scaling

```typescript
export interface DifficultyProfile {
  readonly name: string;
  readonly reactionTime: number;       // Ticks between decisions (higher = slower)
  readonly maneuverAccuracy: number;   // 0-1: How often AI picks optimal maneuver
  readonly targetingAccuracy: number;  // 0-1: How well AI picks targets
  readonly abilityUsage: number;       // 0-1: How well AI uses special abilities
  readonly formationQuality: number;   // 0-1: How well AI maintains formations
}

export const DIFFICULTY_PROFILES: Record<string, DifficultyProfile> = {
  apprentice: {
    name: 'Apprentice',
    reactionTime: 8,
    maneuverAccuracy: 0.4,
    targetingAccuracy: 0.3,
    abilityUsage: 0.1,
    formationQuality: 0.2,
  },
  veteran: {
    name: 'Veteran',
    reactionTime: 4,
    maneuverAccuracy: 0.7,
    targetingAccuracy: 0.6,
    abilityUsage: 0.5,
    formationQuality: 0.6,
  },
  ace: {
    name: 'Ace',
    reactionTime: 2,
    maneuverAccuracy: 0.9,
    targetingAccuracy: 0.85,
    abilityUsage: 0.8,
    formationQuality: 0.85,
  },
  mythic: {
    name: 'Mythic',
    reactionTime: 1,
    maneuverAccuracy: 0.98,
    targetingAccuracy: 0.95,
    abilityUsage: 0.95,
    formationQuality: 0.95,
  },
};
```

## Boss AI: Capital Ships

Capital ships use a **phased state machine** layered on top of the utility AI:

```typescript
export interface BossPhase {
  readonly name: string;
  readonly healthThreshold: number;      // Transitions when health drops below this %
  readonly behaviorChanges: BossBehavior;
  readonly newAbilities: readonly string[];
  readonly dialogue?: string;            // Flavor text on phase transition
}

export const HEGEMONY_BATTLECRUISER_PHASES: readonly BossPhase[] = [
  {
    name: 'Full Power',
    healthThreshold: 1.0,
    behaviorChanges: { aggression: 0.5, shieldFocus: true },
    newAbilities: ['broadside', 'launch_fighters'],
  },
  {
    name: 'Shields Failing',
    healthThreshold: 0.6,
    behaviorChanges: { aggression: 0.7, shieldFocus: false },
    newAbilities: ['overcharge_weapons', 'desperate_maneuvers'],
    dialogue: 'Redirect power to weapons! All batteries, fire at will!',
  },
  {
    name: 'Critical Damage',
    healthThreshold: 0.3,
    behaviorChanges: { aggression: 1.0, selfDestruct: true },
    newAbilities: ['ram_attack', 'final_bombardment'],
    dialogue: 'This ship will not fall quietly!',
  },
];
```

---

# Section 6: Development Roadmap

## Phase 0: Foundation (Weeks 1–2)

### Deliverables
- [ ] Project scaffolding: Vite + TypeScript + Phaser 3 + ESLint + Vitest
- [ ] Phaser game config with single BattleScene rendering a placeholder sprite
- [ ] GameClock with fixed timestep (60Hz logic, decoupled from render)
- [ ] EventBus with typed events
- [ ] GameStore with Immer
- [ ] Basic camera: follow player ship, zoom in/out
- [ ] Keyboard input: WASD mapped to logical actions
- [ ] CI pipeline: lint + type-check + test on push
- [ ] CLAUDE.md for the new project with coding standards

### Key Risks
- Phaser + Vite configuration edge cases (resolved by using official Phaser Vite template)
- TypeScript strict mode catches issues in Phaser's typings

### Done Criteria
- A colored rectangle moves on screen in response to keyboard input
- Camera follows the rectangle
- Tests run and pass in CI
- Hot reload works for code changes

### Design Docs Implemented
- None yet — this is infrastructure only

---

## Phase 1: Core Combat (Weeks 3–6)

### Deliverables
- [ ] **Movement System**: Full maneuver chart implementation. Player selects from available maneuvers, ship tweens along the path. All 10 maneuver directions + 5 speed levels
- [ ] **Ship Entity**: Stats (hull, shields, attack, agility), maneuver dial, actions
- [ ] **Combat System**: Attack dice, defense dice, focus, damage application. Pure function attack resolution
- [ ] **Stress System**: Red maneuvers add stress, green remove it, stressed ships restricted
- [ ] **Player Controls**: Maneuver selection UI (radial dial or list), fire button, action bar
- [ ] **Basic AI**: One Hegemony faction, 3 ship types (light fighter, heavy fighter, bomber). Utility AI with position scoring for maneuver selection
- [ ] **1v1 Combat**: Player ship vs single AI ship. Full attack/damage loop
- [ ] **Ship Rendering**: Placeholder sprites with runtime rotation, health bars, facing indicator
- [ ] **First playable**: Player controls a Confederation Phoenix fighter against a Hegemony Talon fighter

### Key Risks
- Maneuver template math: tabletop → screen coordinate translation. Mitigate by building a visual debug overlay showing maneuver paths
- Combat feel: dice-based combat may feel "random" in real-time. Mitigate by showing dice results briefly and adding impactful VFX/audio

### Done Criteria
- Player can select maneuvers from the dial and ship moves along the correct path
- Attacking deals correct damage (verified by unit tests against tabletop rules)
- AI opponent maneuvers, attacks, and dies when hull reaches 0
- Stress system prevents red maneuvers when stressed

### Design Docs Implemented
- `scifi_factions.md` — Confederation + Hegemony faction definitions (partial)
- `mechanical_changes.md` — Combat dice, damage system, basic faction abilities
- Unity `AI_MOVEMENT.md` — Maneuver system translation (position-based decision)
- Unity `COMBAT_WEAPONS.md` — Dice faces, damage types, attack resolution

---

## Phase 2: AI & Fleet Combat (Weeks 7–10)

### Deliverables
- [ ] **AI Director**: Fleet-level objective assignment for 5–15 ships
- [ ] **Utility AI Tuning**: Scoring functions for offensive, defensive, formation, objective positions
- [ ] **Fleet Battles**: Player + 4 AI allies vs 5 AI enemies. Full fleet combat
- [ ] **Target Priority System**: Role-based targeting (support ships first, then bombers, etc.)
- [ ] **Formation System**: Hegemony formation maintenance, Confederation loose coordination
- [ ] **Difficulty Scaling**: Apprentice through Ace difficulty profiles
- [ ] **Multiple Ship Roles**: Light fighter, heavy fighter, interceptor, bomber, support for 2 factions
- [ ] **Actions System**: Focus, Evade, Target Lock, Barrel Roll, Boost — all core actions
- [ ] **Minimap**: Tactical overview of battlefield positions
- [ ] **Fleet HUD**: Health bars for all friendly/enemy ships, target indicator

### Key Risks
- AI performance with 15 ships computing utility scores for ~15 maneuvers each. Mitigate: stagger AI decisions across frames (2–3 ships per frame), cache static calculations
- Fleet battles may be visually chaotic. Mitigate: distinct faction colors, clear HUD, camera zoom options

### Done Criteria
- 5v5 fleet battles play smoothly at 60fps
- AI ships exhibit distinct behaviors for different roles
- Hegemony AI visibly maintains formation
- Difficulty levels feel meaningfully different
- Player can direct their fleet's focus target

### Design Docs Implemented
- `scifi_factions.md` — Full Hegemony + Confederation rosters
- `special_abilities_distribution.md` — Core actions per role
- `mechanical_changes.md` — Faction passive abilities (formation discipline, heroic inspiration)

---

## Phase 3: Faction Identity (Weeks 11–14)

### Deliverables
- [ ] **All 5 Factions Playable**: Full ship rosters, unique color palettes, faction-specific AI behaviors
- [ ] **Faction-Exclusive Mechanics**:
  - Hegemony: Military Doctrine selection (pre-battle)
  - Confederation: Heroic Moment system (momentum → triggered effects)
  - Collective: Adaptive AI Protocols (learn from enemy behavior)
  - Corsairs: Reputation system (builds during battle, unlocks crew bonuses)
  - Empire: Bio-Evolution triggers (mid-battle stat changes)
- [ ] **Faction Resources**: Command Points, Inspiration, Processing Power, Reputation, Evolution Energy
- [ ] **Special Abilities**: Cloak, SLAM, Rotating Arc, Coordinate, Jam — distributed across factions per design docs
- [ ] **Faction-Specific AI Profiles**: Each faction's fleet AI uses radically different weight profiles
- [ ] **Aura System (Basic)**: Command auras and faction passive area effects
- [ ] **Asymmetric Victory Conditions**: Each faction can win through alternative paths

### Key Risks
- Balancing 5 factions is an enormous task for solo dev. Mitigate: implement automated simulation testing early. Build a headless "1000 battles" balance tester
- Faction-exclusive mechanics add significant code complexity. Mitigate: each mechanic is a self-contained system with a clean interface

### Done Criteria
- Each faction feels meaningfully different to play and play against
- Hegemony formations vs Collective swarms vs Corsair hit-and-run produce different battle dynamics
- Balance simulation shows no faction has >55% win rate against any other
- All 5 faction AI profiles produce distinct observable behaviors

### Design Docs Implemented
- `scifi_factions.md` — All factions
- `mechanical_changes.md` — All faction abilities and modifications
- `special_abilities_distribution.md` — Complete ability distribution
- `aura_abilities_system.md` — Aura definitions and faction-specific auras
- `advanced_mechanics.md` — Exclusive mechanics (doctrines, heroic moments, protocols, reputation, bio-evolution)

---

## Phase 4: Progression & Evolution (Weeks 15–18)

### Deliverables
- [ ] **Evolution System**: Ship XP gain, evolution path selection, stat changes, role transitions
- [ ] **Evolution Trees UI**: Visual tree display showing branching paths with requirements
- [ ] **Pilot System**: Named pilots with PS levels 1–9, specialization trees (Ace, Bomber, Support)
- [ ] **Faction Mastery**: Reputation progression (Recruit → Legend), unlock tiers
- [ ] **Campaign Act I**: 5 tutorial missions introducing mechanics, first evolution choice
- [ ] **Upgrade System**: Upgrade cards with point costs, faction-specific slots
- [ ] **Save System**: LocalStorage persistence for campaign progress, evolution choices, pilot XP
- [ ] **Ship Select Scene**: Squadron building with evolved ships, upgrade loadouts, point budgets
- [ ] **Results Scene**: Post-battle XP awards, evolution prompts, rewards

### Key Risks
- Evolution creates exponential content (79 ships × 3 tiers × upgrade variants). Mitigate: evolution changes stats and abilities, not sprites initially. Visual evolution tiers come in Phase 6
- Save data versioning is critical — breaking saves destroys player investment. Mitigate: version save schema from day 1

### Done Criteria
- A ship gains XP through combat and can evolve along a chosen path
- Evolution visibly changes the ship's stats and available actions
- Campaign Act I is playable start to finish with save/load
- Pilot specialization trees unlock meaningful combat bonuses

### Design Docs Implemented
- `evolution_mechanics.md` — All evolution trees and XP system
- `evolution_branching_paths.md` — Role transitions, evolution requirements
- `progression_systems.md` — Faction mastery, pilot development, achievements
- `mechanical_changes.md` — Point cost adjustments for evolved ships

---

## Phase 5: Advanced Systems (Weeks 19–22)

### Deliverables
- [ ] **Combination System**: Mechanical assembly (Hegemony), Bio-fusion (Empire), Digital integration (Collective), Parasitic attachment (Corsairs), Adaptive docking (Confederation)
- [ ] **Full Aura System**: All aura upgrades, range-based effects, visual indicators
- [ ] **Advanced AI**: Boss encounters with phased state machines, Collective swarm integration, combined ship AI
- [ ] **Environmental Interactions**: Asteroids, space stations, faction-influenced zones
- [ ] **Campaign Acts II–III**: Evolution-focused missions (Act II) and galactic war (Act III)
- [ ] **Asymmetric Victory Implementation**: Plunder, intimidation, assimilation, liberation, transcendence victory paths
- [ ] **Cross-Faction Unlocks**: Capture, defection, salvage mechanics

### Key Risks
- Combinations add another axis of complexity to an already complex system. Mitigate: implement only the 2–3 most interesting combinations per faction, not all 15
- Boss encounters need hand-crafted tuning. Mitigate: build a boss testing mode with phase-skip

### Done Criteria
- At least one combination type per faction works and feels impactful
- Boss capital ship encounter is playable and dramatic
- Aura effects visibly change battle dynamics (formation bonuses observable, swarm stacking visible)
- Campaign Acts II–III are playable

### Design Docs Implemented
- `fusion_symbiotic_ships.md` — All combination types
- `aura_abilities_system.md` — Full aura upgrade system
- `advanced_mechanics.md` — Environmental interactions, asymmetric victory

---

## Phase 6: Content & Polish (Weeks 23–28)

### Deliverables
- [ ] **All Ship Sprites**: 79 ships × 3 evolution tiers = 237 sprites generated via PixelLab
- [ ] **Weapon VFX**: Faction-specific laser colors, missile trails, explosions
- [ ] **Aura VFX**: Visual indicators for all aura types
- [ ] **Audio**: Faction weapon sounds, explosion layers, UI feedback sounds
- [ ] **Music**: Menu theme, 5 faction battle themes, victory/defeat stingers
- [ ] **UI Polish**: Faction-themed menus, transition animations, responsive layout
- [ ] **Campaign Act IV**: Procedural endgame content
- [ ] **Balance Pass**: Automated simulation (1000+ battles per matchup), manual tuning
- [ ] **Tutorial**: Interactive tutorial teaching movement, combat, evolution, faction mechanics
- [ ] **Skirmish Mode**: Quick battle setup with faction/difficulty selection

### Key Risks
- 237 sprites is a massive art production task. Mitigate: batch-generate using established PixelLab workflows. Accept "good enough" consistency over perfection. Placeholder sprites should remain until batch is done — don't art-polish one faction while others are rectangles
- Audio sourcing for a solo dev. Mitigate: use royalty-free game audio libraries (Soniss, Freesound) with procedural variation

### Done Criteria
- Every ship has a unique sprite that matches faction color palette
- Audio provides clear feedback for all combat actions
- A new player can learn the game through the tutorial without external docs
- Balance data shows all factions within 45–55% win range

### Design Docs Implemented
- `sprite_automation.md` — Visual pipeline, faction palettes, atlas generation
- `ai_sprite_generation_guide.md` — AI tool workflows
- `complete_ship_sprite_guide.md` — Every ship prompt, every VFX, every aura visual

---

## Phase 7: Launch Prep (Weeks 29–32)

### Deliverables
- [ ] **Electron Packaging**: Desktop builds for Windows/Mac/Linux
- [ ] **Performance Optimization**: Profiling, sprite batching, AI computation budgeting
- [ ] **Save System Hardening**: Migration support, corruption recovery, cloud-save-ready architecture
- [ ] **Browser Compatibility**: Chrome, Firefox, Safari, Edge testing
- [ ] **itch.io Deployment**: Public page with screenshots, description, controls
- [ ] **Playtesting Feedback Loop**: 5–10 playtesters, bug tracking, balance feedback
- [ ] **Settings Menu**: Resolution, audio volume, control rebinding, difficulty
- [ ] **Accessibility**: Colorblind-friendly faction identification, key rebinding, text scaling

### Key Risks
- Browser compatibility issues (Safari WebGL quirks, mobile performance)
- Electron packaging can bloat download size. Mitigate: code-split Phaser, compress assets aggressively

### Done Criteria
- Game runs at 60fps on a 3-year-old laptop in Chrome
- Electron builds install and run on Windows/Mac without issues
- itch.io page is live and playable
- Zero crash bugs in 10 hours of playtesting

---

# Section 7: MVP Definition

## The Minimum Viable Fun Product

The MVP must answer: **"Is 15 minutes of tactical fleet combat fun?"**

### Factions: 2 (Terran Hegemony + Free Confederation)

**Why these two:**
- They're the most accessible (military empire vs rebel heroes — instantly understandable)
- Their mechanics are the most straightforward (formations vs adaptive heroics)
- They're the "tutorial" factions in the campaign design
- Their AI behaviors are the easiest to implement (Hegemony = stay in formation; Confederation = protect allies)
- Their X-Wing Miniatures stat bases are the most battle-tested

### Ship Count: 8 (4 per faction)

| Role | Hegemony | Confederation |
|------|----------|---------------|
| Light Fighter | Storm Fighter | Stinger Fighter |
| Heavy Fighter | Talon Fighter | Comet Fighter |
| Interceptor | Raptor Interceptor | Vortex Interceptor |
| Bomber | Devastator Bomber | Meteor Bomber |

### Mechanics: MUST-HAVE vs CAN-WAIT

| Mechanic | Priority | Notes |
|----------|----------|-------|
| Movement charts (all 10 directions) | **MUST** | Core identity of the game |
| Combat dice (attack/defense/damage) | **MUST** | Core gameplay |
| Focus, Evade, Target Lock actions | **MUST** | Minimum tactical depth |
| Stress system | **MUST** | Movement restriction is key to skill expression |
| Barrel Roll, Boost | **MUST** | Repositioning = skill ceiling |
| Player controls 1 ship | **MUST** | This is the game |
| AI fleet (3–4 AI allies) | **MUST** | Fleet combat is the hook |
| AI enemy fleet (4–5 enemies) | **MUST** | Something to fight |
| 2 difficulty levels | **MUST** | Apprentice + Veteran |
| Formation Discipline (Hegemony passive) | **MUST** | Faction identity proof |
| Heroic bonuses (Confederation passive) | **MUST** | Faction identity proof |
| Ship evolution (1 tree, 1 branch) | **SHOULD** | Shows the progression hook |
| Cloak | CAN WAIT | Complex mechanic |
| SLAM | CAN WAIT | Complex mechanic |
| Coordinate/Jam actions | CAN WAIT | Support ship actions |
| Rotating Arc | CAN WAIT | Niche mechanic |
| Combination system | CAN WAIT | Phase 5 |
| Auras | CAN WAIT | Phase 3+ |
| Faction resources | CAN WAIT | Phase 3 |
| Campaign | CAN WAIT | Phase 4+ (skirmish is enough for MVP) |
| Pilot progression | CAN WAIT | Phase 4 |
| Save system | CAN WAIT | Not needed for "one battle" MVP |
| Upgrade cards | CAN WAIT | Phase 4 |
| Asymmetric victory | CAN WAIT | Phase 5 |
| 3 remaining factions | CAN WAIT | Phase 3 |

### Minimum AI Capability

- AI ships select maneuvers using utility scoring (not random)
- AI ships fire weapons when in range and arc
- AI ships use Focus action when appropriate
- Hegemony AI tries to maintain formation
- Confederation AI protects damaged allies
- AI Director assigns targets to fleet ships

### What Gets Stubbed

- **Sprites**: Colored geometric shapes with faction colors (triangle = fighter, diamond = interceptor, rectangle = bomber). Clear and functional
- **Audio**: Minimal. 1 laser sound, 1 explosion sound, 1 hit sound. No music
- **UI**: Functional but ugly. Health bars, maneuver dial, action buttons. No faction theming
- **Menus**: "Start Battle" button with faction/difficulty dropdowns. No campaign map
- **VFX**: Colored lines for lasers, white circle for explosions. No particles

---

# Section 8: Risk Assessment

## Top 10 Technical Risks

### 1. Scope Creep — The Design Docs are MASSIVE

**Risk Level:** CRITICAL
**Impact:** Project never ships. Solo dev drowns in features.

**The numbers:** 79 ships, 5 factions with unique mechanics, ~25 evolution trees, ~15 combinations, ~20 auras, 4 campaign acts, asymmetric victory conditions, pilot progression, faction mastery, crew system, doctrine system, bio-evolution...

**Mitigation:**
- **MVP is 2 factions, 8 ships, zero progression.** If the core combat loop isn't fun with colored rectangles, no amount of content will save it
- **Each phase has a "cut list."** If a phase runs over by 50%, cut the lowest-priority items and move on
- **What gets cut first (in order):**
  1. Combination system (Assembly/Fusion/Parasitic) — complex, can be post-launch
  2. Asymmetric victory conditions — standard elimination works fine
  3. Campaign Acts III–IV — Act I + skirmish is a full game
  4. Crew system (Corsairs-specific) — simplify to flat bonuses
  5. Environmental interactions — empty space is fine
  6. Cross-faction ship capture — nice to have, not essential

### 2. AI Behavior Complexity for Solo Developer

**Risk Level:** HIGH
**Impact:** AI is dumb, battles are boring, game fails at its core promise.

**Mitigation:**
- Start with the Unity prototype's lookup table approach. It works! Utility AI is an enhancement, not a requirement
- Implement AI difficulty as a weight multiplier on the utility scorer — not separate AI implementations per difficulty
- Faction AI differences are **data** (weight profiles), not **code**. One utility scorer handles all factions
- Build an AI debug overlay early: show scoring values, selected maneuvers, formation targets. You can't tune what you can't see
- Accept that "good enough" AI beats "perfect" AI that never ships

### 3. Performance with Many Sprites + AI Agents

**Risk Level:** MEDIUM
**Impact:** Frame rate drops in large battles, making the game feel sluggish.

**Details:** A 10v10 battle = 20 ships, each needing:
- Sprite rendering with rotation
- Health bar UI update
- AI decision each tick (for non-player ships)
- Aura range checks
- Attack range/arc calculations

**Mitigation:**
- **Rendering**: Phaser batches WebGL draw calls by texture atlas. 20 sprites from the same atlas = 1 draw call. Non-issue
- **AI**: Stagger decisions. Only 3–4 ships compute utility scores per frame. 60fps ÷ 20 ships = each ship decides every ~7 frames (still feels responsive)
- **Aura/Range checks**: Spatial hashing grid. O(n) neighbor lookup instead of O(n²) pairwise distance
- **Profile early**: Build FPS counter into dev HUD from Phase 0. Set a budget: AI ≤ 4ms, rendering ≤ 8ms, other ≤ 4ms per 16ms frame
- **Graceful degradation**: Reduce particle effects before reducing AI quality

### 4. Art Consistency Across 237 Sprites

**Risk Level:** HIGH
**Impact:** Factions look like they're from different games. Visual identity fails.

**Mitigation:**
- **Faction anchor sprites first.** Generate 3 reference sprites per faction that define the visual DNA. All subsequent sprites reference these
- **Batch by faction, not by role.** Generate all Hegemony ships in one session while the style is "warm" in the AI tool, then all Confederation, etc.
- **Post-processing pipeline**: Even if AI-generated sprites vary, apply consistent color correction per faction palette. ImageMagick scripts can enforce color consistency
- **Accept 80% consistency.** At 64×64px, players can't see subtle inconsistencies. Faction color scheme does 90% of the identification work
- **Runtime rotation means fewer sprites.** 237 sprites is manageable. 15,168 (with rotation frames) would not be

### 5. Movement Chart Translation (Tabletop → Real-Time)

**Risk Level:** MEDIUM
**Impact:** Movement doesn't "feel right" — too floaty, too snappy, or spatially wrong.

**The core challenge:** Tabletop X-Wing uses physical plastic templates. A "speed 3 bank left" has an exact physical shape. In digital, we must recreate this spatially AND make it feel good in real-time.

**Mitigation:**
- **Reference the tabletop templates exactly.** Measure the physical templates, normalize to a coordinate system, and encode the paths as Bezier curves
- **Tween duration matters.** Too fast = no sense of momentum. Too slow = game feels sluggish. Target: 0.5s for speed 1, 0.3s for speed 5
- **Visual debug overlay**: Show the maneuver path BEFORE execution (ghost trail). Players must see where they'll end up
- **Build a "maneuver sandbox" scene** for tuning movement feel before integrating with combat

### 6. Solo Developer Realistic Timeline

**Risk Level:** HIGH
**Impact:** Burnout, abandoned project.

**Reality check:** The roadmap is 32 weeks (~8 months). For a solo dev working evenings/weekends, that's optimistic.

**Mitigation:**
- **Phase 0–1 (6 weeks) is the real test.** If the core combat loop isn't fun by week 6, reconsider scope dramatically
- **Playable build at every phase.** Never go more than 4 weeks without something you can play. This prevents the "still building infrastructure" trap
- **Claude-assisted development is the multiplier.** Module-by-module development with clear TypeScript interfaces is ideal for AI pair programming. Realistically 2–3x velocity on boilerplate, data entry, and test writing
- **Budget 50% buffer.** If a phase estimate is 4 weeks, plan for 6. The roadmap's "32 weeks" is really "48 weeks" (about a year) with buffer
- **Ship content is the easiest to cut.** MVP with 8 ships is a complete game. Everything beyond that is content expansion

### 7. Browser Compatibility

**Risk Level:** LOW
**Impact:** Game doesn't work for some players.

**Mitigation:**
- Phaser 3 handles browser abstraction well. WebGL 1 is supported in all modern browsers
- Safari on iOS/macOS is the usual problem child. Test on Safari monthly starting Phase 2
- Set minimum browser requirements early (Chrome 90+, Firefox 90+, Safari 15+, Edge 90+)
- Canvas fallback is available in Phaser but shouldn't be needed

### 8. Data Volume — 79 Ships × Stats × Evolutions × Abilities

**Risk Level:** MEDIUM
**Impact:** Data entry errors break game balance, cause runtime crashes.

**Mitigation:**
- TypeScript `as const` + strict typing catches most errors at compile time
- Build a data validation test suite that runs on every commit:
  - Every ship has valid stats within defined ranges
  - Every evolution path references a real target ship
  - Every faction has the expected number of ships per role
  - Point costs are within expected ranges
- Data entry is an ideal task for Claude. Provide the design doc + TypeScript interface → generate ship definitions

### 9. Balance Testing at Scale

**Risk Level:** MEDIUM
**Impact:** One faction dominates, making 80% of content irrelevant.

**Mitigation:**
- **Headless simulation runner** from Phase 3 onward. Simulate 1000 battles between every faction pair, every difficulty level
- **Rock-paper-scissors design** is deliberate: Hegemony > Collective > Corsairs > Empire > Confederation > Hegemony. Verify this holds statistically
- **Point cost is the primary balance lever.** Ships that overperform get more expensive. Ships that underperform get cheaper. This is the tabletop-proven approach
- **Automated balance reports** after each content change. Flag any faction exceeding 55% win rate

### 10. Motivation & Decision Fatigue

**Risk Level:** HIGH
**Impact:** Solo dev gets stuck making design decisions instead of writing code.

**Mitigation:**
- **This document IS the decisions.** Framework: Phaser. Language: TypeScript. AI: Utility. Factions first: Hegemony + Confederation. Don't re-decide
- **Claude as decision partner.** When stuck on an implementation choice, describe the tradeoffs and ask for a recommendation. Don't spend 2 hours deliberating
- **"Good enough" over "perfect."** Ship it ugly, ship it fast, ship it with placeholder art. Polish is Phase 6, not Phase 1
- **Play your own game regularly.** Weekly playtests keep you connected to why you're building this

---

# Section 9: Development Workflow

## Claude-Assisted Development

### Module-by-Module Session Structure

Each coding session should focus on ONE module with a clear interface:

```
Session Template:
1. Tell Claude: "We're implementing [SystemName]. Here's the interface it must satisfy:
   [paste TypeScript interface]"
2. Tell Claude: "Here's the relevant design doc context:
   [paste relevant section from design docs]"
3. Tell Claude: "Here are the existing types it depends on:
   [paste from src/core/types.ts or src/data/]"
4. Build together, test, commit
```

### Systems That Benefit Most from AI Pair Programming

| System | AI Benefit | Why |
|--------|-----------|-----|
| **Data entry** (ship stats, evolution trees) | **Huge** | 79 ships × structured data. Claude can generate from design doc descriptions |
| **Unit tests** | **Huge** | Given a pure function, Claude writes excellent test cases |
| **Combat system** | **High** | Pure functions, clear input/output. Easy to specify and verify |
| **Movement system** | **High** | Math-heavy (rotations, Bezier curves). Claude is excellent at this |
| **AI scoring functions** | **High** | Utility functions with clear inputs. Easy to iterate |
| **UI components** | **Medium** | Phaser UI API is well-documented. Layout logic is straightforward |
| **Visual effects** | **Medium** | Particle emitter configs. Some experimentation needed |
| **Integration glue** | **Low** | System interconnection requires understanding the full picture |
| **Game feel tuning** | **Low** | Requires playing the game. Can't be AI-assisted effectively |

### Context Passing Strategy

Keep a `CLAUDE.md` at project root with:
- Current project structure
- Key TypeScript interfaces
- Which phase you're in
- Recent changes/decisions
- Known bugs

For each session, reference the specific design doc section relevant to that session's work. Don't dump all 12 documents — paste only the relevant 50-100 lines.

## PixelLab Sprite Generation Workflow

### Step-by-Step Process

**Step 1: Generate Faction Anchors (Day 1–2)**
```
For each faction:
1. Open PixelLab
2. Use the base style prompt from complete_ship_sprite_guide.md
3. Generate 10 variations of the faction's light fighter
4. Select top 3, iterate with refinement
5. Choose final anchor. Save prompt + settings
6. Generate heavy fighter and capital using same settings
7. Export 3 anchor sprites per faction = 15 total anchors
```

**Step 2: Batch Generate by Faction (Day 3–10)**
```
For each faction (2 days each):
1. Load faction anchor as style reference
2. Generate all base-tier ships (3-5 per faction)
3. Generate all evolved-tier ships (4-6 per faction)
4. Generate all elite-tier ships (2-3 per faction)
5. Generate capital ships
6. Quality check: do all ships read as same faction?
7. Re-generate any outliers using anchor reference
```

**Step 3: Post-Processing (Day 11–13)**
```
For each generated sprite:
1. Remove background (ensure clean alpha)
2. Resize to game resolution (64x64 or 96x96)
3. Apply faction color correction if needed
4. Verify silhouette readability at game zoom
5. Add to faction atlas source folder
```

**Step 4: Atlas Packing (Day 14)**
```
1. Run TexturePacker on each faction folder
2. Generate atlas JSON + spritesheet PNG
3. Import into Phaser project
4. Verify all sprites load correctly
5. Screenshot every ship at game zoom for reference sheet
```

### Quality Control Checklist
- [ ] Every ship in a faction uses the same color palette
- [ ] Ships are distinguishable from each other at 64×64
- [ ] Ships from different factions are distinguishable by color
- [ ] Evolution tiers show visible progression (base < evolved < elite)
- [ ] Capital ships are clearly larger than fighters
- [ ] Sprites have clean transparency (no halo artifacts)
- [ ] All sprites face the same default direction (up/north)

## Testing Strategy

### Unit Tests — Game Logic

```typescript
// tests/unit/systems/CombatSystem.test.ts
import { describe, it, expect } from 'vitest';
import { resolveAttack } from '../../../src/systems/CombatSystem';

describe('CombatSystem.resolveAttack', () => {
  it('should apply damage to shields before hull', () => {
    const context = createAttackContext({
      attackDice: 3,
      defenderShields: 2,
      defenderHull: 4,
    });
    // Seed RNG for deterministic results
    const rng = createSeededRng(42);
    const result = resolveAttack(context, rng);

    // With seed 42, we get specific dice results
    expect(result.shieldDamage).toBeLessThanOrEqual(context.defender.shields);
    expect(result.hullDamage + result.shieldDamage).toBeLessThanOrEqual(
      result.hitsLanded + result.critsLanded
    );
  });

  it('should never allow negative health', () => {
    // Property-based: run 1000 random attacks, verify no negative health
    for (let i = 0; i < 1000; i++) {
      const context = createRandomAttackContext();
      const result = resolveAttack(context, createSeededRng(i));
      const remainingHull = context.defender.hull - result.hullDamage;
      expect(remainingHull >= 0 || result.shipDestroyed).toBe(true);
    }
  });

  it('should grant range bonus at range 3', () => {
    const closeContext = createAttackContext({ range: 1 });
    const farContext = createAttackContext({ range: 3 });
    // At range 3, defender gets +1 defense die
    expect(farContext.defenseDice).toBeGreaterThan(closeContext.defenseDice);
  });
});
```

### AI Behavior Testing

```typescript
// tests/unit/ai/HegemonyAI.test.ts
describe('Hegemony AI - Formation Maintenance', () => {
  it('should score formation-maintaining maneuvers higher', () => {
    const context = createScoringContext({
      factionWeights: FACTION_WEIGHTS.terran_hegemony,
      allies: [/* 2 allies at Range 1 in formation */],
    });

    const formationManeuver = { direction: 'straight', speed: 2, difficulty: 'white' };
    const breakFormationManeuver = { direction: 'turn_left', speed: 3, difficulty: 'white' };

    const formationScore = scoreManeuver(formationManeuver, context);
    const breakScore = scoreManeuver(breakFormationManeuver, context);

    expect(formationScore).toBeGreaterThan(breakScore);
  });
});
```

### Balance Testing — Automated Simulation

```typescript
// tests/balance/SimulationRunner.ts
export async function runBalanceSimulation(config: SimulationConfig): Promise<BalanceReport> {
  const results: BattleResult[] = [];

  for (const [factionA, factionB] of allFactionPairs()) {
    for (let i = 0; i < config.battlesPerMatchup; i++) {
      const result = simulateHeadlessBattle({
        factionA,
        factionB,
        pointBudget: config.pointBudget,
        difficulty: 'veteran',
        maxTurns: config.maxTurns,
        rngSeed: i,
      });
      results.push(result);
    }
  }

  return generateReport(results);
}

// Expected output:
// Hegemony vs Confederation: 52% / 48% (within tolerance)
// Hegemony vs Collective: 55% / 45% (Hegemony advantage — by design)
// Collective vs Corsairs: 57% / 43% (Collective advantage — by design)
// etc.
```

---

## Cross-Document Contradictions & Gaps Found

### Contradictions

1. **Ship counts vary.** `scifi_factions.md` lists 80 ships total (17+16+15+15+17), `special_abilities_distribution.md` matrix totals 79. **Resolution:** Use the 79 count from the detailed role matrix — it's more carefully verified.

2. **Corsair Battleship stats.** `scifi_factions.md` says it uses "Aggressor alternate stats" (medium ship), but it's listed under Capital Ships. A capital ship on Aggressor stats would be underwhelming. **Resolution:** Treat as a medium-large gunship, not a true capital. The Pirate Mothership (C-ROC) is the real Corsair capital.

3. **"Comet Striker" appears in two places** with different base stats — once as B-Wing stats under Confederation fighters, once as an evolution target from Meteor Bomber. **Resolution:** These are the same ship. The Comet Striker IS the evolved Meteor Bomber that takes the B-Wing role.

4. **Ascendant Empire faction name.** Sometimes called "Ascendant Empire," sometimes just "Empire." The Hegemony is the human empire. **Resolution:** Always use "Ascendant Empire" to distinguish from the human Hegemony's imperial nature.

### Gaps

1. **No maneuver dials defined.** The design docs define ship stats but not which maneuvers each ship can perform at which speeds. **Action needed:** Define maneuver dials for all 79 ships. This can be derived from the X-Wing Miniatures base stats (each design doc ship maps to a tabletop ship with a known dial).

2. **No point budget for battles.** Campaign missions and skirmish need a point budget (e.g., 100 points, 200 points). The tabletop uses 100/200/300. **Recommendation:** 100 points for early campaign, 200 for standard skirmish, 300 for epic battles.

3. **Crew system (Corsairs) has no point costs.** Crew members are described but not costed. **Action needed:** Assign 2–8 point costs per crew member based on ability power level.

4. **No explicit cooldown/duration for faction resources.** Command Points, Inspiration, etc. generate per turn but max capacity and spending rules need mechanical specifics. **Action needed:** Define caps and spending costs during Phase 3 implementation.

5. **PixelLab is referenced but the actual tool is [pixellab.ai](https://www.pixellab.ai/).** The AI Sprite Generation Guide (`ai_sprite_generation_guide.md`) focuses on Midjourney, DALL-E, Stable Diffusion — not PixelLab specifically. **Resolution:** PixelLab should be evaluated against these alternatives. The workflow applies to any AI image generator. PixelLab's pixel-art specialization may make it the better choice for this project's style.

---

*This document is the development bible for Shattered Stars. It will be updated as implementation progresses and decisions are refined. Each phase completion should trigger a review of upcoming phases for scope adjustments.*
