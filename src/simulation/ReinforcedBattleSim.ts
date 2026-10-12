/**
 * ReinforcedBattleSim — one headless reinforcement-pool battle (the default
 * Skirmish battle type, and Scenario's) on the skill arena's real engine
 * (arenaLoop), with the pure ReinforcementDirector wired the way the
 * Skirmish scene's ReinforcementController wires it: opening squads
 * registered (side A = the player's faction: its first ship is the
 * player's, the rest wingmen; side B = the AI), losses reported, every
 * deployment spawned at its side's edge (or scenario line), the player's
 * picker answered at once with its default row (a human who picks fast),
 * and the director's outcome — or, with a scenario, the scenario's result
 * with the reinforced annihilation rule.
 *
 * Not modelled: arrival protection (one cycle of immunity on warp-in).
 *
 * Pure: no Phaser.
 */

import { BATTLEFIELD_SIZE } from "../config";
import type { FactionId } from "../config";
import {
  ReinforcementDirector,
  rulesFor,
  type Deployment,
  type ReinforcedResult,
  type StrategyId,
} from "../arcade/reinforcements";
import {
  SCENARIO_DEFINITIONS,
  reinforcedScenarioDefinition,
  totalPoints,
  type ScenarioId,
  type ScenarioResult,
} from "../arcade/scenarios";
import {
  buildDirectorSetup,
  openingRegistrations,
  reinforcementPose,
  sideOrder,
  type OpeningShip,
} from "../scenes/arcadeBattle/reinforcements/reinforcementSetup";
import {
  addShip,
  createArenaLoop,
  stepArenaLoop,
  type ArenaLoop,
  type LoopHooks,
} from "./arenaLoop";
import { crewSlotSkill, type CrewSkill } from "./crewSkill";
import {
  createScenarioRun,
  deployOnScenarioLines,
  directScenario,
  scenarioHooks,
  scoreScenario,
  type ScenarioRun,
} from "./scenarioRun";
import { teamKey } from "../arcade/teams";
import { sideOf, type SquadList } from "./balance/squadLists";
import type { SideId } from "./skill/ArenaSide";

/** One side of a reinforced battle. */
export interface ReinforcedSideSpec {
  /** The opening squad (its faction is the side's). */
  readonly opening: SquadList;
  readonly strategy: StrategyId;
  /** One skill for every pilot, or a difficulty's slot plan (reinforcements continue the slots). */
  readonly skill: CrewSkill;
}

/** A reinforced battle to run. */
export interface ReinforcedBattleSpec {
  /** Side A: the player's faction (player ship + wingmen + reserve). */
  readonly player: ReinforcedSideSpec;
  /** Side B: the AI faction (strategy rotation). */
  readonly enemy: ReinforcedSideSpec;
  readonly seed: number;
  /** Play a scenario's reinforced variant instead of Skirmish. */
  readonly scenario?: ScenarioId;
}

/** How a reinforced battle ended. */
export interface ReinforcedBattleResult {
  readonly seed: number;
  readonly winner: "player" | "enemy" | "draw";
  /** "exhaustion" / "time" (Skirmish), or the scenario's reason. */
  readonly endedBy: string;
  readonly durationMs: number;
  readonly deployments: Readonly<Record<SideId, number>>;
  readonly destroyedPoints: Readonly<Record<SideId, number>>;
  /** Scenario battles: the final score per side. */
  readonly scenarioScore?: Readonly<Record<SideId, number>>;
}

/** Each arena side is its own team and its own (single) squad. */
const TEAM: Readonly<Record<SideId, number>> = { A: 0, B: 1 };

/** Safety stop: no reinforced battle outlasts this (ms). */
const HARD_STOP_MS = 400_000;

interface ReinforcedLoop {
  readonly loop: ArenaLoop;
  readonly director: ReinforcementDirector;
  readonly factions: Readonly<Record<SideId, FactionId>>;
  readonly sides: readonly string[];
  readonly skills: Readonly<Record<SideId, CrewSkill>>;
  /** Pilots crewed per side so far (the next ship's slot). */
  readonly crewed: Record<SideId, number>;
  readonly alive: Set<string>;
  readonly deployments: Record<SideId, number>;
  readonly scenario: ScenarioRun | null;
}

/**
 * Play one reinforced battle to its end.
 * @param spec - Both sides, the seed and an optional scenario.
 * @returns Winner, how and when it ended, deployments, destroyed points.
 */
export function runReinforcedBattle(
  spec: ReinforcedBattleSpec,
): ReinforcedBattleResult {
  const state = createReinforcedLoop(spec);
  const hooks: LoopHooks = state.scenario ? scenarioHooks(state.scenario) : {};
  while (state.loop.nowMs < HARD_STOP_MS) {
    if (state.scenario) directScenario(state.scenario, state.loop);
    stepArenaLoop(state.loop, hooks);
    reinforce(state);
    if (state.scenario) {
      scoreScenario(state.scenario, state.loop, reservesOf(state.director));
      if (state.scenario.state.result)
        return scenarioResultOf(spec, state, state.scenario.state.result);
    } else if (state.director.result) {
      return skirmishResultOf(spec, state, state.director.result);
    }
  }
  throw new Error(`reinforced battle ${spec.seed} never ended`);
}

