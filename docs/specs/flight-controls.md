# Flight controls — roll, Snap Turn, Hook Loop, Knife Roll

Status: implemented (protocol 4). Code: `src/arcade/RollDoubleTap.ts`,
`src/arcade/ManeuverKey.ts`, `src/arcade/ArcadeInputGestures.ts`,
`src/arcade/systems/PilotFlightControls.ts`, `src/ui/input/` (touch).

## Why

The old barrel-roll chord (← and → pressed almost together) fired during ordinary
alternating steering, and Hook / Knife were spread over Shift+Q/E, T/Shift+T, the
D-pad and both triggers. The scheme now has two ideas only:

1. **Barrel roll = double-tap of the SAME side** (← ← rolls left, → → rolls right).
2. **One MANEUVER key** for the specials the arrows cannot reach.

## The scheme

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Barrel roll L / R | double-tap ← / → | double-flick the left stick to that side · or right-stick flick ← / → | double-tap the left / right half of the stick |
| MANEUVER key | **Z** (rebindable) | **LT** (rebindable) | MNVR button beside the FIRE zone |
| Snap Turn | tap Z · or ↓↓ | tap LT · or right-stick flick ↓ | tap MNVR · or double-tap stick down |
| Hook Loop L / R | hold Z + ← / → | hold LT + stick ← / → | press MNVR, drag ← / → |
| Knife Roll L / R | double-tap Z, hold the second press + ← / → | double-tap LT, hold + stick ← / → | double-tap MNVR, drag ← / → |
| Boost | ↑↑ (or the optional extra key) | A | double-tap stick up |
| Hard turn (90°) | Q / E | LB / RB | — |

Direct intents (`KTURN`, `SEGNOR_*`, `TALLON_*`, `BARREL_ROLL_LEFT/RIGHT`, `BOOST`) still
exist: bots press them (PilotHands), and the player may bind them as optional extra keys
in Settings. They have no default key.

## Gesture rules (named constants, all in ms)

- Roll (`RollDoubleTap`): two presses of the same side, first press ≤ `ROLL_TAP_MAX_MS`
  (140, shorter than a 150 ms bank hold) and ≥ `ROLL_TAP_MIN_MS` (25), gap ≥
  `ROLL_TAP_GAP_MIN_MS` (25), second press within `ROLL_DOUBLE_TAP_WINDOW_MS` (220) of the
  first. Any press of the other side, or both arrows together, forgets the first tap, so
  alternating ← → is always steering. A third quick tap does not roll again.
- The roll replaces the drift the first tap started (instant turns: that tap already
  turned the ship, so the roll slides sideways from the pose it reached and cuts the
  drift back to straight; at most a few degrees of heading) and latches the arrows
  until released.
- If the roll is unavailable (recharging, stressed, not on the action bar, huge hull) the
  taps simply steer — **no refusal chatter**; the ROLL row of the status HUD (and the
  touch ring around the stick) shows the recharge. Dedicated buttons still report refusals.
- MANEUVER key (`ManeuverKey`): tap ≤ `MANEUVER_TAP_MAX_MS` (300) = Snap Turn, requested
  when the double-tap window (`MANEUVER_DOUBLE_TAP_WINDOW_MS`, 220) closes with no second
  press — a lone tap cannot be told from the first half of a Knife before that, and queueing
  it at once would let the 500 ms cycle fly it first. Hold + a side pressed after the key (or
  within `MANEUVER_SIDE_GRACE_MS` = 60 before it) = Hook. Second press inside the window +
  a side = Knife; the second press released with no side = Snap Turn. A side that was already
  held when the key went down never hooks (steer left, tap Z = Snap Turn).
- While the key is held the arrows belong to it (no roll tracking); after a roll or a
  Hook/Knife the arrows steer nothing until both are released.
- Stress, action bar, dial, ship-identity and huge-hull rules are `FlightCapabilities`, so
  refusals and HUD notices are identical in every mode and for bots.
