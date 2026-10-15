/**
 * Survival roguelite — support relics: the Squadron (escorts, wingmen),
 * Bulwark (shields, hull, repairs) and Salvager (economy) archetypes. Pure
 * data; see relics.ts for the effect model.
 */

import type { Relic } from "./relics";

/** Squadron archetype — scales with escort count and flying in formation. */
export const SQUADRON_RELICS: readonly Relic[] = [
  {
    id: "pack_tactics",
    name: "Pack Tactics",
    icon: "🐺",
    rarity: "rare",
    archetype: "squadron",
    tags: ["escort"],
    pool: "base",
    description: "Flagship +1 damage per 2 living escorts",
    effects: [{ kind: "perEscort", escortsPerDamage: 2 }],
  },
  {
    id: "wing_link",
    name: "Wing Link",
    icon: "🔗",
    rarity: "common",
    archetype: "squadron",
    tags: ["wingman", "escort"],
    pool: "base",
    description:
      "With a friendly ship nearby: +1 damage and 15% less damage taken",
    effects: [
      {
        kind: "static",
        scope: "fleet",
        effect: { wingmanLaserBonus: 1, wingmanDamageTakenMultiplier: 0.85 },
      },
    ],
  },
  {
    id: "escort_foundry",
    name: "Escort Foundry",
    icon: "🏭",
    rarity: "common",
    archetype: "squadron",
    tags: ["escort", "shields"],
    pool: "base",
    description: "Escorts gain +1 damage and take 5% less damage",
    effects: [
      {
        kind: "static",
        scope: "escorts",
        effect: {
          laserDamageBonus: 1,
          damageTakenMultiplier: 0.95,
        },
      },
    ],
  },
  {
    id: "martyr_beacon",
    name: "Martyr Beacon",
    icon: "💣",
    rarity: "uncommon",
    archetype: "squadron",
    tags: ["escort", "kill"],
    pool: "fleet_pack",
    description: "Escorts detonate when destroyed, damaging nearby enemies",
    effects: [
      // Miniature 2 = 20 HP per death, the same blast as a pilot's
      // Self-Destruct; 8 (80 HP) turned every lost escort into a wave wipe.
      { kind: "static", scope: "escorts", effect: { deathBlastDamage: 2 } },
    ],
  },
  {
    id: "formation_lock",
    name: "Formation Lock",
    icon: "🛡",
    rarity: "rare",
    archetype: "squadron",
    tags: ["escort", "hull"],
    pool: "fleet_pack",
    description: "While an escort lives, your flagship takes 15% less damage",
    effects: [
      { kind: "formation", minEscorts: 1, damageTakenMultiplier: 0.85 },
    ],
  },
];

/** Bulwark archetype — shields, hull and repair between nodes. */
export const BULWARK_RELICS: readonly Relic[] = [
  {
    id: "capacitor_bank",
    name: "Capacitor Bank",
    icon: "🔋",
    rarity: "common",
    archetype: "bulwark",
    tags: ["kill", "shields"],
    pool: "base",
    description: "Each kill restores 2 shield HP",
    effects: [
      { kind: "static", scope: "fleet", effect: { shieldsPerKill: 2 } },
    ],
  },
  {
    id: "ablative_hull",
    name: "Ablative Hull",
    icon: "🧱",
    rarity: "common",
    archetype: "bulwark",
    tags: ["hull"],
    pool: "base",
    description: "Your flagship takes 10% less damage",
    effects: [
      {
        kind: "static",
        scope: "flagship",
        effect: { damageTakenMultiplier: 0.9 },
      },
    ],
  },
  {
    id: "nanite_weave",
    name: "Nanite Weave",
    icon: "🧬",
    rarity: "rare",
    archetype: "bulwark",
    tags: ["repair", "hull"],
    pool: "base",
    description: "After every cleared battle, repair 10% of each ship's hull",
    effects: [{ kind: "nodeRepair", fraction: 0.1 }],
  },
  {
    id: "regen_lattice",
    name: "Regen Lattice",
    icon: "💠",
    rarity: "common",
    archetype: "bulwark",
    tags: ["shields"],
    pool: "base",
    description:
      "+0.04 shield HP/s regen and +1 shield HP per kill for the fleet",
    effects: [
      {
        kind: "static",
        scope: "fleet",
        effect: { shieldRegenPerSecond: 0.04, shieldsPerKill: 1 },
      },
    ],
  },
  {
    id: "last_ditch_plating",
    name: "Last-Ditch Plating",
    icon: "🩹",
    rarity: "uncommon",
    archetype: "bulwark",
    tags: ["hull", "stress"],
    pool: "base",
    description: "+1 damage once your hull is damaged",
    effects: [
      { kind: "static", scope: "fleet", effect: { damagedLaserBonus: 1 } },
    ],
  },
];

/** Salvager archetype — salvage, shop, repairs and rerolls. */
export const SALVAGER_RELICS: readonly Relic[] = [
  {
    id: "salvage_drones",
    name: "Salvage Drones",
    icon: "🛸",
    rarity: "common",
    archetype: "salvager",
    tags: ["salvage", "kill"],
    pool: "base",
    description: "+2 salvage per kill",
    effects: [{ kind: "onKill", salvage: 2 }],
  },
  {
    id: "black_market_codes",
    name: "Black Market Codes",
    icon: "🕶",
    rarity: "uncommon",
    archetype: "salvager",
    tags: ["salvage", "shop"],
    pool: "salvage_pack",
    description: "Shop prices -25%",
    effects: [{ kind: "economy", shopDiscount: 0.25 }],
  },
  {
    id: "scrap_converter",
    name: "Scrap Converter",
    icon: "♻",
    rarity: "common",
    archetype: "salvager",
    tags: ["repair", "salvage"],
    pool: "salvage_pack",
    description: "Repairs restore 25% more hull",
    effects: [{ kind: "economy", repairBonus: 0.25 }],
  },
  {
    id: "loaded_dice",
    name: "Loaded Dice",
    icon: "🎲",
    rarity: "common",
    archetype: "salvager",
    tags: ["reroll"],
    pool: "salvage_pack",
    description: "+2 rerolls at the start of every sector",
    effects: [{ kind: "economy", rerollsPerSector: 2 }],
  },
  {
    id: "bounty_contract",
    name: "Bounty Contract",
    icon: "📜",
    rarity: "rare",
    archetype: "salvager",
    tags: ["elite", "salvage"],
    pool: "salvage_pack",
    description: "Elites and bosses drop +100% salvage",
    effects: [{ kind: "economy", eliteSalvageMultiplier: 2 }],
  },
  {
    id: "smugglers_hold",
    name: "Smuggler's Hold",
    icon: "📦",
    rarity: "common",
    archetype: "salvager",
    tags: ["salvage", "shop"],
    pool: "base",
    description: "Shop prices -15%; each kill +1 salvage",
    effects: [
      { kind: "economy", shopDiscount: 0.15 },
      { kind: "onKill", salvage: 1 },
    ],
  },
];
