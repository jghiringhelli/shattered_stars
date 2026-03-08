# UI Wireframes & Layout Specifications

> ASCII layout specs for all major UI surfaces. Reference resolution: **1920x1080**.

---

## Battle HUD (`EnhancedBattleHUD.cs`)

Canvas: ScreenSpaceOverlay, sortingOrder 100.

```
+-------------------------------------------------------------------+
|  [BATTLE INFO]                              [MINIMAP AREA]        |
|  Time: 30:00                               Anchor: (0.7,0.7)-    |
|  Score: 0 - 0                              (1.0,1.0)             |
|  200x70px                                  Shows tactical map     |
|  (disabled by default)                                            |
|                                                                   |
|                                                                   |
| +--SQUAD OVERVIEW--+                                              |
| | (scrollable)     |                                              |
| | Ship 1  [===]    |          GAMEPLAY AREA                       |
| | Ship 2  [===]    |                                              |
| | Ship 3  [===]    |                                              |
| | Ship 4  [===]    |                                              |
| | 200px wide       |                                              |
| | Anchor: left     |                                              |
| | (0,0.22)-(0,0.85)|                                              |
| +------------------+                                              |
|                                                                   |
|                                                                   |
| +--PLAYER HUD-----------+                                        |
| | Ship Name              |                                        |
| | HP: [=========] 3/3    |                                        |
| | SH: [=========] 2/2    |                                        |
| | 280x100px, bottom-left |                                        |
| +------------------------+                                        |
+-------------------------------------------------------------------+
```

**Player HUD detail** (280x100px):

```
+------------------------------+
|  X-WING (Pilot Name)        |  <- top 25%, font scaled
|------------------------------|
|  HP [================] 3/3  |  <- orange (0.9,0.7,0.2)
|  SH [================] 2/2  |  <- cyan (0,1,1)
+------------------------------+
```

**Color palette**:
- Background: `rgba(5, 5, 20, 0.85)`
- Border: `rgba(77, 128, 204, 0.4)`
- Hull bar: Orange `(0.9, 0.7, 0.2)`
- Shield bar: Cyan `(0, 1, 1)`
- Player health: Green
- Enemy health: Red
- Stress: Yellow

---

## Squad Builder (`CompleteSquadBuilder.cs`)

Canvas: ScreenSpaceOverlay, sortingOrder 10.

```
+===================================================================+
|              * X-WING SQUADRON BUILDER *                          |
|          Gold text (1,0.9,0.3), 32pt bold, blue glow             |
|          Anchor: (0,0.9)-(1,0.98) = top 8%                       |
+===================================================================+
|                              |                                    |
| +--SHIP SELECTION----------+ | +--SQUAD DISPLAY----------------+ |
| | "SHIP SELECTION" 16pt    | | | Faction 1 Squad               | |
| |                          | | |   Ship A - 19pts              | |
| | [v] REBEL ALLIANCE       | | |   Ship B - 17pts              | |
| |   X-Wing       19pts    | | |   Total: 36/200               | |
| |   A-Wing       17pts    | | |                                | |
| |   Y-Wing       18pts    | | | Faction 2 Squad               | |
| |   B-Wing       22pts    | | |   Ship C - 15pts              | |
| |   ...                   | | |   Ship D - 18pts              | |
| |                          | | |   Total: 33/200               | |
| | [v] GALACTIC EMPIRE      | | |                                | |
| |   TIE Fighter  15pts    | | |                                | |
| |   TIE Int.     18pts    | | |                                | |
| |   ...                   | | |                                | |
| |                          | | |                                | |
| | [v] SCUM & VILLAINY      | | |                                | |
| |   Z-95         16pts    | | |                                | |
| |   ...                   | | |                                | |
| |                          | | |                                | |
| | Anchor: (0.05,0.1)-     | | | Anchor: (0.45,0.1)-           | |
| | (0.45,0.88) = 40%       | | | (0.95,0.88) = 60%            | |
| | Scrollable, 15px spacing| | |                                | |
| +--------------------------+ | +--------------------------------+ |
|                              |                                    |
+===================================================================+
| [Start Game]    [Squad Builder]    [Settings]    Points: 36/200  |
| Anchor: (0.05,0)-(0.95,0.1) = bottom 10%                        |
+===================================================================+
```

**Ship entry detail** (per row in ship selection):

```
[25x25 sprite] Ship Name .................. 19 pts  [+]
```

**Color palette**:
- Background: `rgba(13, 13, 26, 0.95)`
- Panel bg: `rgba(26, 26, 38, 0.9)`
- Border: `rgba(102, 102, 153, 1.0)`
- Title: Gold `(1, 0.9, 0.3)`
- Panel titles: White
- Ship sprites: 25x25px, async loaded from `Resources/images/bases/`

---

## Campaign Victory/Defeat (`CampaignVictoryDefeatScreen.cs`)

Canvas: ScreenSpaceOverlay, sortingOrder 100. Initial alpha 0 (fades in over 1s).

