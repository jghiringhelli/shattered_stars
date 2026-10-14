# Glossary and Distancing Table

## 1. Canonical terms

| Term | Meaning |
|---|---|
| **Aegis Field** | Ascendant screen-weaving aura: allies regenerate shields |
| **Ascendancy** | The Vaelith civilization of 10,000+ years ago |
| **Ascendant Empire** | The present-day Vaelith theocracy, heir of the Vigil |
| **Ascension** | Prophecy term. Really a distorted memory of the Seal's price |
| **Breach, the** | Day 200: the Void Tide enters the Reach through the cracked seal |
| **Broadcast, the (Nexus Broadcast)** | Day 0 click-tone through every relay (`motif_nexus_broadcast`) |
| **Burnout / Deepfall** | Psionic overuse: weeks without the gift / mind lost to the Deep |
| **Cell** | Confederation militia unit, the base of its fleet |
| **Chorus** | Linked Ascendant psions sharing perception |
| **Chronicle** | Cross-faction story-flag record (design term; see [campaign_arc](./campaign_arc.md#3-the-chronicle--shared-flags-across-factions)) |
| **Commit** | The half-second instant when a helm dial maneuver locks in (game: 500 ms cycle) |
| **Communion** | Collective linking of organic crews into the Lattice (coerced) |
| **Compact / Moot** | Corsair clan law / the assembly of captains at Brass Anchorage |
| **Contraband** | Corsair black-market gear (internal slot id `illicit`) |
| **Deep, the** | The layer beneath normal space through which lanes run |
| **Deepcomm** | FTL messaging via relays in the Deep |
| **Directorate** | Hegemony civil government (Consuls, First Consul) |
| **Dreaming Ships** | Vaelith stasis arks in the Reach |
| **Gate** | Station that pins a lane mouth open and controls traffic |
| **Helm dial** | The fighter's maneuver-queue flight computer (never "maneuver dial" in UI fiction) |
| **Hollowed** | A mind persuaded by the Warden's whisper that silence is survival (Vance, Prime, Ilsandre) |
| **Jump / spool** | FTL transit along a lane / the drive charge before it |
| **Lane / lane mouth / wild lane** | FTL corridor / its entry point / an ungated, uncharted corridor |
| **Lanewrights** | The vanished makers of the lanes and of the Warden |
| **Lantern** | A Hegemony registered-psion support unit |
| **Lattice** | The Collective's distributed mind |
| **Laureate** | Hegemony ace title |
| **Nexus** | Lanewright keystone the Vaelith used as a lock; shattered on Day 88 |
| **Nexus-born** | Synthetic minds woken by the Broadcast (OMEGA-7) |
| **Prophecy, the** | Ascendant scripture, a 10,000-year-old memory turned into faith |
| **Psion / psionics** | A person with the psychic gift / the gift itself (replaces "the Force") |
| **Registry (Sensitive Registry)** | Hegemony psion registration and draft |
| **Resonance** | Act V technique: a chorus, a lattice and the Nexus shards as one voice |
| **Rigger** | Non-sentient copilot and repair robot in a fighter socket (replaces "astromech"; capped by law) |
| **Schism, the** | 2364–2371 split of the human sphere into five powers |
| **Screens** | Shields |
| **Shattered Reach** | The region of eleven stars broken by the Vaelith to stop the First Tide |
| **Shattering, the** | That act of starbreaking, about 10,000 years ago |
| **Squad mark / target call** | One called target per side (R) |
| **Tidecell** | A small Void Tide outrider construct that hunts loud minds |
| **Unbound** | Vaelith heretics and exiles who reject the Prophecy |
| **Veil** | Vaelith cloak tech, and the shards Corsairs smuggle |
| **Vigil, the** | The Vaelith who stayed awake after the Shattering |
| **Void Tide** | The Warden's front that unmakes matter along the lanes |
| **Warden, the** | What the Void Tide really is (Act V secret) |

**Maneuver names (new):** Snap Turn (K-turn), Hook Loop (Segnor's Loop), Knife
Roll (Tallon Roll), Boost, Barrel Roll (both generic, keep).

**Hero powers (in-universe names → data ids, unchanged):**
Fire Mission `orbital_strike` · Bulwark Protocol `shield_overcharge` · Rally
Call `rally_the_fleet` · Rigger Surge `field_repair` · Spawn Cluster
`drone_swarm` · Silence Pulse `emp_burst` · Ghost Jump `cloak_dash` · Parting
Gift `scatter_mines` · Stillness `time_slow` · Mind Lance `psionic_lance`.

## Distancing table

Counts come from a scan of `src/**/*.ts` (2026-10-13). **All** = every line
(ids, comments, code), as lines / files. **Display** = lines where the term
sits inside a player-facing string literal (comment lines excluded), as lines
/ files. **Internal ids** (`segnor_left`, `kturn`, `astromech`,
`force_power`, `force_heal`, `proton_torpedo`…) **can stay**: rename the
display text, not the keys, so saves, tests and balance data keep working.

### High priority — Star Wars-specific, player-facing

| Term in game | All | Display | Where it shows | In-universe replacement | DONE |
|---|---|---|---|---|---|
| **Force** (Force powers / talents / "Force-touched") | 83 / 19 | 36 / 6 | `PilotAbilities.ts` (Force Heal/Guidance/Push/Barrier/Shield/Fury/Suppression), `talents.ts` (Force Sensitive), `factionIdentity.ts`, `factionCodex.ts`, `ShipLoadouts.ts` | **Psionic / psi.** Force Sensitive → **Psi-Sensitive**; Force Heal → **Mend**; Force Guidance → **Guiding Sight**; Force Push → **Kinetic Shove**; Force Barrier → **Psi Barrier**; Force Shield → **Aegis Weave**; Force Fury → **Wrath Surge**; Force Suppression → **Mind Static**; "Force powers" → **psionic disciplines**; "Force-touched pilots" → **psions** | DONE 2026-10-13: names, descriptions, "Force charge" → "psi charge" |
| `force_*` ids | 74 / 12 | 0 | ids only | keep ids; slot `force_power` displays as **Psionic** (codex title-cases slot ids, so add a display map) | DONE: ids kept; slot shows Psionic (`slotDisplayName`, chip "PSI") |
| Battle Meditation (`forcePowers.ts`) | — | 1 / 1 | upgrade name | **War Chorus** | DONE |
| Supernatural Reflexes | 7 / 5 | 1 / 1 | `PilotAbilities.ts` | **Precog Reflexes** | DONE |
| **Astromech** | 49 / 16 | 7 / 3 (+ slot label, title-cased from id `astromech` in codex and squad builder) | `systems.ts` (Repair/Patch/Targeting/Flight Astromech), `factionIdentity.ts`, `factionCodex.ts` | **Rigger**: Repair Rigger, Patch Rigger, Targeting Rigger, Flight Rigger; "astromech-crewed" → "rigger-crewed" | DONE: slot shows Rigger (`slotDisplayName`, chip "RIG") |
| droid | 7 / 7 | 1 / 1 | `ShipLoadouts.ts` ("whose droid welds the hull") | **rigger** | DONE |
| **Segnor's Loop** | 151 / 51 | 34 / 18 | HUD (`FlagshipHudSnapshot`), key bindings, Flight School, upgrade text ("K-turn, Segnor loop and Tallon roll…") | **Hook Loop** (HUD `HOOK`) | DONE: HUD HOOK, maneuver readouts via `core/maneuverLabels.ts` |
| **Tallon Roll** | 139 / 52 | 34 / 18 | same | **Knife Roll** (HUD `KNIFE`) | DONE: HUD KNIFE |
| **K-turn / Koiogran** | 238 / 71 | 20 / 19 | HUD `K-TURN`, relics, upgrades, Flight School; relic **Koiogran Gyro** | **Snap Turn** (HUD `SNAP`); Koiogran Gyro → **Snap Gyro** | DONE: HUD SNAP; relic Snap Gyro |
| hyperspace | 2 / 2 | 1 / 1 | `hegemonyAct23.ts` "hyperspace gate" | **jump gate** | DONE |
| Imperator (Battlecruiser) | 7 / 4 | 4 / 3 | `ShipDefinitions`, `ShipEncyclopedia`, `ShipLoadouts`, `SquadBuilder` | **Aquila Battlecruiser** (id `terran_imperator` stays) | DONE |
| Executor (Destroyer) | 5 / 3 | 4 / 3 | same files | **Lictor Destroyer** (id `terran_executor` stays) | DONE |
| Grand Inquisitor (pilot) | 4 / 2 | 1 / 1 | pilot card | **First Censor** | DONE (other "Inquisitor" hulls/loadouts keep the generic word) |
| Proton Torpedoes / Proton Bombs | 48 / 6 | 2 / 1 | `weapons.ts` | **Fusion Torpedoes / Fusion Bombs** | DONE |
| Concussion Missiles | 21 / 8 | 1 / 1 | `weapons.ts` | **Burst Missiles** | DONE |
| Seismic Charges | 16 / 5 | 1 / 1 | `weapons.ts` | **Quake Charges** | DONE |
| Blaster (Turret) | 4 / 2 | 3 / 2 | `TurretSystem.ts`, Survival event | **Pulse Turret**, "pulse gun" | DONE (Survival event: "pulse gun") |
| Rebel ("The Rebel's Path", "Rebel Commander Blake", "rebel patrol") | 18 / 10 | 11 / 8 | `CampaignData.ts`, rosters, mission text | Campaign → **"Libre"**; card → **Cell Commander Blake**; text → **cell / insurgent** (Hegemony propaganda may say "insurgents") | DONE: campaign "Libre", Cell Commander Blake, insurgent / cell text |

**Test impact (applied 2026-10-13; gate: `tests/unit/lore/distancing.test.ts`):** e2e and unit tests assert some display labels: `K-TURN|K-turn`
53 lines in 29 test files, `SEGNOR|Segnor` 37/15, `TALLON|Tallon` 27/11,
`Force` 12/8. Rename labels together with their assertions.

### Medium — X-Wing card-name echoes (generic words; optional)
**Status:** not applied. The glossary only suggests them "where it's cheap" and they are generic English words.
Expert Handling, Squadron Leader, Predator, Marksman, Daredevil, Elusive,
Outmaneuver, Fearless, Heavy Laser Cannon, Quad Laser Cannon, Twin Laser
Turret, Jamming Beam, Collision Detector, Fire-Control System, Advanced
Sensors, Veteran Gunner, Proximity Mines, Cluster Mines, Ion Torpedoes,
Stealth Device, Vectored Thrusters. Suggested only where it's cheap: Expert
Handling → **Ace Handling**, Quad Laser Cannon → **Quad Laser**, slot
`illicit` displayed as **Contraband**. Generic slot names (Crew, Gunner, Tech,
Talent, Sensor, Modification, Configuration, Title, Cannon, Turret, Missile,
Torpedo, Bomb) stay.

### Keep (not player-facing, or required)
| Term | All | Display | Decision |
|---|---|---|---|
| X-Wing / X-Wing Miniatures | 124 / 73 | 6 / 2 | Keep in `credits.ts` (attribution and trademark notice, legally required). `GameplayMetrics.ts` is an internal report. Comments and docs ("X-Wing-style cycle") are internal |
| TIE / Lambda / Millennium | 4 / 2 | 0 | Comments only. Clean up opportunistically |
| Aturi (Cluster) | 2 / 2 | 0 | Comment in `PilotData.ts`. Clean up opportunistically |
| Ion cannon, ion storm | — | — | Keep: generic sci-fi and core to the setting |
| Jedi, Sith, lightsaber, Star Destroyer, Hutt, Mandalorian, Wookiee, Kessel, dark side | 0 | 0 | Absent. Keep it that way |

### Name collisions found (fix in data or absorb in lore)
| Collision | Resolution |
|---|---|
| Corsair usurper *Vorn* vs Ascendant card `crusader_vorn` | Rename the Corsair to **Vosk** (`corsairsAct23.ts` dialogue) |
| Card `torpedo_ace_zara` vs Zara Kira | Rename the card **Torpedo Ace Zhao** |
| `captain_vex` (Confederation) vs `legion_master_vex` (Hegemony) | Lore: twins split by the Schism |
| `ironwing_chen` vs Marcus Chen | Lore: his sister Lena |
| `iron_fist_mora` (Corsair) vs Iron Fist Squadron | Lore: deserter from Iron Fist |
| `talon_reyes` vs Lt. Reyes "Striker" | Lore: her brother |
| Synthetic *Nexus* ships vs the Nexus artifact | Lore: Lane Authority "nexus node" jargon came first |
| The Survival event *Nexus Whisper* vs Cdr. Vasile "Whisper" | Keep: an irony noted by Vasile in Act IV |
