# ADR-0004 — Survival roguelite: sector map, relics, economy, ascension, meta-progression

- **Status:** Accepted
- **Date:** 2026-10-11
- **Related:** [ADR-0003](ADR-0003-survival-roguelite-leveling.md) (leveling, branches, threat),
  research `research-polish.md` (FTL, Slay the Spire, Hades, Nova Drift; P1-1, P2-2, red flag 5)
- **Code:** `src/data/survival/*`, `src/systems/survival/*`, `src/ui/survival/*`,
  `src/scenes/Survival{,Setup,Map,Summary}Scene.ts`

## Context

Survival was an endless wave shooter with drafts: no route choices, no events or shops, no
persistent build items, no meta-progression, no save/resume, no win condition — the
"roguelite in name only" red flag. Rerolls were awarded but never spent, the Free
Confederation never appeared as an enemy, Wing Commander could exceed the escort cap, and
the `speed` power did nothing once escorts were bot-flown.

## Decision

### 1. Run structure (Slay the Spire / FTL)
- A run is **3 sectors** (`SECTOR_COUNT`); each is a seeded branching map of
  **7 regular rows + 1 boss row** (`REGULAR_ROWS`), **2–4 nodes per row**
  (`MIN/MAX_ROW_WIDTH`). Rows are joined by a non-crossing "staircase" of edges, so every
  node has a way in and out (`SectorMapGenerator`).
- Node types: **combat, elite, event, shop, repair dock, mystery (?), sector boss**, each
  with an icon, colour, legend line and hover preview (`nodes.ts`). Row 0 is all combat;
  the row before the boss is all repair docks; elites/shops appear from row 2; every
  sector is guaranteed ≥1 shop, event and elite. Weights: combat 44, event 20, mystery 12,
  elite 10, shop 8, repair 6.
- Mystery reveals (stable per node): event 50 %, combat 20 %, shop 15 %, treasure (free
  relic pick) 15 %.
- **Victory** = defeating the sector-3 boss (it has one extra phase).

### 2. Battles reuse SurvivalScene
- `CombatNodePlan` turns (node kind, sector, row, ascension) into the battle:
  **1 wave** for every node kind (a boss node used to send an escort wave first — see the
  fairness pass below). Threat = ADR-0003's `computeThreat(run, ships)` ×
  `ROGUELITE_THREAT_SCALE (0.45) × (1 + 0.25·(sector−1) + 0.04·row) × ascension`;
  regulars per wave are capped at **2** (`MAX_REGULARS_PER_WAVE`) in every sector. Elites come
  from the node only (no threat elites): an elite node fields 1 elite (2 at ascension 1) that
  replaces 2 regulars and may fly alone; a **boss flies alone** (`BOSS_WAVE_REGULARS = 0`, no
  bonus elite) — its phases call in the reinforcements (`NodeWaveRoster`).
