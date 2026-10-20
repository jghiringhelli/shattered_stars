# Roadmap and tracking list

Source: professionalization audit 2 (2026-10-14, ids in brackets: H hooks, C CI, A architecture, D determinism,
S security, R repo, T tests, I i18n, P performance, G lint). Status as of 2026-10-15.
Pre-pivot planning documents are archived in the repository root (`ROADMAP.md`, `specs/`); this file is the live plan.

Legend: [x] done, [ ] open.

## Done in the tooling / CI / professionalization pass

- [x] Pre-commit hook rebuilt: staged `tsc` x2 + ESLint + related tests + ratchet, parallel (H-1, H-2)
- [x] Quality ratchet with `scripts/quality-baseline.json` and `npm run quality` (H-2)
- [x] CI: static, 4 unit shards, integration, skill gates, build + first-load budget, e2e x4, cross-browser, audit (C-1, C-2)
- [x] Nightly: balance report, telemetry battery, coverage, full skill matrix
- [x] `CHANGELOG.md`, semver 0.2.0-beta.1, `release.yml`, Dependabot, `.nvmrc`, `engines` (C-3, partly)
- [x] Code splitting: lazy scenes, main chunk 1.68 MB to 0.26 MB, first menu 5.12 MB to 3.72 MB (P-1)
- [x] CSP + referrer policy + `_headers`; relay defaults (origins required in production, `TRUST_PROXY=false`,
      no wildcard CORS on `/healthz`, process crash handlers) (S-1, S-2)
- [x] i18n layer + the welcome and feedback dialogs migrated, extraction report (I-1, groundwork)
- [x] ADR-0006 battle scene split plan (A-1, A-2: plan only)

## Days 0-30: gates and hygiene

- [ ] Make `ci` a required status check (`pages.yml` already depends on it; enable branch protection)
- [ ] Untrack `.mcp.json` and `.claude/settings.local.json`; `.mcp.json.example` (S-5)
- [ ] Move `art-archive/` and tracked screenshots out of git (551 MB `.git`), then `git filter-repo` once (R-1)
- [ ] Doc cull: archive pre-pivot docs (`specs/`, duplicates), `docs/README.md` index, CLAUDE.md counts from a script (R-3)
- [ ] Delete the dead files and tool-only modules (D-4); root clutter (R-2)
- [ ] ESLint ratchets: `max-lines`, `max-params`, `complexity` as warnings with a baseline; lint `server/` and `tests/` (G-1)
- [ ] Determinism: lint ban on `Math.random`/`Date.now` in `src/{arcade,net,systems,core,simulation}`; two matches in one page
      compared by hash (D-1, D-2)
- [ ] `importSquad` and `PlayerProfile` schema validation (S-3)
- [ ] Move `tsx`/`@types/seedrandom` to devDependencies, drop `happy-dom` (S-4)
- [ ] SECURITY.md, CODEOWNERS, PR template (C-3)
- [ ] Replace the 250 `waitForTimeout` calls in e2e with state polling, starting with the 10 slowest (T-1);
      nightly `--repeat-each=5` for them
- [ ] Settings: language selector once a second locale exists (I-1)

## Days 31-60: structure

- [ ] ADR-0006 steps 1-3: `WeaponsService`, `ShipStatusView`, `PauseController` (A-2)
- [ ] ADR-0006 steps 4-5: shared flight AI, `DamageService`, `BattleSession` for Survival, then Campaign, Epic (A-1, A-2)
- [ ] Coverage for scenes/ui: include them with a low floor and ratchet (A-3)
- [ ] Bundle budget gate (main chunk < 600 kB, per-chunk limits) and a visualizer report in CI (P-1)
- [ ] Lazy-load the Settings tabs and the encyclopedia data (finish P-1)
- [ ] 79 MB of PNG: WebP/KTX2 pass, atlas for UI (P-1)
- [ ] fast-check suites: protocol codec, `ArcadeControls`, `CombatSystem`, squad share code (T-2)
- [ ] One working Stryker config (threshold >= 60 %) on `src/arcade`, `src/systems`, `src/net`, nightly (T-2)
- [ ] Client crash reporting (opt-in) and relay `/metrics` with room-scoped log ids (O-1)
- [ ] Reduced-motion setting and an `aria-live` announcer (I-2)
- [ ] i18n: migrate the main menu, pause menu, results and Settings (see I18N.md order)

## Days 61-90: scale and polish

- [ ] ADR-0006 step 6: Arcade/Epic on the shared core, online adapter, lockstep hash comparison old vs new
- [ ] Split `SquadBuilder.ts`, `ShipDefinitions.ts`, `ShipLoadouts.ts`; remove `EventBus`, `GameClock`, `GameStore` (A-1)
- [ ] Parameter objects for the 51 functions over 5 parameters, split all functions over 100 lines (P-3, P-4)
- [ ] i18n: data text by domain into `locales/en/*.json`, `es` for UI and tutorial first, font fallbacks, ESLint rule for
      literals in `.text(` calls
- [ ] Focus-order audit of menus, ADR for localisation and accessibility decisions (I-2)
- [ ] Release train: weekly tagged alpha builds from `release`, rollback drill, relay blue/green with the build-id handshake

## Ideas (not scheduled)

- **Crew stations on epic ships.** A player flying an epic ship can cycle between stations with one key:
  **pilot** (flies), **commander** (activates orders that spend energy), **engineer** (per-cycle actions that
  move energy between weapons, shields, systems and engine) and **gunner** (turrets). Some epic ships carry
  small craft inside, with "launch" as a commander action; with AI they act as a defence escort. Inside the
  ship they regenerate hull and shields, so they must be small and cheap. Needs: station model per ship
  card, energy budget rules, input mapping (keyboard, gamepad, touch), online input word bits, balance pass.
- **Packaged builds (Steam / Switch).** Art downloads on demand only for the web build; a packaged build
  ships everything together (no lazy art, no relay requirement for offline modes).
