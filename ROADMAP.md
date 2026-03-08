# Shattered Stars - Development Roadmap

## Current Status
- ✅ Core Systems (Movement, Combat, Targeting, Actions, Turn)
- ✅ AI System (Utility-based with 5 faction personalities + 4 difficulty levels)
- ✅ Ship Definitions (20 ships across 5 factions)
- ✅ Arcade Controls (Real-time gameplay)
- ✅ Image Generator Service (SD API integration ready)
- ✅ Menus & UI (Main menu, settings, credits, lobby, pause, game over)
- ✅ Visual Polish (Ship graphics, effects, parallax backgrounds)
- ✅ Audio (Procedural sound effects and music via Web Audio API)
- ✅ Balance & Testing (Headless simulation framework with stats and reports)
- ✅ Skirmish Mode (Squad building with point limits, AI difficulty selection)

---

## Phase 5: Ships & Factions Deep Dive

### 5.1 Faction Identity
Each faction needs distinct:
- **Visual Style**: Ship silhouettes, color schemes, engine effects
- **Playstyle**: Aggressive/defensive, swarm/elite, close/ranged
- **Special Mechanics**: Unique abilities or tokens

| Faction | Theme | Playstyle | Special |
|---------|-------|-----------|---------|
| Terran Hegemony | Military discipline | Balanced, formation-based | Coordinate action bonus |
| Free Confederation | Rebel guerrillas | Hit-and-run, evasive | Boost after attack |
| Synthetic Collective | Hive mind machines | Swarm tactics, expendable | Shared targeting data |
| Void Corsairs | Space pirates | Aggressive, close-range | Intimidate (stress) |
| Ascendant Empire | Ancient mystics | Elite, force powers | Precognition (rerolls) |

### 5.2 Ship Classes (per faction)
- **Fighter** (3): Balanced all-rounder
- **Interceptor** (2): Fast, fragile, high agility
- **Bomber** (4): Slow, heavy firepower, low agility
- **Support** (3): Buffs allies, debuffs enemies
- **Capital** (5): Large, powerful, slow to maneuver

### 5.3 Balance Considerations
- Run headless simulations for balance testing
- Track win rates per faction/ship combo
- Adjust stats based on simulation data
- Consider point costs for squad building

---

## Phase 6: Game Modes

### 6.1 Arcade Mode ✅
- Endless waves of enemies
- Score-based progression
- Power-ups and upgrades
- Leaderboards

### 6.2 Skirmish Mode ✅
- ✅ Squad building with point limits (SquadBuilderScene)
- ✅ Multi-faction battles (2-6 factions)
- ✅ Victory conditions: elimination
- ✅ AI difficulty levels (Easy, Normal, Hard, Brutal)

### 6.3 Campaign Mode
- Story-driven missions
- Branching narrative based on faction
- Persistent pilot progression
- Unlockable ships and upgrades

### 6.4 Multiplayer (Future)
- Local co-op
- Online PvP
- Ranked matchmaking

---

## Phase 7: Menus & UI

### 7.1 Main Menu
- Play (mode selection)
- Hangar (ship customization)
- Settings
- Credits

### 7.2 Ship Selection
- Faction filter
- Ship stats display
- 3D/2D ship preview
- Loadout customization

### 7.3 In-Game HUD
- Ship status (hull, shields, tokens)
- Minimap
- Score/objectives
- Cooldown indicators
- Target info

### 7.4 Pause Menu
- Resume
- Restart
- Settings
- Quit to menu

### 7.5 Game Over Screen
- Score summary
- Stats (kills, damage, time)
- Replay option
- Return to menu

---

## Phase 8: Visual Polish

### 8.1 Ship Graphics
- Procedural vector ships (fallback)
- SD-generated sprites (when available)
- Faction-specific color schemes
- Damage states (visual degradation)

### 8.2 Effects
- Engine trails
- Weapon projectiles (per faction style)
- Shield impacts
- Explosions (ship size based)
- Screen shake

### 8.3 Environment
- Parallax starfield
- Nebula backgrounds
- Asteroid fields
- Space stations

### 8.4 UI Effects
- Damage indicators
- Kill notifications
- Combo counters
- Achievement popups

---

## Phase 9: Audio

### 9.1 Sound Effects
- Weapon fire (per weapon type)
- Explosions
- Shield hits
- Engine sounds
- UI interactions

### 9.2 Music
- Menu theme
- Combat music (dynamic intensity)
- Victory/defeat stings
- Faction-specific themes

---

## Phase 10: Balance & Testing

### 10.1 Headless Simulation
- Run thousands of AI vs AI battles
- Track statistics per ship/faction
- Identify outliers
- Auto-generate balance reports

### 10.2 Metrics to Track
- Win rate per faction
- Average survival time per ship
- Damage dealt vs taken ratios
- Action usage frequency
- Maneuver preference patterns

### 10.3 Balance Levers
- Hull/shield values
- Attack/agility stats
- Action bar composition
- Maneuver dial options
- Special ability cooldowns

---

## Phase 11: Art Generation (SD)

### 11.1 Setup Requirements
- Stable Diffusion WebUI with API
- DreamShaper XL Lightning model
- LoRAs: scifi_style, concept_art, alien_species, etc.

### 11.2 Asset Pipeline
1. Generate style anchors per faction
2. Generate ship sprites (4 per ship class)
3. Generate backgrounds and environments
4. Generate UI elements
5. Post-process for consistency

### 11.3 Generation Prompts
See `src/services/ImageGenerator.ts` for faction-specific prompts

---

## Immediate Next Steps

1. **Get SD running** - Create venv, install dependencies
2. **Procedural ship graphics** - Vector-based fallback
3. **Main menu** - Basic navigation
4. **Skirmish mode** - Squad building
5. **Balance simulation** - Headless testing framework

---

## Technical Debt

- [ ] Add proper error boundaries
- [ ] Implement save/load system
- [ ] Add settings persistence
- [ ] Optimize rendering for many ships
- [ ] Add proper logging system
- [ ] Consider WebGL shaders for effects

---

## Test Coverage Goals

- Unit tests: 90%+ for core systems
- E2E tests: All user flows
- Balance tests: Automated simulation runs
- Performance tests: Frame rate benchmarks