- Elites are drawn by sector (`ELITE_ROLES_BY_SECTOR`): heavy fighters in sector 1, heavy
  fighters / bombers in sector 2, bombers in sector 3 (gunships only as a fallback — they are
  the bosses' hull).
- AI tiers come from an **effective wave** = `4·(sector−1) + ⌊row/2⌋ + 1` (+3 at
  ascension 3): sector 1 novices (its last rows average), sector 2 average, sector 3 average
  turning expert from its fifth row (`AVERAGE_LAST_WAVE = 10`). Elites fly the wave's tier
  (+50 % hull, +1 die, an affix; Ace = +1 tier). Sector bosses fly average / expert / expert
  (`SURVIVAL_SECTOR_BOSS_TIERS`) on their equipped hull (`bossMultiplier` = 1 for waves 5–15).
- **The free wingman:** every run starts with one escort (the faction's starter fighter,
  average-tier bot), so the player has a squad — squad orders and the mark — from node 1. It
  counts toward `MAX_ESCORTS`; meta escort packages add on top (`FREE_STARTING_ESCORTS`).
- The belt starts `4·(sector−1) + ⌊row/2⌋` squeezes in (+2 at ascension 2), capped at
  **12**, and squeezes once more per wave. Its damage ramps 6 → 12 HP/s at the wall
  (0.5 + 0.05/squeeze miniature points, capped at 1 — `SurvivalBelt`), a third of the old
  36 HP/s unsqueezed peak. While the player's ship is within the avoid margin or in the belt,
  `BeltWarningHud` shows a pulsing screen-edge frame, a warning icon, a text line ("BELT AHEAD —
  STEER TO CENTRE" / "ASTEROID BELT — TURN BACK") and an arrow to the centre, and sounds a
  procedural klaxon (`belt_warning`; on approach, on entry, every 1.5 s inside); the radar
  traces the safe radius. **Waves spawn on an arc around the arena centre
  at `safeRadius − 400 px`, facing inward** (`SurvivalSpawnArc`: regulars spread over a
  120° arc, crowded waves wrap onto rows 90 px further in, elites 120 px and the boss
  200 px inside it; boss-phase reinforcements are pulled inside the arc too). They used to
  spawn in a row 100–200 px below the top edge — 2 800–2 950 px from the centre — so from
  ~wave 4 they spawned beyond the belt wall and died within a second (wave 5: 5/5 killed
  by the belt). A unit test checks every spawn point of every node kind, sector, row,
  ascension and wave (and endless squeezes 0–30) lies inside the current safe radius.
- **Drive** ("speed" powers) goes through the equipment path, identically for the flagship
  and the escorts: 1st point = +1 top-speed notch, each further point ×0.85 boost recharge
  (floor 0.4); re-applied idempotently from the hull's base control state.
- Capital ships are never fielded as regular wave ships.
- **Hull and shield damage persist** between nodes (stored as fractions of max);
  shields recover 50 % of what they lost in transit. Escorts lost in battle are gone;
  if the flagship dies the first surviving escort becomes the flagship.
- Enemy faction per node is seeded from every faction except the player's — **the Free
  Confederation now appears**. Intel (the faction) shows in the node preview.
- **Elite affixes** (1, or 2 at ascension 7): Shielded, Swift, Ace (+1 AI tier), Regenerating,
  Volatile, Marksman, Juggernaut — shown as a label above the elite and announced.
- **Boss phases**: at 50 % (2 phases) / 66 %, 33 % (3 phases) the boss restores its
  shields and calls 2 reinforcements.

### 3. Economy (salvage) and rerolls
| Source / sink | Value |
|---|---|
| Start | 40 salvage, 1 reroll |
| Kill | regular 3, elite 10, boss 40 |
| Node clear | combat 15, elite 30, boss 60 |
| Skip a draft | +12 |
| Shop | repair 30 % hull 35, relic 60/90/130, escort 75, flagship refit 65, reroll 20 |
| Repair dock | repair 45 % hull **or** +1 upgrade on one ship (+1 laser dmg, +12 hull) |

Rerolls are a real resource: the draft and relic panels have a Reroll card that spends a
charge (the draw is re-derived from the seed + rerolls spent).

### 4. Relics (30) and archetypes
Relics are data (`RelicEffect`) interpreted at real-time consumption points
(`RelicCombatEngine`, `FleetEffects`): statics fold into `CombatModifiers` (rear arc,
bullseye, wingman, stressed, damaged, kill frenzy, shields per kill, death blast…),
triggers start timed buffs after **red maneuvers, barrel rolls, boosts, K-turns**, shots
read **marked targets** and **living escorts**, incoming damage reads buffs and
**Formation Lock**. Every relic shows its synergy tags; the pick card shows archetype
progress and tag matches. Five archetypes, each with a **set bonus at 3 relics**:
Ace/Hotshot (maneuvers), Hunter (marks/crits/positioning), Squadron (escorts/wingmen),
Bulwark (shields/hull/repair), Salvager (economy). 20 relics are in the base pool; 10 come
from meta relic packs.

### 5. Mutations (Nova Drift)
Sector-1 boss: **weapon** mutation — Rail Driver (slow, 2.2× hits, +range) / Scatter Array
(two separately rolled bolts at 60 %) / Ion Lance (−20 % dmg, +10 % hit, stresses targets).
Sector-2 boss: **systems** mutation — Reactive Shields (no passive regen; kills restore
40 %, barrel rolls 15 %) / Afterburner Core (2× boost/roll recharge, boost dodges 70 % for
1 s, −15 % hull) / Juggernaut Plating (−30 % damage taken, +25 % hull, 1.8× slower
boost/roll). One per slot; options are mutually exclusive.

### 6. Events (14)
Text events with 2–3 choices: costs, seeded gambles, "blue" options gated by faction,
escorts, rerolls or relic tags, and ambushes that start a battle whose other outcomes are
the post-victory bonus. Every faction has at least one faction-only option.

### 7. Ascension 0–10 (Hades Heat)
Cumulative: 1 Elite Contracts (+elite weight, +1 elite on elite nodes — it used to reach boss
nodes too, which re-made the boss a marking squad: A1 run wins 0 %), 2 Tight Belt (+2 squeezes),
3 Veteran Wings (tiers earlier), 4 Lean Pickings (−20 % salvage), 5 Hardened Hulls (+15 %
enemy hull), 6 Price Gouging (+25 % prices), 7 Affix Surge (2 affixes), 8 Second Wind
(+1 boss phase), 9 Battle Scars (−30 % repairs), 10 Void Tide (+25 % threat). Winning at
your highest level unlocks the next. Modifiers are listed on the setup screen and the map.

### 8. Meta-progression, persistence, history
- **Star Charts** are paid at every run end, win or lose: 2/node, 10/sector cleared,
  1/10 kills, event finds, +40 (+4/ascension) on victory. They buy unlocks: Heavy and
  Gunship flagships, Wingmate/Twin Wing escort packages (+1 / +2 escorts on top of the free
  wingman), three relic packs, War Chest.
- Meta profile: `localStorage["shattered_stars_survival_meta"]`, versioned (v2) with
  validation and a v1→v2 migration; separate from campaign saves and PlayerProfile.
- Run save: `localStorage["shattered_stars_survival_run"]` (versioned, validated) written
  after **every** run operation on the map (save at every node). "Continue run" resumes it;
  "Abandon" closes it into the history. Quitting mid-battle resumes at the node before the
  battle (the battle restarts — no save-scumming of a fight in progress); the pause menu's
  Restart abandons the run.
- The last **20** runs are kept with outcome, cause of death, sectors, nodes, kills,
  escorts lost, relics, mutations, salvage, ascension, time and seed.

### 9. Determinism
One uint32 seed per run (shown as a base-36 code, typed on the setup screen). Every random
decision derives its own RNG from the seed + a purpose key (`RunRng.rngFor`): maps, node
contents, drafts (+rerolls spent), shops, gambles, factions, battle spawns, dice and crits.
Resuming a save replays exactly the same choices. Bot pilots keep their own randomness.

## Measured battle-node durations

A bot (average tier, marking like a player) flew the flagship through whole nodes on a
production-style bundle (3 trials each, 4 nodes in parallel). Times include the 2 s intro.

| Node | Fleet | Result | Duration |
|---|---|---|---|
| Sector 1 opening combat (1 enemy) | flagship | 2/3 cleared | 67–76 s |
| Sector 1 mid-map combat (2 enemies) | flagship + 1 escort, 3 powers | 3/3 cleared | 24–36 s |
| Sector 1 mid-map elite | flagship + 1 escort, 3 powers | 1/3 cleared | 23–47 s |
| Sector 2 mid-map combat | flagship + 2 escorts, 8 powers | 1/3 cleared | 30–43 s |

A typical combat node therefore lasts **~0.5–1.5 min**; a run (≈15 battles + events,
shops, docks, 3 bosses) lands around 30–45 min. Bots are a pessimistic proxy for a human
pilot. `tests/e2e/survival-node-duration.spec.ts` re-measures (it needs a quiet dev server).
These live measurements predate the fairness pass (free wingman from node 1, lone bosses):
the headless sweep now puts regular nodes at ~15 s median for the bot (see below).

## Consequences

- Route planning, repair-vs-upgrade and shop decisions now matter because damage persists.
- `SurvivalScene` only fights a node; map, events, shops, rewards, persistence and rules
  are pure modules with unit tests (`tests/unit/**/survival*`).
- Remaining tuning: threat scale/caps and elite strength are initial values from bot
  measurements and should be swept with the headless sim; relic magnitudes likewise.
  First sweep done 2026-10-11 — see below; the run-level targets need the structural
  decisions listed there.

## Headless balance sweep (2026-10-11)

**Tool.** `npm run telemetry:survival -- --runs 200 [--belt-aware] [--ascension N]`
(`src/simulation/survival/*`). Whole runs are played through the game's own pure run operations
(`createRun`, `enterNode`, event / shop / dock / reward resolvers, `completeCombat` / `failRun`);
every battle node is fought on the real engine the way `SurvivalScene` fights it —
`SurvivalBattleRules` (persisted damage, relics, mutations, upgrades), wave sizing
(`scaledWaveSize` + `planWaveRoster`), the spawn arc, `SquadBattleAi` (orders, marks, belt retreat
points), cycle flight, the belt's damage, and the scene's combat (run bonuses, relic shot
adjustments, crits, evasion, kill rewards, boss phases). The flagship is flown by an average-tier
bot that marks its target (the scene's autopilot); `--belt-aware` models a pilot who never strays
into the belt. Route / reward policy of the "average player": repairs when below 60 % hull, elites
only above 75 %, generalist draft picks, first relic / Hangar / mutation, first affordable event
choice, shop repair → escort (up to 2) → relic. Deterministic per seed; ~0.4 s per run.

**Targets** (average-tier player, ascension 0): sector-1 node clear ≥ 80 %, sector 2 ≥ 65 %,
sector 3 ≥ 50 %, run win 25–40 %, node length 45–90 s. Note that with permadeath and ~13 battles
per run, a 25–40 % run win needs ~90 %+ clears on average, so the per-sector numbers are floors.

**Results** (200 runs each, seeds 1–200):

| Config | Pilot | S1 clear | combat | elite | boss | S2 reached | run win | node length p10/med/p90 |
|---|---|---|---|---|---|---|---|---|
| enemy hull ×1.0 (before) | autopilot | 60 % | 67 % | 6 % | 0 % | 0 / 200 | 0 % | 28 / 65 / 135 s |
| enemy hull ×1.0 (before) | belt-aware | 73 % | 90 % | 13 % | 2 % | 2 / 200 | 0 % | 27 / 77 / 275 s |
| **enemy hull ×0.7 (now)** | autopilot | 65 % | 76 % | 8 % | 0 % | 0 / 200 | 0 % | 26 / 54 / 115 s |
| **enemy hull ×0.7 (now)** | belt-aware | 75 % | 92 % | 16 % | 4 % | 4 / 200 | 0 % | 22 / 60 / 198 s |

**Changed:** `BASE_ENEMY_HULL_MULTIPLIER = 0.7` (`src/data/survival/ascension.ts`; ascension 5 is
still ×1.15 on top). It brings node length into the 45–90 s band (median 54–60 s instead of
65–78 s, shorter tails) and lifts regular combat clears (+9 / +2 pts). Pushing it further (0.5)
does not help: hull is not what decides the lost nodes.

**Why the targets are not met — findings (measured):**
1. **The belt kills the flagship.** Every lost regular combat node of the autopilot was a belt
   death: the safe zone (radius 2 600 px on a 6 000 px torus) ends where 1v1 chases wander, and the
   belt deals up to 36 HP/s (3/s × DURABILITY_SCALE) — 2 s for a 72-HP Viper. A belt-aware pilot
   clears 92 % of combat nodes. This matches the live measurement above (opening 1v1: 2/3 cleared).
2. **Elite and boss nodes are walls (4–16 % cleared).** A sector-1 elite node fields a gunship /
   bomber elite (e.g. Pelican: 176 hull, ×1.5 elite hull) plus a regular; the sector-1 boss wave
   fields an *expert* elite (`sizeWave` adds one elite to every boss wave) plus the expert boss
   (×3 hull, +1 die) plus regulars — against a fleet of ~1.1 (elite) / ~1.5 (boss) ships.
   Halving boss hull (`BOSS_BASE_MULTIPLIER` 2 → 0) or elite hull (1.5 → 1.0) barely moved the
   clear rate (boss 2–4 %, elite 22–24 %): the fleet dies first.
3. **Squad marks punish a lone flagship.** Any enemy wave of 2+ flies as a squad and marks
   (+0.35 hit, +5 damage per hit); a fleet of one has no squad and no mark. Elite losses come in
   9–28 s. Escorts are scarce (fleet averages 1.1 ships at elites; shop escorts cost 75 and shops
   are 8 % of nodes): cheaper escorts (40) raised boss clears only to 8 %.

**Recommended next steps** (all three taken in the fairness pass below): gentler belt + warning,
boss waves without the bonus elite, a guaranteed early wingman; re-run the sweep after each change.

## Fairness pass (2026-10-11)

**Changes** (TDD; every number from `npm run telemetry:survival`, 200 runs, seeds 1–200, plus
three extra 250-run seed ranges for the adopted configuration):

1. **Belt:** damage capped at 12 HP/s at the wall (was 36 HP/s unsqueezed, +12 HP/s per squeeze),
   still denser every squeeze (6 → 12 HP/s, radii unchanged); screen-edge / text / icon / arrow
   warning, radar ring and audio cue (§2). Bots keep fleeing via `beltRetreatPoint`.
2. **Bosses:** no bonus elite; one wave (the separate escort wave cost so much persisted hull
   that a 2-ship wing cleared ~13 %); the boss flies **alone** — even one regular beside it
   makes a marking squad (S1 boss 59 % with one regular, 92 % alone); `bossMultiplier` 1 for the
   three sector bosses (×2/×3 bosses held S2/S3 to 10–30 % / ~58 %); sector-1 boss average tier
   (an expert one won ~75 %). Phases, shield restores and phase reinforcements are unchanged
   (the final boss keeps its extra phase; Second Wind adds one).
3. **Elites:** gunship elites only as a sector-3 fallback (§2); elite nodes field their elite
   alone (39 → 69 % in S1); elites fly the wave's tier (69 → 79 % in S1).
4. **Free wingman** from node 1 (§2), counted in the escort cap; save/resume, shop, summary
   ("Escorts lost") and Daily (which starts through the same `createRun`) carry it.
5. **Waves:** no threat elites on regular nodes (they put an elite into most S2/S3 combat nodes:
   S3 combat 30–49 % → 92–94 %); at most 2 regulars per wave in every sector (S3 fielded four
   experts); experts from effective wave 11 (mid sector 3) instead of 9.
6. **Ascension 1** Elite Contracts reaches elite nodes only, as its description says.

**Before / after** (average-tier autopilot, ascension 0 unless noted):

| Config | Pilot | S1 clear | S2 clear | S3 clear | combat | elite | boss | reached S2 / S3 | run win | node length p10/med/p90 |
|---|---|---|---|---|---|---|---|---|---|---|
| before | autopilot | 65 % | — | — | 76 % | 8 % | 0 % | 0 / 0 | 0 % | 26 / 54 / 115 s |
| before | belt-aware | 75 % | — | — | 92 % | 16 % | 4 % | 4 / 0 | 0 % | 22 / 60 / 198 s |
| **after** | autopilot | **95 %** | **92 %** | **89 %** | 96 % | 76 % | 87 % | 154 / 100 | **27.5 %** | 9 / 16 / 40 s |
| after | belt-aware | 98 % | 97 % | 96 % | 99 % | 85 % | 95 % | 177 / 151 | 60.5 % | 9 / 15 / 38 s |
| after, ascension 1 | autopilot | 91 % | 88 % | 88 % | 96 % | 44 % | 88 % | 116 / 59 | 15 % | 9 / 17 / 52 s |

Per sector (after, autopilot): elites 79 / 67 / 67–80 %, bosses 90 / 88 / 80–88 %. Other seed
ranges at A0: 23 % (251–500), 29 % (501–750), 29 % (1–250) — the run win sits at the bottom of
the 25–40 % band. Ascension now degrades gradually (A1 12–15 %, A2 10 %, A3 4 %, A5 3 %); before
the Elite Contracts fix A1 was 0 %.

**Targets:** S1 ≥ 80 % ✔ (95), S2 ≥ 65 % ✔ (92), S3 ≥ 50 % ✔ (89), run win 25–40 % ✔ (27.5).
**Node length 45–90 s ✘** — combat nodes take ~15 s (median; elites 24 s, bosses 19 s,
p90 40 s): a 2-ship wing with the mark kills 1–2 novices fast. Every lever that lengthened them
was measured to wreck the run win: survival-mode durability ×1.5 for both sides → combat 21 s,
run win 4 %; two waves per combat node → 97 s, combat clears 71 %, run win 0 %; 3 regulars per
wave (threat ×1.0–2.0) → 19–27 s, run win 1–8 %. Owner decision: accept short regular nodes (a
human flies slower than the bot and the map, events and shops pad the run) or trade win rate
for length. The belt still matters: about half of the lost battles include a ship lost in the
belt (the autopilot chases into it), which is the 27.5 % → 60.5 % gap to a belt-aware pilot.

## Re-measure after the combat unification (2026-10-12)

Enemies now fly their quick builds' secondaries (missiles, torpedoes, turrets, bombs) at
ORDNANCE_DAMAGE_SCALE 2, faction auras and pilot abilities act in Survival, and hull prices follow
real-time stats. `npm run telemetry:survival`, 200 runs, average autopilot, ascension 0:

| Config | S1 clear | S2 clear | S3 clear | combat | elite | boss | run win | node length p10/med/p90 |
|---|---|---|---|---|---|---|---|---|
| unified, enemy hull ×0.7 (seeds 1–200) | 93 % | 88 % | 87 % | 95 % | 70 % | 81 % | **16 %** ✘ | 10 / 19 / 48 s |
| shield recovery between nodes 0.5 → 0.8 | 92 % | 88 % | 87 % | 95 % | 68 % | 79 % | 15 % | 10 / 19 / 49 s |
| enemy hull ×0.6 | 94 % | 90 % | 90 % | 95 % | 74 % | 86 % | 24 % | 9 / 17 / 40 s |
| **enemy hull ×0.55** (seeds 1–200) | **95 %** | **91 %** | **90 %** | 96 % | 74 % | 85 % | **25 %** | 9 / 17 / 41 s |
| **enemy hull ×0.55** (seeds 201–400) | 96 % | 90 % | 93 % | 96 % | 75 % | 89 % | **31.5 %** | 9 / 16 / 37 s |

Adopted `BASE_ENEMY_HULL_MULTIPLIER` 0.55 (src/data/survival/ascension.ts): S1 ≥ 80 % ✔, S2 ≥ 65 % ✔,
S3 ≥ 50 % ✔, run win 25–31.5 % ✔ (bottom half of the band, as before). **Node length** re-measured as the
owner asked: median 16–19 s (p90 37–48 s), still below the 45–90 s target — the fairness-pass finding
stands (every lengthening lever measured so far costs the run win); owner decision pending.
