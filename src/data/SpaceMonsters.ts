/**
 * Space Monsters & Creature Encounters
 *
 * Non-faction entities that serve as environmental hazards, boss encounters,
 * or special campaign events. Designed for variety and unique gameplay.
 *
 * Monster Categories:
 * 1. Swarm Creatures - Many weak units with overwhelming numbers
 * 2. Leviathans - Massive singular boss encounters
 * 3. Parasites - Debuff-focused creatures that disable ships
 * 4. Void Entities - Reality-warping anomalies
 * 5. Hive Minds - Spawners that create smaller units
 */

// ============================================
// Types
// ============================================

export type MonsterCategory =
  "swarm" | "leviathan" | "parasite" | "void_entity" | "hive_mind";
export type MonsterSize =
  "tiny" | "small" | "medium" | "large" | "huge" | "colossal" | "titan";

export interface MonsterAbility {
  id: string;
  name: string;
  description: string;
  cooldown: number; // Turns between uses
  effect: MonsterEffectType;
  damage?: number;
  range?: number;
  duration?: number;
  spawnCount?: number;
}

export type MonsterEffectType =
  | "damage_aoe" // Area damage
  | "disable_weapons" // Temporarily disable target weapons
  | "disable_shields" // Strip shields
  | "pull" // Pull ships toward monster
  | "push" // Push ships away
  | "spawn_minions" // Create smaller creatures
  | "regenerate" // Heal over time
  | "phaseshift" // Become untargetable briefly
  | "corruption" // Apply stacking debuff
  | "devour" // Instant kill small ships
  | "swarm_buff" // Buff nearby allies
  | "emp" // Disable all systems briefly
  | "gravity_well" // Slow all ships in area
  | "void_rift" // Create damaging zone
  | "psionic_blast" // Damage + stress
  | "bio_acid"; // Damage over time;

export interface MonsterSection {
  id: string;
  name: string;
  hull: number;
  maxHull: number;
  isDisabled: boolean;
  offsetX: number;
  offsetY: number;
  abilities: string[]; // Ability IDs this section enables
}

export interface MonsterDefinition {
  id: string;
  name: string;
  category: MonsterCategory;
  size: MonsterSize;

  // Lore
  description: string;
  origin: string; // Where it comes from

  // Stats
  hull: number;
  shields: number;
  armor: number; // Damage reduction per hit
  speed: number;
  agility: number;

  // Combat
  attackDice: number;
  abilities: MonsterAbility[];
  sections?: MonsterSection[]; // For multi-part bosses

  // Behavior
  aggression: number; // 0-1: How likely to attack vs patrol
  territorialRange: number; // Pixels - area it defends
  fleeThreshold: number; // HP% to flee (0 = never flees)

  // Rewards
  pointValue: number;
  lootTable?: string[];

  // Spawning
  spawnWeight: number; // Relative spawn frequency
  minWave?: number; // Minimum survival wave to appear
  isBoss: boolean;
}

export interface MonsterSpawnRule {
  monsterId: string;
  weight: number;
  minDifficulty: number;
  maxCount: number;
}

// ============================================
// Monster Size Constants (in pixels)
// ============================================

export const MONSTER_SIZES: Record<MonsterSize, number> = {
  tiny: 16,
  small: 24,
  medium: 48,
  large: 72,
  huge: 96,
  colossal: 160,
  titan: 256,
};

// ============================================
// Monster Definitions
// ============================================

