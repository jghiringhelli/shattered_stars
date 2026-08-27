import { describe, it, expect } from "vitest";
import {
  createFleeState,
  updateFleeState,
  fleeSecondsRemaining,
  FLEE_IDLE_THRESHOLD_MS,
  FLEE_FORCE_END_MS,
  FLEE_DISTANCE_THRESHOLD,
} from "../../../../src/arcade/systems/FleeDetector";

const FAR = FLEE_DISTANCE_THRESHOLD + 100;
const CLOSE = FLEE_DISTANCE_THRESHOLD - 100;

describe("FleeDetector", () => {
  it("starts idle with no warning and no flee", () => {
    const s = createFleeState();
    expect(s.idleMs).toBe(0);
    expect(s.isWarning).toBe(false);
    expect(s.hasFled).toBe(false);
  });

  it("does not warn while player stays in range", () => {
    let s = createFleeState();
    for (let i = 0; i < 20; i++) {
      s = updateFleeState(s, {
        deltaMs: 1000,
        damageThisFrame: false,
        playerNearestEnemyDist: CLOSE,
      });
    }
    expect(s.isWarning).toBe(false);
    expect(s.idleMs).toBe(0);
  });

  it("enters warning state after idle threshold at long range", () => {
    let s = createFleeState();
    for (let i = 0; i < 11; i++) {
      s = updateFleeState(s, {
        deltaMs: 1000,
        damageThisFrame: false,
        playerNearestEnemyDist: FAR,
      });
    }
    expect(s.isWarning).toBe(true);
    expect(s.hasFled).toBe(false);
  });

  it("triggers hasFled after warning duration", () => {
    let s = createFleeState();
    const totalMs = FLEE_IDLE_THRESHOLD_MS + FLEE_FORCE_END_MS + 100;
    const steps = totalMs / 100;
    for (let i = 0; i < steps; i++) {
      s = updateFleeState(s, {
        deltaMs: 100,
        damageThisFrame: false,
        playerNearestEnemyDist: FAR,
      });
    }
    expect(s.hasFled).toBe(true);
  });

  it("resets state on any damage", () => {
    let s = createFleeState();
    for (let i = 0; i < 11; i++) {
      s = updateFleeState(s, {
        deltaMs: 1000,
        damageThisFrame: false,
        playerNearestEnemyDist: FAR,
      });
    }
    expect(s.isWarning).toBe(true);
    s = updateFleeState(s, {
      deltaMs: 100,
      damageThisFrame: true,
      playerNearestEnemyDist: FAR,
    });
    expect(s.idleMs).toBe(0);
    expect(s.isWarning).toBe(false);
  });

  it("resets state when player closes to combat range", () => {
    let s = createFleeState();
    for (let i = 0; i < 11; i++) {
      s = updateFleeState(s, {
        deltaMs: 1000,
        damageThisFrame: false,
        playerNearestEnemyDist: FAR,
      });
    }
    expect(s.isWarning).toBe(true);
    s = updateFleeState(s, {
      deltaMs: 100,
      damageThisFrame: false,
      playerNearestEnemyDist: CLOSE,
    });
    expect(s.isWarning).toBe(false);
    expect(s.idleMs).toBe(0);
  });

  it("fleeSecondsRemaining is zero outside warning", () => {
    const s = createFleeState();
    expect(fleeSecondsRemaining(s)).toBe(0);
  });

  it("fleeSecondsRemaining counts down during warning", () => {
    let s = createFleeState();
    for (let i = 0; i < 11; i++) {
      s = updateFleeState(s, {
        deltaMs: 1000,
        damageThisFrame: false,
        playerNearestEnemyDist: FAR,
      });
    }
    const start = fleeSecondsRemaining(s);
    expect(start).toBeGreaterThan(0);
    expect(start).toBeLessThanOrEqual(FLEE_FORCE_END_MS / 1000);

    s = updateFleeState(s, {
      deltaMs: 2000,
      damageThisFrame: false,
      playerNearestEnemyDist: FAR,
    });
    expect(fleeSecondsRemaining(s)).toBeLessThan(start);
  });
});
