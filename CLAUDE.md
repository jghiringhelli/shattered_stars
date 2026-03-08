# Shattered Stars - Project Guidelines

## Project Overview

Shattered Stars is a Phaser 3 tactical space combat game inspired by X-Wing Miniatures Game (TMG). It features multiple game modes (arcade, turn-based tactical, continuous tactical, campaign) with X-Wing style combat mechanics including dice rolling, actions, maneuvers, and upgrade cards.

## Tech Stack

- **Engine**: Phaser 3
- **Language**: TypeScript (strict mode)
- **Build**: Vite
- **Testing**: Vitest
- **Art Pipeline**: Stable Diffusion (A1111 WebUI) with stained glass LoRAs

## Code Style

- Use TypeScript strict mode with `exactOptionalPropertyTypes`
- Prefer `readonly` for immutable data
- Use explicit return types on exported functions
- Follow existing patterns in the codebase
- Keep systems modular and testable

## Commit Policy

**Commit after completing each major phase of work:**

1. After implementing a new system (e.g., OrdnanceSystem, TurretSystem)
2. After fixing a batch of related bugs
3. After adding tests for a feature
4. Before switching to a different task area
5. After refactoring a module

**Commit message format:**
```
type: Short description

Longer explanation if needed.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

## Key Systems

### Combat Systems (src/systems/)
- **CombatSystem.ts** - Dice rolling, damage resolution
- **ActionsSystem.ts** - Focus, Evade, Barrel Roll, Boost, etc.
- **TargetingSystem.ts** - Arc checking, range, line of sight
- **MovementSystem.ts** - Maneuver templates and execution
- **OrdnanceSystem.ts** - Missiles, torpedoes, bombs, mines
- **TurretSystem.ts** - Turret arcs and rotation
- **PilotAbilities.ts** - Pilot talents and triggered abilities
- **UpgradeSystem.ts** - Upgrade slots and shop
- **SquadBuilder.ts** - X-Wing TMG style squad building
- **FlightControlSystem.ts** - Momentum-based arcade flying
- **PerformanceSystem.ts** - Adaptive quality for large battles

### Data (src/data/)
- **ShipDefinitions.ts** - All ship stats and configurations
- **ModeBalancing.ts** - Per-mode stat adjustments

### Core Types (src/core/)
- **types.ts** - ShipState, ManeuverDefinition, etc.
- **errors.ts** - Typed error handling

## Factions

| ID | Name | Playstyle |
|----|------|-----------|
| `terran_hegemony` | Terran Hegemony | Elite, expensive ships |
| `free_confederation` | Free Confederation | Balanced, versatile |
| `synthetic_collective` | Synthetic Collective | Swarm tactics, drones |
| `void_corsairs` | Void Corsairs | Fast raiders, hit-and-run |
| `ascendant_empire` | Ascendant Empire | Heavy shields, support |

## Ship Roles

- `light_fighter` - Cheap, fast, low durability
- `heavy_fighter` - Balanced combat ships
- `interceptor` - Very agile, pursuit focused
- `bomber` - Slow, ordnance-heavy
- `gunship` - Tanky, high firepower
- `support` - Buffs, coordination, command
- `capital` - Huge ships (epic format only)

## Testing

Run tests before committing:
```bash
npm test -- --run
```

All tests must pass. Current: 403 tests.

## Development Workflow

1. Create a todo list for complex tasks
2. Implement incrementally, testing as you go
3. Run type checking: `npx tsc --noEmit`
4. Run tests: `npm test -- --run`
5. Commit completed phases
6. Update CLAUDE.md if adding major systems

## Art Generation

See `specs/sd/SD_Claude_Code_Setup_Guide.md` for Stable Diffusion setup.

Output directories:
- `public/sprites/ships/` - Ship sprites by faction
- `public/sprites/effects/` - Weapon effects, explosions
- `public/sprites/ui/` - Interface elements

## Known Issues

- Vite build has HTML proxy issue (TypeScript compiles fine)
- Some faction balance needs tuning (see balance tests)

## Next Steps

- Ship loadout system with pre-configured upgrade builds
- Pilot cards for all 18 ships
- Epic ship support (huge size)
- Multiplayer networking
