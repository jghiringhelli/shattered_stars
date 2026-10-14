/**
 * CreaturePowerBrain — which power a creature uses next and whom it aims at.
 * It reads only what a ship bot reads (the prey's positions, its own
 * cooldowns, phase and surviving parts) and rolls on its seeded stream, so a
 * fight is deterministic and the creature has no hidden information. Pure.
 */

import type {
  CreaturePowerSpec,
  CreaturePowerTargeting,
} from "../../data/creatures/creatureTypes";
import { torusRangePx } from "../weapons/FiringGeometry";
import type { CreatureBody } from "./CreatureMovement";
import { isPartAlive, type PartState } from "./CreatureParts";
import type { CreatureRng } from "./CreatureRng";
import type { CreatureTarget } from "./CreatureWorld";

/** Targets within this of another count toward "cluster" targeting (px). */
export const CLUSTER_RADIUS_PX = 260;
/** Default reach for a blink without a trigger range (px). */
const DEFAULT_BLINK_TRIGGER_PX = 1100;

/** What power selection reads. */
export interface SelectionContext {
  readonly specs: readonly CreaturePowerSpec[];
  /** Sim time (ms) each power is ready again. */
  readonly cooldownUntil: readonly number[];
  readonly phaseIndex: number;
  readonly parts: readonly PartState[];
  readonly body: CreatureBody;
  readonly radiusPx: number;
  readonly worldSize: number;
  readonly targets: readonly CreatureTarget[];
  readonly addsAlive: number;
  readonly nowMs: number;
  readonly rng: CreatureRng;
}

/**
 * @param spec - A power.
 * @returns How far a target may be (from the body edge) for it to be used.
 */
export function triggerRangeOf(spec: CreaturePowerSpec): number {
  if (spec.triggerRangePx !== undefined) return spec.triggerRangePx;
  return spec.kind === "blink" ? DEFAULT_BLINK_TRIGGER_PX : spec.rangePx;
}

function hasTargetInReach(
  ctx: SelectionContext,
  spec: CreaturePowerSpec,
): boolean {
  const reach = triggerRangeOf(spec) + ctx.radiusPx;
  for (const target of ctx.targets)
    if (torusRangePx(ctx.body, target, ctx.worldSize) <= reach) return true;
  return false;
}

function isUsable(ctx: SelectionContext, index: number): boolean {
  const spec = ctx.specs[index]!;
  if (ctx.cooldownUntil[index]! > ctx.nowMs) return false;
  if (spec.fromPhase > ctx.phaseIndex) return false;
  if (spec.requiresPart && !isPartAlive(ctx.parts, spec.requiresPart))
    return false;
  if (spec.kind === "summon") return ctx.addsAlive < (spec.spawnCount ?? 1);
  return hasTargetInReach(ctx, spec);
}

/**
 * @param ctx - Powers, cooldowns, phase, parts and prey.
 * @returns The index of the power to wind up, or −1 when none is usable.
 */
export function pickPower(ctx: SelectionContext): number {
  let total = 0;
  for (let i = 0; i < ctx.specs.length; i++)
    if (isUsable(ctx, i)) total += ctx.specs[i]!.weight;
  if (total <= 0) return -1;
  let roll = ctx.rng.next() * total;
  for (let i = 0; i < ctx.specs.length; i++) {
    if (!isUsable(ctx, i)) continue;
    roll -= ctx.specs[i]!.weight;
    if (roll <= 0) return i;
  }
  return -1;
}

function neighboursOf(
  ctx: Pick<SelectionContext, "targets" | "worldSize">,
  target: CreatureTarget,
): number {
  let count = 0;
  for (const other of ctx.targets)
    if (
      other !== target &&
      torusRangePx(target, other, ctx.worldSize) <= CLUSTER_RADIUS_PX
    )
      count++;
  return count;
}

/**
 * @param targeting - The power's targeting rule.
 * @param ctx - Body and prey.
 * @returns The chosen target, or null when there is none.
 */
export function chooseTarget(
  targeting: CreaturePowerTargeting,
  ctx: Pick<SelectionContext, "targets" | "body" | "worldSize">,
): CreatureTarget | null {
  let best: CreatureTarget | null = null;
  let bestScore = -Infinity;
  for (const target of ctx.targets) {
    const range = torusRangePx(ctx.body, target, ctx.worldSize);
    const score =
      targeting === "nearest"
        ? -range
        : targeting === "farthest"
          ? range
          : targeting === "flagship"
            ? (target.isFlagship ? 1e6 : 0) - range
            : neighboursOf(ctx, target) * 1e4 - range;
    if (score <= bestScore) continue;
    best = target;
    bestScore = score;
  }
  return best;
}
