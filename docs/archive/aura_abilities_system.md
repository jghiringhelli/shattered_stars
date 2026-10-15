# Aura-Based Abilities & Advanced Differentiation
## **Passive Area Effects & Faction-Unique Mechanics**

---

## **AURA SYSTEM PHILOSOPHY**

### **Three Types of Auras**
1. **Command Auras:** Leadership effects from elite pilots and command ships
2. **Technology Auras:** Passive effects from advanced ship systems
3. **Psychic/Bio Auras:** Supernatural effects from evolved beings or AI networks

### **Aura Mechanics**
- **Range-Based:** Effects at Range 1, Range 1-2, or Range 1-3
- **Line-of-Sight:** Some require clear line of sight, others work through obstacles
- **Stacking Rules:** Multiple auras can stack or override each other
- **Power Scaling:** Aura strength increases with ship evolution level

---

## **FACTION-SPECIFIC AURA ABILITIES**

### **TERRAN HEGEMONY - "Command Presence"**
*Military discipline and coordinated tactics*

**Formation Command Aura** *(Command Ships)*
- **Range:** 1-2
- **Effect:** Friendly ships gain +1 defense when 2+ ships in formation
- **Enhanced:** At Champion rank, also grants +1 attack to formation attacks
- **Visual:** Tactical overlay showing formation bonds between ships

**Discipline Field** *(Elite Fighters)*
- **Range:** 1
- **Effect:** Friendly ships cannot be stressed by enemy abilities
- **Enhanced:** At Legend rank, grants immunity to jam and ion effects
- **Visual:** Blue energy field connecting disciplined ships

**Shield Harmonics** *(Shield-Tech Ships)*
- **Range:** 1
- **Effect:** When this ship recovers shields, all ships in aura recover 1 shield
- **Enhanced:** With advanced tech, triggers when any ship in aura recovers shields
- **Visual:** Synchronized shield pulse effects

**Example Implementation:**
```
Admiral Kronos (Legendary Pilot):
- Command Presence: All ships at Range 1-3 gain +1 pilot skill
- Formation Master: Ships in formation gain +1 attack and defense
- Tactical Genius: Can coordinate unlimited times per turn
```

### **FREE CONFEDERATION - "Inspirational Leadership"**
*Heroic example and adaptive tactics*

**Hero's Inspiration** *(Named Pilots)*
- **Range:** 1-2  
- **Effect:** When this ship is damaged, all ships in aura gain +1 attack until end of turn
- **Enhanced:** At Elite level, also grants +1 defense to inspired ships
- **Visual:** Golden energy radiating from hero ship to allies

**Adaptive Field** *(Modified Ships)*
- **Range:** 1
- **Effect:** Ships in aura can change 1 upgrade between rounds
- **Enhanced:** With jury-rigged systems, can swap actions as well
- **Visual:** Holographic modification interfaces around ships

**Liberty Beacon** *(Freedom Fighter Ships)*
- **Range:** 1-3
- **Effect:** Enemy ships in aura suffer -1 attack (represents demoralization)
- **Enhanced:** At Champion level, also prevents enemy coordinate actions
- **Visual:** Bright beacon light that dims enemy weapon effects

**Example Implementation:**
```
Luke "Phoenix" Skywalker (Legendary Hero):
- Inspiration Aura: Damaged allies at Range 1-2 gain +1 attack/defense
- Never Give Up: When reduced to 1 hull, all allies gain heroic bonuses
- Force Guidance: Can grant focus tokens to allies through obstacles
```

### **SYNTHETIC COLLECTIVE - "Network Integration"**
*AI coordination and digital battlefield control*

**Network Node** *(AI Command Ships)*
- **Range:** 1-3
- **Effect:** All drones in aura share target locks and calculate tokens
- **Enhanced:** At Master level, sharing ignores range and obstacles
- **Visual:** Data streams connecting all networked ships

