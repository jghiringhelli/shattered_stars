# Faction Progression & Unlock Systems
## **Deep Progression Mechanics Inspired by Tactical Disciples**

---

## **MULTI-LAYERED PROGRESSION PHILOSOPHY**

### **Three Pillars of Advancement**
1. **Ship Evolution:** Individual ships gain experience and evolve
2. **Faction Mastery:** Player expertise with faction tactics and doctrine
3. **Pilot Development:** Personal pilot skills and relationships

*Each system reinforces the others to create meaningful long-term progression*

---

## **FACTION MASTERY PROGRESSION**

### **Faction Reputation System**
```python
class FactionReputation:
    def __init__(self):
        self.reputation_levels = {
            'recruit': 0,
            'regular': 100,
            'veteran': 300,
            'elite': 600,
            'champion': 1000,
            'legend': 1500
        }
        
        self.reputation_bonuses = {
            'regular': ['basic_faction_ability'],
            'veteran': ['enhanced_faction_ability', 'exclusive_pilots'],
            'elite': ['advanced_ships', 'faction_synergies'],
            'champion': ['legendary_pilots', 'unique_modifications'],
            'legend': ['faction_mastery', 'cross_faction_hybrids']
        }
```

### **Terran Hegemony Mastery Path**
```
Recruit (0 XP) → Basic formation flying tutorial
├── Regular (100 XP) → Formation Discipline ability unlocked
│   └── Unlock: Talon Fighter evolution choices
├── Veteran (300 XP) → Tactical Coordination enhanced
│   └── Unlock: Named pilots (Admiral Thrace, Commander Steel)
├── Elite (600 XP) → Advanced capital ships available
│   └── Unlock: Aegis Superiority Fighter, Command abilities
├── Champion (1000 XP) → Legendary pilots unlocked
│   └── Unlock: Fleet Admiral Kronos, unique formations
└── Legend (1500 XP) → Faction mastery achieved
    └── Unlock: Hybrid tech from captured enemy ships
```

**Hegemony-Specific Unlocks:**
- **Formation Doctrines:** Unlock specialized formation bonuses
- **Military Ranks:** Cosmetic progression with tactical benefits
- **Fleet Command:** Ability to command Epic ships in battle
- **Cross-Training:** Access to select ships from allied factions

### **Free Confederation Mastery Path**
```
Recruit → Learn basic ship diversity
├── Regular → Heroic Inspiration ability
├── Veteran → Adaptive Systems enhanced
├── Elite → Access to legendary freighters
├── Champion → Hero pilot recruitment
└── Legend → Freedom Fighter legacy unlocks
```

**Confederation-Specific Unlocks:**
- **Heroic Pilots:** Unlock famous ace pilots with unique abilities
- **Ship Modifications:** Enhanced customization options
- **Resistance Cells:** Access to hidden ship variants
- **Liberty Arsenal:** Unlock prototype and experimental ships

### **Synthetic Collective Mastery Path**
```
Recruit → Basic networking protocols
├── Regular → Network Protocol efficiency
├── Veteran → Swarm coordination bonuses
├── Elite → Advanced AI ship variants
├── Champion → Collective consciousness abilities
└── Legend → Technological singularity unlocks
```

**Collective-Specific Unlocks:**
- **AI Protocols:** Enhanced calculate and coordinate abilities
- **Drone Variants:** Access to specialized drone configurations
- **Network Nodes:** Ability to field multiple command ships
- **Tech Assimilation:** Learn abilities from defeated enemy ships

### **Void Corsairs Mastery Path**
```
Recruit → Basic piracy and raiding
├── Regular → Dirty Fighting bonuses
├── Veteran → Black market access
├── Elite → Notorious pirate ships
├── Champion → Legendary captains
└── Legend → Pirate king/queen status
```

**Corsairs-Specific Unlocks:**
- **Pirate Codes:** Access to unique raider tactics
- **Black Market:** Illegal upgrade combinations
- **Notorious Ships:** Famous pirate vessels with unique abilities
- **Crew Recruitment:** Hire specialists with unique bonuses

### **Ascendant Empire Mastery Path**
```
Recruit → Basic bio-tech integration
├── Regular → Bio-Regeneration abilities
├── Veteran → Psionic coordination
├── Elite → Advanced evolution chambers
├── Champion → Transcendent beings
└── Legend → Evolutionary perfection
```

**Empire-Specific Unlocks:**
- **Evolution Chambers:** Enhanced ship modification options
- **Psionic Abilities:** Mental coordination and prediction
- **Bio-Integration:** Living ship variants with regeneration
- **Transcendence:** Access to ultimate evolved ship forms

---

## **PILOT DEVELOPMENT SYSTEM**

