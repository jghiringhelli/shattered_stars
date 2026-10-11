# Campaign — structure, systems and persistence

SC2 *Wings of Liberty*-style campaign for Shattered Stars: a hub between
missions, non-linear mission order, varied mission mechanics driven by data,
hero pilots with active powers, an Armory and a Research tree, and story
consequences that carry from scenario to scenario.

## 1. Structure

| | |
|---|---|
| Factions | 5 (Hegemony, Confederation, Synthetic, Corsairs, Ascendant) |
| Mission slots per faction | **15**, in **3 acts** of 5 (`act` 1–3) |
| Mission definitions | **78** — Hegemony offers branch pairs at slots 3, 8 and 13 (18 definitions); every other faction has 15 |
| Data | `src/data/campaign/missions/*` (story, squad, enemies, rewards, debriefs) + `src/data/campaign/designs/*` (objectives, script, hazards, allies, variants) merged in `src/data/CampaignData.ts` |

(An older header claimed "25 missions across 4 acts"; that was never true.)

### Hub availability (`src/campaign/hub/missionGraph.ts`)

Per act of 5 slots: the **opener** needs the previous act's finale; the
three **middle** slots open *together* after the opener (act I teaches first:
1 → 2 → {3, 4}); the **finale** needs every middle slot. A slot is done when
any of its missions is done, so the other branch of a pair becomes
"not taken". Missions can override with `prerequisites: number[]`.
Result: from slot 3 on, the hub almost always offers ≥ 2 missions.

## 2. Objectives (`src/arcade/objectives/` — pure, reusable)

Each objective is a pure model (`create / step / readout / markers / spawns
/ poses / isConstraint`) stepped by an `ObjectiveFrame` (ships, events,
time). Designed so an X-Wing 2.0 Scenario mode can reuse them.

