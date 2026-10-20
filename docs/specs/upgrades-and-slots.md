# Spec — Upgrade catalog, slots and loadouts

Inspired by classic tabletop dogfighting games: a fixed-price catalog of upgrade cards
grouped by category; each ship has a slot bar saying which categories it can
carry; the player picks predefined loadouts (quick builds), and a loadout's
price is derived from its contents — never authored.

## 1. Catalog (`src/data/upgrades/`)

Categories (`UpgradeSlotType`): modification, configuration, title, sensor,
tech, cannon, turret, missile, torpedo, bomb, crew, gunner, rigger,
talent, illicit, force_power. Illicit slots sit on seven Void Corsair raider
and smuggler hulls (Venom, Blade, Fang, Cutlass, Marauder, Bomber, Tender).
The `force_power` slot comes from Ascendant pilot cards and takes the four
psionic disciplines (`forcePowers.ts`): War Chorus, Mending Light, Foresight,
Righteous Wrath.

Every card MUST change real-time combat in every mode — tested in
`UpgradeCatalog.test.ts` and, knob by knob through the shared consumers and
mode by mode, in `tests/unit/arcade/CardEffectsEveryMode.test.ts`:

| Card kind | Where its effect lives | Read by |
|---|---|---|
| Stat cards (hull, shields) | `effects.hullBonus/shieldBonus` | every mode (`applyLoadoutEffects`) |
| Attack/agility dice | `effects.attackBonus/agilityBonus` | every mode (ModeBalancing dice) — never on a card that already has the equivalent `realtime` knob |
| Behaviour cards | `realtime` → `CombatModifiers` (`src/core/CombatModifiers.ts`) | every mode |
| Turret / ordnance | `weapon` → `WeaponProfile` (damage, reload, `rangeBand`, homing, `device`) | `src/arcade/weapons` (every mode) |

`CombatModifiers` knobs: laser damage (flat, calm-only, vs unshielded), damage
taken, shield regen, hull repair, maneuver stress rate and relief tiers, boost / barrel
roll / Snap turn recharge, ordnance reload / charges / homing, turret rate of
fire, stress inflicted per laser hit, cloak duration, aura projection, aura
radius (command cards widen the aura on ships that already project one) and
what the aura gives allies inside it (strength, stress relief, hit chance,
shield regen — `auraShieldRegenPerSecond` heals allies, never the projector).
Stacking: additive bonuses sum, multipliers multiply, then clamp
(damage taken ≥ 0.5×, recharge ≥ 0.4×, stress rate ≥ 0.5×, relief ≤ 2 tiers,
aura radius ≤ +50%).

Damage reduction on small hits: a dice-mode hit deals a few points, so
`damage × mitigation` is rounded with a dither drawn from the hit roll
(`DamageRules.ditheredHitDamage`) — the average is exact (a 15% reduction
makes 3-damage hits average 2.55) and no extra random number is drawn.

### Secondary weapons — one model in every mode (`src/arcade/weapons/`)

Skirmish, Epic Format, Scenarios, Dogfight, Ace Duel, Boss Raid, Continuous
Tactical, Survival, Campaign and Flight School all run the same runtime
(`SecondaryWeapons`, driven by the Phaser-free `WeaponsDriver` and wired by
`src/scenes/battleUi/BattleWeapons.ts`); a scene only maps its ships to
`WeaponBody`s (`weaponBodies.ts`) and applies `hit` events through its own
shields-then-hull path. The headless sims (skill arena, scenario, duel and
Survival node sims) drive the same `WeaponsDriver`, so the telemetry battery
and the skill gates measure the game with its ordnance. Every scene and sim
runs the weapons step **before** primary fire each frame.

