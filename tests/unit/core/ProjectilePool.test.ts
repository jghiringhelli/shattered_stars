import { describe, it, expect } from "vitest";
import { createProjectilePool } from "../../../src/core/ProjectilePool";

describe("ProjectilePool", () => {
  it("acquires a projectile with correct fields", () => {
    const pool = createProjectilePool(8);
    const p = pool.acquire(
      100,
      200,
      90,
      "ship1",
      "terran_hegemony",
      2,
      false,
      null,
      0,
      0,
    );

    expect(p).not.toBeNull();
    expect(p!.x).toBe(100);
    expect(p!.y).toBe(200);
    expect(p!.angle).toBe(90);
    expect(p!.damage).toBe(2);
    expect(p!.ownerId).toBe("ship1");
    expect(p!.isHoming).toBe(false);
    expect(pool.activeCount).toBe(1);
  });

  it("returns null when at capacity", () => {
    const pool = createProjectilePool(2);
    pool.acquire(0, 0, 0, "a", "f", 1, false, null, 0, 0);
    pool.acquire(0, 0, 0, "b", "f", 1, false, null, 0, 0);

    const result = pool.acquire(0, 0, 0, "c", "f", 1, false, null, 0, 0);
    expect(result).toBeNull();
    expect(pool.activeCount).toBe(2);
  });

  it("release frees a slot for reuse", () => {
    const pool = createProjectilePool(2);
    const p1 = pool.acquire(0, 0, 0, "a", "f", 1, false, null, 0, 0)!;
    pool.acquire(0, 0, 0, "b", "f", 1, false, null, 0, 0);

    pool.release(p1);
    expect(pool.activeCount).toBe(1);

    const p3 = pool.acquire(0, 0, 0, "c", "f", 1, false, null, 0, 0);
    expect(p3).not.toBeNull();
    expect(pool.activeCount).toBe(2);
  });

  it("forEach iterates all live projectiles", () => {
    const pool = createProjectilePool(8);
    pool.acquire(1, 0, 0, "a", "f", 1, false, null, 0, 0);
    pool.acquire(2, 0, 0, "b", "f", 1, false, null, 0, 0);
    pool.acquire(3, 0, 0, "c", "f", 1, false, null, 0, 0);

    const xs: number[] = [];
    pool.forEach((p) => xs.push(p.x));

    expect(xs.sort()).toEqual([1, 2, 3]);
  });

  it("removeWhere removes matching projectiles", () => {
    const pool = createProjectilePool(8);
    pool.acquire(0, 0, 0, "a", "f", 1, false, null, 0, 0);
    pool.acquire(0, 0, 0, "b", "f", 2, false, null, 0, 0);
    pool.acquire(0, 0, 0, "c", "f", 1, false, null, 0, 0);

    pool.removeWhere((p) => p.damage === 1);

    expect(pool.activeCount).toBe(1);
    const remaining: string[] = [];
    pool.forEach((p) => remaining.push(p.ownerId));
    expect(remaining).toEqual(["b"]);
  });

  it("clear removes all projectiles", () => {
    const pool = createProjectilePool(8);
    pool.acquire(0, 0, 0, "a", "f", 1, false, null, 0, 0);
    pool.acquire(0, 0, 0, "b", "f", 1, false, null, 0, 0);

    pool.clear();
    expect(pool.activeCount).toBe(0);
  });

  it("homing projectile gets correct speed and lifetime", () => {
    const pool = createProjectilePool(8);
    const p = pool.acquire(0, 0, 0, "a", "f", 3, true, "target1", 90, 360)!;

    expect(p.speed).toBe(700);
    expect(p.lifetime).toBe(4000);
    expect(p.isHoming).toBe(true);
    expect(p.homingTargetId).toBe("target1");
    expect(p.homingTurnRate).toBe(90);
    expect(p.homingTurnBudget).toBe(360);
  });
});