```
+===================================================================+
|                                                                   |
|                    MISSION COMPLETE                                |
|                  48pt white, Y+400                                |
|                (or "MISSION FAILED" in red)                       |
|                                                                   |
|  +--STATISTICS------+ +--REWARDS---------+ +--UNLOCKS---------+  |
|  | "MISSION STATS"  | | "XP & REWARDS"   | | "NEW UNLOCKS"   |  |
|  | 24pt yellow      | | 24pt cyan        | | (if any)        |  |
|  |                  | |                  | |                  |  |
|  | Time: 05:23      | | Base XP: 100    | | A-Wing Unlocked  |  |
|  | Enemies: 4       | | Bonus XP: +75   | | Proton Torpedoes |  |
|  | Accuracy: 67%    | | Total: 175      | |                  |  |
|  | Damage: 12       | | [===XP Bar====] | |                  |  |
|  | [Performance===] | | Level: 3 -> 4   | |                  |  |
|  |                  | | Credits: +200   | |                  |  |
|  | Pos: (-400,100)  | | Pos: (0,100)    | | Pos: (400,100)  |  |
|  | 350x300px        | | 350x300px       | | Dynamic         |  |
|  +------------------+ +------------------+ +------------------+  |
|                                                                   |
|  +--SHIP STATUS----------------------------------------------+    |
|  | Pilot 1: Survived  +25 XP    Pilot 2: Survived  +25 XP  |    |
|  | Pilot 3: Destroyed  0 XP    Pilot 4: Survived  +25 XP   |    |
|  +------------------------------------------------------------+  |
|                                                                   |
|  +--NEXT MISSION PREVIEW--------------------------------------+   |
|  | Mission 4: "Imperial Depot Raid"                           |   |
|  | Time-pressure assault on supply depot                      |   |
|  +------------------------------------------------------------+   |
|                                                                   |
|     [Continue]          [Return to Map]        [Replay Mission]   |
|                                                                   |
+===================================================================+
```

**Animation timing**:
- Fade-in: 1.0s
- Element stagger: 0.2s between panels
- XP count-up: 2.0s
- Auto-advance: 10s
- Easing: EaseInOut

**Audio cues**: Victory/defeat sound on open, XP tick during count-up, unlock fanfare per item.

---

## Squad Info Display (`SquadInfoDisplay.cs`)

Auto-hides after 5 seconds. Shown during battle start.

```
+--REBEL SQUADRON---------+    +--IMPERIAL SQUADRON------+
| "Rebel Squadron"  CYAN  |    | "Imperial Squadron" RED |
|                         |    |                         |
| [X] X-Wing     19pts P |    | [T] TIE Fighter 15pts A|
| [A] A-Wing     17pts P |    | [T] TIE Fighter 15pts A|
| [Y] Y-Wing     18pts A |    | [I] TIE Int.   18pts A |
|                         |    |                         |
| Total: 54 pts           |    | Total: 48 pts          |
+-------------------------+    +-------------------------+

P = Player-controlled    A = AI-controlled
```

---

## Practice Mode UI (`PracticeModeUI.cs`)

### Setup Panel (Pre-Battle)

```
+===================================================================+
|                    PRACTICE MODE                                  |
|                                                                   |
|  Mode:        [Tutorial     v]                                   |
|  Difficulty:  [Beginner     v]                                   |
|  Opponents:   [====o========] 2                                  |
|                                                                   |
|  [x] Enable Hints                                                |
|  [x] Adaptive Difficulty                                         |
|                                                                   |
|              [START PRACTICE]                                     |
+===================================================================+
```

### Practice HUD (During Battle)

```
+-------------------------------------------------------------------+
|  Mode: Tutorial | Difficulty: Beginner | Time: 02:15             |
|                                                                   |
|                       GAMEPLAY AREA                               |
|                                                                   |
|                                           +--HINT PANEL--------+ |
|                                           | Movement Tip:       | |
|                                           | Use W/A/S/D to move | |
|                                           | Bank with Q/E       | |
|                                           |     [Dismiss]       | |
|                                           +--------------------+ |
|                                                                   |
|     [End Practice]                                                |
+-------------------------------------------------------------------+
```

### Progress Panel (Post-Battle)

```
+===================================================================+
|                    SESSION RESULTS                                |
|                                                                   |
|  Total Sessions: 5          Best Score: 1200                     |
|  Total Time: 45 min         Skill Level: Intermediate            |
|  Progress: [===========o========] 55%                            |
|                                                                   |
|  +--SESSION STATS--+                                             |
|  | Accuracy:  72%  |                                             |
|  | Damage:    340  |                                             |
|  | Taken:     120  |                                             |
|  | Destroyed:   3  |                                             |
|  | Hints Used:  4  |                                             |
|  +-----------------+                                             |
|                                                                   |
|        [Continue]        [Return to Menu]                        |
+===================================================================+
```

---

## Pause Menu (Modal Overlay)

```
+-------------------------------------------------------------------+
|                                                                   |
|             +--PAUSED-----------------+                           |
|             |                         |                           |
|             |      [RESUME]           |                           |
|             |      [SETTINGS]         |                           |
|             |      [RESTART]          |                           |
|             |      [QUIT TO MENU]     |                           |
|             |                         |                           |
|             +-------------------------+                           |
|                                                                   |
|          (Background dimmed, gameplay frozen)                     |
+-------------------------------------------------------------------+
```

---

## Settings Screen

```
+===================================================================+
|                         SETTINGS                                  |
|  [Graphics]  [Audio]  [Controls]  [Gameplay]                     |
+===================================================================+
|                                                                   |
|  Resolution:     [1920x1080       v]                             |
|  Quality:        [High            v]                             |
|  VSync:          [x]                                             |
|  Particles:      [x]                                             |
|  Draw Distance:  [==========o===] 80%                            |
|                                                                   |
+===================================================================+
|          [APPLY]                    [RESET TO DEFAULT]            |
+===================================================================+
```

---

## UIGenerator Defaults

These values are used when screens are built programmatically:

| Property | Value |
|----------|-------|
| Reference resolution | 1920x1080 |
| Canvas render mode | ScreenSpaceOverlay |
| Scale mode | ScaleWithScreenSize |
| Match width/height | 0.5 (balanced) |
| Default font | LegacyRuntime.ttf |
| Default font size | 16 |
| Button font size | 14 |
| Header font size | 24 |
| Panel color | `rgba(51, 51, 51, 0.8)` |
| Button color | `rgba(102, 102, 102, 1.0)` |
| Text color | White |
