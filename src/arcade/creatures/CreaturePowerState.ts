/**
 * CreaturePowerState — the mutable state a creature's powers share: the
 * telegraph the HUD draws, lingering spore zones, the per-victim hit gate
 * (a struck ship ignores the creature's next hit for one cycle, like every
 * attacker) and the prey's recent motion (for slowing drag). Reused in
 * place — nothing here allocates per frame once a victim id was seen.
 */

import { CYCLE_DURATION_MS } from "../../config";
import { torusAxisDelta } from "../../core/Torus";
import type { CreaturePowerKind } from "../../data/creatures/creatureTypes";
import type { CreatureTarget } from "./CreatureWorld";

/** Where a power is in its life. */
export type PowerStage = "idle" | "windup" | "active";

/** The visible power in progress — what the HUD telegraphs. */
export interface CreatureTelegraph {
  stage: PowerStage;
  powerIndex: number;
  powerId: string;
  name: string;
  kind: CreaturePowerKind;
  /** Locked aim (deg) for cones, sweeps and lunges. */
  aimAngle: number;
  /** Locked point for clouds and blinks. */
  aimX: number;
  aimY: number;
  rangePx: number;
  innerRangePx: number;
  arcDeg: number;
  /** Start / end of the current stage (sim ms). */
  startedMs: number;
  endsMs: number;
}

/** @returns An idle telegraph. */
export function createTelegraph(): CreatureTelegraph {
  return {
    stage: "idle",
    powerIndex: -1,
    powerId: "",
    name: "",
    kind: "cone",
    aimAngle: 0,
    aimX: 0,
    aimY: 0,
    rangePx: 0,
    innerRangePx: 0,
    arcDeg: 0,
    startedMs: 0,
    endsMs: 0,
  };
}

/**
 * @param telegraph - The telegraph.
 * @param nowMs - Sim time (ms).
 * @returns How far the current stage has run, 0..1.
 */
export function stageProgress(
  telegraph: CreatureTelegraph,
  nowMs: number,
): number {
  const length = telegraph.endsMs - telegraph.startedMs;
  if (length <= 0) return 1;
  return Math.max(0, Math.min(1, (nowMs - telegraph.startedMs) / length));
}

/** A lingering spore cloud. */
export interface CreatureZone {
  active: boolean;
  x: number;
  y: number;
  radiusPx: number;
  endsMs: number;
  slowFactor: number;
  damage: number;
  stress: number;
}

/** Spore clouds alive at once. */
export const MAX_ZONES = 4;

/** @returns Empty zone slots. */
export function createZones(): CreatureZone[] {
  return Array.from({ length: MAX_ZONES }, () => ({
    active: false,
    x: 0,
    y: 0,
    radiusPx: 0,
    endsMs: 0,
    slowFactor: 1,
    damage: 0,
    stress: 0,
  }));
}

/** One hit per victim per cycle. */
export class HitGate {
  private readonly lastHitMs = new Map<string, number>();

  /**
   * @param targetId - The victim.
   * @param nowMs - Sim time (ms).
   * @returns True when it may be hit now.
   */
  ready(targetId: string, nowMs: number): boolean {
    const last = this.lastHitMs.get(targetId);
    return last === undefined || nowMs - last >= CYCLE_DURATION_MS;
  }

  /**
   * @param targetId - The victim.
   * @param nowMs - Sim time (ms).
   */
  mark(targetId: string, nowMs: number): void {
    this.lastHitMs.set(targetId, nowMs);
  }
}

/** A target's last known point and its motion over the last frame. */
export interface PreyMotion {
  x: number;
  y: number;
  moveX: number;
  moveY: number;
  seen: boolean;
}

/** Tracks how far each target moved last frame. */
export class PreyTracker {
  private readonly byId = new Map<string, PreyMotion>();

  /**
   * @param targets - Targets this frame.
   * @param worldSize - Map edge (px), for seam-short deltas.
   */
  update(targets: readonly CreatureTarget[], worldSize: number): void {
    for (const target of targets) {
      let rec = this.byId.get(target.id);
      if (!rec) {
        rec = { x: target.x, y: target.y, moveX: 0, moveY: 0, seen: false };
        this.byId.set(target.id, rec);
      }
      rec.moveX = rec.seen ? torusAxisDelta(rec.x, target.x, worldSize) : 0;
      rec.moveY = rec.seen ? torusAxisDelta(rec.y, target.y, worldSize) : 0;
      rec.x = target.x;
      rec.y = target.y;
      rec.seen = true;
    }
  }

  /**
   * @param targetId - A target.
   * @returns Its last-frame motion, or undefined for an unseen id.
   */
  motionOf(targetId: string): PreyMotion | undefined {
    return this.byId.get(targetId);
  }
}
