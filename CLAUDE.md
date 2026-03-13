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

All tests must pass. Current: 1450 tests (82%+ line coverage).

## Development Workflow

1. Create a todo list for complex tasks
2. Implement incrementally, testing as you go
3. Run type checking: `npx tsc --noEmit`
4. Run tests: `npm test -- --run`
5. Commit completed phases
6. Update CLAUDE.md if adding major systems

## Art Generation

All Stable Diffusion generation **must** go through the shared queue server. Do NOT call Forge directly.

### SD Queue Server (port 8010)

**Endpoint**: `http://127.0.0.1:8010`

Submit a job:
```
POST /jobs
{
  "project":  "shattered-stars",
  "endpoint": "/sdapi/v1/txt2img",
  "priority": 5,
  "payload":  { ...Forge txt2img payload... }
}
→ { "job_id": "abc123" }
```

Poll for completion:
```
GET /jobs/{job_id}
→ { "status": "pending|running|succeeded|failed",
    "result": { "images": ["base64..."], "info": "..." } }
```

When `status == "succeeded"`, consume `result.images[0]` (base64 PNG).
When `status == "failed"`, read `result.error`.

**Script**: `scripts/sd_queue.py` wraps this API with a local file-based job
tracker so multiple scripts can batch-submit without stepping on each other.
Use `submit_and_start_worker(jobs)` from other scripts.

### Model / LoRA

- Checkpoint: `dreamshaper_8.safetensors` (default; loaded at session start)
- Portrait LoRA: `concept_art` @ 0.60
- Pass checkpoint overrides in `payload.override_settings.sd_model_checkpoint`

### Output directories

- `public/assets/portraits/<faction>/` — pilot portrait PNGs (512×768)
- `public/assets/ships/<faction>/` — ship sprite PNGs
- `public/sprites/effects/` — weapon effects, explosions
- `public/sprites/ui/` — interface elements

## Known Issues

- Some faction balance needs tuning (see balance tests)
- SurvivalScene starting ship is hardcoded to confed_falcon
- ArcadeBattleScene ship roster is hardcoded (no faction select yet)

## Next Steps

- Ship faction/loadout select screen for ArcadeBattleScene
- Pilot cards for all 18 ships
- Epic ship support (huge size)
- Multiplayer networking
