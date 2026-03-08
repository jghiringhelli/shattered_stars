# Menu Flow Diagram

> Complete screen-to-screen navigation map with button layouts and session data flow.

---

## Master Navigation Tree

```
                            SPLASH SCREEN
                                 |
                            (auto 0.5s)
                                 |
                          +--------------+
                          |  MAIN MENU   |
                          +--------------+
                         /    |    |    \   \
                        /     |    |     \   \
            +-----------+ +--------+ +----------+ +---------+ +--------+
            |SINGLE     | |MULTI-  | |TOURNAMENT| |SQUAD    | |GAME    |
            |PLAYER     | |PLAYER  | |          | |BUILDER  | |GUIDE   |
            +-----------+ +--------+ +----------+ +---------+ +--------+
           / | | | \ \        |          |
          /  | | |  \ \       |          |
  +------+ +-+ +-+ +--+ +--+ |    +-----+------+
  |DOGFIG| |C| |S| |SU| |PR| |    |TOURN|DRAFT |
  |  HT  | |A| |K| |RV| |AC| |    |HUB  |LOBBY |
  +------+ |M| |I| |IV| |TI| |    +-----+------+
     |     |P| |R| |AL| |CE| |       |      |
     |     |A| |M| |  | |  | |       |      |
     |     |I| |I| +--+ +--+ |       |      |
     |     |G| |S|   |    |  |       |      |
     |     |N| |H|   |    |  |       |      |
     |     +-+ +-+   |    |  |       |      |
     |      |   |    |    |  |       |      |
     +------+---+----+----+--+-------+------+
                       |
                 +-----+------+
                 |SQUAD BUILDER|
                 +-----+------+
                       |
                 +-----+------+
                 |   BATTLE    |
                 +-----+------+
                      / \
                     /   \
              +------+ +------+
              |VICTORY| |DEFEAT|
              +------+ +------+
                  |       |
              +---+-------+---+
              | RESULTS/NEXT  |
              +---------------+
```

---

## Screen-by-Screen Reference

### Main Menu

| # | Button Label | Color | Destination |
|---|-------------|-------|-------------|
| 1 | SINGLE PLAYER | Green `(0, 0.85, 0.4)` | `SinglePlayerMenu` |
| 2 | MULTIPLAYER | Cyan `(0, 0.8, 0.95)` | `MultiplayerMenu` |
| 3 | TOURNAMENT | Gold `(0.95, 0.8, 0.2)` | `TournamentHub` |
| 4 | SQUAD BUILDER | Light Blue | `SquadBuilder` |
| 5 | TUTORIAL | Bright Green | Tutorial selection modal |
| 6 | GAME GUIDE | Sky Blue | `GameGuide` |
| 7 | SETTINGS | Blue-Gray | `Settings` |
| 8 | PROFILE | Magenta | `PlayerProfile` |
| 9 | QUIT | Bright Red | Confirmation dialog |

**Fixed elements**: Player info widget (top-right: name, level, XP, credits), news panel (right), star field background, version info (bottom-left), social links (bottom).

**Back**: None (root screen).

---

### Single Player Menu

| # | Button Label | Color | Destination |
|---|-------------|-------|-------------|
| 1 | DOGFIGHT | Orange | Faction selection modal |
| 2 | SKIRMISH | Green | `SkirmishSetup` |
| 3 | CAMPAIGN | Gold/Amber | `CampaignLanding` |
| 4 | SURVIVAL | Bright Red | `SurvivalSetup` |
| 5 | EPIC BATTLES | Magenta/Purple | `EpicMode` |
| 6 | PRACTICE | Bright Cyan | `PracticeSetup` |

**Back**: Main Menu.

**Dogfight modal buttons**: Rebel Alliance, Galactic Empire, Scum & Villainy, Cancel.

---

### Multiplayer Menu

| # | Button Label | Color | Destination |
|---|-------------|-------|-------------|
| 1 | QUICK MATCH | Green | Auto-matchmaking -> `MultiplayerHub` |
| 2 | HOST GAME | Cyan | Host settings modal -> `MultiplayerLobby` |
| 3 | JOIN GAME | Yellow | Server browser modal |
| 4 | PRIVATE MATCH | Magenta | Room code input modal -> `MultiplayerLobby` |
| 5 | RANKED MATCH | Orange | Ranked matchmaking -> `MultiplayerLobby` |

