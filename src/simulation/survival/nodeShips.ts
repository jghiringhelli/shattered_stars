/**
 * nodeShips — ships of a headless Survival node battle, built exactly the
 * way SurvivalScene builds them: survival-mode combat stats, the quick build
 * equipped, the flagship's drafted hull/shield bonuses, the run's relics /
 * mutations / repair upgrades / persisted damage (SurvivalBattleRules), the
 * fleet's Drive, and the wave's ships (regulars, elites with affixes, the
 * boss with its multiplier) on the scene's spawn arc.
 *
 * Pure: no Phaser.
 */

import type { FactionId } from "../../config";
import { BATTLEFIELD_SIZE } from "../../config";
import type { BotPilot } from "../../arcade/ai/BotPilot";
import type { CreatureEncounter } from "../../arcade/creatures/CreatureEncounter";
import {
  createCycleFlight,
  type CycleFlightState,
} from "../../arcade/systems/CycleFlight";
import {
  equipFlight,
  equipQuickBuild,
} from "../../arcade/systems/QuickBuildEquip";
import {
  bossDurability,
  bossMultiplier,
  eliteMaxHull,
  realTimeRunBonuses,
} from "../../arcade/systems/SurvivalDurability";
import type { WaveSlot } from "../../arcade/systems/SurvivalLoadouts";
import { SURVIVAL_ESCORT_TIER } from "../../arcade/systems/SurvivalSteering";
import type { SquadBattleAi } from "../../arcade/systems/SquadBattleAi";
import type { CombatModifiers } from "../../core/CombatModifiers";
import { NEUTRAL_MODIFIERS } from "../../core/CombatModifiers";
import type { ManeuverDefinition } from "../../core/types";
import {
  getModeCombatStats,
  type ModeCombatStats,
} from "../../data/ModeBalancing";
import { getShipDial } from "../../data/ShipDefinitions";
import type {
  SurvivalBattleRules,
  WaveSpec,
} from "../../systems/survival/SurvivalBattleRules";
import {
  fleetModifiers,
  reequipFlight,
} from "../../systems/survival/runFlightEquip";
import type { SpawnPoint } from "../../systems/survival/SurvivalSpawnArc";
import type { StatBonuses } from "../../data/survival/model";
import type { ShipRecord } from "../../systems/survival/RunTypes";

/** Centre of the arena (the scene's ARENA_CENTER). */
export const ARENA_CENTER = {
  x: BATTLEFIELD_SIZE / 2,
  y: BATTLEFIELD_SIZE / 2,
} as const;
/** Fleet spawn: flagship below centre, escorts spaced / offset (scene's spawnFleet). */
const FLEET_OFFSET_Y = 100;
const ESCORT_SPACING_X = 80;
const ESCORT_OFFSET_Y = 50;
/** Extra attack dice an elite wave ship rolls (scene's ELITE_ATTACK_BONUS). */
export const ELITE_ATTACK_BONUS = 1;

/** A ship of the node battle (mutable, like the scene's records). */
export interface NodeShip {
  readonly id: string;
  readonly definitionId: string;
  readonly faction: FactionId;
  readonly owner: "player" | "ai";
  readonly rank: "flagship" | "escort" | "regular" | "elite" | "boss";
  x: number;
  y: number;
  angle: number;
  hull: number;
  maxHull: number;
  shields: number;
  maxShields: number;
  combatStats: ModeCombatStats;
  flight: CycleFlightState;
  readonly dial: readonly ManeuverDefinition[];
  weaponCooldown: number;
  readonly loadoutId: string | null;
  modifiers: CombatModifiers;
  frenzyUntilMs: number;
  bot: BotPilot | null;
  /** Its ship record (player ships only). */
  readonly record: ShipRecord | null;
  /** The encounter driving it when it is a creature (no bot, no dial). */
  readonly creature: CreatureEncounter | null;
  /** Hull radius of a creature (px); undefined for ships. */
  radiusPx?: number;
  /** True for a boss creature (its adds are counted against it). */
  isBossCreature?: boolean;
}

interface ShipSpawn {
  readonly id: string;
  readonly definitionId: string;
  readonly faction: FactionId;
  readonly owner: "player" | "ai";
  readonly rank: NodeShip["rank"];
  readonly at: {
    readonly x: number;
    readonly y: number;
    readonly angle: number;
  };
  readonly loadoutId: string | null;
  readonly record: ShipRecord | null;
}

/**
 * @param spawn - Identity, side, pose and quick build.
 * @returns The equipped ship (combatStats = equipped baseline, as the scene does).
 */
