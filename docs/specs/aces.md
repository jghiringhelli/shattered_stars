# Aces — hit-and-run strikers (spec)

Status: implemented (protocol 7). Constants: `src/data/aceConfig.ts` (the single place to tune).
Report: `npx tsx scripts/ace_strike_report.ts [--seeds 80] [--sections factions,aces,gate2]`.

## Goal

Named aces (pilots with a signature ability) should be viable in **squad battles** as strikers that
dive in, hit, get clear and come back — without making a solo ace beat a coordinated squad
(skill gate 2: a coordinated average squad beats the same points of solo experts >= 70 %; thresholds
are never moved, levers are tuned).

## Who is an ace

`isAceLoadout(loadoutId)` / `isAcePilotCard(card)` (`src/data/aceStatus.ts`): a **unique** pilot card
with a signature ability and **initiative >= `ACE_MIN_INITIATIVE` (4)**. In the catalog that is 103 of
the 109 named pilots; generic cadets (initiative 1-3) and the six initiative-3 named pilots are not
aces. A ship flown without its faction's identity (balance ablation) is not an ace either.

## The three mechanics

### 1. Strike window (`arcade/systems/AceStrike.ts`)

A dash — boost, barrel roll, Snap turn / Hook / Knife (flight events `boost`, `barrel_roll`, `kturn`,
`segnor`, `tallon`) — of an ace opens a window of `STRIKE_WINDOW_MS` (one cycle = one attack interval)
for `STRIKE_WINDOW_SHOTS` (1) shot. A strike shot gets `+STRIKE_HIT_BONUS` (0.20) to hit and
`+STRIKE_DAMAGE_BONUS` (3) damage through `ShotLevers.leverShot` (`strike`), **only against the target
the ace's side marked** (SquadMark): a strike is a squad tactic, so a solo ace gets nothing from it.
Both are below the mark's own +0.35 / +5. The shot spends the window, hit or miss.

### 2. Disengage reward (`arcade/systems/Disengage.ts`)

An ace that was under an enemy's guns and gets clear earns, for `DISENGAGE_EVADE_MS` (1 s):

- every shot at it is `-DISENGAGE_EVASION_HIT_PENALTY` (0.10) to hit (`leverShot` `evading`);
- `DISENGAGE_BOOST_REFUND` (50 %) of its remaining boost recharge is refunded (the speed half).

"Clear" = leaving the firing arc of an enemy that had it in arc and range **and** opening at least
`DISENGAGE_MIN_RANGE_PX` (400 px) to it, or shaking a squad mark an enemy side had on it. One reward per
`DISENGAGE_REWARD_COOLDOWN_MS` (3 s) so a flickering arc is not farmed.

### 3. Ace bot policy (`arcade/ai/AceStrikePolicy.ts`, `AceTargeting.ts`) — OFF (`ACE_BOT_POLICY = false`)

Disabled in `BotPilot` since the faction-identity gate (`tests/balance/FactionIdentity.test.ts`)
caught it: with the policy on, an ace's own side loses win points in the classic auto-fill squads
(Confederation 42 % -> 35 % in 192 games/arm; Ascendant's stripped arm 46 % -> 51 % as opposing aces fly it), pushing the identity margins of Ascendant (+4.4 vs
+9.4 without the policy) and Confederation (6 seeds: -2.1 vs +14.6) below the +8 gate; the ace report
(12 seeds) shows +0.4 with the policy and +2.5 without it. The module stays, tested, for re-measuring.
When on, it wraps any tier's bot for ships flagged `BotContact.isAce` (off for everyone else, so existing balance
stays); the memory is a plain record on the `BotPilot` (captured by the online snapshot):

- **Target**: the squad's marked target and isolated enemies (no other enemy within
  `ACE_ISOLATION_RADIUS_PX`) beat the merely nearest one; approach on the rear flank
  (`ACE_APPROACH_BEARING_DEG`) unless the squad already gave a flank slot.
- **Dive**: boost in from just outside weapon range at a target ahead that cannot shoot back — opens
  the strike window.
- **Roll out**: barrel roll to the side that leaves the arcs of enemies that have it in their sights
  while it cannot shoot back (earns the disengage reward).