| Type | Mechanic |
|---|---|
| `eliminate` | destroy `count` enemies (optionally only `tag`, e.g. `boss`) — fixes the old bug that compared kills to `target` |
| `survive` | hold out `timeLimit` s with a player ship alive |
| `escort` | ≤ **3** transports (`MAX_ESCORT_TARGETS`) fly a path; fails when losses > `maxLosses`; hull per transport on the tracker, ally blips on radar |
| `defend` | a scripted station must survive (`timeLimit`, or the whole mission → constraint) |
| `capture` | X-Wing 2.0 control: more ship weight in range controls (tiny/small = 1, medium+ = 2); `holdSeconds` of control wins; `enemyHoldFails` optional |
| `assassinate` | named target (escorted by the mission's enemies); flees along `fleePath` when hurt (`fleeAtHullFraction`) or late (`fleeAfterSeconds`); escape = fail |
| `waypoints` | flagship flies through points in order (race with `timeLimit`; `extraction` exit) |
| `sabotage` | keep a player ship in range `holdSeconds` (optional decay) |
| `salvage` | X-Wing 2.0 Salvage Mission: unstressed ship at range picks up a crate; boost / barrel roll / destruction drops it; deliver `required` crates |
| `protect` | constraint: fail when a player ship with `tag` dies (`wingman`, `squad`, ally tags…) |
| `stealth` | constraint: fail when lingering `graceSeconds` in a sentry's radius |

Shared rules (`objectiveRegistry.ts`, `objectiveSet.ts`): `timeLimit` is a
hold duration for survive/defend and a deadline for the rest; hidden
objectives freeze (but still block victory) until revealed; constraints
complete on victory; bonus (`optional`) objectives never decide the outcome.
Legacy objectives (kind + description only) are normalised with default
geometry (`src/campaign/mission/normalizeObjective.ts`).

## 3. Mission scripting (`src/campaign/scripting/`)

Declarative beats: `{ when, if?, delaySeconds?, repeat?, actions }`.

- **Triggers:** `start`, `time`, `objective` (status or `revealed`),
  `destroyed` (tag / side / count), `area` (side / tag), `flag`.
- **Actions:** `say` (speaker, portrait, mood), `spawn` (enemy or ally group,
  `flank` / `ahead` / `behind` / point), `addObjective`, `revealObjective`,
  `completeObjective`, `failObjective`, `setFlag` (`persist: true` = story
  flag saved on victory), `hazard` on/off, `music` cue, `banner`.
- `ScriptInterpreter` is pure; flag actions apply immediately so flag
  triggers chain within a step (`MAX_CHAIN_PASSES = 8`).
- Authoring helpers: `src/data/campaign/designKit.ts`. Positions are offsets
  from the battlefield centre (player squad starts at 0,+220).

Every mission has a style, a terse tagline, a briefing beat, ≥ 2 more beats
and ≥ 1 bonus objective granting research (enforced by
`tests/unit/campaign/campaignContent.test.ts`). Each faction covers escort,
defense, heist/salvage, assassination, stealth, hazard, race and boss.

## 4. Hazards (`src/campaign/hazards/`)

`ion_storm` (shield drain + stress), `minefield` (one-shot blasts; `harms`
side for owned mines), `asteroid_belt` (hit every `hitIntervalMs` inside —
deterministic), `flare_wall` (advancing front burning what it passed).
Scripts switch them on/off.

## 5. Hero powers (`src/campaign/powers/`, `src/data/campaign/heroPowers.ts`)

Two campaign-only powers per faction hero, 3 ranks, bound to
`HERO_POWER_1` (**V** / pad Y) and `HERO_POWER_2` (**B** / pad L3) via
`HeroPowerInput` (same latch pattern as MARK_TARGET).

| Faction | Power 1 | Power 2 |
|---|---|---|
| Hegemony (Admiral Chen) | Orbital Strike — delayed AoE on the focus target | Shield Overcharge — refill + damage ×0.5 |
| Confederation (Santos) | Rally the Fleet — wing fires faster | Field Repairs — hull to self and allies |
| Synthetic (Omega-7) | Drone Swarm — temporary allied drones | EMP Burst — strip shields, silence guns, stress |
| Corsairs (Kira) | Cloak Dash — jump forward + untargetable | Scatter Mines — owned minefield behind |
| Ascendant (The Dreamer) | Time-Slow Focus — enemy time ×0.5 | Psionic Lance — shield-piercing strike |

Unlocks (`POWER_UNLOCK_SCHEDULE`, missions completed): P1 r1 at 0, P2 r1 at
3, P1 r2 at 6, P2 r2 at 9, P1 r3 at 12, P2 r3 at 13. Ranks are saved in
`heroPowerRanks`. Effects resolve to commands (`heroPowerEffects.ts`, pure);
timed effects live in a status ledger; the battle applies them through
`CampaignPowerHost`. HUD: `HeroPowerBar` (glyph, key, rank, cooldown seconds,
LOCKED).

## 6. Armory and Research

- **Armory** (`src/data/campaign/armory.ts`, campaign-only — not in the
  global upgrade catalog): 4 slots × 2 mods (hull, shields, weapons,
  systems), 150–260 credits. One mod per slot; buying another swaps and
  refunds; **RESPEC is free** between missions (full refund of the price
  paid). Applies to the whole player squad.
- **Research** (`src/data/campaign/research.ts`): 4 binary tiers unlocked at
  2 / 6 / 11 / 17 research points earned; each pick is **permanent** (two
  clicks to confirm). Research points come from bonus objectives (default 1,
  designs grant 1–3; Tactical Analysis adds +1 each).
- Bonuses fold into one record (`campaignBonuses.ts`) and are applied at
  spawn (`CampaignLoadoutBonuses.ts`): hull/shield caps, attack, evasion,
  rate of fire, shield regen, damage taken, power cooldowns, credit
  multiplier, research per bonus, wingman attack.

## 7. Battle integration

`CampaignBattleScene` compiles the mission (`compileMission`: variants,
story-flag allies, offsets → world) and hands it to
`CampaignMissionDirector` (`src/campaign/battle/`), which owns the pure
`CampaignMissionRuntime` (objectives + script + hazards + clock), the hero
powers and the HUD extras (comms with portraits, power bar, world markers).
Objective markers are added to the BattleHud as neutral contacts (radar +
edge arrows); transports/stations are ally contacts with health bars; the
objective tracker shows live progress and FAILED states in text.
Scene hooks `checkDelayedSpawns` (script + hazards + timed waves) and
`checkObjectives` keep their names so calm e2e runs can stub them.
Debug: `scene.director.debugWin()` completes every required objective.

## 8. Persistence (`src/campaign/save/`, `src/systems/CampaignSaveManager.ts`)

One save per faction (`shattered_stars_campaign_<faction>`), schema **v3**:
v2 fields + `storyFlags`, `branchChoices` (`slot_<n>` → mission id),
`researchPoints`, `research`, `armory.installed` (price paid),
`heroPowerRanks`, `bonusObjectivesCompleted` (`mission:objective`, rewarded
once), `campaignComplete`.

- **Load** validates every field and migrates v1/v2 without data loss
  (missing/malformed fields get defaults; v2 derives hero ranks from
  completed missions). Unparseable JSON is backed up to `<key>_corrupt`.
- **Autosave** after every victory (`recordVictory`) and every hub action.
- Story consequences in shipped data, e.g. Hegemony: lose no freighter in
  *Supply Convoy* → *Station Defense (Resupplied)* with an allied gunship;
  lose Lance Squadron in *Drone Swarm* → it never flies again. Every faction
  has at least one such chain (enforced by the content test).
- **Completion:** winning the finale sets `campaignComplete` and the debrief
  leads to `CampaignCompleteScene` (flag-aware epilogue + service record);
  the hub then offers an EPILOGUE shortcut.

## 9. Tests

- Unit: `tests/unit/arcade/objectives/*`, `tests/unit/campaign/*`
  (interpreter, hazards, powers, armory/research, save v3, compiler, hub
  graph, hub actions, spawns, content integrity),
  `tests/unit/arcade/systems/Campaign{MissionRuntime,HeroPowers,Victory}.test.ts`.
- E2E: `tests/e2e/campaign-hub.spec.ts`, `campaign-objectives.spec.ts`,
  `campaign-powers.spec.ts`, `campaign-progress.spec.ts`.