### **Individual Pilot Progression**
```python
class Pilot:
    def __init__(self, name, faction, ship_preference):
        self.name = name
        self.faction = faction
        self.pilot_skill = 1  # 1-9 scale
        self.experience = 0
        self.ship_preference = ship_preference
        self.specializations = []
        self.traits = []
        self.relationships = {}  # with other pilots
        self.medal_count = 0
        
    def gain_experience(self, mission_performance):
        """Pilots gain XP based on mission performance"""
        base_xp = mission_performance['survival_time'] * 2
        bonus_xp = mission_performance['kills'] * 10
        objective_xp = mission_performance['objectives'] * 15
        
        self.experience += base_xp + bonus_xp + objective_xp
        
        # Check for skill increase
        if self.experience >= self.skill_up_requirement():
            self.pilot_skill += 1
            self.unlock_new_abilities()
```

### **Pilot Specialization Trees**
**Each pilot can specialize in different combat roles:**

**Ace Pilot (Fighter Specialist)**
```
Novice → Veteran Fighter → Ace → Squadron Leader → Wing Commander
├── Dogfighting Expert (+1 attack vs fighters)
├── Evasive Maneuvers (+1 defense when stressed)
├── Squadron Tactics (coordinate bonus to fighters)
└── Legendary Ace (unique pilot ability)
```

**Bomber Specialist**
```
Bombardier → Strike Pilot → Siege Expert → Strategic Commander
├── Precision Bombing (+1 damage to large ships)
├── Ordinance Expert (reload actions don't cause stress)
├── Target Coordinator (share locks with bombers)
└── Devastation Master (area effect bonuses)
```

**Support Specialist**
```
Transport Pilot → Support Expert → Fleet Coordinator → Admiral
├── Defensive Flying (+1 defense to nearby allies)
├── Repair Protocols (heal nearby ships)
├── Fleet Coordination (enhanced coordinate range)
└── Command Presence (faction-wide bonuses)
```

### **Pilot Relationships & Squadron Dynamics**
```python
class SquadronBonuses:
    def __init__(self):
        self.relationship_bonuses = {
            'wingmen': '+1 attack when at Range 1',
            'rivals': '+1 defense against each other',
            'mentors': 'Apprentice gains +1 pilot skill',
            'veterans': 'Formation flying bonuses',
            'heroes': 'Inspiration aura affects all allies'
        }
    
    def develop_relationships(self, pilot_a, pilot_b, missions_together):
        """Pilots develop relationships through shared combat"""
        if missions_together >= 5:
            relationship = self.determine_relationship(pilot_a, pilot_b)
            pilot_a.relationships[pilot_b.name] = relationship
            pilot_b.relationships[pilot_a.name] = relationship
```

**Relationship Examples:**
- **Darius "Blade" Chen & Maya "Phoenix" Rodriguez:** Wingmen (+1 attack when within Range 1)
- **Admiral Sarah Kronos & Lieutenant Jake "Rookie" Taylor:** Mentor/Student (Rookie gains +1 PS when near Admiral)
- **Captain Rex "Iron Wolf" & Commander Vex "Shadow":** Friendly Rivals (+1 defense when engaging each other)

---

## **SHIP MASTERY & SPECIALIZATION**

### **Ship-Specific Experience**
```python
class ShipMastery:
    def __init__(self, ship_type):
        self.ship_type = ship_type
        self.flight_hours = 0
        self.combat_missions = 0
        self.kills = 0
        self.mastery_level = 'novice'
        self.unlocked_modifications = []
        
    def mastery_levels(self):
        return {
            'novice': (0, 'Basic ship operation'),
            'competent': (50, 'Efficiency bonuses unlock'),
            'veteran': (150, 'Advanced modifications available'),
            'expert': (300, 'Custom loadout options'),
            'master': (500, 'Unique ship abilities unlock'),
            'legendary': (1000, 'Ship becomes named/legendary variant')
        }
```

### **Ship Mastery Bonuses by Type**

**Fighter Mastery (X-Wing/Phoenix Starfighter)**
```
Novice → +0 bonuses (baseline performance)
├── Competent → +1 accuracy with primary weapons
├── Veteran → Free barrel roll action once per turn
├── Expert → Can equip dual torpedo loadouts
├── Master → "Phoenix Squadron" ability - inspire nearby allies
└── Legendary → "Hero's Wings" - unique named ship with legacy bonuses
```

**Interceptor Mastery (A-Wing/Vortex Interceptor)**
```
Novice → Standard agility
├── Competent → +1 defense when at Range 3+
├── Veteran → Free boost action after attack
├── Expert → Can perform red maneuvers without stress
├── Master → "Lightning Strike" - double tap attacks
└── Legendary → "Ace's Ride" - maximum pilot skill, unique maneuvers
```

**Bomber Mastery (Y-Wing/Meteor Bomber)**
```
Novice → Basic bombing capability
├── Competent → +1 damage against large ships
├── Veteran → Can reload ordnance without stress
├── Expert → Cluster bomb effects (damage multiple targets)
├── Master → "Siege Breaker" - ignore shields on first attack
└── Legendary → "Flying Fortress" - enhanced durability and firepower
```

### **Custom Ship Variants**
**When pilots reach Master level with a ship, they unlock custom variants:**

