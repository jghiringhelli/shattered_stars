# Dogfight default pairing

**Problem.** The ships a new Dogfight preselects — Falcon (Free Confederation heavy fighter,
50 pts) v Raptor (Terran Hegemony interceptor, 48 pts) — were lopsided: the telemetry battery
had the Falcon side winning 89–96 % at equal pilot tiers.

**Method.** `DuelTempoSim` (the scene's BotPilots, squad layer and combat modules), equal tiers,
seeds 1000+, side-1 = the player's seat. Factions kept (Confederation v Hegemony).

| Pairing (player v bot) | novice | average | expert |
|---|---|---|---|
| Falcon v Raptor (old default, 120 seeds) | 89 % | 97 % | 94 % |
| Falcon v Gladius | 83 % | 77 % | 88 % |
| Falcon v Viper | 73 % | 71 % | 73 % |
| Falcon v Centurion / Praetorian | 0–5 % | 2–3 % | 0–4 % |
| Kestrel / Raven / Owl v Raptor | 14–32 % | 19–62 % | 19–60 % |
| **Falcon v Legionnaire (300 seeds, player seat)** | 41 % (9 % timeouts → 45 % of decided) | **53 %** | 60 % |
| Legionnaire v Falcon (300 seeds, seats swapped) | 55 % | 51 % | 46 % |

**Decision.** The default enemy is the **Legionnaire** (Terran heavy fighter, 55 pts: the
Falcon's hull / shields / attack / agility, no Evade). Over both seats the Falcon wins 49–53 %
at average, 54–60 % at expert and 40–45 % of decided novice rounds — within ±10 % of even.
Ship points were not changed (re-pricing the Raptor would ripple into squad building and the
skill gates). One constant, `DOGFIGHT_DEFAULT_PAIRING` (`src/data/DogfightDefaults.ts`), feeds
the scene, the telemetry battery and `scripts/duel_tempo_report.ts`;
`tests/balance/DogfightDefaultPairing.test.ts` keeps it within ±10 % at average v average.
After the change `npm run telemetry:report` shows the Dogfight rows at 35 % (novice, 13 %
timeouts) / 50 % (average) / 60 % (expert) side-1 wins.
