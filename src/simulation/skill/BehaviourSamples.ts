/**
 * BehaviourSamples — the slow metrics of the BehaviourProfiler, taken every
 * {@link SAMPLE_MS}: turn reversals, closing / opening speed, running from
 * every enemy, and orbiting one target.
 *
 * Pure: no Phaser.
 */

import { signedAngle, torusOffset } from "../../arcade/ai/AiGeometry";
import type { ArenaShip } from "./ArenaShip";
import {
  ORBIT_DEG,
  RANGE_RATE_PX_PER_SECOND,
  REVERSAL_WINDOW_MS,
  SAMPLE_MS,
  SEAM_MARGIN_PX,
  TURNING_DEG_PER_SECOND,
  type ShipMemory,
  type ShipProfile,
} from "./BehaviourProfile";

/** One ship under observation at a sampling instant. */
export interface Watch {
  readonly ship: ArenaShip;
  readonly target: ArenaShip;
  readonly enemies: readonly ArenaShip[];
  readonly profile: ShipProfile;
  readonly memory: ShipMemory;
  readonly worldSize: number;
  readonly nowMs: number;
}

/**
 * Take every slow metric of one ship and advance its sampling memory.
 * @param watch - The ship, its target and enemies, its profile and memory.
 */
export function sampleShip(watch: Watch): void {
  const { ship, memory, nowMs } = watch;
  const seconds = (nowMs - memory.lastSampleMs) / 1000;
  sampleTurn(watch, seconds);
  sampleRange(watch, seconds);
  sampleOrbit(watch);
  memory.lastSampleMs = nowMs;
  memory.lastAngle = ship.angle;
}

function sampleTurn(watch: Watch, seconds: number): void {
  const { ship, profile, memory, nowMs } = watch;
  profile.turnSamples++;
  const rate = signedAngle(ship.angle - memory.lastAngle) / seconds;
  if (Math.abs(rate) < TURNING_DEG_PER_SECOND) return;
  const sign = Math.sign(rate);
  const reversed =
    memory.lastTurnSign !== 0 &&
    sign !== memory.lastTurnSign &&
    nowMs - memory.lastTurnMs <= REVERSAL_WINDOW_MS;
  if (reversed) {
    profile.reversals++;
    if (nearSeam(ship, watch.worldSize)) profile.reversalsNearSeam++;
  }
  memory.lastTurnSign = sign;
  memory.lastTurnMs = nowMs;
}

function sampleRange(watch: Watch, seconds: number): void {
  const { ship, target, enemies, profile, memory, worldSize } = watch;
  const rates = enemies.map((enemy) => {
    const distance = torusOffset(ship, enemy, worldSize).distance;
    const before = memory.lastDistances.get(enemy.id);
    memory.lastDistances.set(enemy.id, distance);
    return before === undefined ? null : (before - distance) / seconds;
  });
  const targetRate = rates[enemies.indexOf(target)] ?? null;
  if (targetRate === null) return;
  profile.rangeSamples++;
  profile.closingPxSum += targetRate;
  memory.closing = targetRate > RANGE_RATE_PX_PER_SECOND;
  if (targetRate < -RANGE_RATE_PX_PER_SECOND) profile.openingMs += SAMPLE_MS;
  memory.running = rates.every(
    (rate) => rate !== null && rate < -RANGE_RATE_PX_PER_SECOND,
  );
}

function sampleOrbit(watch: Watch): void {
  const { ship, target, profile, memory, worldSize } = watch;
  const offset = torusOffset(ship, target, worldSize);
  const bearing = (Math.atan2(offset.dx, -offset.dy) * 180) / Math.PI;
  if (memory.orbitTarget !== target.id || memory.lastBearing === null) {
    memory.orbitTarget = target.id;
    memory.orbitDeg = 0;
  } else {
    memory.orbitDeg += signedAngle(bearing - memory.lastBearing);
  }
  memory.lastBearing = bearing;
  if (Math.abs(memory.orbitDeg) < ORBIT_DEG) return;
  profile.orbits++;
  memory.orbitDeg = 0;
}

function nearSeam(ship: ArenaShip, worldSize: number): boolean {
  const edge = worldSize - SEAM_MARGIN_PX;
  return (
    ship.x < SEAM_MARGIN_PX ||
    ship.y < SEAM_MARGIN_PX ||
    ship.x > edge ||
    ship.y > edge
  );
}
