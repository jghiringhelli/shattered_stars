# Balance round 5 — passive stress recovery (2026-10-22)

Owner decision: stress clears by itself; flying green is a faster bonus, never a requirement.

## Change

| constant (`src/arcade/ArcadeStress.ts`) | before | after |
|---|---|---|
| white rate | −0.05 / s | −`STRESS_PASSIVE_DRAIN_PER_SECOND` = **−0.20 / s** |
| green rate | −0.35 / s | −(0.20 + `STRESS_GREEN_BONUS_DRAIN_PER_SECOND` 0.15) = −0.35 / s (unchanged) |
| red rate, Snap / boost spikes, 0.7 latch / 0.15 release | unchanged | unchanged |

Time to clear from a full latched bar, applied per 500 ms cycle: 9 cycles = 4.5 s white (was 17 s),
5 cycles = 2.5 s green.

Passive rates tried (whole `tests/balance` with fixed seeds; the 4-seed / 6-seed gates are chaotic at 32–48 games):
0.14 flipped Skirmish Hegemony (72 %) + Confederation identity margin; 0.15 the same plus Dogfight Hard / Brutal tie;
0.17 Hegemony (75 %), Ascendant identity margin (6.3 %) and the Heavy Ship Duel (75 %); 0.18 Hegemony, Ascendant
identity and the difficulty curve; 0.19 the difficulty curve (Hard = Brutal = 15 %); 0.21 Hegemony (75 %);
**0.20 passes everything** once the Heavy Duel lever below is applied.

## Data lever

- `AceMatchups.ts` Heavy Ship Duel: Hawk Captain Stealth Device + Marksmanship → Tenacity + Marksmanship
  (Marauder 75 % at average → **50 %**; 12 seeds from both seats).

## Gates

`npm run test:skill` at 0.20: gate 1 expert win 100 % (0/60 pairs below 85 %), gate 2 squad win 95 % over 200
battles (91 % at 0.17, 94 % at 0.19); thresholds untouched.
