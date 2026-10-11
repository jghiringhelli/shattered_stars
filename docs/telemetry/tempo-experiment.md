# Tempo experiment — cycle length and special recharge

**Question (user):** "If our turn cycle and special actions were somewhat longer, maybe a normal match
would be less short." Does a longer maneuver cycle and/or slower special-action recharge lengthen
matches, and does it cost skill expression?

**Method.** No game constant was changed. The headless sims (DuelTempoSim, skill arena) were
parametrised with a `TempoVariant` (`src/simulation/TempoVariant.ts`): flight, AI and squad orders
run on a *flight clock* scaled by k = 500 / cycle (every cycle keeps its template displacement but lasts
longer in real time), while everything defined in real milliseconds is converted onto that clock —
weapon intervals, hit immunity, shield regen, special recharge and bot reaction/decision time (a human
does not react faster because the cycle is longer). Stress accrues per cycle at the variant's length.
At the engine tempo the sims replay the engine bit for bit (`tests/simulation/tempoSims.test.ts`).

Grid: cycle 500 / 625 / 750 ms × K-turn/Segnor/Tallon + boost + barrel-roll recharge ×1 / ×1.5 / ×2,
attack cap tied to the cycle (one attack and one hit-immunity window per cycle, as the engine does),
plus two control variants where the cycle is longer but the attack cap stays at 500 ms ("fixed").
Per variant: 480 Dogfight rounds (Falcon v Raptor, average v average), 320 squad battles (4v4 Skirmish
lists, average v average, both sides coordinated), 1 200 gate-1 duels (expert v novice over 24 sampled
fighter pairs incl. the hardest price premiums), 480 gate-2 battles (coordinated average squad v solo
experts, every faction). Reproduce: `npm run telemetry:tempo -- --scale 10` (≈5 min on 22 workers);
raw output in [tempo-experiment-data.md](tempo-experiment-data.md).

## Results

| cycle | specials | attack cap | duel median · mean (Δ mean) | duel DPS | squad median · mean (Δ mean) | squad first kill | squad DPS | specials / ship·min | gate 1 (≥85%) | gate 2 (≥70%) |
|---|---|---|---|---|---|---|---|---|---|---|
| **500** | **×1** | cycle | **45s · 48s** | 1.25 | **29s · 37s** | 5s | 6.27 | 3.4 | 100% | 83% |
| 500 | ×1.5 | cycle | 51s · 53s (+12%) | 1.10 | 31s · 41s (+10%) | 5s | 5.72 | 2.6 | 99% | 83% |
| 500 | ×2 | cycle | 60s · 60s (+27%) | 0.98 | 34s · 42s (+12%) | 5s | 5.65 | 2.3 | 99% | 81% |
| 625 | ×1 | cycle | 53s · 56s (+17%) | 1.12 | 30s · 41s (+10%) | 6s | 5.71 | 3.4 | 97% | 84% |
| 625 | ×1.5 | cycle | 62s · 63s (+33%) | 0.97 | 39s · 47s (+27%) | 6s | 5.02 | 2.5 | 98% | 74% |
| 625 | ×2 | cycle | 64s · 66s (+40%) | 0.91 | 41s · 49s (+31%) | 6s | 4.86 | 2.1 | 97% | 77% |
| 750 | ×1 | cycle | 67s · 69s (+46%) | 0.91 | 30s · 48s (+29%) | 8s | 4.87 | 3.3 | 95% | 79% |
| 750 | ×1.5 | cycle | 76s · 81s (+70%) | 0.76 | 48s · 57s (+53%) | 8s | 4.12 | 2.3 | 95% | 73% |
| 750 | ×2 | cycle | 77s · 81s (+70%) | 0.75 | 54s · 68s (+81%) | 8s | 3.47 | 1.7 | 94% | 72% |
| 625 | ×1 | **fixed** | 48s · 50s (+5%) | 1.23 | 24s · 41s (+9%) | 6s | 5.77 | 3.2 | 98% | 78% |
| 750 | ×1 | **fixed** | 50s · 52s (+10%) | 1.15 | 22s · 37s (0%) | 7s | 6.25 | 3.4 | 97% | 78% |