**"Blade's Fury" (Darius Chen's Custom Phoenix Fighter)**
- **Base:** Phoenix Starfighter stats
- **Custom Modifications:** +1 Hull, Quad Laser Cannons, Veteran Paint Scheme
- **Unique Ability:** "Blade's Edge" - critical hits cause additional stress to target
- **Visual:** Custom red/black paint scheme with ace markings

**"Iron Wolf's Fang" (Rex's Custom Razor Raider)**
- **Base:** Razor-class Raider stats  
- **Custom Modifications:** Reinforced Hull, Stealth Coating, Trophy Racks
- **Unique Ability:** "Wolf Pack" - gains bonuses when near other Corsair ships
- **Visual:** Battle-scarred with wolf emblems and kill tallies

---

## **CROSS-FACTION PROGRESSION**

### **Faction Diplomacy System**
```python
class FactionDiplomacy:
    def __init__(self):
        self.faction_relationships = {
            'terran_hegemony': {
                'free_confederation': 'hostile',
                'synthetic_collective': 'neutral',
                'void_corsairs': 'hostile',
                'ascendant_empire': 'rival'
            }
            # ... other faction relationships
        }
        
        self.diplomatic_unlocks = {
            'neutral': ['limited_trade', 'ceasefire_missions'],
            'friendly': ['ship_exchange', 'joint_operations'],
            'allied': ['shared_technology', 'cross_training']
        }
```

### **Captured Ship Integration**
**Players can capture and integrate enemy ships through special missions:**

**Capture Mechanics:**
- **Ion Disable:** Use ion weapons to disable rather than destroy
- **Boarding Actions:** Special assault shuttle missions
- **Defection Events:** Enemy pilots switch sides during campaign
- **Salvage Operations:** Rebuild ships from battlefield wreckage

**Integration Process:**
1. **Capture:** Successfully disable and recover enemy ship
2. **Analysis:** Spend resources to understand alien technology
3. **Adaptation:** Modify ship systems for faction compatibility
4. **Training:** Pilots must learn to operate foreign systems
5. **Integration:** Ship becomes available with modified stats

**Example Captured Ship:**
**"Liberated Hunter" (Confederation-operated Drone)**
- **Original:** Synthetic Collective Hunter Drone
- **Modifications:** Removed AI, added human pilot interface
- **New Stats:** +1 Hull (pilot life support), -1 Agility (less precise)
- **Special:** Retains "Calculate" action but pilot can also "Focus"

---

## **ACHIEVEMENT & MILESTONE SYSTEM**

### **Campaign Achievements**
**Major milestones that unlock significant content:**

**Faction-Neutral Achievements:**
- **"First Blood":** Win first combat mission → Unlock basic ship modifications
- **"Ace in a Day":** 5 kills in single mission → Unlock ace pilot recruitment
- **"Fleet Commander":** Successfully command Epic ship → Unlock fleet battle mode
- **"Legendary Pilot":** Reach Pilot Skill 9 → Unlock legendary ship variants

**Faction-Specific Achievements:**

**Terran Hegemony:**
- **"Perfect Formation":** Complete mission with no friendly casualties → Unlock Elite Formation protocols
- **"Order Through Unity":** Win 10 missions using only formation tactics → Unlock Admiral rank

**Free Confederation:**
- **"Against All Odds":** Win battle while outnumbered 3:1 → Unlock Hero's Inspiration ability
- **"Freedom Fighter":** Liberate 5 systems from enemy control → Unlock Resistance cell ships

**Synthetic Collective:**
- **"Hive Mind":** Coordinate 20 actions in single battle → Unlock Advanced Network Protocols
- **"Digital Evolution":** Evolve 10 different ship types → Unlock AI Transcendence tree

**Void Corsairs:**
- **"Pirate King":** Successfully raid 15 enemy convoys → Unlock Notorious reputation bonuses
- **"Honor Among Thieves":** Complete 5 missions without friendly fire → Unlock Crew Loyalty bonuses

**Ascendant Empire:**
- **"Bio-Perfect":** Regenerate 100 total hull points → Unlock Enhanced Regeneration chambers
- **"Psionic Master":** Coordinate through obstacles 25 times → Unlock Mind Link network

### **Legacy Progression**
**Achievements and pilot accomplishments carry forward between campaigns:**

**Pilot Hall of Fame:**
- **Legendary pilots** become available for recruitment in future campaigns
- **Custom ships** designed by master pilots become available
- **Faction doctrines** developed by players influence AI behavior

**Technological Heritage:**
- **Research unlocks** from one campaign carry to the next
- **Ship modifications** discovered remain available
- **Diplomatic relationships** influence starting conditions

This deep progression system ensures that every mission, every pilot, and every ship evolution feels meaningful. Players develop genuine attachment to their pilots and ships while working toward long-term faction mastery goals. The cross-faction elements add strategic depth, while the legacy system encourages multiple playthroughs with different factions and approaches.
