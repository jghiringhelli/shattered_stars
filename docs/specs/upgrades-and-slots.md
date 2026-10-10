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
effect.

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
(`src/data/loadoutPricing.ts`).

Pilot surcharge (`src/data/pilotPricing.ts`, derived, never authored):
`(initiative − 1) × 1 + ability.pointCost`. A generic initiative-1 rookie
costs 0, so the bare-ship price is the price of flying it with a rookie.

- Each pilot card has at most one signature ability. Campaign pilots
  (`CampaignPilot`) are the exception: they level up and collect abilities.
- A pilot card's extra slots (e.g. an ace's talent slot) extend the ship's
  slot bar for that loadout (`slotBarFor`).
- Unique pilots appear in at most one loadout, and at most once per squad
  (`src/data/squadRules.ts`, enforced in the ship picker, AI squad
  generation and quick-build presets). A unique pilot projects a hero aura.
- Quick-build presets list loadout ids only; their total is the sum of the
  loadout prices.
