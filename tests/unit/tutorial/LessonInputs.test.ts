/**
 * Spec: Flight School shows the inputs a lesson asks for as key chips that
 * light up while held, with progress through multi-step gestures (Hook:
 * Z held then a side; Knife: tap Z, tap Z again and keep it down, then a
 * side) and a done state. Pure model over the held intents.
 */

import { describe, it, expect } from "vitest";
import type { ActionIntent } from "../../../src/input/InputTypes";
import { FLIGHT_SCHOOL_STEPS } from "../../../src/tutorial/FlightSchoolSteps";
import { advanceGesture } from "../../../src/tutorial/GestureTracker";
import { lessonInputPlan } from "../../../src/tutorial/LessonPlans";
import {
  lessonDoneView,
  lessonInputView,
  startGesture,
  type GestureProgress,
  type LessonInputPlan,
} from "../../../src/tutorial/LessonInputs";

const LABELS: Partial<Record<ActionIntent, string>> = {
  MANEUVER: "Z",
  STEER_LEFT: "←",
  STEER_RIGHT: "→",
  THRUST_UP: "↑",
  THRUST_DOWN: "↓",
};
const keys = (intent: ActionIntent): string => LABELS[intent] ?? intent;

function plan(id: string): LessonInputPlan {
  const found = lessonInputPlan(id, keys);
  if (!found) throw new Error(`no plan for ${id}`);
  return found;
}

/** Feed (time, held intents) frames and return the final progress. */
function run(
  lesson: LessonInputPlan,
  frames: ReadonlyArray<readonly [number, ActionIntent[]]>,
): GestureProgress {
  let progress = startGesture();
  for (const [nowMs, held] of frames)
    progress = advanceGesture(lesson, progress, {
      nowMs,
      held: new Set(held),
    });
  return progress;
}

describe("lesson input plans", () => {
  it("has a plan for every lesson", () => {
    for (const step of FLIGHT_SCHOOL_STEPS)
      expect(lessonInputPlan(step.id, keys), step.id).not.toBeNull();
  });

  it("names the bound keys on the chips", () => {
    const hook = plan("segnor");
    const labels = hook.stages.flatMap((s) => s.chips.map((c) => c.label));
    expect(labels).toEqual(["Z", "← / →"]);
  });
});

describe("Hook loop gesture", () => {
  it("needs Z held, then a side while Z stays held", () => {
    const hook = plan("segnor");
    expect(run(hook, [[0, ["MANEUVER"]]]).stage).toBe(1);
    const done = run(hook, [
      [0, ["MANEUVER"]],
      [50, ["MANEUVER", "STEER_LEFT"]],
    ]);
    expect(done.completions).toBe(1);
  });

  it("falls back to the first stage when Z is released before the side", () => {
    const hook = plan("segnor");
    const progress = run(hook, [
      [0, ["MANEUVER"]],
      [50, []],
      [100, ["STEER_LEFT"]],
    ]);
    expect(progress.stage).toBe(0);
    expect(progress.completions).toBe(0);
  });
});

describe("Knife roll gesture", () => {
  const knife = plan("tallon");

  it("completes on tap, second press kept down, then a side", () => {
    const frames: Array<readonly [number, ActionIntent[]]> = [
      [0, ["MANEUVER"]],
      [50, []],
      [120, ["MANEUVER"]],
      [200, ["MANEUVER"]],
    ];
    expect(run(knife, frames).stage).toBe(2);
    const done = run(knife, [...frames, [260, ["MANEUVER", "STEER_RIGHT"]]]);
    expect(done.completions).toBe(1);
  });

  it("restarts when the second press comes too late", () => {
    const progress = run(knife, [
      [0, ["MANEUVER"]],
      [50, []],
      [1200, ["MANEUVER"]],
    ]);
    expect(progress.stage).toBe(1);
  });

  it("is not thrown off by an earlier lone tap (a wasted Snap turn)", () => {
    const progress = run(knife, [
      [0, ["MANEUVER"]],
      [50, []],
      [320, ["MANEUVER"]],
      [370, []],
      [410, ["MANEUVER"]],
      [470, ["MANEUVER", "STEER_LEFT"]],
    ]);
    expect(progress.completions).toBe(1);
  });

  it("restarts when the second press is released before the side", () => {
    const progress = run(knife, [
      [0, ["MANEUVER"]],
      [50, []],
      [120, ["MANEUVER"]],
      [180, []],
      [240, ["STEER_LEFT"]],
    ]);
    expect(progress.completions).toBe(0);
    expect(progress.stage).toBe(0);
  });
});