export const MONSTER_DEFINITIONS: Record<string, MonsterDefinition> = {
  // ==========================================
  // SWARM CREATURES
  // Many weak units, attack in groups
  // ==========================================

  void_mite: {
    id: "void_mite",
    name: "Void Mite",
    category: "swarm",
    size: "tiny",
    description:
      "Tiny parasitic creatures that swarm in vast numbers. Individually weak but deadly in packs.",
    origin: "Deep void regions",
    hull: 1,
    shields: 0,
    armor: 0,
    speed: 4,
    agility: 4,
    attackDice: 1,
    abilities: [
      {
        id: "swarm_bite",
        name: "Swarm Bite",
        description: "Basic attack that gains bonus damage near allies",
        cooldown: 0,
        effect: "swarm_buff",
      },
    ],
    aggression: 0.9,
    territorialRange: 200,
    fleeThreshold: 0,
    pointValue: 5,
    spawnWeight: 10,
    isBoss: false,
  },

  scourge_drone: {
    id: "scourge_drone",
    name: "Scourge Drone",
    category: "swarm",
    size: "small",
    description:
      "Biological drones expelled from larger hive creatures. Relentlessly pursue targets.",
    origin: "Hive mind spawns",
    hull: 2,
    shields: 0,
    armor: 0,
    speed: 5,
    agility: 3,
    attackDice: 2,
    abilities: [
      {
        id: "acidic_spray",
        name: "Acidic Spray",
        description: "Corrosive attack that damages over time",
        cooldown: 3,
        effect: "bio_acid",
        damage: 1,
        duration: 3,
      },
    ],
    aggression: 1.0,
    territorialRange: 500,
    fleeThreshold: 0,
    pointValue: 8,
    spawnWeight: 8,
    isBoss: false,
  },

  crystal_swarm: {
    id: "crystal_swarm",
    name: "Crystal Swarm",
    category: "swarm",
    size: "small",
    description:
      "Living crystalline organisms that shatter into smaller pieces when damaged.",
    origin: "Asteroid fields",
    hull: 3,
    shields: 1,
    armor: 1,
    speed: 3,
    agility: 2,
    attackDice: 2,
    abilities: [
      {
        id: "crystal_shatter",
        name: "Crystal Shatter",
        description: "On death, spawns 2 smaller crystal shards",
        cooldown: 0,
        effect: "spawn_minions",
        spawnCount: 2,
      },
    ],
    aggression: 0.5,
    territorialRange: 300,
    fleeThreshold: 0,
    pointValue: 12,
    spawnWeight: 5,
    isBoss: false,
  },

  // ==========================================
  // PARASITES
  // Debuff and disable ships
  // ==========================================

  hull_borer: {
    id: "hull_borer",
    name: "Hull Borer",
    category: "parasite",
    size: "small",
    description:
      "Worm-like creatures that burrow through ship hulls, disabling systems.",
    origin: "Derelict ships",
    hull: 3,
    shields: 0,
    armor: 0,
    speed: 3,
    agility: 4,
    attackDice: 1,
    abilities: [
      {
        id: "system_bore",
        name: "System Bore",
        description: "Disables target weapons for 2 turns",
        cooldown: 4,
        effect: "disable_weapons",
        duration: 2,
      },
    ],
    aggression: 0.7,
    territorialRange: 150,
    fleeThreshold: 0.3,
    pointValue: 15,
    spawnWeight: 6,
    isBoss: false,
  },

  shield_leech: {
    id: "shield_leech",
    name: "Shield Leech",
    category: "parasite",
    size: "medium",
    description: "Energy parasites that drain and absorb shield energy.",
    origin: "Energy nebulae",
    hull: 4,
    shields: 2, // Steals more
    armor: 0,
    speed: 3,
    agility: 3,
    attackDice: 2,
    abilities: [
      {
        id: "shield_drain",
        name: "Shield Drain",
        description: "Strips all shields from target, heals self",
        cooldown: 5,
        effect: "disable_shields",
        range: 150,
      },
      {
        id: "energy_siphon",
        name: "Energy Siphon",
        description: "Passive: Regenerates 1 shield per turn",
        cooldown: 0,
        effect: "regenerate",
      },
    ],
    aggression: 0.8,
    territorialRange: 200,
    fleeThreshold: 0.2,
    pointValue: 20,
    spawnWeight: 4,
    isBoss: false,
  },

  psi_stalker: {
    id: "psi_stalker",
    name: "Psi-Stalker",
    category: "parasite",
    size: "medium",
    description:
      "Psychically attuned predators that induce stress and confusion in pilots.",
    origin: "Unknown dimension",
    hull: 5,
    shields: 2,
    armor: 0,
    speed: 4,
    agility: 3,
    attackDice: 2,
    abilities: [
      {
        id: "mind_shriek",
        name: "Mind Shriek",
        description: "AoE attack that damages and applies stress",
        cooldown: 4,
        effect: "psionic_blast",
        damage: 2,
        range: 200,
      },
    ],
    aggression: 0.6,
    territorialRange: 300,
    fleeThreshold: 0.4,
    pointValue: 25,
    spawnWeight: 3,
    isBoss: false,
  },

  // ==========================================
  // LEVIATHANS
  // Massive singular boss encounters
  // ==========================================

  void_whale: {
    id: "void_whale",
    name: "Void Whale",
    category: "leviathan",
    size: "colossal",
    description:
      "Ancient space-faring creature of immense size. Generally passive unless provoked.",
    origin: "Deep space migration routes",
    hull: 50,
    shields: 10,
    armor: 3,
    speed: 1,
    agility: 0,
    attackDice: 4,
    abilities: [
      {
        id: "gravitational_pull",
        name: "Gravitational Pull",
        description: "Pulls all ships toward it",
        cooldown: 5,
        effect: "pull",
        range: 400,
      },
      {
        id: "bio_regeneration",
        name: "Bio-Regeneration",
        description: "Regenerates 5 hull per turn",
        cooldown: 0,
        effect: "regenerate",
      },
      {
        id: "void_song",
        name: "Void Song",
        description: "AoE that slows all ships in range",
        cooldown: 6,
        effect: "gravity_well",
        range: 300,
        duration: 3,
      },
    ],
    aggression: 0.2,
    territorialRange: 400,
    fleeThreshold: 0.1,
    pointValue: 200,
    spawnWeight: 1,
    minWave: 10,
    isBoss: true,
  },

  star_serpent: {
    id: "star_serpent",
    name: "Star Serpent",
    category: "leviathan",
    size: "titan",
    description:
      "Legendary predator that hunts in stellar corona. Wreathed in plasma fire.",
    origin: "Stellar corona regions",
    hull: 80,
    shields: 20,
    armor: 2,
    speed: 3,
    agility: 1,
    attackDice: 5,
    abilities: [
      {
        id: "plasma_breath",
        name: "Plasma Breath",
        description: "Devastating cone of plasma damage",
        cooldown: 4,
        effect: "damage_aoe",
        damage: 6,
        range: 250,
      },
      {
        id: "coil_strike",
        name: "Coil Strike",
        description: "Rapid strike that can devour small ships",
        cooldown: 6,
        effect: "devour",
        range: 100,
      },
      {
        id: "solar_regeneration",
        name: "Solar Regeneration",
        description: "Regenerates faster near stars",
        cooldown: 0,
        effect: "regenerate",
      },
    ],
    sections: [
      {
        id: "head",
        name: "Head",
        hull: 30,
        maxHull: 30,
        isDisabled: false,
        offsetX: 0,
        offsetY: -80,
        abilities: ["plasma_breath", "coil_strike"],
      },
      {
        id: "body",
        name: "Body",
        hull: 30,
        maxHull: 30,
        isDisabled: false,
        offsetX: 0,
        offsetY: 0,
        abilities: ["solar_regeneration"],
      },
      {
        id: "tail",
        name: "Tail",
        hull: 20,
        maxHull: 20,
        isDisabled: false,
        offsetX: 0,
        offsetY: 80,
        abilities: [],
      },
    ],
    aggression: 0.7,
    territorialRange: 600,
    fleeThreshold: 0,
    pointValue: 500,
    spawnWeight: 0.5,
    minWave: 15,
    isBoss: true,
  },

  kraken_prime: {
    id: "kraken_prime",
    name: "Kraken Prime",
    category: "leviathan",
    size: "titan",
    description:
      "Multi-tentacled horror that can grab and crush ships. Apex predator of the void.",
    origin: "Uncharted space",
    hull: 100,
    shields: 30,
    armor: 4,
    speed: 2,
    agility: 0,
    attackDice: 6,
    abilities: [
      {
        id: "tentacle_grab",
        name: "Tentacle Grab",
        description: "Grabs and immobilizes a ship, dealing damage over time",
        cooldown: 3,
        effect: "pull",
        damage: 3,
        range: 200,
      },
      {
        id: "crushing_embrace",
        name: "Crushing Embrace",
        description: "Deals massive damage to grabbed targets",
        cooldown: 5,
        effect: "damage_aoe",
        damage: 8,
        range: 100,
      },
      {
        id: "ink_cloud",
        name: "Ink Cloud",
        description: "Creates a void zone that disrupts targeting",
        cooldown: 6,
        effect: "void_rift",
        range: 250,
        duration: 4,
      },
    ],
    sections: [
      {
        id: "core",
        name: "Core",
        hull: 40,
        maxHull: 40,
        isDisabled: false,
        offsetX: 0,
        offsetY: 0,
        abilities: ["crushing_embrace"],
      },
      {
        id: "left_tentacles",
        name: "Left Tentacles",
        hull: 30,
        maxHull: 30,
        isDisabled: false,
        offsetX: -60,
        offsetY: 0,
        abilities: ["tentacle_grab"],
      },
      {
        id: "right_tentacles",
        name: "Right Tentacles",
        hull: 30,
        maxHull: 30,
        isDisabled: false,
        offsetX: 60,
        offsetY: 0,
        abilities: ["tentacle_grab"],
      },
    ],
    aggression: 0.9,
    territorialRange: 500,
    fleeThreshold: 0,
    pointValue: 800,
    spawnWeight: 0.3,
    minWave: 20,
    isBoss: true,
  },

  // ==========================================
  // VOID ENTITIES
  // Reality-warping anomalies
  // ==========================================

  rift_specter: {
    id: "rift_specter",
    name: "Rift Specter",
    category: "void_entity",
    size: "medium",
    description:
      "Ghostly entity that phases between dimensions. Attacks are difficult to land.",
    origin: "Dimensional rifts",
    hull: 4,
    shields: 0,
    armor: 0,
    speed: 4,
    agility: 5, // Very hard to hit
    attackDice: 3,
    abilities: [
      {
        id: "phase_shift",
        name: "Phase Shift",
        description: "Becomes untargetable for 2 turns",
        cooldown: 5,
        effect: "phaseshift",
        duration: 2,
      },
      {
        id: "void_touch",
        name: "Void Touch",
        description: "Attack that bypasses shields",
        cooldown: 0,
        effect: "disable_shields",
      },
    ],
    aggression: 0.6,
    territorialRange: 200,
    fleeThreshold: 0.5,
    pointValue: 30,
    spawnWeight: 3,
    isBoss: false,
  },

  entropy_maw: {
    id: "entropy_maw",
    name: "Entropy Maw",
    category: "void_entity",
    size: "large",
    description:
      "Living black hole that consumes matter and energy. Grows stronger as it feeds.",
    origin: "Spacetime anomalies",
    hull: 20,
    shields: 0, // No shields, just absorbs
    armor: 5, // Hard to damage
    speed: 1,
    agility: 0,
    attackDice: 0, // Doesn't attack normally
    abilities: [
      {
        id: "gravitational_maw",
        name: "Gravitational Maw",
        description: "Constantly pulls all ships toward it",
        cooldown: 0,
        effect: "gravity_well",
        range: 350,
      },
      {
        id: "consume",
        name: "Consume",
        description: "Devours ships that get too close, instant kill",
        cooldown: 0,
        effect: "devour",
        range: 50,
      },
      {
        id: "growth",
        name: "Growth",
        description: "Gains 2 hull for each ship consumed",
        cooldown: 0,
        effect: "regenerate",
      },
    ],
    aggression: 0, // Doesn't chase, just exists
    territorialRange: 350,
    fleeThreshold: 0,
    pointValue: 100,
    spawnWeight: 1,
    minWave: 12,
    isBoss: true,
  },

  null_herald: {
    id: "null_herald",
    name: "Null Herald",
    category: "void_entity",
    size: "huge",
    description:
      "Harbinger of dimensional collapse. Its presence corrupts reality.",
    origin: "Beyond known space",
    hull: 35,
    shields: 15,
    armor: 2,
    speed: 2,
    agility: 1,
    attackDice: 4,
    abilities: [
      {
        id: "reality_tear",
        name: "Reality Tear",
        description: "Creates a damaging void rift",
        cooldown: 5,
        effect: "void_rift",
        damage: 4,
        range: 200,
        duration: 5,
      },
      {
        id: "null_wave",
        name: "Null Wave",
        description: "EMP that disables all ship systems",
        cooldown: 8,
        effect: "emp",
        range: 300,
        duration: 2,
      },
      {
        id: "corruption_aura",
        name: "Corruption Aura",
        description: "Ships nearby take stacking damage over time",
        cooldown: 0,
        effect: "corruption",
        range: 150,
      },
    ],
    aggression: 0.5,
    territorialRange: 400,
    fleeThreshold: 0,
    pointValue: 250,
    spawnWeight: 0.8,
    minWave: 18,
    isBoss: true,
  },

  // ==========================================
  // HIVE MINDS
  // Spawners that create smaller units
  // ==========================================

  brood_mother: {
    id: "brood_mother",
    name: "Brood Mother",
    category: "hive_mind",
    size: "huge",
    description:
      "Central hive organism that continuously spawns drones. Must be destroyed to stop the swarm.",
    origin: "Infested sectors",
    hull: 40,
    shields: 5,
    armor: 2,
    speed: 1,
    agility: 0,
    attackDice: 2,
    abilities: [
      {
        id: "spawn_drones",
        name: "Spawn Drones",
        description: "Creates 2-4 Scourge Drones",
        cooldown: 4,
        effect: "spawn_minions",
        spawnCount: 3,
      },
      {
        id: "hive_link",
        name: "Hive Link",
        description: "Buffs all nearby swarm creatures",
        cooldown: 0,
        effect: "swarm_buff",
        range: 300,
      },
      {
        id: "regenerative_carapace",
        name: "Regenerative Carapace",
        description: "Regenerates 2 hull per turn",
        cooldown: 0,
        effect: "regenerate",
      },
    ],
    aggression: 0.3,
    territorialRange: 300,
    fleeThreshold: 0,
    pointValue: 150,
    spawnWeight: 1,
    minWave: 8,
    isBoss: true,
  },

  hive_nexus: {
    id: "hive_nexus",
    name: "Hive Nexus",
    category: "hive_mind",
    size: "colossal",
    description:
      "The central brain of a hive fleet. Coordinates all swarm creatures within range.",
    origin: "Hive fleet cores",
    hull: 60,
    shields: 20,
    armor: 3,
    speed: 0, // Stationary
    agility: 0,
    attackDice: 3,
    abilities: [
      {
        id: "mass_spawn",
        name: "Mass Spawn",
        description: "Spawns a wave of mixed swarm creatures",
        cooldown: 6,
        effect: "spawn_minions",
        spawnCount: 6,
      },
      {
        id: "psychic_scream",
        name: "Psychic Scream",
        description: "AoE damage and stress to all enemies",
        cooldown: 5,
        effect: "psionic_blast",
        damage: 3,
        range: 350,
      },
      {
        id: "neural_regeneration",
        name: "Neural Regeneration",
        description: "Regenerates faster when drones are nearby",
        cooldown: 0,
        effect: "regenerate",
      },
    ],
    sections: [
      {
        id: "brain",
        name: "Neural Core",
        hull: 30,
        maxHull: 30,
        isDisabled: false,
        offsetX: 0,
        offsetY: 0,
        abilities: ["psychic_scream", "neural_regeneration"],
      },
      {
        id: "spawner",
        name: "Spawning Pods",
        hull: 30,
        maxHull: 30,
        isDisabled: false,
        offsetX: 0,
        offsetY: 40,
        abilities: ["mass_spawn"],
      },
    ],
    aggression: 0,
    territorialRange: 400,
    fleeThreshold: 0,
    pointValue: 400,
    spawnWeight: 0.5,
    minWave: 15,
    isBoss: true,
  },
};

