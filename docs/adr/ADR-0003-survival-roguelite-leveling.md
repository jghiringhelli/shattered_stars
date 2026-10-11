# ADR-0003 — Survival roguelite: choice-based leveling + squad threat scaling

- **Status:** Accepted — leveling, branches and threat stand; the run structure (endless
  waves, per-wave escort track, Hangar every 5th wave) is **superseded by
  [ADR-0004](ADR-0004-survival-roguelite-run-structure.md)** (sector map, relics, shops,
  meta-progression).
- **Date:** 2026-08-25
- **Deciders:** Project owner (jghiringhelli)
- **Related:** [ADR-0002](ADR-0002-player-progression.md), [ADR-0004](ADR-0004-survival-roguelite-run-structure.md), [docs/specs/progression.md](../specs/progression.md), `src/scenes/SurvivalScene.ts`
- **Inspiration:** Heroes of the Aturi Cluster 2nd Edition (Experience Tree add-on + Rulebook)

## Context

### What survival did before this ADR (historical)
`SurvivalScene` was a **credits shop**: each wave granted credits, and between waves the
player could buy *several* upgrades if affordable (attack/defense/speed/repair/recruit,
each with a `cost`). Difficulty was a **fixed wave table** (1–5 basic, 6–10 mixed, 11–15
elite, 16–20 epic, 21+ endless; boss every 5th). Both were removed by this ADR; the
fixed table no longer exists anywhere in the code.

Problems: credit accounting is bookkeeping, not a decision; buying "everything you can
afford" is not a build; difficulty ignores how strong the player's fleet actually is.

### What HotAC 2nd Edition actually does (from the extracted PDFs)
- **One currency = Squad Points.** Earned per mission, spent on ships, upgrades, *and*
  experience levels. No separate XP vs money.
- **Experience Tree (add-on):** 5 discrete levels (green → yellow → orange → purple → final).
  Each level unlocks fixed **capabilities** (initiative, upgrade slots, force capacity,
  linked actions, extra charges).
- **Branching at level 3:** the pilot must commit to one of three paths — **Engineering**
  (tech/mods), **Aviator** (dogfighting/maneuver), **Force** — chosen once, permanent.
- **Milestone rewards:** the *final* level of each path unlocks **Master Upgrades** (one
  per path). Ship acquisition itself is gated to level ≥ 2.
- **Difficulty scales with the squad, not the mission:** enemy count/threat is driven by
  the number and strength of Rebel pilots (the "Will of the Emperor" / automated-ship setup
  scales to the players), which is exactly the model the owner asked for.

### What the owner wants (this ADR)
> "en vez de xp por enemigo simplemente el jugador elige un poder por nivel, con niveles
> que terminan en 0 o 5 permitiendo agregar escoltas, saltar o evolucionar la nave, etc.
> En el medio mejoras, mas danio, etc."

So: drop per-enemy XP accounting; **level = one choice**; **milestone levels (÷5)** offer
run-shaping picks (escort / jump / evolve); **regular levels** offer incremental buffs.

## Decision

### 1. Level = wave cleared, and each level is a single draft choice
**Credits are removed** from the progression loop entirely (kept only as a cosmetic score /
leaderboard number, never spent). Clearing a wave advances the run **level** by 1 and
immediately presents a **draft**: draw `DRAFT_SIZE` (**3**) distinct powers from the
appropriate pool; the player picks **exactly one**. No costs, no multi-buy. There is no
free reroll — but a **Reroll charge** can be *won as a power* in the run (see §2c), spent
later to redraw a draft.

### 2. Two pools: regular vs milestone
- **Regular level** (`level % 5 !== 0`): draw from the **incremental pool** — more damage,
  more hull, faster fire, shield regen, better turn rate, emergency repair, etc. Small,
  stackable, build-defining over a run.
- **Milestone level** (`level % 5 === 0`, i.e. ending in 0 or 5): a **Hangar** choice — the
  big, run-shaping decisions:
  - **Saltar (Graduate ship)** — *"saltar"* is River-Plate slang for **moving to another
    ship**. Switch your flagship hull to a different one. Each hull **amplifies certain
    branches** (§2b) — the ship is the multiplier, the powers are the build.
  - **Add Escort** — recruit an AI wingman; its kind scales off your current hull and
    branch investment (a light build gets cheap swarm escorts; a carrier gets mini-spawns;
    an ace gets one strong wingman).
  - **Evolve current ship** — deepen the hull you already fly instead of switching.

Milestone waves already coincide with **boss waves** (`wave % 5 === 0`), so the Hangar
choice is the post-boss reward — thematically clean.

### 2b. Power branches, not fixed archetypes
> The turret→ace→carrier examples the owner gave are **illustrative, not a literal
> taxonomy.** The system is built from orthogonal **branches**; archetypes *emerge* from
> how a run invests, so the space of viable endgames is open-ended rather than a fixed list.

