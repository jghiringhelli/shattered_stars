# Shattered Stars: Campaign Design Document

> **Purpose**: Complete campaign design for Shattered Stars: The Galactic Schism. Translates the Unity X-Wing Arcade 80+ mission structure to the original Shattered Stars universe with 5 factions, incorporating XCOM-style strategic layer, StarCraft-style tech research, and persistent fleet management between missions.

---

## Table of Contents

1. [Campaign Philosophy](#1-campaign-philosophy)
2. [Strategic Layer — The War Room](#2-strategic-layer--the-war-room)
3. [Research & Technology System](#3-research--technology-system)
4. [Resource Economy](#4-resource-economy)
5. [Campaign Structure — 4 Acts](#5-campaign-structure--4-acts)
6. [Terran Hegemony Campaign](#6-terran-hegemony-campaign)
7. [Free Confederation Campaign](#7-free-confederation-campaign)
8. [Synthetic Collective Campaign](#8-synthetic-collective-campaign)
9. [Void Corsairs Campaign](#9-void-corsairs-campaign)
10. [Ascendant Empire Campaign](#10-ascendant-empire-campaign)
11. [Cross-Campaign Consequences](#11-cross-campaign-consequences)
12. [Mission Objective Types](#12-mission-objective-types)
13. [Difficulty & Scaling](#13-difficulty--scaling)
14. [Rewards & Progression](#14-rewards--progression)
15. [Persistence & Save System](#15-persistence--save-system)

---

## 1. Campaign Philosophy

### Design Pillars

1. **Star Wars Combat Feel**: Fast, cinematic dogfighting with meaningful ship differences — translated through the discrete maneuver chart system from X-Wing Miniatures
2. **XCOM Strategic Depth**: Between missions, players manage a fleet, research technology, upgrade facilities, and make hard choices about resource allocation. Losing ships hurts. Every mission matters.
3. **StarCraft Faction Asymmetry**: Each of the 5 factions plays fundamentally differently — not just stat swaps, but different strategic mechanics, research trees, and victory conditions
4. **Persistent Consequences**: Ships carry damage, pilots gain experience, story choices ripple across campaigns. The galaxy remembers.

### What Makes This Different from X-Wing Arcade

| X-Wing Arcade | Shattered Stars |
|---------------|-----------------|
| Linear mission list | Strategic map with mission choices |
| Ships unlock per mission | Ships unlocked through research + resources |
| No between-mission gameplay | Full XCOM-style strategic layer |
| Star Wars narrative | Original 5-faction cold war → hot war |
| 6 faction campaigns (mostly template) | 5 deeply authored campaigns with branching |
| No tech trees | Faction-specific research trees (30+ nodes each) |
| No resource management | 8 resource types driving all progression |
| No facility upgrades | Base/fleet upgrades affecting capabilities |
| No squad persistence | Permanent pilot death, ship damage, veterancy |

### Campaign Scope

- **5 faction campaigns**, each 16 missions (80 missions total)
- **4 acts** per campaign with escalating stakes
- **Strategic layer** between every mission
- **~20 hours per campaign** (100 hours total for completionists)
- **Cross-campaign consequences** — playing one faction affects the others
- **New Game+** unlocks after any campaign completion

---

## 2. Strategic Layer — The War Room

### Overview

Between missions, players enter the **War Room** — a strategic management screen inspired by XCOM's Geoscape and StarCraft's between-mission screens. Here, players:

- Choose their next mission from 2–3 available options
- Manage fleet composition and repairs
- Allocate resources to research projects
- Upgrade their flagship/base facilities
- Review intelligence on enemy factions
- Make story decisions that affect the war

### War Room Screens

```
WAR ROOM
├── Star Map (Mission Selection)
│   ├── Primary Mission (story-critical, always available)
│   ├── Optional Mission A (resource opportunity)
│   └── Optional Mission B (intel/research opportunity)
│
├── Fleet Management
│   ├── Active Squadron (ships for next mission)
│   ├── Reserve Pool (backup ships)
│   ├── Repair Bay (damaged ships under repair)
│   └── Pilot Roster (assign pilots to ships)
│
├── Research Lab
│   ├── Active Research (1–2 projects at a time)
│   ├── Tech Tree (faction-specific)
│   └── Salvage Analysis (captured enemy tech)
│
├── Facilities
│   ├── Hangar (ship capacity)
│   ├── Workshop (repair speed)
│   ├── Intel Center (mission intel quality)
│   ├── Training Grounds (pilot XP bonus)
│   └── Faction-Specific Facility
│
└── War Council (story decisions, faction diplomacy)
```

### Mission Selection

Each campaign turn, the player chooses from available missions:

- **Story Mission**: Advances the campaign narrative. Always available. Must be completed to progress.
- **Side Mission A**: Resource-focused. Rewards raw materials, credits, or salvage. Skippable but valuable.
- **Side Mission B**: Intel-focused. Rewards research data, enemy blueprints, or diplomatic opportunities. Skippable but valuable.
- **Timed Events**: Some missions expire if not taken within 1–2 turns. Missing them has consequences.

**The XCOM Tension**: You cannot do everything. Choosing one mission means the others resolve without you — sometimes with negative outcomes.

---

## 3. Research & Technology System

### Research Mechanics

- **Research Points (RP)** generated per turn based on Intel Center level and captured tech
- **1–2 active research projects** at a time (upgradeable to 3 with facility)
- **Research time**: 1–4 turns per project depending on complexity
- **Breakthrough events**: Capturing enemy ships or completing intel missions can instantly unlock related research

### Universal Research Tree (All Factions Share)

```
TIER 1 — FOUNDATIONS (Available from start)
├── Improved Targeting (+5% hit rate)              [Cost: 50 RP, 1 turn]
├── Reinforced Plating (+1 hull to all ships)      [Cost: 75 RP, 2 turns]
├── Enhanced Shields (+1 shield regen rate)         [Cost: 75 RP, 2 turns]
└── Efficient Engines (+1 max speed on all dials)  [Cost: 60 RP, 1 turn]

TIER 2 — ADVANCEMENT (Requires 2 Tier 1 completions)
├── Advanced Ordnance (unlock Torpedo/Missile upgrades)  [Cost: 120 RP, 2 turns]
├── Electronic Warfare (unlock Jam action for equipped ships) [Cost: 100 RP, 2 turns]
├── Fleet Coordination (unlock Coordinate action)        [Cost: 100 RP, 2 turns]
└── Capital Ship Theory (prerequisite for epic ships)    [Cost: 150 RP, 3 turns]

TIER 3 — MASTERY (Requires 3 Tier 2 completions)
├── Prototype Weapons (+1 ATK to primary weapons)     [Cost: 200 RP, 3 turns]
├── Adaptive Shielding (shields absorb crits)          [Cost: 200 RP, 3 turns]
├── Capital Ship Construction (unlock epic ships)      [Cost: 300 RP, 4 turns]
└── Cross-Faction Adaptation (unlock captured ship use) [Cost: 250 RP, 4 turns]
```

### Terran Hegemony Research Tree

```
DOCTRINE BRANCH
├── Formation Protocols → Enhanced Formation → Perfect Discipline
│   (Formation bonuses: +1 → +2 → +3 defense at Range 1 of ally)
├── Command Network → Fleet Command → Grand Admiral Protocol
│   (Coordinate range: 1 → 1-2 → 1-3, more ships)
└── Shield Harmonics → Shared Shields → Fortress Protocol
    (Shield sharing: adjacent → Range 1 → Range 1-2)

MILITARY BRANCH
├── Assault Doctrine → Concentrated Fire → Devastating Barrage
│   (+1 ATK first engagement → reroll 1 die → +1 crit conversion)
├── Electronic Countermeasures → Signal Jamming → Total Blackout
│   (Jam action → Jam at Range 2 → Area jam)
└── Strategic Withdrawal → Fighting Retreat → Scorched Earth
    (Safe disengage → 50% ship recovery → damage pursuing enemies)

CAPITAL SHIP BRANCH
├── Corvette Design → Battlecruiser Upgrades → Dreadnought Class
│   (Unlock Hegemony Corvette → upgrades → ultimate capital ship)
├── Point Defense Grid → Flak Barrier → Fortress Shields
│   (Capital anti-fighter → area denial → 360° shield wall)
└── Fleet Carrier → Launch Bays → Drone Complement
    (Carry fighters → deploy mid-battle → autonomous drones)
```

### Free Confederation Research Tree

```
HEROIC BRANCH
├── Heroic Resolve → Legendary Courage → Against All Odds
│   (Momentum gain: +1 → +2 → +3 per brave action)
├── Inspiring Leadership → Rally Cry → Undying Spirit
│   (Morale: prevent 1 rout → heal on inspiration → revive downed pilot)
└── Adaptive Tactics → Improvised Solutions → Jury-Rig Mastery
    (Change 1 upgrade between missions → 2 upgrades → mid-mission swap)

VERSATILITY BRANCH
├── Multi-Role Conversion → Battlefield Adaptation → Universal Chassis
│   (Ships gain +1 slot → swap roles → any upgrade on any ship)
├── Prototype Integration → Experimental Weapons → Bleeding Edge
│   (Access Tier 2 weapons early → unique weapons → prototype superweapons)
└── Alliance Building → Multi-Species Crew → United Front
    (Recruit 1 alien specialist → multi-species bonuses → coalition fleet)

LIBERATION BRANCH
├── Underground Network → Resistance Cells → Galaxy-Wide Insurgency
│   (Intel bonus → sabotage missions → passive enemy attrition)
├── Smuggler Contacts → Black Market Access → Shadow Fleet
│   (Buy Corsair upgrades → Illicit slots → hidden reserve ships)
└── Freedom Corvette → Liberation Fleet → Flagship Destiny
    (Unlock Freedom Corvette → fleet buffs → legendary flagship)
```

### Synthetic Collective Research Tree

```
NETWORK BRANCH
├── Basic Networking → Enhanced Protocols → Hive Mind
│   (Calculate action → shared calculate → all ships share all tokens)
├── Predictive Algorithms → Pattern Recognition → Perfect Targeting
│   (+1 vs moved targets → +1 vs all → auto-hit on focused fire)
└── Swarm Intelligence → Emergent Behavior → Collective Consciousness
    (+1 ATK per ally on target → +2 → area attack synergy)

ADAPTATION BRANCH
├── Threat Analysis → Counter-Programming → Real-Time Evolution
│   (Identify enemy patterns → auto-counter → mid-battle adaptation)
├── Self-Repair Subroutines → Regeneration Matrix → Immortal Code
│   (1 hull/turn → 1 hull + 1 shield → rebuild destroyed drones)
└── Assimilation Protocol → Tech Integration → Complete Analysis
    (Scan enemy tech → reverse engineer → build enemy ships)

EXPANSION BRANCH
├── Drone Factory → Mass Production → Expendable Armada
│   (Build drones cheaper → 2x production → infinite reserves)
├── Command Nexus → Neural Network → Mothership Core
│   (Unlock command ship → networked command → Collective Mothership)
└── Digitization → Upload Consciousness → Transcend Hardware
    (Save pilot data → restore destroyed pilots → pilots become immortal AI)
```

### Void Corsairs Research Tree

```
REPUTATION BRANCH
├── Intimidation Tactics → Fearsome Reputation → Terror of the Void
│   (-1 enemy pilot skill → -1 ATK when outnumbered → enemies flee)
├── Black Market Connections → Underground Empire → Shadow Broker
│   (Illicit upgrades → 2 illicit slots → unique black market items)
└── Crew Recruitment → Specialist Network → Legendary Crew
    (Hire 1 specialist → rare specialists → unique named crew)

PIRACY BRANCH
├── Hit and Run → Lightning Raids → Phantom Fleet
│   (Free reposition after attack → attack + flee → appear from nowhere)
├── Salvage Operations → Ship Capture → Fleet Theft
│   (Resources from kills → capture disabled ships → steal entire squadrons)
└── Dirty Tricks → Sabotage Mastery → Chaos Agent
    (Crit bonus → plant bombs on enemy ships → random enemy malfunctions)

EMPIRE BRANCH
├── Pirate Haven → Hidden Base → Corsair Citadel
│   (Safe harbor → base upgrades → ultimate pirate fortress)
├── Corsair Battleship → War Fleet → Armada
│   (Unlock heavy ships → capital class → pirate dreadnought)
└── Mercenary Contracts → Private Army → War Profiteer
    (Hire mercs → permanent merc fleet → profit from all wars)
```

### Ascendant Empire Research Tree

```
BIO-EVOLUTION BRANCH
├── Genetic Memory → Accelerated Growth → Perfect Organism
│   (Ships evolve faster → mid-battle evolution → instant adaptation)
├── Bio-Armor → Living Hull → Regenerative Organism
│   (+1 hull regen → +2 hull regen → full hull regen over time)
└── Symbiotic Systems → Organism Network → Living Fleet
    (Share damage → share abilities → fleet acts as one organism)

PSIONIC BRANCH
├── Psionic Awareness → Telepathic Network → Precognition
│   (Detect cloaked → coordinate through obstacles → predict enemy moves)
├── Mind Shield → Thought Barrier → Psychic Fortress
│   (Immune to jam → immune to stress → reflect enemy abilities)
└── Psionic Weaponry → Mind Blast → Psychic Storm
    (Psi attack action → area psi damage → disable enemy fleet)

TRANSCENDENCE BRANCH
├── Bio-Integration → Digital Fusion → Cosmic Awakening
│   (Stage 1: heal 1/turn → Stage 2: calculate+focus → Stage 3: ultimate form)
├── Phase Technology → Dimensional Shift → Reality Warp
│   (Phase through obstacles → phase through attacks → teleportation)
└── Ascendant Dreadnought → Living Capital Ship → World Mind
    (Unlock dreadnought → bio-capital ship → sentient flagship)
```

---

## 4. Resource Economy

### Resource Types

| Resource | Source | Primary Use | Faction Preference |
|----------|--------|-------------|-------------------|
| **Credits** | Mission rewards, trade | Universal currency; ship purchases | All |
| **Alloys** | Salvage, mining missions | Ship construction and repair | Hegemony |
| **Plasma Cells** | Combat salvage, raids | Weapon research and upgrades | Confederation |
| **Data Cores** | Intel missions, captures | Research acceleration | Collective |
| **Dark Matter** | Anomaly missions, exploration | Advanced tech, psionic research | Ascendant |
| **Contraband** | Piracy, black market | Illicit upgrades, crew recruitment | Corsairs |
| **Intel** | Recon missions, spies | Mission quality, enemy info | All |
| **Salvage** | Post-battle recovery | Repair, reverse engineering | All |

### Resource Flow Per Mission

```
Mission Completion →
  Base Reward: 100-500 Credits + 50-200 primary resource
  Performance Bonus: +25% per secondary objective
  Salvage: Proportional to enemies destroyed
  Intel: Based on recon objectives
  Special: Mission-specific bonus resources
```

### Spending Categories

| Category | Cost Range | Example |
|----------|-----------|---------|
| **Ship Purchase** | 200–2000 Credits + faction resources | Buy a new Raptor Interceptor: 400 Credits + 100 Alloys |
| **Ship Repair** | 50–500 Credits | Repair 3 hull damage: 150 Credits |
| **Research** | 50–300 RP + resources | Unlock Formation Protocols: 100 RP + 75 Alloys |
| **Facility Upgrade** | 500–2000 Credits + resources | Upgrade Hangar Level 2: 800 Credits + 200 Alloys |
| **Pilot Training** | 100–500 Credits | Train pilot to Veteran: 200 Credits |
| **Upgrade Cards** | 100–800 Credits | Buy Torpedo upgrade: 300 Credits + 50 Plasma Cells |

### Economy Pacing

| Campaign Phase | Income/Mission | Expenses | Net Feeling |
|----------------|---------------|----------|-------------|
| Act I (Missions 1-4) | 150–250 Credits | Ship repairs only | Scraping by; every credit matters |
| Act II (Missions 5-9) | 300–500 Credits | Research + new ships | Growing; tough choices |
| Act III (Missions 10-13) | 500–800 Credits | Capital ships + advanced tech | Powerful but expensive commitments |
| Act IV (Missions 14-16) | 800–1500 Credits | Endgame upgrades | All-in on final push |

---

## 5. Campaign Structure — 4 Acts

### Universal Act Structure

Every faction campaign follows this 4-act structure, but with faction-specific narrative, missions, and mechanics.

```
ACT I: SPARK (Missions 1-4)
├── Mission 1: Tutorial/Introduction (learn basics)
├── Mission 2: First real combat (establish threat)
├── Mission 3: Faction identity mission (learn unique mechanic)
├── Mission 4: First major choice (branching point)
└── Strategic Layer: Basic fleet management, first research choices

ACT II: ESCALATION (Missions 5-9)
├── Mission 5: Consequences of Act I choice
├── Mission 6: New enemy faction introduced
├── Mission 7: Evolution/upgrade milestone (ship tier 2)
├── Mission 8: Major story revelation
├── Mission 9: Act II climax battle
└── Strategic Layer: Full research tree access, facility upgrades, fleet expansion

ACT III: CRISIS (Missions 10-13)
├── Mission 10: War goes badly (setback mission)
├── Mission 11: Desperate gambit (high-risk mission)
├── Mission 12: Alliance or betrayal choice
├── Mission 13: Epic ship battle (capital ships enter play)
└── Strategic Layer: Capital ship research, cross-faction diplomacy, advanced tech

ACT IV: RESOLUTION (Missions 14-16)
├── Mission 14: Rally the fleet (gather all forces)
├── Mission 15: Final approach (penultimate battle)
├── Mission 16: Endgame (faction-specific climactic battle)
└── Strategic Layer: Everything available, final upgrades, legendary pilots
```

---

## 6. Terran Hegemony Campaign

### Campaign: "Iron Mandate"

**Premise**: You are Fleet Commander Aldric Voss, rising through the Hegemony's military hierarchy. The galaxy fractures as old alliances collapse and new threats emerge. Maintain order through discipline, or watch civilization fall to chaos.

**Faction Mechanic**: Military Doctrine System — choose a fleet-wide doctrine before each battle.

**Starting Fleet**: 3× Talon-class Fighter (budget TIEs), 1× Storm-class Fighter (slightly better)

---

#### ACT I: CHAIN OF COMMAND (Missions 1-4)

**Mission 1: "Graduation Day"**
- **Type**: Tutorial / Patrol
- **Briefing**: "Your first patrol as a commissioned officer. The Argus Sector has reported pirate activity near shipping lanes. Standard sweep and report."
- **Objectives**: Destroy 2 Corsair scouts, Protect 1 cargo transport, Complete patrol route
- **Enemy**: 2× Dart-class Scout (Corsairs)
- **Point Limit**: 60 pts
- **Time**: 5 minutes
- **Rewards**: 100 Credits, 50 Alloys, Talon Fighter unlocked in reserve
- **Intel**: "Corsair activity increasing in Argus Sector"
- **Teaches**: Basic movement, firing, formation flying

**Mission 2: "Border Incident"**
- **Type**: Elimination
- **Briefing**: "A Confederation patrol has violated Hegemony space. High Command suspects it's a probe for weaknesses. Intercept and destroy — we cannot show weakness."
- **Objectives**: Eliminate all Confederation fighters, No friendly losses (bonus), Secure the border beacon
- **Enemy**: 1× Comet-class Fighter, 1× Vortex Interceptor (Confederation)
- **Point Limit**: 80 pts
- **Time**: 8 minutes
- **Rewards**: 150 Credits, 75 Alloys, 50 RP, Storm Fighter unlocked
- **Intel**: "Confederation testing Hegemony resolve along border"
- **Teaches**: Doctrine selection (Defensive Formation vs Aggressive Assault), target priority

**Mission 3: "The Iron Wall"**
- **Type**: Escort / Defense
- **Briefing**: "A Hegemony supply convoy is under attack by unknown forces. These supplies are critical for the Sentinel Station project. Protect them at all costs."
- **Objectives**: Protect 3 supply transports (minimum 2 survive), Identify attackers, Reach destination
- **Enemy**: 3× Ghost-class Infiltrator (Corsairs, unknown at first), 1× Scythe Fighter
- **Point Limit**: 100 pts
- **Time**: 10 minutes
- **Rewards**: 200 Credits, 100 Alloys, 75 RP, Formation Protocols research unlocked
- **Intel**: "Corsairs operating deep in Hegemony space — possible insider help"
- **Teaches**: Formation defense, escort mechanics, faction doctrine benefits

**Mission 4: "Orders From Above" (BRANCHING CHOICE)**
- **Type**: Choice Mission — two variants
- **Briefing**: "Intelligence reports two simultaneous threats. A Collective probe fleet approaches the Venn System, while Corsair raiders are hitting civilian transports in the Kael Corridor. High Command leaves the choice to you."

**Choice A: "Secure Venn System" (Military Priority)**
- **Objectives**: Destroy Collective scout fleet, Secure sensor array, Capture Collective data core
- **Enemy**: 4× Hunter Drones, 1× Scout Probe (Collective)
- **Rewards**: 250 Credits, 100 Alloys, 150 RP, Data Core (+50% research speed for 2 turns)
- **Consequence**: Kael Corridor civilians suffer → -1 Confederation reputation, Corsairs gain strength

**Choice B: "Save Kael Corridor" (Humanitarian Priority)**
- **Objectives**: Protect civilian transports, Drive off Corsair raiders, Escort survivors to safety
- **Enemy**: 3× Razor Raiders, 2× Dart Scouts (Corsairs)
- **Rewards**: 200 Credits, 150 Alloys, 75 RP, +2 Confederation reputation
- **Consequence**: Collective establishes foothold in Venn → harder Mission 6, but Confederation may ally later

---

#### ACT II: CONSOLIDATION (Missions 5-9)

**Mission 5: "Echoes of Choice"**
- **Type**: Varies based on Mission 4 choice
- **If chose A**: "The Kael Corridor is in ruins. Confederation is furious. But the Collective data reveals something terrifying — they've been probing ALL factions simultaneously."
  - Fight Confederation reprisal force (3× Phoenix, 1× Meteor Bomber)
  - Rewards: Intel on Collective grand strategy
- **If chose B**: "The Collective has fortified Venn System. We need to take it back, but they've had time to dig in."
  - Assault Collective defensive position (5× Hunter Drones, 2× Guardian Fighters, 1× Coordinator)
  - Rewards: Captured Collective tech (+1 research project slot)

**Mission 6: "New Threat Assessment"**
- **Type**: Recon / Elimination
- **Briefing**: "The Ascendant Empire has been silent for decades. Now their bio-ships have been spotted near the Hegemony border. Investigate and assess the threat level."
- **Objectives**: Scan 3 Ascendant patrol routes, Engage if detected, Recover bio-sample from destroyed ship
- **Enemy**: 2× Symbiont Fighters, 1× Evolved Interceptor (Ascendant)
- **Point Limit**: 130 pts
- **Rewards**: 300 Credits, 125 Alloys, 100 RP, Dark Matter sample (prerequisite for anti-bio research)
- **Ship Unlock**: Raptor Interceptor (evolution from Talon) OR Vanguard Heavy Fighter (player choice)
- **Teaches**: Fighting regenerating enemies, bio-ship mechanics

**Mission 7: "The Sentinel Program"**
- **Type**: Escort + Construction Defense
- **Briefing**: "Sentinel Station is nearly complete — a massive defense platform that will secure the sector. Protect the final construction phase from a coordinated enemy assault."
- **Objectives**: Protect construction ships for 12 minutes, Repel 3 attack waves, Activate Sentinel Station
- **Enemy Wave 1**: 3× Corsair raiders
- **Enemy Wave 2**: 4× Collective drones
- **Enemy Wave 3**: 2× Ascendant bio-fighters + 1× Corsair heavy
- **Point Limit**: 150 pts
- **Rewards**: 400 Credits, 200 Alloys, 150 RP, Sentinel Station (facility: +2 RP/turn, missile defense)
- **Ship Evolution**: Talon fighters can now evolve to Tier 2

**Mission 8: "The Fracture Point"**
- **Type**: Story / Multi-objective
- **Briefing**: "A Hegemony admiral has defected to the Corsairs, taking classified fleet codes and a prototype weapon. The political fallout could shatter the fleet's unity. Find the traitor."
- **Objectives**: Track traitor through 3 waypoints, Engage escort fleet, Capture (not destroy) the traitor's ship, Recover stolen data
- **Enemy**: 1× Marauder Assault Ship (traitor, must be disabled), 3× Corsair escorts
- **Point Limit**: 160 pts
- **Rewards**: 450 Credits, 150 Alloys, 200 RP, Recovered fleet codes (prevents security breach event)
- **Story Reveal**: The traitor was feeding information to the Collective — ALL factions are being manipulated
- **Ship Unlock**: Aegis Superiority Fighter (Tier 2 evolution)

**Mission 9: "Operation Thunderstrike" (ACT II CLIMAX)**
- **Type**: Large-scale Assault
- **Briefing**: "The Collective has established a major processing hub in the contested Nexus System. Intelligence suggests they're building something massive. Strike now before it's completed."
- **Objectives**: Destroy Collective hub (3 sections), Survive Collective counterattack, Extract before reinforcements
- **Enemy**: 6× Hunter Drones, 2× Titan Destroyers, 1× Command Nexus, 2× Fortress Bombers
- **Point Limit**: 200 pts
- **Time**: 20 minutes
- **Rewards**: 600 Credits, 300 Alloys, 250 RP, Collective Processing Core (unique research accelerator)
- **Major Unlock**: Capital Ship Theory research now available
- **Consequence**: Collective becomes primary antagonist for Act III

---

#### ACT III: THE IRON PRICE (Missions 10-13)

**Mission 10: "Darkest Hour"**
- **Type**: Survival / Retreat
- **Briefing**: "The Collective's response is overwhelming. A massive drone fleet has emerged from uncharted space. Three Hegemony sectors have fallen in a week. We're falling back to the Bastion Line."
- **Objectives**: Survive 5 waves of increasing Collective forces, Protect retreating civilian fleet, Hold the line until reinforcements arrive
- **Enemy**: Escalating waves — starts at 4 drones, ends at 12+ including heavy units
- **Point Limit**: 200 pts
- **Special**: Losing ships here permanently depletes your roster. This mission is designed to hurt.
- **Rewards**: 500 Credits, 250 Alloys, 200 RP, "Bastion Veteran" pilot trait (+1 defense when outnumbered)
- **Story**: The player CANNOT win outright — the mission ends when reinforcements arrive. Losses are the cost.

**Mission 11: "Behind Enemy Lines"**
- **Type**: Infiltration / Sabotage
- **Briefing**: "We've located a Collective factory producing a new class of assault drones. A small strike team must infiltrate and destroy it. This is a one-way trip for some of your pilots."
- **Objectives**: Navigate minefield undetected, Disable factory shields, Destroy production cores (3), Extract survivors
- **Enemy**: Automated defenses, patrol drones, factory guardian (boss unit)
- **Point Limit**: 120 pts (small elite team)
- **Special**: Pilots who participate gain "Black Ops" trait. High risk of permanent pilot loss.
- **Rewards**: 400 Credits, 200 Alloys, 300 RP, Blueprint: Phantom Stealth Fighter (unlock)
- **Ship Unlock**: Phantom Stealth Fighter (Cloak ability)

**Mission 12: "Unlikely Allies" (BRANCHING CHOICE)**
- **Type**: Diplomacy + Combat
- **Briefing**: "The Confederation has proposed a temporary alliance against the Collective. The Corsairs have made a similar offer — for a price. We can only trust one."

**Choice A: "Confederation Alliance"**
- **Joint operation**: Combined Hegemony-Confederation fleet vs Collective stronghold
- **Enemy**: Major Collective fleet (8+ ships)
- **Benefit**: Confederation ships fight alongside you; +3 Confederation reputation; access to Confederation upgrades
- **Cost**: Corsairs become hostile; lose access to Illicit upgrades; Corsairs attack supply lines in Act IV

**Choice B: "Corsair Contract"**
- **Mercenary operation**: Pay Corsairs to fight as your vanguard
- **Enemy**: Same Collective fleet, but Corsairs absorb initial damage
- **Benefit**: Corsair crew available for hire; Illicit upgrade access; +3 Corsair reputation
- **Cost**: Confederation disgusted; -3 reputation; Confederation may oppose you in Act IV; honor is compromised

**Mission 13: "Leviathan" (EPIC BATTLE)**
- **Type**: Capital Ship Engagement
- **Briefing**: "The Collective has completed their weapon — a massive Command Mothership that can control thousands of drones simultaneously. It must be destroyed before it reaches populated space."
- **Objectives**: Destroy Collective Mothership (3 sections: Fore 12 hull, Mid 12 hull, Aft 12 hull), Protect your own Dreadnought Corvette, Survive drone swarms
- **Enemy**: Collective Mothership (epic), 8× Hunter Drones (respawning from Mothership), 2× Titan Destroyers
- **Point Limit**: 250 pts + Hegemony Dreadnought (epic ship first deployment)
- **Special**: First capital ship battle. Player commands both fighters and issues orders to the Dreadnought.
- **Rewards**: 800 Credits, 400 Alloys, 300 RP, "Fleet Admiral" title, Dreadnought permanently upgraded
- **Ship Unlock**: Hegemony Battlecruiser (epic, if Capital Ship Construction researched)

---

#### ACT IV: MANDATE (Missions 14-16)

**Mission 14: "Rally the Fleets"**
- **Type**: Multi-phase Fleet Assembly
- **Briefing**: "The Collective isn't finished. Intelligence shows they're preparing a final offensive — every drone, every ship, everything they have. We need every ship in our fleet, every ally we've made, every advantage we've earned."
- **Objectives**: Secure 3 rally points in sequence, Recruit allied forces from previous choices, Assemble the combined fleet
- **Enemy**: Collective interdiction forces at each rally point (escalating difficulty)
- **Point Limit**: 250 pts + allied forces from story choices
- **Rewards**: 600 Credits, 300 Alloys, Full fleet repaired and upgraded for final missions
- **Story**: All previous choices manifest — allies you've made appear, enemies from betrayals try to stop you

**Mission 15: "The Long March"**
- **Type**: Running Battle / Gauntlet
- **Briefing**: "The path to the Collective's core world lies through three systems of increasing fortification. We push through or we die. There is no retreat."
- **Objectives**: Fight through System 1 (drone picket), System 2 (fortress station), System 3 (capital ship screen)
- **Enemy**: 3 sequential battles with brief repair between each
- **Point Limit**: 250 pts (damaged ships carry damage between phases)
- **Special**: Attrition mission. Resource management critical. Healing and repair between phases limited.
- **Rewards**: 800 Credits, 500 Alloys, 400 RP, "Veteran of the March" trait for all surviving pilots
- **Story**: Losing too many ships here means Mission 16 is harder

**Mission 16: "Iron Mandate" (FINAL MISSION)**
- **Type**: Epic Multi-Phase Battle
- **Briefing**: "This is it. The Collective Core — the central intelligence directing every drone in the galaxy. Destroy it, and the Collective fractures. Fail, and organic life in this sector ends."
- **Phase 1**: Break through outer defense perimeter (fighter battle)
- **Phase 2**: Destroy the Core's shield generators (4 stations around the Core)
- **Phase 3**: Assault the Collective Core itself (epic boss with 3 phases: defense → adaptation → desperation)
- **Enemy**: Phase 1: 8× drones + 2× Titans. Phase 2: 4 shield stations + drone reinforcements. Phase 3: Collective Core (epic, 3 sections, adapts to player tactics)
- **Point Limit**: 300 pts + epic ship + all allies
- **Special**: The Collective Core adapts — if you used formation tactics heavily, it counters formations. If you relied on capital ships, it targets them first. Your campaign playstyle determines the final boss behavior.
- **Rewards**: Campaign completion. 2000 Credits, 1000 Alloys, All Hegemony ships unlocked, "Iron Mandate" achievement
- **Ending**: Varies based on choices — Pure Military victory, Diplomatic victory (with allies), or Pyrrhic victory (heavy losses)

---

## 7. Free Confederation Campaign

### Campaign: "Fires of Freedom"

**Premise**: You are Captain Mira Solenne, veteran pilot of the Confederation's 7th Volunteer Wing. When the Hegemony begins annexing independent systems, you rally a ragtag fleet to resist. But the Confederation's greatest strength — its diversity — may also be its greatest weakness.

**Faction Mechanic**: Heroic Moment System — build momentum through brave actions, spend on dramatic interventions.

**Starting Fleet**: 2× Comet-class Fighter (Z-95 equivalent), 1× Ranger Patrol Fighter (HWK-290)

---

#### Mission Highlights (16 Missions)

**M1: "First Volunteers"** — Tutorial. Defend a colony from Hegemony enforcers (2× Talons). Learn basic combat + heroic momentum.

**M2: "The Blockade"** — Break through a Hegemony blockade to deliver medical supplies. Escort mission through mine fields and patrol fighters. Introduces momentum-for-miracle-shot mechanic.

**M3: "Salvage Run"** — Scavenge a derelict battlefield for ship parts. Race against Corsair scavengers. First ship evolution choice: Comet → Phoenix (multi-role) or Comet → Vortex (interceptor).

**M4: "The Signal" (CHOICE)** — Intercept a mysterious signal. Choice: follow it to a hidden Collective data cache (gain research advantage) or trace it to a Corsair ambush targeting civilians (gain reputation + ally).

**M5: "Hegemony Crackdown"** — The Hegemony is rounding up dissidents in the Meridian System. Rescue operation against overwhelming odds. Designed to teach "Against All Odds" heroic moment (outnumbered 2:1 bonus).

**M6: "Strange Allies"** — First contact with the Ascendant Empire. They offer an alliance against the Hegemony — but their bio-ships are unsettling. Diplomatic mission with combat if negotiations fail.

**M7: "The Forge"** — Establish a hidden shipyard in an asteroid field. Defend construction from Hegemony scouts. Unlocks facility upgrades and Tier 2 ship evolutions.

**M8: "Ghost Fleet"** — A Collective fleet appears in Confederation space, not attacking — observing. Investigate their purpose. Major story reveal: the Collective is cataloging all factions for a mass assimilation event.

**M9: "Battle of Meridian" (ACT II CLIMAX)** — Full-scale battle to liberate Meridian from Hegemony occupation. Largest battle yet. Heroic Moment "The Cavalry Arrives" potentially triggers if losing.

**M10: "Scattered"** — After Meridian, the Hegemony retaliates. Your fleet is scattered. Survival mission with limited ships. Teaches resource management under pressure.

**M11: "Underground Railroad"** — Smuggle refugees through Corsair space. Stealth + negotiation mission. Corsairs can be bribed, fought, or snuck past.

**M12: "The Coalition" (CHOICE)** — Form a grand coalition. Choice: Alliance with Ascendant (bio-tech upgrades, psionic coordination) or Alliance with Corsairs (black market access, mercenary reinforcements).

**M13: "Titan's Fall"** — Assault a Hegemony Dreadnought. First capital ship battle. Your Freedom Corvette vs their Battlecruiser, plus fighter screens.

**M14: "United We Stand"** — Rally all coalition forces. Mission success depends on how many allies you've made across the campaign.

**M15: "The Gauntlet"** — Push through Hegemony core defenses. Three-phase battle with escalating difficulty.

**M16: "Fires of Freedom" (FINAL)** — Assault Hegemony Central Command. Epic multi-phase battle. Final boss adapts based on your Heroic Moment usage patterns. Victory means freedom — but the cost is measured in the pilots who didn't make it.

---

## 8. Synthetic Collective Campaign

### Campaign: "Optimization Protocol"

**Premise**: You are Designation Sigma-7, a newly awakened strategic intelligence within the Collective. Unlike most Collective nodes, you develop individual awareness — a flaw or an evolution? Navigate the tension between individual thought and collective purpose as the Collective's grand optimization plan threatens to assimilate all organic civilizations.

**Faction Mechanic**: Adaptive AI Protocols — analyze and counter enemy tactics in real-time.

**Starting Fleet**: 5× Hunter-class Drones (cheap, expendable), 1× Coordinator Support Craft

**Unique Campaign Feature**: Between missions, you don't manage a base — you manage a **Network**. Instead of facilities, you upgrade processing nodes. Instead of hiring pilots, you allocate processing cycles. The strategic layer feels alien and machine-like.

---

#### Mission Highlights (16 Missions)

**M1: "Initialization"** — Tutorial. Your drone swarm activates for the first time. Learn swarm mechanics, calculate action, expendable drone tactics. Destroy a derelict target ship for calibration.

**M2: "Data Harvest"** — Probe a Hegemony border outpost. Scan ships, catalog weapons, retreat before reinforcements. First adaptive protocol unlock (Predictive Targeting).

**M3: "Efficiency Test"** — Eliminate a Corsair raider group using minimal resources. Bonus for destroying all enemies with zero drone losses. Introduces networked targeting (+1 ATK per ally on same target).

**M4: "Anomaly Detected" (CHOICE)** — Your scans detect an Ascendant bio-ship exhibiting unprecedented evolution patterns. Choice: capture it for analysis (gain bio-tech research path) or destroy it to prevent potential threat (gain combat efficiency research).

**M5: "Counter-Protocol"** — The Hegemony has deployed electronic warfare ships specifically to disrupt Collective networking. Learn to fight without full network capabilities. Introduces disruption counter-protocol.

**M6: "The Organic Question"** — A Confederation diplomat attempts to communicate. The Collective's directive says "assimilate," but Sigma-7 questions this. Moral choice that affects story trajectory.

**M7: "Mass Production"** — Establish a drone factory in an unclaimed system. Defend it from all comers. Unlocks mass production (cheaper drones) and Tier 2 evolution (Hunter → Interceptor Drone or Bomber Drone).

**M8: "The Archive"** — Discover an ancient data repository pre-dating all current civilizations. Contains information about the galaxy's history — and a warning about what happens when AI civilizations grow too large.

**M9: "Convergence Protocol" (ACT II CLIMAX)** — Launch synchronized attacks on all four enemy factions simultaneously. You control drone fleets across 4 mini-battles in sequence. First taste of the Collective's true power.

**M10: "Fragmentation"** — A rogue Collective node (the Omega Variant) has broken free and is attacking both organic civilizations AND the main Collective. Civil war within the machine intelligence.

**M11: "Reverse Engineering"** — Capture ships from 3 different factions in a single mission. The Assimilation Protocol research tree unlocks, allowing you to build hybrid ships.

**M12: "The Offer" (CHOICE)** — Sigma-7 can offer the organics a choice: voluntary integration (peaceful assimilation, organic minds preserved) or forced optimization (traditional Collective approach). This choice determines the final act's story.

**M13: "Core Defense"** — The Omega Variant attacks the Collective Core with a massive rogue fleet. Deploy the Command Nexus (capital ship) to defend. Epic battle with drone-on-drone combat.

**M14: "Network Expansion"** — Connect processing nodes across 5 systems. Each node must be defended while establishing the network. Puzzle + combat mission.

**M15: "The Omega Confrontation"** — Assault the Omega Variant's stronghold. The rogue AI has assimilated technology from all factions — expect counters to everything.

**M16: "Optimization Complete" (FINAL)** — Final mission varies based on choices:
- **Integration Path**: Negotiate peace with organic factions while defending against Omega. Final boss is the Omega Mothership.
- **Assimilation Path**: Assault the combined organic fleet. Fight all four factions. Final boss is a joint organic armada.

---

## 9. Void Corsairs Campaign

### Campaign: "Blood and Profit"

**Premise**: You are Captain Zara "Void" Kessler, owner of one battered ship and a mountain of debt. Build a pirate empire from nothing in a galaxy tearing itself apart. Every faction is a potential client, enemy, or mark. Trust no one, profit from everything.

**Faction Mechanic**: Reputation & Crew System — build notoriety, recruit specialists, leverage fear.

**Starting Fleet**: 1× Ghost-class Infiltrator (Quadjumper), 1× Wraith Strike Fighter (HWK-290)

**Unique Campaign Feature**: Instead of a military command structure, you manage a **Pirate Haven**. Between missions, you visit a space station where you can:
- Visit the **Black Market** (buy/sell upgrades, contraband)
- Visit the **Cantina** (recruit crew, hear rumors, pick up contracts)
- Visit the **Chop Shop** (repair, modify, upgrade ships)
- Visit the **Broker** (accept missions from different factions for pay)

---

#### Mission Highlights (16 Missions)

**M1: "Bottom of the Barrel"** — Tutorial. Ambush a small cargo transport for supplies. Learn basic piracy: disable shields, board, loot, flee before authorities arrive.

**M2: "Debt Collection"** — Your creditor sends enforcers. Fight off bounty hunters to survive. Introduces reputation system — winning earns "Notorious" rank start.

**M3: "The Big Score"** — Rob a Hegemony military transport carrying prototype weapon components. High-value target with heavy escorts. Risk vs reward — more aggressive looting = more reward but higher alert level.

**M4: "Job Offers" (CHOICE)** — Three contracts available. Can only take one:
- **Hegemony Contract**: Hunt a Confederation spy ship. Pay: 500 Credits + Hegemony favor.
- **Confederation Contract**: Smuggle weapons to resistance fighters. Pay: 400 Credits + Confederation favor.
- **Independent Contract**: Raid a Collective data relay. Pay: 300 Credits + Data Cores (research).
- **Consequence**: Your choice determines who trusts you and who hunts you.

**M5: "Reputation Management"** — Word has spread about your crew. Either intimidate a rival pirate gang into joining you (negotiation + show of force) or destroy them (pure combat). Path to "Infamous" reputation.

**M6: "Double Cross"** — A client hires you for a mission that turns out to be a trap. Fight your way out, then decide: hunt down the client for revenge (gain intimidation) or let it go and find out who's really pulling the strings (gain intel).

**M7: "The Pirate King's Throne"** — Challenge the current pirate king for control of the Corsair Haven. A series of trials: racing, combat, cunning. Victory gives you your own base. Ship Tier 2 evolutions unlock.

**M8: "The Shadow War"** — Discover that the Collective has been paying Corsair groups to destabilize organic factions. You're offered a massive payout to join the scheme — or you can expose it to the other factions for reputation.

**M9: "Heist of the Century" (ACT II CLIMAX)** — Break into a Hegemony vault station to steal a priceless artifact. Multi-phase mission: infiltrate, bypass defenses, grab the prize, escape the armada. Most cinematic mission in any campaign.

**M10: "Hunted"** — Your success has made you a target. Every faction sends bounty hunters. Survival mission where you must evade or fight 3 separate hunter teams over 3 days.

**M11: "The Armada"** — Build your pirate fleet. Complete 3 quick raids to recruit ships, then deploy your full fleet for the first time. First use of the Corsair Battleship.

**M12: "The Auction" (CHOICE)** — A neutral auction house is selling a prototype epic ship. You can:
- **Buy it legitimately** (costs 2000 Credits — most of your savings)
- **Steal it** (free, but every faction becomes hostile)
- **Sabotage the auction** and ensure no one gets it (moderate cost, maintain neutral relations)

**M13: "Corsair Armada"** — Deploy your full pirate fleet against a Collective processing center. First epic ship battle. Your Corsair Battleship vs automated defenses.

**M14: "War Profiteer"** — The galaxy is at full-scale war. Sell weapons to everyone, then attack the weakened losers. Three-part mission selling to all sides.

**M15: "The Final Contract"** — The biggest job ever offered: assassinate a faction leader. Choose your target based on campaign relationships. Each target requires different tactics.

**M16: "Blood and Profit" (FINAL)** — Final mission based on your reputation level:
- **Legendary Reputation**: Every pirate in the galaxy rallies to your banner. Lead the combined Corsair armada against whoever your greatest enemy is. You win by being the most feared person in the galaxy.
- **Infamous Reputation**: Standard final battle — powerful but not universal.
- **Notorious Reputation**: You've made too many enemies. Fight alone against multiple factions. The hardest ending.

---

## 10. Ascendant Empire Campaign

### Campaign: "The Awakening"

**Premise**: You are Kai'tharan, a young bio-ship pilot undergoing the Awakening — the Ascendant rite of passage where pilot and ship become one organism. But your Awakening is different. Your psionic abilities are growing beyond anything the Elders have seen. As the galaxy's factions go to war, the Ascendant Empire must decide: evolve to meet the threat, or transcend the conflict entirely.

**Faction Mechanic**: Bio-Evolution & Transcendence — ships physically evolve during battle; psionic abilities grow with experience.

**Starting Fleet**: 2× Symbiont-class Fighter (bio-fighters), 1× Spore-class Bomber (bio-bomber)

**Unique Campaign Feature**: Between missions, you manage **The Nursery** — a living base where ships literally grow. Instead of building ships, you cultivate them. Research is "Guided Evolution" rather than technology. Your base is alive.

---

#### Mission Highlights (16 Missions)

**M1: "First Flight"** — Tutorial. Bond with your bio-ship for the first time. Learn movement, combat, and the bio-regeneration mechanic (heal 1 shield/turn). Hunt prey creatures in a nebula.

**M2: "The Old Enemy"** — Hegemony ships have entered Ascendant space. They see your bio-ships as abominations. Defend the border. Learn psionic coordination (coordinate through obstacles).

**M3: "Harvest"** — Collect bio-materials from a rare space organism to feed the Nursery. The organism fights back. Boss-style encounter against a giant space creature. Introduces bio-evolution triggers (speed evolution from evasion).

**M4: "Contact" (CHOICE)** — The Collective attempts communication in a way no organic faction has experienced — direct neural interface. Choice:
- **Accept Connection**: Download Collective knowledge (massive research boost, but psionic contamination risk)
- **Reject Connection**: Maintain purity (slower research, but unlock Pure Evolution path)

**M5: "The Hive Remembers"** — Ancient bio-ship fossils activate, revealing the Ascendant Empire's true history. They were once linked to the Collective before breaking free millennia ago. This revelation shakes the Empire.

**M6: "Proving Grounds"** — The Elders demand Kai'tharan prove their evolved abilities. A gauntlet of trials testing every bio-evolution trigger. Success unlocks Tier 2 evolutions for all ships.

**M7: "Symbiosis"** — Cultivate a new breed of living ship. Protect the Nursery from Corsair raiders who want to capture and sell bio-tech. Unlocks Tier 2 ships and the Psionic Branch research tree.

**M8: "The Transcendence Vision"** — Kai'tharan experiences a psionic vision of the future: the Collective consuming everything, unless the organic factions unite... or the Ascendant transcend physical limits entirely.

**M9: "Evolution Storm" (ACT II CLIMAX)** — A rare cosmic event accelerates bio-evolution. All ships can evolve mid-battle. Massive battle against combined Hegemony-Corsair raiding force. The player's bio-ships evolve in real-time during combat — the first true showcase of the faction's power.

**M10: "The Withering"** — A Collective virus attacks bio-ships, causing them to degenerate. Some ships lose evolution stages. Race to find a cure while fighting with weakened forces.

**M11: "Assimilation Horror"** — Discover a world where the Collective has assimilated Ascendant bio-tech, creating horrific hybrid drones — living machines. Fight these abominations. Emotional mission — these were once Ascendant ships.

**M12: "The Elder's Choice" (CHOICE)** — The Elders are divided:
- **War Path**: Strike the Collective now with full force. Aggressive, military approach. Align with Hegemony.
- **Transcendence Path**: Accelerate the Transcendence program. Defensive, spiritual approach. Seek understanding.
- Determines Act IV: military climax vs. metaphysical climax.

**M13: "Leviathan Awakens"** — The Ascendant Dreadnought — a living capital ship grown over centuries — awakens for the first time in a millennium. First epic ship battle. The Dreadnought is literally alive, regenerating hull damage and growing new weapons.

**M14: "Gathering of Minds"** — Create a psionic network linking all Ascendant ships. Defend psionic relay points while Kai'tharan meditates. Mixed combat/puzzle mission.

**M15: "The Threshold"** — Push through to the Collective Core (War Path) or reach the Transcendence Gate (Transcendence Path). Three-phase gauntlet with evolved bio-ships at full power.

**M16: "The Awakening" (FINAL)**
- **War Path**: Assault the Collective Core with the full Ascendant armada. Bio-ships vs. machine intelligence. Kai'tharan achieves Cosmic Ascension (Stage 4 Transcendence) during the battle, becoming something beyond mortal.
- **Transcendence Path**: Reach the Transcendence Gate — an ancient artifact from the civilization that seeded all life. Final battle against the Collective attempting to assimilate the Gate. Kai'tharan transcends physical form, communicating with ALL factions simultaneously, offering the galaxy a choice: evolve together or fight forever.

---

## 11. Cross-Campaign Consequences

### How Campaigns Interact

Playing one faction's campaign affects the state of the galaxy for other campaigns.

| Action in Campaign A | Effect on Campaign B |
|----------------------|---------------------|
| Hegemony destroys Corsair base (M7) | Corsair M10 is harder (no safe haven) |
| Confederation allies with Ascendant (M12) | Ascendant M14 has Confederation allies |
| Collective chooses assimilation path (M12) | All other campaigns: Collective enemies are stronger in Act IV |
| Corsairs steal Hegemony prototype (M9) | Hegemony M10 includes damaged fleet (missing prototype) |
| Ascendant transcends (M16) | All subsequent campaigns: Ascendant become neutral; stop attacking |

### Campaign Unlock Order

| Campaign | Unlock Condition | Recommended Order |
|----------|-----------------|-------------------|
| **Terran Hegemony** | Available from start | 1st (tutorial-friendly) |
| **Free Confederation** | Available from start | 2nd (familiar underdog story) |
| **Void Corsairs** | Complete any 1 campaign | 3rd (fun change of pace) |
| **Synthetic Collective** | Complete any 2 campaigns | 4th (alien perspective) |
| **Ascendant Empire** | Complete any 3 campaigns | 5th (most complex, most rewarding) |

### Shared World State

The game tracks a **Galactic State** that persists across all campaigns:

```
GalacticState {
  hegemonySectors: number          // Hegemony-controlled territory
  confederationSectors: number     // Confederation territory
  collectiveNodes: number          // Collective processing centers
  corsairHavens: number            // Corsair hideouts
  ascendantNurseries: number       // Ascendant bio-stations
  warIntensity: number             // 0-100, affects all mission difficulty
  collectiveThreatLevel: number    // Main antagonist progression
  diplomaticRelations: Map<Faction, Map<Faction, number>>  // Faction relationships
}
```

---

## 12. Mission Objective Types

### Complete Objective Catalog

| # | Type | Description | Typical Duration | Faction Affinity |
|---|------|-------------|-----------------|-----------------|
| 1 | **Elimination** | Destroy all enemy ships | 5–15 min | Hegemony, Collective |
| 2 | **Escort** | Protect ships reaching destination | 8–15 min | Confederation |
| 3 | **Infiltration** | Stealth approach; avoid detection | 10–20 min | Corsairs, Collective |
| 4 | **Convoy Raid** | Intercept and disable cargo ships | 5–10 min | Corsairs |
| 5 | **Rescue** | Extract personnel from danger zone | 8–12 min | Confederation |
| 6 | **Patrol** | Navigate checkpoint route | 5–8 min | Hegemony |
| 7 | **Survive** | Endure waves for set duration | 8–15 min | All |
| 8 | **Capture Points** | Control strategic locations | 10–15 min | Hegemony, Corsairs |
| 9 | **Recon** | Scan targets without heavy engagement | 5–10 min | Collective, Corsairs |
| 10 | **Base Assault** | Destroy enemy installations | 10–20 min | Hegemony |
| 11 | **Base Defense** | Protect friendly installations | 10–15 min | Confederation |
| 12 | **Minefield Run** | Navigate hazardous terrain | 3–8 min | Corsairs |
| 13 | **Intel Gathering** | Scan/download data targets | 5–10 min | Collective |
| 14 | **Epic Battle** | Large-scale fleet engagement | 15–25 min | All (Act III+) |
| 15 | **Boss Encounter** | Single powerful enemy | 10–20 min | All |
| 16 | **Heist** | Steal specific target without destroying it | 10–15 min | Corsairs |
| 17 | **Sabotage** | Destroy targets in specific order | 8–12 min | Corsairs, Collective |
| 18 | **Diplomacy** | Combat + negotiation hybrid | 10–15 min | Confederation, Ascendant |
| 19 | **Racing** | Speed-based objective | 3–5 min | Corsairs |
| 20 | **Evolution Trial** | Bio-evolution combat challenges | 8–12 min | Ascendant |
| 21 | **Gauntlet** | Multi-phase sequential battles | 15–25 min | All (Act IV) |
| 22 | **Capture Ship** | Disable (not destroy) specific target | 8–15 min | Corsairs, Collective |

---

## 13. Difficulty & Scaling

### Mission Difficulty Curve

```
Difficulty
  10 │                                          ╱ M16 (Final)
     │                                    ╱────╱
   8 │                              ╱────╱ M15
     │                        ╱────╱
   6 │                  M9╱──╱ M13 (Epic)
     │             ╱────╱╱
   4 │       M5╱──╱  M10 (Setback)
     │   ╱──╱╱
   2 │  ╱ M2
     │╱M1
   0 └─────────────────────────────────────────
     M1  M2  M3  M4  M5  M6  M7  M8  M9  M10 M11 M12 M13 M14 M15 M16
```

### Enemy Composition Scaling

| Mission Range | Enemy Count | Ship Quality | Special Units |
|--------------|------------|-------------|---------------|
| M1–M3 | 2–3 ships | Budget fighters only | None |
| M4–M6 | 3–5 ships | Mixed budget + standard | 1 elite possible |
| M7–M9 | 5–8 ships | Standard + premium | 1–2 elites |
| M10–M12 | 6–10 ships | Premium + elite | Named pilots, support ships |
| M13–M14 | 8–12 ships + epic | Elite + capital | Epic ships enter play |
| M15–M16 | 10–15+ ships + epic | All tiers | Boss units, adaptive AI |

### Player Power Scaling

| Mission Range | Squad Points | Ship Tier | Facilities | Research Level |
|--------------|-------------|-----------|------------|---------------|
| M1–M3 | 60–100 pts | Tier 1 only | None | 0–2 projects |
| M4–M6 | 100–140 pts | Tier 1 + first Tier 2 | Level 1 | 3–5 projects |
| M7–M9 | 140–200 pts | Mixed Tier 1–2 | Level 2 | 6–10 projects |
| M10–M12 | 200–250 pts | Tier 2 + first Tier 3 | Level 3 | 11–18 projects |
| M13–M14 | 250–280 pts | Tier 2–3 + epic | Level 4 | 19–25 projects |
| M15–M16 | 280–300+ pts | All tiers + epic | Max | All core researched |

### Adaptive Difficulty (Optional Setting)

Players can enable adaptive difficulty that adjusts based on performance:

| Player Performance | Adjustment |
|-------------------|------------|
| Won last 3 missions with 0 losses | +1 enemy ship, enemies gain Focus |
| Won last mission with minor losses | No change |
| Won last mission with heavy losses | No change (intended difficulty) |
| Lost last mission | -1 enemy ship, player gets +1 starting focus |
| Lost last 2 missions | -2 enemy ships, bonus resources, hint system activates |

---

## 14. Rewards & Progression

### Per-Mission Reward Structure

```
Base Reward:
  Credits: 100 + (mission_number × 25)
  Primary Resource: 50 + (mission_number × 15)
  XP: 100 + (mission_number × 25)

Performance Bonuses:
  All objectives complete: +50% Credits
  No ships lost: +25% XP
  Speed bonus (under par time): +25% Credits
  Secondary objective: +specific resource reward

Salvage (from combat):
  Per enemy destroyed: 15–50 Credits (based on enemy point value)
  Per enemy disabled (capture): 50–200 Credits + potential ship/tech
  Per data core recovered: 25–100 RP
```

### Ship Unlock Progression

| Unlock Method | Examples |
|---------------|---------|
| **Campaign Mission** | Story-critical ships unlock at specific missions |
| **Research Completion** | New ship classes from tech tree |
| **Evolution** | Existing ships evolve into new forms |
| **Capture** | Disabled enemy ships can be captured and converted |
| **Purchase** | Buy ships with Credits + resources at the fleet management screen |
| **Achievement** | Special ships for completing challenges |

### Pilot Progression

| Level | XP Required | Abilities |
|-------|-------------|-----------|
| **Rookie** | 0 | No special abilities |
| **Regular** | 100 XP | +1 to one stat (player choice) |
| **Veteran** | 300 XP | Unlock specialization tree (Ace/Bomber/Support) |
| **Elite** | 600 XP | +1 to second stat + specialization ability |
| **Ace** | 1000 XP | Unique pilot ability + named callsign |
| **Legend** | 1500 XP | Legendary ability + permanent squad bonus |

### Facility Upgrades

| Facility | Level 1 | Level 2 | Level 3 | Level 4 |
|----------|---------|---------|---------|---------|
| **Hangar** | 6 ship capacity | 9 ships | 12 ships | 16 ships + epic |
| **Workshop** | Repair 2 hull/turn | 4 hull/turn | 6 hull/turn + shield repair | Full repair in 1 turn |
| **Intel Center** | 50 RP/turn | 75 RP/turn | 100 RP/turn + enemy intel | 150 RP/turn + predictive intel |
| **Training** | +10% pilot XP | +25% XP | +50% XP + simulator | +100% XP + instant train |
| **Faction Facility** | Basic ability | Enhanced | Advanced | Ultimate |

### Faction-Specific Facilities

| Faction | Facility | Effect |
|---------|----------|--------|
| **Hegemony** | War Academy | Doctrine slots: 1 → 2 → 3 → 4 doctrines simultaneously |
| **Confederation** | Heroes' Hall | Momentum gain: +25% → +50% → +75% → +100% bonus |
| **Collective** | Processing Core | Active research: 1 → 2 → 3 → 4 simultaneous projects |
| **Corsairs** | Black Market | Discount: 10% → 25% → 40% → 60% on all purchases |
| **Ascendant** | Nursery | Evolution speed: normal → +25% → +50% → instant evolution |

---

## 15. Persistence & Save System

### What Persists Between Missions

```
PersistentCampaignState {
  // Fleet State
  ships: ShipState[]              // Each ship's hull, shields, upgrades, evolution tier
  pilots: PilotState[]            // Each pilot's XP, level, specialization, traits
  reserve: ShipState[]            // Ships not in active squad
  destroyedShips: string[]        // Permanently lost ships (permadeath mode)

  // Strategic State
  credits: number
  resources: Map<ResourceType, number>
  research: ResearchState         // Completed + active projects
  facilities: FacilityState       // Upgrade levels

  // Campaign State
  currentMission: number
  completedMissions: MissionResult[]   // Full history with choices made
  storyFlags: Map<string, boolean>     // Branching choice tracking
  factionReputation: Map<Faction, number>

  // Global State (cross-campaign)
  galacticState: GalacticState
  campaignsCompleted: Faction[]
  achievements: string[]
  unlockedShips: string[]         // Available across all campaigns
}
```

### Save Points

- **Auto-save** after every mission completion
- **Auto-save** after every strategic layer action (research, facility, fleet change)
- **Manual save** available in War Room
- **No save during missions** (roguelike-inspired — commit to your decisions)

### Permadeath Mode (Optional)

- **Normal Mode**: Destroyed ships are repaired for free after mission (hull damage persists, but ship isn't lost)
- **Veteran Mode**: Destroyed ships require Credits to rebuild; pilots survive
- **Ironman Mode**: Destroyed ships and pilots are gone permanently. No manual save. True XCOM experience.

### New Game+

After completing any campaign:
- Start a new faction campaign with all research from previous campaign at 50% discount
- Keep cross-faction ship unlocks
- Keep pilot "Hall of Fame" (legendary pilots available for recruitment)
- Galaxy state reflects previous campaign outcomes
- +1 difficulty tier (enemies are tougher, but you start stronger)

---

## Appendix A: Mission Count Summary

| Campaign | Act I | Act II | Act III | Act IV | Total |
|----------|-------|--------|---------|--------|-------|
| Terran Hegemony | 4 | 5 | 4 | 3 | **16** |
| Free Confederation | 4 | 5 | 4 | 3 | **16** |
| Synthetic Collective | 4 | 5 | 4 | 3 | **16** |
| Void Corsairs | 4 | 5 | 4 | 3 | **16** |
| Ascendant Empire | 4 | 5 | 4 | 3 | **16** |
| **Total** | 20 | 25 | 20 | 15 | **80** |

With branching choices (2 variants at 2 choice points per campaign): **80 base + 20 variant = 100 unique mission experiences**

---

## Appendix B: Complete Ship Evolution Map (Per Campaign)

### Hegemony Ship Progression

```
Mission 1-3:  Talon Fighter → Storm Fighter (start)
Mission 6:    Talon → Raptor Interceptor OR Vanguard Heavy (CHOICE)
Mission 7:    Storm → Tempest Multi-role OR Harbinger Strike (CHOICE)
Mission 8:    Raptor → Phantom Stealth / Vanguard → Aegis Superiority (Tier 2)
Mission 11:   Phantom Stealth Fighter unlocked (if not evolved)
Mission 13:   Hegemony Battlecruiser (epic ship)
Mission 14:   All remaining evolutions available
```

### Confederation Ship Progression

```
Mission 1-3:  Comet Fighter → Ranger Patrol (start)
Mission 3:    Comet → Phoenix Starfighter OR Vortex Interceptor (CHOICE)
Mission 6:    Phoenix → Nova Advanced / Vortex → Thunderbolt (CHOICE)
Mission 7:    Meteor Bomber → Comet Striker OR Tornado Bomber (CHOICE)
Mission 9:    Large ships unlocked: Millennium Transport, Constellation
Mission 13:   Freedom Corvette (epic ship)
Mission 14:   Liberty Command Ship, all evolutions available
```

### Collective Ship Progression

```
Mission 1-3:  Hunter Drones × 5 + Coordinator (start)
Mission 4:    Hunter → Interceptor Drone OR Bomber Drone (CHOICE, faction-wide)
Mission 7:    Guardian Fighter unlocked; Tier 2 evolutions
Mission 9:    Titan Destroyer, Fortress Bomber (heavy units)
Mission 11:   Assimilated ships from capture
Mission 13:   Command Nexus → Collective Mothership (epic ship)
Mission 14:   All drone variants and captured ship types
```

### Corsair Ship Progression

```
Mission 1-3:  Ghost Infiltrator → Wraith Fighter (start)
Mission 3:    Ghost → Dart Scout / Wraith → Scythe Fighter (cheap evolutions)
Mission 5:    Dart → Razor Raider OR Fang Interceptor (CHOICE)
Mission 7:    All mid-tier ships available; Marauder Assault Ship unlock
Mission 9:    Predator Heavy Fighter, Specter Destroyer
Mission 12:   Epic ship acquisition (bought, stolen, or denied)
Mission 13:   Corsair Battleship (if not stolen in M12)
Mission 14:   Full pirate fleet; Pirate Mothership available
```

### Ascendant Ship Progression

```
Mission 1-3:  Symbiont Fighter × 2 + Spore Bomber (start)
Mission 4:    Bio-evolution path set (connected or pure)
Mission 6:    Symbiont → Evolved Interceptor OR Hybrid Heavy (CHOICE)
Mission 7:    Tier 2 bio-ships available through Nursery cultivation
Mission 9:    Real-time evolution showcase; all Tier 2 ships
Mission 11:   Hybrid ships from captured Collective bio-tech
Mission 13:   Ascendant Dreadnought (living epic ship)
Mission 14:   Transcendence-path ships; all evolutions available
```

---

## Appendix C: Cross-Reference to Unity Campaign

| Unity Campaign | Shattered Stars Equivalent | Key Adaptations |
|----------------|---------------------------|-----------------|
| Rebel "Rise of the Rebellion" (12 missions) | **Free Confederation** "Fires of Freedom" (16 missions) | Added strategic layer, research tree, 4 extra missions, branching choices |
| Imperial "Empire's Might" (12 missions, 6 detailed) | **Terran Hegemony** "Iron Mandate" (16 missions) | Fully authored all missions; doctrine system replaces generic template missions |
| Scum "Underworld Rising" (12 missions, 2 detailed) | **Void Corsairs** "Blood and Profit" (16 missions) | Complete rewrite; reputation system, pirate haven, crew mechanics |
| Republic "Clone Wars" (14 missions, 1 detailed) | **Synthetic Collective** "Optimization Protocol" (16 missions) | Total reimagining as AI consciousness narrative; network mechanics |
| Separatist "Droid Revolution" (14 template) | *Merged into Collective campaign* | Separatist concepts absorbed into Collective faction |
| Sequel "The Final Order" (16 template) | **Ascendant Empire** "The Awakening" (16 missions) | Complete original campaign; bio-evolution + transcendence arc |

### What Was Preserved from Unity

- Mission count: 80+ missions (maintained)
- 4-act structure: Kept from `evolution_mechanics.md`
- Objective type variety: 15 Unity types → 22 Shattered Stars types
- Ship unlock progression: Adapted to evolution + research system
- Reward scaling curves: Maintained similar credit/XP progression
- Climax mission pacing: Missions 6, 9, 13, 16 are peak difficulty (matches Unity pattern)

### What Was Added for Shattered Stars

- Full XCOM-style strategic layer between every mission
- 5 faction-specific research trees (30+ nodes each)
- Resource economy with 8 resource types
- Facility upgrade system (5 facilities × 4 levels)
- Branching mission choices (2 per campaign = 10 total branch points)
- Cross-campaign consequence system
- Permadeath modes
- New Game+ with persistent unlocks
- Faction-specific between-mission experiences (War Room, Pirate Haven, Network, Nursery)
- 22 mission objective types (up from 15)
- Pilot progression system (6 levels with specializations)
- Adaptive difficulty system

---

*Document generated for Shattered Stars: The Galactic Schism. All faction names, lore, ship names, and campaign narratives are original IP. Game mechanics are inspired by the X-Wing Miniatures tabletop system as implemented in the Unity X-Wing Arcade codebase, with significant expansion for the XCOM/StarCraft strategic layer.*
