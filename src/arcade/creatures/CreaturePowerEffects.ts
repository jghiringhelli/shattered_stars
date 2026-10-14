/**
 * CreaturePowerEffects — the geometry and effects of a creature's powers.
 * A power winds up (the telegraph locks its aim), lands (instant powers hit
 * whoever stands in the zone at that moment; channelled ones stay active),
 * and ticks while active. Every hit goes through the per-victim cycle gate,
 * so no pilot takes two hits from the creature inside one 500 ms cycle.
 * Ranges and arcs use FiringGeometry (torus-short). Pure; allocation-free.
 */

import { CYCLE_DURATION_MS } from "../../config";
import type { CreaturePowerSpec } from "../../data/creatures/creatureTypes";
import {
  inArcEnvelope,
  torusRangePx,
  headingTowardDeg,
} from "../weapons/FiringGeometry";
import { torusDelta } from "../../core/Torus";
import { forwardX, forwardY, seconds } from "./creatureMath";
import { setHeadingVelocity, type CreatureBody } from "./CreatureMovement";
import { chooseTarget } from "./CreaturePowerBrain";
import {
  MAX_ZONES,
  stageProgress,
  type CreatureTelegraph,
  type CreatureZone,
  type HitGate,
  type PreyTracker,
} from "./CreaturePowerState";
import type { CreatureRng } from "./CreatureRng";
import type { CreatureEffects, CreatureTarget } from "./CreatureWorld";

/** A sweep covers this much turn, centred on the locked aim (deg). */
export const SWEEP_TOTAL_DEG = 180;
/** Slack added to contact range of lunges and the maw (px). */
const CONTACT_SLACK_PX = 12;
/** Cone half-width of a lunge telegraph (deg). */
const LUNGE_ARC_DEG = 24;
/** A blink lands this far to the far side of its prey, ± this spread (deg). */
const BLINK_SPREAD_DEG = 40;
const HALF_TURN_DEG = 180;
const MS_PER_S = 1000;

/** What a power reads and mutates. */
export interface PowerContext {
  readonly body: CreatureBody;
  readonly radiusPx: number;
  readonly worldSize: number;
  readonly targets: readonly CreatureTarget[];
  readonly effects: CreatureEffects;
  readonly gate: HitGate;
  readonly prey: PreyTracker;
  readonly zones: CreatureZone[];
  readonly rng: CreatureRng;
  readonly nowMs: number;
  readonly deltaMs: number;
  /** Phase multiplier on damage. */
  readonly damageScale: number;
}

/**
 * Starts a power's wind-up: locks the aim and publishes the telegraph.
 *
 * @param telegraph - The telegraph (mutated).
 * @param spec - The power.
 * @param index - Its index in the creature's powers.
 * @param ctx - Body, prey and time.
 */
export function beginWindup(
  telegraph: CreatureTelegraph,
  spec: CreaturePowerSpec,
  index: number,
  ctx: PowerContext,
): void {
  const target = chooseTarget(spec.targeting, ctx);
  telegraph.stage = "windup";
  telegraph.powerIndex = index;
  telegraph.powerId = spec.id;
  telegraph.name = spec.name;
  telegraph.kind = spec.kind;
  telegraph.rangePx = spec.rangePx;
  telegraph.innerRangePx = spec.innerRangePx ?? 0;
  telegraph.arcDeg = spec.kind === "lunge" ? LUNGE_ARC_DEG : (spec.arcDeg ?? 0);
  telegraph.startedMs = ctx.nowMs;
  telegraph.endsMs = ctx.nowMs + spec.windupCycles * CYCLE_DURATION_MS;
  telegraph.aimAngle = target
    ? headingTowardDeg(ctx.body, target, ctx.worldSize)
    : ctx.body.angle;
  telegraph.aimX = target ? target.x : ctx.body.x;
  telegraph.aimY = target ? target.y : ctx.body.y;
  if (spec.kind === "blink" && target) aimBlink(telegraph, spec, target, ctx);
}

