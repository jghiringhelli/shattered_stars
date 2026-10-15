# Balance round 4 — working notes (2026-10-15)

Progress log written as the round goes (a reboot already killed one run). Harness: parameter grids
run all combinations on all cores (one `node grid.mjs` per step, in-memory patches on the data
tables; the `ASCENSION_TUNING`, `PLAN_TUNING`, `RECOVERY_TUNING`, `STARTER_KITS` tables exist so a
sweep can tune them without editing source). Bots = average tier; Wilson 95 % CIs in brackets.

## Survival (audit baseline: A0 run win 7 % mixed starters, TH 16, FC 3, VC 2, SC 0)

Mixed = faction by `seed % 5`, belt damage on, creature bosses on, n = 200..400 per cell.

| step | change (cumulative where noted) | A0 run win mixed [CI] | TH / FC / SC / VC / AE | S1/S2/S3 node clear | boss B1/B2/B3 |
|---|---|---|---|---|---|
| 0 | base (HEAD) | 8 [5–13] | 20 / 5 / 0 / 0 / 15 | 92/76/87 | 61/76/80 |
| 1 | enemy damage 0.62 → 0.55 | 12 [8–17] | 33 / 5 / 0 / 0 / 23 | 94/77/89 | 68/84/86 |
| 1 | free hull repair after every cleared battle +10 % | 12 [8–17] | 23 / 8 / 0 / 5 / 23 | 93/82/86 | 62/88/74 |
| 1 | both | 19 [14–25] | 38 / 20 / 0 / 5 / 33 | 94/84/90 | 69/94/93 |
| 1 | regen_lattice 0.24→0.12 (+4→+2/kill), bul_regen 0.12→0.06 | 6 [3–10] | 18 / 0 / 0 / 0 / 13 | 92/75/82 | 61/80/75 |
| 1 | waves per node −1 (2/3/4) | 11 [7–16] | 25 / 8 / 0 / 0 / 20 | 95/80/83 | 74/82/75 |
| 1 | `PLAN_TUNING.sectorThreatStep` 0.25 → 0.12 | = base (no effect: wave size is capped) | | | |
| 2 | starter second choices (kit 0): raptor 13, sparrow 2, drone 0, blade 0, **seraph 50** | | | | |
| 2 | kits, with enemy dmg .55 + repair .08 (n = 100 each): FC wasp up3 28 / up3+1 escort 61 / +2 escorts 85; VC fang up3 32 / 59 / 90; SC drone up3 3 / 19 / 24 | | | | |
| 2 | cinder_wyrm hull 56→44 / 36 (+dmg ×0.75) with G: B1 clear 79 / 82 / 83 | | | | |

Findings: extra escorts are by far the strongest start lever (one wingman = +30 win points), upgrade
levels +1 damage and hull each (+13 points per level), so kits are escorts-light.

### Survival — step 3 (kits + dmg/repair + wyrm + halved regen + volley, shop buys up to 4 items/visit)

Final defaults (enemy damage 0.60, free repair 7 %/battle, kits, wyrm 44 HP ×0.9 damage, Second Wind = shield refill):

| cell | run win [CI] | TH/FC/SC/VC/AE | S1/S2/S3 clear | boss B1/B2/B3 | elite | median c/e/b s |
|---|---|---|---|---|---|---|
| A0 mixed (n 300) | 30 [25–35] | 43/33/17/22/33 | 99/89/90 | 92/90/84 | 93 | 46/65/70 |

Ascension (n 60 per level, mean battles cleared per run = "prog", elite / boss clear):

| A | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| prog | 10.5 | 8.7 | 9.3 | 8.8 | 8.6 | 7.9 | 8.0 | 7.5 | 7.4 | 7.5 | 7.2 |
| elite clear % | 93 | 79 | 81 | 74 | 74 | 78 | 76 | 68 | 64 | 66 | 60 |
| boss clear % (B1/B2/B3 at A8) | 92/90/84 | | | | | | | | 78/82/80 | | |

(before: boss clear 9 % at A8, run win 0 % from A8.)
Second choices (kit applied, n 50): TH raptor 36, FC sparrow 30, SC synth_drone 18, VC blade 32, **AE seraph 70** (open).
### Forced picks (start-of-run snapshot, n 60 paired, A0 mixed base 32 % / 10.97 battles cleared)

