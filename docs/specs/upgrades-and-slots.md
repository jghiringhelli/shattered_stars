# Spec — Upgrade catalog, slots and loadouts

Inspired by X-Wing Miniatures (TMG): a fixed-price catalog of upgrade cards
grouped by category; each ship has a slot bar saying which categories it can
carry; the player picks predefined loadouts (quick builds), and a loadout's
price is derived from its contents — never authored.

## 1. Catalog (`src/data/upgrades/`)

Categories (`UpgradeSlotType`): modification, configuration, title, sensor,
tech, cannon, turret, missile, torpedo, bomb, crew, gunner, astromech,
talent, illicit. `force_power` is reserved for Ascendant pilot cards.

Every card MUST change real-time combat (tested in `UpgradeCatalog.test.ts`):

| Card kind | Where its effect lives | Read by |
|---|---|---|
| Stat cards (hull, shields) | `effects.hullBonus/shieldBonus` | every mode (`applyLoadoutEffects`) |
| Attack/agility dice | `effects.attackBonus/agilityBonus` | every mode (ModeBalancing dice) — never on a card that already has the equivalent `realtime` knob |
| Behaviour cards | `realtime` → `CombatModifiers` (`src/core/CombatModifiers.ts`) | every mode |
| Turret / ordnance | `weapon` → `WeaponProfile` (damage, reload, `rangeBand`, homing, `device`) | `src/arcade/weapons` (every mode) |

`CombatModifiers` knobs: laser damage (flat, calm-only, vs unshielded), damage
taken, shield regen, hull repair, maneuver stress rate and relief tiers, boost / barrel
roll / K-turn recharge, ordnance reload / charges / homing, turret rate of
fire, stress inflicted per laser hit, cloak duration, aura projection and aura
radius (command cards widen the aura on ships that already project one).
Stacking: additive bonuses sum, multipliers multiply, then clamp
(damage taken ≥ 0.5×, recharge ≥ 0.4×, stress rate ≥ 0.5×, relief ≤ 2 tiers,
aura radius ≤ +50%).

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
| Missile / torpedo | Needs a **lock** on the pilot's target (target within range 3 for one 500 ms cycle; the launch spends it), the target inside the front arc (80°) and the card's range band (default 2–3; config `RANGE_1..3`). Leaves the nose on the ship's heading (the pilot aims the launcher) and steers for its target's intercept point (lead guidance) at the card's turn rate — torpedoes track slowly, a hard break still shakes a missile. On impact the warhead rolls its attack (card damage as dice) against the target's agility with the same odds as turrets and primaries (`calculateHitChance`) — agile interceptors shrug off missiles, as in X-Wing. A hit deals card damage × `ORDNANCE_DAMAGE_SCALE` (10: a decisive strike, proton torpedo 50). The launch, and the warhead while it flies, is this attacker's attack on the target (`HitImmunityLedger`): no launch at a target it already hit this cycle — a human's press is held for up to one cycle ("LAUNCH QUEUED") and fires as soon as the cycle clears. |
| Bomb | Dropped astern (one speed-1 template); blasts 2 cycles later, every ship within range 1 (friendly fire). |
| Mine | Dropped astern; arms after a cycle; the first **enemy** touching it sets it off (IFF); the blast hits every ship in reach; fizzles after 45 s. |
| Turret | 360° within its band (default 1–2), the pilot's target first, finite traverse (240°/s), primary-laser dice for its card damage, at most one attack per cycle. Skirmish gunner crew aims it by hand. |
| Cannon | A `realtime` modifier of the primary laser (no separate weapon). |
| Cloak | Only ships whose action bar has `cloak` (Raven, Owl, Specter, Phantom, Shadow); 8 s (+ Phantom Strike), 15 s recharge, attacking breaks it, half damage taken while cloaked, cannot be locked. |

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
card that "restores 1 shield every ~8 s" carries 12 / 8 ≈ 1.44 HP/s. Repairs
never exceed max values and never revive a destroyed ship.

| Source | Knob / rule | Cards |
|---|---|---|
| Own shield regen | `shieldRegenPerSecond` (no pause) | Repair Astromech (R2-style, 1.44 HP/s), Jury-Rigged Deflectors, Regenerative Shields, ability regen |
| Own hull repair | `hullRepairPerSecond`, paused `HULL_REPAIR_DAMAGE_PAUSE_MS` (3 s) after any hit | Mechanic crew (0.96 HP/s), Patch Astromech (R5-style, 0.6 HP/s) |
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
repair field, from the ship itself for astromech (1), mechanic crew (2) or
damage control (3); plain shield regen only shimmers.

### Invariants (tested)
- No two cards in the same slot play identically (no reskins at different prices).
- Every turret/ordnance card has a weapon profile; ordnance states its charges.
- Every illicit card pairs its upside with a drawback (stress rate or damage
  taken above 1×, or a negative stat) and is priced below its clean equivalent.
- Aura-granting cards are exactly those with `realtime.projectsAura`.

### Price rule (fixed point values)
+1 hull = 3 · +1 shield = 4 · +1 laser damage = 5 (cannon) or 3 with a drawback ·
40% faster recharge on one maneuver = 3 · 15% less damage taken ≈ 5–6 ·
aura projection = 4 · trade-off configuration = 2 · illicit = clean equivalent − 1 ·
shield regen ≈ 1.44 HP/s = 4 · hull repair (out of fire) 0.6 HP/s = 3, 0.96 HP/s = 4.

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
| Acts on friendlies | projects the faction aura |
| Force "Action:" | automatic on a recharge (shield regen, stress per hit) |

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
  of their ships' quick builds (`src/ui/QuickBuildChooser.ts`,
  `src/arcade/systems/QuickBuildChoice.ts`). The default pick is exactly
  what `assignQuickBuilds` would hand out, so an untouched chooser changes
  nothing; cycling skips builds whose unique pilot already flies elsewhere
  in the squad. Online Dogfight skips the setup screen and flies defaults.