describe("tap counting", () => {
  it("boost needs two quick taps of the throttle key", () => {
    const boost = plan("boost");
    const quick = run(boost, [
      [0, ["THRUST_UP"]],
      [50, []],
      [120, ["THRUST_UP"]],
    ]);
    expect(quick.completions).toBe(1);
    const slow = run(boost, [
      [0, ["THRUST_UP"]],
      [50, []],
      [900, ["THRUST_UP"]],
    ]);
    expect(slow.completions).toBe(0);
  });

  it("barrel roll needs the SAME arrow twice, alternating is steering", () => {
    const roll = plan("barrel_roll");
    const alternating = run(roll, [
      [0, ["STEER_LEFT"]],
      [50, []],
      [120, ["STEER_RIGHT"]],
    ]);
    expect(alternating.completions).toBe(0);
    const same = run(roll, [
      [0, ["STEER_LEFT"]],
      [50, []],
      [120, ["STEER_LEFT"]],
    ]);
    expect(same.completions).toBe(1);
  });
});

describe("chip view", () => {
  it("lights a chip while its key is held and a moment after", () => {
    const hook = plan("segnor");
    const held = run(hook, [[0, ["MANEUVER"]]]);
    const lit = lessonInputView(hook, held, new Set(["MANEUVER"]), 10);
    expect(lit.stages[0]!.chips[0]!.lit).toBe(true);
    expect(lit.stages[1]!.chips[0]!.lit).toBe(false);
    const lingering = lessonInputView(hook, held, new Set(), 100);
    expect(lingering.stages[0]!.chips[0]!.lit).toBe(true);
    const gone = lessonInputView(hook, held, new Set(), 2000);
    expect(gone.stages[0]!.chips[0]!.lit).toBe(false);
  });

  it("marks stages complete, active and pending, with tap progress", () => {
    const knife = plan("tallon");
    const progress = run(knife, [[0, ["MANEUVER"]]]);
    const view = lessonInputView(knife, progress, new Set(), 10);
    expect(view.stages.map((s) => s.state)).toEqual([
      "complete",
      "active",
      "pending",
    ]);
    const throttle = plan("throttle_up");
    const first = run(throttle, [[0, ["THRUST_UP"]]]);
    expect(
      lessonInputView(throttle, first, new Set(), 10).stages[0]!.progress,
    ).toBe("1/2");
  });

  it("shows done after the gesture completes, then clears", () => {
    const mark = plan("mark");
    const progress = run(mark, [[0, ["MARK_TARGET"]]]);
    expect(lessonInputView(mark, progress, new Set(), 100).done).toBe(true);
    expect(lessonInputView(mark, progress, new Set(), 5000).done).toBe(false);
  });

  it("does not claim done for lessons the input cannot prove", () => {
    const fire = plan("primary_fire");
    expect(fire.tracked).toBe(false);
    const progress = run(fire, [[0, ["STEER_LEFT"]]]);
    expect(lessonInputView(fire, progress, new Set(), 10).done).toBe(false);
  });
});

describe("finished lesson row", () => {
  it("completes every stage and says done, even for lessons the input cannot prove", () => {
    const view = lessonDoneView(plan("primary_fire"));
    expect(view.done).toBe(true);
    expect(view.stages.every((s) => s.state === "complete")).toBe(true);
  });
});