Before (audit): regen_lattice 36 %, bul_regen 48 %, x_wingcmd 38 %, auto_dmg 31 %; after the first retune (shield regen halved,
capstone/cross damage cut, volley redefinition, 70-cell grid) the best picks were +2.0…+2.4 battles (win 50–63 %) against a
mean of about +0.5, the dead ones (|d| < 0.4) were the trigger/skill relics a headless autopilot cannot fire plus the salvage
relics (the average policy hoards 347 salvage). Second pass numbers are in the final report.

### Teams (2v2, 105 pairings × 3–4 seeds × both seatings, aura stacking)

| variant | same-faction teams | mixed teams | SC+SC | FC+AE | appearance TH/FC/SC/VC/AE |
|---|---|---|---|---|---|
| plain stacking (HEAD) | 63 | 44 | 89 | 31 | 46/39/55/53/44 |
| falloff 0.5–0.7 only | 60–63 | 44–45 | 81–90 | 31–32 | 46/39–40/55/53–55/44 |
| falloff 0.6 + mixed-team share 0.5 | 56 | 47 | 86 | 35 | 46/42/56/56/44 |
| falloff 0.45 + share 0.5 | 59 | 45 | 77 | 31 | 46/43/53/56/44 |

(The aura falloff alone does not move the gap: same-faction teams win because their two squads' doctrine covers every ship, a mixed
team's covers half — hence the mixed-team share.)

### Reinforcement strategies (12 ordered pairs × 40 battles, mirror factions F[seed % 5], mean vs the other three)

| variant | balanced | swarm | aces | heavy |
|---|---|---|---|---|
| HEAD | 71 | 53 | 41 | 35 |
| aces 2/6, bombers 2 | 68 | 50 | 45 | 37 |
| aces 3/9, bombers 4 | 66 | 46 | 55 | 33 |
### Reinforcement strategies — final (12 ordered pairs × 40 battles; mean vs the other three)

| variant | balanced | swarm | aces | heavy |
|---|---|---|---|---|
| HEAD (aces 1 on field / 3 per match, bombers 2, patient Aces / Heavy) | 71 | 53 | 41 | 35 |
| quotas aces 2/9, bombers 3, nobody patient | 66 | 43 | 48 | 44 |
| + Balanced = control-style squads only (falls back to cheap generic hulls) | 51 | 48 | 55 | 47 — but VC reinforced total 31 %: **rejected** |
| + one support hull per swarm / aces / heavy lap (**shipped**, bombers 4) | 59 | 48 | 52 | 43 |

Heavy-Bombers with cheaper hulls (≤ 80 pts) got worse (28 %): the dear gunships are its value. Eager play (no waiting for the head ship) is worth +8–10
points to Aces and Heavy. Balanced's dominance came from its rotation being the 200-point curated squads (aura projector included) while the other plans
had none.

### Classic scenarios (spec of the scoring levers, 5 variants × 12 seeds × 40 pairings)

| variant | TH | FC | SC | VC | AE | spread |
|---|---|---|---|---|---|---|
| HEAD | 57 | 56 | 42 | 46 | 50 | 14 |
| small-hull control weight 1 → 1.5 | 56 | 59 | 45 | 42 | 49 | 17 |
| pointsPerSquadPoint ×0.7 / ×1.4 | no effect (classic scenarios score through the definition's default) | | | | | |
| pointsPerObjective ×0.6 / ×1.6 | 56/55/43/48/47 vs 57/57/45/45/47 | | | | | 12–13 |

None of the scoring levers closes the TH 65 / VC 35 gap (control weight, objective points, destroyed-points value all move it by ≤ 3 points): it comes
from the lists themselves (VC's cheap raiders against TH's medium hulls), so it stays open rather than a per-faction hack.

### AI difficulty — scenarios

Scenario crews now have their own table (`SquadFormat` "scenario", picked by `squadFormatFor`): reinforced crews (×1.75 / ×0.4) measured hard 22 % /
brutal 11 %; ×2.2 / ×0.55 gives 26 % / 11 %, ×2.8 / ×0.7 28 % / 16 % (400 games per cell). Easy is [average, novice, novice] as in classic.

### Campaign proxy (force ratio, 86 missions × 6 seeds × 2 seats, average-tier bots, scripted spawns lumped into the opening fight)

| group | mean win (HEAD proxy) | enemy / player points |
|---|---|---|
| Act 1 | 15 % | 1.92 |
| Act 2 | 18 % | 1.53 |
| Act 3 | 7 % | 1.93 |
| Coalition | 50 % (initial enemies only: 100 %) | 0.68 |

Changes: Coalition `coal_4_2 ×5`, `coal_4_5 ×5`, `coal_5_3 ×5`, `coal_5_1 ×3`, `coal_5_2 ×4` enemy counts (kill objectives stay satisfiable);
new per-group knob `MissionEnemy.hullScale` (default 1, sane 0.4–1.5) set to 0.7 on the 21 Act 1–3 missions with an enemy/player ratio ≥ 2.0
(heg_1_3b/1_4/1_5/2_5/3_2, conf_1_3/1_5/2_4/3_1/3_5, synth_3_2, cors_1_3/1_4/1_5/2_3/2_4/3_2/3_4/3_5, asc_1_4/3_5). **Not measured**: the proxy
cannot model `hullScale`, hero powers, armory, research, evolution XP, objective timers or hazards. Mission counts cannot be cut mechanically because
`kill` objectives name how many enemies must die (heg_1_3: "destroy 3" against 3 enemies).
## Final numbers (shipped defaults)

`npm run telemetry:survival -- --runs 150 --mixed` (autopilot, belt on): run win 33.3 %, node clear S1/S2/S3 99/90/92 %, combat 96 % / elite 90 % /
boss 91 %, node length median 46 s (combat) / 65 s (elite) / 71 s (boss). Grid (n 300, seeds 50000+, after the last relic nerfs): A0 mixed **28 % [23–33]**
(TH 35, FC 25, SC 18, VC 23, AE 38), clear 99/90/88, boss 95/90/85, elite 91. Ascension (n 60): battles cleared per run 10.6 (A0) → 7.6 (A4) → 6.3 (A8) →
6.2 (A10); boss clear at A8 71/62/100 (was 9 % at A8).

Forced picks (n 60 paired, base 28 % / 10.2 battles): before the round regen_lattice +28 win points and bul_regen +40; the strongest picks now sit at
+1.7…+2.2 battles (win 40–52 %: escort_foundry, regen_lattice, capacitor_bank, x_alpha, cap_gunnery / cap_ordnance, x_saturation — nerfed once more
after this grid: Escort Foundry loses its regen, Regen Lattice 0.06 → 0.04/s, Capacitor Bank 3 → 2, x_alpha crit 10 → 5 %, x_saturation volley 10 → 5 %,
not re-measured). **Not within ±6 win points yet**: the +1 damage atoms alone are +1 battle; ordnance, damage and shield-per-kill picks
cluster at +1.5…+2 and the mean over all 70 picks was never re-measured.
Dead in the sweep (|d| < 0.4): trigger / skill relics (roll_thrusters, phase_flicker, slipstream_vanes, adrenal_injector, koiogran_gyro, afterburn_capacitor,
daredevil_harness — the headless autopilot does not fly the maneuvers that fire them), the salvage relics (the policy spends 1 of 3 salvage; their numbers were
raised: +2 salvage per kill, shop −25 %, repairs +25 %, elites +100 %), scrap_converter, bounty_contract, mutations afterburner_core / reactive_shields
(maneuver and kill triggers). Mutations are now ±1 battle: rail_driver +0.5, scatter_array +0.45, juggernaut 0, ion_lance −0.85.

Left open: AE seraph second starter 70 % (herald 38 %); classic scenarios TH 65 / VC 35; reinforced AE 39–41 %, FC 57; reinforced scenarios AE 61 / SC 41; SC+SC 2v2 86 %;
heavy-bombers is the weakest strategy (43 %) and still beats nobody; Albatross −18 % (boost / barrel roll added; price cuts blocked by the shipPricing gate),
Vindicator −32 %; Interceptor Duel 40 % avg; Act 1–3 campaign outliers (hullScale 0.7 unmeasured); psychic / mechanic card prices; quick-build repricing.