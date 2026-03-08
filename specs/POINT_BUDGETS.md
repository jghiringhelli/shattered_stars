# Point Budgets

> Formalized point costs for ships, upgrades, and per-mode squad limits.

---

## Game Mode Point Limits

| Game Mode | Default Points | Notes |
|-----------|---------------|-------|
| Skirmish | 200 | Configurable: 25 / 50 / 100 / 200 / 300 / 500 |
| Tournament | 200 | Configurable per tournament |
| Draft | 200 | Pack values vary (25-250 pts) |
| Multiplayer | 200 | Standard competitive |
| Campaign | 100 (base) | Escalates +15 per mission (see below) |
| Practice | 100 | Training mode |
| Survival | 100 | +10-25 pts earned per wave |
| Dogfight | 50 | 8-minute matches, 5s respawn |
| Ace Duel | 50 | Single ship 1v1 |
| Capital Assault | 200 | Varies by encounter |

### Difficulty Adjustments (SessionData)

| Difficulty | Point Limit |
|-----------|-------------|
| Easy | 100 |
| Normal | 150 |
| Hard | 200 |
| Nightmare | 250 |

---

## Campaign Mission Point Progression

Base formula: `100 + (missionIndex * 15)`

| Mission | Points | Cumulative Unlocks |
|---------|--------|--------------------|
| 1 | 100 | Starting ships |
| 2 | 115 | A-Wing (Rebel) |
| 3 | 130 | - |
| 4 | 145 | - |
| 5 | 160 | - |
| 6 | 175 | - |
| 7 | 190 | Epic mission eligible |
| 8 | 205 | - |
| 9 | 220 | - |
| 10 | 235 | - |
| 11 | 250 | - |
| 12+ | 265+ | Continues scaling |

### Mission Type Multipliers

| Mission Type | Multiplier | Effective at Mission 5 |
|-------------|-----------|------------------------|
| Stealth / Infiltration | x0.8 | 128 pts |
| Defense | x0.9 | 144 pts |
| Standard | x1.0 | 160 pts |
| Escort | x1.1 | 176 pts |
| Assault | x1.2 | 192 pts |

### Difficulty Scaling (Campaign)

| Difficulty | Modifier |
|-----------|---------|
| Easy | -15 pts |
| Normal | Base |
| Hard | +15 pts |
| Insane | +30 pts |

---

## Ship Point Costs

### Rebel Alliance

| Ship | Points | Size | Role |
|------|--------|------|------|
| Z-95 Headhunter | 16 | Small | Budget fighter |
| HWK-290 | 16 | Small | Support / turret |
| A-Wing | 17 | Small | Arc dodger |
| Y-Wing | 18 | Small | Bomber / jouster |
| X-Wing (T-65) | 19 | Small | Balanced fighter |
| T-70 X-Wing | 20 | Small | Balanced (sequel) |
| B-Wing | 22 | Small | Heavy assault |
| E-Wing | 27 | Small | Advanced fighter |
| K-Wing | 25 | Small | SLAM bomber |
| GR-75 Transport | 30 | Epic | Support vessel |
| U-Wing | 32 | Small | Transport |
| ARC-170 | 32 | Small | Heavy fighter |
| YT-2400 | 36 | Large | Freighter / turret |
| VCX-100 (Ghost) | 40 | Large | Dock / turret |
| YT-1300 | 46 | Large | 360 turret |
| CR90 Corvette | 90 | Epic | Capital ship |

### Galactic Empire

| Ship | Points | Size | Role |
|------|--------|------|------|
| TIE Fighter | 15 | Small | Swarm fighter |
| TIE Bomber | 16 | Small | Bomber |
| Lambda Shuttle | 16 | Small | Transport / rear arc |
| TIE Striker | 16 | Small | Atmosphere fighter |
| TIE Aggressor | 17 | Small | Support |
| TIE Interceptor | 18 | Small | Arc dodger |
| TIE Advanced | 21 | Small | Elite fighter |
| TIE Punisher | 21 | Small | Heavy ordnance |
| TIE Phantom | 25 | Small | Stealth / cloak |
| TIE Reaper | 28 | Small | Transport |
| TIE Defender | 30 | Small | Superiority fighter |
| Gozanti Cruiser | 23 | Epic | Carrier |
| VT-49 Decimator | 40 | Large | Assault gunboat |
| Raider Corvette | 100 | Epic | Capital ship |

### Scum & Villainy

