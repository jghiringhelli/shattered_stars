# Shattered Stars

Tactical arcade space combat — squads, upgrades, five factions. Inspired by X-Wing Miniatures but built for the browser.

**[Play the game →](https://jghiringhelli.github.io/shattered_stars)**

## Factions

| Faction | Playstyle |
|---|---|
| Terran Hegemony | Elite ships, expensive but durable |
| Free Confederation | Balanced and versatile |
| Synthetic Collective | Swarm tactics, drone coordination |
| Void Corsairs | Fast raiders, hit-and-run |
| Ascendant Empire | Heavy shields, support-focused |

## Game Modes

- **Arcade** — real-time dogfighting with full squad; player pilots flagship, AI flies wingmen
- **Survival** — wave-based endurance with upgrade progression
- **Campaign** — story-driven battles across faction storylines
- **Online** — P2P WebSocket multiplayer (local server required)
- **Dogfight** — 1v1 quick match

## Controls (Arcade Mode)

| Key | Action |
|---|---|
| ↑ / ↓ | Increase / decrease speed |
| ← / → | Turn |
| Z | K-Turn (180° flip) |
| SPACE | Fire selected weapon |
| TAB | Cycle weapons (laser → missiles → …) |
| G | Toggle Gunner Mode (large ships with turret) |
| ESC | Pause |

**Gunner Mode** (large/huge ships with a turret upgrade): ← / → rotates the turret, SPACE fires it. The ship autopilots on its current heading.

## Tech Stack

- **Engine**: [Phaser 3](https://phaser.io/)
- **Language**: TypeScript (strict mode)
- **Build**: Vite
- **Tests**: Vitest (unit) + Playwright (E2E)

## Running Locally

```bash
npm install
npm run dev          # dev server at http://localhost:5173
npm test -- --run    # unit tests
npm run test:e2e     # Playwright E2E
npx tsc --noEmit     # type-check only
```

## Building for Deployment

```bash
npm run build        # outputs to dist/
```

The `dist/` folder is a static site — drop it on GitHub Pages, Vercel, or Netlify.

## Project Structure

```
src/
  arcade/         # Arcade-mode pure systems (ordnance, turrets)
  core/           # Shared types and arcade flight model
  data/           # Ship definitions, loadouts, balance data
  rendering/      # Starfield and visual helpers
  scenes/         # Phaser scenes (MainMenu, ArcadeBattle, Survival, …)
  services/       # NetworkService (P2P WebSocket)
  simulation/     # Headless balance simulator
  systems/        # Combat, targeting, flight, upgrade systems
  ui/             # Reusable HUD components
tests/
  unit/           # Vitest unit tests (mirrors src/ structure)
  e2e/            # Playwright browser tests
  balance/        # Balance analysis suite
```

## License

MIT