**Processing Field** *(Advanced AI)*
- **Range:** 1-2
- **Effect:** Ships in aura use calculate instead of focus, gain +1 efficiency
- **Enhanced:** With quantum processing, can calculate multiple dice
- **Visual:** Holographic data analysis overlays on all ships

**Swarm Protocol** *(Collective Ships)*
- **Range:** 1
- **Effect:** +1 attack for each other collective ship in aura (max +3)
- **Enhanced:** At Legend level, also grants coordinate actions
- **Visual:** Synchronized movement indicators between swarming ships

**Auto-Repair Field** *(Maintenance Drones)*
- **Range:** 1
- **Effect:** At start of turn, all ships in aura heal 1 hull if not at maximum
- **Enhanced:** With advanced protocols, also removes stress
- **Visual:** Repair nanobots visibly moving between ships

**Example Implementation:**
```
Prime Collective Node (AI Overmind):
- Hive Mind: All collective ships share all tokens and targeting data
- Swarm Coordination: Grants coordinate to all ships at unlimited range
- Digital Ascension: Network grows stronger with each connected ship
```

### **VOID CORSAIRS - "Intimidation & Chaos"**
*Fear tactics and unpredictable effects*

**Terror Field** *(Notorious Ships)*
- **Range:** 1-2
- **Effect:** Enemy ships in aura get -1 pilot skill (minimum 1)
- **Enhanced:** At Legendary level, enemies also lose actions when stressed
- **Visual:** Dark energy field with skull/pirate imagery

**Predator Instinct** *(Hunter Ships)*
- **Range:** 1
- **Effect:** +1 attack against damaged enemies in aura
- **Enhanced:** With veteran experience, also grants critical hit bonuses
- **Visual:** Red targeting indicators highlighting wounded prey

**Chaos Field** *(Experimental Tech)*
- **Range:** 1-2
- **Effect:** All ships in aura (including enemies) reroll 1 die per attack
- **Enhanced:** With black market tech, pilot chooses which die to reroll
- **Visual:** Chaotic energy distortions affecting all weapons

**Salvage Aura** *(Scavenger Ships)*
- **Range:** 1
- **Effect:** When enemy ship destroyed in aura, gain 1 resource token
- **Enhanced:** At Master level, also grants temporary upgrade slots
- **Visual:** Scavenging drones automatically collecting debris

**Example Implementation:**
```
Captain "Deathmark" Vex (Pirate Lord):
- Infamous Reputation: Enemies at Range 1-3 suffer -1 attack from fear
- Scavenger Fleet: Gains resources when enemies destroyed nearby
- Dirty Fighting: All allies gain critical hit bonuses against intimidated foes
```

### **ASCENDANT EMPIRE - "Psychic Resonance & Bio-Symbiosis"**
*Mental coordination and living ship networks*

**Psionic Link** *(Mind Ships)*
- **Range:** Unlimited (ignores obstacles)
- **Effect:** Can coordinate with any ship in psionic network
- **Enhanced:** At Transcendent level, grants telepathic communication
- **Visual:** Ethereal mental connections visible between linked minds

**Bio-Resonance** *(Living Ships)*
- **Range:** 1-2
- **Effect:** When any bio-ship in aura heals, all bio-ships heal 1 point
- **Enhanced:** With perfect symbiosis, healing spreads to non-bio allies
- **Visual:** Organic energy pulses spreading between living vessels

**Evolution Field** *(Mutation Ships)*
- **Range:** 1
- **Effect:** Ships in aura can adapt - gain +1 to any stat for 1 turn (once per round)
- **Enhanced:** With bio-mastery, adaptation becomes permanent until changed
- **Visual:** Evolutionary energy causing visible ship modifications

**Transcendence Aura** *(Ascended Beings)*
- **Range:** 1-3
- **Effect:** Ships in aura ignore the first damage dealt each turn
- **Enhanced:** At Godlike level, also regenerates shields and hull
- **Visual:** Divine/cosmic energy surrounding transcendent beings

