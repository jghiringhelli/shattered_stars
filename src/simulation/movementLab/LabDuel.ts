/**
 * LabDuel — a lab pilot chases a novice bot (both on the same steering
 * engine, no weapons) and the lab counts how often the novice sits in the
 * lab pilot's firing wedge: what the engine gives a player who is trying to
 * line up shots.
 *
 * Pure: no Phaser; deterministic per seed.
 */

import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS } from "../../config";
import { BotPilot } from "../../arcade/ai/BotPilot";
import { offNoseDeg, torusOffset } from "../../arcade/ai/AiGeometry";
import type { BotContact } from "../../arcade/ai/BotView";
import { tickCycleFlight } from "../../arcade/systems/CycleFlight";
import type { SteeringMode } from "../../core/steeringMode";
import { createSeededRng } from "../../utils/random";
import { setupOf, type LabConfig } from "./LabMetrics";
import { createLabPilot, type LabPilotKind } from "./LabPilot";
import { createLabShip, stepLabShip, TICK_MS, type LabShip } from "./LabShip";

/** Full width of the firing wedge (°). */
export const WEDGE_ARC_DEG = 75;
/** Range of the firing wedge (px). */
export const WEDGE_RANGE_PX = 250;
/** Distance the novice starts from the lab pilot (px). */
const START_DISTANCE_PX = 600;

/** What a batch of duels measured. */
export interface DuelResult {
  /** Share of the time the novice is in the lab pilot's wedge (%). */
  readonly wedgePercent: number;
  /** Cycles per minute with the novice in the wedge at some moment: shots the pilot could take. */
  readonly shotsPerMinute: number;
  /** Barrel rolls flown by accident per minute. */
  readonly rollsPerMinute: number;
}

/**
 * @param id - Ship id.
 * @param ship - Its flown state.
 * @param side - Side key.
 * @returns The ship as the bot sees it.
 */
function contactOfShip(id: string, ship: LabShip, side: "A" | "B"): BotContact {
  const { motion } = ship.flight;
  return {
    id,
    side,
    definitionId: id,
    x: motion.x,
    y: motion.y,
    angle: motion.angle,
    alive: true,
    hull: 1,
    maxHull: 1,
    shields: 0,
    maxShields: 0,
    firingArcDeg: WEDGE_ARC_DEG,
    weaponRange: WEDGE_RANGE_PX,
    speed: motion.control.speed,
  };
}

/**
 * Fly the novice one tick through its hands, then the cycle engine.
 *
 * @param bot - The novice's pilot.
 * @param novice - Its ship.
 * @param lab - The lab pilot's ship (a contact for the bot).
 * @param nowMs - Lab time (ms).
 * @returns The novice's ship after the tick.
 */
function stepNovice(
  bot: BotPilot,
  novice: LabShip,
  lab: LabShip,
  nowMs: number,
): LabShip {
  const result = bot.fly({
    self: contactOfShip("B", novice, "B"),
    flight: novice.flight,
    dial: novice.dial,
    contacts: [contactOfShip("A", lab, "A")],
    nowMs,
    deltaMs: TICK_MS,
    worldSize: BATTLEFIELD_SIZE,
  });
  const tick = tickCycleFlight(
    { motion: result.motion, stress: result.stress },
    {
      deltaMs: TICK_MS,
      worldSize: BATTLEFIELD_SIZE,
      dial: novice.dial,
      cycleMs: CYCLE_DURATION_MS,
    },
  );
  if (tick.completed)
    bot.onCycleCommitted(tick.state.motion.control.currentManeuver ?? "straight");
  return { ...novice, flight: tick.state };
}

/** Tallies of one duel. */
interface DuelTally {
  ticks: number;
  wedgeTicks: number;
  shotCycles: number;
  rolls: number;
}

type Pose = { x: number; y: number; angle: number };

/**
 * @param random - The duel's seeded source.
 * @returns Where the lab pilot and the novice start (random headings, 600 px apart).
 */
