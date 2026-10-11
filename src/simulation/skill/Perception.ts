/**
 * Perception — a pilot sees other ships as they were a reaction time ago,
 * and judges their motion from how they moved just before that.
 *
 * The arena records one frame of snapshots per tick; each pilot reads the
 * frame its reaction delay points at. Pure: no Phaser.
 */

import { signedAngle, torusOffset } from "./ArenaGeometry";
import type { PerceivedShip, ShipSnapshot } from "./SkillTypes";

/** Window over which a ship's motion is judged (ms). */
export const MOTION_WINDOW_MS = 200;

/** Fastest turn a pilot will believe it saw (° per ms) — a 90° turn per cycle. */
export const MAX_PERCEIVED_TURN_RATE = 90 / 500;

/** Slack kept beyond the longest delay so the oldest lookup always resolves (ms). */
const HISTORY_SLACK_MS = 100;

interface Frame {
  readonly nowMs: number;
  readonly ships: ReadonlyMap<string, ShipSnapshot>;
}

/** Recent snapshots of every ship, newest last. */
export class SnapshotHistory {
  private readonly frames: Frame[] = [];

  /**
   * @param maxDelayMs - Longest reaction delay any pilot will ask for (ms).
   * @param worldSize - Torus edge length (px).
   */
  constructor(
    private readonly maxDelayMs: number,
    private readonly worldSize: number,
  ) {}

  /**
   * Store this tick's snapshots and drop frames nobody can ask for any more.
   * @param nowMs - Arena time (ms).
   * @param ships - Every ship's snapshot this tick.
   */
  record(nowMs: number, ships: readonly ShipSnapshot[]): void {
    this.frames.push({ nowMs, ships: new Map(ships.map((s) => [s.id, s])) });
    const oldest =
      nowMs - this.maxDelayMs - MOTION_WINDOW_MS - HISTORY_SLACK_MS;
    while (this.frames.length > 2 && this.frames[0]!.nowMs < oldest) {
      this.frames.shift();
    }
  }

  /**
   * Other ships as a pilot with this reaction delay perceives them now.
   *
   * @param nowMs - Arena time (ms).
   * @param delayMs - The pilot's reaction delay (ms).
   * @param exceptId - The pilot's own ship (not perceived through the delay).
   * @returns Delayed snapshots with observed motion (alive ones only).
   */
  perceive(nowMs: number, delayMs: number, exceptId: string): PerceivedShip[] {
    const seen = this.frameAt(nowMs - delayMs);
    const before = this.frameAt(nowMs - delayMs - MOTION_WINDOW_MS);
    if (!seen) return [];
    const result: PerceivedShip[] = [];
    for (const ship of seen.ships.values()) {
      if (ship.id === exceptId || !ship.alive) continue;
      const earlier = before?.ships.get(ship.id);
      const elapsed = before ? seen.nowMs - before.nowMs : 0;
      result.push(this.withMotion(ship, earlier, elapsed));
    }
    return result;
  }

  /**
   * @param ship - Snapshot as seen.
   * @param earlier - Snapshot one motion window before, if any.
   * @param elapsedMs - Time between the two (ms).
   * @returns The ship with its observed velocity and turn rate.
   */
  private withMotion(
    ship: ShipSnapshot,
    earlier: ShipSnapshot | undefined,
    elapsedMs: number,
  ): PerceivedShip {
    if (!earlier || elapsedMs <= 0) {
      return { ...ship, vx: 0, vy: 0, turnRateDegPerMs: 0 };
    }
    const { dx, dy } = torusOffset(earlier, ship, this.worldSize);
    const turn = signedAngle(ship.angle - earlier.angle) / elapsedMs;
    return {
      ...ship,
      vx: dx / elapsedMs,
      vy: dy / elapsedMs,
      turnRateDegPerMs: Math.max(
        -MAX_PERCEIVED_TURN_RATE,
        Math.min(MAX_PERCEIVED_TURN_RATE, turn),
      ),
    };
  }

  /**
   * @param timeMs - Moment asked for.
   * @returns The latest frame at or before that moment (oldest if none).
   */
  private frameAt(timeMs: number): Frame | undefined {
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const frame = this.frames[i]!;
      if (frame.nowMs <= timeMs) return frame;
    }
    return this.frames[0];
  }
}
