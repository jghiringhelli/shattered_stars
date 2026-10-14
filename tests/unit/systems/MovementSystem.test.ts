/**
 * Tests for MovementSystem
 */

import { describe, it, expect } from "vitest";
import {
  resolveManeuver,
  normalizeAngle,
  rotatePoint,
  degToRad,
  radToDeg,
  distance,
  calculateRangeBand,
  isInArc,
  angleToTarget,
  isManeuverValid,
  getValidManeuvers,
  generateManeuverPath,
  MANEUVER_TEMPLATES,
} from "../../../src/systems/MovementSystem";
import type { ManeuverDefinition } from "../../../src/core/types";
import { SPEED_SCALE_FACTOR } from "../../../src/config";

describe("MovementSystem", () => {
  describe("normalizeAngle", () => {
    it("should keep angles in 0-360 range unchanged", () => {
      expect(normalizeAngle(0)).toBe(0);
      expect(normalizeAngle(90)).toBe(90);
      expect(normalizeAngle(180)).toBe(180);
      expect(normalizeAngle(270)).toBe(270);
      expect(normalizeAngle(359)).toBe(359);
    });

    it("should wrap negative angles", () => {
      expect(normalizeAngle(-90)).toBe(270);
      expect(normalizeAngle(-180)).toBe(180);
      expect(normalizeAngle(-270)).toBe(90);
      expect(normalizeAngle(-360)).toBe(0);
    });

    it("should wrap angles > 360", () => {
      expect(normalizeAngle(360)).toBe(0);
      expect(normalizeAngle(450)).toBe(90);
      expect(normalizeAngle(720)).toBe(0);
    });
  });

  describe("degToRad / radToDeg", () => {
    it("should convert degrees to radians correctly", () => {
      expect(degToRad(0)).toBeCloseTo(0);
      expect(degToRad(90)).toBeCloseTo(Math.PI / 2);
      expect(degToRad(180)).toBeCloseTo(Math.PI);
      expect(degToRad(360)).toBeCloseTo(Math.PI * 2);
    });

    it("should convert radians to degrees correctly", () => {
      expect(radToDeg(0)).toBeCloseTo(0);
      expect(radToDeg(Math.PI / 2)).toBeCloseTo(90);
      expect(radToDeg(Math.PI)).toBeCloseTo(180);
      expect(radToDeg(Math.PI * 2)).toBeCloseTo(360);
    });

    it("should be inverse operations", () => {
      for (const angle of [0, 45, 90, 135, 180, 225, 270, 315, 360]) {
        expect(radToDeg(degToRad(angle))).toBeCloseTo(angle);
      }
    });
  });

  describe("rotatePoint", () => {
    it("should not change point when rotating by 0 degrees", () => {
      const result = rotatePoint(10, 0, 0);
      expect(result.x).toBeCloseTo(10);
      expect(result.y).toBeCloseTo(0);
    });

    it("should rotate point 90 degrees clockwise", () => {
      // (10, 0) rotated 90° clockwise should be (0, 10)
      const result = rotatePoint(10, 0, 90);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(10);
    });

    it("should rotate point 180 degrees", () => {
      const result = rotatePoint(10, 0, 180);
      expect(result.x).toBeCloseTo(-10);
      expect(result.y).toBeCloseTo(0);
    });

    it("should rotate point 90 degrees counter-clockwise", () => {
      // (10, 0) rotated -90° should be (0, -10)
      const result = rotatePoint(10, 0, -90);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(-10);
    });
  });

  describe("resolveManeuver", () => {
    describe("straight maneuvers", () => {
      it("should move straight forward when facing up (0°)", () => {
        const maneuver: ManeuverDefinition = {
          direction: "straight",
          speed: 1,
          difficulty: "white",
        };

        const result = resolveManeuver(100, 100, 0, maneuver);

        expect(result.targetX).toBeCloseTo(100);
        expect(result.targetY).toBeCloseTo(100 - SPEED_SCALE_FACTOR);
        expect(result.targetAngle).toBe(0);
      });

      it("should move straight forward when facing right (90°)", () => {
        const maneuver: ManeuverDefinition = {
          direction: "straight",
          speed: 1,
          difficulty: "white",
        };

        const result = resolveManeuver(100, 100, 90, maneuver);

        expect(result.targetX).toBeCloseTo(100 + SPEED_SCALE_FACTOR);
        expect(result.targetY).toBeCloseTo(100);
        expect(result.targetAngle).toBe(90);
      });

      it("should scale distance by speed", () => {
        const speed1: ManeuverDefinition = {
          direction: "straight",
          speed: 1,
          difficulty: "white",
        };
        const speed3: ManeuverDefinition = {
          direction: "straight",
          speed: 3,
          difficulty: "white",
        };

        const result1 = resolveManeuver(0, 0, 0, speed1);
        const result3 = resolveManeuver(0, 0, 0, speed3);

        // Speed 3 should move 3x as far as speed 1
        expect(Math.abs(result3.targetY)).toBeCloseTo(
          Math.abs(result1.targetY) * 3,
        );
      });
    });

    describe("bank maneuvers", () => {
      it("should bank left with -45° turn", () => {
        const maneuver: ManeuverDefinition = {
          direction: "bank_left",
          speed: 1,
          difficulty: "white",
        };

        const result = resolveManeuver(100, 100, 0, maneuver);

        // Should move forward and left
        expect(result.targetX).toBeLessThan(100);
        expect(result.targetY).toBeLessThan(100);
        expect(result.targetAngle).toBe(315); // -45 normalized
      });

      it("should bank right with +45° turn", () => {
        const maneuver: ManeuverDefinition = {
          direction: "bank_right",
          speed: 1,
          difficulty: "white",
        };

        const result = resolveManeuver(100, 100, 0, maneuver);

        // Should move forward and right
        expect(result.targetX).toBeGreaterThan(100);
        expect(result.targetY).toBeLessThan(100);
        expect(result.targetAngle).toBe(45);
      });
    });

    describe("turn maneuvers", () => {
      it("should turn left with -90° turn", () => {
        const maneuver: ManeuverDefinition = {
          direction: "turn_left",
          speed: 1,
          difficulty: "white",
        };

        const result = resolveManeuver(100, 100, 0, maneuver);

        expect(result.targetAngle).toBe(270); // -90 normalized
      });

      it("should turn right with +90° turn", () => {
        const maneuver: ManeuverDefinition = {
          direction: "turn_right",
          speed: 1,
          difficulty: "white",
        };

        const result = resolveManeuver(100, 100, 0, maneuver);

        expect(result.targetAngle).toBe(90);
      });
    });

    describe("snap turn maneuvers", () => {
      it("should flip 180 degrees", () => {
        const maneuver: ManeuverDefinition = {
          direction: "kturn",
          speed: 2,
          difficulty: "red",
        };

        const result = resolveManeuver(100, 100, 0, maneuver);

        expect(result.targetAngle).toBe(180);
        // Should move forward before flipping
        expect(result.targetY).toBeLessThan(100);
      });

      it("should work from any starting angle", () => {
        const maneuver: ManeuverDefinition = {
          direction: "kturn",
          speed: 2,
          difficulty: "red",
        };

        const result = resolveManeuver(100, 100, 90, maneuver);
        expect(result.targetAngle).toBe(270); // 90 + 180
      });
    });
  });

  describe("generateManeuverPath", () => {
    it("should return correct number of points", () => {
      const maneuver: ManeuverDefinition = {
        direction: "straight",
        speed: 2,
        difficulty: "white",
      };

      const path = generateManeuverPath(0, 0, 0, maneuver, 10);

      expect(path.length).toBe(11); // 0 to 10 inclusive
    });

    it("should start at the initial position", () => {
      const maneuver: ManeuverDefinition = {
        direction: "straight",
        speed: 2,
        difficulty: "white",
      };

      const path = generateManeuverPath(100, 200, 45, maneuver);

      expect(path[0]?.x).toBeCloseTo(100);
      expect(path[0]?.y).toBeCloseTo(200);
    });

    it("should end at the resolved position for straight moves", () => {
      const maneuver: ManeuverDefinition = {
        direction: "straight",
        speed: 2,
        difficulty: "white",
      };

      const path = generateManeuverPath(100, 200, 0, maneuver);
      const result = resolveManeuver(100, 200, 0, maneuver);
      const lastPoint = path[path.length - 1];

      expect(lastPoint?.x).toBeCloseTo(result.targetX);
      expect(lastPoint?.y).toBeCloseTo(result.targetY);
    });

    it("should keep translating while a snap turn rotates, never freezing in place", () => {
      const maneuver: ManeuverDefinition = {
        direction: "kturn",
        speed: 2,
        difficulty: "red",
      };

      const path = generateManeuverPath(0, 0, 0, maneuver, 20, 0, "fighter");

      // Every segment of the path must carry some translation alongside
      // rotation — a ship that spins in place with zero positional delta
      // reads as a teleport-and-spin glitch, not a flight maneuver.
      for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1]!;
        const curr = path[i]!;
        const moved =
          Math.abs(curr.x - prev.x) > 1e-6 || Math.abs(curr.y - prev.y) > 1e-6;
        const rotated = Math.abs(curr.angle - prev.angle) > 1e-6;

        if (rotated) {
          expect(moved).toBe(true);
        }
      }
    });
  });

  describe("distance", () => {
    it("should return 0 for same point", () => {
      expect(distance(10, 10, 10, 10)).toBe(0);
    });

    it("should calculate horizontal distance", () => {
      expect(distance(0, 0, 10, 0)).toBe(10);
    });

    it("should calculate vertical distance", () => {
      expect(distance(0, 0, 0, 10)).toBe(10);
    });

    it("should calculate diagonal distance", () => {
      // 3-4-5 triangle
      expect(distance(0, 0, 3, 4)).toBe(5);
    });
  });

  describe("calculateRangeBand", () => {
    it("should return range 1 for close ships", () => {
      expect(calculateRangeBand(0, 0, 50, 0)).toBe(1);
      expect(calculateRangeBand(0, 0, 100, 0)).toBe(1);
    });

    it("should return range 2 for medium distance", () => {
      expect(calculateRangeBand(0, 0, 150, 0)).toBe(2);
      expect(calculateRangeBand(0, 0, 200, 0)).toBe(2);
    });

    it("should return range 3 for far ships", () => {
      expect(calculateRangeBand(0, 0, 250, 0)).toBe(3);
      expect(calculateRangeBand(0, 0, 300, 0)).toBe(3);
    });

    it("should return null for out of range", () => {
      expect(calculateRangeBand(0, 0, 350, 0)).toBeNull();
    });
  });

  describe("isInArc", () => {
    it("should return true for target directly ahead in front arc", () => {
      // Ship facing 0° (up), target at 0° - directly ahead
      expect(isInArc(0, 0, 90)).toBe(true);
    });

    it("should return true for target within front arc bounds", () => {
      // Ship facing 0°, target at 44° - within 90° arc
      expect(isInArc(0, 44, 90)).toBe(true);
      expect(isInArc(0, -44, 90)).toBe(true);
    });

    it("should return false for target outside front arc", () => {
      // Ship facing 0°, target at 90° - outside 90° arc
      expect(isInArc(0, 90, 90)).toBe(false);
      expect(isInArc(0, -90, 90)).toBe(false);
    });

    it("should handle turret arc (360°)", () => {
      expect(isInArc(0, 0, 360)).toBe(true);
      expect(isInArc(0, 90, 360)).toBe(true);
      expect(isInArc(0, 180, 360)).toBe(true);
      expect(isInArc(0, 270, 360)).toBe(true);
    });

    it("should handle ship facing different directions", () => {
      // Ship facing 90° (right), target at 90° - directly ahead
      expect(isInArc(90, 90, 90)).toBe(true);
      // Ship facing 90°, target at 0° - 90° to the left, outside front arc
      expect(isInArc(90, 0, 90)).toBe(false);
    });
  });

  describe("angleToTarget", () => {
    it("should return 0 for target directly above", () => {
      // Target is above (lower Y)
      expect(angleToTarget(100, 100, 100, 50)).toBeCloseTo(0);
    });

    it("should return 90 for target directly to the right", () => {
      expect(angleToTarget(100, 100, 150, 100)).toBeCloseTo(90);
    });

    it("should return 180 for target directly below", () => {
      expect(angleToTarget(100, 100, 100, 150)).toBeCloseTo(180);
    });

    it("should return 270 for target directly to the left", () => {
      expect(angleToTarget(100, 100, 50, 100)).toBeCloseTo(270);
    });
  });

  describe("isManeuverValid", () => {
    const sampleDial: ManeuverDefinition[] = [
      { direction: "straight", speed: 1, difficulty: "green" },
      { direction: "straight", speed: 2, difficulty: "white" },
      { direction: "straight", speed: 3, difficulty: "white" },
      { direction: "bank_left", speed: 2, difficulty: "white" },
      { direction: "bank_right", speed: 2, difficulty: "white" },
      { direction: "turn_left", speed: 2, difficulty: "white" },
      { direction: "turn_right", speed: 2, difficulty: "white" },
      { direction: "kturn", speed: 3, difficulty: "red" },
    ];

    it("should return true for valid maneuvers", () => {
      const maneuver: ManeuverDefinition = {
        direction: "straight",
        speed: 2,
        difficulty: "white",
      };
      expect(isManeuverValid(maneuver, false, sampleDial)).toBe(true);
    });

    it("should return false for maneuvers not in dial", () => {
      const maneuver: ManeuverDefinition = {
        direction: "straight",
        speed: 5,
        difficulty: "white",
      };
      expect(isManeuverValid(maneuver, false, sampleDial)).toBe(false);
    });

    it("should return false for red maneuvers when stressed", () => {
      const maneuver: ManeuverDefinition = {
        direction: "kturn",
        speed: 3,
        difficulty: "red",
      };
      expect(isManeuverValid(maneuver, true, sampleDial)).toBe(false);
    });

    it("should return true for red maneuvers when not stressed", () => {
      const maneuver: ManeuverDefinition = {
        direction: "kturn",
        speed: 3,
        difficulty: "red",
      };
      expect(isManeuverValid(maneuver, false, sampleDial)).toBe(true);
    });
  });

  describe("getValidManeuvers", () => {
    const sampleDial: ManeuverDefinition[] = [
      { direction: "straight", speed: 1, difficulty: "green" },
      { direction: "straight", speed: 2, difficulty: "white" },
      { direction: "kturn", speed: 3, difficulty: "red" },
    ];

    it("should return all maneuvers when not stressed", () => {
      const valid = getValidManeuvers(sampleDial, false);
      expect(valid.length).toBe(3);
    });

    it("should exclude red maneuvers when stressed", () => {
      const valid = getValidManeuvers(sampleDial, true);
      expect(valid.length).toBe(2);
      expect(valid.find((m) => m.difficulty === "red")).toBeUndefined();
    });
  });

  describe("MANEUVER_TEMPLATES", () => {
    it("should have all 10 maneuver directions", () => {
      const directions: Array<keyof typeof MANEUVER_TEMPLATES> = [
        "straight",
        "bank_left",
        "bank_right",
        "turn_left",
        "turn_right",
        "kturn",
        "segnor_left",
        "segnor_right",
        "tallon_left",
        "tallon_right",
      ];

      for (const dir of directions) {
        expect(MANEUVER_TEMPLATES[dir]).toBeDefined();
      }
    });

    it("should have symmetric left/right banks", () => {
      const left = MANEUVER_TEMPLATES.bank_left;
      const right = MANEUVER_TEMPLATES.bank_right;

      expect(left.deltaX).toBe(-right.deltaX);
      expect(left.deltaY).toBe(right.deltaY);
      expect(left.deltaAngle).toBe(-right.deltaAngle);
    });

    it("should have symmetric left/right turns", () => {
      const left = MANEUVER_TEMPLATES.turn_left;
      const right = MANEUVER_TEMPLATES.turn_right;

      expect(left.deltaX).toBeCloseTo(-right.deltaX);
      expect(left.deltaY).toBeCloseTo(right.deltaY);
      expect(left.deltaAngle).toBe(-right.deltaAngle);
    });
  });

  describe("resolveManeuver with baseSize (X-Wing TMG template geometry)", () => {
    it("straight: templateLength = speed * SPEED_SCALE_FACTOR + baseSize", () => {
      const maneuver: ManeuverDefinition = {
        direction: "straight",
        speed: 3,
        difficulty: "white",
      };
      const baseSize = 32; // small ship

      const result = resolveManeuver(0, 0, 0, maneuver, baseSize);

      const expectedLength = 3 * SPEED_SCALE_FACTOR + baseSize; // 152px
      expect(result.targetY).toBeCloseTo(-expectedLength);
      expect(result.targetX).toBeCloseTo(0);
    });

    it("larger base ships travel further per cycle at the same speed", () => {
      const maneuver: ManeuverDefinition = {
        direction: "straight",
        speed: 2,
        difficulty: "white",
      };

      const smallResult = resolveManeuver(0, 0, 0, maneuver, 32);
      const largeResult = resolveManeuver(0, 0, 0, maneuver, 64);

      expect(Math.abs(largeResult.targetY)).toBeGreaterThan(
        Math.abs(smallResult.targetY),
      );
      // Difference equals difference in baseSize
      expect(
        Math.abs(largeResult.targetY) - Math.abs(smallResult.targetY),
      ).toBeCloseTo(64 - 32);
    });

    it("baseSize = 0 matches legacy behavior (no change to angle or direction)", () => {
      const maneuver: ManeuverDefinition = {
        direction: "bank_left",
        speed: 2,
        difficulty: "white",
      };

      const withZero = resolveManeuver(0, 0, 0, maneuver, 0);
      const withDefault = resolveManeuver(0, 0, 0, maneuver);

      expect(withZero.targetX).toBeCloseTo(withDefault.targetX);
      expect(withZero.targetY).toBeCloseTo(withDefault.targetY);
      expect(withZero.targetAngle).toBe(withDefault.targetAngle);
    });

    it("baseSize shifts position but never changes target angle", () => {
      const maneuver: ManeuverDefinition = {
        direction: "turn_left",
        speed: 2,
        difficulty: "white",
      };

      const withBase = resolveManeuver(0, 0, 0, maneuver, 48);
      const withoutBase = resolveManeuver(0, 0, 0, maneuver, 0);

      expect(withBase.targetAngle).toBe(withoutBase.targetAngle);
    });

    it("generateManeuverPath end-point matches resolveManeuver with baseSize", () => {
      const maneuver: ManeuverDefinition = {
        direction: "straight",
        speed: 3,
        difficulty: "white",
      };
      const baseSize = 48; // medium ship

      const path = generateManeuverPath(100, 200, 0, maneuver, 10, baseSize);
      const result = resolveManeuver(100, 200, 0, maneuver, baseSize);
      const last = path[path.length - 1];

      expect(last?.x).toBeCloseTo(result.targetX);
      expect(last?.y).toBeCloseTo(result.targetY);
    });
  });
});
