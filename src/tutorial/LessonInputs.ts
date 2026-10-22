/**
 * LessonInputs — the inputs a Flight School lesson asks for, as a pure model.
 *
 * A lesson's plan is a list of stages (tap Z → tap Z again → add a side).
 * Each frame the scene hands in the intents the player holds; the tracker
 * advances through the stages and the view says which key chips are lit,
 * which stage is active and whether the gesture was performed. The chips
 * name the bound keys (labels come from the live bindings).
 *
 * Pure: no Phaser.
 */

import type { ActionIntent } from "../input/InputTypes";

/** One key chip: lit while any of its intents is held. */
export interface InputChipSpec {
  readonly label: string;
  readonly intents: readonly ActionIntent[];
}

/** One step of a gesture. */
export interface GestureStage {
  /** Gesture word shown before the chips ("tap", "hold", "then"). */
  readonly hint: string;
  /** tap = a fresh press; hold = every chip held together. */
  readonly mode: "tap" | "hold";
  readonly chips: readonly InputChipSpec[];
  /** Taps of the same key required (tap mode; default 1). */
  readonly taps?: number;
  /** Longest wait since the previous stage or tap (ms). */
  readonly windowMs?: number;
  /** The previous stage's chips must stay held, or the gesture restarts. */
  readonly keepPrevious?: boolean;
}

/** A lesson's inputs. */
export interface LessonInputPlan {
  readonly stages: readonly GestureStage[];
  /** False when the input alone cannot prove the lesson (chips only light). */
  readonly tracked: boolean;
}

/** A chip stays lit this long after its key was released, so taps show. */
export const CHIP_LINGER_MS = 180;
/** The done state stays on the card this long (ms). */
export const DONE_SHOWN_MS = 1500;

/** Where a player is in the gesture. */
export interface GestureProgress {
  readonly stage: number;
  readonly taps: number;
  readonly tapIntent: ActionIntent | null;
  readonly anchorAtMs: number;
  readonly completions: number;
  readonly lastCompletedAtMs: number;
  readonly previousHeld: ReadonlySet<ActionIntent>;
  readonly lastHeldAtMs: Readonly<Partial<Record<ActionIntent, number>>>;
}

/** One frame of held intents. */
export interface GestureFrame {
  readonly nowMs: number;
  readonly held: ReadonlySet<ActionIntent>;
}

/** A time that is never within any window. */
export const NEVER = -1_000_000_000;
const NO_INTENTS: ReadonlySet<ActionIntent> = new Set();

/** @returns A gesture with nothing pressed yet. */
export function startGesture(): GestureProgress {
  return {
    stage: 0,
    taps: 0,
    tapIntent: null,
    anchorAtMs: NEVER,
    completions: 0,
    lastCompletedAtMs: NEVER,
    previousHeld: NO_INTENTS,
    lastHeldAtMs: {},
  };
}

/** Whether any intent of a chip is held. */
export const isLit = (
  chipSpec: InputChipSpec,
  held: ReadonlySet<ActionIntent>,
): boolean => chipSpec.intents.some((intent) => held.has(intent));

/** A chip as drawn. */
export interface ChipView {
  readonly label: string;
  readonly lit: boolean;
}

/** A stage as drawn. */
export interface StageView {
  readonly hint: string;
  readonly chips: readonly ChipView[];
  readonly state: "pending" | "active" | "complete";
  /** Tap progress such as "1/2", or null. */
  readonly progress: string | null;
}

/** The whole input row as drawn. */
export interface LessonInputView {
  readonly stages: readonly StageView[];
  /** The gesture was just performed (the game may still refuse it). */
  readonly done: boolean;
  /** The lesson itself is complete. */
  readonly finished: boolean;
}

/**
 * @param plan - The lesson's plan.
 * @param progress - Gesture progress.
 * @param held - Intents held now.
 * @param nowMs - Scene time.
 * @returns What to draw.
 */
export function lessonInputView(
  plan: LessonInputPlan,
  progress: GestureProgress,
  held: ReadonlySet<ActionIntent>,
  nowMs: number,
): LessonInputView {
  const done =
    plan.tracked &&
    progress.completions > 0 &&
    nowMs - progress.lastCompletedAtMs <= DONE_SHOWN_MS;
  const lingering = (c: InputChipSpec): boolean =>
    isLit(c, held) ||
    c.intents.some(
      (intent) =>
        nowMs - (progress.lastHeldAtMs[intent] ?? NEVER) <= CHIP_LINGER_MS,
    );
  const stages = plan.stages.map((stage, index): StageView => {
    const state =
      done || (plan.tracked && index < progress.stage)
        ? "complete"
        : plan.tracked && index === progress.stage
          ? "active"
          : "pending";
    const wanted = stage.taps ?? 1;
    const tapProgress =
      wanted > 1 && index === progress.stage && progress.taps > 0
        ? `${progress.taps}/${wanted}`
        : wanted > 1 && plan.tracked
          ? `0/${wanted}`
          : null;
    return {
      hint: stage.hint,
      chips: stage.chips.map((c) => ({ label: c.label, lit: lingering(c) })),
      state: !plan.tracked ? "active" : state,
      progress: tapProgress,
    };
  });
  return { stages, done, finished: false };
}

/**
 * The row of a lesson that was just completed: every stage done.
 *
 * @param plan - The lesson's plan.
 * @returns The finished picture.
 */
export function lessonDoneView(plan: LessonInputPlan): LessonInputView {
  return {
    stages: plan.stages.map((stage) => ({
      hint: stage.hint,
      chips: stage.chips.map((c) => ({ label: c.label, lit: false })),
      state: "complete",
      progress: null,
    })),
    done: true,
    finished: true,
  };
}
