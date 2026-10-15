# Player preferences, Flight School and local telemetry (P0-2/3/4/5)

## Settings (one screen: `SettingsScene`)

Tabs: **1 Audio · 2 Controls · 3 Gamepad · 4 Accessibility · 5 Gameplay · 6 Advanced**.
Keys: 1–6 tabs, ↑/↓ select, ←/→ adjust, ENTER toggle / rebind, ESC · gamepad B · right-click back.
Every change is saved immediately and applied live (`ui/settings/settingsRuntime.ts`).

### Schema (`systems/settingsSchema.ts`, key `shattered_stars_settings`)

| Version | Shape |
|---|---|
| v1 (no `version`) | flat `{ masterVolume, musicVolume, sfxVolume, cameraShake, showDamageNumbers, showMinimap }` (showMinimap is ignored: the radar is always on) |
| v2 | `{ version: 2, audio{master,music,sfx,ui}, accessibility{colorVision,highContrastHud,screenShake,reduceFlashes,textScale}, gameplay{defaultDifficulty,markAssist,showDamageNumbers}, controls{activeProfile,profiles[3]{name,keyboard}}, privacy{telemetryEnabled} }` |

`parseSettings` migrates v1 and validates each field independently (bad field → its default;
volumes clamped; unknown enums rejected; unknown intents / unbindable keys dropped from profiles).
Battle scenes still read the legacy flat view from `registry.get("settings")`; the full document is
`registry.get("preferences")`.

Getters for gameplay code: `isMarkAssistEnabled()` (wired into `SquadBattleAi` and
`ArcadeBotFleet`), `defaultDifficulty()`, `isTelemetryEnabled()`.

### Keyboard rebinding (`input/KeyBindings.ts`, `input/RebindableIntents.ts`)

- `DefaultBindings.ts` stays the single default source; a profile stores only overrides
  (`intent → chord | null`). Effective bindings = `applyKeyOverrides(defaults, overrides)`.
- Conflict = same chord (key + modifiers) on two intents that **share a context**
  (`flight`, `tactical`, `menu`). ↑ for both `PAN_UP` (tactical) and `THRUST_UP` (flight) is legal.
- Rebinding onto a taken key **swaps**: the displaced intent takes the old key.
- ESC is reserved (back / pause) and always keeps its default meaning.
- Three profiles; "Reset to defaults" clears the active profile.
- The live profile is installed in `InputManager` at boot and on change; a Settings overlay
  launched over a battle rebuilds that battle's adapters on close.
- Prompts/Controls screen labels come from `boundKeyLabel` / `keyboardLabelFor` (active profile).

### Accessibility

- **Colour vision**: `SIGNAL_PALETTES` (`ui/theme/signalPalettes.ts`) rewrite the LIVE tokens
  `HOLO_PALETTE` / `SIDE_COLORS`, so radar, edge arrows, status ring, mark brackets and overlays
  switch together. Verified by simulating each deficiency (Machado 2009) and requiring CIE76
  ΔE ≥ 25 between ally/enemy, ally/player vs mark, mark vs locked target, healthy vs critical hull,
  and WCAG contrast ≥ 3 on the panel. HUD code must read tokens at draw time (no module-level copies).
- **Non-colour backups**: friendly radar blips are ringed, neutral ones squared, hostiles bare;
  friendly edge arrows carry a tail bar; marks are brackets, locks a diamond; critical hull blinks
  on the ring and shows "!" in the readout.
- **High-contrast HUD**, **HUD text size** (100/115/130 %), **screen shake** intensity and
  **reduce flashes** (applied to every `camera.shake/flash` by `ui/settings/cameraComfort.ts`).

## Flight School (`FlightSchoolScene`, `tutorial/*`)