- Capital (huge) ships have no maneuver key at all (`FlightCapabilities.canManeuver = false`):
  the key — on the gamepad it is LT, shared with commander order 1 — is not a flight input for
  them: no Snap request, no "NOT ON DIAL" flash, and the arrows keep steering while it is held.
  Orders (LT / RT / D-pad on the gamepad, 1–4 on the keyboard) work as before.

## Ship identity — one signature trick

A ship with many specials is impractical to fly by hand and a smart AI would destroy a human with
it. In tabletop the hulls with the barrel roll do not have the Hook (Segnor) or the Knife (Tallon),
and the ones with one do not have the other. So by default a ship flies **at most one of
{barrel roll, Hook Loop, Knife Roll}** — its signature trick. **Boost and Snap Turn are never
affected.** Bots and the player use the same rule (it lives in `flightCapabilitiesOf`, which
feeds `BotView`, `PilotFlightControls` and the HUD refusals).

The signature is `ShipDefinition.signatureTrick` (`barrel_roll | hook_loop | knife_roll | none`).
When absent, it is the first trick the hull's card prints out of its role's preference order
(`src/data/shipSpecials.ts`):

| Role | Preference (first printed wins) |
|---|---|
| light fighter, interceptor | barrel roll → Knife → Hook |
| heavy fighter, gunship, bomber | Hook → Knife → barrel roll |
| support | none (Snap Turn only) |
| capital (huge) | none, and no maneuver key |

Explicit data overrides: Raven, Owl, Fang, Talon → `knife_roll` (so the Knife stays flown by
somebody); Specter → `barrel_roll` (a support hull whose only trick is the roll). A hull that
prints one trick only keeps it (Gladius: roll, Ravager: Hook).

Effective set = card ∩ rule: the dial hides the Hook / Knife cells a ship may not fly, the action bar
hides the barrel roll, and the pick screen (stats tab) and encyclopedia overview list
"SPECIALS  Boost · Barrel Roll · Snap Turn" from the same helpers. A refused gesture reports as
"NOT ON DIAL" (maneuver key) or stays silent (arrow double-tap), exactly like any trick the card lacks.

**Setting** (Settings › Gameplay › Ship Specials; `gameplay.shipSpecials`): *Ship identity*
(default) or *Full card*. Full card lifts the rule in offline modes (Skirmish, Dogfight, Ace Duel,
Survival, Campaign, bots included); Flight School's trainee is always unrestricted, and its stress and Snap / Hook / Knife recharge are cleared at every lesson start (and whenever no special is in flight) so a lesson is never blocked by the one before; a refused move says why on the lesson card (STRESSED / RECHARGING / NOT ON DIAL).

**Online**: lockstep needs identical rules, so online battles always use identity.
`flightCapabilitiesOf(id, trickRule?)`, `createShipControl` and `createCycleFlight` take an explicit
pure `trickRule` ("identity" | "full"). With none given they use `activeTrickRule()` = the Settings
choice unless `lockTrickRuleToIdentity(true)` (FlightCapabilities.ts) is set — the online battle
code must call it when a lockstep battle is built (and `false` when it ends), or pass `"identity"`.

## Instant turns — a human's steering starts at once

Status: implemented. Code: `src/core/cycleInterrupt.ts`, `src/arcade/systems/ShipMotion.ts`
(`stepMotion`), `PilotFlightSteps.ts` (`applySteering`), `PilotFlightControls.ts`.

A steering command used to wait for the next 500 ms boundary (up to 500 ms of latency). Now a
**human** pilot's turn cuts the running cycle:

- **What cuts** (a *new* request): a steer edge from none / the other side to a side (tap or hold
  → drift), the hold → bank upgrade (`BANK_HOLD_MS`), Q / E hard turn, and a double-tap roll
  cutting its first tap's drift back to straight. A held key that keeps asking for the same
  thing is not new: the normal cadence continues at the boundaries.
