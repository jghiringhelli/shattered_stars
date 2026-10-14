# Alpha / beta checklist

Started from four evidence-based audits (core gameplay, content, balance, release) on 2026-10-11 and re-run for the public test on **2026-10-14** (build `v0.1.0 BETA`, working tree on top of commit 88ed1f5). Blockers first. "Verified" means checked in this pass; "Carried" means it was reported done by the earlier audits and was not re-checked today.

## Public test go/no-go

**Recommendation: GO for a limited public beta (a link shared with testers, feedback through GitHub), once the owner items below are done. NO-GO for wide promotion until the "Before promoting widely" items are closed.**

### Owner actions required before the link goes out

| # | Action | Why |
|---|---|---|
| 1 | Confirm the Suno plan covered each generation date of the 13 shipped Suno tracks (free-tier output is non-commercial) | Music rights; see [THIRD_PARTY.md](THIRD_PARTY.md) |
| 2 | Verify the Civitai licence ("may sell generated images") of the `concept_art`, `scifi_style`, `alien_species` and the stained-glass LoRAs actually used; list which LoRA made the shipped art | AI-art licence risk; the credits claim about `concept_art` may be inaccurate |
| 3 | Decide online: ship the beta **offline-only** (leave `VITE_ONLINE_URL` empty; the lobby then explains and offers offline play) or deploy the relay per [RELEASE.md](RELEASE.md) and set `ALLOWED_ORIGINS` | No relay is deployed |
| 4 | Push `release`, enable Pages, set the Actions variables, create the issue labels (`bug`, `balance`, `ui-ux`, `enhancement`) | Nothing is published yet |
| 5 | Bump `package.json` version for the public build (corner tag now reads `v0.1.0 BETA`) | Testers must be able to name the build |
| 6 | Read the new texts once (README, PRIVACY, TESTER_GUIDE, KNOWN_ISSUES, in-game welcome) | They state what the game stores and sends |

### Gate results (2026-10-14)

| Gate | Result |
|---|---|
| `npm run lint`, `tsc --noEmit` (src and `tsconfig.tests.json`) | Clean |
| Vitest unit + balance + simulation | 395 files, 6078 tests passed (run before the last small edits; feedback, welcome, lobby and survival tests re-run green after) |
| `npm run test:skill` (piloting gates) | 25 passed (gate 1 expert ≥ 85 % in every pair, gate 2 coordinated squad ≥ 70 %) |
| `npm run build` + `scripts/measure_first_load.ts` | First menu **5.11 MB** in 14 requests (6.06 MB with menu music); target < 10 MB; whole `dist/` 110 MB |
| Scripted tour of all 12 menu scenes (each restarted once) + Flight School + `verify:loop` (5 battle scenarios) | 0 page errors, 0 "Texture key already in use", INV-6b/6c clean; the only console error is the dev build's default relay `ws://localhost:8080` being down |
| Playwright full suite | 651 tests: 626 passed on the first run, 15 failed. Rerun individually: 12 were flakes or mine and are fixed or green (see below); **3 still fail** (below) |
| Browsers (Chromium, Firefox 146, WebKit 26, each Canvas and WebGL) | Smoke 6/6 on dev and on the production preview (`tests/e2e/cross-browser.spec.ts`, `BROWSERS=all`) |
| FPS, real Intel UHD, production-style build, 25 s each | Menu 60; Epic 40 ships avg 58.6 (1 % low 30); Survival + 40 enemies 54.4 avg (60 on a headed run); creature boss 53.8; campaign with torus cameras and parallax 54.0; software GL (SwiftShader) 12–28 FPS |