**Example Implementation:**
```
Archon Zael'thar (Ascended Entity):
- Cosmic Awareness: All empire ships share targeting through space/time
- Bio-Perfect Form: Aura grants regeneration and adaptation to all allies
- Psionic Mastery: Can control enemy ships temporarily through mental domination
```

---

## **AURA-BASED UPGRADE SYSTEM**

### **Command Modules** *(Hegemony Exclusive)*
**Admiral's Bridge** - 8 points
- **Aura:** Command Presence (Range 1-2)
- **Effect:** +1 pilot skill to all friendly ships in aura
- **Upgrade:** Can coordinate as free action once per turn

**Tactical Computer** - 6 points  
- **Aura:** Formation Analysis (Range 1)
- **Effect:** Ships in formation gain +1 attack when targeting same enemy
- **Upgrade:** Shares target locks across formation

**Fleet Beacon** - 4 points
- **Aura:** Rally Point (Range 1-3)
- **Effect:** Destroyed ships respawn at beacon location
- **Upgrade:** Can relocate beacon once per game

### **Inspiration Systems** *(Confederation Exclusive)*
**Hero's Legacy** - 7 points
- **Aura:** Inspirational Example (Range 1-2)  
- **Effect:** When ship performs heroic action, allies gain focus tokens
- **Upgrade:** Heroic actions grant double benefits

**Freedom Fighter** - 5 points
- **Aura:** Liberation Field (Range 1-2)
- **Effect:** Enemies suffer -1 attack against ships fighting for freedom
- **Upgrade:** Immune to fear and intimidation effects

**Adaptive Core** - 6 points
- **Aura:** Modification Field (Range 1)
- **Effect:** Can swap one upgrade per turn for ships in aura
- **Upgrade:** Swapping doesn't cost actions

### **Network Protocols** *(Collective Exclusive)*
**Hive Node** - 8 points
- **Aura:** Data Sharing (Range 1-3)
- **Effect:** All ships share calculate tokens and target locks
- **Upgrade:** Can coordinate through network without actions

**Processing Matrix** - 6 points
- **Aura:** Enhanced Calculation (Range 1-2)
- **Effect:** Calculate action affects 2 dice instead of 1
- **Upgrade:** Can calculate for other ships in network

**Repair Protocol** - 5 points
- **Aura:** Maintenance Field (Range 1)
- **Effect:** Heal 1 hull per turn to ships in aura
- **Upgrade:** Also removes negative status effects

### **Black Market Tech** *(Corsairs Exclusive)*
**Intimidation Array** - 7 points
- **Aura:** Fear Field (Range 1-2)
- **Effect:** Enemies in aura suffer -1 pilot skill
- **Upgrade:** Stressed enemies lose additional actions

**Chaos Generator** - 6 points  
- **Aura:** Disruption Field (Range 1-2)
- **Effect:** All ships in aura reroll 1 die per action
- **Upgrade:** Choose which dice to reroll

**Salvage Drones** - 4 points
- **Aura:** Resource Collection (Range 1)
- **Effect:** Gain resources when enemies destroyed in aura
- **Upgrade:** Can instantly install salvaged components

### **Bio-Enhancements** *(Empire Exclusive)*
**Psionic Amplifier** - 9 points
- **Aura:** Mind Link (Unlimited Range)
- **Effect:** Coordinate actions ignore range and obstacles
- **Upgrade:** Can affect enemy ships with mental domination

**Symbiosis Core** - 7 points
- **Aura:** Bio-Resonance (Range 1-2)
- **Effect:** Healing spreads to all bio-ships in aura
- **Upgrade:** Non-bio ships can benefit from bio-effects

**Evolution Chamber** - 8 points
- **Aura:** Adaptation Field (Range 1)
- **Effect:** Ships can temporarily modify stats once per turn
- **Upgrade:** Modifications can become permanent

