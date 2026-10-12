/**
 * TargetLock — X-Wing's lock in real time: keep the target you want within
 * range 3 for one full maneuver cycle and the lock is acquired; it holds
 * until spent by a launch, the target leaves twice that range, dies,
 * cloaks, or the pilot switches target.
 */

import { describe, it, expect } from "vitest";
import {
  LOCK_ACQUIRE_MS,
  LOCK_BREAK_RANGE_PX,
  LOCK_RANGE_PX,
  NO_LOCK,
  isLockedOn,
  lockProgress,
  spendLock,
  stepLock,
} from "../../../../src/arcade/weapons/TargetLock";

const NEAR = LOCK_RANGE_PX - 10;

function acquire(targetId = "t") {
  let lock = NO_LOCK;
  for (let t = 0; t < LOCK_ACQUIRE_MS; t += 100) {
    lock = stepLock(lock, { wantedId: targetId, rangePx: NEAR, deltaMs: 100 });
  }
  return lock;
}

describe("stepLock", () => {
  it("acquires after one cycle in range", () => {
    const half = stepLock(NO_LOCK, {
      wantedId: "t",
      rangePx: NEAR,
      deltaMs: LOCK_ACQUIRE_MS / 2,
    });
    expect(isLockedOn(half, "t")).toBe(false);
    expect(lockProgress(half)).toBeCloseTo(0.5);
    expect(isLockedOn(acquire(), "t")).toBe(true);
  });

  it("does not progress while the target is out of lock range", () => {
    const lock = stepLock(NO_LOCK, {
      wantedId: "t",
      rangePx: LOCK_RANGE_PX + 1,
      deltaMs: LOCK_ACQUIRE_MS,
    });
    expect(lockProgress(lock)).toBe(0);
  });

  it("holds an acquired lock beyond range 3, breaks it beyond break range", () => {
    const held = stepLock(acquire(), {
      wantedId: "t",
      rangePx: LOCK_BREAK_RANGE_PX - 1,
      deltaMs: 16,
    });
    expect(isLockedOn(held, "t")).toBe(true);
    const broken = stepLock(held, {
      wantedId: "t",
      rangePx: LOCK_BREAK_RANGE_PX + 1,
      deltaMs: 16,
    });
    expect(isLockedOn(broken, "t")).toBe(false);
  });

  it("starts over when the pilot switches target", () => {
    const switched = stepLock(acquire("a"), {
      wantedId: "b",
      rangePx: NEAR,
      deltaMs: 16,
    });
    expect(isLockedOn(switched, "a")).toBe(false);
    expect(switched.targetId).toBe("b");
  });

  it("drops the lock when the target is gone (null range)", () => {
    const lost = stepLock(acquire(), {
      wantedId: "t",
      rangePx: null,
      deltaMs: 16,
    });
    expect(lost).toEqual(NO_LOCK);
  });
});

describe("spendLock", () => {
  it("keeps the target but must re-acquire", () => {
    const spent = spendLock(acquire());
    expect(spent.targetId).toBe("t");
    expect(isLockedOn(spent, "t")).toBe(false);
  });
});
