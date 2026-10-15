# Creatures — aerial / space monsters with their own movement and powers

Creature bosses and spawns for the real-time engine (Survival sector bosses,
Campaign Void Tide fights, hazard-mission and event spawns). They are **not**
ships on the maneuver dial: they move in their own style, fight with
telegraphed powers and have body parts. Everything else is the shared combat
model — one attack per cycle per attacker (500 ms), `DURABILITY_SCALE` 12 hit
points, hit immunity, torus-aware geometry, `HitImmunity`, the mode's damage
and kill path.

## Layout

| Layer | Files |
|---|---|
| Data | `src/data/creatures/` — `creatureTypes.ts` (model), one file per creature, `creatureCatalog.ts` (registry, sector bosses, durability, texture keys) |
| Pure runtime | `src/arcade/creatures/` — `CreatureEncounter` (one creature's fight), `CreatureMovement`, `CreatureParts`, `CreaturePowerBrain` / `CreaturePowerEffects` / `CreaturePowerRunner` / `CreaturePowerState`, `CreatureFeeding`, `CreatureHost` (steps every creature through a mode's bridge), `creatureSpawn`, `bossBarModel`, `BodyTrail`, `CreatureRng` |
| Scene glue | `src/scenes/creatures/` — `SceneCreatures` (host + views + boss bar + cues), `CreatureView`, `CreatureTelegraphLayer`, `CreatureBossBar`, `creatureTextures` |
| Modes | Survival: `SurvivalScene` (`spawnCreatureShip`, `creatureBridge`), `CombatNodePlan.creatureBoss / eventCreature`, `src/simulation/survival/nodeCreatures.ts`. Campaign: `CampaignBattleScene` (`spawnCreatureShip`), `src/campaign/mission/tideBreach.ts` |
| Bestiary | `src/data/encyclopedia/creatureCodex.ts` (EncyclopediaScene tab BESTIARY) |

## The model

* **Hull / shields**: miniature points × `DURABILITY_SCALE` (`creatureDurability`).
  The creature's ship record carries them, so lasers, ordnance, mines, hero
  powers and relics all work on it unchanged.
* **Movement style** (never the dial): `serpentine` (sine undulation toward the
  prey, segments trail the head), `drift` (smoothed standoff orbit), `hive`
  (spinning core, brood pods), `blink` (stalks, phase-shifts), `orbit_lunge`
  (circles, then dashes). Survival creatures are contained in the belt circle
  (no wrap); Campaign creatures wrap across the map seam like every ship.
* **Powers** (`CreaturePowerSpec`): cone, ring, pull (tractor), cloud (spore:
  slow + stress), summon, scream (psychic stress — the Tide hunts loud minds),
  sweep (rotating arc), lunge, blink. Each **winds up for 1–2 cycles** with a
  locked aim and a visible telegraph, lands, then has a cooldown. After any
  power the brain waits a full cycle before the next wind-up (one attack per
  cycle). A victim is hit at most once per cycle by one creature (`HitGate`).
* **Parts** (`CreaturePartSpec`): hit pools addressed by the attacker's
  **bearing off the creature's nose** (shield-down hits only). Weak points
  take ×1.3–1.7 hull damage, armoured plates ×0.5–0.7. A destroyed part
  disables the powers that `requiresPart` it, for good.
* **Phases**: hull thresholds (`phaseThresholds`, same table as Survival's
  `BOSS_PHASE_THRESHOLDS`), each with speed / cooldown / damage scales and an
  optional movement-style override (the Warden Avatar turns to `blink`).
* **Feeding**: the only way to heal (`feedHullPoints`): it hunts the nearest
  wreck while hurt and needs 1.5 s beside it; any hit breaks the meal.
