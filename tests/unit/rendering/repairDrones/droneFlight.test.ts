import { describe, it, expect } from "vitest";
import {
  DRONE_LAUNCH_MS,
  DRONE_ORBIT_MS,
  DRONE_SORTIE_MS,
  dronePhaseAt,
  dronePosition,
} from "../../../../src/rendering/repairDrones/droneFlight";

const FROM = { x: 0, y: 0 };
const TO = { x: 300, y: 0 };
const RADIUS = 20;

/**
 * Drone position at a time.
 * @param elapsedMs - Time into the sortie.
 * @param from - Launch ship position.
 * @returns The position.
 */
function at(elapsedMs: number, from = FROM): { x: number; y: number } {
  const out = { x: 0, y: 0 };
  dronePosition(elapsedMs, from, TO, RADIUS, 0, out);
  return out;
}

describe("drone sortie phases", () => {
  it("launches, orbits, returns, then is done", () => {
    expect(dronePhaseAt(0)).toBe("launch");
    expect(dronePhaseAt(DRONE_LAUNCH_MS + 1)).toBe("orbit");
    expect(dronePhaseAt(DRONE_LAUNCH_MS + DRONE_ORBIT_MS + 1)).toBe("return");
    expect(dronePhaseAt(DRONE_SORTIE_MS)).toBe("done");
  });
});

describe("dronePosition", () => {
  it("starts at the launching ship", () => {
    expect(at(0)).toEqual({ x: 0, y: 0 });
  });

  it("orbits the repaired ship at the orbit radius", () => {
    const mid = at(DRONE_LAUNCH_MS + DRONE_ORBIT_MS / 3);
    const distance = Math.hypot(mid.x - TO.x, mid.y - TO.y);
    expect(distance).toBeCloseTo(RADIUS, 6);
  });

  it("arrives back at the launching ship", () => {
    const end = at(DRONE_SORTIE_MS);
    expect(end.x).toBeCloseTo(0, 6);
    expect(end.y).toBeCloseTo(0, 6);
  });

  it("flies toward the repaired ship during launch", () => {
    const early = at(DRONE_LAUNCH_MS / 4);
    const later = at((DRONE_LAUNCH_MS * 3) / 4);
    expect(later.x).toBeGreaterThan(early.x);
  });

  it("self-repair drones circle the ship itself", () => {
    const out = { x: 0, y: 0 };
    dronePosition(DRONE_LAUNCH_MS + 100, TO, TO, RADIUS, 1, out);
    expect(Math.hypot(out.x - TO.x, out.y - TO.y)).toBeCloseTo(RADIUS, 6);
  });
});
