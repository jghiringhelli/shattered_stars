# Round 5 — Survival

Harness: `SurvivalRunSim` (same engine as `npm run telemetry:survival`), autopilot with belt damage, mixed starters (seed % 5).
Forced picks = the pick is granted at the start of the run on top of the normal draft (n 60 paired, seeds 50000–50059, base from the same seeds);
a Python-free scratch runner (not committed) calls `simulateSurvivalRun({ start })`. Battles cleared per run is the precise metric
(paired SE ≈ 0.4–0.5 battles ≈ 6–7 win points at n 60), so ±6 win points is at the limit of what n 60 resolves.

## Forced-pick sweep (base 26.7 % / 10.85 battles before, 28 % / 10.8 after)

Before (round-4 final numbers, re-measured): x_wingcmd +3.9 battles (win 68 %), cap_automation +1.7, capacitor_bank +1.3 (57 %), cap_gunnery /
cap_ordnance +2.5 (55 %), bul_regen +1.2, regen_lattice +1.3, x_saturation +1.5, x_phase +1.5, target_painter +1.4, cap_fleet +1.25, x_alpha +1.2.
The +1 damage atoms sit at +0.3…+1.0 (pooled +0.8), range / evasion atoms +0.4…+0.9, hull / crit / volley atoms −0.4…+0.2, trigger relics ~0.

Changes (all numbers, no test thresholds moved):

| Pick | Before | After | Measured after (Δ battles / win) |
|---|---|---|---|
| x_wingcmd | +1 escort, +1 dmg | +1 escort, −1.8 dmg | +0.4 / 23 % (was +3.9 / 68 %) |
| cap_gunnery, cap_ordnance | +2 dmg | +1 dmg | +1.0 / 37 % (was +2.5 / 55 %) |
| cap_automation | +15 % volley | +12 % volley | +0.9 / 38 % |
| cap_fleet | +2 evasion | +1.5 | +0.7 / 37 % |
| x_saturation | +1 dmg, +5 % volley | +0.6 dmg | +0.9 / 40 % |
| x_phase | +4 hull, +2 evasion | +3 hull, +1.5 evasion | +0.7 / 37 % |
| x_alpha | +1 dmg, +5 % crit | +0.75 dmg | +0.1 / 33 % |
| capacitor_bank | 2 shield HP / kill | 1 | +0.8 / 43 % (was +1.3 / 57 %) |
| regen_lattice | 0.04/s + 1 HP / kill | 0.04/s | +1.2 / 47 % (was +1.3 / 50 %) |

Tried and reverted: Target Painter +0.5 dmg (pinned by RelicCombatEngine.test), Regen Lattice flagship-only (pinned by SurvivalBattleRules.test).
Max pick is now ≈ +1.2 battles (was +3.9), nothing above 47 % win (was 68 %); picks cluster at +0.4…+1.0.

## AE Seraph second starter

Measured (n 60, Ascendant seeds, kit none): Seraph 58 % / 13.1 battles vs Herald 33 % / 10.1. A lone ace is the lever: the free wingman is worth ≈ 7 battles
(Seraph with escorts −1 only: 17 %, 6.2; + 2 upgrades 25 %; + 3 upgrades 32 %, 7.9; + 3 upgrades and +60 salvage 33 %, 8.4; −40 salvage alone 52 %).
New kit `ascendant_seraph`: upgrades 3, escorts −1, salvage +60 → **35 % / 8.5 battles** (n 60 final), herald 33 %.

## A0 mixed (n 300, seeds 1–300, 12 × 25 shards)

Run win **30.7 %** (was 28 %), node clear S1/S2/S3 **99 / 90 / 90 %** (was 99/90/88), boss **92 %**, elite 90 %, combat 95 %.

## Open

- bul_regen (+1.2 battles / +25 win) and regen_lattice (+1.2) stay high: their rates are pinned by tests/unit/data/regenUnits.test.ts (0.06 and 0.04 HP/s)
  and the bulwark set by RelicCombatEngine.test; lowering them needs a test change (not owned this round).
- +1 damage atoms (pinned +1 ×1.5 in powers.test) and Target Painter stay at about +1 battle; strictly "within ±6 win points of the base" would mean a free
  pick is worth nothing — the achieved target is a ≤ +1.2 battle spread (≈ +20 win points) with no pick above 47 %.
- Salvage / trigger relics were not re-swept (dead in round 4, headless autopilot cannot fire them).
- tests/balance/FactionIdentity.test.ts (synthetic_collective identity margin 4 % < 8 %, classic squads) fails; it does not touch Survival data
  (the other agent's faction tuning).
