/**
 * Survival roguelite — combat relics: the Ace (maneuvers) and Hunter
 * (marks, crits, positioning) archetypes. Pure data; see relics.ts for
 * the effect model and RelicCombatEngine for how each effect plays out.
 */

import type { Relic } from "./relics";

/** Ace archetype — rewards red maneuvers, barrel rolls, boosts, K-turns, stress. */
export const ACE_RELICS: readonly Relic[] = [
  {
    id: "adrenal_injector",
    name: "Adrenal Injector",
    icon: "💉",
    rarity: "common",
    archetype: "ace",
    tags: ["red-maneuver"],
    pool: "base",
    description: "After a red maneuver, +1 damage for 3s",
    effects: [
      {
        kind: "trigger",
        on: "red_maneuver",
        buff: { id: "adrenal", durationMs: 3000, damageBonus: 1 },
      },
    ],
  },
  {
    id: "slipstream_vanes",
    name: "Slipstream Vanes",
    icon: "🌀",
    rarity: "common",
    archetype: "ace",
    tags: ["barrel-roll"],
    pool: "base",
    description: "When you barrel roll, take 50% less damage for 1.5s",
    effects: [
      {
        kind: "trigger",
        on: "barrel_roll",
        buff: {
          id: "slipstream",
          durationMs: 1500,
          damageTakenMultiplier: 0.5,
        },
      },
    ],
  },
  {
    id: "afterburn_capacitor",
    name: "Afterburn Capacitor",
    icon: "🔥",
    rarity: "uncommon",
    archetype: "ace",
    tags: ["boost"],
    pool: "base",
    description: "After a boost, +15% hit chance for 2.5s",
    effects: [
      {
        kind: "trigger",
        on: "boost",
        buff: { id: "afterburn", durationMs: 2500, hitChanceBonus: 0.15 },
      },
    ],
  },
  {
    id: "daredevil_harness",
    name: "Daredevil Harness",
    icon: "😤",
    rarity: "common",
    archetype: "ace",
    tags: ["stress", "red-maneuver"],
    pool: "base",
    description: "+1 damage while your pilot is stressed",
    effects: [
      { kind: "static", scope: "flagship", effect: { stressedLaserBonus: 1 } },
    ],
  },
  {
    id: "koiogran_gyro",
    name: "Koiogran Gyro",
    icon: "↩",
    rarity: "uncommon",
    archetype: "ace",
    tags: ["k-turn", "red-maneuver"],
    pool: "ace_pack",
    description:
      "K-turns recharge 35% faster; after a K-turn, +2 damage for 2s",
    effects: [
      {
        kind: "static",
        scope: "flagship",
        effect: { kturnCooldownMultiplier: 0.65 },
      },
      {
        kind: "trigger",
        on: "kturn",
        buff: { id: "koiogran", durationMs: 2000, damageBonus: 2 },
      },
    ],
  },
  {
    id: "roll_thrusters",
    name: "Roll Thrusters",
    icon: "🛞",
    rarity: "common",
    archetype: "ace",
    tags: ["barrel-roll", "boost"],
    pool: "ace_pack",
    description: "Barrel roll recharges 35% faster, boost 20% faster",
    effects: [
      {
        kind: "static",
        scope: "flagship",
        effect: {
          barrelRollCooldownMultiplier: 0.65,
          boostCooldownMultiplier: 0.8,
        },
      },
    ],
  },
  {
    id: "phase_flicker",
    name: "Phase Flicker",
    icon: "👻",
    rarity: "rare",
    archetype: "ace",
    tags: ["barrel-roll", "shields"],
    pool: "ace_pack",
    description: "When you barrel roll, restore 15% of your shields",
    effects: [
      {
        kind: "trigger",
        on: "barrel_roll",
        buff: {
          id: "phase_flicker",
          durationMs: 1,
          shieldRestoreFraction: 0.15,
        },
      },
    ],
  },
];

/** Hunter archetype — rewards marking (R), crits, rear-arc and bullseye shots. */
export const HUNTER_RELICS: readonly Relic[] = [
  {
    id: "target_painter",
    name: "Target Painter",
    icon: "🎯",
    rarity: "common",
    archetype: "hunter",
    tags: ["mark"],
    pool: "base",
    description:
      "Marked targets: your flagship hits for +1 damage, +10% hit chance",
    effects: [
      {
        kind: "marked",
        scope: "flagship",
        damageBonus: 1,
        hitChanceBonus: 0.1,
        critChanceBonus: 0,
      },
    ],
  },
  {
    id: "predator_optics",
    name: "Predator Optics",
    icon: "🔭",
    rarity: "rare",
    archetype: "hunter",
    tags: ["mark", "crit"],
    pool: "base",
    description: "+20% crit chance against marked targets",
    effects: [
      {
        kind: "marked",
        scope: "flagship",
        damageBonus: 0,
        hitChanceBonus: 0,
        critChanceBonus: 0.2,
      },
    ],
  },
  {
    id: "ambush_doctrine",
    name: "Ambush Doctrine",
    icon: "🗡",
    rarity: "common",
    archetype: "hunter",
    tags: ["rear-arc"],
    pool: "base",
    description: "+2 damage when firing from the target's rear arc",
    effects: [
      { kind: "static", scope: "flagship", effect: { rearArcLaserBonus: 2 } },
    ],
  },
  {
    id: "bullseye_scope",
    name: "Bullseye Scope",
    icon: "⊕",
    rarity: "uncommon",
    archetype: "hunter",
    tags: ["bullseye", "crit"],
    pool: "base",
    description: "+2 damage when the target sits in your bullseye arc",
    effects: [
      { kind: "static", scope: "flagship", effect: { bullseyeLaserBonus: 2 } },
    ],
  },
  {
    id: "executioner_rounds",
    name: "Executioner Rounds",
    icon: "⚰",
    rarity: "common",
    archetype: "hunter",
    tags: ["unshielded", "kill"],
    pool: "base",
    description: "+1 damage against targets whose shields are down",
    effects: [
      {
        kind: "static",
        scope: "fleet",
        effect: { bonusDamageVsUnshielded: 1 },
      },
    ],
  },
  {
    id: "blood_in_the_void",
    name: "Blood in the Void",
    icon: "🩸",
    rarity: "uncommon",
    archetype: "hunter",
    tags: ["kill"],
    pool: "base",
    description: "After a kill, +2 damage during a short frenzy",
    effects: [
      {
        kind: "static",
        scope: "flagship",
        effect: { killFrenzyLaserBonus: 2 },
      },
    ],
  },
  {
    id: "squad_comms",
    name: "Squadron Comms",
    icon: "📻",
    rarity: "uncommon",
    archetype: "hunter",
    tags: ["mark", "escort"],
    pool: "fleet_pack",
    description: "Escorts hit marked targets for +2 damage",
    effects: [
      {
        kind: "marked",
        scope: "escorts",
        damageBonus: 2,
        hitChanceBonus: 0.05,
        critChanceBonus: 0,
      },
    ],
  },
];
