import { describe, it, expect } from "vitest";
import {
  DoubleTapTracker,
  MinHoldLatch,
  TOUCH_MIN_HOLD_MS,
} from "../../../../src/ui/input/touchLatch";

describe("MinHoldLatch", () => {
  it("reads the value while the finger is down", () => {
    const latch = new MinHoldLatch();
    latch.press(0.8, 0);
    expect(latch.read(500)).toBe(0.8);
  });

  it("keeps a quick tap visible for the minimum hold, then lets go", () => {
    const latch = new MinHoldLatch();
    latch.press(-0.6, 100);
    latch.release();
    expect(latch.read(110)).toBe(-0.6);
    expect(latch.read(100 + TOUCH_MIN_HOLD_MS)).toBe(0);
  });

  it("releases a long hold at once", () => {
    const latch = new MinHoldLatch();
    latch.press(1, 0);
    latch.release();
    expect(latch.read(1000)).toBe(0);
  });

  it("reads zero when never pressed or pressed with zero", () => {
    const latch = new MinHoldLatch();
    expect(latch.read(0)).toBe(0);
    latch.press(0, 0);
    expect(latch.read(10)).toBe(0);
  });
});

describe("DoubleTapTracker", () => {
  it("completes on the second tap inside the window and resets", () => {
    const taps = new DoubleTapTracker();
    expect(taps.tap(1000, 350)).toBe(false);
    expect(taps.tap(1200, 350)).toBe(true);
    expect(taps.tap(1300, 350)).toBe(false);
  });

  it("a slow second tap is a fresh first tap", () => {
    const taps = new DoubleTapTracker();
    taps.tap(0, 350);
    expect(taps.tap(600, 350)).toBe(false);
  });
});