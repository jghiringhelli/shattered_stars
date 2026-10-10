/**
 * Projectile System Tests
 */

import { describe, it, expect } from "vitest";
import {
  createProjectile,
  updateProjectile,
  isProjectileAlive,
  checkProjectileHit,
  withOnHit,
  projectileRawDamage,
  type Projectile,
} from "../../../src/core/Projectile";

describe("Projectile", () => {
  describe("createProjectile", () => {
    it("should create projectile with given position and angle", () => {
      const proj = createProjectile(100, 200, 45, "ship-1", "terran_hegemony");

      expect(proj.x).toBe(100);
      expect(proj.y).toBe(200);
      expect(proj.angle).toBe(45);
      expect(proj.ownerId).toBe("ship-1");
      expect(proj.ownerFaction).toBe("terran_hegemony");
    });

    it("should set default damage and lifetime", () => {
      const proj = createProjectile(0, 0, 0, "ship-1", "terran_hegemony");

      expect(proj.damage).toBe(1);
      expect(proj.lifetime).toBe(2000); // Starts at max (remaining time)
      expect(proj.maxLifetime).toBe(2000);
    });

    it("should allow custom damage", () => {
      const proj = createProjectile(0, 0, 0, "ship-1", "terran_hegemony", 3);

      expect(proj.damage).toBe(3);
    });

    it("should generate unique IDs", () => {
      const proj1 = createProjectile(0, 0, 0, "ship-1", "terran_hegemony");
      const proj2 = createProjectile(0, 0, 0, "ship-1", "terran_hegemony");

      expect(proj1.id).not.toBe(proj2.id);
    });
  });

  describe("updateProjectile", () => {
    it("should move projectile forward based on angle", () => {
      const proj = createProjectile(100, 100, 0, "ship-1", "terran_hegemony");

      const updated = updateProjectile(proj, 100);

      expect(updated.y).toBeLessThan(100); // Moving up (negative y)
      expect(Math.abs(updated.x - 100)).toBeLessThan(1); // Almost no x change
    });

    it("should move right when angle is 90", () => {
      const proj = createProjectile(100, 100, 90, "ship-1", "terran_hegemony");

      const updated = updateProjectile(proj, 100);

      expect(updated.x).toBeGreaterThan(100); // Moving right
    });

    it("should decrease lifetime (remaining time)", () => {
      const proj = createProjectile(0, 0, 0, "ship-1", "terran_hegemony");

      const updated = updateProjectile(proj, 100);

      expect(updated.lifetime).toBe(1900); // 2000 - 100
    });

    it("should decrease lifetime over multiple updates", () => {
      let proj = createProjectile(0, 0, 0, "ship-1", "terran_hegemony");

      proj = updateProjectile(proj, 100);
      proj = updateProjectile(proj, 100);
      proj = updateProjectile(proj, 100);

      expect(proj.lifetime).toBe(1700); // 2000 - 300
    });

    it("should move faster projectiles further", () => {
      const slowProj: Projectile = {
        ...createProjectile(0, 0, 0, "ship-1", "terran_hegemony"),
        speed: 100,
      };
      const fastProj: Projectile = {
        ...createProjectile(0, 0, 0, "ship-1", "terran_hegemony"),
        speed: 500,
      };

      const slowUpdated = updateProjectile(slowProj, 100);
      const fastUpdated = updateProjectile(fastProj, 100);

      expect(Math.abs(fastUpdated.y)).toBeGreaterThan(Math.abs(slowUpdated.y));
    });

    it("steers homing projectile toward target when budget remains", () => {
      // Projectile flying up (angle 0), target is to the right
      const proj = createProjectile(
        0,
        0,
        0,
        "ship-1",
        "faction-a",
        1,
        true,
        "target-1",
        90,
        360,
      );
      const updated = updateProjectile(proj, 100, 200, 0); // target directly right
      expect(updated.angle).toBeGreaterThan(0); // turned right toward target
    });

    it("flies straight when homing budget is exhausted", () => {
      const proj = createProjectile(
        0,
        0,
        0,
        "ship-1",
        "faction-a",
        1,
        true,
        "target-1",
        90,
        0, // budget = 0
      );
      const updated = updateProjectile(proj, 100, 200, 0);
      expect(updated.angle).toBe(0); // no turn — budget gone
    });

    it("decrements homingTurnBudget by actual degrees turned", () => {
      // Homing at 90°/s, 100ms frame → max turn 9°. Target is 5° off → turns 5°.
      const proj: Projectile = {
        ...createProjectile(
          0,
          0,
          0,
          "ship-1",
          "faction-a",
          1,
          true,
          "t",
          90,
          360,
        ),
        angle: 0,
      };
      // Place target so it's about 5° clockwise from current heading (angle ~5)
      const targetX = Math.sin((5 * Math.PI) / 180) * 500;
      const targetY = -Math.cos((5 * Math.PI) / 180) * 500;
      const updated = updateProjectile(proj, 100, targetX, targetY);
      expect(updated.homingTurnBudget).toBeLessThan(360);
      expect(updated.homingTurnBudget).toBeGreaterThan(350); // ~5° used
    });

    it("stops homing and flies straight once budget reaches 0", () => {
      // Budget just enough for one turn step then gone
      const proj: Projectile = {
        ...createProjectile(
          0,
          0,
          90,
          "ship-1",
          "faction-a",
          1,
          true,
          "t",
          90,
          5,
        ),
      };
      // Target is far to the left — requires big turn
      const step1 = updateProjectile(proj, 1000, -1000, 0); // burns budget
      expect(step1.homingTurnBudget).toBe(0);
      // Subsequent update without target should fly straight (budget gone)
      const angle1 = step1.angle;
      const step2 = updateProjectile(step1, 100, -1000, 0);
      expect(step2.angle).toBe(angle1); // no further steering
    });
  });

  describe("isProjectileAlive", () => {
    it("should return true when lifetime remaining is positive", () => {
      const proj: Projectile = {
        ...createProjectile(0, 0, 0, "ship-1", "terran_hegemony"),
        lifetime: 100, // 100ms remaining
      };

      expect(isProjectileAlive(proj)).toBe(true);
    });

    it("should return false when lifetime is exhausted", () => {
      const proj: Projectile = {
        ...createProjectile(0, 0, 0, "ship-1", "terran_hegemony"),
        lifetime: -100, // Expired
      };

      expect(isProjectileAlive(proj)).toBe(false);
    });

    it("should return false when lifetime is exactly 0", () => {
      const proj: Projectile = {
        ...createProjectile(0, 0, 0, "ship-1", "terran_hegemony"),
        lifetime: 0,
      };

      expect(isProjectileAlive(proj)).toBe(false);
    });
  });

  describe("checkProjectileHit", () => {
    it("should return true when projectile overlaps target", () => {
      const proj = createProjectile(100, 100, 0, "ship-1", "terran_hegemony");

      const hit = checkProjectileHit(proj, 105, 105, 20, "free_confederation");

      expect(hit).toBe(true);
    });

    it("should return false when projectile is far from target", () => {
      const proj = createProjectile(100, 100, 0, "ship-1", "terran_hegemony");

      const hit = checkProjectileHit(proj, 500, 500, 20, "free_confederation");

      expect(hit).toBe(false);
    });

    it("should return false when target is same faction", () => {
      const proj = createProjectile(100, 100, 0, "ship-1", "terran_hegemony");

      const hit = checkProjectileHit(proj, 105, 105, 20, "terran_hegemony");

      expect(hit).toBe(false);
    });

    it("should detect edge hits based on radius", () => {
      const proj = createProjectile(100, 100, 0, "ship-1", "terran_hegemony");

      // Just within range (distance ~14, radius 20)
      const nearHit = checkProjectileHit(
        proj,
        110,
        110,
        20,
        "free_confederation",
      );
      expect(nearHit).toBe(true);

      // Just outside range (distance ~28, radius 20)
      const nearMiss = checkProjectileHit(
        proj,
        120,
        120,
        20,
        "free_confederation",
      );
      expect(nearMiss).toBe(false);
    });

    it("should respect different radius sizes", () => {
      const proj = createProjectile(100, 100, 0, "ship-1", "terran_hegemony");

      // Small radius - miss
      const smallHit = checkProjectileHit(
        proj,
        115,
        100,
        10,
        "free_confederation",
      );
      expect(smallHit).toBe(false);

      // Large radius - hit
      const largeHit = checkProjectileHit(
        proj,
        115,
        100,
        30,
        "free_confederation",
      );
      expect(largeHit).toBe(true);
    });
  });
});

describe("projectile on-hit riders", () => {
  it("attaches stress and exposed-target bonus without mutating the original", () => {
    const proj = createProjectile(0, 0, 0, "ship-1", "terran_hegemony", 2);
    const armed = withOnHit(proj, {
      stressOnHit: 0.1,
      bonusDamageVsUnshielded: 1,
    });
    expect(armed.stressOnHit).toBe(0.1);
    expect(armed.bonusDamageVsUnshielded).toBe(1);
    expect(proj.stressOnHit).toBeUndefined();
  });

  it("adds the exposed-target bonus only when shields are down", () => {
    const armed = withOnHit(
      createProjectile(0, 0, 0, "ship-1", "terran_hegemony", 2),
      { stressOnHit: 0, bonusDamageVsUnshielded: 1 },
    );
    expect(projectileRawDamage(armed, 2)).toBe(2);
    expect(projectileRawDamage(armed, 0)).toBe(3);
  });

  it("deals base damage for a projectile without riders", () => {
    const proj = createProjectile(0, 0, 0, "ship-1", "terran_hegemony", 2);
    expect(projectileRawDamage(proj, 0)).toBe(2);
  });
});
