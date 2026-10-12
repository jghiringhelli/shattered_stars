# Shattered Stars

Real-time tactical space combat in the browser: squads, upgrades and five factions, flown on an X-Wing-style 500 ms maneuver dial. A free-to-play **alpha**.

**[Play the alpha →](https://jghiringhelli.github.io/shattered_stars/)** (GitHub Pages; the link goes live after the first deploy of the `release` branch, see [docs/RELEASE.md](docs/RELEASE.md)).

## Factions

| Faction | Playstyle |
|---|---|
| Terran Hegemony | Elite ships, expensive but durable |
| Free Confederation | Balanced and versatile |
| Synthetic Collective | Swarm tactics, drone coordination |
| Void Corsairs | Fast raiders, hit-and-run |
| Ascendant Empire | Heavy shields, support-focused |

## Game Modes

All modes are real time, on the same flight and combat model.

- **Skirmish**: build a squad and fight an AI squad. You fly the flagship and AI wingmen fly the rest.
- **Survival**: a roguelite run across a sector map, with waves, elites, bosses, relics and a daily challenge.
- **Epic Format**: large fleet battles, with huge ships and reinforcements.
- **Boss Raid**: your squad against a capital-ship boss.
- **Dogfight**: 1v1 rounds.
- **Ace Duel**: named-pilot matchups.
- **Campaign**: story missions for each faction, with pilots who level up, hero powers, an armory and debriefs.
- **Flight School**: a guided tutorial. The game recommends it on first launch.
- **Online** (alpha): matches through a relay server, see [MULTIPLAYER.md](MULTIPLAYER.md).

## Controls

These are the defaults. Rebind keys and gamepad buttons in **Settings › Controls / Gamepad**. The in-game **Controls** screen always shows your current bindings.

| Action | Keyboard | Gamepad (Xbox layout) |
|---|---|---|
| Steer | ← / → | Left stick |
| Throttle up / down | ↑ / ↓ | Left stick |
| Primary weapon | Automatic | Automatic |
| K-turn (180°) | Z | Right stick flick ↓ |
| Boost | Double-tap ↑ | A |
| Barrel roll | ← and → together (direction of the second key) | Right stick flick ← / → |
| Hard turn | Q / E | LB / RB |
| Segnor loop | Shift+Q / Shift+E | D-pad ← / → |
| Tallon roll | T / Shift+T | LT / RT |
| Fire secondary / drop bomb | Shift+Space | X |
| Cycle secondary weapon | Tab | D-pad ↓ |
| Mark target for your squad | R | R3 |
| Cloak | C | D-pad ↑ |
| Crew role (pilot → gunner → commander) | G | Back / View |
| Hero powers (Campaign) | V / B | Y / L3 |
| Commander orders (capitals) | 1–4 | LT / RT / D-pad ← / → |
| Pause | Esc / P / Space | Start |
| Menus | ↑ ↓ ← → / Tab, Enter, Esc | D-pad, A, B |

Specials (K-turn, Segnor, Tallon) and actions (boost, barrel roll) work only if they are on your ship's dial / action bar; a stressed pilot cannot fly red maneuvers or perform actions (X-Wing rules) — the HUD says why a key was refused. Capital ships fly none of them, which is why the gamepad commander orders share the Tallon triggers and the Segnor D-pad buttons.

**Gunner Mode** (large/huge ships with a turret upgrade): ← / → aim the turret by hand; it fires at whatever lies along its aim. The ship keeps flying its current maneuver.

The pause menu works with the keyboard (↑/↓, Enter) and the gamepad (D-pad, A). Esc or B closes the quit confirmation, and Esc closes Settings and returns you to the pause menu.

## Known issues

See [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md). To report a bug, use **REPORT A BUG** in the main menu or the pause menu. It opens a pre-filled GitHub issue that includes your build, settings and the last few local telemetry events.

## Running Locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev                  # dev server at http://localhost:3000
npm run lint                 # ESLint (flat config, src/)
npx tsc --noEmit             # type-check
npx vitest run tests/unit tests/balance tests/simulation   # unit tests (what CI runs)
npm run test:e2e             # Playwright E2E (starts its own server on :3003)
npm run build                # production build -> dist/
```

The game also runs when browser storage is blocked or full. Progress then lasts only for the session, and a banner says so.

## Building and Releasing

`npm run build` produces a static site in `dist/`. Set `BASE_PATH=/<repo>/` when building for a GitHub Pages project site; the default relative base works on any static host.

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs lint, type-check, unit tests and the build on every push and pull request. Pushing to the `release` branch deploys to GitHub Pages ([.github/workflows/pages.yml](.github/workflows/pages.yml)). The step-by-step guide is [docs/RELEASE.md](docs/RELEASE.md).

Loading: the first menu loads only about 2 MB of art. Ship sprites, portraits, backdrops and encyclopedia art load per scene, with a progress bar (see `src/assets/`). Art that no code references lives in [art-archive/](art-archive/README.md) and is not shipped. To re-check, run `npx tsx scripts/audit_assets.ts`.

## Tech Stack

- **Engine**: [Phaser 3](https://phaser.io/)
- **Language**: TypeScript (strict mode)
- **Build**: Vite
- **Tests**: Vitest (unit) + Playwright (E2E)
- **Lint**: ESLint 9 + typescript-eslint

## Project Structure

```
src/
  arcade/         # Real-time flight, weapons, AI pilots
  assets/         # Asset manifest, per-scene preload plans, lazy texture loading
  campaign/       # Campaign hub, missions, save schema
  core/           # Shared types and arcade flight model
  data/           # Ship definitions, loadouts, credits, balance data
  input/          # Input manager, adapters, default bindings
  rendering/      # Ship visuals, effects
  scenes/         # Phaser scenes (MainMenu, battles, Survival, Campaign, …)
  systems/        # Persistence, progression, settings, combat systems
  telemetry/      # Local-only telemetry log + bug-report diagnostics
  ui/             # HUD and menu components
tests/
  unit/           # Vitest unit tests (mirrors src/ structure)
  e2e/            # Playwright browser tests
  balance/        # Balance analysis suite
art-archive/      # Unshipped art kept in git
```

## Credits

- Created by Juan Carlos Ghiringhelli. Much of the code was written with AI coding assistants (Anthropic Claude, GitHub Copilot) under the developer's direction.
- **Art:** generated with Stable Diffusion: the DreamShaper 8 checkpoint plus concept-art and stained-glass LoRAs, run through Forge and ComfyUI.
- **Music:** most tracks were made by the author with [Suno](https://suno.com). The additional Synthetic Collective and Ascendant Empire faction tracks were generated with ACE-Step via Harmonia. **Sound effects:** synthesized in real time.
- **Libraries:** Phaser 3, seedrandom and immer (all MIT). Their notices are in [public/THIRD_PARTY_NOTICES.txt](public/THIRD_PARTY_NOTICES.txt).

**AI disclosure:** the game's art and music are AI-generated (art with Stable Diffusion, music with Suno and ACE-Step), and much of its code was written with AI assistance. The developer prompted, selected and integrated every asset.

**Disclaimer:** Shattered Stars is an independent fan game inspired by the X-Wing Miniatures Game. It is not affiliated with, endorsed, sponsored or approved by Lucasfilm Ltd., The Walt Disney Company, Atomic Mass Games or Fantasy Flight Games. Star Wars, X-Wing and related names are trademarks of their respective owners. The factions, ships and characters in this game are original.

## License

Proprietary. © 2026 Juan Carlos Ghiringhelli, all rights reserved. The game is free to play, but you may not redistribute or modify it without permission. See [LICENSE](LICENSE).