function aimBlink(
  telegraph: CreatureTelegraph,
  spec: CreaturePowerSpec,
  target: CreatureTarget,
  ctx: PowerContext,
): void {
  const away = headingTowardDeg(target, ctx.body, ctx.worldSize);
  const heading =
    away + HALF_TURN_DEG + (ctx.rng.next() * 2 - 1) * BLINK_SPREAD_DEG;
  telegraph.aimX = target.x + forwardX(heading) * spec.rangePx;
  telegraph.aimY = target.y + forwardY(heading) * spec.rangePx;
}

function hit(
  ctx: PowerContext,
  target: CreatureTarget,
  spec: CreaturePowerSpec,
): void {
  if (!ctx.gate.ready(target.id, ctx.nowMs)) return;
  ctx.gate.mark(target.id, ctx.nowMs);
  if (spec.damage > 0)
    ctx.effects.damage(target.id, spec.damage * ctx.damageScale);
  if (spec.stress > 0) ctx.effects.stress(target.id, spec.stress);
}

function hitCone(
  spec: CreaturePowerSpec,
  angle: number,
  arcDeg: number,
  ctx: PowerContext,
): void {
  const pose = { x: ctx.body.x, y: ctx.body.y, angle };
  const envelope = { maxRangePx: spec.rangePx, arcDeg };
  for (const target of ctx.targets)
    if (inArcEnvelope(pose, target, envelope, ctx.worldSize, target.radiusPx))
      hit(ctx, target, spec);
}

function hitRing(spec: CreaturePowerSpec, ctx: PowerContext): void {
  const inner = spec.innerRangePx ?? 0;
  for (const target of ctx.targets) {
    const range = torusRangePx(ctx.body, target, ctx.worldSize);
    if (
      range + target.radiusPx > inner &&
      range - target.radiusPx < spec.rangePx
    )
      hit(ctx, target, spec);
  }
}

function placeCloud(
  spec: CreaturePowerSpec,
  telegraph: CreatureTelegraph,
  ctx: PowerContext,
): void {
  const zone = ctx.zones.find((z) => !z.active) ?? ctx.zones[0]!;
  zone.active = true;
  zone.x = telegraph.aimX;
  zone.y = telegraph.aimY;
  zone.radiusPx = spec.rangePx;
  zone.endsMs = ctx.nowMs + (spec.durationMs ?? CYCLE_DURATION_MS);
  zone.slowFactor = spec.slowFactor ?? 1;
  zone.damage = spec.damage * ctx.damageScale;
  zone.stress = spec.stress;
}

function summon(spec: CreaturePowerSpec, ctx: PowerContext): void {
  const count = spec.spawnCount ?? 1;
  for (let i = 0; i < count; i++) {
    const heading = ctx.body.angle + (HALF_TURN_DEG * 2 * (i + 0.5)) / count;
    const reach = ctx.radiusPx + CONTACT_SLACK_PX * 4;
    ctx.effects.spawn(
      spec.spawnCreatureId ?? "",
      ctx.body.x + forwardX(heading) * reach,
      ctx.body.y + forwardY(heading) * reach,
      heading,
    );
  }
}

/**
 * Lands a power whose wind-up ended.
 *
 * @param spec - The power.
 * @param telegraph - Its telegraph (mutated: the active window).
 * @param ctx - Body, prey, effects and time.
 * @returns True when the power stays active (pull, sweep, lunge).
 */
export function landPower(
  spec: CreaturePowerSpec,
  telegraph: CreatureTelegraph,
  ctx: PowerContext,
): boolean {
  switch (spec.kind) {
    case "cone":
      hitCone(spec, telegraph.aimAngle, spec.arcDeg ?? 0, ctx);
      return false;
    case "ring":
    case "scream":
      hitRing(spec, ctx);
      return false;
    case "cloud":
      placeCloud(spec, telegraph, ctx);
      return false;
    case "summon":
      summon(spec, ctx);
      return false;
    case "blink":
      ctx.body.x = telegraph.aimX;
      ctx.body.y = telegraph.aimY;
      return false;
    case "lunge":
      setHeadingVelocity(
        ctx.body,
        telegraph.aimAngle,
        (spec.rangePx * MS_PER_S) / (spec.durationMs ?? CYCLE_DURATION_MS),
      );
      return true;
    default:
      return true;
  }
}

