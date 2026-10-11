/**
 * SquadMark — specification tests: one mark per side, refresh and
 * replacement, expiry, and forgetting a destroyed target.
 */

import { describe, expect, it } from "vitest";
import {
  clearMark,
  forgetMarkedTarget,
  isMarkedBy,
  markedTargetOf,
  NO_SQUAD_MARKS,
  placeMark,
  SQUAD_MARK_DURATION_MS,
} from "../../../../src/arcade/systems/SquadMark";

describe("SquadMark", () => {
  it("nobody_has_a_mark_at_the_start", () => {
    expect(markedTargetOf(NO_SQUAD_MARKS, "player", 0)).toBeNull();
  });

  it("marks_one_target_for_the_marking_side_only", () => {
    const marks = placeMark(NO_SQUAD_MARKS, "player", "enemy_1", 0);
    expect(isMarkedBy(marks, "player", "enemy_1", 100)).toBe(true);
    expect(isMarkedBy(marks, "ai", "enemy_1", 100)).toBe(false);
    expect(isMarkedBy(marks, "player", "enemy_2", 100)).toBe(false);
  });

  it("a_new_mark_replaces_the_sides_previous_one", () => {
    const marks = placeMark(
      placeMark(NO_SQUAD_MARKS, "player", "enemy_1", 0),
      "player",
      "enemy_2",
      10,
    );
    expect(markedTargetOf(marks, "player", 20)).toBe("enemy_2");
  });

  it("expires_after_its_duration_unless_refreshed", () => {
    const marks = placeMark(NO_SQUAD_MARKS, "player", "enemy_1", 0);
    expect(markedTargetOf(marks, "player", SQUAD_MARK_DURATION_MS - 1)).toBe(
      "enemy_1",
    );
    expect(markedTargetOf(marks, "player", SQUAD_MARK_DURATION_MS)).toBeNull();
    const refreshed = placeMark(
      marks,
      "player",
      "enemy_1",
      SQUAD_MARK_DURATION_MS - 1,
    );
    expect(
      markedTargetOf(refreshed, "player", SQUAD_MARK_DURATION_MS + 100),
    ).toBe("enemy_1");
  });

  it("drops_every_mark_on_a_destroyed_target", () => {
    const marks = placeMark(
      placeMark(NO_SQUAD_MARKS, "a", "x", 0),
      "b",
      "x",
      0,
    );
    const after = forgetMarkedTarget(marks, "x");
    expect(markedTargetOf(after, "a", 1)).toBeNull();
    expect(markedTargetOf(after, "b", 1)).toBeNull();
  });

  it("clears_a_sides_mark_without_touching_others", () => {
    const marks = placeMark(
      placeMark(NO_SQUAD_MARKS, "a", "x", 0),
      "b",
      "y",
      0,
    );
    const after = clearMark(marks, "a");
    expect(markedTargetOf(after, "a", 1)).toBeNull();
    expect(markedTargetOf(after, "b", 1)).toBe("y");
  });

  it("never_mutates_the_table_it_was_given", () => {
    const marks = placeMark(NO_SQUAD_MARKS, "a", "x", 0);
    placeMark(marks, "a", "y", 1);
    forgetMarkedTarget(marks, "x");
    expect(markedTargetOf(marks, "a", 2)).toBe("x");
    expect(NO_SQUAD_MARKS.size).toBe(0);
  });
});
