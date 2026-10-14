/**
 * CreaturePowerRunner — the telegraphed power cycle of one creature: idle →
 * wind-up (1–2 cycles, locked aim, visible telegraph) → landing → optional
 * channel → cooldown. One attack per cycle: after any power ends the brain
 * waits a full cycle before the next wind-up starts. Selection and effects
 * live in CreaturePowerBrain / CreaturePowerEffects. Pure; allocation-free
 * after construction.
 */

import { CYCLE_DURATION_MS } from "../../config";
import type { CreatureDefinition } from "../../data/creatures/creatureTypes";
import type { CreatureBody } from "./CreatureMovement";
import type { PartState } from "./CreatureParts";
import { pickPower, type SelectionContext } from "./CreaturePowerBrain";
import {
  beginWindup,
  landPower,
  tickActive,
  tickZones,
  type PowerContext,
} from "./CreaturePowerEffects";
import {
  createTelegraph,
  createZones,
  HitGate,
  PreyTracker,
} from "./CreaturePowerState";
import type { CreatureRng } from "./CreatureRng";
import type { CreatureEffects, CreatureFrame } from "./CreatureWorld";

/** Retry delay of an idle brain with nothing usable (ms). */
const IDLE_RETRY_MS = CYCLE_DURATION_MS / 2;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** What the owner tells the runner each frame. */
export interface RunnerInput {
  readonly phaseIndex: number;
  readonly damageScale: number;
  readonly cooldownScale: number;
}

/** A creature's power machine. */
export class PowerRunner {
  readonly telegraph = createTelegraph();
  readonly zones = createZones();
  readonly prey = new PreyTracker();
  /** True while a blink has the creature phase-shifted. */
  phased = false;

  private readonly gate = new HitGate();
  private readonly cooldownUntil: number[];
  private readonly power: Mutable<PowerContext>;
  private readonly selection: Mutable<SelectionContext>;
  private nextDecisionMs = CYCLE_DURATION_MS;
  private cooldownScale = 1;

  /**
   * @param definition - The creature.
   * @param body - Its body (mutated by blinks and lunges).
   * @param parts - Its parts (a lost part disables powers).
   * @param worldSize - Map edge (px).
   * @param rng - The encounter's random stream.
   */
  constructor(
    private readonly definition: CreatureDefinition,
    body: CreatureBody,
    parts: readonly PartState[],
    worldSize: number,
    rng: CreatureRng,
  ) {
    this.cooldownUntil = definition.powers.map(() => 0);
    this.power = {
      body,
      radiusPx: definition.radiusPx,
      worldSize,
      targets: [],
      effects: undefined as unknown as CreatureEffects,
      gate: this.gate,
      prey: this.prey,
      zones: this.zones,
      rng,
      nowMs: 0,
      deltaMs: 0,
      damageScale: 1,
    };
    this.selection = {
      specs: definition.powers,
      cooldownUntil: this.cooldownUntil,
      phaseIndex: 0,
      parts,
      body,
      radiusPx: definition.radiusPx,
      worldSize,
      targets: [],
      addsAlive: 0,
      nowMs: 0,
      rng,
    };
  }

  /**
   * One frame of the power machine and of the spore clouds.
   *
   * @param frame - What the creature sees.
   * @param effects - What it may ask the scene to do.
   * @param input - Phase scaling.
   */
  step(
    frame: CreatureFrame,
    effects: CreatureEffects,
    input: RunnerInput,
  ): void {
    const ctx = this.power;
    ctx.targets = frame.targets;
    ctx.effects = effects;
    ctx.nowMs = frame.nowMs;
    ctx.deltaMs = frame.deltaMs;
    ctx.damageScale = input.damageScale;
    this.cooldownScale = input.cooldownScale;
    this.prey.update(frame.targets, ctx.worldSize);
    const tele = this.telegraph;
    if (tele.stage === "idle") this.tryBegin(frame, effects, input);
    else if (tele.stage === "windup") this.stepWindup(frame, effects);
    else this.stepActive(frame);
    tickZones(ctx);
  }

  /** Cancels the power in progress (the owner was interrupted). */
  cancel(): void {
    this.telegraph.stage = "idle";
    this.telegraph.powerIndex = -1;
    this.phased = false;
  }

  private tryBegin(
    frame: CreatureFrame,
    effects: CreatureEffects,
    input: RunnerInput,
  ): void {
    if (frame.nowMs < this.nextDecisionMs) return;
    const sel = this.selection;
    sel.phaseIndex = input.phaseIndex;
    sel.targets = frame.targets;
    sel.addsAlive = frame.addsAlive;
    sel.nowMs = frame.nowMs;
    const index = pickPower(sel);
    if (index < 0) {
      this.nextDecisionMs = frame.nowMs + IDLE_RETRY_MS;
      return;
    }
    const spec = this.definition.powers[index]!;
    const body = this.power.body;
    beginWindup(this.telegraph, spec, index, this.power);
    effects.emit("telegraph", spec.name, body.x, body.y);
    if (spec.kind !== "blink") return;
    this.phased = true;
    effects.emit("phase_shift", spec.name, body.x, body.y);
  }

  private stepWindup(frame: CreatureFrame, effects: CreatureEffects): void {
    const tele = this.telegraph;
    if (frame.nowMs < tele.endsMs) return;
    const spec = this.definition.powers[tele.powerIndex]!;
    effects.emit("power", spec.name, this.power.body.x, this.power.body.y);
    this.phased = false;
    if (!landPower(spec, tele, this.power)) {
      this.finish(frame.nowMs);
      return;
    }
    tele.stage = "active";
    tele.startedMs = frame.nowMs;
    tele.endsMs = frame.nowMs + (spec.durationMs ?? CYCLE_DURATION_MS);
  }

  private stepActive(frame: CreatureFrame): void {
    const tele = this.telegraph;
    tickActive(this.definition.powers[tele.powerIndex]!, tele, this.power);
    if (frame.nowMs >= tele.endsMs) this.finish(frame.nowMs);
  }

  private finish(nowMs: number): void {
    const tele = this.telegraph;
    const spec = this.definition.powers[tele.powerIndex]!;
    this.cooldownUntil[tele.powerIndex] =
      nowMs + spec.cooldownCycles * CYCLE_DURATION_MS * this.cooldownScale;
    this.nextDecisionMs = nowMs + CYCLE_DURATION_MS;
    this.cancel();
  }
}