---

## **ADVANCED DIFFERENTIATION MECHANICS**

### **Faction-Specific Resource Systems**

**Terran Hegemony: Command Points**
- **Generation:** Gain 1 CP per turn for each command ship
- **Usage:** Spend CP for formation bonuses, coordinated attacks, defensive formations
- **Elite Ability:** "Strategic Reserve" - spend 5 CP to instantly redeploy destroyed ship

**Free Confederation: Inspiration Tokens**
- **Generation:** Gain tokens when ships perform heroic actions or survive against odds
- **Usage:** Spend for temporary stat boosts, emergency actions, pilot abilities
- **Elite Ability:** "Never Give Up" - spend 3 tokens to prevent ship destruction

**Synthetic Collective: Processing Power**
- **Generation:** Gain PP based on number of networked ships and successful calculations
- **Usage:** Spend for enhanced AI abilities, swarm coordination, auto-repairs
- **Elite Ability:** "Digital Ascension" - spend 10 PP to evolve ship mid-battle

**Void Corsairs: Reputation Points**
- **Generation:** Gain RP for successful raids, intimidation, and dirty fighting
- **Usage:** Spend for black market upgrades, crew recruitment, special abilities
- **Elite Ability:** "Notorious" - spend 7 RP to cause all enemies to flee in terror

**Ascendant Empire: Evolution Energy**
- **Generation:** Gain EE through bio-regeneration, psionic coordination, transcendence
- **Usage:** Spend for bio-modifications, psionic powers, evolutionary leaps
- **Elite Ability:** "Transcendence" - spend 12 EE to ascend beyond physical limitations

### **Environmental Interactions**

**Faction-Specific Environmental Bonuses:**

**Hegemony in Civilized Space:**
- +1 defense near space stations (military protection)
- Can request reinforcements from nearby imperial fleets
- Repair facilities restore ships faster

**Confederation in Rebel Bases:**
- +1 attack when defending freedom (moral bonus)
- Hidden supply caches provide emergency repairs
- Local support provides intel bonuses

**Collective in Tech-Rich Areas:**
- +1 processing power near computer systems
- Can hack enemy ships and stations
- Technology absorption from destroyed foes

**Corsairs in Lawless Regions:**
- +1 agility in asteroid fields and debris (familiar territory)
- Can use environmental hazards as weapons
- Hidden pirate bases provide safe harbor

**Empire in Psychic Phenomena:**
- +1 to all stats near psionic anomalies
- Can manipulate space-time for tactical advantage
- Transcendent beings ignore physical laws

### **Dynamic Faction Abilities**

**Scaling Powers Based on Battle Conditions:**

**Hegemony Formation Bonuses:**
- 2 ships: +1 defense
- 3-4 ships: +1 attack and defense
- 5+ ships: +1 attack, defense, and pilot skill

**Confederation Heroic Escalation:**
- Outnumbered 2:1: +1 attack
- Outnumbered 3:1: +1 attack and defense  
- Outnumbered 4:1: +2 attack, defense, and additional actions

**Collective Network Growth:**
- 3+ networked: Share basic tokens
- 5+ networked: Share all abilities
- 7+ networked: Gain hive mind consciousness

**Corsair Intimidation Levels:**
- 1 reputation: Enemies -1 pilot skill
- 3 reputation: Enemies also lose actions when stressed
- 5 reputation: Enemies may flee automatically

**Empire Transcendence Stages:**
- Bio-integration: Regeneration abilities
- Psionic awakening: Mental coordination
- Digital fusion: AI-biological hybrid
- Cosmic ascension: Reality manipulation

This aura system adds a strategic layer where ship positioning becomes crucial, faction identity is reinforced through unique mechanics, and battles become more dynamic and interactive. Players must consider not just individual ship capabilities, but how their fleet works together through these passive effects.