| Weapon | Rule (from the card's `WeaponProfile`) |
|---|---|
| Missile / torpedo | Needs a **lock** on the pilot's target (target within range 3 for one 500 ms cycle; the launch spends it), the target inside the front arc (80°) and the card's range band (default 2–3; config `RANGE_1..3`). Leaves the nose on the ship's heading (the pilot aims the launcher) and steers for its target's intercept point (lead guidance) at the card's turn rate (torpedoes 240°/s, Burst 270°/s, Seeker 330°/s; turn budget ≈ 1.5 s of turning, so Targeting Computer / Rigger add a second chance) — a top-speed head-on pass still shakes a torpedo; at the old 50–140°/s bots landed 5–15% of warheads and ordnance measured as a net loss. On impact the warhead rolls its attack (card damage as dice) against the target's agility with the same odds as turrets and primaries (`calculateHitChance`) — agile interceptors shrug off missiles, as in tabletop. A hit deals card damage × `ORDNANCE_DAMAGE_SCALE` (2: strong but never a one-shot, proton torpedo 10; card texts derive the number from the constant). The launch, and the warhead while it flies, is this attacker's attack on the target (`HitImmunityLedger`): no launch at a target it already hit this cycle — a human's press is held for up to one cycle ("LAUNCH QUEUED") and fires as soon as the cycle clears. |
| Bomb | Dropped astern (one speed-1 template); blasts 2 cycles later, every ship within range 1 (friendly fire). |
| Mine | Dropped astern; arms after a cycle; the first **enemy** touching it sets it off (IFF); the blast hits every ship in reach; fizzles after 45 s. |
| Turret | 360° within its band (default 1–2), the pilot's target first, finite traverse (240°/s), primary-laser dice for its card damage, at most one attack per cycle. Skirmish gunner crew aims it by hand. |
| Cannon | A `realtime` modifier of the primary laser (no separate weapon). |
| Cloak | Only ships whose action bar has `cloak` (Raven, Owl, Specter, Phantom, Shadow); 8 s (+ Phantom Strike), 15 s recharge, attacking breaks it, half damage taken while cloaked, cannot be locked. A bot fires as soon as it can, so cloak duration alone measures ~0 — Phantom Strike also gives +1 laser damage from behind the target. |

Controls: FIRE_SECONDARY (Shift+Space / tap / pad X) fires the selected slot,
WEAPON_CYCLE (Tab / RB) selects the next, CLOAK (C). The HUD weapon bar shows
each slot's kind, charges, reload and lock ring; refusals ("NO LOCK", "OUT OF
ARC", "NO CLOAKING DEVICE"…) flash above the ship. Bots use ordnance through
`src/arcade/ai/OrdnanceDecision.ts`: launch only legal shots, drop devices
only with an enemy close astern and no friend in the blast, cloak when an
enemy has them in its sights.

### Repair (`src/arcade/systems/repair/`)

Every regen / repair knob (`shieldRegenPerSecond`, `hullRepairPerSecond`,
aura regen and hull repair, Survival relics/affixes, Campaign armory and
research, `shieldsPerKill`) is authored in **real-time hit points** (HP/s, HP
per kill) and applied as is — nothing in the repair pipeline multiplies by
`DURABILITY_SCALE`. One shield/hull token is `DURABILITY_SCALE` (12) HP, so a
card that "restores 1 shield every ~100 s" carries 12 / 100 = 0.12 HP/s. Repairs
never exceed max values and never revive a destroyed ship.

Shield regen never pauses. In 1v1 duels it measured ~34 points per HP/s
(≥ 0.72 HP/s wins ~100% of mirror duels — unkillable), so card and pilot
regen stays at 0.06–0.24 HP/s (tested). In 4-ship squads — where every
mode actually fights — focus fire outpaces it: re-measured 2026-10-12 on
every faction's auto-fill mirror (400 battles per rate, calibrated on +1
shield token = 4), 0.12 HP/s = 0.9 pts, 0.24 = 1.6, 0.48 = 2.4 per ship,
and one projector's 0.24 HP/s ally regen = 0.9 squad pts. Prices use the
squad values: 7 per HP/s own, 4 per HP/s allies'.

| Source | Knob / rule | Cards |
|---|---|---|
| Own shield regen | `shieldRegenPerSecond` (no pause) | Repair Rigger (0.12 HP/s), Jury-Rigged Deflectors (0.18), Regenerative Matrix (0.18), campaign Shield Upgrade / Regenerative Shields (0.12 / 0.24) |
| Allies' shield regen | `auraShieldRegenPerSecond`: allies inside the pilot's aura, never the pilot | Mending Light (0.06), Healing Aura (0.12), Mend (0.12), Shield Transfer (0.06) |
| Own hull repair | `hullRepairPerSecond`, paused `HULL_REPAIR_DAMAGE_PAUSE_MS` (3 s) after any hit | Mechanic crew (0.96 HP/s), Patch Rigger (0.6 HP/s) |
| Repair field | Ascendant Aegis Field: shield regen; projected by a support or capital ship it also repairs allied hull at `AURA_HULL_REPAIR_RATIO` (¼) of its rate, same 3 s pause (`src/systems/aura/AuraRepair.ts`) | — |
| Damage control | A capital's emergency repair / power-to-engines order (Skirmish) | — |

Hull repair cards stay below one hull token per 10 s (1.2 HP/s, tested) so repair patches a hull
between engagements and never out-heals incoming fire.

Every repair is reported as a `RepairEvent {shipId, kind: hull|shield, amount,
sourceShipId, sourceKind}` on a `RepairEventChannel`, which folds per-frame
trickles into one pulse per 500 ms per source (the first trickle is delivered
at once). Scenes wire it through `ShipRepairFeedback`
(`src/ui/hud/overlay/`): the per-ship overlay shimmers the restored bar's
edge with a "+", and repair drones fly — from the allied projector for a
repair field, from the ship itself for rigger (1), mechanic crew (2) or
damage control (3); plain shield regen only shimmers.