Sampling noise (binomial / bootstrap at these sizes): gate 1 ±1 pt, gate 2 ±3–4 pts, means ±5 %.

## Findings

1. **A longer cycle lengthens matches mostly because it lowers DPS, not because flight is slower.**
   With the attack cap tied to the cycle, 625 ms gives +17 % duel / +10 % squad length and 750 ms
   +46 % / +29 % (duel DPS −10 % / −27 %, squad DPS −9 % / −22 %). With the same cycles but the attack cap kept at 500 ms
   ("fixed"), the gain collapses to +5–10 % and DPS is back to baseline: slower flight alone barely
   changes match length. A longer cycle is therefore an indirect, blunt DPS nerf.
2. **Slower special recharge lengthens matches with no measurable skill cost.** ×1.5 → +12 % duel /
   +10 % squad, ×2 → +27 % / +12 %. Bots use K-turns, boosts and rolls to regain firing arcs, so rarer
   specials mean fewer firing solutions (duel DPS −12 % at ×1.5, −22 % at ×2; squad DPS −9 % / −10 %)
   and specials become a deliberate decision
   (3.4 → 2.6 per ship-minute). Gate 1 stays 99 %, gate 2 stays 81–83 %.
3. **Does a longer cycle reduce skill expression? Slightly, yes.** Gate 1 (expert v novice) drops
   100 → 97–98 % (625) → 94–95 % (750): a fixed human/bot reaction is a smaller fraction of a longer
   cycle, so novices are punished less. Gate 2 (coordination) is flat at 625 ×1 but falls to 72–74 %
   when a longer cycle is combined with slower specials — within a few points of the 70 % floor.
   Every variant still passes both gates; 750 × ×2 is the riskiest.
4. **Squad openings are decided fast at any tempo.** The first kill of a 4v4 lands at 5 s (500 ms),
   6 s (625) and 8 s (750); squad length is bimodal (quick wipes after an early kill + long tails), so
   medians move less than means. Short Skirmish matches are a snowball problem (mark + focus fire after
   the first kill) more than a tempo problem — which the reinforcement pool addresses structurally.

## Recommendation

- **Keep `CYCLE_DURATION_MS = 500`.** A longer cycle buys length only through fewer attacks per second
  (which DURABILITY_SCALE or the attack interval do more directly), costs a little skill expression,
  makes flight feel heavier, and every system tuned per cycle (stress rates, hit immunity, scenario
  rounds, AI plan horizon, Flight School timing) would have to be re-validated.
- **Change the special-action recharge ×1.5** (the base values in `createControlState`,
  `src/core/ArcadeControls.ts`): K-turn/Segnor/Tallon 5000 → **7500 ms**, boost 3000 → **4500 ms**,
  barrel roll 2000 → **3000 ms**. Expected effect: ≈ +12 % duel and +10 % squad match length,
  −9–12 % DPS, specials ~25 % rarer and more deliberate, gates unchanged (99 % / 83 %). Upgrade and
  relic multipliers on these recharges keep working on top. This is the user's "special actions somewhat
  longer" with no downside in the data.
- If more length is wanted after the reinforcement pool lands, re-run `npm run telemetry:report` first;
  the next lever to measure is time-to-kill (DURABILITY_SCALE / attack interval), not the cycle. Only
  if a slower *feel* is the goal is **625 ms + specials ×1.5** acceptable (+33 % duel, +27 % squad),
  at the cost of gate 2 dropping to ~74 % (re-run `npm run test:skill` before adopting).

The constants were not changed in this task (owner decision).

## Decision (applied)

Boost 3 -> 4.5 s and barrel roll 2 -> 3 s (`BOOST_RECHARGE_MS`, `BARREL_ROLL_RECHARGE_MS` in
src/core/ArcadeControls.ts); the maneuver cycle stays at 500 ms. The K-turn / Segnor / Tallon
recharge stays at 5 s: with 6-7.5 s the gate-1 smoke pairs (confed_raven vs ascendant_crusader,
synth_interceptor_drone vs synth_stalker) fell to 75-84% expert wins, below the 85% gate.
Match length is mainly addressed by reinforcement battles (Skirmish / Epic / Scenarios).
