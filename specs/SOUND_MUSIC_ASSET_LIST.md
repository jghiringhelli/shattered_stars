# Sound & Music Asset List

> Complete inventory of existing audio assets and specification for planned audio (Phase 6).

---

## Existing Audio Assets

### Music (`Assets/Resources/Music/`)

| File | Category | Usage |
|------|----------|-------|
| `Combat/battle_theme_a_cynicmusic.mp3` | Combat | Battle background music (track A) |
| `Combat/orbital_colossus_matthewpablo.mp3` | Combat | Battle background music (track B) |
| `Exploration/space_ambient_osmic.mp3` | Ambient | Menu / exploration ambient |
| `Epic/Dream Raid Full Version (Mock Up).mp3` | Epic | Epic battle / capital assault theme |
| `Epic/Dream Raid Part I.mp3` | Epic | Epic intro segment |
| `Epic/Dream Raid Part II.mp3` | Epic | Epic mid-battle segment |
| `Epic/Dream Raid Part III.mp3` | Epic | Epic climax segment |

### Legacy Music (`Assets/Sound/`)

| File | Category | Usage |
|------|----------|-------|
| `Star Wars Battle Theme FULL.mp3` | Combat | Legacy battle music |

---

### Sound Effects - Weapons (`Assets/Resources/SFX/Weapons/`)

| File Pattern | Count | Usage |
|-------------|-------|-------|
| `laserSmall_000-004.ogg` | 5 | Small laser fire (fighters) |
| `laserLarge_000-004.ogg` | 5 | Large laser fire (heavy ships) |
| `laserRetro_000-004.ogg` | 5 | Retro-style laser (alternate) |
| `explosionCrunch_000-004.ogg` | 5 | Ship destruction explosions |
| `lowFrequency_explosion_000-001.ogg` | 2 | Heavy explosions (epic ships) |
| `impactMetal_000-004.ogg` | 5 | Generic metal impacts |
| `impactMetal_heavy_000-004.ogg` | 5 | Heavy hull impacts |
| `impactMetal_medium_000-004.ogg` | 5 | Medium hull impacts |
| `impactMetal_light_000-004.ogg` | 5 | Light hull / shield impacts |
| `forceField_000-004.ogg` | 5 | Shield hit / activation |

### Sound Effects - Engines (`Assets/Resources/SFX/Engines/`)

| File Pattern | Count | Usage |
|-------------|-------|-------|
| `spaceEngine_000-001.ogg` | 2+ | Generic ship engine hum |

### Sound Effects - UI (`Assets/Resources/SFX/Systems/`)

| File Pattern | Count | Usage |
|-------------|-------|-------|
| `click1-5.ogg` | 5 | Button click variants |
| `mouseclick1.ogg` | 1 | Mouse button press |
| `mouserelease1.ogg` | 1 | Mouse button release |
| `rollover1-6.ogg` | 6 | Button hover / rollover |
| `switch1-38.ogg` | 38 | Toggle / switch sounds |

### Sound Effects - Gameplay (`Assets/Resources/Sounds/`)

| File | Usage |
|------|-------|
| `Explosion.wav` | Ship destruction (legacy) |
| `shipHit.wav` | Ship damage impact (legacy) |

---

### Legacy Ship-Specific SFX (`Assets/Sound/`)

#### X-Wing (`Assets/Sound/Xwing/`)

| File | Usage |
|------|-------|
| `XWing-Fly1.wav` | X-Wing engine flyby variant 1 |
| `XWing-Fly2.wav` | X-Wing engine flyby variant 2 |
| `XWing-Fly3.wav` | X-Wing engine flyby variant 3 |
| `XWing-Laser.wav` | X-Wing laser cannon fire |

#### TIE Fighter (`Assets/Sound/TieFighter/`)

| File | Usage |
|------|-------|
| `TIE-Fire.wav` | TIE Fighter laser fire |
| `TIE-Fly1.wav` | TIE engine flyby variant 1 |
| `TIE-Fly2.wav` | TIE engine flyby variant 2 |
| `TIE-Fly3.wav` | TIE engine flyby variant 3 |
| `TIE-Fly4.wav` | TIE engine flyby variant 4 |
| `TIE-Fly5.wav` | TIE engine flyby variant 5 |
| `TIE-Fly6.wav` | TIE engine flyby variant 6 |
| `TIE-Fly7.wav` | TIE engine flyby variant 7 |

#### Generic Weapons (`Assets/Sound/`)

| File | Usage |
|------|-------|
| `Laser_Blaster.mp3` | Generic blaster fire |
| `Laser_Blasts.mp3` | Sustained blaster fire |

---

## Asset Summary

