import { describe, expect, it } from "vitest";
import {
  MAX_FRAME_MS,
  MAX_TICKS_PER_FRAME,
  planFixedSteps,
} from "../../../src/arcade/systems/FixedStepPlan";

const STEP_MS = 1000 / 60;

describe("planFixedSteps", () => {
  it("runs one tick for a 60 fps frame and keeps the remainder", () => {
    const plan = planFixedSteps(0, STEP_MS + 1, 1, STEP_MS);
    expect(plan.ticks).toBe(1);
    expect(plan.remainderMs).toBeCloseTo(1, 6);
  });

  it("runs nothing until a whole step has accumulated", () => {
    const plan = planFixedSteps(0, 5, 1, STEP_MS);
    expect(plan.ticks).toBe(0);
    expect(plan.remainderMs).toBe(5);
  });

  it("catches up two ticks on a 30 fps frame", () => {
    expect(planFixedSteps(0, 2 * STEP_MS + 0.1, 1, STEP_MS).ticks).toBe(2);
  });

  it("caps the catch-up at MAX_TICKS_PER_FRAME so a slow machine slows down instead of spiralling", () => {
    const plan = planFixedSteps(0, MAX_FRAME_MS, 1, STEP_MS);
    expect(plan.ticks).toBe(MAX_TICKS_PER_FRAME);
  });

  it("drops the backlog beyond the cap (slow motion, no growing debt)", () => {
    const plan = planFixedSteps(0, MAX_FRAME_MS, 1, STEP_MS);
    expect(plan.remainderMs).toBeLessThan(STEP_MS);
    expect(plan.remainderMs).toBeGreaterThanOrEqual(0);
  });

  it("clamps a huge frame (tab switch) to MAX_FRAME_MS before scaling", () => {
    const hidden = planFixedSteps(0, 60_000, 1, STEP_MS);
    const clamped = planFixedSteps(0, MAX_FRAME_MS, 1, STEP_MS);
    expect(hidden).toEqual(clamped);
  });

  it("scales the cap with the debug time scale so fast-forward still works", () => {
    const plan = planFixedSteps(0, MAX_FRAME_MS, 10, STEP_MS);
    expect(plan.ticks).toBeGreaterThan(MAX_TICKS_PER_FRAME);
    expect(plan.ticks).toBeLessThanOrEqual(MAX_TICKS_PER_FRAME * 10);
  });

  it("does not shrink the cap for a slow-motion time scale", () => {
    const plan = planFixedSteps(0, MAX_FRAME_MS, 0.5, STEP_MS);
    expect(plan.ticks).toBeLessThanOrEqual(MAX_TICKS_PER_FRAME);
    expect(plan.ticks).toBeGreaterThan(0);
  });

  it("carries the previous accumulator into the plan", () => {
    const plan = planFixedSteps(STEP_MS - 1, 2, 1, STEP_MS);
    expect(plan.ticks).toBe(1);
    expect(plan.remainderMs).toBeCloseTo(1, 6);
  });
});
