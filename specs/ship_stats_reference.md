# Ship Stats Reference — X-Wing Miniatures Baseline

> **Purpose**: This document captures every ship statline, action bar, maneuver dial pattern, upgrade slot configuration, and point cost from the Unity X-Wing Arcade codebase. It serves as the **balance inspiration baseline** for Shattered Stars ship design. All data is from the original X-Wing Miniatures Game adaptation — ship names, lore, and faction assignments belong to that IP and will be translated to original equivalents via `scifi_factions.md`.

---

## Table of Contents

1. [Stat Definitions](#1-stat-definitions)
2. [Rebel Alliance Ships](#2-rebel-alliance-ships)
3. [Galactic Empire Ships](#3-galactic-empire-ships)
4. [Scum & Villainy Ships](#4-scum--villainy-ships)
5. [Galactic Republic Ships](#5-galactic-republic-ships)
6. [Separatist Alliance Ships](#6-separatist-alliance-ships)
7. [First Order Ships](#7-first-order-ships)
8. [Epic Capital Ships](#8-epic-capital-ships)
9. [Action Bar Reference](#9-action-bar-reference)
10. [Maneuver Dial Patterns](#10-maneuver-dial-patterns)
11. [Upgrade Slot Types](#11-upgrade-slot-types)
12. [Point Cost Analysis](#12-point-cost-analysis)
13. [Ship Role Classifications](#13-ship-role-classifications)
14. [Balance Mapping to Shattered Stars](#14-balance-mapping-to-shattered-stars)

---

## 1. Stat Definitions

| Stat | Description | Range | Balance Notes |
|------|-------------|-------|---------------|
| **Attack (ATK)** | Number of red dice rolled when attacking | 1–4 | Higher = more offensive; 4 is capital-class |
| **Agility (AGI)** | Number of green dice rolled when defending | 0–3 | Higher = harder to hit; 0 = cannot dodge |
| **Hull (HUL)** | Hit points after shields are gone | 2–12 | Structural durability; destroyed at 0 |
| **Shields (SHD)** | Regenerable hit points absorbing damage first | 0–6 | Absorbed before hull; some ships have 0 |
| **Points (PTS)** | Squad-building cost | 13–100 | Total squad budget is typically 100–300 |

**Effective HP** = Hull + Shields (ignoring critical hits bypassing shields)

**Survivability Index** = (Hull + Shields) × (1 + Agility × 0.25) — rough durability estimate factoring evasion

---

## 2. Rebel Alliance Ships

### Standard Fighters

| Ship | ATK | AGI | HUL | SHD | PTS | Effective HP | Role | Key Feature |
|------|-----|-----|-----|-----|-----|-------------|------|-------------|
| X-Wing | 3 | 2 | 3 | 2 | 19 | 5 | Multi-role Fighter | Balanced workhorse; Astromech slot |
| T-70 X-Wing | 3 | 2 | 4 | 3 | 20 | 7 | Advanced Fighter | Sequel-era upgrade; better durability |
| A-Wing | 2 | 3 | 2 | 2 | 17 | 4 | Interceptor | Fastest; arc-dodger; Boost + Evade |
| B-Wing | 3 | 1 | 3 | 5 | 22 | 8 | Assault Fighter | Shield-heavy; anti-capital; Cannon slot |
| E-Wing | 3 | 3 | 2 | 3 | 27 | 5 | Elite Fighter | High agility + attack; expensive |
| HWK-290 | 1 | 2 | 4 | 1 | 16 | 5 | Light Support | Weak attack; support/coordination role |

### Bombers

| Ship | ATK | AGI | HUL | SHD | PTS | Effective HP | Role | Key Feature |
|------|-----|-----|-----|-----|-----|-------------|------|-------------|
| Y-Wing | 2 | 1 | 5 | 3 | 18 | 8 | Bomber/Support | Turret + Bomb + Torpedo; durable tank |
| K-Wing | 2 | 1 | 5 | 4 | 25 | 9 | Heavy Bomber | SLAM action; most ordnance capacity |

### Large Ships

| Ship | ATK | AGI | HUL | SHD | PTS | Effective HP | Role | Key Feature |
|------|-----|-----|-----|-----|-----|-------------|------|-------------|
| YT-1300 | 3 | 1 | 8 | 5 | 46 | 13 | Heavy Freighter | 360° turret; ignore obstacles |
| YT-2400 | 3 | 2 | 5 | 5 | 36 | 10 | Medium Freighter | 360° turret; better agility |
| VCX-100 (Ghost) | 4 | 0 | 10 | 4 | 40 | 14 | Command Ship | Highest standard ATK; docking bay |
| U-Wing | 2 | 2 | 4 | 4 | 32 | 8 | Transport/Support | Crew-focused; coordinate actions |

### Rebel Actions Summary

| Ship | Focus | Evade | Target Lock | Barrel Roll | Boost | Special |
|------|-------|-------|-------------|-------------|-------|---------|
| X-Wing | ✓ | — | ✓ | — | — | — |
| A-Wing | ✓ | ✓ | ✓ | — | ✓ | — |
| B-Wing | ✓ | — | ✓ | ✓ | — | Rotate Arc |
| Y-Wing | ✓ | — | ✓ | — | — | — |
| E-Wing | ✓ | ✓ | ✓ | — | — | — |
| K-Wing | ✓ | — | ✓ | — | — | SLAM |
| YT-1300 | ✓ | — | ✓ | — | — | — |
| VCX-100 | ✓ | — | ✓ | — | — | — |
| U-Wing | ✓ | — | ✓ | — | — | Coordinate |
| HWK-290 | ✓ | — | ✓ | — | — | — |

---

## 3. Galactic Empire Ships

### Standard Fighters

| Ship | ATK | AGI | HUL | SHD | PTS | Effective HP | Role | Key Feature |
|------|-----|-----|-----|-----|-----|-------------|------|-------------|
| TIE Fighter | 2 | 3 | 3 | 0 | 15 | 3 | Swarm Fighter | Cheapest; no shields; expendable |
| TIE Interceptor | 3 | 3 | 3 | 0 | 18 | 3 | Elite Interceptor | High ATK + AGI; fragile; arc-dodger |
| TIE Advanced | 2 | 3 | 3 | 2 | 21 | 5 | Heavy Fighter | Shielded TIE; balanced |
| TIE Defender | 3 | 3 | 3 | 3 | 30 | 6 | Superiority Fighter | Best all-around stats; most expensive standard |
| TIE Striker | 3 | 2 | 4 | 0 | 16 | 4 | Assault Fighter | Adaptive Ailerons; ground attack |
| TIE Aggressor | 2 | 2 | 4 | 1 | 17 | 5 | Turret Fighter | Turret slot; flexible firing arc |

### Bombers

| Ship | ATK | AGI | HUL | SHD | PTS | Effective HP | Role | Key Feature |
|------|-----|-----|-----|-----|-----|-------------|------|-------------|
| TIE Bomber | 2 | 2 | 6 | 0 | 16 | 6 | Bomber | Triple ordnance slots; cheapest bomber |
| TIE Punisher | 2 | 1 | 6 | 3 | 21 | 9 | Heavy Bomber | Most ordnance of any Empire ship |

### Special / Support

| Ship | ATK | AGI | HUL | SHD | PTS | Effective HP | Role | Key Feature |
|------|-----|-----|-----|-----|-----|-------------|------|-------------|
| TIE Phantom | 4 | 2 | 2 | 2 | 25 | 4 | Stealth Fighter | Cloak; highest standard ATK (4) |
| TIE Reaper | 3 | 1 | 6 | 2 | 28 | 8 | Support/Coordinator | Coordinate + Jam actions |
| Lambda Shuttle | 3 | 1 | 5 | 5 | 16 | 10 | Transport | Rear arc; Crew slots; cheap for stats |

### Large Ships

| Ship | ATK | AGI | HUL | SHD | PTS | Effective HP | Role | Key Feature |
|------|-----|-----|-----|-----|-----|-------------|------|-------------|
| VT-49 Decimator | 3 | 0 | 12 | 4 | 40 | 16 | Gunship | Highest hull; 360° arc; no agility |

### Empire Actions Summary

| Ship | Focus | Evade | Target Lock | Barrel Roll | Boost | Special |
|------|-------|-------|-------------|-------------|-------|---------|
| TIE Fighter | ✓ | ✓ | — | ✓ | — | — |
| TIE Interceptor | ✓ | ✓ | — | ✓ | ✓ | — |
| TIE Advanced | ✓ | ✓ | ✓ | ✓ | — | — |
| TIE Defender | ✓ | ✓ | ✓ | ✓ | — | — |
| TIE Bomber | ✓ | — | ✓ | ✓ | — | — |
| TIE Punisher | ✓ | — | ✓ | — | ✓ | — |
| TIE Phantom | ✓ | ✓ | — | ✓ | — | Cloak |
| TIE Striker | ✓ | ✓ | — | ✓ | — | Adaptive Ailerons |
| TIE Reaper | ✓ | ✓ | — | — | — | Coordinate, Jam |
| TIE Aggressor | ✓ | — | ✓ | ✓ | — | — |
| Lambda | ✓ | — | ✓ | — | — | Rear Arc |
| Decimator | ✓ | — | ✓ | — | — | — |

---

## 4. Scum & Villainy Ships

### Fighters

| Ship | ATK | AGI | HUL | SHD | PTS | Effective HP | Role | Key Feature |
|------|-----|-----|-----|-----|-----|-------------|------|-------------|
| Z-95 Headhunter | 2 | 2 | 2 | 2 | 16 | 4 | Budget Fighter | Cheapest shielded fighter |
| M3-A Interceptor | 2 | 2 | 2 | 0 | 14 | 2 | Light Interceptor | Cheapest ship overall; "Scyk" |
| StarViper | 3 | 3 | 4 | 1 | 22 | 5 | Heavy Interceptor | High agility + attack |
| Protectorate Starfighter | 3 | 3 | 4 | 0 | 20 | 4 | Fang Fighter | No shields; pure aggression |
| Kihraxz Fighter | 3 | 2 | 4 | 1 | 20 | 5 | Heavy Fighter | Affordable multi-role |
| M12-L Kimogila | 3 | 1 | 6 | 2 | 26 | 8 | Cannon Fighter | Heavy weapons platform |

### Bombers

| Ship | ATK | AGI | HUL | SHD | PTS | Effective HP | Role | Key Feature |
|------|-----|-----|-----|-----|-----|-------------|------|-------------|
| Scurrg H-6 | 3 | 1 | 5 | 5 | 32 | 10 | Medium Bomber | High shield; Torpedo + Bomb |

### Large Ships

| Ship | ATK | AGI | HUL | SHD | PTS | Effective HP | Role | Key Feature |
|------|-----|-----|-----|-----|-----|-------------|------|-------------|
| Firespray-31 | 3 | 2 | 6 | 4 | 38 | 10 | Bounty Hunter | Rear arc; Torpedo + Missile + Bomb |
| YV-666 | 3 | 1 | 7 | 2 | 42 | 9 | Heavy Freighter | High hull; crew-focused |
| JumpMaster 5000 | 2 | 2 | 5 | 5 | 23 | 10 | Transport | Unique asymmetric dial |
| Lancer Pursuit Craft | 3 | 2 | 7 | 2 | 34 | 9 | Pursuit Ship | Cannon slot; large + fast |
| G-1A Starfighter | 2 | 2 | 4 | 4 | 25 | 8 | Medium Transport | Balanced; versatile |
| Quadjumper | 2 | 2 | 5 | 0 | 13 | 5 | Utility Ship | Cheapest large-base; tractor beam |

### Support

| Ship | ATK | AGI | HUL | SHD | PTS | Effective HP | Role | Key Feature |
|------|-----|-----|-----|-----|-----|-------------|------|-------------|
| HWK-290 (Scum) | 1 | 2 | 4 | 1 | 16 | 5 | Support | Moldy Crow; token stacking |
| Aggressor | 3 | 3 | 4 | 1 | 36 | 5 | Assault Droid | IG-2000; expensive; high stats |

### Scum Actions Summary

| Ship | Focus | Evade | Target Lock | Barrel Roll | Boost | Special |
|------|-------|-------|-------------|-------------|-------|---------|
| Z-95 | ✓ | — | ✓ | — | — | — |
| M3-A | ✓ | ✓ | ✓ | ✓ | — | — |
| StarViper | ✓ | — | ✓ | ✓ | ✓ | — |
| Protectorate | ✓ | — | ✓ | ✓ | ✓ | — |
| Kihraxz | ✓ | — | ✓ | — | — | — |
| Firespray | ✓ | ✓ | ✓ | — | — | Rear Arc |
| JumpMaster | ✓ | — | ✓ | ✓ | — | — |
| Aggressor | ✓ | ✓ | ✓ | — | ✓ | — |
| HWK-290 | ✓ | — | ✓ | — | — | — |
| Quadjumper | ✓ | — | — | ✓ | — | Tractor Beam |
| Kimogila | ✓ | — | ✓ | — | — | Bullseye Arc |

---

## 5. Galactic Republic Ships

| Ship | ATK | AGI | HUL | SHD | PTS | Effective HP | Role | Key Feature |
|------|-----|-----|-----|-----|-----|-------------|------|-------------|
| ARC-170 | 3 | 1 | 6 | 2 | 32 | 8 | Heavy Fighter | Rear arc; Astromech; durable |
| V-Wing | 2 | 2 | 3 | 2 | 16 | 5 | Light Interceptor | Fast; cheap Republic fighter |
| Alpha-class Star Wing | 2 | 2 | 4 | 3 | 18 | 7 | Standard Fighter | Balanced; ordnance capable |
| Auzituck Gunship | 3 | 1 | 6 | 2 | 52 | 8 | Support Gunship | Reinforce action; Wookiee |
| Sheathipede Shuttle | 2 | 2 | 4 | 1 | 22 | 5 | Light Shuttle | Coordinate; compact |
| Attack Shuttle | 3 | 3 | 2 | 2 | 16 | 4 | Assault Shuttle | Docking capable; Ghost pair |

---

## 6. Separatist Alliance Ships

| Ship | ATK | AGI | HUL | SHD | PTS | Effective HP | Role | Key Feature |
|------|-----|-----|-----|-----|-----|-------------|------|-------------|
| Vulture Droid | 2 | 2 | 2 | 2 | 19 | 4 | Swarm Drone | Networked Calculate; expendable |
| Tri-Fighter | 3 | 2 | 4 | 1 | 24 | 5 | Interceptor Drone | Advanced swarm; aggressive |
| Hyena Bomber (BSF-17) | 2 | 2 | 5 | 0 | 25 | 5 | Bomber Drone | Networked bombing runs |

---

## 7. First Order Ships

| Ship | ATK | AGI | HUL | SHD | PTS | Effective HP | Role | Key Feature |
|------|-----|-----|-----|-----|-----|-------------|------|-------------|
| TIE/fo Fighter | 2 | 3 | 3 | 1 | 17 | 4 | Standard Fighter | Shielded TIE; balanced |
| TIE/sf Fighter | 2 | 2 | 3 | 3 | 25 | 6 | Special Forces | Rear gunner; heavy |
| TIE Silencer | 3 | 3 | 4 | 2 | 52 | 6 | Elite Interceptor | Top-tier dogfighter; expensive |
| Upsilon Shuttle | 4 | 1 | 6 | 6 | 60 | 12 | Command Shuttle | ATK 4; massive shields; Coordinate |

---

## 8. Epic Capital Ships

Epic ships use fundamentally different mechanics from standard fighters.

### Stats

| Ship | ATK | AGI | Total Hull | Sections | Shield/Section | PTS | Faction |
|------|-----|-----|-----------|----------|---------------|-----|---------|
| CR90 Corvette | 4 | 0 | 36 | 3 (12 each) | 3 | 90 | Rebel |
| Raider Corvette | 4 | 0 | 36 | 3 (12 each) | 3 | 100 | Empire |
| GR-75 Transport | 2 | 0 | 24 | 2 (12 each) | 3 | 30 | Rebel |
| Gozanti Cruiser | 3 | 0 | 9 | 1 | 5 | 23 | Empire |
| C-ROC Cruiser | 3 | 0 | 10 | 1 | 4 | 35 | Scum |

### Epic Ship Mechanics

| Mechanic | Description |
|----------|-------------|
| **Drift Movement** | Slow, inertial movement (speeds 1–3 only); capital ships feel heavy |
| **Multi-Section Damage** | Each section tracked independently; disabled sections lose weapons |
| **Main Turret** | Indestructible rotating turret that auto-tracks nearest enemy |
| **Stress Field** | Area effect reducing nearby enemy agility and action availability |
| **Shield Regeneration** | Energy management system; choose between shields, weapons, or engines |
| **Multi-Phase Destruction** | Dramatic explosion sequences when sections are destroyed |
| **Energy Management** | Allocate energy tokens each turn: shields, weapons, engines |

### Epic Ship Configuration (from EpicShipData.cs)

```
CR90 Corvette:
  Sections: Fore (12 hull, 3 shields), Mid (12 hull, 3 shields), Aft (12 hull, 3 shields)
  Turret Damage: 4 dice per shot
  Stress Field Radius: Large
  Energy per Turn: 5
  Shield Regen Rate: 1 per energy spent

Raider Corvette:
  Sections: Fore (12 hull, 3 shields), Mid (12 hull, 3 shields), Aft (12 hull, 3 shields)
  Turret Damage: 4 dice per shot (fore + aft weapons)
  Stress Field Radius: Large
  Energy per Turn: 5
  Shield Regen Rate: 1 per energy spent

GR-75 Transport:
  Sections: Fore (12 hull, 3 shields), Aft (12 hull, 3 shields)
  Turret Damage: 2 dice per shot
  Role: Support/supply vessel
  Energy per Turn: 3
```

---

## 9. Action Bar Reference

### Standard Actions

| Action | Effect | Common On |
|--------|--------|-----------|
| **Focus** | Spend to convert focus results → hits/evades | All ships |
| **Evade** | Add 1 automatic evade result to defense | Agile ships |
| **Target Lock** | Lock onto enemy; spend to reroll attack dice | Most ships |
| **Barrel Roll** | Lateral repositioning; no facing change | Fighters, interceptors |
| **Boost** | Move forward (straight/bank) after action | Fast ships |

### Advanced Actions

| Action | Effect | Exclusive To |
|--------|--------|-------------|
| **SLAM** | Perform extra maneuver after move (no actions) | K-Wing |
| **Cloak** | Gain +2 agility; cannot attack while cloaked | TIE Phantom |
| **Coordinate** | Grant an ally a free action | Support ships (Reaper, U-Wing) |
| **Jam** | Assign jam token to enemy; removes focus/evade | Electronic warfare ships |
| **Rotate Arc** | Change mobile firing arc direction | B-Wing, turret ships |
| **Reinforce** | Reduce damage from one arc by 1 | Large/epic ships |
| **Recover** | Recover shields using energy | Epic ships |
| **Rear Arc** | Fire primary weapon from rear | Firespray, Lambda, ARC-170 |
| **Tractor Beam** | Move enemy ship; reduce agility by 1 | Quadjumper |

### Action Economy Notes

- Each ship gets **1 action per turn** (some abilities grant free actions)
- **Stressed ships cannot perform actions** until stress is cleared
- **Green maneuvers** remove 1 stress token
- **Red maneuvers** add 1 stress token
- **Actions cannot be performed while stressed** (except free actions from abilities)

---

## 10. Maneuver Dial Patterns

### Maneuver Types

| Symbol | Name | Description | Heading Change |
|--------|------|-------------|----------------|
| ↑ | Straight | Move directly forward | 0° |
| ↗ | Bank Right | Gentle right turn | 45° |
| ↘ | Turn Right | Hard right turn | 90° |
| ↖ | Bank Left | Gentle left turn | -45° |
| ↙ | Turn Left | Hard left turn | -90° |
| ⤵ | K-Turn | 180° reversal (always red) | 180° |
| ↪ | Segnor's Loop R | Half-loop turning right | 135° |
| ↩ | Segnor's Loop L | Half-loop turning left | -135° |
| ⤴ | Tallon Roll R | Barrel roll + 180° right | 180° + lateral |
| ⤵ | Tallon Roll L | Barrel roll + 180° left | 180° + lateral |

### Difficulty Colors

| Color | Meaning | Effect on Stress |
|-------|---------|-----------------|
| **Green** | Easy | Removes 1 stress token |
| **White** | Standard | No stress change |
| **Red** | Difficult | Adds 1 stress token; cannot perform if already stressed |

### Archetypal Dial Patterns

#### Fast Fighter (TIE Interceptor / A-Wing)
```
Speed 1: [G]Turn-L  [G]Bank-L  [G]Straight  [G]Bank-R  [G]Turn-R
Speed 2: [W]Turn-L  [G]Bank-L  [G]Straight  [G]Bank-R  [W]Turn-R
Speed 3: [W]Turn-L  [W]Bank-L  [G]Straight  [W]Bank-R  [W]Turn-R
Speed 4:            [W]Bank-L  [G]Straight  [W]Bank-R
Speed 5:                       [G]Straight
```
*Very few reds; many greens; speed 5 available; highly maneuverable*

#### Balanced Fighter (X-Wing / TIE Fighter)
```
Speed 1: [W]Turn-L  [G]Bank-L  [G]Straight  [G]Bank-R  [W]Turn-R
Speed 2: [W]Turn-L  [W]Bank-L  [G]Straight  [W]Bank-R  [W]Turn-R
Speed 3: [W]Turn-L  [W]Bank-L  [W]Straight  [W]Bank-R  [W]Turn-R
Speed 4:                       [W]Straight                        [R]K-Turn
Speed 5: — (not available)
```
*Mostly white; moderate green at low speeds; K-turn available*

#### Heavy Bomber (Y-Wing / TIE Bomber)
```
Speed 1: [R]Turn-L  [G]Bank-L  [G]Straight  [G]Bank-R  [R]Turn-R
Speed 2: [W]Turn-L  [W]Bank-L  [G]Straight  [W]Bank-R  [W]Turn-R
Speed 3:            [W]Bank-L  [W]Straight  [W]Bank-R
Speed 4:                       [R]Straight                        [R]K-Turn
Speed 5: — (not available)
```
*Red turns at speed 1; limited high-speed options; slow but stable*

#### Large Ship (YT-1300 / VT-49)
```
Speed 1: [W]Turn-L  [W]Bank-L  [G]Straight  [W]Bank-R  [W]Turn-R
Speed 2: [R]Turn-L  [W]Bank-L  [G]Straight  [W]Bank-R  [R]Turn-R
Speed 3:            [W]Bank-L  [W]Straight  [W]Bank-R
Speed 4:                       [R]Straight
Speed 5: — (not available)
```
*Red hard turns; limited at high speed; few greens; sluggish*

#### Epic Ship (CR90 / Raider)
```
Speed 1:            [W]Bank-L  [W]Straight  [W]Bank-R
Speed 2:                       [W]Straight
Speed 3:                       [R]Straight
Speed 4-5: — (not available)
```
*Extremely limited; no turns; drift-based; capital ship weight*

### Maneuver Availability Matrix

| Ship Type | Speeds | Turns | Banks | K-Turn | Segnor | Tallon | SLAM |
|-----------|--------|-------|-------|--------|--------|--------|------|
| Fast Interceptor | 1–5 | ✓ | ✓ | ✓ | — | — | — |
| Standard Fighter | 1–4 | ✓ | ✓ | ✓ | — | — | — |
| Heavy Fighter | 1–4 | ✓ | ✓ | ✓ | — | — | — |
| Bomber | 1–4 | ✓(red) | ✓ | ✓(red) | — | — | — |
| Large Ship | 1–4 | ✓(red) | ✓ | — | — | — | — |
| Elite (Defender) | 1–5 | ✓ | ✓ | ✓ | — | ✓ | — |
| K-Wing | 1–3 | ✓ | ✓ | — | — | — | ✓ |
| Epic Ship | 1–3 | — | ✓(limited) | — | — | — | — |

---

## 11. Upgrade Slot Types

### Slot Categories

| Slot | Description | Point Range | Common Ships |
|------|-------------|-------------|-------------|
| **Elite Pilot Talent** | Ace abilities; require pilot skill ≥ threshold | 1–7 | Named pilots |
| **Astromech** | Droid companion; dial/action modification | 1–5 | X-Wing, Y-Wing, ARC-170 |
| **Torpedo** | Heavy ordnance; requires Target Lock | 3–8 | X-Wing, Y-Wing, B-Wing |
| **Missile** | Light ordnance; requires Target Lock | 2–5 | A-Wing, TIE Bomber |
| **Cannon** | Heavy energy weapon; replaces primary | 3–7 | B-Wing, Kihraxz, Kimogila |
| **Turret** | 360° firing arc weapon | 3–6 | Y-Wing, K-Wing, HWK-290 |
| **Bomb/Mine** | Area denial; dropped after movement | 2–6 | Y-Wing, TIE Bomber, K-Wing |
| **Crew** | Ship personnel; various abilities | 1–8 | Large ships, shuttles |
| **System** | Ship systems; targeting/sensor upgrades | 2–5 | B-Wing, TIE Phantom |
| **Title** | Named ship variant; unique abilities | 0–4 | Ship-specific |
| **Modification** | Generic upgrades; universal | 1–3 | Almost all ships |
| **Illicit** | Scum-only; dirty tricks and contraband | 1–4 | Scum ships only |
| **Tech** | First Order/Resistance technology | 1–5 | Sequel-era ships |
| **Gunner** | Weapons operator for large ships | 2–6 | Large/epic ships |

### Upgrade Slots by Ship

| Ship | Astro | Torp | Miss | Cann | Turr | Bomb | Crew | Sys | Mod | Illicit | Title |
|------|-------|------|------|------|------|------|------|-----|-----|---------|-------|
| X-Wing | 1 | 1 | — | — | — | — | — | — | 1 | — | 1 |
| A-Wing | — | — | 1 | — | — | — | — | — | 1 | — | 1 |
| Y-Wing | 1 | 1 | — | — | 1 | 1 | — | — | 1 | — | 1 |
| B-Wing | — | 1 | — | 1 | — | — | — | 1 | 1 | — | 1 |
| E-Wing | 1 | — | 1 | — | — | — | — | — | 1 | — | — |
| K-Wing | 1 | 1 | — | — | 1 | 1 | — | — | 1 | — | — |
| TIE Fighter | — | — | — | — | — | — | — | — | 1 | — | 1 |
| TIE Interceptor | — | — | — | — | — | — | — | — | 1 | — | 1 |
| TIE Bomber | — | 1 | 1 | — | — | 1 | — | — | 1 | — | 1 |
| TIE Advanced | — | — | — | — | — | — | — | — | 1 | — | 1 |
| TIE Defender | — | — | — | — | — | — | — | — | 1 | — | 1 |
| TIE Phantom | — | — | — | — | — | — | — | 1 | 1 | — | 1 |
| TIE Punisher | — | 1 | 1 | — | — | 1 | — | — | 1 | — | — |
| Lambda | — | — | — | — | — | — | 2 | — | 1 | — | 1 |
| Firespray | — | 1 | 1 | — | — | 1 | 1 | — | 1 | 1 | 1 |
| Z-95 | — | — | 1 | — | — | — | — | — | 1 | 1 | — |
| StarViper | — | — | — | — | — | — | — | — | 1 | — | 1 |
| YT-1300 | — | — | — | — | 1 | — | 2 | — | 1 | 1 | 1 |
| VCX-100 | — | — | — | — | 1 | — | — | 1 | 1 | — | 1 |

---

## 12. Point Cost Analysis

### Cost Distribution

```
■ 13-15 pts (Budget):    TIE Fighter(15), M3-A(14), Quadjumper(13)
■ 16-19 pts (Economy):   Z-95(16), A-Wing(17), Y-Wing(18), X-Wing(19), HWK(16),
                         Lambda(16), TIE Bomber(16), V-Wing(16), Attack Shuttle(16),
                         TIE Striker(16), TIE Aggressor(17), TIE/fo(17), Alpha Star Wing(18),
                         TIE Interceptor(18), Vulture(19)
■ 20-25 pts (Standard):  Protectorate(20), Kihraxz(20), T-70(20), TIE Advanced(21),
                         TIE Punisher(21), StarViper(22), B-Wing(22), Sheathipede(22),
                         Gozanti(23), JumpMaster(23), Tri-Fighter(24), TIE Phantom(25),
                         G-1A(25), BSF-17(25), TIE/sf(25), K-Wing(25)
■ 26-35 pts (Premium):   Kimogila(26), E-Wing(27), TIE Reaper(28), TIE Defender(30),
                         GR-75(30), ARC-170(32), Scurrg H-6(32), U-Wing(32),
                         Lancer(34), C-ROC(35)
■ 36-52 pts (Elite):     YT-2400(36), Aggressor(36), Firespray(38), VCX-100(40),
                         VT-49(40), YV-666(42), YT-1300(46), TIE Silencer(52),
                         Auzituck(52)
■ 53-100 pts (Capital):  Upsilon(60), CR90(90), Raider(100)
```

### Cost-Efficiency Ratios

| Metric | Best Value | Worst Value |
|--------|-----------|-------------|
| **Cheapest HP/point** | Lambda (10 HP / 16 pts = 0.63) | TIE Silencer (6 HP / 52 pts = 0.12) |
| **Cheapest ATK/point** | TIE Phantom (4 ATK / 25 pts = 0.16) | HWK-290 (1 ATK / 16 pts = 0.06) |
| **Best stat total/point** | Lambda (10/16 = 0.63) | Upsilon (17/60 = 0.28) |
| **Most efficient swarm** | TIE Fighter (3 ships per 45 pts) | TIE Defender (1.5 per 45 pts) |

### Squad Budget Guidelines (from codebase)

| Format | Point Limit | Typical Composition |
|--------|-------------|---------------------|
| **Starter** | 25 pts | 1 fighter |
| **Skirmish** | 100 pts | 3–5 standard fighters |
| **Standard** | 150 pts | 4–6 mixed ships |
| **Extended** | 200 pts | 5–8 ships or 1 epic + escorts |
| **Epic** | 300 pts | 1–2 epics + full fighter screen |

---

## 13. Ship Role Classifications

### Role Taxonomy

| Role | ATK | AGI | HP | PTS Range | Examples | Tactical Purpose |
|------|-----|-----|----|---------|---------|--------------------|
| **Swarm** | 2 | 3 | 3 | 13–17 | TIE, M3-A, Vulture | Quantity over quality; overwhelm defenses |
| **Jouster** | 3 | 2 | 5–7 | 18–25 | X-Wing, Kihraxz, Tri-Fighter | Head-on engagements; reliable damage |
| **Arc-Dodger** | 2–3 | 3 | 3–4 | 17–22 | A-Wing, Interceptor, StarViper | Out-maneuver; stay in blind spot |
| **Bomber** | 2 | 1–2 | 5–6 | 16–25 | Y-Wing, TIE Bomber, K-Wing | Ordnance delivery; area control |
| **Turret Boat** | 2–3 | 1–2 | 5–8 | 18–46 | Y-Wing, YT-1300, HWK | 360° coverage; ignore positioning |
| **Support** | 1–2 | 2 | 4–6 | 16–32 | HWK, TIE Reaper, U-Wing | Buff allies; coordinate actions |
| **Gunship** | 3–4 | 0–1 | 10–16 | 40–60 | VT-49, VCX-100, Upsilon | Area denial; raw firepower |
| **Capital** | 2–4 | 0 | 9–36 | 23–100 | CR90, Raider, GR-75 | Fleet anchor; section-based |

### Faction Combat Doctrines

| Faction | Primary Doctrine | Ship Mix | Weakness |
|---------|-----------------|----------|----------|
| **Rebel** | Versatility — answer any threat | Mixed roles; quality ships | Fewer ships; expensive |
| **Empire** | Swarm — overwhelm with numbers | Many cheap TIEs + few elites | No shields on most; fragile |
| **Scum** | Tricks — exploit weaknesses | Unique abilities; dirty fighting | Inconsistent; no coordination |
| **Republic** | Durability — outlast opponents | Heavy fighters; clone support | Slow; fewer options |
| **Separatist** | Network — calculated efficiency | Drone swarms; AI coordination | Predictable; no improvisation |
| **First Order** | Elite Power — quality with shields | Upgraded TIEs; command ships | Very expensive; few ships |

---

## 14. Balance Mapping to Shattered Stars

### X-Wing → Shattered Stars Faction Translation

| X-Wing Faction | Shattered Stars Faction | Stat Emphasis | Design Philosophy |
|----------------|------------------------|---------------|-------------------|
| Galactic Empire | **Terran Hegemony** | +Shields, Formation bonuses | Discipline; coordinated swarms; military hierarchy |
| Rebel Alliance | **Free Confederation** | Versatile, +Modification | Adaptable heroes; varied fleet; underdog spirit |
| Separatist Droids | **Synthetic Collective** | Calculate, Swarm bonuses | Networked AI; expendable drones; efficiency |
| Scum & Villainy | **Void Corsairs** | +Crit damage, Illicit slots | Dirty tricks; reputation; crew specialists |
| First Order | **Ascendant Empire** | Bio-regen, +Hull | Psionic powers; evolving ships; elite units |

### Stat Rebalancing Principles (from mechanical_changes.md)

| Principle | X-Wing Value | Shattered Stars Adjustment |
|-----------|-------------|---------------------------|
| **Hegemony shields** | TIE=0 shields | All Hegemony ships gain minimum 1 shield |
| **Hegemony formation** | No mechanic | +1 defense die at Range 1 of ally |
| **Confederation mods** | 1 mod slot | All ships get +1 modification slot |
| **Confederation heroic** | No mechanic | Heroic Moment system (momentum → interventions) |
| **Collective calculate** | Focus action | Calculate replaces Focus (more consistent) |
| **Collective swarm** | No mechanic | +1 ATK per ally targeting same enemy |
| **Corsair crit** | Normal crits | +1 crit damage; crit from behind bonus |
| **Corsair illicit** | Scum-only | 2 illicit slots; unique contraband |
| **Ascendant regen** | No mechanic | Heal 1 shield/turn; bio-evolution triggers |
| **Ascendant psionic** | No mechanic | Coordinate ignores range; precognition defense |

### Point Cost Mapping Formula

```
Shattered Stars Points = X-Wing Points × 1.0 (base)
  + Faction ability value (estimated +2–5 pts)
  - Faction weakness offset (estimated -1–3 pts)
  + Evolution potential (Tier 2: +3 pts, Tier 3: +6 pts base cost reflected)
```

### Key Balance Ratios to Preserve

| Ratio | X-Wing Value | Preserve In New Game |
|-------|-------------|---------------------|
| Cheapest fighter / most expensive fighter | 13 / 60 = 4.6× | ~4–5× spread |
| Swarm count at 100 pts | 6–7 TIEs | 6–7 budget ships |
| Elite count at 100 pts | 2–3 ships | 2–3 premium ships |
| ATK range | 1–4 (standard) | Same 1–4 range |
| AGI range | 0–3 | Same 0–3 range |
| HP range (standard) | 2–16 | Same 2–16 range |
| Capital HP | 9–36 | Same order of magnitude |
| Bomber damage / fighter damage | ~2× ordnance burst | Preserve 2× burst ratio |
| Support value / combat value | Support ATK=1 vs Fighter ATK=3 | Keep support ships weak offensively |

### Upgrade Slot Mapping

| X-Wing Slot | Shattered Stars Equivalent | Faction Preference |
|-------------|---------------------------|-------------------|
| Astromech | **AI Module** | Confederation, Collective |
| Elite Pilot Talent | **Specialization** | All factions |
| Torpedo | **Heavy Ordnance** | Bombers, heavy fighters |
| Missile | **Light Ordnance** | Interceptors, fighters |
| Cannon | **Energy Weapon** | Assault ships, Corsairs |
| Turret | **Omnidirectional Weapon** | Support, freighters |
| Bomb/Mine | **Area Denial** | Bombers |
| Crew | **Specialist** | Large ships, Corsairs (unique) |
| System | **Tech Module** | Elite ships |
| Illicit | **Contraband** | Corsairs exclusive |
| Modification | **Field Modification** | Universal (+1 for Confederation) |

---

## Appendix A: Complete Ship Count by Faction

| Faction | Fighters | Bombers | Large | Support | Epic | Total |
|---------|----------|---------|-------|---------|------|-------|
| Rebel Alliance | 5 | 2 | 4 | 1 | 2 | 14 |
| Galactic Empire | 7 | 2 | 1 | 3 | 2 | 15 |
| Scum & Villainy | 7 | 1 | 6 | 2 | 1 | 17 |
| Galactic Republic | 4 | 0 | 0 | 2 | 0 | 6 |
| Separatist Alliance | 2 | 1 | 0 | 0 | 0 | 3 |
| First Order | 3 | 0 | 1 | 0 | 0 | 4 |
| **Totals** | **28** | **6** | **12** | **8** | **5** | **59** |

*Note: Some ships counted in multiple roles (e.g., Y-Wing is both bomber and turret boat). The "87 ship variants" figure from the PRD includes named pilots and color variants, not distinct chassis.*

---

## Appendix B: Dice System Reference

### Attack Dice (Red)

| Face (d8) | Result | Probability |
|-----------|--------|-------------|
| 1–2 | Miss | 25% |
| 3–5 | Hit (Focus-convertible) | 37.5% |
| 6–7 | Critical Hit | 25% |
| 8 | Critical Hit | 12.5% |

**With Focus token**: Faces 3–7 all become Hits → 62.5% hit rate
**Without Focus**: Only faces 6–8 hit → 37.5% hit rate

### Defense Dice (Green)

| Face (d8) | Result | Probability |
|-----------|--------|-------------|
| 1–2 | Miss | 25% |
| 3–5 | Evade (Focus-convertible) | 37.5% |
| 6–8 | Evade | 37.5% |

**With Focus token**: Faces 3–8 all evade → 75% evade rate
**Without Focus**: Only faces 6–8 evade → 37.5% evade rate

### Expected Damage Formula

```
Expected Hits = ATK_dice × 0.375 (unfocused) or ATK_dice × 0.625 (focused)
Expected Evades = AGI_dice × 0.375 (unfocused) or AGI_dice × 0.75 (focused)
Expected Damage = max(0, Expected_Hits - Expected_Evades)
```

### Example: X-Wing (3 ATK, focused) vs TIE Fighter (3 AGI, unfocused)

```
Hits = 3 × 0.625 = 1.875
Evades = 3 × 0.375 = 1.125
Expected Damage = 0.75 per attack
Turns to kill (3 HP TIE) = ~4 attacks
```

---

*Document generated from X-Wing Arcade Unity codebase (Unity 6000.1.13f1). All ship names, stats, and mechanics are from the X-Wing Miniatures Game adaptation. Use as balance reference only — all names and lore will be replaced with Shattered Stars original IP.*
