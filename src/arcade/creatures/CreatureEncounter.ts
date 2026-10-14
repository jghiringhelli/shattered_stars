/**
 * CreatureEncounter — one creature's behaviour in a battle: its own movement
 * (never the maneuver dial), telegraphed powers with cooldowns, body parts,
 * enrage phases and feeding on wrecks. The scene owns the creature's ship
 * record (hull, shields, sprite, kill rewards) and feeds the encounter a
 * {@link CreatureFrame} per logic tick; the encounter writes its pose and
 * asks the scene to apply effects ({@link CreatureEffects}). Deterministic:
 * sim clock only, seeded saveable RNG, no hidden information. Pure.
 */

import { DURABILITY_SCALE } from "../../config";
import type {
  CreatureDefinition,
  CreaturePhaseSpec,
} from "../../data/creatures/creatureTypes";
import { bearingOffNoseDeg, torusRangePx } from "../weapons/FiringGeometry";
import { WreckFeeder, type Wreck } from "./CreatureFeeding";
import {
  coastBody,
  stepBody,
  type CreatureBody,
  type MovementInput,
} from "./CreatureMovement";
import {
  createParts,
  damagePart,
  findHitPart,
  isPartAlive,
  type PartState,
} from "./CreatureParts";
import { PowerRunner } from "./CreaturePowerRunner";
import type {
  AbsorbHitInput,
  AbsorbHitResult,
  CreatureEncounterConfig,
} from "./CreatureEncounterTypes";
import { CreatureRng } from "./CreatureRng";
import type { CreatureEffects, CreatureFrame } from "./CreatureWorld";

export type {
  AbsorbHitInput,
  AbsorbHitResult,
  CreatureEncounterConfig,
} from "./CreatureEncounterTypes";
export type {
  CreatureEffects,
  CreatureEventKind,
  CreatureFrame,
  CreatureTarget,
} from "./CreatureWorld";

/** Share of its speed a creature keeps while winding a power up. */
export const WINDUP_SPEED_SCALE = 0.35;
/** Share of its speed a creature keeps while feeding. */
const FEED_SPEED_SCALE = 0.2;

/** A creature fight in progress. */
export class CreatureEncounter {
  readonly definition: CreatureDefinition;
  readonly body: CreatureBody;
  readonly parts: PartState[];
  /** 0 = opening phase. */
  phaseIndex = 0;

  /** The seeded stream (its state is all a lockstep snapshot needs). */
  readonly rng: CreatureRng;
  private readonly runner: PowerRunner;
  private readonly feeder: WreckFeeder;
  private readonly hitResult: AbsorbHitResult = {
    damage: 0,
    partId: null,
    blocked: false,
  };
  private readonly destroyedParts: string[] = [];
  private readonly move: {
    -readonly [K in keyof MovementInput]: MovementInput[K];
  };

  /** @param config - Definition, seed, world and start pose. */
  constructor(private readonly config: CreatureEncounterConfig) {
    const { definition } = config;
    this.definition = definition;
    this.body = { ...config.start, vx: 0, vy: 0 };
    this.parts = createParts(definition.parts);
    this.rng = new CreatureRng(config.seed);
    this.runner = new PowerRunner(
      definition,
      this.body,
      this.parts,
      config.worldSize,
      this.rng,
    );
    this.feeder = new WreckFeeder(config.worldSize);
    this.move = {
      style: definition.movement.style,
      spec: definition.movement,
      speedScale: 1,
      deltaMs: 0,
      nowMs: 0,
      worldSize: config.worldSize,
      arena: config.arena,
      hasGoal: false,
      goalX: 0,
      goalY: 0,
      orbitSign: this.rng.next() < 0.5 ? 1 : -1,
    };
  }

  /** @returns Body x (px). */
  get x(): number {
    return this.body.x;
  }

  /** @returns Body y (px). */
  get y(): number {
    return this.body.y;
  }

  /** @returns Heading (deg). */
  get angle(): number {
    return this.body.angle;
  }

  /** @returns The power in progress, for the HUD. */
  get telegraph(): PowerRunner["telegraph"] {
    return this.runner.telegraph;
  }

  /** @returns Spore clouds, for the HUD. */
  get zones(): PowerRunner["zones"] {
    return this.runner.zones;
  }

  /** @returns True while phase-shifted (untargetable). */
  get phased(): boolean {
    return this.runner.phased;
  }

  /** @returns True while feeding on a wreck. */
  get feeding(): boolean {
    return this.feeder.feeding;
  }

  /** @returns The phase in force. */
  get phase(): CreaturePhaseSpec {
    const { phases } = this.definition;
    return phases[Math.min(this.phaseIndex, phases.length - 1)]!;
  }

  /** @returns Number of phases of this fight. */
  get phaseCount(): number {
    return this.config.phaseThresholds.length + 1;
  }

