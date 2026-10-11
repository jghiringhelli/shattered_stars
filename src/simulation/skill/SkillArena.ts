/**
 * SkillArena — headless, deterministic battles between bot pilots flying the
 * real engine: PilotHands → PilotFlightControls (the human inputs),
 * CycleFlight (template arcs, cycle commits, stress), ArenaCombat (the dice
 * modes' combat under the CombatTempo round model). Fixed 60 Hz tick, one
 * seeded RNG per battle, elimination or timeout decided by BattleScore.
 *
 * Pure: no Phaser.
 */

import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS } from "../../config";
import { createSeededRng } from "../../utils/random";
import { HitImmunityLedger } from "../../arcade/systems/CombatTempo";
import {
  clearMark,
  NO_SQUAD_MARKS,
  placeMark,
} from "../../arcade/systems/SquadMark";
import { tickCycleFlight } from "../../arcade/systems/CycleFlight";
import {
  regenerateShields,
  stressModifiersOf,
} from "../../arcade/systems/QuickBuildEquip";
import {
  createSideScore,
  resolveByPoints,
  type SideScore,
} from "../../systems/arena/BattleScore";
import {
  emptyTally,
  resolveCombatTick,
  type CombatState,
  type SideTally,
} from "./ArenaCombat";
import { spawnLayout } from "./ArenaLayout";
import { ENGINE_RULES, type ArenaRules } from "./ArenaRules";
import {
  ownViewOf,
  setArenaFlight,
  snapshotOf,
  spawnArenaShip,
  type ArenaShip,
} from "./ArenaShip";
import { SnapshotHistory } from "./Perception";
import type { PilotBot, SideId, SquadBrain, SquadOrder } from "./SkillTypes";

/** Fixed simulation step: 60 Hz (ms). */
export const TICK_MS = 1000 / 60;

/** Default game-time limit of a battle (ms). */
export const DEFAULT_TIME_LIMIT_MS = 180_000;

/** How often a squad brain re-plans (ms). */
export const SQUAD_PLAN_INTERVAL_MS = CYCLE_DURATION_MS / 2;

/** One ship of a side: its hull, its pilot and optionally its quick build. */
export interface ShipEntry {
  readonly definitionId: string;
  readonly bot: PilotBot;
  /** Quick build; omitted = the default one. */
  readonly loadoutId?: string | null;
}

/** One side of a battle. */
export interface SideSpec {
  readonly ships: readonly ShipEntry[];
  /** Shared tactical layer, or null for pilots flying on their own. */
  readonly squad: SquadBrain | null;
}

/** A battle to run. */
export interface BattleSpec {
  readonly A: SideSpec;
  readonly B: SideSpec;
  readonly seed: number;
  readonly timeLimitMs?: number;
  readonly rules?: ArenaRules;
}

/** How a battle ended. */
export interface BattleResult {
  readonly seed: number;
  readonly winner: SideId | "draw";
  readonly endedBy: "elimination" | "timeout";
  readonly durationMs: number;
  readonly scores: Readonly<Record<SideId, SideScore>>;
  readonly tallies: Readonly<Record<SideId, SideTally>>;
  readonly survivors: Readonly<Record<SideId, number>>;
}

const SIDES: readonly SideId[] = ["A", "B"];

/**
 * Run one battle to elimination or the time limit.
 * @param spec - Sides, seed, time limit and rules.
 * @returns Winner, duration, scores and gunnery tallies.
 */