* **Determinism**: sim clock only (the frame's `nowMs`), seeded saveable
  `CreatureRng` (one 32-bit state), no hidden information — the brain sees only
  the prey's positions, its hull fraction and `addsAlive`.
* **No per-frame allocations** in the encounter / host / views once a ship id
  was seen (pooled targets, reused result objects, one Graphics per creature).

## Telegraphs (never colour alone)

Fan (cone, sweep — the sweep rotates), lane + arrowhead (lunge), band with
dashed safe pocket and ticks (ring), inward chevrons (pull), dashed circle +
cross (cloud), concentric waves (scream), spawn triangles (summon), diamond +
line (blink destination). Each has a text label `NAME [TAG] 0.8s` above the
creature and on the boss bar, and a rising warble (`creature_telegraph`); a
landed power plays `creature_roar`. Weak points wear a crosshair ring, plates a
square bracket; destroyed parts float "<PART> DESTROYED" and show on the bar as
`✖ PART (POWER OFF)`.

## Roster

| Creature | Movement | Powers (wind-up) | Parts | Where |
|---|---|---|---|---|
| Cinder Wyrm | serpentine | Cinder Spray cone (1), Wyrm Strike lunge (2), Ember Nova ring (2, phase 2) | furnace throat, ember gland (×1.7), slag plates ×2 (×0.7) | Survival S1 boss |
| Deepmaw | drift | Tentacle Sweep (1), Maw Tractor pull (2), Spore Bloom cloud (2); feeds on wrecks | port / starboard tentacles, gut sac (×1.6), cilia ring (×0.5) | Survival S2 boss |
| Choir-Hive | hive | Thorn Volley cone (1), Brood Call summon (2), Spore Bloom (1), Choir Scream (2) | 4 brood pods (×1.5), brood sac, choir throat | Survival S3 / final boss |
| Pruning Herald | blink | Shear Fan (1), Phase-Shift blink (1), Mind Prune scream (2) | lens-eye (×1.6), shear blades ×2 (×0.7) | Campaign Void Tide boss (Acts III–IV, Coalition) |
| Warden Avatar | drift → blink | Silence Ring, Root Sweep, Lane Pull, Tide Call, The Hush, Pruning Ray | 4 petals, each runs a power | Campaign Act V finale boss |
| Tidecell | orbit_lunge | Lunge (1) | — | Act III finale Breach beat, Tide Call adds, Survival event "The Quiet Tide" |
| Hulk Gnawer | serpentine | Gnaw cone (1); feeds on wrecks | — | Choir-Hive brood, Survival event "Gnawer Nest" |

## Survival

* The boss row's boss is the sector's creature (`survivalBossFor(sector)`),
  alone on the node's last wave. Phases: the plan's phases (ADR-0004) **plus
  one enrage phase** (`CREATURE_EXTRA_PHASES`); only the plan's own phases
  restore shields and call the 2 reinforcements (`phaseCallsReinforcements`).
* Events can add a creature to the last wave (`{ kind: "combat", creature }`).
* The headless node sim (`SurvivalNodeSim`) fights the same creature;
  `creatureBosses: false` replays the legacy capital boss for A/B.

## Campaign

Any assassination objective (or scripted spawn group) may name a creature id as
its `shipId`/`targetShipId`; `CampaignBattleScene.spawnFromRequest` turns it
into a creature ship (hull scale honoured). Hero powers work on it: damage
goes through the same path (a phase-shifted creature is untouchable), EMP
silences it, time-slow slows its clock. Every faction's Act III finale ends on
the Breach beat (3 Tidecells arrive when its last goal completes).
The Coalition missions (Acts IV–V, `coalitionAct4a/4b/5`) are built but still field ordinary
ships: the Pruning Herald and Warden Avatar are defined and ready to be named as the
assassinate target (or scripted spawn) of `coal_4_5`, `coal_5_2` and `coal_5_3`.

## Art

`scripts/generate_creature_art.py` → `public/assets/creatures/creature_<stem>_{body,segment,pod}.png`
(512², RGBA, top-down, front up) through the shared SD queue server. Textures
load on demand when a creature spawns (placeholder first, art swapped in) —
nothing loads at boot. Missing art falls back to a procedural placeholder.
