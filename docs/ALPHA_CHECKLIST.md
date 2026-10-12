# Alpha Checklist

Built from four evidence-based audits (core gameplay, content, balance, release) on
2026-10-11. Each item is tracked to done; blockers first.

## Blockers

| Item | Status |
|---|---|
| Secondary weapons (missiles, torpedoes, turrets, cannons, bombs/mines, cloak) work in every battle mode, for the player and the AI | In progress (core combat) |
| Survival "Regenerating" elites unkillable — regen multiplied ×12 (also relics, campaign armory/research) | In progress (core combat) |
| Public playable build (GitHub Pages + CI) | Ready to ship: CI and Pages workflows are in place; push and enable Pages per docs/RELEASE.md (user) |
| Online works for normal players: hosted relay, real shared battles, no drift | In progress (online) |

## Major

| Item | Status |
|---|---|
| Shooting/targeting across the torus edge in every mode | In progress (core combat) |
| Stress blocks every red special/action; capital/huge ships respect their dial/action bar | In progress (core combat) |
| Boss Raid real firing arcs (not 360°) | In progress (core combat) |
| One damage model: shield spill-over, armor/stress rules, range bands, aiming, HLC/Stealth Device double count | In progress (core combat) |
| Skirmish: wingmen/enemies get their loadouts; bombs dropped (not fired); missiles need a target; cloak only for cloak ships | In progress (core combat) |
| Faction aura bonuses in every squad mode; 5 no-op pilot abilities implemented | In progress (core combat) |
| Role pricing (agility undervalued: gunships 84% vs interceptors 11%) | After core combat (balance pass) |
| Free Confederation / Albatross; Void Corsairs in reinforcements | After core combat (balance pass) |
| Ace Duel presets lopsided; duel builds with unusable gear | After core combat (balance pass) |
| Underpriced/no-op upgrades; dominated stat-identical ships | After core combat (balance pass) |
| Scenarios too short in Classic; enemy bias on objectives; Easy too strong | After core combat (balance pass) |
| Difficulty curve cliff (Normal → Hard), Brutal ≈ Hard | After core combat (balance pass) |
| CI balance tests on the real engine (not the old dice simulator); ordnance/turrets/auras simulated | After core combat (balance pass) |
| Black screen when storage is blocked/full | Done: every read and write goes through a store that never throws, with a session-only fallback and a banner (e2e: storage-blocked) |
| 110 MB before the menu; 34 MB unreferenced assets shipped | Done: the menu loads only its own images; other art loads per scene or on demand; 52 MB of unreferenced art moved to art-archive/ |
| Settings from pause renders under the battle; keyboard/gamepad cannot quit a battle | Done in all 7 battle scenes (e2e: pause-flow) |
| No music files (synth fallback, 404 on menu music) | In progress (music: menu + tactical/combat per faction) |
| LICENSE, honest credits (Stable Diffusion art, ACE-Step music), non-affiliation disclaimer | Done (LICENSE, credits scene, README, THIRD_PARTY_NOTICES) |

## Minor

| Item | Status |
|---|---|
| Gamepad defaults for specials; consistent ESC in pause menus | Done: boost, K-turn, Segnor, Tallon, barrel roll, cloak and crew are on the pad; ESC toggles every pause menu |
| Version + build id in game and in bug reports | Done: version, SHA and date are shown in the menu and included in bug reports and telemetry exports |
| `npm run lint` (ESLint 9 config), README/playtest docs, ignore e2e output folders | Done: lint passes with 0 errors and runs in CI |
| 47 pilots and 12 upgrade cards unreachable (no quick build / no slot); `force_power` slot without cards | Planned (content pass) |
| Card text vs effect mismatches; dial vs top speed on 18 ships | Planned (content pass) |
| Encyclopedia covers ships only | Planned (content pass) |
| Survival node length (~15 s) — re-measure after core combat | Planned |
| No collisions, obstacles or critical hits in any mode (design decision) | Open |

## Verified working

- Flight in every mode: throttle, drift/bank/turn, K-turn, Segnor, Tallon, boost, barrel roll, torus wrap.
- One attack per 500 ms cycle with per-attacker hit immunity; ×12 durability.
- Piloting gates: expert beats novice ≥ 85% in every pair; coordinated average squad beats solo experts ≥ 70%.
- 5 factions × 7 roles, 101 ships with art, dials, slots and valid pricing; 217 valid quick builds.
- Campaign hero powers, armory, research; Survival relics, mutations, events, affixes wired.
- 0 console errors in a scripted tour of every mode; flat memory over restarts; 60 FPS in the largest battles (integrated GPU).
- Corrupt/old saves never block boot; Flight School offered on first launch.