  /**
   * @param partId - A part id.
   * @returns False once it is destroyed (true for unknown ids).
   */
  isPartAlive(partId: string): boolean {
    return isPartAlive(this.parts, partId);
  }

  /**
   * A ship died here: the creature may feed on the wreck.
   *
   * @param x - Wreck x.
   * @param y - Wreck y.
   */
  noteWreck(x: number, y: number): void {
    if (this.definition.feedHullPoints > 0) this.feeder.note(x, y);
  }

  /**
   * What the body does to a hit before the scene applies it: a phase-shifted
   * creature wastes it; with shields down a hit lands on the part the
   * attacker is aligned with (its multiplier scales the hull damage, the
   * part's own hit points drop); any hit breaks a feed.
   *
   * @param input - The hit.
   * @returns The adjusted damage and the part hit (a reused object).
   */
  absorbHit(input: AbsorbHitInput): AbsorbHitResult {
    const result = this.hitResult;
    result.damage = input.damage;
    result.partId = null;
    result.blocked = false;
    if (this.runner.phased) {
      result.damage = 0;
      result.blocked = true;
      return result;
    }
    this.feeder.interrupt();
    if (input.shieldsUp) return result;
    const bearing = bearingOffNoseDeg(
      this.body,
      { x: input.fromX, y: input.fromY },
      this.config.worldSize,
    );
    const part = findHitPart(this.parts, bearing, input.nowMs);
    if (!part) return result;
    result.partId = part.spec.id;
    result.damage = input.damage * part.spec.damageMultiplier;
    if (damagePart(part, input.damage))
      this.destroyedParts.push(part.spec.name);
    return result;
  }

  /**
   * One logic tick.
   *
   * @param frame - What the creature can see.
   * @param effects - What it may ask the scene to do.
   */
  step(frame: CreatureFrame, effects: CreatureEffects): void {
    while (this.destroyedParts.length > 0)
      effects.emit(
        "part_destroyed",
        this.destroyedParts.pop()!,
        this.x,
        this.y,
      );
    this.updatePhase(frame, effects);
    const phase = this.phase;
    const wasIdle = this.runner.telegraph.stage === "idle";
    this.runner.step(frame, effects, {
      phaseIndex: this.phaseIndex,
      damageScale: phase.damageScale,
      cooldownScale: phase.cooldownScale,
    });
    if (wasIdle && this.runner.telegraph.stage !== "idle")
      this.feeder.interrupt();
    this.stepFeeding(frame, effects);
    this.stepMovement(frame);
  }

  private updatePhase(frame: CreatureFrame, effects: CreatureEffects): void {
    const thresholds = this.config.phaseThresholds;
    while (
      this.phaseIndex < thresholds.length &&
      frame.hullFraction <= thresholds[this.phaseIndex]!
    ) {
      this.phaseIndex++;
      effects.emit("phase", this.phase.name, this.x, this.y);
    }
  }

  private huntedWreck(frame: CreatureFrame): Wreck | null {
    return this.definition.feedHullPoints > 0 && frame.hullFraction < 1
      ? this.feeder.nearest(this.body)
      : null;
  }

  private stepFeeding(frame: CreatureFrame, effects: CreatureEffects): void {
    const outcome = this.feeder.step(
      this.body,
      this.definition.radiusPx,
      this.huntedWreck(frame),
      this.runner.telegraph.stage === "idle",
      frame.deltaMs,
    );
    if (outcome === "started") effects.emit("feed", "FEEDING", this.x, this.y);
    else if (outcome === "fed")
      effects.heal(this.definition.feedHullPoints * DURABILITY_SCALE);
  }

  private stepMovement(frame: CreatureFrame): void {
    const move = this.move;
    const tele = this.runner.telegraph;
    move.style = this.phase.movementStyle ?? this.definition.movement.style;
    move.deltaMs = frame.deltaMs;
    move.nowMs = frame.nowMs;
    move.speedScale =
      this.phase.speedScale *
      (tele.stage === "windup" ? WINDUP_SPEED_SCALE : 1) *
      (this.feeder.feeding ? FEED_SPEED_SCALE : 1);
    this.pickGoal(frame);
    if (tele.stage === "active" && tele.kind === "lunge")
      coastBody(this.body, move);
    else stepBody(this.body, move);
  }

  private pickGoal(frame: CreatureFrame): void {
    const move = this.move;
    const wreck = this.huntedWreck(frame);
    if (wreck) {
      move.hasGoal = true;
      move.goalX = wreck.x;
      move.goalY = wreck.y;
      return;
    }
    let best = Infinity;
    move.hasGoal = false;
    for (const target of frame.targets) {
      const range = torusRangePx(this.body, target, this.config.worldSize);
      if (range >= best) continue;
      best = range;
      move.hasGoal = true;
      move.goalX = target.x;
      move.goalY = target.y;
    }
  }
}
