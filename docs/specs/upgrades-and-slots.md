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
| Attack/agility dice | `effects.attackBonus/agilityBonus` | dice-based modes (ModeBalancing) |
| Behaviour cards | `realtime` → `CombatModifiers` (`src/core/CombatModifiers.ts`) | arcade scene |
| Turret / ordnance | `weapon` → `WeaponProfile` | `ArcadeTurret`, `ArcadeOrdnance` |

`CombatModifiers` knobs: laser damage (flat, calm-only, vs unshielded), damage
taken, shield regen, maneuver stress rate and relief tiers, boost / barrel
roll / K-turn recharge, ordnance reload / charges / homing, turret rate of
fire, stress inflicted per laser hit, cloak duration, aura projection and aura
radius (command cards widen the aura on ships that already project one).
Stacking: additive bonuses sum, multipliers multiply, then clamp
(damage taken ≥ 0.5×, recharge ≥ 0.4×, stress rate ≥ 0.5×, relief ≤ 2 tiers,
aura radius ≤ +50%).

### Invariants (tested)
- No two cards in the same slot play identically (no reskins at different prices).
- Every turret/ordnance card has a weapon profile; ordnance states its charges.
- Every illicit card pairs its upside with a drawback (stress rate or damage
  taken above 1×, or a negative stat) and is priced below its clean equivalent.
- Aura-granting cards are exactly those with `realtime.projectsAura`.

### Price rule (fixed point values)
+1 hull = 3 · +1 shield = 4 · +1 laser damage = 5 (cannon) or 3 with a drawback ·
40% faster recharge on one maneuver = 3 · 15% less damage taken ≈ 5–6 ·
aura projection = 4 · trade-off configuration = 2 · illicit = clean equivalent − 1.

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
