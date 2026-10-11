/**
 * scenario_match_length — headless measurement of Scenario mode match length
 * with average bots on both sides.
 *
 * Runs each scenario with the skill arena's real engine (BotPilot through the
 * player's controls, SquadCommand orders + marks, CycleFlight, the arena's
 * dice combat under the CombatTempo round model) and the Scenario mode's own
 * layers exactly as the Skirmish scene wires them (ScenarioFrameTracker →
 * stepScenario, ScenarioDirector → BotPilot safe-point goals). Arena combat
 * is the continuous-mode dice model, so kill rates approximate Skirmish's
 * projectile lasers.
 *
 * Usage: npx tsx scripts/scenario_match_length.ts [seedsPerScenario=10]
 */

import { BATTLEFIELD_SIZE } from "../src/config";
import { startManeuver } from "../src/core/ArcadeControls";
import { createSeededRng } from "../src/utils/random";
import { HitImmunityLedger } from "../src/arcade/systems/CombatTempo";
import { NO_SQUAD_MARKS } from "../src/arcade/systems/SquadMark";
import { createSideScore } from "../src/systems/arena/BattleScore";
import {
  emptyTally,
  resolveCombatTick,
  type CombatState,
} from "../src/simulation/skill/ArenaCombat";
import { ENGINE_RULES } from "../src/simulation/skill/ArenaRules";
import {
  commandSquads,
  createSquads,
  flyShip,
  spawnShips,
} from "../src/simulation/skill/ArenaRound";
import {
  contactOf,
  setArenaFlight,
  type ArenaShip,
} from "../src/simulation/skill/ArenaShip";
import { TICK_MS, type BattleSpec } from "../src/simulation/skill/ArenaSpec";
import {
  SCENARIO_DEFINITIONS,
  SCENARIO_IDS,
  createScenarioState,
  deploymentPoses,
  totalPoints,
  type ScenarioId,
  type ScenarioResult,
} from "../src/arcade/scenarios";
import {
  ScenarioFrameTracker,
  isEvasiveFlightEvent,
} from "../src/scenes/scenario/scenarioFrameTracker";
import { ScenarioDirector } from "../src/scenes/scenario/ScenarioDirector";
import { stepScenario } from "../src/arcade/scenarios";

const PLAYER_LIST = [
  "confed_kestrel",
  "confed_falcon",
  "confed_eagle",
  "confed_wasp",
];
const ENEMY_LIST = [
  "corsair_blade",
  "corsair_talon",
  "corsair_marauder",
  "corsair_venom",
];

/** One measured match. */
interface Measured {
  readonly scenario: ScenarioId;
  readonly seed: number;
  readonly result: ScenarioResult;
  readonly pickups: number;
}

function spec(seed: number): BattleSpec {
  const side = (ids: readonly string[]) => ({
    ships: ids.map((definitionId) => ({
      definitionId,
      tier: "average" as const,
    })),
    squad: {},
  });
  return { A: side(PLAYER_LIST), B: side(ENEMY_LIST), seed };
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

function runMatch(scenario: ScenarioId, seed: number): Measured {
  const battle = spec(seed);
  const random = createSeededRng(seed).next;
  const ships = spawnShips(battle, random);
  deploy(ships);
  const squads = createSquads(battle);
  const combat: CombatState = {
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
  const tracker = new ScenarioFrameTracker("A", BATTLEFIELD_SIZE);
  const director = new ScenarioDirector(BATTLEFIELD_SIZE);
  let state = createScenarioState(
    SCENARIO_DEFINITIONS[scenario],
    BATTLEFIELD_SIZE,
  );
  let nowMs = 0;
  let pickups = 0;
  while (!state.result) {
    const contacts = ships.map(contactOf);
    commandSquads(squads, contacts, combat, nowMs);
    director.update({
      nowMs,
      state,
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
    for (const ship of ships) {
      if (!ship.alive) continue;
      const origin = { x: ship.x, y: ship.y };
      const result = ship.pilot.fly({
        self: contacts.find((c) => c.id === ship.id)!,
        flight: ship.flight,
        dial: ship.dial,
        contacts: contacts.filter((c) => c.id !== ship.id),
        order: squads.get(ship.side)?.orderFor(ship.id) ?? null,
        nowMs,
        deltaMs: TICK_MS,
        worldSize: BATTLEFIELD_SIZE,
        safePoint: director.goalFor(ship.id),
      });
      setArenaFlight(ship, { motion: result.motion, stress: result.stress });
      if (result.events.some(isEvasiveFlightEvent))
        tracker.noteEvasive(ship.id, origin);
    }
    for (const ship of ships) if (ship.alive) flyShip(ship);
    nowMs += TICK_MS;
    resolveCombatTick(combat, nowMs, TICK_MS);
    const before = state.crates.filter((c) => c.carrierId).length;
    state = stepScenario(
      state,
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
    pickups += Math.max(
      0,
      state.crates.filter((c) => c.carrierId).length - before,
    );
  }
  return { scenario, seed, result: state.result, pickups };
}

function summarize(runs: readonly Measured[]): void {
  for (const id of SCENARIO_IDS) {
    const own = runs.filter((r) => r.scenario === id);
    const seconds = own
      .map((r) => r.result.elapsedMs / 1000)
      .sort((a, b) => a - b);
    const mean = seconds.reduce((a, b) => a + b, 0) / seconds.length;
    const median = seconds[Math.floor(seconds.length / 2)]!;
    const reasons = new Map<string, number>();
    for (const r of own)
      reasons.set(r.result.reason, (reasons.get(r.result.reason) ?? 0) + 1);
    const objectiveShare =
      own.reduce((sum, r) => {
        const p = r.result.points;
        const total = totalPoints(p.player) + totalPoints(p.enemy);
        return (
          sum +
          (total > 0 ? (p.player.objective + p.enemy.objective) / total : 0)
        );
      }, 0) / own.length;
    const wins = own.filter((r) => r.result.winner === "player").length;
    console.log(
      `${id.padEnd(24)} n=${own.length} mean=${mean.toFixed(0)}s median=${median.toFixed(0)}s ` +
        `min=${seconds[0]!.toFixed(0)}s max=${seconds[seconds.length - 1]!.toFixed(0)}s ` +
        `ends=${[...reasons].map(([k, v]) => `${k}:${v}`).join(",")} ` +
        `objective-share=${(objectiveShare * 100).toFixed(0)}% A-wins=${wins}` +
        (id === "salvage_mission"
          ? ` pickups/match=${(own.reduce((s, r) => s + r.pickups, 0) / own.length).toFixed(1)}`
          : ""),
    );
  }
}

const seeds = Number(process.argv[2] ?? 10);
const runs: Measured[] = [];
for (const id of SCENARIO_IDS) {
  for (let seed = 1; seed <= seeds; seed++) runs.push(runMatch(id, seed));
}
summarize(runs);