- **How it cuts**: the running cycle ends at the ship's current pose and heading (the prefix of
  its path, nose tangent to it, so the heading is continuous) and the requested maneuver starts
  there at once as a **full 500 ms template** flown at the speed cap of that moment. Telemetry:
  the cut cycle ends exactly at `predictArcPose(start, step, base, progressAtCut)`.
- **Eligibility**: the cycle must have flown `CYCLE_INTERRUPT_MIN_ELAPSED_MS` (80 ms, five 60 Hz
  ticks); a request inside that window stays queued and cuts at that age (never refused). It does
  not cut when the requested maneuver is the one already flying, when either maneuver is an
  atomic special, or for capital (huge, boat-easing) hulls.
- **Atomic specials stay atomic**: Snap Turn, Hook Loop and Knife Roll are never cut and never
  cut anything; they queue to the boundary as before (a lone Z tap is still held back until the
  Knife window closes). Barrel roll and boost are actions, not maneuvers (instant, unchanged).
- **Release does not cut**: a tap still flies exactly one full 500 ms drift (the tap is "owed"
  and the cut pays it); the throttle keeps its timing (flown speed is fixed whenever a cycle starts).
- **Bots keep the boundary**: `applyPilotFlightInput(..., { interruptCycles })` is an explicit
  option, off by default; only `PlayerFlightPilot` and the human seat of `ArcadeBattleScene` pass it.
- **Weapons**: attacks are paced by time (`ATTACK_INTERVAL_MS`, hit immunity), not by cycle
  phase, and a cut keeps `firedLaserThisCycle`, so a cut grants no extra attack.
- **Stress**: the cut cycle is reported as a partial `CompletedCycle` (`fraction` = share flown)
  and accrues its color's rate for `fraction × 500 ms` only; the new cycle accrues its own,
  so nothing is counted twice. Snap / boost spikes are instant, as before.
- **Phase is per ship**: cycles are no longer aligned to a global 500 ms grid for a human's
  ship. Everything that matters is time-based (weapons, scenario rounds, reinforcements, squad
  marks, boss timers); only the cycle-phase readers (`msToCommit` of bots, the tactical path
  overlay) read `maneuverProgress`, which is always the ship's own.
- **Online**: the cut is a pure function of the seat's input stream and the sim clock. The
  request is the control state's `interruptQueued` flag (hashed) next to `nextManeuver` and
  `maneuverProgress`; the pilot's `steerRequest` memory travels in the resync snapshot with the
  rest of the pilot memory.

Telemetry: `ArcadeFlightRecorder` takes scripted `interrupts` (like `actions`);
`npm run analyze:telemetry` gates MOV-15..18; the live spec classifies every cycle by its own
start / end (the boundary is where `maneuverProgress` drops or the maneuver id changes).

## Dash distances

Boost (`BOOST_DISTANCE_PX`) is **300 px** forward; a barrel roll slides **one speed-2 template
plus the ship's base** sideways (`barrelRollDistance`, 112 px on a small ship). Both are still
instantaneous in the simulation (the render-only glide lives in `src/rendering/`); heading is
unchanged and the cycle in progress is carried along.

## Speed cap per maneuver

The throttle (↑/↓) stays a discrete **set speed** in notches (`control.speed`, no gradual
acceleration). Each ship's own dial says at which speeds a maneuver exists (fighter: straight 1–4,
bank 1–3, turn 1–2, Snap at 4), so a maneuver is never flown faster than its dial prints it.
Whenever a cycle **starts** (`advanceCycle` / `startManeuver` at a boundary, or an instant turn
cutting the running cycle, when the next maneuver is committed) the
**flown speed** of that cycle is `min(set speed, the maneuver's dial cap)` (`src/core/speedCap.ts`,
`flownSpeed`):

- the highest dial speed of that maneuver at or below the set speed; if the dial prints it only
  above the set speed (a Snap that exists at 4 only, set speed 2) the nearest printed speed;
