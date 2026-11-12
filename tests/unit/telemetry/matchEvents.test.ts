/**
 * matchEvents — builders for the match-telemetry events battle scenes
 * record in one line (shot of a spawned projectile, the player's stress
 * frame, the player's committed cycle).
 */

import { describe, it, expect } from "vitest";
import {
  cycleEvent,
  projectileShot,
  stressEvent,
} from "../../../src/telemetry/matchEvents";
import { MatchStatsAccumulator } from "../../../src/telemetry/matchStats";
import type { ManeuverDefinition } from "../../../src/core/types";
import type { CompletedCycle } from "../../../src/arcade/systems/ShipMotion";

describe("projectileShot", () => {
  it("records a laser bolt as an unresolved primary shot of its side", () => {
    expect(
      projectileShot(
        { ownerFaction: "free_confederation", isLaser: true },
        "free_confederation",
      ),
    ).toEqual({ kind: "shot", friendly: true, weapon: "primary", hit: false });
  });

  it("records turret orbs and beams with the weapon their impacts are tallied under", () => {
    expect(
      projectileShot({ ownerFaction: "terran_hegemony" }, "free_confederation"),
    ).toEqual({
      kind: "shot",
      friendly: false,
      weapon: "ordnance",
      hit: false,
    });
  });
});

describe("stressEvent", () => {
  it("records the frame's length and whether the pilot is stressed", () => {
    expect(stressEvent({ isStressed: true }, 16)).toEqual({
      kind: "stress",
      ms: 16,
      stressed: true,
    });
  });
});

describe("cycleEvent", () => {
  it("records the committed maneuver against the ship's dial", () => {
    const dial: readonly ManeuverDefinition[] = [];
    const completed: CompletedCycle = {
      direction: "drift_left",
      speed: 2,
      fraction: 1,
      endPose: { x: 0, y: 0, angle: 0 },
    };
    expect(cycleEvent(dial, completed)).toEqual({
      kind: "cycle",
      dial,
      direction: "drift_left",
      speed: 2,
    });
  });
});

describe("stressEvent with the accumulator", () => {
  it("adds the stressed frame's length to the match's stress time", () => {
    const match = new MatchStatsAccumulator("skirmish", () => 0, {});
    match.record(stressEvent({ isStressed: true }, 250));
    match.record(stressEvent({ isStressed: false }, 100));
    expect(match.finish("victory").stressMs).toBe(250);
  });
});