- **Break off**: a hurt ace (<= `ACE_BREAK_OFF_HEALTH`) under fire after one attack, or a healthy one
  outnumbered (>= `ACE_OUTNUMBERED_THREATS` enemies have it in arc) after `ACE_BURST_MS`, flies away at
  full throttle, boosting out, and re-enters when the range is open (`ACE_REENTRY_RANGE_PX`) or after
  `ACE_DISENGAGE_MAX_MS`.

## Wiring

| Where | What |
|---|---|
| `ShotLevers` / `DiceAttack` | `strikeHitBonus`, `strikeDamageBonus`, `evasionHitPenalty` levers (0 in `NO_SHOT_LEVERS`); `attackerStrike`, `targetEvading` inputs |
| Skill arena (all balance sims) | `ArenaShip.isAce`, `ArenaAce` (book, flight events, disengage tick, shot flags), `ArenaRules.aceMechanics` / `ShipEntry.aceMechanics` / `SquadList.aceMechanics` (off = the "before" arm) |
| `ArcadeBattleScene` (Skirmish, Epic, Scenario, reinforced, online) | `AceStrikeGlue` (same book, `ArcadeShip.isAce`), book in `simGraph()` and `hashOnline()` |
| `BotPilot` | `ACE_BOT_POLICY` (off) → `BotContact.isAce` → `AceTargeting.aceStrikeView` + `AceStrikePolicy.aceStrikeIntent` |

Not wired (open): Dogfight, Ace Duel (`DuelTempoSim`), Survival, Campaign, Continuous and Epic raid
scenes keep their own shot resolvers; they can adopt `AceStrike` / `Disengage` / `takeShotFlags` the way
`AceStrikeGlue` does.

## Online

Per-ship ace state (`AceStrikeState`, plain numbers) lives in a `Map` in the scene's simulation graph
(snapshot) and in the state hash; the policy memory is a field of the `BotPilot` (already a registered
snapshot class). The mechanics change the simulation, so `PROTOCOL_VERSION` is 7 (docs/ONLINE.md).

## Measurements (80 seeds x 2 seatings per cell, average v average, same seeds, mechanics off v on)

The tables below were measured with the bot policy ON (before it was switched off, see §3); with the
policy off the ace report (12 seeds, 480 games/arm) reads off 63 % -> on 65 % (+2.5).

Ace squad (one ace build + two of the faction's non-ace auto-fill ships) v the same squad with a
non-ace build of the same hull at equal-or-lower points, 20 ace builds (4 per faction), 3200 games/arm:

| | off | on |
|---|---|---|
| ace squad win % | 61 % [59-63] | 63 % [61-65] (+1.9) |

Gate 2 with ACES (coordinated average squad of non-ace builds v solo experts flying ace builds of the
same hulls): 88 % off -> 84 % on (stays far above 70 %); the real gate (`npm run test:skill`): 95 %.
Classic faction totals (auto-fill lists, 160 games per pairing): the mechanics move a total by <= 3 points,
inside the noise (a pairing's 95 % interval is about +-8):

| | TH | FC | SC | VC | AE |
|---|---|---|---|---|---|
| off | 51 % | 40 % | 55 % | 49 % | 55 % |
| on | 49 % | 38 % | 56 % | 52 % | 55 % |

FC sits below 45 % in the OFF arm too (the working tree's auto-fill lists, not the aces): the mechanics
neither cause nor fix it.

Ace Duel presets (`DuelTempoSim`) and the other solo-resolver modes do not run these mechanics: their
numbers do not change with them.

What was tried and rejected (ace squad win %, shift vs off): a policy that flies away after every burst
-11.5; fleeing only when hurt -3; strike bonus on every target (not only the marked one) +1.5-2.8 but
gate 2 with ace solos fell to 73-77 %; so the strike counts only on the marked target. Any time an ace
spends away from the guns costs more than the evasion saves — the policy therefore only breaks off when
the position is bad (hurt and shot at, or outnumbered).

## Tests

`tests/unit/arcade/systems/{AceStrike,Disengage}.test.ts`, `tests/unit/arcade/AceShotLevers.test.ts`,
`tests/unit/arcade/ai/AceStrikePolicy.test.ts`, `tests/unit/data/aceStatus.test.ts`,
`tests/unit/simulation/skill/ArenaAce.test.ts` (determinism, off arm, strike spent on the next shot).