| Category | Files | Format | Location |
|----------|-------|--------|----------|
| Music | 8 | .mp3 | `Resources/Music/`, `Sound/` |
| Weapon SFX | 47 | .ogg | `Resources/SFX/Weapons/` |
| Engine SFX | 2+ | .ogg | `Resources/SFX/Engines/` |
| UI SFX | 50 | .ogg | `Resources/SFX/Systems/` |
| Ship-specific SFX | 12 | .wav | `Sound/Xwing/`, `Sound/TieFighter/` |
| Legacy gameplay SFX | 2 | .wav | `Resources/Sounds/` |
| Legacy weapon SFX | 2 | .mp3 | `Sound/` |
| **Total** | **~123** | mixed | |

---

## Phase 6: Planned Audio Additions

### Missing Music (Priority Order)

| Track | Context | Duration | Style |
|-------|---------|----------|-------|
| Main Menu Theme | Title screen | 2-3 min loop | Orchestral, heroic |
| Rebel Campaign Theme | Rebel missions | 3-4 min loop | Hopeful, adventurous |
| Imperial Campaign Theme | Imperial missions | 3-4 min loop | Ominous, militaristic |
| Scum Campaign Theme | Scum missions | 3-4 min loop | Gritty, rogue |
| Victory Fanfare | Post-battle win | 10-15 sec sting | Triumphant |
| Defeat Stinger | Post-battle loss | 10-15 sec sting | Somber |
| Tournament Lobby | Tournament hub | 2-3 min loop | Tense, competitive |
| Draft Selection | Draft mode | 2-3 min loop | Strategic, contemplative |
| Survival Escalation | Survival waves | Dynamic layers | Intensifying, percussive |
| Boss Encounter | Epic ship battles | 3-4 min loop | Dramatic, cinematic |

### Missing SFX

| Sound | Context | Variants Needed |
|-------|---------|----------------|
| Torpedo launch | Proton torpedo fire | 3 |
| Missile launch | Concussion missile fire | 3 |
| Bomb drop | Bomb deployment | 2 |
| Bomb explosion | Bomb detonation (area) | 3 |
| Ion cannon hit | Ion weapon impact | 3 |
| Shield recharge | Shield regeneration tick | 2 |
| Shield down | Shield fully depleted | 1 |
| Hull breach | Critical hit on hull | 3 |
| Cloak activate | TIE Phantom cloak on | 1 |
| Cloak deactivate | TIE Phantom cloak off | 1 |
| SLAM boost | K-Wing SLAM activation | 1 |
| K-Turn whoosh | 180-degree turn | 2 |
| Barrel roll | Lateral roll maneuver | 2 |
| Engine boost | A-Wing / TIE Int. boost | 2 |
| Epic ship creak | Capital ship ambient | 3 |
| Epic turret rotate | Capital ship turret tracking | 1 |
| Epic section collapse | Section destruction | 2 |
| Stress warning | Ship stress alarm | 1 |
| Target lock beep | Target lock acquired | 1 |
| Focus activation | Focus token used | 1 |
| Evade activation | Evade token used | 1 |
| XP gain tick | Results screen count-up | 1 |
| Unlock fanfare | New ship/upgrade unlocked | 1 |
| Level up | Player level increase | 1 |
| Round bell | Tournament round start | 1 |
| Countdown tick | Timer countdown (3-2-1) | 1 |

### Missing Ship-Specific Engine Sounds

Currently only X-Wing and TIE Fighter have unique engine sounds. Needed:

| Ship | Priority | Description |
|------|----------|-------------|
| A-Wing | High | High-pitched whine, fast |
| Y-Wing | High | Deep rumble, heavy |
| B-Wing | Medium | Rotating cockpit hum |
| TIE Interceptor | Medium | Higher-pitched TIE screech |
| TIE Bomber | Medium | Lower-pitched, heavier TIE |
| YT-1300 | Medium | Freighter rumble |
| CR90 Corvette | Low | Deep capital ship throb |
| Raider | Low | Imperial capital hum |
| Firespray-31 | Low | Distinctive Slave I engine |

---

## Audio System Integration Notes

### Resource Loading Paths
- New music: `Assets/Resources/Music/{Category}/{filename}.mp3`
- New SFX: `Assets/Resources/SFX/{Category}/{filename}.ogg`
- Ship sounds: `Assets/Resources/SFX/Ships/{ShipName}/{filename}.ogg`

### Volume Defaults (from Settings)
- Master: 1.0
- Music: 0.7
- SFX: 0.8
- Voice: 0.8

### Audio References in Code
- `CampaignVictoryDefeatScreen.cs`: Victory/defeat sounds, XP tick, unlock fanfare (volume 0.8)
- `LaserShoot.cs` / `NetworkLaserShoot.cs`: Weapon fire SFX
- `BaseShipController.cs`: Engine sound, impact SFX
- `Bomb.cs`: Explosion SFX
- UI screens: Click/rollover SFX via `UIGenerator`
