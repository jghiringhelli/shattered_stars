/**
 * Unit tests for ArcadeStress pure functions.
 * Focused on findBestTurnSpeed — the discrete turn speed-selection logic.
 */

import { describe, it, expect } from "vitest";
import {
  findBestTurnSpeed,
  updateStress,
  applyKturnStress,
  applyInstantStress,
  scaleStressGain,
  classifyManeuver,
  lookupDialDifficulty,
  INITIAL_STRESS,
  STRESS_HIGH,
  STRESS_LOW,
} from "../../../src/arcade/ArcadeStress";
import type { ManeuverDefinition } from "../../../src/core/types";

// ─── Test fixtures ──────────────────────────────────────────────────────────

/** Fighter dial: turns at speeds 1–3 (1=green, 2=white, 3=red); banks at 1–4. */
const FIGHTER_DIAL: readonly ManeuverDefinition[] = [
  { direction: "straight", speed: 1, difficulty: "green" },
  { direction: "straight", speed: 2, difficulty: "green" },
  { direction: "straight", speed: 3, difficulty: "white" },
  { direction: "bank_left", speed: 1, difficulty: "green" },
  { direction: "bank_left", speed: 2, difficulty: "white" },
  { direction: "bank_left", speed: 3, difficulty: "white" },
  { direction: "bank_left", speed: 4, difficulty: "red" },
  { direction: "turn_left", speed: 1, difficulty: "green" },
  { direction: "turn_left", speed: 2, difficulty: "white" },
  { direction: "turn_left", speed: 3, difficulty: "red" },
];

/** Bomber dial: only turns at speed 1 (white). No turn_right entries (dial uses turn_left). */
const BOMBER_DIAL: readonly ManeuverDefinition[] = [
  { direction: "straight", speed: 1, difficulty: "green" },
  { direction: "straight", speed: 2, difficulty: "white" },
  { direction: "bank_left", speed: 1, difficulty: "white" },
  { direction: "turn_left", speed: 1, difficulty: "white" },
];

/** Capital ship: no turn entries at all. */
const CAPITAL_DIAL: readonly ManeuverDefinition[] = [
  { direction: "straight", speed: 1, difficulty: "green" },
  { direction: "bank_left", speed: 1, difficulty: "red" },
];

// ─── findBestTurnSpeed ───────────────────────────────────────────────────────

describe("findBestTurnSpeed", () => {
  describe("non-stressed pilot", () => {
    it("returns current speed when turn is available there", () => {
      expect(findBestTurnSpeed(FIGHTER_DIAL, 2, 1, 5, false)).toBe(2);
    });

    it("returns current speed even if the maneuver is red (not stressed)", () => {
      expect(findBestTurnSpeed(FIGHTER_DIAL, 3, 1, 5, false)).toBe(3);
    });

    it("finds nearest lower speed when current is out of range", () => {
      // Speed 4 has no turn_left — nearest is 3
      expect(findBestTurnSpeed(FIGHTER_DIAL, 4, 1, 5, false)).toBe(3);
    });

    it("finds nearest speed for a bomber stuck at speed 2", () => {
      // Bomber only has turn at speed 1; current=2, nearest is 1
      expect(findBestTurnSpeed(BOMBER_DIAL, 2, 1, 4, false)).toBe(1);
    });

    it("returns null when no turn entry exists at any speed", () => {
      expect(findBestTurnSpeed(CAPITAL_DIAL, 1, 1, 3, false)).toBeNull();
    });
  });

  describe("stressed pilot", () => {
    it("stays at current speed when turn is non-red", () => {
      // speed=2 → white → allowed when stressed
      expect(findBestTurnSpeed(FIGHTER_DIAL, 2, 1, 5, true)).toBe(2);
    });

    it("falls back to nearest non-red speed when current is red", () => {
      // speed=3 → red → fall back to speed 2 (white, closer than 1)
      expect(findBestTurnSpeed(FIGHTER_DIAL, 3, 1, 5, true)).toBe(2);
    });

    it("accepts red as last resort if all turns are red", () => {
      const allRedDial: readonly ManeuverDefinition[] = [
        { direction: "straight", speed: 1, difficulty: "green" },
        { direction: "turn_left", speed: 1, difficulty: "red" },
        { direction: "turn_left", speed: 2, difficulty: "red" },
      ];
      // No non-red turns; should still return nearest (1 is closer to 1 than 2)
      expect(findBestTurnSpeed(allRedDial, 1, 1, 3, true)).toBe(1);
    });

    it("respects minSpeed boundary", () => {
      // Even if speed 1 is the best, minSpeed=2 excludes it
      expect(findBestTurnSpeed(FIGHTER_DIAL, 3, 2, 5, true)).toBe(2);
    });

    it("respects maxSpeed boundary", () => {
      // Turn at speed 3 is red; maxSpeed=2 limits search to 1–2
      expect(findBestTurnSpeed(FIGHTER_DIAL, 3, 1, 2, true)).toBe(2);
    });
  });

  describe("tie-breaking", () => {
    it("prefers current speed over equidistant alternatives", () => {
      const dial: readonly ManeuverDefinition[] = [
        { direction: "turn_left", speed: 1, difficulty: "white" },
        { direction: "turn_left", speed: 2, difficulty: "red" },
        { direction: "turn_left", speed: 3, difficulty: "white" },
      ];
      // Speed 2 is red + stressed; speeds 1 and 3 are equidistant.
      // reduce() picks whichever comes first that has equal distance → speed 1.
      const result = findBestTurnSpeed(dial, 2, 1, 4, true);
      expect(result).toBe(1);
    });
  });
});

