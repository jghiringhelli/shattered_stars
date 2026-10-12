/**
 * SurvivalNodeSim — one Survival roguelite battle node fought headless, the
 * way SurvivalScene fights it: the run's fleet with its persisted damage
 * (flagship flown by an average bot that marks its target, as the scene's
 * autopilot), the node's waves (SurvivalBattleRules: threat by sector, row
 * and ascension, elites with affixes, the boss and its phases) entering on
 * the spawn arc, SquadBattleAi orders and marks, cycle flight with the
 * belt's damage and retreat points, and the scene's combat (nodeCombat).
 * Returns the CombatOutcome the run applies after a win.
 *
 * Pure: no Phaser.
 */

import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS, LOGIC_DELTA } from "../../config";
import { HitImmunityLedger } from "../../arcade/systems/CombatTempo";
import { tickCycleFlight } from "../../arcade/systems/CycleFlight";
import {
  regenerateShields,
  stressModifiersOf,
} from "../../arcade/systems/QuickBuildEquip";
import { SquadBattleAi } from "../../arcade/systems/SquadBattleAi";
import { realTimeBeltDamage } from "../../arcade/systems/SurvivalDurability";
import {
  beltDamageForFrame,
  beltRetreatPoint,
  type BeltConfig,
} from "../../systems/arena/ArenaBoundary";
import { planCombat } from "../../systems/survival/CombatNodePlan";
import type { CombatOutcome } from "../../systems/survival/CombatResolution";
import type { RunState } from "../../systems/survival/RunTypes";
import { SurvivalBattleRules } from "../../systems/survival/SurvivalBattleRules";
import { survivalBelt } from "../../systems/survival/SurvivalBelt";
import { SurvivalRunController } from "../../systems/survival/SurvivalRunController";
import { countSpecialActions } from "../../telemetry/matchStatTypes";
import { createSeededRng } from "../../utils/random";
import {
  livingPlayers,
  resolveNodeCombat,
  findTarget,
  type NodeCombat,
} from "./nodeCombat";
import { ARENA_CENTER, spawnFleet, type NodeShip } from "./nodeShips";
import { spawnBossReinforcements, spawnWave } from "./nodeWaves";
import type { NodeBattle } from "./nodeBattle";

export type { NodeBattle } from "./nodeBattle";

/** The battle intro before the first wave (ADR-0004 durations include it). */
export const NODE_INTRO_MS = 2000;
/** Pause before a node's next wave (scene's NEXT_WAVE_DELAY_MS). */
export const NEXT_WAVE_DELAY_MS = 2500;
/** A node still undecided after this long counts as not cleared. */
export const NODE_TIME_LIMIT_MS = 360_000;

/** How the simulated player treats the asteroid belt. */
export interface NodeSimOptions {
  /**
   * False models a pilot who never strays into the belt (player ships take
   * no belt damage); default true (the scene's autopilot, belt and all).
   */
  readonly playerBeltDamage?: boolean;
}

/** One simulated node battle. */
export interface NodeBattleResult {
  readonly won: boolean;
  readonly timedOut: boolean;
  /** Battle length including the intro (ms). */
  readonly durationMs: number;
  /** The report for completeCombat (meaningful when won). */
  readonly outcome: CombatOutcome;
  readonly kills: number;
  readonly firstKillMs: number | null;
  readonly specialsUsed: number;
  readonly playerShips: number;
  readonly enemyShips: number;
  /** Player ships the asteroid belt destroyed. */
  readonly beltLosses: number;
}

/**
 * @param run - The run with a battle node active.
 * @param options - Belt behaviour of the simulated player.
 * @returns The fought battle.
 */
export function simulateNodeBattle(
  run: RunState,
  options: NodeSimOptions = {},
): NodeBattleResult {
  const battle = openBattle(run, options.playerBeltDamage ?? true);
  let won: boolean | null = null;
  while (won === null && battle.nowMs < NODE_TIME_LIMIT_MS) {
    battle.nowMs += LOGIC_DELTA;
    stepBattle(battle);
    won = decided(battle);
  }
  const survivors = livingPlayers(battle.combat).map((s) => ({
    record: s.record!,
    hull: s.hull,
    maxHull: s.maxHull,
    shields: s.shields,
    maxShields: s.maxShields,
  }));
  return {
    won: won === true,
    timedOut: won === null,
    durationMs: battle.nowMs,
    outcome: battle.rules.outcome(
      survivors,
      battle.controller.level,
      battle.nowMs,
    ),
    kills: battle.rules.killCount,
    firstKillMs: battle.firstKillMs,
    specialsUsed: battle.specialsUsed,
    playerShips: battle.rules.fleet().length,
    enemyShips: battle.enemiesSpawned,
    beltLosses: battle.beltLosses,
  };
}