/**
 * @param telegraph - A telegraph.
 * @param nowMs - Sim time (ms).
 * @returns The heading the telegraph points at now (a sweep rotates).
 */
export function telegraphAngle(
  telegraph: CreatureTelegraph,
  nowMs: number,
): number {
  if (telegraph.kind !== "sweep") return telegraph.aimAngle;
  const progress =
    telegraph.stage === "active" ? stageProgress(telegraph, nowMs) : 0;
  return telegraph.aimAngle - SWEEP_TOTAL_DEG / 2 + SWEEP_TOTAL_DEG * progress;
}

/**
 * One frame of an active (channelled) power.
 *
 * @param spec - The power.
 * @param telegraph - Its telegraph.
 * @param ctx - Body, prey, effects and time.
 */
export function tickActive(
  spec: CreaturePowerSpec,
  telegraph: CreatureTelegraph,
  ctx: PowerContext,
): void {
  if (spec.kind === "sweep")
    hitCone(spec, telegraphAngle(telegraph, ctx.nowMs), spec.arcDeg ?? 0, ctx);
  else if (spec.kind === "lunge") hitContact(spec, ctx);
  else if (spec.kind === "pull") tickPull(spec, ctx);
}

function hitContact(spec: CreaturePowerSpec, ctx: PowerContext): void {
  for (const target of ctx.targets) {
    const reach = ctx.radiusPx + target.radiusPx + CONTACT_SLACK_PX;
    if (torusRangePx(ctx.body, target, ctx.worldSize) <= reach)
      hit(ctx, target, spec);
  }
}

function tickPull(spec: CreaturePowerSpec, ctx: PowerContext): void {
  const step = (spec.pullSpeedPxPerS ?? 0) * seconds(ctx.deltaMs);
  for (const target of ctx.targets) {
    const { dx, dy } = torusDelta(
      target.x,
      target.y,
      ctx.body.x,
      ctx.body.y,
      ctx.worldSize,
    );
    const range = Math.hypot(dx, dy);
    if (range > spec.rangePx + ctx.radiusPx || range < 1) continue;
    const maw = ctx.radiusPx + target.radiusPx;
    if (range <= maw + CONTACT_SLACK_PX) hit(ctx, target, spec);
    const pull = Math.min(step, Math.max(0, range - maw));
    ctx.effects.nudge(target.id, (dx / range) * pull, (dy / range) * pull);
  }
}

/**
 * One frame of every spore cloud: slows (drags back what the ship just
 * flew), stresses and chips whoever sits inside; expires them.
 *
 * @param ctx - Body, prey, effects and time.
 */
export function tickZones(ctx: PowerContext): void {
  for (let i = 0; i < MAX_ZONES; i++) {
    const zone = ctx.zones[i]!;
    if (!zone.active) continue;
    if (ctx.nowMs >= zone.endsMs) {
      zone.active = false;
      continue;
    }
    for (const target of ctx.targets) {
      if (
        torusRangePx(zone, target, ctx.worldSize) >
        zone.radiusPx + target.radiusPx
      )
        continue;
      const motion = ctx.prey.motionOf(target.id);
      const drag = 1 - zone.slowFactor;
      if (motion && drag > 0)
        ctx.effects.nudge(
          target.id,
          -motion.moveX * drag,
          -motion.moveY * drag,
        );
      if (!ctx.gate.ready(target.id, ctx.nowMs)) continue;
      ctx.gate.mark(target.id, ctx.nowMs);
      if (zone.damage > 0) ctx.effects.damage(target.id, zone.damage);
      if (zone.stress > 0) ctx.effects.stress(target.id, zone.stress);
    }
  }
}