- **Snap Turn sits at the highest printed speed**: speed 4 on every dial whose ship can fly 4
  (the interceptors print 2 and 4; hulls that top out at 2–3 keep their printed speed). A
  Snap turn therefore covers 192 px on a small ship whatever the set speed (at set speed 1–3 it is
  flown at the nearest printed speed, 4); its cycle stress is classified like any other turn
  cycle (`accrueCycleStress`: red unless the dial prints a turn at that flown speed);
- **drift** (the held-key shallow turn, not on the dial) uses the **bank** entries; straight uses the
  straight entries; Q/E turns, Snap Turn, Hook Loop and Knife Roll use their own entries;
- a maneuver the dial does not print at all is not capped; barrel roll and boost are actions and
  unchanged; huge ships (capital profile) have no table and keep flying at the set speed;
- set speed 0 (hover, ships with minimum speed 0) is never lifted: the ship pivots in place;
- straight above the dial's top speed (the upgrade notch) is not capped;
- when the next cycle is a straight, the flown speed is the set speed again: set-and-forget, the pilot
  never re-presses ↑. A hard turn (Q/E) no longer retunes the throttle; only a stressed pilot whose
  capped turn would be red is moved to the best non-red turn speed (`hardTurnThrottle`).

The template path, its displacement and the stress classification of the cycle (`completed.speed`,
`accrueCycleStress`) all use the flown speed, so a capped maneuver is an on-dial maneuver with its
real green / white / red color.

Control state (plain numbers, deterministic, hashed and snapshotted online):
`interruptQueued` = the queued maneuver may cut the running cycle (instant turns);
`cycleSpeed` = flown speed of the cycle in progress; `speedCap` = the highest dial speed of the
maneuver flown now (null when uncapped; it may exceed `speed`); `capabilities.dialSpeeds` = the
ship's dial speeds per maneuver group (bank / turn / straight / kturn / segnor / tallon), built
from the effective dial by `flightCapabilitiesOf`. HUD helpers for the maneuver queued next:
`queuedCycleSpeed(control)` and `queuedSpeedCap(control)` (`src/core/speedCap.ts`). Bots: `OwnShipView.dialSpeeds`;
`ManeuverPlanner` flies every option at `flownSpeed(...)`, and on equal scores keeps the current
throttle (options that fly the same capped speed tie).

### Speed distortion

A render-only cue for the player's ship (no text, bars or sound): while the flown speed equals the
cap of the maneuver being flown (`cycleSpeed >= speedCap`, or the top notch when nothing caps),
1–3 thin translucent compression arcs drift back from just ahead of the nose and a faint lens
stretches along the heading. Intensity follows `speedDistortionTarget(control)` (0.4 at notch 1 up to 1
at notch 5; 0 below the cap and for huge ships) and fades over 250 ms
(`smoothSpeedDistortion`). `src/rendering/speedDistortion/`: Graphics only (WebGL and Canvas), one
pooled object, hidden when idle, clocked by the scene time. It reads only the control state
(`PlayerHudState.speedDistortion`, fed through the HUD snapshot builders and `withSpeedDistortion`), so
online battles render it like offline ones and nothing reaches the simulation or its hashes. With Reduce
Motion it is a static faint lens. Bots' ships get no effect.

## Stress — clears by itself

Stress (0–1 bar, `src/arcade/ArcadeStress.ts`) is applied once per **completed cycle** by
`accrueCycleStress` (`CycleFlight`), classified against the ship's dial. A cycle a human's turn
cut short counts for the share that was flown (`CompletedCycle.fraction`; the gain / drain is
scaled by it, see Instant turns). No recovery action is ever
required:

| Cycle color | Rate (bar / s) | Constant |
|---|---|---|
| red | +0.28 (builds, no passive drain) | `STRESS_RATES.red` |
| white (any maneuver, straight included) | −0.20 | `STRESS_PASSIVE_DRAIN_PER_SECOND` |
| green | −0.35 (passive + bonus) | `+ STRESS_GREEN_BONUS_DRAIN_PER_SECOND` (0.15) |

