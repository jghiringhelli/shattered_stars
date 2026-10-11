# Professionalization Plan

How Shattered Stars closes the gap with the games players will compare it to.
Built from a survey of comparable titles (sources linked inline). Each item has
acceptance criteria; the status column tracks delivery.

## Reference games — what we take from each

| Game | Practice we adopt |
|---|---|
| [Star Wars: Squadrons](https://squadrons.fandom.com/wiki/HUD) | Segmented shields, redundant audio + visual state changes, off-screen threats folded into the radar, one deep settings surface. |
| [X-Wing Miniatures 2.0 scenarios](https://www.atomicmassgames.com/xwing-docs/) | Control-based scoring (more ships in range; medium/large count double), carry-and-drop salvage (dropped on boost / barrel roll / destruction), first-to-threshold wins. |
| [X-Wing / TIE Fighter / X-Wing Alliance](https://www.gdcvault.com/play/1034651/Classic-Game-Postmortem-Star-Wars) | Primary + bonus objectives, escort missions with explicit fail states (never more than 3 critical escorts), briefing → mission → debrief loop with consequences. |
| [StarCraft II: Wings of Liberty](https://liquipedia.net/starcraft2/Campaign) | Hub with non-linear mission choice, Armory + Research with mutually exclusive permanent picks, hero abilities, every mission a different mechanic. |
| [FTL](https://ftl.fandom.com/wiki/Sectors) | Typed sector node graph, text events with risk/reward, resources that persist between fights. |
| [Slay the Spire](https://deepwiki.com/silverua/slay-the-spire-map-in-unity/2.2-node-structure-and-types) | Legible branching map with node-type icons, relic archetypes with visible synergies, ascension levels. |
| [Hades](https://saschb2b.github.io/game-mechanics/games/hades/systems/game-overview/) | Opt-in Heat modifiers, meta-progression that advances on every run (win or lose). |
| [Nova Drift](https://steamcommunity.com/sharedfiles/filedetails/?id=2491186336) | Mid-run "mutations": mutually exclusive behaviour changes, not stat deltas. |
| [Everspace 2](https://gamesfuze.com/guides/everspace-2-ultimate-perks-and-attributes-guide/) | Free respec on non-run-defining progression. |
| [Galak-Z](https://grokipedia.com/page/galak_z_the_dimensional) | Coordinating AI; stealth/evasion as a legitimate alternative to fighting. |
| [Into the Breach](https://media.gdcvault.com/gdc2019/presentations/Into%20the%20Breach%20Postmortem%20Final.pdf) | Telegraph enemy intent wherever the game asks for a tactical read. |
| [Rebel Galaxy Outlaw](https://saveorquit.com/2019/10/04/review-rebel-galaxy-outlaw/) | "Juice" on every interaction — but only on top of a consistent navigation model. |
| [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/full-list/) / [IGDA GA-SIG](https://igda-gasig.org/get-involved/sig-initiatives/resources-for-game-developers/sig-guidelines/) | Rebinding, colorblind modes, never color-only state, separate volume buses. |

## Already delivered

- Holographic HUD kit: radar with off-screen edge arrows, status ring, mark reticle (`src/ui/hud/`).
- Combat tempo on the X-Wing round model: one attack per cycle, per-attacker hit immunity, ×12 durability, ×10 ordnance.
- Piloting skill gates (`npm run test:skill`): an expert beats a novice ≥ 85% in every sampled pair (even with a +30% ship), a coordinated average squad beats equal points of solo experts ≥ 70%.
- One AI for every mode: skill-tier BotPilots flying through the player's controls, squads with focus fire and the squad mark (R), mark assist for the player's wingmen.
- Key-combo telemetry battery proving every maneuver and special fires from the documented keys.

## P0 — must-have for a professional feel

| # | Item | Acceptance criteria | Status |
|---|---|---|---|
| P0-1 | Per-ship hull/shield overlay with repair feedback | Readable within 200 ms of a hit; shield segments; damage vs repair cues visually distinct; repair drones from the source ship; never color-only. | In progress (overlay workstream) |
| P0-2 | Flight School tutorial | Scripted steps that verify real inputs (throttle, cycle steering, specials, fire, mark, radar), shows the bound key, skippable, completion persisted. | In progress (polish workstream) |
| P0-3 | Accessibility & settings | Full rebinding with conflict detection, 3 colorblind modes through theme tokens, separate master/music/SFX/UI volumes, flash/shake reduction, text size. | In progress (polish workstream) |
| P0-4 | Local telemetry | Privacy-respecting local event log (mode start/end/outcome, deaths, tutorial drop-off, errors) with export; external playtest cadence before each mode ships. | In progress (polish workstream) |
| P0-5 | Menu juice & consistency | Hover + press feedback (visual + audio) on every control, transitions ≤ 400 ms, one back affordance everywhere. | In progress (polish workstream) |

## P1 — second wave

| # | Item | Acceptance criteria | Status |
|---|---|---|---|
| P1-1 | Survival as a full roguelite | Branching sector map (≥ 5 node types), relic archetypes with synergy tags, ascension, meta-unlocks on every run, run save/resume, run history, seeded runs, final boss. | In progress (survival workstream) |
| P1-2 | Campaign like StarCraft II | Hub with ≥ 2 missions open, Armory + Research with exclusive choices, hero active powers (V / B), ≥ 4 mission archetypes beyond "destroy all", bonus objectives, persistent consequences, completion state. | In progress (campaign workstream) |
| P1-3 | X-Wing 2.0 scenario mode | ≥ 2 of Satellite Array / Chance Engagement / Salvage / Scramble with real-time scoring, objective state on HUD + radar, carried salvage visible and dropped on boost / roll / death, score threshold or time limit. | Done — all 4 scenarios: Squad Builder › SCENARIO picker → `battleConfig.scenario`; rules in `src/arcade/scenarios/`, scene glue in `src/scenes/scenario/` (6 s rounds = DURABILITY_SCALE cycles, control range 400 px = range 0–1, first to 20 or 5 min) |
| P1-4 | Escort / bonus-objective archetype | Escort HP on HUD/radar, ≥ 3 wingman orders, immediate clear failure, ≤ 3 critical escorts. | In progress (campaign objectives, reusable in `src/arcade/objectives/`) |
| P1-5 | Ranked seasons + daily challenges (online 1v1) | Placement matches, soft reset, widening MMR tolerance, ≥ 3 daily challenges. | Planned |

## P2 — differentiation

| # | Item | Acceptance criteria | Status |
|---|---|---|---|
| P2-1 | Role / synergy hints | Every pilot ability and upgrade card shows a one-line "best with" or role hint. | Planned |
| P2-2 | Mutations in Survival | ≥ 2 systems with a mutually exclusive behaviour branch, described as a behaviour change. | In progress (survival workstream) |
| P2-3 | Stealth / evasion | Bots can lose track of a cloaked or out-of-sight player; some encounters can be bypassed. | Planned |
| P2-4 | Briefing atmosphere | Terse, mood-driven briefings with a music stinger before every sortie. | Partly (campaign hub) |
| P2-5 | UI / art cohesion audit | Menus, icons and fonts share the HUD's holographic language. | Planned |

## Red flags we check before every release

1. Color-only state signaling (shield down, lock, low hull) — always pair with shape, icon or text.
2. Hidden enemy intent in tactical moments — telegraph it.
3. Irreversible non-run choices without respec (campaign armory respec is free; research choices are the deliberate exception).
4. A cockpit HUD without a tutorial.
5. A "roguelite" without map choices, relics or meta-progression.
6. A campaign that is just skirmishes in a row.
7. Juice on top of inconsistent navigation.
8. Missing settings granularity (rebinding, volumes, colorblind).
9. Shipping without telemetry or external playtests.
10. Ranked play bolted on late.