// ============================================
// Spawn Tables by Difficulty
// ============================================

export const MONSTER_SPAWN_TABLE: MonsterSpawnRule[] = [
  // Easy (waves 1-5)
  { monsterId: "void_mite", weight: 10, minDifficulty: 0, maxCount: 8 },
  { monsterId: "crystal_swarm", weight: 5, minDifficulty: 0, maxCount: 4 },

  // Medium (waves 5-10)
  { monsterId: "scourge_drone", weight: 8, minDifficulty: 5, maxCount: 6 },
  { monsterId: "hull_borer", weight: 6, minDifficulty: 5, maxCount: 3 },
  { monsterId: "shield_leech", weight: 4, minDifficulty: 6, maxCount: 2 },

  // Hard (waves 10-15)
  { monsterId: "psi_stalker", weight: 3, minDifficulty: 10, maxCount: 2 },
  { monsterId: "rift_specter", weight: 3, minDifficulty: 10, maxCount: 3 },
  { monsterId: "brood_mother", weight: 1, minDifficulty: 8, maxCount: 1 },

  // Boss tier (waves 15+)
  { monsterId: "void_whale", weight: 1, minDifficulty: 10, maxCount: 1 },
  { monsterId: "entropy_maw", weight: 1, minDifficulty: 12, maxCount: 1 },
  { monsterId: "null_herald", weight: 0.8, minDifficulty: 18, maxCount: 1 },
  { monsterId: "hive_nexus", weight: 0.5, minDifficulty: 15, maxCount: 1 },

  // Legendary (waves 20+)
  { monsterId: "star_serpent", weight: 0.5, minDifficulty: 15, maxCount: 1 },
  { monsterId: "kraken_prime", weight: 0.3, minDifficulty: 20, maxCount: 1 },
];