Main menu card (F / START, SKIP on first launch — non-blocking). Sixteen lessons on the shared
engine (PlayerFlightPilot + CycleFlight + BattleHud + DuelPrimaryFire/DiceAttack/DuelBotCrew):
throttle up/down, drift (500 ms cycle), bank, hard turn, Snap turn, Hook, Knife, boost, barrel roll,
primary arc (towed drone), secondary, mark, radar/edge arrows (beacon behind), status ring,
final fight vs one novice bot. `FlightSchoolSteps` completes a lesson only when the observed flight
state proves the input. Deaths respawn. N skips a lesson, ESC leaves. Progress:
`ss_flight_school_v1` (`completed`, `completedAt`, `offerDismissed`, `furthestStep`).

## Local telemetry (`telemetry/*`)

Ring buffer (500 events) in `localStorage["ss_telemetry_v1"]`, never sent anywhere; export/clear
in Settings › Advanced; gated by `privacy.telemetryEnabled` (default on).
Events: `session_start/end`, `mode_start/end` (with `durationMs`, outcome), `death` (cause),
`tutorial_step`, `tutorial_exit` (drop-off), `match_summary` (one per battle, below),
`error` (window error / unhandled rejection).

One-line API for mode scenes (`telemetry/telemetry.ts`):

```ts
trackModeStart("survival", { difficulty });          // when the battle actually starts
trackModeEnd("survival", "defeat", { wave: 7 });      // victory | defeat | draw | quit | completed
trackDeath("survival", killerDefinitionId, { wave }); // player ship destroyed
```

Wired: Skirmish, Dogfight, Ace Duel, Boss Raid, Continuous, Flight School, Survival (one mode
per battle node), Campaign (one per mission).

### Match combat stats (`telemetry/matchStats.ts`, `matchTelemetry.ts`)

A pure per-match accumulator; scenes add one-line `matchStats.record(...)` calls and one
`matchStats.finish(outcome)`, which emits a flat `match_summary` event:

```ts
matchStats.start("dogfight", { difficulty }, this.events); // shutdown before finish → "quit"
matchStats.record({ kind: "shot", friendly, weapon: "primary", hit });
matchStats.record({ kind: "damage", toFriendly, hull, shield });
matchStats.record({ kind: "kill", victimFriendly, victimIsPlayer });
matchStats.finish("victory", { rounds });
```

Fields: `durationMs`, `firstKillMs`, `kills` / `losses` / `playerDeaths`, shots / hits (primary,
ordnance, enemy), damage dealt / taken (hull vs shields), the player's maneuvers by dial colour
(`mvGreen/White/Red`), specials (`kturn`, `segnor`, `tallon`, `boost`, `barrelRoll`, `specials`),
`marks`, `stressMs`, `repairs` / `repairHull` (friendly hull repair pulses, via
`ShipRepairFeedback`), `deployedFriendly` / `deployedHostile`, plus the start/finish details.
"Friendly" = the player's side. Wired in Dogfight, Ace Duel, Boss Raid, Continuous, Survival,
Campaign; Skirmish/Epic/Scenarios (`ArcadeBattleScene`) record start, end, laser/ordnance fire,
projectile hits + damage and kills (deploy / flight / mark hooks pending its reinforcement rework).

### Stats panel (`ui/telemetry/*`)

Settings › Advanced › **VIEW STATS** opens `TelemetryStatsScene` (registered on first use) over
Settings: matches per mode, win rate, median / mean duration, K / D, accuracy, specials per
minute, most common death causes, the Flight School drop-off step. Aggregation is pure
(`telemetry/telemetryStats.ts` → `telemetryStatsViewModel.ts`); ESC / B / right-click close.

### Headless battery

`npm run telemetry:report` (bot-vs-bot per mode × tier → `docs/telemetry/latest-report.md`),
`npm run telemetry:tempo` (cycle / special-recharge experiment → `docs/telemetry/tempo-experiment*.md`),
`npm run telemetry:survival` (node-based roguelite sweep, ADR-0004).

## Menu juice / navigation (`ui/menu/menuTransitions.ts`)

`goToScene` (140 ms fade out) + `fadeInMenu` (200 ms) — total ≤ 400 ms, one easing;
`bindMenuBack` = ESC + gamepad B + right-click → the screen's single back action;
hover/press/back sounds on the UI audio bus (`audioManager.playUiSound`).