| Ship | Points | Size | Role |
|------|--------|------|------|
| Quadjumper | 13 | Small | Utility |
| M3-A Interceptor | 14 | Small | Glass cannon |
| Z-95 Headhunter | 16 | Small | Budget fighter |
| HWK-290 | 16 | Small | Support / turret |
| Kihraxz Fighter | 20 | Small | Assault |
| StarViper | 22 | Small | Precision |
| JumpMaster 5000 | 23 | Large | Freighter |
| G-1A Starfighter | 25 | Small | Medium fighter |
| M12-L Kimogila | 26 | Small | Heavy weapon |
| Scurrg H-6 Bomber | 32 | Small | Bomber |
| Lancer Pursuit Craft | 34 | Large | Pursuit |
| C-ROC Cruiser | 35 | Epic | Transport |
| Aggressor | 36 | Large | IG-88 assault |
| Firespray-31 | 38 | Small | Bounty hunter |
| YV-666 | 42 | Large | Heavy freighter |

### First Order / Sequel Era

| Ship | Points | Size | Role |
|------|--------|------|------|
| TIE/FO Fighter | 17 | Small | Standard |
| TIE/SF Fighter | 25 | Small | Special forces |
| TIE Silencer | 52 | Small | Elite (PS 4+) |
| Upsilon Shuttle | 60 | Large | Command |

### Republic / Clone Wars

| Ship | Points | Size | Role |
|------|--------|------|------|
| Attack Shuttle | 16 | Small | Support |
| V-Wing | 16 | Small | Light fighter |
| Alpha-class Star Wing | 18 | Small | Advanced |
| Sheathipede Shuttle | 22 | Small | Jedi transport |
| ARC-170 | 32 | Small | Heavy |
| Auzituck Gunship | 52 | Small | Wookiee |

### Separatist

| Ship | Points | Size | Role |
|------|--------|------|------|
| Vulture Droid | 19 | Small | Swarm |
| Tri-Fighter | 24 | Small | Agile |
| Hyena Bomber | 25 | Small | Droid bomber |

---

## Upgrade Point Costs

| Upgrade | Cost | Type |
|---------|------|------|
| Generic upgrades (default) | 2 | Various |
| Hull Upgrade | 3 | Modification |
| R2-F2 Astromech | 3 | Astromech |
| R5-D8 Astromech | 3 | Astromech |
| Proton Torpedoes | 4 | Torpedo |
| Concussion Missiles | 4 | Missile |
| R2-D2 Astromech | 4 | Astromech |
| Engine Upgrade | 4 | Modification |
| Shield Upgrade | 4 | Modification |
| Ion Cannon Turret | 5 | Turret |
| Proton Bombs | 5 | Bomb |

### Upgrade Restrictions
- Faction-locked: Most upgrades restricted to specific factions
- Ship-size locked: Some large-ship only
- Pilot skill minimum: Configurable per card
- Ship model restrictions: Turrets/missiles limited to compatible hardpoints

---

## Squad Building Constraints

| Constraint | Value |
|-----------|-------|
| Minimum squad cost | 12 pts (1 cheap ship) |
| Maximum configurable limit | 1000 pts |
| Default competitive limit | 200 pts |
| Points displayed in UI | Real-time current / max |

---

## Reward Calculations

### XP

| Outcome | Formula |
|---------|---------|
| Victory | `pointLimit * 1.0` |
| Defeat | `pointLimit * 0.5` |
| Per ship survived bonus | `+25 XP` |

**Example**: 200pt Skirmish victory, 3 of 4 ships survive = 200 + (3 * 25) = **275 XP**.

### Credits

| Outcome | Formula |
|---------|---------|
| Victory | `pointLimit * 2` |
| Defeat | `pointLimit * 1` |

**Example**: 200pt Skirmish victory = **400 credits**.

---

## Balance Reference Squads

Common squad archetypes at standard 200pt limit:

| Archetype | Composition | Total |
|-----------|------------|-------|
| Rebel Balanced | X-Wing + A-Wing + Y-Wing + B-Wing | 76 pts + upgrades |
| Imperial Swarm | 8x TIE Fighter | 120 pts + upgrades |
| Rebel Heavy | YT-1300 + 2x X-Wing | 84 pts + upgrades |
| Imperial Elite | TIE Defender + TIE Phantom + TIE Advanced | 76 pts + upgrades |
| Scum Bounty Hunters | Firespray-31 + StarViper + 2x Z-95 | 92 pts + upgrades |