function createReinforcedLoop(spec: ReinforcedBattleSpec): ReinforcedLoop {
  const loop = createArenaLoop({
    A: sideOf(spec.player.opening, spec.player.skill),
    B: sideOf(spec.enemy.opening, spec.enemy.skill),
    seed: spec.seed,
  });
  if (spec.scenario) deployOnScenarioLines(loop.ships);
  const factions = {
    A: spec.player.opening.faction,
    B: spec.enemy.opening.faction,
  };
  const opening = openingShips(loop, factions);
  // The player flies side A's first ship; the rest of A are wingmen.
  const humans = new Map([[TEAM.A, opening[0]!.id]]);
  const director = new ReinforcementDirector(
    buildDirectorSetup({
      setup: {
        rules: rulesFor(spec.scenario ? "scenario" : "skirmish"),
        squads: [
          {
            faction: factions.A,
            strategy: spec.player.strategy,
            reserve: null,
          },
          { faction: factions.B, strategy: spec.enemy.strategy, reserve: null },
        ],
      },
      playerTeam: TEAM.A,
      squadTeams: [TEAM.A, TEAM.B],
      humanSquads: humans,
      ships: opening,
      ownsOutcome: !spec.scenario,
      nextShipId: idSource(loop),
    }),
  );
  for (const reg of openingRegistrations(opening, humans))
    director.registerInitial(reg.shipId, reg.member, reg.option, reg.pilot);
  return {
    loop,
    director,
    factions,
    sides: sideOrder(TEAM.A, [TEAM.A, TEAM.B]).map(teamKey),
    skills: { A: spec.player.skill, B: spec.enemy.skill },
    crewed: {
      A: spec.player.opening.ships.length,
      B: spec.enemy.opening.ships.length,
    },
    alive: new Set(loop.ships.map((s) => s.id)),
    deployments: { A: 0, B: 0 },
    scenario: spec.scenario
      ? createScenarioRun(
          reinforcedScenarioDefinition(SCENARIO_DEFINITIONS[spec.scenario]),
        )
      : null,
  };
}

function openingShips(
  loop: ArenaLoop,
  factions: Readonly<Record<SideId, FactionId>>,
): OpeningShip[] {
  return loop.ships.map((ship) => ({
    id: ship.id,
    faction: factions[ship.side],
    team: TEAM[ship.side],
    squad: TEAM[ship.side],
    definitionId: ship.definitionId,
    loadoutId: ship.loadoutId,
  }));
}

function idSource(loop: ArenaLoop): () => string {
  let next = 0;
  return () => {
    let id = `R${next++}`;
    while (loop.ships.some((s) => s.id === id)) id = `R${next++}`;
    return id;
  };
}

/** Losses reported, the director ticked, its deployments (and the picker's) spawned. */
function reinforce(state: ReinforcedLoop): void {
  for (const id of [...state.alive]) {
    const ship = state.loop.ships.find((s) => s.id === id);
    if (ship?.alive) continue;
    state.alive.delete(id);
    state.director.shipDestroyed(id);
  }
  const arrivals = state.director.tick(TICK_DELTA_MS);
  const picked = state.director.picker ? state.director.choose(0) : null;
  for (const deployment of picked ? [...arrivals, picked] : arrivals)
    spawn(state, deployment);
}

/** The arena's fixed step (ms). */
const TICK_DELTA_MS = 1000 / 60;

function spawn(state: ReinforcedLoop, deployment: Deployment): void {
  const side: SideId = deployment.side === state.sides[0] ? "A" : "B";
  const ship = addShip(state.loop, {
    id: deployment.shipId,
    side,
    definitionId: deployment.option.definitionId,
    loadoutId: deployment.option.loadoutId,
    skill: crewSlotSkill(state.skills[side], state.crewed[side]++),
    pose: reinforcementPose({
      side: deployment.side,
      slot: deployment.slot,
      sides: state.sides,
      worldSize: BATTLEFIELD_SIZE,
      scenario: state.scenario !== null,
    }),
  });
  state.alive.add(ship.id);
  state.deployments[side] += 1;
}

function reservesOf(
  director: ReinforcementDirector,
): Readonly<Record<"player" | "enemy", boolean>> {
  return {
    player: director.canField("player"),
    enemy: director.canField("enemy"),
  };
}

function destroyedOf(state: ReinforcedLoop): Record<SideId, number> {
  const stats = state.director.matchStats();
  return { A: stats.player.destroyedPoints, B: stats.enemy.destroyedPoints };
}

function skirmishResultOf(
  spec: ReinforcedBattleSpec,
  state: ReinforcedLoop,
  result: ReinforcedResult,
): ReinforcedBattleResult {
  return {
    seed: spec.seed,
    winner: result.winner,
    endedBy: result.reason,
    durationMs: state.loop.nowMs,
    deployments: { ...state.deployments },
    destroyedPoints: destroyedOf(state),
  };
}

function scenarioResultOf(
  spec: ReinforcedBattleSpec,
  state: ReinforcedLoop,
  result: ScenarioResult,
): ReinforcedBattleResult {
  return {
    seed: spec.seed,
    winner: result.winner,
    endedBy: result.reason,
    durationMs: state.loop.nowMs,
    deployments: { ...state.deployments },
    destroyedPoints: destroyedOf(state),
    scenarioScore: {
      A: totalPoints(result.points.player),
      B: totalPoints(result.points.enemy),
    },
  };
}
