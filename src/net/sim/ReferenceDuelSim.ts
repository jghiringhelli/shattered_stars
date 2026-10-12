/**
 * ReferenceDuelSim — a small deterministic dogfight (ships turning, thrusting
 * and shooting with seeded dice on a wrapping field) used to exercise and
 * measure the lockstep layer without Phaser: the net tests, the latency
 * simulator and scripts/net_measure.ts all drive it. It follows the same
 * rules a battle scene must follow in lockstep: fixed tick, inputs only from
 * the session, seeded RNG, no wall clock.
 */

import { INPUT_AI_CONTROL, TICK_MS, type TickInput } from "../protocol";
import { DeterministicRng } from "../lockstep/DeterministicRng";
import { firstWord } from "../lockstep/LocalInputSampler";
import { StateHasher } from "../lockstep/StateHasher";
import type { LockstepSimulation } from "../lockstep/types";

/** Input bits of the reference duel. */
export const DUEL_BITS = {
  left: 1,
  right: 2,
  thrust: 4,
  fire: 8,
  boost: 16,
} as const;
/** One-shot presses (boost). */
export const DUEL_EDGE_MASK = DUEL_BITS.boost;

const FIELD_PX = 3000;
const TURN_RAD_PER_S = 3;
const ACCEL_PX_PER_S2 = 300;
const DRAG_PER_S = 0.4;
const BOOST_PX_PER_S = 250;
const RANGE_PX = 700;
const ARC_RAD = 0.5;
const COOLDOWN_TICKS = 30;
const HIT_CHANCE = 0.55;
const START_HULL = 40;

/** One ship's state. */
export interface DuelShip {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  hull: number;
  cooldown: number;
}

export class ReferenceDuelSim implements LockstepSimulation {
  ships: DuelShip[];
  private rng: DeterministicRng;
  private lastTick = -1;

  /** @param seed - Match seed. @param seatCount - Ships (one per seat). */
  constructor(seed: number, seatCount: number) {
    this.rng = new DeterministicRng(seed);
    this.ships = Array.from({ length: seatCount }, (_, seat) => ({
      x: (FIELD_PX / (seatCount + 1)) * (seat + 1),
      y: FIELD_PX / 2,
      angle: seat * Math.PI,
      vx: 0,
      vy: 0,
      hull: START_HULL,
      cooldown: 0,
    }));
  }

  /** @param tick - Tick. @param inputs - Every seat's input. */
  step(tick: number, inputs: readonly TickInput[]): void {
    const dt = TICK_MS / 1000;
    this.ships.forEach((ship, seat) => {
      const word = firstWord(inputs[seat] ?? 0);
      const bits = word & INPUT_AI_CONTROL ? this.botBits(seat) : word;
      this.fly(ship, bits, dt);
    });
    this.ships.forEach((ship, seat) =>
      this.shoot(ship, seat, firstWord(inputs[seat] ?? 0)),
    );
    this.lastTick = tick;
  }

  /** @returns Hash of every ship, the RNG and the tick. */
  hash(tick: number): number {
    const hasher = new StateHasher().addInt(tick).addInt(this.rng.getState());
    for (const s of this.ships) {
      hasher
        .addFloat(s.x)
        .addFloat(s.y)
        .addFloat(s.angle)
        .addFloat(s.vx)
        .addFloat(s.vy)
        .addInt(s.hull)
        .addInt(s.cooldown);
    }
    return hasher.digest();
  }

  /** @returns JSON of the full state. */
  snapshot(tick: number): string {
    return JSON.stringify({
      tick,
      rng: this.rng.getState(),
      ships: this.ships,
    });
  }

  /** @param _tick - Snapshot tick. @param data - From snapshot(). */
  restore(_tick: number, data: string): void {
    const parsed = JSON.parse(data) as {
      tick: number;
      rng: number;
      ships: DuelShip[];
    };
    this.rng.setState(parsed.rng);
    this.ships = parsed.ships.map((s) => ({ ...s }));
    this.lastTick = parsed.tick;
  }

  /** @returns The last simulated tick. */
  get tick(): number {
    return this.lastTick;
  }

  private fly(ship: DuelShip, bits: number, dt: number): void {
    if (ship.hull <= 0) return;
    if (bits & DUEL_BITS.left) ship.angle -= TURN_RAD_PER_S * dt;
    if (bits & DUEL_BITS.right) ship.angle += TURN_RAD_PER_S * dt;
    const thrust =
      (bits & DUEL_BITS.thrust ? ACCEL_PX_PER_S2 * dt : 0) +
      (bits & DUEL_BITS.boost ? BOOST_PX_PER_S : 0);
    ship.vx = (ship.vx + Math.cos(ship.angle) * thrust) * (1 - DRAG_PER_S * dt);
    ship.vy = (ship.vy + Math.sin(ship.angle) * thrust) * (1 - DRAG_PER_S * dt);
    ship.x = wrap(ship.x + ship.vx * dt);
    ship.y = wrap(ship.y + ship.vy * dt);
    ship.cooldown = Math.max(0, ship.cooldown - 1);
  }

  private shoot(ship: DuelShip, seat: number, word: number): void {
    const wantsFire =
      word & INPUT_AI_CONTROL ? true : (word & DUEL_BITS.fire) !== 0;
    if (!wantsFire || ship.cooldown > 0 || ship.hull <= 0) return;
    const target = this.ships.find(
      (other, i) => i !== seat && other.hull > 0 && this.inArc(ship, other),
    );
    if (!target) return;
    ship.cooldown = COOLDOWN_TICKS;
    if (this.rng.chance(HIT_CHANCE)) target.hull -= this.rng.nextInt(1, 3);
  }

  private botBits(seat: number): number {
    const ship = this.ships[seat]!;
    const target = this.ships.find((_, i) => i !== seat);
    if (!target) return 0;
    const bearing =
      Math.atan2(target.y - ship.y, target.x - ship.x) - ship.angle;
    const turn = Math.atan2(Math.sin(bearing), Math.cos(bearing));
    return DUEL_BITS.thrust | (turn < 0 ? DUEL_BITS.left : DUEL_BITS.right);
  }

  private inArc(from: DuelShip, to: DuelShip): boolean {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (dx * dx + dy * dy > RANGE_PX * RANGE_PX) return false;
    const bearing = Math.atan2(dy, dx) - from.angle;
    return (
      Math.abs(Math.atan2(Math.sin(bearing), Math.cos(bearing))) <= ARC_RAD
    );
  }
}

function wrap(value: number): number {
  return ((value % FIELD_PX) + FIELD_PX) % FIELD_PX;
}