function spawnPoses(random: () => number): { lab: Pose; novice: Pose } {
  const lab = { x: 3000, y: 3000, angle: random() * 360 };
  const bearing = random() * 2 * Math.PI;
  return {
    lab,
    novice: {
      x: lab.x + Math.sin(bearing) * START_DISTANCE_PX,
      y: lab.y - Math.cos(bearing) * START_DISTANCE_PX,
      angle: random() * 360,
    },
  };
}

/**
 * @param from - The lab pilot's pose.
 * @param to - The novice's pose.
 * @returns Whether the novice is inside the lab pilot's firing wedge.
 */
function inWedge(from: Pose, to: Pose): boolean {
  return (
    Math.abs(offNoseDeg(from, to, BATTLEFIELD_SIZE)) <= WEDGE_ARC_DEG / 2 &&
    torusOffset(from, to, BATTLEFIELD_SIZE).distance <= WEDGE_RANGE_PX
  );
}

/**
 * @param engine - Steering engine of both ships.
 * @param kind - The lab pilot's style.
 * @param config - Ship, throttle and rate scale.
 * @param run - Seed and length of the duel.
 * @returns The duel's tallies.
 */
function runDuel(
  engine: SteeringMode,
  kind: LabPilotKind,
  config: LabConfig,
  run: { readonly seed: number; readonly durationMs: number },
): DuelTally {
  const random = createSeededRng(run.seed).next;
  const poses = spawnPoses(random);
  let lab = createLabShip({ ...setupOf(engine, config), pose: poses.lab });
  let novice = createLabShip({ ...setupOf(engine, config), pose: poses.novice });
  const bot = new BotPilot("novice", { random });
  const pilot = createLabPilot(kind, engine);
  const tally: DuelTally = { ticks: 0, wedgeTicks: 0, shotCycles: 0, rolls: 0 };
  const cycleTicks = Math.round(CYCLE_DURATION_MS / TICK_MS);
  let shotThisCycle = false;
  for (let tick = 0; tick < Math.round(run.durationMs / TICK_MS); tick++) {
    const a = lab.flight.motion;
    tally.ticks++;
    if (inWedge(a, novice.flight.motion)) {
      tally.wedgeTicks++;
      shotThisCycle = true;
    }
    if ((tick + 1) % cycleTicks === 0) {
      if (shotThisCycle) tally.shotCycles++;
      shotThisCycle = false;
    }
    const keys = pilot({
      errorDeg: offNoseDeg(a, novice.flight.motion, BATTLEFIELD_SIZE),
      tick,
      currentManeuver: a.control.currentManeuver,
      nextManeuver: a.control.nextManeuver,
    });
    lab = stepLabShip(lab, keys, tick * TICK_MS);
    novice = stepNovice(bot, novice, lab, tick * TICK_MS);
  }
  tally.rolls = lab.rolls;
  return tally;
}

/**
 * @param engine - Steering engine of both ships.
 * @param kind - The lab pilot's style.
 * @param config - Ship, throttle and rate scale.
 * @param options - Seeds to fly and the length of each duel.
 * @returns Wedge time, shots and accidental rolls over all duels.
 */
export function measureDuel(
  engine: SteeringMode,
  kind: LabPilotKind,
  config: LabConfig,
  options: { readonly seeds: number; readonly durationMs: number },
): DuelResult {
  const totals = { ticks: 0, wedgeTicks: 0, shotCycles: 0, rolls: 0 };
  for (let seed = 1; seed <= options.seeds; seed++) {
    const tally = runDuel(engine, kind, config, {
      seed,
      durationMs: options.durationMs,
    });
    totals.ticks += tally.ticks;
    totals.wedgeTicks += tally.wedgeTicks;
    totals.shotCycles += tally.shotCycles;
    totals.rolls += tally.rolls;
  }
  const minutes = (totals.ticks * TICK_MS) / 60000;
  return {
    wedgePercent: (100 * totals.wedgeTicks) / totals.ticks,
    shotsPerMinute: totals.shotCycles / minutes,
    rollsPerMinute: totals.rolls / minutes,
  };
}
