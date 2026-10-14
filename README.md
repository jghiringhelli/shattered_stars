# Shattered Stars

Real-time tactical space combat in the browser: squads, upgrades and five factions, flown on a 500 ms maneuver dial inspired by classic tabletop starfighter games. A free-to-play **public beta**: expect bugs, and please tell us about them.

**[Play the beta →](https://jghiringhelli.github.io/shattered_stars/)** _(placeholder: the link goes live after the first deploy of the `release` branch, see [docs/RELEASE.md](docs/RELEASE.md))_. New here? Read the [tester guide](docs/TESTER_GUIDE.md): what to try and a 20-minute test plan.

## System requirements

- A desktop or laptop browser: **Chrome or Edge 90+, Firefox 90+, or Safari 15+**, with WebGL (Canvas is the slower fallback).
- A keyboard (a gamepad works too). **Phones and tablets are not supported** in this beta.
- A 1280×720 or larger window; any GPU from the last ~8 years for most modes (integrated graphics hold 60 FPS in the largest battles we measured; Epic Format is the heaviest mode).
- About 5 MB to reach the main menu (6 MB once the menu music starts); each mode downloads its art when first used (about 110 MB for the whole game). Online play needs a network connection to the relay; everything else works offline once loaded.

## Feedback

Press **SEND FEEDBACK** (main-menu footer, pause menu, Settings › Advanced). The game saves a small feedback file (version, settings, recent local events, browser/GPU/FPS and your note) and opens a prefilled GitHub issue; you drag the file in. You can also [open an issue directly](https://github.com/jghiringhelli/shattered_stars/issues/new/choose) (bug report, balance, UI/UX, feature idea). **Nothing is sent automatically**, the file is created only when you press a button and holds no personal data. Details: [docs/PRIVACY.md](docs/PRIVACY.md). Site owners can point the button at a form with `VITE_FEEDBACK_URL` (see [.env.example](.env.example)).

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
- **Online** (beta): matches through a relay server, see [MULTIPLAYER.md](MULTIPLAYER.md) and [docs/ONLINE.md](docs/ONLINE.md). When the server is down the lobby says so and offers to play offline.

## Controls

These are the defaults. Rebind keys and gamepad buttons in **Settings › Controls / Gamepad**. The in-game **Controls** screen always shows your current bindings.

| Action | Keyboard | Gamepad (Xbox layout) |
|---|---|---|
| Steer | ← / → | Left stick |
| Throttle up / down | ↑ / ↓ | Left stick |
| Primary weapon | Automatic | Automatic |
| Maneuver key (specials the arrows cannot reach) | Z | LT |
| Snap turn (180°) | Tap Z · or double-tap ↓ | Tap LT · or right stick flick ↓ |
| Hook loop | Hold Z + ← / → | Hold LT + left stick ← / → |
| Knife roll | Double-tap Z, hold ← / → | Double-tap LT, hold left stick ← / → |
| Boost | Double-tap ↑ | A |
| Barrel roll | Double-tap ← (roll left) or → (roll right) | Double-flick the left stick to one side · or right stick flick ← / → |
| Hard turn | Q / E | LB / RB |
| Fire secondary / drop bomb | Shift+Space | X |
| Cycle secondary weapon | Tab | D-pad ↓ |
| Mark target for your squad | R | R3 |
| Cloak | C | D-pad ↑ |
| Crew role (pilot → gunner → commander) | G | Back / View |
| Hero powers (Campaign) | V / B | Y / L3 |
| Commander orders (capitals) | 1–4 | LT / RT / D-pad ← / → |
| Pause | Esc / P / Space | Start |
| Menus | ↑ ↓ ← → / Tab, Enter, Esc | D-pad, A, B |

Specials (Snap turn, Hook, Knife) and actions (boost, barrel roll) work only if they are on your ship's dial / action bar; a stressed pilot cannot fly red maneuvers or perform actions (X-Wing rules) — the HUD says why a key was refused. Capital ships fly none of them, which is why the gamepad commander orders share LT (the Maneuver button), RT and the left/right D-pad buttons.

Gestures are built so ordinary play never triggers them by accident: a barrel roll needs two quick taps of the *same* arrow (alternating ← → is plain steering, and if the roll is recharging, stressed or not on your ship the taps just steer); the Maneuver key does nothing until you tap it (Snap turn) or add a side while holding it. On a touchscreen the left stick rolls with a double-tap on its left/right half, and the MNVR button beside the fire zone is the Maneuver key (tap · press and drag ← / → · double-tap then drag ← / →).

**Gunner Mode** (large/huge ships with a turret upgrade): ← / → aim the turret by hand; it fires at whatever lies along its aim. The ship keeps flying its current maneuver.

The pause menu works with the keyboard (↑/↓, Enter) and the gamepad (D-pad, A). Esc or B closes the quit confirmation, and Esc closes Settings and returns you to the pause menu.

## Known issues

See [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md). To report a bug or give feedback, use **SEND FEEDBACK** (see Feedback above).

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
  compat/         # Browser support checks, unsupported-browser and phone notices
  feedback/       # Feedback bundle, redaction, issue link (user-initiated only)
  telemetry/      # Local-only telemetry log (never uploaded)
  ui/             # HUD and menu components
tests/
  unit/           # Vitest unit tests (mirrors src/ structure)
  e2e/            # Playwright browser tests
  balance/        # Balance analysis suite
art-archive/      # Unshipped art kept in git
```

## Credits

- Created by Juan Carlos Ghiringhelli. Much of the code was written with AI coding assistants (Anthropic Claude, GitHub Copilot) under the developer's direction.
- **Art:** generated with Stable Diffusion (SDXL 1.0 and DreamShaper 8 checkpoints with community LoRAs), run through Forge and ComfyUI. Models and licences: [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md).
- **Music:** most tracks were made by the author with [Suno](https://suno.com). The additional Synthetic Collective and Ascendant Empire faction tracks were generated with ACE-Step via Harmonia. **Sound effects:** synthesized in real time.
- **Libraries:** Phaser 3, seedrandom and immer (all MIT). Their notices are in [public/THIRD_PARTY_NOTICES.txt](public/THIRD_PARTY_NOTICES.txt).

**AI disclosure:** the game's art and music are AI-generated (art with Stable Diffusion, music with Suno and ACE-Step), and much of its code was written with AI assistance. The developer prompted, selected and integrated every asset.

Third-party models, licences and the music-rights checklist are in [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md).

**Disclaimer:** Shattered Stars is an independent fan game inspired by the X-Wing Miniatures Game. It is not affiliated with, endorsed, sponsored or approved by Lucasfilm Ltd., The Walt Disney Company, Atomic Mass Games or Fantasy Flight Games. Star Wars, X-Wing and related names are trademarks of their respective owners. The factions, ships and characters in this game are original.

## License

Proprietary. © 2026 Juan Carlos Ghiringhelli, all rights reserved. The game is free to play, but you may not redistribute or modify it without permission. See [LICENSE](LICENSE).