**Fixed elements**: Player stats bar (Wins, Losses, Win Rate, Rank, Rating, Streak).

**Back**: Main Menu.

**Host Game modal**: Game Name (input), Max Players (2/4/6/8), Game Mode (dropdown), Select Map, Private toggle, Create / Cancel.

**Join Game modal**: Server list table (Name, Mode, Players, Ping, Join button), filter buttons (All / Squad Battle / Draft / Epic), Refresh.

**Private Match modal**: Room Code input (6 chars), Join / Cancel.

---

### Campaign Landing

| # | Button / Element | Destination |
|---|-----------------|-------------|
| 1 | Faction cards (left panel) | Selects faction campaign |
| 2 | ENTER CAMPAIGN | `CampaignMissionSelection` |
| 3 | VIEW PROGRESS | Progress detail breakdown |
| 4 | SETTINGS | Campaign-specific options |

**Factions available**: Rebel Alliance, Galactic Empire, Scum & Villainy, Galactic Republic, Separatist Alliance, First Order, Resistance.

**Right panel**: Selected campaign title, description, progress slider, mission counts.

**Back**: Single Player Menu.

---

### Campaign Mission Selection

| # | Element | Behavior |
|---|---------|----------|
| 1 | Mission list (scrollable) | Each mission shows status icon |
| 2 | Mission button (unlocked) | Loads mission briefing |
| 3 | CONTINUE: [Mission Name] | Jump to current mission |
| 4 | CAMPAIGN COMPLETE! | Show completion rewards (if all done) |
| 5 | CLOSE | Back to Campaign Landing |

**Mission status icons**: Completed, Current, Available, Locked.

---

### Skirmish Setup

**Battle Config panel**:
- Point Limit: 25 / 50 / 100 / 200 / 300 / 500
- Victory Condition: Elimination / Points / Survival
- Time Limit: 5 / 10 / 15 / 30 / Unlimited
- Enable Epic Ships: toggle

**Map Selection panel**: Grid of maps with preview, name, description.

**AI Config panel**:
- Difficulty: Beginner / Easy / Normal / Hard / Expert
- Personality: Aggressive / Defensive / Balanced
- Enemy Faction: Rebel / Imperial / Scum
- Squad Style: Swarm / Balanced / Heavy
- Aggressiveness slider, Adaptive AI toggle

| # | Button | Destination |
|---|--------|-------------|
| 1 | START BATTLE | Load game scene |
| 2 | SQUAD BUILDER | `SquadBuilder` |
| 3 | RANDOMIZE | Auto-generate both squads |

**Back**: Single Player Menu.

---

### Tournament Hub

| # | Button | Destination |
|---|--------|-------------|
| 1 | CREATE TOURNAMENT | `TournamentCreation` |
| 2 | JOIN TOURNAMENT | Selected tournament |
| 3 | VIEW BRACKET | Full bracket display |
| 4 | REPORT MATCH | Submit match results |
| 5 | REFRESH | Reload list |

**Tournament list columns**: Name, Format (Swiss/SingleElim/Draft/RoundRobin), Participants, Status, Prize Pool, Entry Fee.

**Back**: Main Menu.

---

### Squad Builder

**Layout**: 3-column.

| Column | Content |
|--------|---------|
| Left (40%) | Faction selector + ship list (scrollable) |
| Right (60%) | Current squad composition + point totals |
| Bottom | Controls bar |

| # | Button | Action |
|---|--------|--------|
| 1 | CLEAR SQUAD | Reset all selections |
| 2 | RANDOMIZE | Generate random squad |
| 3 | SAVE SQUAD | Save for later |
| 4 | LOAD SQUAD | Load saved squad |
| 5 | CONFIRM | Proceed to battle |

**Back**: Previous screen (context-dependent).

---

### Epic Mode / Capital Assault

**Boss selection list**:

