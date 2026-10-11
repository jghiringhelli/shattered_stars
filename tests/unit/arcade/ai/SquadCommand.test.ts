/**
 * SquadCommand — specification tests: an AI leader marks its squad's focus
 * and every member gets that focus; the player's side follows the player's
 * mark (or the coordinator's choice while unmarked) and never marks on its
 * own; orders hold between re-plans; a dead focus is replaced.
 */

import { describe, expect, it } from "vitest";
import {
  SquadCommand,
  SQUAD_PLAN_INTERVAL_MS,
} from "../../../../src/arcade/ai/SquadCommand";
import type { BotContact } from "../../../../src/arcade/ai/BotView";
import {
  markedTargetOf,
  NO_SQUAD_MARKS,
  placeMark,
  type SquadMarks,
} from "../../../../src/arcade/systems/SquadMark";
import { contact } from "./aiFixtures";

const SHIP = "terran_gladius";

/** Two squads of two, 800 px apart. */
function battle(): BotContact[] {
  return [
    contact("a1", "red", SHIP, { x: 3000, y: 3000, angle: 0 }),
    contact("a2", "red", SHIP, { x: 3120, y: 3000, angle: 0 }),
    contact("b1", "blue", SHIP, { x: 3000, y: 2200, angle: 180 }),
    contact("b2", "blue", SHIP, { x: 3150, y: 2200, angle: 180 }, { hull: 1 }),
  ];
}

/** Run a command for a while (past its reaction delay), returning the marks. */
function run(
  command: SquadCommand,
  ships: BotContact[],
  marks: SquadMarks = NO_SQUAD_MARKS,
  untilMs = 1000,
): SquadMarks {
  let current = marks;
  for (let t = 0; t <= untilMs; t += 50)
    current = command.update({ nowMs: t, ships, marks: current });
  return current;
}

describe("SquadCommand — AI leader", () => {
  it("marks the squad's focus and gives every member that focus", () => {
    const command = new SquadCommand({ side: "red", aiLeader: true });
    const marks = run(command, battle());
    const focus = command.focusTargetId;
    expect(["b1", "b2"]).toContain(focus);
    expect(markedTargetOf(marks, "red", 1000)).toBe(focus);
    expect(command.orderFor("a1")?.focusTargetId).toBe(focus);
    expect(command.orderFor("a2")?.focusTargetId).toBe(focus);
  });

  it("focuses the weakest enemy near the squad", () => {
    const command = new SquadCommand({ side: "red", aiLeader: true });
    run(command, battle());
    expect(command.focusTargetId).toBe("b2");
  });

  it("re-marks a new focus when the marked enemy dies", () => {
    const command = new SquadCommand({ side: "red", aiLeader: true });
    const ships = battle();
    let marks = run(command, ships);
    const dead = ships.map((s) => (s.id === "b2" ? { ...s, alive: false } : s));
    for (let t = 1050; t <= 2000; t += 50)
      marks = command.update({ nowMs: t, ships: dead, marks });
    expect(markedTargetOf(marks, "red", 2000)).toBe("b1");
  });

  it("holds its orders between re-plans", () => {
    const command = new SquadCommand({ side: "red", aiLeader: true });
    const ships = battle();
    run(command, ships, NO_SQUAD_MARKS, 600);
    const before = command.orderFor("a1");
    command.update({
      nowMs: 600 + SQUAD_PLAN_INTERVAL_MS / 2,
      ships,
      marks: NO_SQUAD_MARKS,
    });
    expect(command.orderFor("a1")).toBe(before);
  });

  it("gives no order to ships of other sides", () => {
    const command = new SquadCommand({ side: "red", aiLeader: true });
    run(command, battle());
    expect(command.orderFor("b1")).toBeNull();
  });
});

describe("SquadCommand — the player's side", () => {
  it("never marks on its own", () => {
    const command = new SquadCommand({ side: "red", aiLeader: false });
    const marks = run(command, battle());
    expect(markedTargetOf(marks, "red", 1000)).toBeNull();
    expect(command.orderFor("a2")?.focusTargetId).toBe("b2");
  });

  it("makes the player's mark the wingmen's focus", () => {
    const command = new SquadCommand({ side: "red", aiLeader: false });
    const marked = placeMark(NO_SQUAD_MARKS, "red", "b1", 0);
    const marks = run(command, battle(), marked);
    expect(marks).toBe(marked);
    expect(command.orderFor("a2")?.focusTargetId).toBe("b1");
  });
});

describe("SquadCommand — the player's side with mark assist", () => {
  it("marks the squad's own focus while the player has no mark", () => {
    const command = new SquadCommand({
      side: "red",
      aiLeader: false,
      assistMark: true,
    });
    const marks = run(command, battle());
    expect(markedTargetOf(marks, "red", 1000)).toBe("b2");
  });

  it("keeps the player's mark (refreshed) instead of choosing its own", () => {
    const command = new SquadCommand({
      side: "red",
      aiLeader: false,
      assistMark: true,
    });
    const marked = placeMark(NO_SQUAD_MARKS, "red", "b1", 0);
    const marks = run(command, battle(), marked, 9000);
    expect(markedTargetOf(marks, "red", 9000)).toBe("b1");
    expect(command.orderFor("a2")?.focusTargetId).toBe("b1");
  });
});
