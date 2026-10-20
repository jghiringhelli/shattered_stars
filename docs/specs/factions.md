# Factions — identity, levers and balance

Every hull is inspired by an classic tabletop dogfighting games ship and every faction fields a near-equal
roster per role (ships per role differ by at most one across factions). A faction's identity is
therefore carried by **levers**, not by ship counts. Factions are balanced on **squad** results
(classic squads, reinforced battles, scenarios); solo value per point is informational only, and the
duel modes (Dogfight, Ace Duel) keep their own gates.

Source of truth: [`src/data/factionIdentity.ts`](../../src/data/factionIdentity.ts)
(`FACTION_IDENTITIES`: specialty, levers, identity cards / slot types, ace abilities) and
[`src/systems/aura/FactionAuras.ts`](../../src/systems/aura/FactionAuras.ts) (the aura numbers).
The game is dropping "Force" from player-facing text: the Ascendant powers are **psychic** powers
(internal ids such as `force_power` stay).

## Levers per faction

| Faction | Specialty | Levers |
|---|---|---|
| Terran Hegemony | Squad discipline and elite (expensive) aces | **Coordinated Fire**: allies within 380 px deal +0.35 damage per hit; talents Squadron Leader / Coordinated Assault; **Hold the Line** aces (Kane, Whisper Null: +1 damage, 20 % less damage beside a wingman) priced into the pilot |
| Free Confederation | Crew, riggers and versatile ordnance | **Rallying Banner**: allies within 280 px take 30 % less damage; Confederation-only rigger slots (Repair / Targeting Rigger) and crew coordinators; torpedo and missile racks on its fighters |
| Synthetic Collective | Cheap swarm and data-link coordination | **Hive Resilience**: 8 % less damage per nearby drone (cap 30 %) within 400 px; data-link cards (Swarm Uplink, Collective-only; Pattern Analyzer); the cheapest hulls (four ships at 200 points) |
| Void Corsairs | Tricks (boost / barrel roll, illicit upgrades) and hit-and-run aces | **Raider's Cadence**: maneuvers one stress tier easier and +10 % to hit within 700 px (raiders fly loose); Corsair-only illicit slots; trick talents (Expert Handling, Daredevil, Phantom Strike); raider aces |
| Ascendant Empire | Shields, support and psychic powers | **Aegis Field**: allies within 220 px regenerate 0.25 shield HP/s; psychic powers and talents (Ascendant-only: Foresight, Sensitive, Mending Light); support hulls (acolytes, prophets, oracles) projecting the field |

The 200-point preset of every faction (the Skirmish auto-fill) flies at least one identity card or
ace ability and at least one aura projector (`tests/balance/FactionIdentity.test.ts`).

## Identity ablation

`src/simulation/identityAblation.ts` flies a squad **without** its identity: identity cards stay in
the hangar (no stats, sheet effect or secondary weapon), the named pilots of ace factions fly
without their ability, and the ship projects no faction aura. The faction's win share with its
identity minus the same squads without it is its *margin*; target **≥ 8 win points**, gated in
`tests/balance/FactionIdentity.test.ts` (classic squads, 6 seeds × both seats × 4 opponents) and
measured with 95 % intervals by `npm run balance:report` (section "Faction identity").

| Faction | Classic with → without | Classic margin | Reinforced margin |
|---|---|---|---|
| TH | 50 % → 38 % | +13 ±6 | +17 ±10 |
| FC | 43 % → 25 % | +18 ±6 | +35 ±9 |
| SC | 53 % → 33 % | +20 ±6 | +22 ±9 |
| VC | 53 % → 39 % | +14 ±6 | +19 ±10 |
| AE | 51 % → 40 % | +11 ±6 | +16 ±10 |

(`docs/balance/latest.md`, scale 1.5.)

## Balance targets and where they stand

Faction totals 45–55 % and pairings 35–65 % in classic squads, reinforced battles and scenarios.
Measured on the real engine with average pilots (`docs/balance/latest.md`):

| Faction | Classic | Reinforced | Scenarios (classic) | Scenarios (reinforced) |
|---|---|---|---|---|
| TH | 50 | 48 | 61 | 40 |
| FC | 43 | 55 | 59 | 56 |
| SC | 53 | 47 | 47 | 47 |
| VC | 53 | 55 | 38 | 44 |
| AE | 51 | 45 | 45 | 63 |

Known residuals (open): scenario totals are driven by squad structure (control weight, ship count,
the pool-price of a destroyed hull) far more than by auras; the 200-point lists (`SquadronPresets`)
were searched (random and hand-made alternatives, classic + reinforced + scenarios) and none beat
the current ones on all four columns. Levers that do not move scenario totals: aura magnitude and
radius of the Hegemony, hit-chance bonus of the Corsairs (capped at +10 % by the aura resolver).

## Tuning history (levers changed)

- Hegemony Coordinated Fire 0.6 → 0.35 (Iron Fist now flies four hulls under it).
- Confederation Rallying Banner 20 % → 30 % → 33 % (round 4: with the stacking falloff below, 30 % left FC at 44 % classic; 35 % made it 59 % in classic scenarios).
- Collective Hive Resilience per drone 6 % → 8 %, radius 340 → 400 px.
- Corsair Raider's Cadence 300 px / +5 % → 700 px / +10 % hit, stress relief unchanged.
- Ascendant Aegis Field 2.4 → 0.4 → 0.25 shield HP/s (long battles accumulate regeneration).
- Presets carry identity: Iron Fist (Kane, four hulls), Terror Squadron (Bloody Cutlass, illicit
  capacitors), Temple Inquisition (psychic Foresight / Sensitive under the Aegis Field).

## Aura stacking and mixed teams (round 4, 2026-10-15)

Two rules in `src/systems/aura/FactionAuras.ts` (`AURA_STACKING`), applied by `resolveSupportAuras`
(`withStackWeight`):

- **Diminishing returns per recipient** (`falloff` 0.75): the strongest projector covering a ship counts in
  full, the next ×0.75, the third ×0.56 … Additive shield regeneration is exempt (the pool bounds it).
- **Mixed-team share** (`mixedTeamShare` 0.5, team battles / allied sides only: `resolveTeamAuras`,
  `applyAllyAuraRepairs`): a projector's field keeps half its strength on a teammate of *another* faction.
  Doctrine stays faction-bound for enemies and for single-faction sides (the share is 0 outside a team).

Measured on 105 team pairings (2v2 = two 200-point squads a side, 3 seeds × both seatings):

| | same-faction teams | mixed teams | SC+SC | FC+AE |
|---|---|---|---|---|
| plain stacking (before) | 63 % | 44 % | 89 % | 31 % |
| share 0.5, falloff 0.6 | 56 % | 47 % | 86 % | 35 % |

The falloff alone did not move the gap (same-faction teams win because their two squads' doctrine covers every
ship, a mixed team's covers half). SC+SC stays high (cheap hulls ×2 squads of swarm count); lowering the
Hive Resilience magnitude to 0.06 brought it to 71 % but took Collective below 45 % reinforced, so it stays open.

Classic totals after round 4: TH 52 / FC 45 / SC 51 / VC 52 / AE 50 (all 45–55). Reinforced: TH 50 / FC 57 / SC 48 /
VC 56 / AE 39–41 (open: AE is aura-driven and loses to FC / VC). Identity margins (`latest.md`): classic +14…+20,
reinforced +15…+34, all ≥ +8.