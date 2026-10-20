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
Survival, Campaign, bots included); Flight School's trainee is always unrestricted.

**Online**: lockstep needs identical rules, so online battles always use identity.
`flightCapabilitiesOf(id, trickRule?)`, `createShipControl` and `createCycleFlight` take an explicit
pure `trickRule` ("identity" | "full"). With none given they use `activeTrickRule()` = the Settings
choice unless `lockTrickRuleToIdentity(true)` (FlightCapabilities.ts) is set — the online battle
code must call it when a lockstep battle is built (and `false` when it ends), or pass `"identity"`.

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
  each frame and checks it against `XWingFlightOracle`: every 500 ms cycle ends on its template
  (≤ 2 px / 1°; measured 0.01 px / 0°), mid-cycle poses sit on the template arc, no frame
  teleports, a boost / barrel roll inside a cycle displaces it by exactly its distance
  (220 px / speed-1 template + base) without turning the ship, and boost (4.5 s), roll (3 s)
  and Snap Turn (5 s) never fire again before recharging. A throttle change lands in
  `control.speed` at once but flies from the next cycle (the path is built at the boundary).