/**
 * objectiveRows — specification for how Campaign objectives read on the
 * holographic objective tracker.
 */

import { describe, it, expect } from "vitest";
import {
  BONUS_PREFIX,
  DONE_MARK,
  objectiveRow,
} from "../../../../src/ui/modeHud/objectiveRows";

describe("objectiveRow", () => {
  it("shows kill progress on an eliminate objective", () => {
    const row = objectiveRow({
      objective: { type: "eliminate", description: "Destroy fighters" },
      completed: false,
      progress: 2,
      target: 3,
    });
    expect(row.text).toBe("Destroy fighters (2/3)");
  });

  it("counts down the time left on a timed objective", () => {
    const row = objectiveRow({
      objective: { type: "survive", description: "Hold out", timeLimit: 60 },
      completed: false,
      progress: 15,
      target: 1,
    });
    expect(row.text).toBe("Hold out (45s)");
  });

  it("never shows negative time", () => {
    const row = objectiveRow({
      objective: { type: "defend", description: "Defend", timeLimit: 10 },
      completed: false,
      progress: 12,
      target: 1,
    });
    expect(row.text).toBe("Defend (0s)");
  });

  it("shows no countdown on a timed type without a time limit", () => {
    const row = objectiveRow({
      objective: { type: "survive", description: "Keep wingman alive" },
      completed: false,
      progress: 30,
      target: 1,
    });
    expect(row.text).toBe("Keep wingman alive");
  });

  it("marks a completed objective done with a check", () => {
    const row = objectiveRow({
      objective: { type: "eliminate", description: "Destroy" },
      completed: true,
      progress: 3,
      target: 3,
    });
    expect(row).toMatchObject({ text: `Destroy${DONE_MARK}`, done: true });
  });

  it("prefixes bonus objectives", () => {
    const row = objectiveRow({
      objective: {
        type: "escort",
        description: "Keep wingman",
        optional: true,
      },
      completed: false,
      progress: 0,
      target: 1,
    });
    expect(row).toMatchObject({
      text: `${BONUS_PREFIX}Keep wingman`,
      optional: true,
    });
  });
});