**Still failing in Playwright (not caused by this work):** `flight-school › completed with real inputs` (the spec's Hook lesson uses Shift+Q, but the in-progress input rework changed the Hook binding to Hold Z + ←/→), and `BOSS RAID` in `game-modes-tour` and `sortie-briefing` (the Boss Raid setup screen is being reworked by the pick-UI work). Re-run them when those changes land; do not tag a release with them red. Fixed in this pass: the touch-control specs (the new "phones are not supported" notice covered the controls; the specs now start as a player who dismissed it), the telemetry-stats spec (it assumed VIEW STATS was the last Settings button), the compat/cross-browser specs (they spoof a normal browser and so got the new welcome).

### Before promoting widely (not needed for a limited beta)

- No auto-pause when the tab loses focus (the simulation does not race ahead on return, but the fight continues). Needs one `pauseIfRunning()` per battle scene; the scenes' pause is a toggle and online battles cannot pause.
- Phones/tablets unsupported (notice only): touch lacks squad mark, target and weapon cycling, and the HUD is tiny.
- Epic Format is CPU-heavy on weak machines (Phaser Graphics triangulation about 25 %, text redraw about 11 %); a catch-up cap now prevents the death spiral (1.6 → 4.4 FPS at 4× throttle).
- Online has never run against a hosted relay; the protocol version is being bumped by the input rework, so deploy the relay and game together.
- A single Playwright run is not yet green end to end (see above).

## Blockers

| Item | Status |
|---|---|
| Public playable build (GitHub Pages + CI) | Partial. Workflows exist; today's audit found `pages.yml` had two `env:` blocks in the Build step (the second would have dropped `VITE_ONLINE_URL`/`VITE_GAME_BUILD`); fixed and `VITE_FEEDBACK_URL` added. Needs push and Pages setup (owner) |
| Feedback path for testers | Done: SEND FEEDBACK (menu footer, pause menu, Settings › Advanced), redacted bundle, prefilled GitHub issue or `VITE_FEEDBACK_URL`, 4 issue templates; privacy stated in game, README and PRIVACY.md. Unit tests (bundle, redaction, link, effects) + e2e |
| First-run welcome for testers | Done: once per browser, reopenable (TESTER INFO), Flight School / feedback / known issues / privacy links |
| Online works for normal players | Partial. Relay builds (`npm run build:server`) and `/healthz` answers; lobby/battle e2e pass; lobby now explains unreachable / version-mismatch / full server and offers PLAY OFFLINE INSTEAD. No hosted relay yet |
| Music and AI-art licences | Open (owner): see go/no-go items 1-2 |
| Unsupported browser shows a black screen | Done: blocking notice with minimum versions, Canvas fallback with banner, WebGL-boot failure restarts on Canvas |
| Black screen when storage is blocked/full | Done (e2e: storage-blocked) |
| 110 MB before the menu | Done: first menu 5.11 MB |

## Major

| Item | Status |
|---|---|
| Secondary weapons (missiles, torpedoes, turrets, cannons, bombs/mines, cloak) in every mode | Verified: `secondary-weapons.spec.ts` passes in all 7 battle scenes |
| Difficulty curve (Normal → Hard cliff, Brutal ≈ Hard) | Verified with `docs/balance/latest.md`: Easy ≈ 80 %, Normal ≈ 50 %, Hard ≈ 30 %, Brutal ≈ 15 % in dogfight, ace, classic, reinforced; scenario Hard is 14 % (steep) |
| Faction balance | Partial: squad totals mostly 45-55 %, some pairings and Free Confederation / Synthetic totals still outside the band (see the report) |
| Torus shooting, stress rules, boss arcs, one damage model, skirmish loadouts, auras, pilot abilities | Carried from the earlier audits as implemented; not re-verified today |
| Role pricing, Ace Duel presets, underpriced upgrades, scenario length | Carried: balance pass; the report still marks some ✘ |
| Settings from pause renders under the battle; keyboard/gamepad cannot quit | Done in all 7 battle scenes (e2e: pause-flow) |
| Music files | Done: 17 tracks ship (13 Suno, 4 ACE-Step); synth drone as fallback |
| LICENSE, honest credits, non-affiliation disclaimer, third-party notices | Done: credits, README, LICENSE, THIRD_PARTY_NOTICES, [THIRD_PARTY.md](THIRD_PARTY.md); "Wing Commander" power renamed "Squadron Marshal" |

## Minor

| Item | Status |
|---|---|
| Version + build id in game, in bug reports and in feedback bundles | Done: `v0.1.0 BETA · sha · date` |
| Lint, README, playtest docs | Done; README now has requirements, controls, modes, feedback, privacy |
| Auto-pause on tab blur | Open (see above) |
| Pilots/cards unreachable by quick builds | Believed done (reach gate test `QuickBuildReach` is in the unit suite and passes); card-text accuracy not re-audited |
| Encyclopedia covers ships only | Being reworked by the pick-UI work |
| No collisions, obstacles or critical hits | Design decision |
| `src/services/ImageGenerator.ts` (dev art helper that calls `localhost:7860`) is imported by nothing | Open: delete it (not bundled today) |

## Verified working (this pass)

- Boot on Chromium, Firefox and WebKit, Canvas and WebGL; resize from 800×600 to 2560×1080 and mid-battle; no memory growth after 10 scene restarts (heap −29 % to +2 %, textures +2/+3).
- Tour of every menu scene and the battle modes with no console errors; audio starts only after the first interaction.
- Corrupt/old saves never block boot; Flight School is recommended in the welcome.
- Interlocked campaigns, hero powers, Survival systems, piloting gates (see the gate table).
