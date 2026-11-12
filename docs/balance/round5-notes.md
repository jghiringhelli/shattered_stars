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

# Balance round 5b — instant turns, longer Snap / boost / roll (2026-11-10)

Owner decisions: (1) a human's steering starts at once (docs/specs/flight-controls.md, "Instant turns"), (2) the Snap
Turn sits at the highest printed speed of each dial, (3) boost 220 -> 300 px, barrel roll = speed-2 template + base
(72 -> 112 px on a small ship).

## Changes

| what | before | after |
|---|---|---|
| `BOOST_DISTANCE_PX` (`ArcadeInputGestures.ts`) | 220 | **300** |
| `BARREL_ROLL_TEMPLATE_SPEED` (`ShipMotion.ts`, oracle `BARREL_ROLL_SLIDE_SPEED`) | 1 (72 px) | **2** (112 px) |
| Snap row of Fighter, Light Fighter, Harbinger, Hunter/Stalker/Ravager, Torpedo Boat dials | 3 / 3 / 2w / 3w / 2w | **4** (colors kept) |
| Snap row of Interceptor (2 and 4), Virtue, bomber / gunship / Avatar (top speed 2-3) | - | unchanged |
| `CYCLE_INTERRUPT_MIN_ELAPSED_MS` | - | 80 |

Instant turns only exist for the human pilot (`interruptCycles`), so the bot-flown harness (skill arena, duel, squad
sims) is moved by the geometry only.

## Gates

`npm run test:skill`: gate 1 expert win 100 % (0/60 pairs below 85 %), gate 2 squad win 98 % over 200 battles;
thresholds untouched, no bot lever touched.

## Harness flips and levers

- `skill gate 1 smoke` confed_sparrow > synth_stalker: 85 % with either action change alone, **79 %** with both (the expert
  Sparrow's own Snap at 4 costs it too: 90 % with the old Snap row). Lever (data): `confed_sparrow` gets white banks at
  speed 3 (`tuneDial(LIGHT_FIGHTER_DIAL, bank 3 white)`; the other light fighters keep red) -> **90 %**. Tried without effect:
  Hunter banks red at 3, Hunter banks white at 2; light-fighter banks green at 2 only reached 83 %; white banks at 3 on the
  whole light dial also gave 90 % but buffs every cheap hull.
- `FactionIdentity` flipped Hegemony to a 2 % margin in one run and passes in the final one (margins 27 / 8 / 21 / 15 / 13 %;
  Confederation at 8.3 % is the thinnest, limit 8 %).
- `DifficultyCurve` (Brutal 40 % > 30 %) and `AceDuelBalance` elite_fighters (75 %) fail with the geometry of this round
  reverted as well: they follow the bot changes in flight (src/arcade/ai), not these decisions.
