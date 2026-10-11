# Spec — Ship variants and hull pricing

Same-chassis ships across factions (Viper / Kestrel / Talon, Stiletto / Venom /
Cherub, …) must **play differently** and be **priced by one rule**. Before this
spec the roster had exact copies at different prices and cheaper copies that
were strictly better (audit: phase 5 of the ship-variants plan).

## 1. Differentiation rule

A variant differs from every other ship of its role on at least one lever that
weighs in real-time play:

| Lever | Where it lives | Read by |
|---|---|---|
| Hull, shields | `baseStats` | every mode |
| Attack, agility | `baseStats` | dice modes via `ModeBalancing` (skirmish clamps lasers) |
| Speed bounds | `baseStats.speed` | flight control (`createControlState`) |
| Dial | `SHIP_DIALS[shipId]` | real-time stress (`ArcadeStress.accrueCycleStress`), Q/E turn speed |
| Size | `baseStats.size` | template length per cycle and hitbox (`SHIP_SIZES`) |
| Slot bar | `SHIP_SLOTS[shipId]` | which loadouts the hull can field |

**Action lists are flavour.** No real-time system reads `baseStats.actions`
(boost, barrel roll, cloak… are available to every ship), so actions may be
themed but never differentiate or price a variant.

**Variant dials** are a base dial with one or two maneuvers retuned, built with
`tuneDial(base, tweaks)` in `ShipDefinitions.ts` (banks and turns change on
both sides). Only the cells the stress model reads count: straight, bank and
turn at each speed inside the ship's speed band; a missing cell is red.

## 2. Hull pricing heuristic (`src/data/shipPricing.ts`)

```
expected = anchor(role).pointCost
         + Σ (lever − anchor lever) × unit value
```
rounded to whole points. Each role has one anchor (`ROLE_ANCHORS`), a reference
profile taken from a shipped ship and priced at the role's roster-calibrated
median. Role-intrinsic behaviour (support/capital aura, ModeBalancing role
modifiers) is identical across a role, so it lives in the anchor price.

| Lever | Points | Source |
|---|---|---|
| +1 hull | 3 | Hull Upgrade |
| +1 shield | 4 | Shield Upgrade |
| +1 attack | 5 | Heavy Laser Cannon floor |
| +1 agility | 4 | between Evasion Configuration and Stealth Device |
| +1 top speed | 4 | `maxSpeedBonus` (abilityPricing) |
| −1 minimum speed | 2 | half a top-speed step |
| +1 dial step | 4 / 11 ≈ 0.36 | a stress-relief tier (4 pts) eases ≈ 11 cells |
| +1 size class | 4 | roster fit (best fit 4–5) |
| Capital hull / shield | × 1/3 | capital pools are ~6× a fighter's; roster fit |

A **dial step** is one stress cell one difficulty greener: each cell scores
green 2, white 1, red/missing 0 (`dialSteps`, `src/data/dialPermissiveness.ts`).

**Not priced:** action lists (flavour) and the slot bar (every card is paid
for by the loadout — variants trade slots, they do not buy them).

| Role | Anchor ship | Profile (h/s/a/ag, speed, size, dial steps) | Price |
|---|---|---|---|
| light_fighter | terran_stiletto | 2/2/2/3, 1–5, tiny, 11 | 25 |
| interceptor | terran_viper | 3/2/3/3, 1–5, small, 13 | 46 |
| heavy_fighter | terran_centurion | 5/3/3/2, 1–4, small, 10 | 56 |
| bomber | terran_hammer | 5/3/3/1, 1–3, medium, 9 | 58 |
| support | confed_crane | 4/4/1/1, 1–3, medium, 7 | 49 |
| gunship | terran_vindicator | 6/4/4/1, 1–3, medium, 6 | 70 |
| capital | terran_imperator | 36/24/5/0, 0–2, huge, 4 | 118 |

**Tolerance:** an authored `pointCost` may sit at most
`max(3, round(5% × expected))` points from the heuristic — room for a hand
nudge of one stat step on a fighter, proportionally more on a capital.
Loadout prices are derived from `pointCost` (`loadoutPricing.ts`), so a hull
price change flows into every build and preset automatically.

## 3. Invariants (tested in `tests/unit/data/ShipVariants.test.ts`)

- No two ships of the same role are identical in hull, shields, attack,
  agility, armour, speed bounds, dial cells, size and slot bar (with charges).
- No ship matches or beats another of its role on every lever (dial cell by
  cell, slot bar as a multiset) at the same or a lower price.
- Every ship's `pointCost` is within tolerance of the heuristic.
- Each role anchor still matches its reference ship's profile and price.

## 4. Adding or changing a variant

1. Pick the levers that make it play differently (a stat trade, a dial tweak
   via `tuneDial`, a speed bound, a slot swap).
2. Set `pointCost` to `expectedPointCost(role, stats, dial)`.
3. If its slot bar changed, repair its loadouts (`ShipLoadouts.test.ts`), and
   re-check quick-build presets against their point limits.
4. Run `tests/unit/data`, `tests/balance` and
   `npx tsx scripts/headless_sim.ts --matrix --battles 500`.