function createShip(spawn: ShipSpawn): NodeShip {
  const combatStats = getModeCombatStats(spawn.definitionId, "survival");
  const ship: NodeShip = {
    id: spawn.id,
    definitionId: spawn.definitionId,
    faction: spawn.faction,
    owner: spawn.owner,
    rank: spawn.rank,
    ...spawn.at,
    hull: combatStats.hull,
    maxHull: combatStats.maxHull,
    shields: combatStats.shields,
    maxShields: combatStats.maxShields,
    combatStats,
    flight: createCycleFlight(spawn.definitionId, spawn.at),
    dial: getShipDial(spawn.definitionId),
    weaponCooldown: 0,
    loadoutId: spawn.loadoutId,
    modifiers: NEUTRAL_MODIFIERS,
    frenzyUntilMs: 0,
    bot: null,
    record: spawn.record,
    creature: null,
  };
  ship.modifiers = equipQuickBuild(ship, spawn.loadoutId);
  ship.flight = equipFlight(ship.flight, ship.modifiers);
  const { hull, maxHull, shields, maxShields } = ship;
  ship.combatStats = { ...combatStats, hull, maxHull, shields, maxShields };
  return ship;
}

/**
 * The run's fleet, flagship first, with its persisted damage and bonuses.
 * Every ship is bot-flown; the flagship's average bot stands in for the
 * player (the scene's autopilot).
 *
 * @param rules - The node's battle rules.
 * @param bonuses - The run's drafted stat bonuses.
 * @param squadAi - The battle's AI layer (creates the pilots).
 * @param faction - The player's faction.
 * @returns The player's ships.
 */
export function spawnFleet(
  rules: SurvivalBattleRules,
  bonuses: Readonly<StatBonuses>,
  squadAi: SquadBattleAi,
  faction: FactionId,
): NodeShip[] {
  return rules.fleet().map((record, index) => {
    const role = index === 0 ? "flagship" : "escort";
    const ship = createShip({
      id: `player_${index}`,
      definitionId: record.definitionId,
      faction,
      owner: "player",
      rank: role,
      at: {
        x: ARENA_CENTER.x + index * ESCORT_SPACING_X,
        y: ARENA_CENTER.y + FLEET_OFFSET_Y + (index > 0 ? ESCORT_OFFSET_Y : 0),
        angle: 0,
      },
      loadoutId: record.loadoutId,
      record,
    });
    if (role === "flagship") addRunDurability(ship, bonuses);
    rules.equipPlayer(ship, role, record);
    ship.modifiers = fleetModifiers(ship.modifiers, bonuses.speed);
    ship.flight = reequipFlight(ship.flight, ship.definitionId, ship.modifiers);
    ship.bot = squadAi.createPilot(SURVIVAL_ESCORT_TIER);
    return ship;
  });
}

function addRunDurability(
  ship: NodeShip,
  bonuses: Readonly<StatBonuses>,
): void {
  const real = realTimeRunBonuses(bonuses);
  ship.hull += real.maxHull;
  ship.maxHull += real.maxHull;
  ship.shields += real.maxShields;
  ship.maxShields += real.maxShields;
}

/** A wave ship about to spawn. */
export interface EnemySpawn {
  readonly slot: WaveSlot;
  readonly spec: WaveSpec;
  readonly faction: FactionId;
  readonly at: SpawnPoint;
  readonly serial: number;
}

/**
 * Build one wave ship as the scene does (regular / elite / boss).
 *
 * @param spawn - Slot, wave, faction, entry point and serial.
 * @param rules - The node's battle rules.
 * @param squadAi - The battle's AI layer.
 * @returns The equipped enemy, registered with the rules.
 */
export function createEnemy(
  spawn: EnemySpawn,
  rules: SurvivalBattleRules,
  squadAi: SquadBattleAi,
): NodeShip {
  const { slot } = spawn;
  const affixes = slot.tier === "elite" ? rules.eliteAffixes() : [];
  const ship = createShip({
    id: `${slot.tier}_${spawn.spec.index}_${spawn.serial}`,
    definitionId: slot.definitionId,
    faction: spawn.faction,
    owner: "ai",
    rank: slot.tier,
    at: spawn.at,
    loadoutId: slot.loadoutId,
    record: null,
  });
  ship.bot = squadAi.createPilot(rules.tierFor(spawn.spec, slot.tier, affixes));
  rules.registerEnemy(ship.id, slot.tier);
  if (slot.tier === "elite") {
    ship.maxHull = eliteMaxHull(ship.maxHull);
    const bonusDice = rules.equipEnemy(ship, affixes);
    ship.flight = reequipFlight(ship.flight, ship.definitionId, ship.modifiers);
    addAttackDice(ship, ELITE_ATTACK_BONUS + bonusDice);
  } else if (slot.tier === "boss") {
    const caps = bossDurability(ship, rules.plan.bossWave);
    ship.maxHull = caps.maxHull;
    ship.maxShields = caps.maxShields;
    rules.equipEnemy(ship, []);
    addAttackDice(ship, Math.floor(bossMultiplier(rules.plan.bossWave) / 2));
  } else {
    rules.equipEnemy(ship, []);
  }
  return ship;
}

function addAttackDice(ship: NodeShip, dice: number): void {
  ship.combatStats = {
    ...ship.combatStats,
    attackDice: ship.combatStats.attackDice + dice,
  };
}
