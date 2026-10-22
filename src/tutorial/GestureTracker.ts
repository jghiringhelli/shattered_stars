/**
 * GestureTracker — advances a lesson's gesture stage by stage from the
 * intents held each frame (taps, holds, timing windows, keys that must stay
 * down). Pure: no Phaser.
 */

import type { ActionIntent } from "../input/InputTypes";
import {
  NEVER,
  isLit,
  type GestureFrame,
  type GestureProgress,
  type GestureStage,
  type LessonInputPlan,
} from "./LessonInputs";

const allLit = (
  stage: GestureStage,
  held: ReadonlySet<ActionIntent>,
): boolean => stage.chips.every((c) => isLit(c, held));

/**
 * @param stage - A tap stage.
 * @param held - Intents held now.
 * @param before - Intents held the previous frame.
 * @returns The intent that was freshly pressed, or null.
 */
function pressedNow(
  stage: GestureStage,
  held: ReadonlySet<ActionIntent>,
  before: ReadonlySet<ActionIntent>,
): ActionIntent | null {
  for (const c of stage.chips)
    for (const intent of c.intents)
      if (held.has(intent) && !before.has(intent)) return intent;
  return null;
}

/**
 * Restart the gesture when its timing window ran out or the kept-down key
 * was let go.
 *
 * @param plan - The lesson's plan.
 * @param progress - Progress before the frame.
 * @param frame - This frame.
 * @returns The progress to evaluate this frame against.
 */
function restartIfBroken(
  plan: LessonInputPlan,
  progress: GestureProgress,
  frame: GestureFrame,
): GestureProgress {
  const stage = plan.stages[progress.stage];
  if (!stage) return progress;
  const waiting = progress.stage > 0 || progress.taps > 0;
  const late =
    waiting &&
    stage.windowMs !== undefined &&
    frame.nowMs - progress.anchorAtMs > stage.windowMs;
  const previous = plan.stages[progress.stage - 1];
  const dropped =
    stage.keepPrevious === true &&
    previous !== undefined &&
    !allLit(previous, frame.held);
  if (!late && !dropped) return progress;
  return {
    ...progress,
    stage: 0,
    taps: 0,
    tapIntent: null,
    anchorAtMs: NEVER,
  };
}

/**
 * Advance through the plan's stages for one frame.
 *
 * @param plan - The lesson's plan.
 * @param before - Progress before the frame.
 * @param frame - Held intents and time.
 * @returns Progress after the frame.
 */
export function advanceGesture(
  plan: LessonInputPlan,
  before: GestureProgress,
  frame: GestureFrame,
): GestureProgress {
  let progress = restartIfBroken(plan, before, frame);
  const stage = plan.stages[progress.stage];
  const lastHeldAtMs = { ...progress.lastHeldAtMs };
  for (const intent of frame.held) lastHeldAtMs[intent] = frame.nowMs;
  progress = { ...progress, lastHeldAtMs, previousHeld: frame.held };
  if (!stage) return progress;
  if (stage.mode === "hold")
    return allLit(stage, frame.held)
      ? completeStage(plan, progress, frame.nowMs)
      : progress;
  const intent = pressedNow(stage, frame.held, before.previousHeld);
  if (intent === null) return progress;
  const same = progress.taps > 0 && progress.tapIntent === intent;
  const taps = same ? progress.taps + 1 : 1;
  if (taps >= (stage.taps ?? 1))
    return completeStage(plan, progress, frame.nowMs);
  return { ...progress, taps, tapIntent: intent, anchorAtMs: frame.nowMs };
}

function completeStage(
  plan: LessonInputPlan,
  progress: GestureProgress,
  nowMs: number,
): GestureProgress {
  const next = progress.stage + 1;
  if (next < plan.stages.length)
    return {
      ...progress,
      stage: next,
      taps: 0,
      tapIntent: null,
      anchorAtMs: nowMs,
    };
  return {
    ...progress,
    stage: 0,
    taps: 0,
    tapIntent: null,
    anchorAtMs: NEVER,
    completions: progress.completions + 1,
    lastCompletedAtMs: nowMs,
  };
}
