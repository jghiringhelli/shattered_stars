# Changelog

All notable changes to Shattered Stars are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/) (pre-releases: `-alpha.n`, `-beta.n`, `-rc.n`).
Release procedure: [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md#releases).

## [Unreleased]

## [0.2.0-beta.1] - 2026-10-15

First public beta. Seeded from the git history (208 commits since 2026-03-07), grouped by area.

### Added

- **Flight and combat**: one X-Wing-style 500 ms maneuver cycle engine for every battle mode, with stress,
  Snap Turn / Hook Loop / Knife Roll, barrel roll and boost; one real-time combat model (x4 durability,
  ordnance x2 so it is strong but never a one-shot); arcs, lock-on, turrets, bombs and mines.
- **Modes**: Skirmish (classic, reinforcement pools, teams), Epic / Boss Raid, Scenarios (Satellite Array,
  Chance Engagement, Salvage, Scramble), Dogfight, Ace Duel, Continuous Tactical, Flight School.
- **Survival roguelite**: seeded sector maps, shop, repair dock, relics, meta-progression, daily run and
  creature bosses (Cinder Wyrm, Deepmaw, Choir-Hive).
- **Campaign**: StarCraft II-style real-time campaign with objectives, scripted missions, hero powers,
  armory, research, hub mission graph and interlocked acts per faction.
- **Online**: relay server (Fly.io / Render ready), deterministic 60 Hz lockstep netcode, lobby, quick match,
  reconnection window; online Dogfight, Skirmish, Scenario and Reinforcements.
- **AI**: skill-tier `BotPilot` and `SquadCommand` (squad mark) bots shared by every mode, with piloting
  skill gates as tests.
- **Content**: five factions with identity levers, every pilot and upgrade card with a real-time effect,
  quick builds for every hull, one price scale, a full codex (Encyclopedia + Bestiary).
- **Presentation**: holographic menus and HUD kit, painted space maps with seamless torus wrap and nine
  themes, ship overlay with repair feedback, Suno-sourced soundtrack with ACE-Step faction tracks.
- **Accessibility and input**: unified action-intent input (keyboard, gamepad, touch), key rebinding,
  colour-blind palettes, settings tabs, bound-key prompts.
- **Telemetry and balance**: local match stats viewer, real-engine balance harness and report,
  tempo experiments, headless telemetry battery.
- **Tooling**: fast pre-commit hook (staged type-check, lint, related tests), code-quality ratchet
  (`npm run quality`), offline import-cycle check, sharded CI with e2e, nightly balance/coverage jobs,
  release workflow, Dependabot, CSP, i18n message-catalog layer.

### Changed

- Code-split build: the main chunk shrank from 1.68 MB to about 260 kB; every scene except boot, menu and
  settings loads on first use (`src/scenes/lazy`). First menu load: 5.12 MB to 3.72 MB.
- Space no longer pauses battles; Survival is softer (warned belt, free wingman, boss/elite rework).
- Relay defaults are safe: `ALLOWED_ORIGINS` is required in production, `TRUST_PROXY` defaults to off.

### Fixed

- Rendering: ship images keep their size when art replaces the placeholder; alpha-clean sprites.
- Input: shared-key and same-frame press/release bugs, dead gamepad plugin, touch boost drop.
- Scenes: input released on shutdown, Dogfight restarts clean; HUD guards on end screens.
- Combat: AI targeting and hit-testing respect the toroidal wrap.

### Security

- Content-Security-Policy and referrer policy for the static build (`<meta>` plus `_headers`).
- Relay: process-level crash handlers, no wildcard CORS on `/healthz`.

## [0.1.0] - 2026-03-07

Early prototype: Phaser 3 skeleton, squad builder, first dogfight scene, discrete turn-based engine
(removed in 0.2.0).

[Unreleased]: https://github.com/jghiringhelli/shattered_stars/compare/v0.2.0-beta.1...HEAD
[0.2.0-beta.1]: https://github.com/jghiringhelli/shattered_stars/releases/tag/v0.2.0-beta.1
[0.1.0]: https://github.com/jghiringhelli/shattered_stars/releases/tag/v0.1.0
