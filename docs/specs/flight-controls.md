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
- The roll replaces the drift the first tap queued and latches the arrows until released.
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
- Stress, action bar, dial and huge-hull rules are `FlightCapabilities` unchanged, so refusals
  and HUD notices are identical in every mode and for bots.

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

- Unit: `RollDoubleTap`, `ManeuverKey`, `GestureFalsePositives` (replayed traces: rapid
  alternation, tap-spam, hold-then-tap, boost during a turn, chords, unavailable roll),
  `KeyComboTelemetry` (every special ends where X-Wing puts it), defaults / codec / labels.
- E2E: `key-bindings` (every mode: each combo, refusal, silent roll, negatives),
  `input-full-playthrough` (keyboard + touch), `gamepad-defaults`, `flight-school`.