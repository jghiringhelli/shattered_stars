/**
 * ScenarioMatchSim — one headless Scenario-mode match with bots on both
 * sides, on the skill arena's real engine (BotPilot through the player's
 * controls, SquadCommand orders + marks, CycleFlight, the arena's dice
 * combat under the CombatTempo round model) and the Scenario mode's own
 * layers exactly as the Skirmish scene wires them (ScenarioFrameTracker →
 * stepScenario, ScenarioDirector → BotPilot safe-point goals). Arena combat
 * is the continuous-mode dice model, so kill rates approximate Skirmish's
 * projectile lasers.
 *
 * Pure: no Phaser.
 */

import { BATTLEFIELD_SIZE } from "../config";
import { startManeuver } from "../core/ArcadeControls";
import { createSeededRng } from "../utils/random";
import { HitImmunityLedger } from "../arcade/systems/CombatTempo";
import { NO_SQUAD_MARKS } from "../arcade/systems/SquadMark";
import type { BotTier } from "../arcade/ai/BotTypes";
import { createSideScore } from "../systems/arena/BattleScore";
import {
  SCENARIO_DEFINITIONS,
  createScenarioState,
  deploymentPoses,
  stepScenario,
  type ScenarioId,
  type ScenarioResult,
  type ScenarioState,
} from "../arcade/scenarios";
import {
  ScenarioFrameTracker,
  isEvasiveFlightEvent,
} from "../scenes/scenario/scenarioFrameTracker";
import { ScenarioDirector } from "../scenes/scenario/ScenarioDirector";
import { countSpecialActions } from "../telemetry/matchStatTypes";
import {
  emptyTally,
  resolveCombatTick,
  type CombatState,
} from "./skill/ArenaCombat";
import { ENGINE_RULES } from "./skill/ArenaRules";
import {
  commandSquads,
  createSquads,
  flyShip,
  spawnShips,
} from "./skill/ArenaRound";
import { contactOf, setArenaFlight, type ArenaShip } from "./skill/ArenaShip";
import { TICK_MS, type BattleSpec } from "./skill/ArenaSpec";
import type { SideTally } from "./skill/ArenaCombatState";
import type { SquadCommand } from "../arcade/ai/SquadCommand";
import type { SideId } from "./skill/ArenaSide";

/** The player's list in every measured scenario (Free Confederation). */
export const SCENARIO_PLAYER_LIST: readonly string[] = [
  "confed_kestrel",
  "confed_falcon",
  "confed_eagle",
  "confed_wasp",
];
/** The enemy's list (Void Corsairs). */
export const SCENARIO_ENEMY_LIST: readonly string[] = [
  "corsair_blade",
  "corsair_talon",
  "corsair_marauder",
  "corsair_venom",
];

/** Pilot tiers of the player's side (A) and the enemy's (B). */
export interface ScenarioTiers {
  readonly player: BotTier;
  readonly enemy: BotTier;
}

/** One measured match. */
export interface ScenarioMatch {
  readonly scenario: ScenarioId;
  readonly seed: number;
  readonly result: ScenarioResult;
  readonly pickups: number;
  /** Real time of the first kill (ms), or null. */
  readonly firstKillMs: number | null;
  readonly specialsUsed: number;
  readonly tallies: Readonly<Record<SideId, SideTally>>;
}

const AVERAGE_TIERS: ScenarioTiers = { player: "average", enemy: "average" };

function spec(seed: number, tiers: ScenarioTiers): BattleSpec {
  const side = (ids: readonly string[], tier: BotTier) => ({
    ships: ids.map((definitionId) => ({ definitionId, tier })),
    squad: {},
  });
  return {
    A: side(SCENARIO_PLAYER_LIST, tiers.player),
    B: side(SCENARIO_ENEMY_LIST, tiers.enemy),
    seed,
  };
}

function deploy(ships: ArenaShip[]): void {
  for (const sideId of ["A", "B"] as const) {
    const own = ships.filter((s) => s.side === sideId);
    const poses = deploymentPoses(
      own.length,
      sideId === "A" ? "player" : "enemy",
      BATTLEFIELD_SIZE,
    );
    own.forEach((ship, i) => {
      const pose = poses[i]!;
      const control = startManeuver(
        pose,
        ship.flight.motion.control,
        "straight",
      );
      setArenaFlight(ship, { ...ship.flight, motion: { ...pose, control } });
    });
  }
}