// ─── classifyManeuver ────────────────────────────────────────────────────────

describe("classifyManeuver", () => {
  it("classifies near-zero deflection as straight", () => {
    expect(classifyManeuver(0.1, 3).direction).toBe("straight");
  });

  it("classifies mid deflection as bank_left", () => {
    expect(classifyManeuver(0.4, 3).direction).toBe("bank_left");
  });

  it("classifies high deflection as turn_left", () => {
    expect(classifyManeuver(0.8, 3).direction).toBe("turn_left");
  });

  it("passes speed through unchanged", () => {
    expect(classifyManeuver(0.5, 4).speed).toBe(4);
  });
});

// ─── lookupDialDifficulty ────────────────────────────────────────────────────

describe("lookupDialDifficulty", () => {
  it("returns difficulty from matching dial entry", () => {
    expect(lookupDialDifficulty("turn_left", 2, FIGHTER_DIAL)).toBe("white");
  });

  it("returns red for missing entry (over-range maneuver)", () => {
    expect(lookupDialDifficulty("turn_left", 5, FIGHTER_DIAL)).toBe("red");
  });
});

// ─── updateStress ────────────────────────────────────────────────────────────

describe("updateStress", () => {
  it("accumulates stress when flying red maneuvers", () => {
    const s = updateStress(INITIAL_STRESS, "red", 1000);
    expect(s.level).toBeGreaterThan(0);
  });

  it("drains stress when flying green maneuvers", () => {
    const stressed = { level: 0.8, isStressed: true };
    const drained = updateStress(stressed, "green", 1000);
    expect(drained.level).toBeLessThan(0.8);
  });

  it("latches isStressed when level reaches STRESS_HIGH", () => {
    const nearHigh = { level: STRESS_HIGH - 0.01, isStressed: false };
    const over = updateStress(nearHigh, "red", 200);
    expect(over.isStressed).toBe(true);
  });

  it("releases isStressed when level drops to STRESS_LOW", () => {
    const nearLow = { level: STRESS_LOW + 0.01, isStressed: true };
    const released = updateStress(nearLow, "green", 500);
    expect(released.isStressed).toBe(false);
  });

  it("clamps level to 0", () => {
    const s = updateStress(INITIAL_STRESS, "green", 5000);
    expect(s.level).toBe(0);
  });

  it("clamps level to 1", () => {
    const maxStress = { level: 0.99, isStressed: true };
    const s = updateStress(maxStress, "red", 5000);
    expect(s.level).toBe(1);
  });
});

// ─── applyKturnStress ────────────────────────────────────────────────────────

describe("applyKturnStress", () => {
  it("adds instant stress when executing a Snap turn", () => {
    const s = applyKturnStress(INITIAL_STRESS);
    expect(s.level).toBeGreaterThan(0);
  });

  it("latches isStressed when the spike pushes level past threshold", () => {
    const almostHigh = { level: STRESS_HIGH - 0.05, isStressed: false };
    const after = applyKturnStress(almostHigh);
    expect(after.isStressed).toBe(true);
  });

  it("clamps level to 1", () => {
    const full = { level: 0.99, isStressed: true };
    const s = applyKturnStress(full);
    expect(s.level).toBe(1);
  });
});

// ─── upgrade-driven stress helpers ──────────────────────────────────────────

describe("applyInstantStress", () => {
  it("adds the given amount of stress", () => {
    expect(applyInstantStress(INITIAL_STRESS, 0.2).level).toBeCloseTo(0.2);
  });

  it("latches the stressed flag once the high threshold is crossed", () => {
    expect(applyInstantStress(INITIAL_STRESS, STRESS_HIGH).isStressed).toBe(
      true,
    );
  });

  it("caps stress at 1", () => {
    expect(
      applyInstantStress({ level: 0.9, isStressed: true }, 0.5).level,
    ).toBe(1);
  });

  it("ignores zero and negative amounts", () => {
    const state = { level: 0.4, isStressed: false };
    expect(applyInstantStress(state, 0)).toBe(state);
  });
});

describe("scaleStressGain", () => {
  it("halves a maneuver's stress gain with a 0.5 multiplier", () => {
    const before = { level: 0.2, isStressed: false };
    const after = { level: 0.4, isStressed: false };
    expect(scaleStressGain(before, after, 0.5).level).toBeCloseTo(0.3);
  });

  it("amplifies the gain with a drawback multiplier", () => {
    const before = { level: 0.2, isStressed: false };
    const after = { level: 0.4, isStressed: false };
    expect(scaleStressGain(before, after, 1.5).level).toBeCloseTo(0.5);
  });

  it("never scales stress recovery", () => {
    const before = { level: 0.5, isStressed: false };
    const after = { level: 0.3, isStressed: false };
    expect(scaleStressGain(before, after, 0.5)).toBe(after);
  });

  it("re-evaluates the stressed threshold after scaling", () => {
    const before = { level: 0.6, isStressed: false };
    const after = { level: 0.8, isStressed: true };
    expect(scaleStressGain(before, after, 0.25).isStressed).toBe(false);
  });
});