Powers belong to a small set of **branches** (power axes). A first cut (to be tuned):

| Branch | Fantasy | Sample atoms |
|---|---|---|
| **Gunnery** | raw primary firepower | +damage, +crit, +range, focus |
| **Ordnance** | missiles / torpedoes / bombs | ammo, reload, splash, homing |
| **Automation** | turrets / drones / remotes | auto-fire arcs, drone count |
| **Fleet** | escorts / spawns / swarm | +escort, mini-spawns, formation buffs |
| **Bulwark** | survivability | +hull, +shields, regen, evasion |
| **Drive** | mobility / energy | speed, boost, energy actions, reroll charge |

**Hull graduation biases branches, not builds.** Each hull applies a **multiplier** to a
couple of branches (e.g. a medium gunship amplifies Ordnance + Automation; an interceptor
amplifies Gunnery + Drive; a capital amplifies Fleet + Bulwark). Saltar = re-pick your
multipliers; the powers you've banked keep working, they just scale differently.

**Pure vs cross (the key rule).** Investing **deep in one branch** unlocks that branch's
**capstone** (a strong pure-path payoff). Investing to a threshold in **two branches**
unlocks **cross powers** — unique hybrids only available to a split build (e.g.
Ordnance×Automation = *Saturation Barrage*; Fleet×Gunnery = *Wing Commander*;
Bulwark×Drive = *Phase Runner*). This is the owner's explicit ask: reward the player who
**chose two paths at once** instead of going *parejo*, with powers a single-branch build
can never see. Pure = reliable spike; cross = rarer, weirder, higher ceiling.

**Branch-jump.** Occasionally a milestone Hangar offers a **branch-jump**: shift banked
investment from one branch toward another (a soft respec), so a run can pivot rather than
be locked from the first pick. Graduation is therefore *guided but not rigid* — there are
distinct lanes, periodic off-ramps, and hybrid rewards for straddling them.

**Balance principle (roguelite):** every *individual* atom is tuned to roughly **equal**
power, so no pick is a trap or an auto-take. **Synergy** (branch depth, hull multiplier,
cross-power thresholds) is what creates spikes and identity. Uneven synergies, even atoms.

### 3. Threat scales with squad power, not the wave number (HotAC model)
Replace the fixed wave table's role in *difficulty* with a **threat score** computed from
the current fleet: `threat = f(shipCount, level, evolutions, cumulative buffs)`. The wave
spawner sizes/compositions the enemy wave to match `threat` (the wave *theme* table can
stay for flavour; the *quantity/strength* comes from threat). This directly implements the
owner's earlier "sube la dificultad en squads más que en misiones."

### 2c. Reroll as an earned power
Reroll is not a currency purchase. A **Reroll charge** is one of the Drive-branch atoms the
player can draft; holding one lets them redraw a future draft once. Keeps the no-credits
rule intact while giving build agency to players who invest in it.

### 4. Powers are pure data (mirror ProgressionData)
Add `src/data/SurvivalPowers.ts` — a **pure** module: branch-tagged `Power[]` (regular
atoms, branch capstones, and cross powers gated by two-branch thresholds), each
`{ id, branch, name, description, icon, requires?, apply(state) }`, plus a seedable
`drawPowers(pool, size, rng, state)` that filters by unlocked prerequisites (capstones/
cross powers only appear once their branch thresholds are met). No Phaser, no I/O —
trivially unit-testable, deterministic given a seeded RNG. `SurvivalScene` becomes a thin
consumer: on wave clear it calls `drawPowers`, renders the choice, applies the picked
power's effect. Threat lives in `src/data/SurvivalThreat.ts` (pure `computeThreat(fleet)`
+ `sizeWave(threat, waveTheme)`).

### 5. Determinism for the verify-loop
The draft RNG is seedable so `verify_loop.ts` survival-solo can drive a fixed sequence of
picks and assert the run is reproducible (aligns with the deterministic-replay gate).

## Consequences

- Leveling becomes a **decision**, not bookkeeping — the core roguelite hook.
- One data file tunes the whole power economy; UI and scene stay thin (SRP).
- Threat-by-squad makes bigger fleets genuinely harder, ending the "recruit = free power"
  problem in the current shop.
- Pure powers + seeded draft = no mocks, deterministic tests, verify-loop reproducibility.
- Migration: the credits shop code path is replaced, not extended; existing
  attack/defense/speed/repair effects are **reused** as regular-pool powers (no waste).

## Decisions locked (owner, 2026-08-25)