// ============================================
// Helper Functions
// ============================================

/**
 * Get monster definition by ID
 */
export function getMonsterDefinition(
  monsterId: string,
): MonsterDefinition | undefined {
  return MONSTER_DEFINITIONS[monsterId];
}

/**
 * Get all monsters of a category
 */
export function getMonstersByCategory(
  category: MonsterCategory,
): MonsterDefinition[] {
  return Object.values(MONSTER_DEFINITIONS).filter(
    (m) => m.category === category,
  );
}

/**
 * Get all boss monsters
 */
export function getBossMonsters(): MonsterDefinition[] {
  return Object.values(MONSTER_DEFINITIONS).filter((m) => m.isBoss);
}

/**
 * Get monsters available for a given wave/difficulty
 */
export function getAvailableMonsters(difficulty: number): MonsterSpawnRule[] {
  return MONSTER_SPAWN_TABLE.filter((rule) => rule.minDifficulty <= difficulty);
}

/**
 * Select a random monster based on spawn weights
 */
export function selectRandomMonster(
  difficulty: number,
): MonsterDefinition | null {
  const available = getAvailableMonsters(difficulty);
  if (available.length === 0) return null;

  const totalWeight = available.reduce((sum, rule) => sum + rule.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const rule of available) {
    roll -= rule.weight;
    if (roll <= 0) {
      return getMonsterDefinition(rule.monsterId) || null;
    }
  }

  return null;
}

