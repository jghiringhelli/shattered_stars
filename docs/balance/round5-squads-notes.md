# Balance round 5 — squad battles (2026-10-20)

Harness: parameter grids over the real engine (in-memory patches of the data tables, one process per
chunk of jobs; same seeds as `npm run balance:report`, so "before" equals the round-4 report for the
classic / scenario columns). Bots = average tier, draws ½. Reinforced columns carry about ±6 points of
noise per faction (160 games), the strategy matrix ±6 (480 games at scale 2), classic scenarios ±4.

## Before / after (faction totals, %)

| column | before TH/FC/SC/VC/AE | after TH/FC/SC/VC/AE |
|---|---|---|
| classic scenarios | 65/59/48/**35**/44 (spread 30) | 54/48/44/53/50 (spread 10) |
| classic 4v4 (auto-fill) | 52/45/51/52/50 | 48/43/49/56/54 |
| reinforced skirmish | 49/55/44/54/48 | 49/53/47/57/44 |
| reinforced scenarios | 46/58/43/43/59 | 45/53/37/55/59 |

Reinforced AE measured 39–41 % in the round-4 report and 48 % on the same seeds today (the engine changed
under it); FC measured 55–61 across variants — both sit inside the noise band, which is why no reinforced-only
lever was kept (FC Rallying Banner 0.33 / 0.30 / 0.27 gave FC 57 / 54 / 61: non-monotonic).

| strategy (mirror factions, 12 ordered pairs × 80 battles) | balanced | swarm | aces | heavy |
|---|---|---|---|---|
| before (round-4 ship, same protocol) | 61 | 46 | 44 | 49 |
| after | 61 | 43 | 48 | 48 |

Interceptor Duel (400 games per tier): average 43 → **49 %**, expert 51 → 53 %.

## Changes

- **Openings vs rotations** (`SquadronPresets.ts`): the 200-point preset is the Skirmish / Scenario / reinforced
  *opening* and, when "balanced", also the Balanced reinforcement rotation. Following the Confederation's
  Strike / Line split, Void Corsairs and Ascendant now have an *aggressive* 200-point opening (four hulls)
  and keep their old three-ship roster as a *balanced* sub-200 rotation squad (Corsair Line 199, Temple Line
  195). Rotations (and so the reinforced strategies) are unchanged.
  - Terror Squadron: Bloody Cutlass + Blade (overcharged) + Fang + Venom (198 points; was Cutlass + 2 Scimitars).
  - Temple Inquisition: Inquisitor (Foresight) + Acolyte + 2 Cherubs (194; was Inquisitor + Acolyte + Templar).
  - The openings were picked from a search of VC / SC lists against three cheap gates (4-seed Skirmish gate
    30–70 %, identity margins ≥ 8 on the test's seeds, classic scenarios) — the fixed-seed gates are chaotic
    at 32–48 games, so most four-hull lists fail one of them.
- **Strategies**: `supportPerRotation` 1 → 3 (non-Balanced rotations bring three support hulls), Skirmish quotas
  bombers on field 4 → 5, aces on field 2 → 3. Sweeps (scale 1.5–2): heavy 41–51 depending on escorts
  (`heaviesPerEscort` 1 and `heavyMaxCost` 80 both cost it 7 points); quotas and supports are neutral to +2.
- **Interceptor Duel** (`AceMatchups.ts`): Viper Supernatural Reflexes + Tenacity (was + Predator), Phantom
  Evade Mastery + Focus Mastery (was + Predator). Other ability swaps tried: Viper + Evade Mastery 38 / 47,
  Viper + Sense 26 / 40, Phantom + Defensive Flying 50 / 68 (expert out of band).

## Tried, no effect or worse

- Control weight of tiny ships 1 → 0.5 / 0.75 (± small 1.25): classic scenarios unchanged (≤ 1 point). Ship count,
  not control weight, drives TH / VC.
- Two Cherubs for the Templar alone (AE 74 % classic, 60 % scenarios) — hence the Inquisitor list, which also
  keeps the AE identity margin ≥ 8 (the Templar list: 6.3).
- SC five-body and relay + cheap-hull lists: SC reinforced scenarios 52–55 but classic scenarios 32–38 and
  classic 4v4 33–46, so SC keeps Precision Strike.
- FC rotation without the Crane (FC reinforced 65), Aegis / Banner magnitude edits (noise-bound).

## Open

- Reinforced scenarios: SC 37, AE 59, VC 55 (reinforced FC 53, AE 44, VC 57 within noise) — needs a larger
  sample (≥ 4× seeds) before any lever can be trusted; classic scenarios SC 44 / TH 54 are ±1 of the band.
- Strategy matrix: Balanced 61 and Swarm 43 outside 47–55 (Aces 48, Heavy 48 inside).
- SC+SC 2v2 (86 %): no team harness is checked in; not re-measured.
- VC classic 56, FC classic 43 (fixed-seed gates leave little room for list changes).