1. **Saltar** = graduate to another hull; hull biases branches, not builds (§2, §2b).
2. **Credits removed** from the loop; cosmetic score only.
3. **Draft size = 3**; no free reroll — Reroll is an earned Drive-branch power (§2c).
4. **Guided-but-not-rigid paths:** distinct branch lanes, periodic **branch-jump**
   off-ramps, and **cross powers** that reward straddling two branches instead of going
   pure/parejo (§2b). Archetypes are emergent, not a fixed list.

## Remaining tuning (not blocking implementation)

- Exact branch count and the two-branch thresholds that gate cross powers.
- Per-hull branch multipliers (which hull amplifies which two branches).
- Threat curve coefficients (`computeThreat`) — calibrated later via headless sim.

## Addendum (2026-08, escort redesign) — parallel escort progression

The first escort model made stacking escorts a **runaway strategy**: in the balance sim
`fleetPower` multiplied *both* offense and durability by the ship count, so every escort was
effectively a full copy of the fully-upgraded flagship, and the escort-heavy archetype
(`brawler`) hit the level cap at p90. Escorts also competed *inside* the same power draft
(the `fleet_escort` atom + the Hangar's escort option), so "recruit" repeatedly beat any
single-ship buff.

**Decision (owner):** split progression into **two parallel decisions per wave**:

1. **Ship / powers track** — the existing 3-card power draft, now **100% about your own
   ship**. The escort-granting atom (`fleet_escort`) and the Hangar's escort option are
   **removed** so the draft never trades your ship's growth for a body.
2. **Escort track** — a separate parallel choice each wave: **Recruit Escort** (`+1`
   escort, capped at `MAX_ESCORTS = 5`) vs **Hold Formation** (bank a reroll charge).
   Escorts are **weak, basic bodies** — the faction's cheap starter ship — that do **not**
   inherit the flagship's drafted bonuses.

**Quantity vs quality (owner):** the escort pick only grants **quantity**. Escort **quality
scales with support investment** — the **fleet branch depth** and the **carrier hull** —
via `escortQualityMultiplier(state) = 1 + fleet·ESCORT_FLEET_SCALE + (carrier ? ESCORT_CARRIER_BONUS : 0)`.
Total fleet power becomes `fleetPower(bonuses, 1) + escorts·ESCORT_UNIT_POWER·quality`
(escorts capped). Without support, more escorts = more weak bodies (diminishing returns);
with a support build (fleet/carrier), the wing becomes worthwhile — escorts are a payoff for
the support playstyle, not a universal auto-take.

**New code:** `src/data/survival/escorts.ts` (pure: constants, `escortQualityMultiplier`,
`escortFleetPower`, `escortOptions`, `applyEscortOption`); `SurvivalRunController` gains
`draftEscort()` / `chooseEscort()`; `DraftPolicy` gains `pickEscort()`; `SurvivalScene`
presents the two panels sequentially each wave and spawns escorts as basic bodies without
flagship bonuses. Anti-runaway invariant locked by unit test (brawler `p90 < SIM_MAX_LEVEL`).
Post-redesign sweep (400 runs/policy): medians 4–5, p90 7–14, no policy near the cap.

## Addendum (2026-10) — roguelite run structure (ADR-0004)

The leveling model above is now the **in-battle build layer** of a structured roguelite run
(see [ADR-0004](ADR-0004-survival-roguelite-run-structure.md)):

- Drafts happen **on the sector map after each battle node**, not after every wave. The
  power draft gains a **Reroll** card that actually **spends** a reroll charge (the old run
  awarded charges but never consumed them — fixed; `SurvivalRunController.rerollDraft()`
  also consumes them) and a **Skip** card (+salvage).
- The **Hangar** is the reward of each **sector boss**, alongside a rare relic and (sectors
  1–2) a mutation.
- The per-wave **escort track** is not offered in the roguelite flow; escorts come from
  shops, events, the *Wing Commander* cross power and meta escort packages. `escorts.ts`
  stays as the escort quality/power model and for the balance sim's draft policy.
- *Wing Commander* now respects `MAX_ESCORTS` (it used to push the run past the cap).
- **Credits stay removed from leveling.** The roguelite's **salvage** is a *route* economy
  (shops, repairs) — it never buys powers, so §1's "a level is one decision" holds.
- The Drive branch's `speed` bonus (Thruster Tuning, Formation Drills +1, Afterburners +3)
  is a real flight effect again, through the equipment path: the first point is +1
  top-speed notch (`maxSpeedBonus`, capped one notch above the dial), every further point
  multiplies boost recharge by 0.85 (floor 0.4). `SurvivalScene.applyBonusesToFleet` folds
  it into each player ship's base sheet and re-applies it to the flight from the hull's
  unmodified control state (`runFlightEquip`) — idempotent, identical for the flagship and
  the bot-flown escorts. The balance sim values it via `driveMobility`.