### Invariants (tested)
- No two cards in the same slot play identically (no reskins at different prices).
- Every turret/ordnance card has a weapon profile; ordnance states its charges.
- Every illicit card pairs its upside with a drawback (stress rate or damage
  taken above 1×, or a negative stat) and is priced below its clean equivalent.
- Aura-granting cards are exactly those with `realtime.projectsAura`.

### Price rule — one scale for cards and pilot abilities (`src/data/abilityPricing.ts`)

A non-weapon card costs `cardPointValue` = its hull/shield tokens × 4 plus the
value of its real-time effect, one point off for illicit gear, at least 1; a
pilot ability costs `abilityPointValue` of the same effect, so a card and an
ability that do the same thing cost the same (tested in `cardPricing.test.ts`:
every non-weapon card's price equals the rule). Weapon cards carry their
measured price.

Calibration (2026-10-12): the skill arena flies two identical hulls (Gladius,
Viper, Falcon) at the Normal tier, one with the effect and one without, 600
battles per effect on fixed seeds, both seatings; win odds convert at 0.285
logit per point, the slope both anchors share (+1 shield token = 4, +1 laser
damage = 5). Ally effects were measured in 3v3. Per unit:

| Knob | Points | Measured |
|---|---|---|
| +1 hull / +1 shield token | 4 | identical (shields spill into hull) |
| +1 laser damage / while unstressed / vs unshielded | 5 / 4 / 3 | HLC 5.0, Marksman 3.6, Predator 2.7 |
| +1 laser dmg at range 1 / behind / bullseye / stressed / damaged | 1.2 / 1.3 / 0.8 / 1.6 / 2.7 | as listed |
| +1 laser dmg with a wingman / in a kill frenzy | 2 / 2 | squad-only (1v1 reads 0) |
| damage taken (per 1.0 of reduction) / with a wingman | 16 / 10 | Stealth Device 15% = 2.4 |
| shield regen / allies' shield regen (per HP/s) | 7 / 4 | Repair Rigger 0.12 HP/s = 0.8 → 1 |
| hull repair (per HP/s, paused after hits) | 5.5 | Mechanic 0.96 = 5.1 |
| stress on hit (per 1.0) / stress relief tier / stress rate | 13 / 1.5 / 2 | Ion Cannon 0.12 = 1.5 |
| boost / barrel roll / Snap turn recharge (per 1.0) | 5 | bots barely use them (~0) |
| ordnance charges / reload / homing° | 2 / 3 / 0.005 | Weapons Engineer 1.8 |
| turret rate of fire (per 1.0) | 5 | Veteran Gunner 1.6 |
| aura projection / radius / strength / ally hit chance / ally relief | 1.5 / 2 / 2 / 10 / 1.5 | Tactical Officer (3v3) ≈ 2 |

Weapon prices (measured on the same mirror): Light / Twin / Ion / Quad turret
4 / 7 / 6 / 9 (Twin and Quad reload in 3 s), Fusion / Ion torpedo 4 / 2,
Burst / Seeker missile 2 / 1, Fusion bomb 1, Quake charge 1, Cluster /
Proximity mine 5 / 3.

### Reach (tested in `QuickBuildReach.test.ts`)

Battles fly quick builds only, so every pilot card and every upgrade card
appears in at least one offered quick build (one with at least one card)
that is legal, live and affordable where its ship flies (a standard 200-point
squad, or Epic for huge hulls). The original catalogue lives in
`src/data/ShipLoadouts.ts`; the builds that fly every remaining pilot and
card, plus the cheap Synthetic swarm builds (initiative 1–2 drones with the
1-point Swarm Uplink), live per faction in `src/data/loadouts/` and are
merged after it (so each ship's default build is unchanged).
`src/data/quickBuildIndex.ts` answers "which builds fly this pilot / card".

## 2. Slots (`SHIP_SLOTS` in `src/data/ShipSlots.ts`)

`SHIP_SLOTS` is the single source of truth for a ship's slot bar. Same-chassis
variants across factions are differentiated by their slot bar (plus hull,
shields, speed, dial and size), not by action lists, which have no real-time
effect. The differentiation rule and the bare-hull price heuristic live in
[ship-variants.md](ship-variants.md).

Structural rule: large and huge hulls carry two modification slots.

Every loadout MUST (tested in `ShipLoadouts.test.ts`, rules in
`src/data/loadoutRules.ts`):
- fit its ship: each upgrade consumes one matching slot (duplicates need
  duplicate slots) and satisfies the card's faction, size and role requirements;
- carry no dead card: no ordnance booster without ordnance, no turret booster
  without a turret;
- differ from every other loadout of the same ship, and have a globally unique id.

## 3. Loadout price and pilots

Every loadout is a quick build: ship + one pilot + upgrades.

`loadout.pointCost = ship.baseStats.pointCost + pilot surcharge + Σ card.pointCost`
(`src/data/loadoutPricing.ts`). The bare-ship price itself comes from the hull
heuristic (`src/data/shipPricing.ts`, [ship-variants.md](ship-variants.md)).

Pilot surcharge (`src/data/pilotPricing.ts`, derived, never authored):
`(initiative − 1) × 1 + abilityPointValue(ability's real-time effect)`
(`src/data/abilityPricing.ts`, same price rule as the catalog; conditional
bonuses are worth less than unconditional ones). A generic initiative-1
rookie costs 0, so the bare-ship price is the price of flying it with a rookie.

- Each pilot card has at most one signature ability. Campaign pilots
  (`CampaignPilot`) are the exception: they level up and collect abilities.
- A pilot card's extra slots (e.g. an ace's talent slot) extend the ship's
  slot bar for that loadout (`slotBarFor`).
- Unique pilots appear in at most one loadout, and at most once per squad
  (`src/data/squadRules.ts`, enforced in the ship picker, AI squad
  generation and quick-build presets). A unique pilot projects a hero aura.
- Quick-build presets list loadout ids only; their total is the sum of the
  loadout prices.

## 4. Pilot abilities in real time (`src/data/pilotAbilityEffects.ts`)

Every ability on a pilot card MUST have a real-time effect (tested in
`pilotAbilityEffects.test.ts`; no two abilities play identically). A
loadout's modifier sheet is its upgrades plus its pilot's ability
(`resolveLoadoutModifiers`).

| Card text | Real-time reading |
|---|---|
| Dice / reroll bonus | laser damage or damage-taken knob |
| "At range 1", "from behind", "bullseye", "while a friendly is near", "while stressed", "while damaged" | conditional knob, judged when the bolt hits (`src/arcade/ShotConditions.ts`) |
| "After you destroy a ship" | shields per kill, or a 4 s laser frenzy |
| "When destroyed" | death blast on enemies at range 1 |
| "Free boost / barrel roll" | faster recharge of that action |
| Acts on friendlies | projects the faction aura; heals / calms friendlies → allies inside the aura regenerate shields / fly a stress tier easier (never the pilot) |
| Psi "Action:" | automatic on a recharge (shield regen, stress per hit) |

Conditional knobs: range 1 (`RANGE_1`), rear arc (±45° behind the
target), bullseye (±10° off the nose), wingman (a friendly within
`RANGE_2`). Hooks live in `src/arcade/PilotAbilityCombat.ts`.

## 5. Showing and choosing quick builds

- **Player-facing summaries are derived, never authored.**
  `summarizeRealtimeEffect` (`src/data/realtimeEffectSummary.ts`) reads any
  real-time effect as one line ("+1 laser dmg from behind the target",
  "boost recharges 40% faster", "projects faction aura"). Every
  `CombatModifiers` knob has a phrase (enforced by the type and tested);
  every pilot ability and every card with `realtime` reads as ≥1 phrase.
- `describeQuickBuild` (`src/data/quickBuildDetails.ts`) gives the pilot
  (name, initiative, unique), the ability (card text + summary), the slot
  bar (ship slots + the pilot's extra slots, each filled or empty) and each
  upgrade's summary (stat bonuses, weapon profile, real-time knobs).
- The ship picker's detail panel shows all of the above for the selected
  build (`src/ui/picker/QuickBuildDetailView.ts`).
- Dogfight, Ace Duel and Survival setup screens let the player cycle each
  of their ships' quick builds (`src/arcade/systems/QuickBuildChoice.ts`). The default pick is exactly
  what `assignQuickBuilds` would hand out, so an untouched chooser changes
  nothing; cycling skips builds whose unique pilot already flies elsewhere
  in the squad. Online Dogfight skips the setup screen and flies defaults.
- The Encyclopedia (`EncyclopediaScene`, data in `src/data/encyclopedia/`)
  browses ships, pilots (ability text + real-time reading + the builds that
  fly them), upgrade cards (grouped by slot, with role / best-with hints and
  requirements) and the five factions (identity, aura, fleet, cheapest
  builds). Sections switch with the tabs or LEFT / RIGHT; the faction chips
  filter (keeping cards every faction may use); typing searches every word
  of an entry (BACKSPACE / DELETE edit the query). Tested in
  `encyclopediaCodex.test.ts` and `tests/e2e/encyclopedia.spec.ts`.
