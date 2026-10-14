/**
 * nodeCreatures — creature ships in a headless Survival node battle, the way
 * SurvivalScene fights them: the boss of a boss node (or an add it calls) is
 * a ship record (hull, shields, kills, rewards through the shared combat
 * model) whose pose and powers a {@link CreatureEncounter} drives instead of
 * a bot pilot, through the shared {@link CreatureHost}. Its effects (damage,
 * stress, pulls, summons, healing) go through nodeCombat's own damage path
 * (shields, relic mitigation, hit immunity, kills).
 *
 * Pure: no Phaser.
 */

import { BATTLEFIELD_SIZE, LOGIC_DELTA } from "../../config";
import { applyInstantStress } from "../../arcade/ArcadeStress";
import {
  CreatureHost,
  type CreatureHostBridge,
} from "../../arcade/creatures/CreatureHost";
import { createCycleFlight } from "../../arcade/systems/CycleFlight";
import type { WaveTier } from "../../arcade/systems/SurvivalLoadouts";
import { NEUTRAL_MODIFIERS } from "../../core/CombatModifiers";
import { getCreature } from "../../data/creatures/creatureCatalog";
import {
  createBattleEncounter,
  creatureShipStats,
} from "../../arcade/creatures/creatureSpawn";
import { dealDamage, resolveKill } from "./nodeCombat";
import type { NodeBattle } from "./nodeBattle";
import { ARENA_CENTER, type NodeShip } from "./nodeShips";

/** A creature ship to put on the field. */
export interface CreatureSpawn {
  readonly creatureId: string;
  readonly at: {
    readonly x: number;
    readonly y: number;
    readonly angle: number;
  };
  readonly rank: WaveTier;
  /** Phases of the fight (boss only). */
  readonly phases: number;
  readonly serial: number;
}

/**
 * @param battle - The battle (mutated: the ship joins it).
 * @param spawn - What and where.
 * @returns The creature's ship.
 */
export function spawnCreatureShip(
  battle: NodeBattle,
  spawn: CreatureSpawn,
): NodeShip {
  const { rules, combat } = battle;
  const definition = getCreature(spawn.creatureId);
  const standIn = combat.ships[0]!;
  const stats = creatureShipStats(definition);
  const encounter = createBattleEncounter({
    definition,
    battleSeed: rules.plan.combatSeed,
    serial: spawn.serial,
    worldSize: BATTLEFIELD_SIZE,
    belt: { ...ARENA_CENTER, safeRadius: battle.belt.safeRadius },
    phases: spawn.phases,
    start: spawn.at,
  });
  const ship: NodeShip = {
    ...standIn,
    id: `${spawn.rank}_creature_${spawn.serial}`,
    definitionId: definition.id,
    faction: rules.plan.enemyFaction,
    owner: "ai",
    rank: spawn.rank,
    ...spawn.at,
    hull: stats.hull,
    maxHull: stats.maxHull,
    shields: stats.shields,
    maxShields: stats.maxShields,
    flight: createCycleFlight(standIn.definitionId, spawn.at),
    weaponCooldown: 0,
    loadoutId: null,
    modifiers: NEUTRAL_MODIFIERS,
    frenzyUntilMs: 0,
    bot: null,
    record: null,
    creature: encounter,
    radiusPx: stats.radiusPx,
    isBossCreature: spawn.rank === "boss",
  };
  ship.combatStats = {
    ...standIn.combatStats,
    attackDice: 0,
    agilityDice: stats.agilityDice,
    hull: stats.hull,
    maxHull: stats.maxHull,
    shields: stats.shields,
    maxShields: stats.maxShields,
  };
  rules.registerEnemy(ship.id, spawn.rank);
  rules.equipEnemy(ship, []);
  combat.ships.push(ship);
  battle.enemiesSpawned += 1;
  return ship;
}

function simBridge(battle: NodeBattle): CreatureHostBridge<NodeShip> {
  const { combat } = battle;
  return {
    ships: () => combat.ships,
    isFlagship: (ship) => ship.rank === "flagship",
    damage: (victim, amount, attacker) => {
      const { nowMs } = battle;
      dealDamage(combat, victim, amount, nowMs, attacker);
      battle.creatureStats.hitsOnPlayers += 1;
      combat.ledger.recordHit(attacker.id, victim.id, nowMs);
      if (victim.hull <= 0) resolveKill(combat, attacker, victim, nowMs);
    },
    stress: (victim, amount) => {
      victim.flight = {
        ...victim.flight,
        stress: applyInstantStress(victim.flight.stress, amount),
      };
    },
    nudge: (victim, dx, dy) => {
      const motion = victim.flight.motion;
      victim.flight = {
        ...victim.flight,
        motion: { ...motion, x: motion.x + dx, y: motion.y + dy },
      };
      victim.x += dx;
      victim.y += dy;
    },
    setPose: (ship, x, y, angle) => {
      ship.x = x;
      ship.y = y;
      ship.angle = angle;
      ship.flight = {
        ...ship.flight,
        motion: { ...ship.flight.motion, x, y, angle },
      };
    },
    spawnAdd: (creatureId, x, y, angle) => {
      spawnCreatureShip(battle, {
        creatureId,
        at: { x, y, angle },
        rank: "regular",
        phases: 1,
        serial: battle.enemiesSpawned,
      });
    },
    healed: (ship, hull) => {
      ship.hull = Math.min(ship.maxHull, ship.hull + hull);
    },
    event: (_ship, kind) => {
      const stats = battle.creatureStats;
      if (kind === "telegraph") stats.telegraphs += 1;
      else if (kind === "power") stats.powersLanded += 1;
      else if (kind === "part_destroyed") stats.partsDestroyed += 1;
    },
  };
}

const hosts = new WeakMap<NodeBattle, CreatureHost<NodeShip>>();

function hostOf(battle: NodeBattle): CreatureHost<NodeShip> {
  let host = hosts.get(battle);
  if (!host) {
    host = new CreatureHost(simBridge(battle));
    hosts.set(battle, host);
  }
  return host;
}

/**
 * One tick of every living creature of the battle.
 *
 * @param battle - The battle (mutated).
 */
export function stepCreatures(battle: NodeBattle): void {
  hostOf(battle).step(battle.nowMs, LOGIC_DELTA);
}

/**
 * Tells every creature a ship died (a wreck to feed on).
 *
 * @param battle - The battle.
 * @param victim - The ship that died.
 */
export function noteWreck(battle: NodeBattle, victim: NodeShip): void {
  hostOf(battle).noteWreck(victim);
}