function openBattle(run: RunState, playerBeltDamage: boolean): NodeBattle {
  const plan = planCombat(run);
  if (!plan) throw new Error(`No battle node is active (run ${run.seed})`);
  const rules = new SurvivalBattleRules(run, plan);
  const controller = SurvivalRunController.fromState(run.seed, run.progression);
  const rng = createSeededRng(plan.combatSeed ^ 0x5bd1e995);
  let belt = survivalBelt(plan.beltSteps);
  const squadAi = new SquadBattleAi({
    worldSize: BATTLEFIELD_SIZE,
    random: () => rng.next(),
    assistMark: true,
    safePointFor: (x, y) => beltRetreatPoint({ x, y }, ARENA_CENTER, belt),
  });
  const battle: NodeBattle = {
    rules,
    controller,
    combat: {
      ships: spawnFleet(rules, controller.bonuses, squadAi, run.faction),
      rules,
      squadAi,
      ledger: new HitImmunityLedger(),
      bonuses: controller.bonuses,
      rng: rules.rng,
      onKill: (victim, byPlayer) => onKill(battle, victim, byPlayer),
      onBossHit: (boss) => spawnBossReinforcements(battle, boss),
    },
    get belt() {
      return belt;
    },
    set belt(next: BeltConfig) {
      belt = next;
    },
    nowMs: 0,
    nextWaveAtMs: NODE_INTRO_MS,
    firstKillMs: null,
    specialsUsed: 0,
    enemiesSpawned: 0,
    beltLosses: 0,
    playerBeltDamage,
    bossPhases: new Map(),
  };
  return battle;
}

function onKill(battle: NodeBattle, victim: NodeShip, byPlayer: boolean): void {
  battle.firstKillMs ??= battle.nowMs;
  battle.combat.ledger.forget(victim.id);
  battle.combat.squadAi.forget(victim.id);
  if (byPlayer && victim.owner === "ai") battle.rules.recordKill(victim.id);
}

function stepBattle(battle: NodeBattle): void {
  const { combat, nowMs } = battle;
  if (battle.nextWaveAtMs !== null && nowMs >= battle.nextWaveAtMs) {
    battle.nextWaveAtMs = null;
    spawnWave(battle);
  }
  combat.squadAi.command(combat.ships, nowMs);
  markLikeAPlayer(battle);
  for (const ship of combat.ships) if (ship.hull > 0) pilot(battle, ship);
  for (const ship of combat.ships) if (ship.hull > 0) fly(battle, ship);
  applyBelt(battle);
  resolveNodeCombat(combat, nowMs, LOGIC_DELTA);
}

/** The scene's autopilot: with no mark up, mark the flagship's target. */
function markLikeAPlayer(battle: NodeBattle): void {
  const { combat, nowMs } = battle;
  const flagship = livingPlayers(combat)[0];
  if (!flagship || combat.squadAi.playerMarkOf(nowMs)) return;
  const target =
    findTarget(combat, flagship, nowMs) ?? nearestEnemy(combat.ships, flagship);
  if (target) combat.squadAi.markTarget(target.id, nowMs);
}

function nearestEnemy(
  ships: readonly NodeShip[],
  ship: NodeShip,
): NodeShip | null {
  let best: NodeShip | null = null;
  let bestDistance = Infinity;
  for (const other of ships) {
    if (other.hull <= 0 || other.owner === ship.owner) continue;
    const distance = Math.hypot(other.x - ship.x, other.y - ship.y);
    if (distance < bestDistance) [best, bestDistance] = [other, distance];
  }
  return best;
}

function pilot(battle: NodeBattle, ship: NodeShip): void {
  const result = battle.combat.squadAi.fly(ship, battle.nowMs, LOGIC_DELTA);
  if (!result) return;
  if (ship.owner === "player")
    battle.specialsUsed += countSpecialActions(result.events);
  setFlight(ship, { motion: result.motion, stress: result.stress });
}

function fly(battle: NodeBattle, ship: NodeShip): void {
  const tick = tickCycleFlight(ship.flight, {
    deltaMs: LOGIC_DELTA,
    worldSize: BATTLEFIELD_SIZE,
    dial: ship.dial,
    cycleMs: CYCLE_DURATION_MS,
    modifiers: stressModifiersOf(ship.modifiers),
  });
  setFlight(ship, tick.state);
  ship.shields = regenerateShields(
    ship.shields,
    ship.maxShields,
    ship.modifiers,
    LOGIC_DELTA,
  );
  if (tick.completed && ship.bot)
    ship.bot.onCycleCommitted(
      tick.state.motion.control.currentManeuver ?? "straight",
    );
}

function setFlight(ship: NodeShip, flight: NodeShip["flight"]): void {
  ship.flight = flight;
  ship.x = flight.motion.x;
  ship.y = flight.motion.y;
  ship.angle = flight.motion.angle;
}

function applyBelt(battle: NodeBattle): void {
  for (const ship of battle.combat.ships) {
    if (ship.hull <= 0) continue;
    if (ship.owner === "player" && !battle.playerBeltDamage) continue;
    const distance = Math.hypot(
      ship.x - ARENA_CENTER.x,
      ship.y - ARENA_CENTER.y,
    );
    const damage = realTimeBeltDamage(
      beltDamageForFrame(distance, battle.belt, LOGIC_DELTA),
    );
    if (damage <= 0) continue;
    ship.hull = Math.max(0, ship.hull - damage);
    if (ship.hull > 0) continue;
    if (ship.owner === "player") battle.beltLosses += 1;
    onKill(battle, ship, false);
  }
}

/**
 * @param battle - The battle.
 * @returns True (cleared), false (fleet lost) or null (still fighting).
 */
function decided(battle: NodeBattle): boolean | null {
  const { combat } = battle;
  if (livingPlayers(combat).length === 0) return false;
  if (battle.nextWaveAtMs !== null) return null;
  if (combat.ships.some((s) => s.owner === "ai" && s.hull > 0)) return null;
  if (battle.rules.onLastWave) return true;
  battle.nextWaveAtMs = battle.nowMs + NEXT_WAVE_DELAY_MS;
  return null;
}