- Snap Turn (`KTURN_STRESS_INSTANT` 0.5) and boost (`BOOST_STRESS_INSTANT` 0.15) still add stress at once.
- The stressed flag latches at ≥ 0.7 (`STRESS_HIGH`) and releases at ≤ 0.15 (`STRESS_LOW`). While latched,
  `FlightCapabilities` refuses red maneuvers / specials and every action.
- From a full bar a stressed pilot is clear in about **4.5 s** of white flying (9 cycles of 500 ms)
  and about **2.5 s** of green flying; flying red keeps building stress.
- Relief tiers (auras, cards) ease a cycle's color; the rate multiplier scales only the gain.

## Input layer

- `MANEUVER` is a *held* intent (keyboard, gamepad button, touch). The keyboard adapter shows a
  sub-frame tap as held for one poll; the touch controls stretch a tap to ≥ 60 ms
  (`MinHoldLatch`).
- Online: `MANEUVER` is held bit 4 of the input word (`PilotInputCodec`), so the one-shot
  press bits moved up one place — **PROTOCOL_VERSION 4** (docs/ONLINE.md). Gestures are
  recognised from held bits on the simulation clock, identically on every client.
- Contexts: `MANEUVER` is pilot-only, so it shares LT with commander order 1 (no capital ship
  can maneuver); gamepad Y / L3 stay HERO_POWER_1/2.

## Verification

- Unit: `ShipIdentity` (capabilities of every hull, signature table, effective labels),
  `ShipIdentityGestures` (identity traces, capital maneuver key), `RollDoubleTap`, `ManeuverKey`, `GestureFalsePositives` (replayed traces: rapid
  alternation, tap-spam, hold-then-tap, boost during a turn, chords, unavailable roll),
  `KeyComboTelemetry` (every special ends where tabletop puts it), defaults / codec / labels.
- E2E: `key-bindings` (every mode: each combo, refusal, silent roll, negatives),
  `input-full-playthrough` (keyboard + touch), `gamepad-defaults`, `flight-school`.
- Live telemetry: `flight-telemetry-live` plays seeded random keyboard gestures in Dogfight,
  Ace Duel, Boss Raid, Survival, Campaign and Skirmish, samples every ship (player and bots)
  each frame and checks it against `XWingFlightOracle`: every UNINTERRUPTED cycle ends on its
  template (≤ 2 px / 1°; measured 0.01 px / 0°); a cycle the player's instant turn cut ends
  exactly on the arc prefix (`predictArcPose` at the progress it was cut) and a full template
  follows from there; no heading step beyond the maneuver's rate and no position jump at a cut;
  bots never cut a cycle; cycles are told apart by their own start / end, never by a 500 ms grid.
  Mid-cycle poses sit on the template arc, no frame teleports, a boost / barrel
  roll inside a cycle displaces it by exactly its distance
  (300 px / speed-2 template + base) without turning the ship, and boost (4.5 s), roll (3 s)
  and Snap Turn (5 s) never fire again before recharging. A throttle change lands in
  `control.speed` at once but flies from the next cycle (the path is built at the boundary, at
  `control.cycleSpeed`): the oracle is asked about the flown speed, a maneuver is never flown above
  its dial cap, a straight cycle flies the set speed again, and capped bank / turn / drift cycles
  have a dial entry that classifies them. Headless: `ArcadeFlightTelemetry` (`cycleSpeeds`),
  `tests/unit/core/speedCap.test.ts`, `tests/unit/arcade/SpeedCapFlight.test.ts`; instant turns:
  `tests/unit/core/cycleInterrupt.test.ts`, `tests/unit/arcade/systems/PilotInterrupts.test.ts`,
  `tests/unit/simulation/flight/InterruptTelemetry.test.ts`, `tests/unit/net/cycleInterruptLockstep.test.ts`.