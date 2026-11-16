/**
 * LabMeters — what the movement lab's battle emulation watches on the ships
 * of one side during a battle: time with an enemy in the firing wedge,
 * stress, turns, throttle changes, time under the speed cap, heading
 * smoothness and the moment of the first kill. Fed once per tick by
 * runBattle's observer; plain counters, no randomness.
 *
 * Pure: no Phaser.
 */

import { BATTLEFIELD_SIZE } from "../../config";
import { offNoseDeg, torusOffset } from "../../arcade/ai/AiGeometry";
import type { ArenaShip } from "../skill/ArenaShip";
import { TICK_MS } from "../skill/ArenaSpec";
import type { SideId } from "../skill/ArenaSide";

/** Totals of one side over one battle. */
export interface MeterTotals {
  /** Ship-ticks flown by living ships of the side. */
  shipTicks: number;
  /** ...with an enemy inside the ship's firing arc and range. */
  wedgeTicks: number;
  /** Sum of stress levels (0-1) over the ship-ticks. */
  stressSum: number;
  /** Turns started (the key goes down / a turning cycle begins). */
  turns: number;
  /** Changes of the set throttle. */
  speedChanges: number;
  /** Ship-ticks flown below the set speed (the dial's speed cap). */
  cappedTicks: number;
  /** Sum of squared heading accelerations (°/s²)². */
  headingAccelSq: number;
  /** Heading-acceleration samples. */
  headingAccelSamples: number;
  /** Battle time of the side's first kill (ms), or null. */
  firstKillMs: number | null;
}

/** @returns Totals with nothing counted. */
export function emptyTotals(): MeterTotals {
  return {
    shipTicks: 0,
    wedgeTicks: 0,
    stressSum: 0,
    turns: 0,
    speedChanges: 0,
    cappedTicks: 0,
    headingAccelSq: 0,
    headingAccelSamples: 0,
    firstKillMs: null,
  };
}

/** What a ship did the tick before. */
interface Previous {
  readonly angle: number;
  readonly turnRateDegPerSec: number | null;
  readonly speed: number;
  readonly turning: boolean;
}

/**
 * @param angle - A heading (°).
 * @param before - An earlier heading (°).
 * @returns The signed difference in (-180, 180].
 */
function headingStep(angle: number, before: number): number {
  const diff = (((angle - before) % 360) + 540) % 360 - 180;
  return diff;
}

/**
 * @param ship - A ship.
 * @returns Whether it is in a turn: the analog key is down, or the cycle flies a
 * bank / turn / drift / special maneuver.
 */
function isTurning(ship: ArenaShip): boolean {
  const control = ship.flight.motion.control;
  if (control.analog) return control.analog.held !== "none";
  const maneuver = control.currentManeuver ?? "straight";
  return maneuver !== "straight";
}

/** Counts one side's ships tick by tick. */
export class SideMeter {
  readonly totals: MeterTotals = emptyTotals();
  private readonly previous = new Map<string, Previous>();
  private readonly seenAlive = new Set<string>();

  /** @param side - The side watched. */
  constructor(private readonly side: SideId) {}

  /**
   * @param ships - Every ship after the tick.
   * @param nowMs - Battle time (ms).
   */
  observe(ships: readonly ArenaShip[], nowMs: number): void {
    this.watchKills(ships, nowMs);
    const enemies = ships.filter((ship) => ship.alive && ship.side !== this.side);
    for (const ship of ships) {
      if (ship.side !== this.side || !ship.alive) continue;
      this.count(ship, enemies);
    }
  }

  /**
   * @param ships - Every ship.
   * @param nowMs - Battle time (ms).
   */
  private watchKills(ships: readonly ArenaShip[], nowMs: number): void {
    for (const ship of ships) {
      if (ship.side === this.side) continue;
      if (ship.alive) this.seenAlive.add(ship.id);
      else if (this.seenAlive.delete(ship.id) && this.totals.firstKillMs === null)
        this.totals.firstKillMs = nowMs;
    }
  }

  /**
   * @param ship - A living ship of the side.
   * @param enemies - The living enemies.
   */
  private count(ship: ArenaShip, enemies: readonly ArenaShip[]): void {
    const totals = this.totals;
    const control = ship.flight.motion.control;
    const before = this.previous.get(ship.id);
    const turning = isTurning(ship);
    totals.shipTicks++;
    totals.stressSum += ship.flight.stress.level;
    if (control.cycleSpeed < control.speed) totals.cappedTicks++;
    if (enemies.some((enemy) => inWedge(ship, enemy))) totals.wedgeTicks++;
    if (before && turning && !before.turning) totals.turns++;
    if (before && control.speed !== before.speed) totals.speedChanges++;
    const rate = before
      ? headingStep(ship.angle, before.angle) / (TICK_MS / 1000)
      : null;
    if (rate !== null && before?.turnRateDegPerSec != null) {
      const accel = (rate - before.turnRateDegPerSec) / (TICK_MS / 1000);
      totals.headingAccelSq += accel * accel;
      totals.headingAccelSamples++;
    }
    this.previous.set(ship.id, {
      angle: ship.angle,
      turnRateDegPerSec: rate,
      speed: control.speed,
      turning,
    });
  }
}

/**
 * @param shooter - A ship.
 * @param target - An enemy.
 * @returns Whether the enemy is inside the shooter's firing arc and range.
 */
function inWedge(shooter: ArenaShip, target: ArenaShip): boolean {
  const { firingArc, weaponRange } = shooter.combatStats;
  return (
    Math.abs(offNoseDeg(shooter, target, BATTLEFIELD_SIZE)) <= firingArc / 2 &&
    torusOffset(shooter, target, BATTLEFIELD_SIZE).distance <= weaponRange
  );
}
