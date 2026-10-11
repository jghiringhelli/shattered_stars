import { describe, it, expect } from "vitest";
import {
  applyThrottle,
  IDLE_THROTTLE,
} from "../../../../src/arcade/systems/PilotThrottle";
import { createControlState } from "../../../../src/core/ArcadeControls";
import {
  updateGestures,
  INITIAL_GESTURE_STATE,
} from "../../../../src/arcade/ArcadeInputGestures";

const control = {
  ...createControlState({ x: 0, y: 0, angle: 0 }, 18, "fighter", {
    min: 1,
    max: 5,
  }),
  speed: 3,
};
const none = {
  upPressed: false,
  downPressed: false,
  upGesture: false,
  downGesture: false,
};

describe("applyThrottle", () => {
  it("a single ↑ press steps one notch and remembers the speed before it", () => {
    const r = applyThrottle(control, IDLE_THROTTLE, {
      ...none,
      upPressed: true,
    });
    expect(r.control.speed).toBe(4);
    expect(r.memory.up).toBe(3);
  });

  it("the second tap of a ↑↑ gesture puts the speed back to before the first tap", () => {
    const first = applyThrottle(control, IDLE_THROTTLE, {
      ...none,
      upPressed: true,
    });
    const second = applyThrottle(first.control, first.memory, {
      ...none,
      upPressed: true,
      upGesture: true,
    });
    expect(second.control.speed).toBe(3);
    expect(second.memory.up).toBeNull();
  });

  it("the second tap of a ↓↓ gesture puts the speed back too", () => {
    const first = applyThrottle(control, IDLE_THROTTLE, {
      ...none,
      downPressed: true,
    });
    const second = applyThrottle(first.control, first.memory, {
      ...none,
      downPressed: true,
      downGesture: true,
    });
    expect(second.control.speed).toBe(3);
  });

  it("never steps past the speed bounds", () => {
    const top = applyThrottle({ ...control, speed: 5 }, IDLE_THROTTLE, {
      ...none,
      upPressed: true,
    });
    expect(top.control.speed).toBe(5);
  });

  it("no press changes nothing", () => {
    expect(applyThrottle(control, IDLE_THROTTLE, none).control.speed).toBe(3);
  });
});

describe("gestures — the first tap of a battle is never a double tap", () => {
  it("↑ pressed 100 ms after the scene starts does not boost", () => {
    const result = updateGestures({
      state: INITIAL_GESTURE_STATE,
      leftDown: false,
      rightDown: false,
      upDown: true,
      downDown: false,
      nowMs: 100,
      deltaMs: 16,
      allowChordBarrelRoll: true,
    });
    expect(result.actions).toEqual([]);
  });
});