/**
 * Get size in pixels for a monster
 */
export function getMonsterSizePixels(monster: MonsterDefinition): number {
  return MONSTER_SIZES[monster.size];
}

/**
 * Calculate effective health (hull + shields + armor mitigation)
 */
export function getMonsterEffectiveHealth(
  monster: MonsterDefinition,
  expectedHits: number = 10,
): number {
  return monster.hull + monster.shields + monster.armor * expectedHits;
}

// ============================================
// Monster Encounter Presets
// ============================================

export interface MonsterEncounter {
  id: string;
  name: string;
  description: string;
  monsters: Array<{ monsterId: string; count: number }>;
  difficulty: number;
  rewards: { points: number; credits?: number };
}

export const PRESET_ENCOUNTERS: MonsterEncounter[] = [
  {
    id: "swarm_infestation",
    name: "Swarm Infestation",
    description: "A hive ship has disgorged its payload. Survive the swarm!",
    monsters: [
      { monsterId: "brood_mother", count: 1 },
      { monsterId: "scourge_drone", count: 6 },
      { monsterId: "void_mite", count: 8 },
    ],
    difficulty: 8,
    rewards: { points: 500, credits: 1000 },
  },
  {
    id: "void_hunters",
    name: "Void Hunters",
    description: "Dimensional predators have found you. They cannot be outrun.",
    monsters: [
      { monsterId: "rift_specter", count: 3 },
      { monsterId: "psi_stalker", count: 2 },
      { monsterId: "null_herald", count: 1 },
    ],
    difficulty: 15,
    rewards: { points: 1000, credits: 2500 },
  },
  {
    id: "leviathan_awakens",
    name: "Leviathan Awakens",
    description: "An ancient creature stirs from its eons-long slumber.",
    monsters: [{ monsterId: "star_serpent", count: 1 }],
    difficulty: 18,
    rewards: { points: 1500, credits: 5000 },
  },
  {
    id: "gravity_well",
    name: "Gravity Well",
    description: "Sensors detect a gravitational anomaly. It's pulling you in.",
    monsters: [
      { monsterId: "entropy_maw", count: 1 },
      { monsterId: "rift_specter", count: 4 },
    ],
    difficulty: 14,
    rewards: { points: 800, credits: 2000 },
  },
  {
    id: "kraken_hunt",
    name: "Kraken Hunt",
    description:
      "The legendary Kraken Prime has been sighted. A bounty awaits the brave.",
    monsters: [
      { monsterId: "kraken_prime", count: 1 },
      { monsterId: "scourge_drone", count: 4 },
    ],
    difficulty: 22,
    rewards: { points: 3000, credits: 10000 },
  },
  {
    id: "crystal_fields",
    name: "Crystal Fields",
    description: "Navigate through hostile crystalline life forms.",
    monsters: [
      { monsterId: "crystal_swarm", count: 8 },
      { monsterId: "shield_leech", count: 2 },
    ],
    difficulty: 6,
    rewards: { points: 300, credits: 500 },
  },
];