interface MatchLoop {
  readonly ships: ArenaShip[];
  readonly squads: Map<SideId, SquadCommand>;
  readonly combat: CombatState;
  readonly tracker: ScenarioFrameTracker;
  readonly director: ScenarioDirector;
  state: ScenarioState;
  nowMs: number;
  pickups: number;
}

/**
 * Play one scenario to its result.
 *
 * @param scenario - Scenario id.
 * @param seed - Battle seed.
 * @param tiers - Pilot tiers per side (average both by default).
 * @returns The result and the match's combat stats.
 */
export function runScenarioMatch(
  scenario: ScenarioId,
  seed: number,
  tiers: ScenarioTiers = AVERAGE_TIERS,
): ScenarioMatch {
  const battle = spec(seed, tiers);
  const random = createSeededRng(seed).next;
  const ships = spawnShips(battle, random);
  deploy(ships);
  const loop: MatchLoop = {
    ships,
    squads: createSquads(battle),
    combat: newCombat(ships, random),
    tracker: new ScenarioFrameTracker("A", BATTLEFIELD_SIZE),
    director: new ScenarioDirector(BATTLEFIELD_SIZE),
    state: createScenarioState(
      SCENARIO_DEFINITIONS[scenario],
      BATTLEFIELD_SIZE,
    ),
    nowMs: 0,
    pickups: 0,
  };
  while (!loop.state.result) stepMatch(loop);
  return {
    scenario,
    seed,
    result: loop.state.result,
    pickups: loop.pickups,
    firstKillMs: loop.combat.firstKillAtMs ?? null,
    specialsUsed: ships.reduce((sum, s) => sum + s.specialsUsed, 0),
    tallies: loop.combat.tallies,
  };
}

function newCombat(ships: ArenaShip[], random: () => number): CombatState {
  return {
    ships,
    ledger: new HitImmunityLedger(),
    rules: ENGINE_RULES,
    worldSize: BATTLEFIELD_SIZE,
    random,
    scores: { A: createSideScore(), B: createSideScore() },
    tallies: { A: emptyTally(), B: emptyTally() },
    recentHits: new Map(),
    marks: NO_SQUAD_MARKS,
  };
}

function stepMatch(loop: MatchLoop): void {
  const { ships, squads, combat, director, tracker } = loop;
  const contacts = ships.map(contactOf);
  commandSquads(squads, contacts, combat, loop.nowMs);
  director.update({
    nowMs: loop.nowMs,
    state: loop.state,
    ships: ships
      .filter((s) => s.alive)
      .map((s) => ({
        id: s.id,
        side: s.side === "A" ? "player" : "enemy",
        x: s.x,
        y: s.y,
        isHuman: false,
      })),
    markActive: false,
  });
  for (const ship of ships)
    if (ship.alive) pilotScenarioShip(loop, ship, contacts);
  for (const ship of ships) if (ship.alive) flyShip(ship);
  loop.nowMs += TICK_MS;
  resolveCombatTick(combat, loop.nowMs, TICK_MS);
  const before = loop.state.crates.filter((c) => c.carrierId).length;
  loop.state = stepScenario(
    loop.state,
    tracker.build(
      ships.map((s) => ({
        ...s,
        faction: s.side,
        hull: s.alive ? s.hull : 0,
        stress: { isStressed: s.flight.stress.isStressed },
      })),
      TICK_MS,
    ),
  );
  loop.pickups += Math.max(
    0,
    loop.state.crates.filter((c) => c.carrierId).length - before,
  );
}

function pilotScenarioShip(
  loop: MatchLoop,
  ship: ArenaShip,
  contacts: ReturnType<typeof contactOf>[],
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
    safePoint: loop.director.goalFor(ship.id),
  });
  ship.specialsUsed += countSpecialActions(result.events);
  setArenaFlight(ship, { motion: result.motion, stress: result.stress });
  if (result.events.some(isEvasiveFlightEvent))
    loop.tracker.noteEvasive(ship.id, origin);
}