export function runBattle(spec: BattleSpec): BattleResult {
  const random = createSeededRng(spec.seed).next;
  const ships = spawnShips(spec, random);
  const maxDelay = Math.max(
    ...ships.map((s) => s.pilot.bot.profile.reactionMs),
    squadDelay(spec),
  );
  const history = new SnapshotHistory(maxDelay, BATTLEFIELD_SIZE);
  const state: CombatState = {
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
  const orders = new Map<string, SquadOrder>();
  const limit = spec.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS;
  let nowMs = 0;
  let nextPlanMs = 0;
  while (nowMs < limit) {
    history.record(nowMs, ships.map(snapshotOf));
    if (nowMs >= nextPlanMs) {
      planSquads(spec, state, history, orders, nowMs);
      nextPlanMs += SQUAD_PLAN_INTERVAL_MS;
    }
    for (const ship of ships)
      if (ship.alive) pilotShip(ship, history, orders, nowMs, random);
    for (const ship of ships) if (ship.alive) flyShip(ship);
    nowMs += TICK_MS;
    resolveCombatTick(state, nowMs, TICK_MS);
    const winner = eliminationWinner(ships, state);
    if (winner) return resultOf(spec.seed, winner, "elimination", nowMs, state);
  }
  const outcome = resolveByPoints(state.scores.A, state.scores.B);
  const winner = outcome === "side1" ? "A" : outcome === "side2" ? "B" : "draw";
  return resultOf(spec.seed, winner, "timeout", nowMs, state);
}

/**
 * @param spec - The battle.
 * @returns The longest perception delay of either squad brain (ms).
 */
function squadDelay(spec: BattleSpec): number {
  return Math.max(spec.A.squad?.reactionMs ?? 0, spec.B.squad?.reactionMs ?? 0);
}

/**
 * @param spec - The battle.
 * @param random - Seeded source.
 * @returns Every ship spawned, side A first.
 */
function spawnShips(spec: BattleSpec, random: () => number): ArenaShip[] {
  const layout = spawnLayout(
    spec.A.ships.length,
    spec.B.ships.length,
    BATTLEFIELD_SIZE,
    random,
  );
  return SIDES.flatMap((side) =>
    spec[side].ships.map((entry, index) =>
      spawnArenaShip({
        id: `${side}${index}`,
        side,
        definitionId: entry.definitionId,
        pose: layout[side][index]!,
        bot: entry.bot,
        firstDecisionMs: random() * entry.bot.profile.decisionIntervalMs,
        ...(entry.loadoutId !== undefined
          ? { loadoutId: entry.loadoutId }
          : {}),
      }),
    ),
  );
}

/**
 * Refresh every squad brain's orders from its delayed picture; the brain
 * (the squad's leader) marks its focus target (SquadMark).
 * @param spec - The battle.
 * @param state - Combat state (ships; marks mutated).
 * @param history - Snapshot history.
 * @param orders - Orders per ship (mutated).
 * @param nowMs - Arena time (ms).
 */
function planSquads(
  spec: BattleSpec,
  state: CombatState,
  history: SnapshotHistory,
  orders: Map<string, SquadOrder>,
  nowMs: number,
): void {
  for (const side of SIDES) {
    const brain = spec[side].squad;
    if (!brain) continue;
    const own = state.ships
      .filter((s) => s.side === side && s.alive)
      .map(snapshotOf);
    const enemies = history
      .perceive(nowMs, brain.reactionMs, "")
      .filter((s) => s.side !== side);
    let focusId: string | null = null;
    for (const [id, order] of brain.plan(own, enemies)) {
      orders.set(id, order);
      focusId = order.focusTargetId ?? focusId;
    }
    state.marks = focusId
      ? placeMark(state.marks, side, focusId, nowMs)
      : clearMark(state.marks, side);
  }
}

/**
 * The pilot decides when due, then its hands press this frame's keys.
 * @param ship - The ship.
 * @param history - Snapshot history.
 * @param orders - Squad orders per ship.
 * @param nowMs - Arena time (ms).
 * @param random - Seeded source.
 */
function pilotShip(
  ship: ArenaShip,
  history: SnapshotHistory,
  orders: ReadonlyMap<string, SquadOrder>,
  nowMs: number,
  random: () => number,
): void {
  const { pilot } = ship;
  if (nowMs >= pilot.nextDecisionMs) {
    const others = history.perceive(
      nowMs,
      pilot.bot.profile.reactionMs,
      ship.id,
    );
    const view = {
      nowMs,
      worldSize: BATTLEFIELD_SIZE,
      self: ownViewOf(ship),
      allies: others.filter((s) => s.side === ship.side),
      enemies: others.filter((s) => s.side !== ship.side),
      order: orders.get(ship.id) ?? null,
    };
    pilot.hands.setIntent(pilot.bot.decide(view, random));
    pilot.nextDecisionMs += pilot.bot.profile.decisionIntervalMs;
  }
  const { motion, stress } = ship.flight;
  const result = pilot.hands.fly({
    flown: { ship: motion, motion, stress, dial: ship.dial },
    nowMs,
    deltaMs: TICK_MS,
    worldSize: BATTLEFIELD_SIZE,
  });
  setArenaFlight(ship, { motion: result.motion, stress: result.stress });
}

/**
 * Fly one tick on the cycle engine; tell the hands when a cycle commits.
 * @param ship - The ship.
 */
function flyShip(ship: ArenaShip): void {
  const tick = tickCycleFlight(ship.flight, {
    deltaMs: TICK_MS,
    worldSize: BATTLEFIELD_SIZE,
    dial: ship.dial,
    cycleMs: CYCLE_DURATION_MS,
    modifiers: stressModifiersOf(ship.modifiers),
  });
  setArenaFlight(ship, tick.state);
  ship.shields = regenerateShields(
    ship.shields,
    ship.maxShields,
    ship.modifiers,
    TICK_MS,
  );
  if (tick.completed) {
    ship.pilot.hands.onCycleCommitted(
      tick.state.motion.control.currentManeuver ?? "straight",
    );
  }
}

/**
 * @param ships - All ships.
 * @param state - Combat state (scores break a mutual wipe-out).
 * @returns The side left standing, "draw" on a mutual wipe-out, or null.
 */
function eliminationWinner(
  ships: readonly ArenaShip[],
  state: CombatState,
): SideId | "draw" | null {
  const aliveA = ships.some((s) => s.alive && s.side === "A");
  const aliveB = ships.some((s) => s.alive && s.side === "B");
  if (aliveA && aliveB) return null;
  if (aliveA) return "A";
  if (aliveB) return "B";
  const outcome = resolveByPoints(state.scores.A, state.scores.B);
  return outcome === "side1" ? "A" : outcome === "side2" ? "B" : "draw";
}

/**
 * @returns The battle's result record.
 */
function resultOf(
  seed: number,
  winner: SideId | "draw",
  endedBy: BattleResult["endedBy"],
  durationMs: number,
  state: CombatState,
): BattleResult {
  const survivors = (side: SideId): number =>
    state.ships.filter((s) => s.alive && s.side === side).length;
  return {
    seed,
    winner,
    endedBy,
    durationMs,
    scores: state.scores,
    tallies: state.tallies,
    survivors: { A: survivors("A"), B: survivors("B") },
  };
}
