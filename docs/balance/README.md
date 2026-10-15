# Balance — real-engine harness and the 2026-10-12 pass

All numbers come from the game's own real-time code paths, never from the legacy abstract dice
simulator (`scripts/headless_sim.ts`, kept as legacy):

| Mode | Sim | What it runs |
|---|---|---|
| Classic squads | `src/simulation/skill` (SkillArena, arenaLoop) | BotPilots through the player's controls, SquadCommand + marks, CycleFlight, dice combat, quick-build secondaries (WeaponsDriver), own repair and faction auras (simAuras) |
| Reinforced Skirmish / Scenario | `ReinforcedBattleSim` | the arena + the pure `ReinforcementDirector` wired like `ReinforcementController` (picker answered at once) |
| Classic Scenario | `ScenarioMatchSim` | the arena + ScenarioDirector / ScenarioFrameTracker / stepScenario |
| Dogfight / Ace Duel | `DuelTempoSim` | DuelBotCrew, builds + secondaries, Ace sheet and ad-hoc abilities, regenerative shields per cycle |
| Survival | `SurvivalRunSim` (`npm run telemetry:survival`) | whole runs, ADR-0004 |

- **CI guardrails** (`tests/balance`, fixed seeds, ~30 s): Ace presets (each 30–70 % at 24 rounds),
  Skirmish factions (each 30–70 %, lists ≤ 200 flown points), reinforced battle shape, difficulty curve
  (strictly harder each step), Dogfight default pairing (±10 %).
- **Full report**: `npm run balance:report [-- --sections classic,ace --scale 0.5]` writes
  [latest.md](./latest.md) (factions classic / reinforced / presets, Ace presets, Dogfight, difficulty per
  mode, scenarios, value per point of every Skirmish hull; Wilson 95 % intervals). ~8 min on 24 cores.
  Before-levers baseline: [baseline-2026-10-12.md](./baseline-2026-10-12.md).

## Before → after (average v average unless noted)

| Metric | Before | After |
|---|---|---|
| Skirmish AI squads (as flown) | 258–266 pts of "200" | 185–200 |
| Role value vs trend (gunship / interceptor / bomber) | +30 / −29 / −19 % | −4 / −2 / −1 % |
| Hulls outside ±15 % value per point | 46 / 82 | 4 / 82 |
| Classic factions TH / FC / SC / VC / AE | 68 / 7 / 34 / 60 / 81 % | 52 / 47 / 55 / 48 / 48 % |
| Reinforced factions | 78 / 2 / 54 / 33 / 84 % | 45 / 60 / 43 / 47 / 55 % |
| 200-pt presets | 68 / 3 / 74 / 61 / 45 % (totals 160–192) | 53 / 46 / 57 / 42 / 53 % (totals 185–200) |
| Ace presets in 40–60 % (avg, expert) | 2 / 12 cells | 10 / 12 cells (misses 64 %, 64 %) |
| Difficulty Dogfight E / N / H / B | 96 / 57 / 13 / 2 % | 81 / 38 / 15 / 6 % |
| Difficulty classic squads | 88 / 46 / 23 / 19 % | 91 / 50 / 18 / 11 % |
| Reinforced scenario medians | 66–142 s | 149–153 s |
| Survival run win (A0) | 16 % (after unification) | 25–31.5 % |

## Levers changed and why

1. **Hull pricing on real-time stats** (`shipPricing.ts`, `ModeBalancing.combatStatsFor`): role modifiers
   and rounding decide what a ship is in play (Venom's card 3/1/2/3 flew as 12 HP); prices now read those
   values. Unit values: hull 5, shields 8, damage 10, agility 2 per real-time point; anchors calibrated on
   the value sweep (gunship 70→90, interceptor 46→43, light fighter 25→37, bomber 58→53, support 49→53).
   Every hull repriced (spec: docs/specs/ship-variants.md); variant gates now compare real-time stats.
2. **Real stat differences** where real-time twins dominated each other: dial tweaks (Stiletto, Viper,
   Centurion, Vindicator, Pelican, Acolyte, Glory), Smiter attack 4, Paladin agility 3, Stiletto agility 4
   (Dogfight pairing), Venom hull 4 / shields 2, Albatross attack 4 and its authored 0–4 speed band.
3. **Dials**: rows above a ship's top speed are cut (17 ships); Javelin gets a white speed-4 straight.
4. **Skirmish pricing**: squads cost what they fly (`flownSquadCost`); the AI fields its faction's curated
   200-pt preset (`autoFillSquad`), each preset ≤ 200 with an aura projector where the faction has one.
5. **Presets re-authored** (all 20 fit; FC/VC "balanced" plans rebuilt — no 2× Albatross, no 2× Tender);
   `getPresetSquads` (unused, over the limit) deleted.
6. **Aegis Field** 2.4 → 0.4 HP/s (AE won 80 % of reinforced battles on regen alone; 0.3–0.4 → ~50 %).
7. **Ace presets**: Raptor→Legionnaire, Fang→Phantom, capitals→Eradicator v Judgment, Thunderbolt/Condor→
   Hammer/Pelican; `regenerative_shields` (24 HP/s) dropped from presets.
8. **Difficulty**: Easy novice ×0.7, Hard expert ×1.75, Brutal expert ×1 (`BotDifficulty.ts`).
9. **Reinforced scenario thresholds** 50/50/75/75 → 70/75/75/85 (medians ~2:30).
10. **Survival** `BASE_ENEMY_HULL_MULTIPLIER` 0.7 → 0.55 (ADR-0004).
11. **Bug**: a hull-removing card could spawn a 0-HP ship (`applyLoadoutEffects` floor).

## Open

- Pairwise reinforced matchups still range 28–73 % at 40 games (faction totals are in band); the AE/TH and
  FC/AE pairs are aura-driven — see the faction-aura request (TH aura needs formation, VC aura is inert).
- Reinforced and Scenario Hard/Brutal are 0–2 % for an average bot: expert squads compound over a 3-minute
  attrition match whatever their reaction scale. Needs a squad-mode mapping in the scene code (e.g. Hard =
  average tier with expert aim there).
- Scenario seat bias: the enemy seat wins 57–64 % in Scramble (classic) and ~55–60 % in Chance / Salvage;
  geometry is symmetric — look at ScenarioDirector / scoring order.
- Easy squads are 91–100 % (target ~80): novice squads never mark, so reaction alone cannot close it.
- Survival node length median 16–19 s (target 45–90 s), owner decision pending.

## Round 4 (2026-10-15)

Work log, grids and before/after tables: [round4-notes.md](round4-notes.md). Reproduce the Survival baseline with
`npm run telemetry:survival -- --runs 300 --mixed` (every faction's starter in turn). Tuning tables the sweeps patch in memory:
`ASCENSION_TUNING`, `PLAN_TUNING`, `RECOVERY_TUNING`, `STARTER_KITS` (Survival), `AURA_STACKING`, `STRATEGY_TUNING`, `SKIRMISH_QUOTAS`,
`SCENARIO_TUNING`, `PLANNER_TUNING`. Headless Survival runs accept `start` / `claim` hooks (force a relic / power / mutation).