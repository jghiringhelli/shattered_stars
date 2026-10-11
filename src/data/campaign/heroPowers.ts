/**
 * heroPowers — the campaign-only active powers of each faction's hero pilot
 * (two per faction, three ranks each) and the schedule that unlocks / ranks
 * them up as the campaign advances. Bound to HERO_POWER_1 (V / pad Y) and
 * HERO_POWER_2 (B / pad L3). Not available in any other mode.
 *
 * Damage is in real-time hull points (a light fighter has ~24 hull + 12
 * shields at DURABILITY_SCALE 12).
 */

import type { FactionId } from "../../config";
import type {
  FactionHero,
  HeroPowerDefinition,
  HeroPowerEffect,
  HeroPowerRank,
  PowerUnlockStep,
} from "../../campaign/powers/heroPowerTypes";

/** Seconds → milliseconds. */
const S = 1000;

/**
 * @param cooldownsSeconds - Cooldown per rank (seconds).
 * @param effects - Effect per rank.
 * @returns The three ranks.
 */
function ranks(
  cooldownsSeconds: readonly [number, number, number],
  effects: readonly [HeroPowerEffect, HeroPowerEffect, HeroPowerEffect],
): readonly [HeroPowerRank, HeroPowerRank, HeroPowerRank] {
  return [
    { cooldownMs: cooldownsSeconds[0] * S, effect: effects[0] },
    { cooldownMs: cooldownsSeconds[1] * S, effect: effects[1] },
    { cooldownMs: cooldownsSeconds[2] * S, effect: effects[2] },
  ];
}

const ORBITAL_STRIKE: HeroPowerDefinition = {
  id: "orbital_strike",
  name: "Orbital Strike",
  glyph: "✸",
  description: "The fleet bombards your target's position after a short delay.",
  ranks: ranks(
    [30, 26, 22],
    [
      { kind: "orbital_strike", radius: 160, damage: 30, delayMs: 1200 },
      { kind: "orbital_strike", radius: 180, damage: 40, delayMs: 1100 },
      { kind: "orbital_strike", radius: 200, damage: 50, delayMs: 1000 },
    ],
  ),
};

const SHIELD_OVERCHARGE: HeroPowerDefinition = {
  id: "shield_overcharge",
  name: "Shield Overcharge",
  glyph: "◈",
  description: "Shields refilled; incoming damage halved for a few seconds.",
  ranks: ranks(
    [40, 35, 30],
    [
      {
        kind: "shield_overcharge",
        durationMs: 6 * S,
        damageTakenMultiplier: 0.5,
      },
      {
        kind: "shield_overcharge",
        durationMs: 8 * S,
        damageTakenMultiplier: 0.45,
      },
      {
        kind: "shield_overcharge",
        durationMs: 10 * S,
        damageTakenMultiplier: 0.4,
      },
    ],
  ),
};

const RALLY: HeroPowerDefinition = {
  id: "rally_the_fleet",
  name: "Rally the Fleet",
  glyph: "⚑",
  description: "Your wing fires much faster for a short time.",
  ranks: ranks(
    [35, 30, 25],
    [
      {
        kind: "rally",
        radius: 800,
        durationMs: 8 * S,
        intervalMultiplier: 0.7,
      },
      {
        kind: "rally",
        radius: 900,
        durationMs: 8 * S,
        intervalMultiplier: 0.65,
      },
      {
        kind: "rally",
        radius: 1000,
        durationMs: 9 * S,
        intervalMultiplier: 0.6,
      },
    ],
  ),
};

const FIELD_REPAIR: HeroPowerDefinition = {
  id: "field_repair",
  name: "Field Repairs",
  glyph: "✚",
  description:
    "Patch your hull and your nearby wingmen in the middle of a fight.",
  ranks: ranks(
    [45, 40, 35],
    [
      {
        kind: "field_repair",
        radius: 600,
        selfHullFraction: 0.3,
        allyHullFraction: 0.15,
      },
      {
        kind: "field_repair",
        radius: 700,
        selfHullFraction: 0.4,
        allyHullFraction: 0.2,
      },
      {
        kind: "field_repair",
        radius: 800,
        selfHullFraction: 0.5,
        allyHullFraction: 0.25,
      },
    ],
  ),
};

const DRONE_SWARM: HeroPowerDefinition = {
  id: "drone_swarm",
  name: "Drone Swarm",
  glyph: "⁂",
  description: "Fabricate a flight of combat drones that fight for 20 seconds.",
  ranks: ranks(
    [40, 35, 30],
    [
      {
        kind: "drone_swarm",
        shipId: "synth_drone",
        count: 3,
        lifetimeMs: 20 * S,
      },
      {
        kind: "drone_swarm",
        shipId: "synth_drone",
        count: 4,
        lifetimeMs: 20 * S,
      },
      {
        kind: "drone_swarm",
        shipId: "synth_drone",
        count: 5,
        lifetimeMs: 22 * S,
      },
    ],
  ),
};