| Boss | Points | Sections |
|------|--------|----------|
| CR90 Corvette | 90 | 3 |
| Raider Corvette | 100 | 2 |
| GR-75 Transport | 30 | 2 |
| Gozanti Cruiser | 23 | Docking clamps |
| C-ROC Cruiser | 35 | Transport |

| # | Button | Destination |
|---|--------|-------------|
| 1 | SELECT BOSS | Squad Builder |
| 2 | VIEW STATS | Boss detail stats |

**Back**: Single Player Menu.

---

### Practice Setup

**Mode selection**: Tutorial, Free Play, Skill Drills, AI Training.

**Tutorial sub-options**: Quick Start (recommended), Movement Basics, Combat & Weapons, Advanced Maneuvers, Ship Abilities Guide, Free Play.

**Difficulty**: Beginner, Intermediate, Advanced, Expert.

| # | Button | Destination |
|---|--------|-------------|
| 1 | START PRACTICE | Load battle |

**Back**: Single Player Menu.

---

### Survival Setup

**Config**: Wave count (10/20/50/infinite), starting difficulty, wave scaling, squad point limit.

| # | Button | Destination |
|---|--------|-------------|
| 1 | START SURVIVAL | Load battle |
| 2 | SQUAD BUILDER | `SquadBuilder` |

**Back**: Single Player Menu.

---

### Battle Screen (In-Game)

**HUD elements** (see `UI_WIREFRAMES.md` for layout details):
- Player ship health (bottom-left)
- Squad overview (left side, scrollable)
- Battle info: timer + score (top-left, disabled by default)
- Minimap (top-right)
- Objectives (Tab key overlay)

**Controls**:
- ESC = Pause Menu
- F1 = Help
- Tab = Objectives
- WASD = Movement
- Mouse = Aim
- Space = Fire
- Z = Special maneuver
- E = Ship action

---

### Pause Menu (Modal Overlay)

| # | Button | Action |
|---|--------|--------|
| 1 | RESUME | Unpause |
| 2 | SETTINGS | Settings submenu |
| 3 | RESTART | Restart battle |
| 4 | QUIT TO MENU | Confirmation -> Main Menu |

---

### Victory / Defeat Screen

**Victory display**: Title, enemy ships destroyed, ships remaining, duration, accuracy, XP earned, credits earned, unlocks, achievements.

**Defeat display**: Title, ships remaining (enemy), duration, reduced XP (50%), reduced credits (50%).

| # | Button (Victory) | Destination |
|---|-------------------|-------------|
| 1 | NEXT MISSION | Next mission briefing (campaign) |
| 2 | CONTINUE CAMPAIGN | Campaign Landing (campaign) |
| 3 | PLAY AGAIN | Rematch same settings |
| 4 | RETURN TO MENU | Main Menu |

| # | Button (Defeat) | Destination |
|---|-----------------|-------------|
| 1 | RETRY | Restart mission |
| 2 | RETURN TO MENU | Mode menu |
| 3 | RETURN TO MAIN MENU | Main Menu |

---

### Campaign Victory/Defeat (Enhanced)

Extended results screen with:
- Mission objectives completion status
- Ship status (damage, pilot XP)
- Animated XP count-up (2s duration)
- Staggered unlock reveals (0.2s per item)
- Next mission preview panel

| # | Button | Destination |
|---|--------|-------------|
| 1 | Continue | Next mission |
| 2 | Return to Map | Campaign Mission Selection |
| 3 | Replay Mission | Retry current |

---

### Settings

**Tabs**: Graphics, Audio, Controls, Gameplay.

| Tab | Options |
|-----|---------|
| Graphics | Resolution, Quality (Low/Med/High/Ultra), VSync, Particles, Draw Distance |
| Audio | Master / Music / SFX / Voice volume sliders, Mute All |
| Controls | Rebind keys, Sensitivity, Invert Y, Controller toggle |
| Gameplay | Default difficulty, Aim assist, Tutorial hints, HUD opacity |

| # | Button | Action |
|---|--------|--------|
| 1 | APPLY | Save changes |
| 2 | RESET TO DEFAULT | Revert |

