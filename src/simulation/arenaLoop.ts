/**
 * arenaLoop — one arena battle as an open loop the mode sims drive tick by
 * tick (ScenarioMatchSim, ReinforcedBattleSim): the skill arena's ships,
 * squad layers and combat state, a step that runs a scene's frame (squad
 * orders and marks, every BotPilot flying through the player's controls,
 * the cycle engine, own repair and faction auras, secondaries before
 * primaries), and ships joining mid-battle (reinforcements).
 *
 * Mutates the loop. Pure: no Phaser.
 */

import { BATTLEFIELD_SIZE } from "../config";
import { BotPilot } from "../arcade/ai/BotPilot";
import type { BotTier, Pose } from "../arcade/ai/BotTypes";
import type { Point } from "../arcade/ai/AiGeometry";
import type { BotContact } from "../arcade/ai/BotView";
import type { SquadCommand } from "../arcade/ai/SquadCommand";
import type { FlightEvent } from "../arcade/systems/PilotFlightTypes";
import { HitImmunityLedger } from "../arcade/systems/CombatTempo";
import { NO_SQUAD_MARKS } from "../arcade/systems/SquadMark";
import { createSideScore } from "../systems/arena/BattleScore";
import { countSpecialActions } from "../telemetry/matchStatTypes";
import { createSeededRng } from "../utils/random";
import {
  emptyTally,
  resolveCombatTick,
  type CombatState,
} from "./skill/ArenaCombat";
import { ENGINE_RULES } from "./skill/ArenaRules";
import { armArena, resolveWeaponsTick } from "./skill/ArenaWeapons";
import { auraOf, updateArenaAuras } from "./skill/ArenaAuras";
import {
  commandSquads,
  createSquads,
  flyShip,
  spawnShips,
} from "./skill/ArenaRound";
import {
  contactOf,
  setArenaFlight,
  spawnArenaShip,
  type ArenaShip,
} from "./skill/ArenaShip";
import { TICK_MS, type BattleSpec } from "./skill/ArenaSpec";
import type { SideId } from "./skill/ArenaSide";

/** A battle in progress. */
export interface ArenaLoop {
  readonly ships: ArenaShip[];
  readonly squads: Map<SideId, SquadCommand>;
  readonly combat: CombatState;
  readonly random: () => number;
  /** Battle time (ms). */
  nowMs: number;
}

/** How a side's AI flies (BotDifficulty.BotSkill). */
export interface SideSkill {
  readonly tier: BotTier;
  readonly reactionScale: number;
}

/** A ship joining a running battle. */
export interface LoopArrival {
  readonly id: string;
  readonly side: SideId;
  readonly definitionId: string;
  readonly loadoutId: string | null;
  readonly skill: SideSkill;
  readonly pose: Pose;
  /** Fly without the faction's identity levers (balance ablation). */
  readonly withoutIdentity?: boolean;
}

/** Optional per-frame hooks of a mode (scenario goals, evasive flying). */
export interface LoopHooks {
  /** A ship's objective goal this frame (BotPilot safe point), or null. */
  readonly goalFor?: (shipId: string) => Point | null;
  /** A ship flew a frame (its flight events, from where). */
  readonly onFlown?: (
    ship: ArenaShip,
    events: readonly FlightEvent[],
    origin: Point,
  ) => void;
}

/**
 * @param spec - The opening sides (ships, squads) and the seed.
 * @returns The armed battle at time 0 (spawned on the arena layout).
 */
export function createArenaLoop(spec: BattleSpec): ArenaLoop {
  const random = createSeededRng(spec.seed).next;
  const ships = spawnShips(spec, random);
  const combat: CombatState = {
    ships,
    ledger: new HitImmunityLedger(),
    rules: spec.rules ?? ENGINE_RULES,
    worldSize: BATTLEFIELD_SIZE,
    random,
    scores: { A: createSideScore(), B: createSideScore() },
    tallies: { A: emptyTally(), B: emptyTally() },
    recentHits: new Map(),
    marks: NO_SQUAD_MARKS,
  };
  armArena(combat);
  return { ships, squads: createSquads(spec), combat, random, nowMs: 0 };
}

/**
 * A ship joins the battle (equipped, armed, flown by a bot of its skill).
 * @param loop - The battle (mutated).
 * @param arrival - Who, for which side, where.
 * @returns The new ship.
 */
export function addShip(loop: ArenaLoop, arrival: LoopArrival): ArenaShip {
  const ship = spawnArenaShip({
    id: arrival.id,
    side: arrival.side,
    definitionId: arrival.definitionId,
    pose: arrival.pose,
    loadoutId: arrival.loadoutId,
    ...(arrival.withoutIdentity ? { withoutIdentity: true } : {}),
    pilot: new BotPilot(arrival.skill.tier, {
      random: loop.random,
      reactionScale: arrival.skill.reactionScale,
    }),
  });
  loop.ships.push(ship);
  loop.combat.weapons?.equip(ship.id, {
    definitionId: ship.definitionId,
    loadoutId: ship.loadoutId,
    modifiers: ship.modifiers,
    upgradeIds: ship.upgradeIds,
  });
  return ship;
}

/**
 * One frame of the battle, as a scene runs it.
 * @param loop - The battle (mutated).
 * @param hooks - The mode's goals and flight-event listener.
 */
export function stepArenaLoop(loop: ArenaLoop, hooks: LoopHooks = {}): void {
  const { ships, combat } = loop;
  const contacts = ships.map(contactOf);
  commandSquads(loop.squads, contacts, combat, loop.nowMs);
  for (const ship of ships)
    if (ship.alive) pilotFrame(loop, ship, contacts, hooks);
  for (const ship of ships)
    if (ship.alive) flyShip(ship, undefined, auraOf(combat, ship.id));
  loop.nowMs += TICK_MS;
  updateArenaAuras(combat, TICK_MS);
  resolveWeaponsTick(combat, loop.nowMs, TICK_MS);
  resolveCombatTick(combat, loop.nowMs, TICK_MS);
}

/**
 * @param loop - The battle.
 * @param side - A side.
 * @returns Its living ships.
 */
export function livingOf(loop: ArenaLoop, side: SideId): ArenaShip[] {
  return loop.ships.filter((ship) => ship.alive && ship.side === side);
}

function pilotFrame(
  loop: ArenaLoop,
  ship: ArenaShip,
  contacts: readonly BotContact[],
  hooks: LoopHooks,
): void {
  const origin = { x: ship.x, y: ship.y };
  const result = ship.pilot.fly({
    self: contacts.find((c) => c.id === ship.id)!,
    flight: ship.flight,
    dial: ship.dial,
    contacts: contacts.filter((c) => c.id !== ship.id),
    order: loop.squads.get(ship.side)?.orderFor(ship.id) ?? null,
    nowMs: loop.nowMs,
    deltaMs: TICK_MS,
    worldSize: BATTLEFIELD_SIZE,
    ...(hooks.goalFor ? { safePoint: hooks.goalFor(ship.id) } : {}),
  });
  ship.specialsUsed += countSpecialActions(result.events);
  setArenaFlight(ship, { motion: result.motion, stress: result.stress });
  hooks.onFlown?.(ship, result.events, origin);
}