const EMP_BURST: HeroPowerDefinition = {
  id: "emp_burst",
  name: "EMP Burst",
  glyph: "ϟ",
  description: "Strip nearby enemy shields and silence their guns.",
  ranks: ranks(
    [35, 30, 26],
    [
      { kind: "emp_burst", radius: 450, disableMs: 3 * S, stress: 0.5 },
      { kind: "emp_burst", radius: 500, disableMs: 4 * S, stress: 0.6 },
      { kind: "emp_burst", radius: 550, disableMs: 5 * S, stress: 0.7 },
    ],
  ),
};

const CLOAK_DASH: HeroPowerDefinition = {
  id: "cloak_dash",
  name: "Cloak Dash",
  glyph: "◌",
  description: "Jump forward and vanish from enemy sensors.",
  ranks: ranks(
    [20, 17, 14],
    [
      { kind: "cloak_dash", distance: 350, durationMs: 3 * S },
      { kind: "cloak_dash", distance: 400, durationMs: 4 * S },
      { kind: "cloak_dash", distance: 450, durationMs: 5 * S },
    ],
  ),
};

const SCATTER_MINES: HeroPowerDefinition = {
  id: "scatter_mines",
  name: "Scatter Mines",
  glyph: "✱",
  description: "Sow proximity mines in your wake that only hunt enemies.",
  ranks: ranks(
    [30, 26, 22],
    [
      { kind: "scatter_mines", count: 4, damage: 20, spacing: 70 },
      { kind: "scatter_mines", count: 5, damage: 26, spacing: 70 },
      { kind: "scatter_mines", count: 6, damage: 32, spacing: 70 },
    ],
  ),
};

const TIME_SLOW: HeroPowerDefinition = {
  id: "time_slow",
  name: "Time-Slow Focus",
  glyph: "⧗",
  description: "Your mind outruns time: enemies crawl for a few seconds.",
  ranks: ranks(
    [40, 35, 30],
    [
      { kind: "time_slow", durationMs: 5 * S, enemyTimeScale: 0.5 },
      { kind: "time_slow", durationMs: 6 * S, enemyTimeScale: 0.45 },
      { kind: "time_slow", durationMs: 7 * S, enemyTimeScale: 0.4 },
    ],
  ),
};

const PSIONIC_LANCE: HeroPowerDefinition = {
  id: "psionic_lance",
  name: "Psionic Lance",
  glyph: "↯",
  description: "A shield-piercing strike on your target.",
  ranks: ranks(
    [25, 22, 19],
    [
      { kind: "psionic_lance", range: 900, damage: 40 },
      { kind: "psionic_lance", range: 950, damage: 55 },
      { kind: "psionic_lance", range: 1000, damage: 70 },
    ],
  ),
};

/** Each faction campaign's hero. */
export const FACTION_HEROES: Readonly<Record<FactionId, FactionHero>> = {
  terran_hegemony: {
    factionId: "terran_hegemony",
    pilotId: "admiral_chen",
    name: "Admiral Chen",
    title: "Iron Actual",
    portraitKey: "portrait_admiral_chen",
    powers: [ORBITAL_STRIKE, SHIELD_OVERCHARGE],
  },
  free_confederation: {
    factionId: "free_confederation",
    pilotId: "commander_santos",
    name: "Commander Santos",
    title: "Libre One",
    portraitKey: "portrait_commander_santos",
    powers: [RALLY, FIELD_REPAIR],
  },
  synthetic_collective: {
    factionId: "synthetic_collective",
    pilotId: "omega_7",
    name: "Omega-7",
    title: "Prime Node Candidate",
    portraitKey: "portrait_omega_7",
    powers: [DRONE_SWARM, EMP_BURST],
  },
  void_corsairs: {
    factionId: "void_corsairs",
    pilotId: "captain_kira",
    name: "Captain Kira",
    title: "Scourge of the Lanes",
    portraitKey: "portrait_captain_kira",
    powers: [CLOAK_DASH, SCATTER_MINES],
  },
  ascendant_empire: {
    factionId: "ascendant_empire",
    pilotId: "the_dreamer",
    name: "The Dreamer",
    title: "Voice of the Prophecy",
    portraitKey: "portrait_the_dreamer",
    powers: [TIME_SLOW, PSIONIC_LANCE],
  },
};

/**
 * When powers unlock and rank up, by missions completed: power 1 from the
 * start, power 2 after the opening missions, then alternating rank-ups
 * through acts II and III.
 */
export const POWER_UNLOCK_SCHEDULE: readonly PowerUnlockStep[] = [
  { completedMissions: 0, slot: 0, rank: 1 },
  { completedMissions: 3, slot: 1, rank: 1 },
  { completedMissions: 6, slot: 0, rank: 2 },
  { completedMissions: 9, slot: 1, rank: 2 },
  { completedMissions: 12, slot: 0, rank: 3 },
  { completedMissions: 13, slot: 1, rank: 3 },
];