**Back**: Previous screen.

---

### Player Profile

**Sections**: Player Info (avatar, name, level, XP), Statistics (matches, W/L, rank, ELO, history), Ship Collection (unlocked ships, skins), Achievements (list + progress).

| # | Button | Action |
|---|--------|--------|
| 1 | EDIT PROFILE | Name/avatar changes |

**Back**: Main Menu.

---

## Game Mode Flow Patterns

### Campaign Flow
```
SinglePlayer -> CampaignLanding -> MissionSelection -> SquadBuilder -> Battle
    -> CampaignVictoryDefeat -> { NextMission | CampaignLanding | MainMenu }
```

### Skirmish Flow
```
SinglePlayer -> SkirmishSetup -> [SquadBuilder] -> Battle
    -> Victory/Defeat -> { PlayAgain | SinglePlayer | MainMenu }
```

### Dogfight Flow
```
SinglePlayer -> FactionModal -> [SquadBuilder] -> Battle (8 min, 5s respawn)
    -> Results -> SinglePlayer
```

### Tournament Flow
```
MainMenu -> TournamentHub -> [Create/Join] -> SquadBuilder -> Battle
    -> TournamentResults -> { NextRound | TournamentBracket | MainMenu }
```

### Multiplayer Flow
```
MainMenu -> MultiplayerMenu -> { QuickMatch | Host | Join | Private }
    -> MultiplayerLobby -> [SquadBuilder] -> Battle -> MultiplayerResults
```

### Survival Flow
```
SinglePlayer -> SurvivalSetup -> [SquadBuilder] -> Battle (waves)
    -> SurvivalResults -> { SinglePlayer | MainMenu }
```

---

## Session Data Flow

Data carried between screens via `SessionData`:

```
SessionData
  +-- currentPlayer: PlayerProfile
  +-- currentGameMode: GameMode
  +-- gameSettings: GameSettings (difficulty, map, options)
  +-- playerSquad: SquadConfiguration
  +-- enemySquad: SquadConfiguration
  +-- battleConfig: BattleConfiguration
  +-- lastMatchResults: MatchResults
  +-- campaignProgress: CampaignProgress (campaign only)
  +-- dogfightConfig: DogfightConfiguration (dogfight only)
```

---

## Navigation Rules

| Rule | Detail |
|------|--------|
| Back button | Every screen except MainMenu; uses history stack (max 20) |
| Forward transition | Slide right-to-left, 0.3s |
| Back transition | Slide left-to-right, 0.3s |
| Modals | Fade-in with background dim |
| Loading screens | Fade with progress bar |
| Special screens | Splash, Loading not added to history |

### Conditional Navigation
- Campaign missions unlock progressively
- Epic ships require sufficient squad points
- Ranked matches require ranked qualification
- Tutorial prompted on first launch (skippable)

---

## ScreenType Enum (Complete)

```csharp
None, SplashScreen, MainMenu, SinglePlayerMenu, MultiplayerMenu,
TournamentMenu, SquadBuilder, GameModeSelection, DraftMode, EpicMode,
Settings, SettingsMenu, PlayerProfile, MultiplayerLobby, TournamentLobby,
BattleScreen, PauseMenu, GameOverScreen, VictoryScreen, PostGameResults,
ResultsScreen, LoadingScreen, Tutorial, Credits, GameGuide,
CampaignLanding, CampaignMissionSelection, CampaignMissionBriefing,
SkirmishSetup, TournamentHub, TournamentCreation, TournamentRegistration,
DraftLobby, MultiplayerHub, SurvivalSetup, MapSelection, BattleResults,
BattleSetup, AIConfiguration, FactionSelection, CampaignVictoryDefeat,
CampaignComplete, CampaignInterMission, CampaignSlotSelection,
TournamentResults, TournamentComplete, TournamentBracket, DraftResults,
DraftComplete, DraftOpponentSelection, DogfightSetup, DogfightResults,
DogfightRoundTransition, MultiplayerResults, PracticeSetup,
PracticeResults, SurvivalResults, EpicResults, CapitalAssaultSetup,
CapitalAssaultResults, AceDuelSetup
```
