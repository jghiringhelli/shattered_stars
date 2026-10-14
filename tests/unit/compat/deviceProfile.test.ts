import { describe, expect, it } from "vitest";
import {
  classifyDevice,
  isPortrait,
  shouldShowDeviceNotice,
  type DeviceSignals,
} from "../../../src/compat/deviceProfile";

function signals(over: Partial<DeviceSignals> = {}): DeviceSignals {
  return {
    maxTouchPoints: 0,
    coarsePointer: false,
    anyFinePointer: true,
    canHover: true,
    viewportWidth: 1920,
    viewportHeight: 1080,
    ...over,
  };
}

describe("classifyDevice", () => {
  it("treats a mouse-and-keyboard desktop as desktop", () => {
    expect(classifyDevice(signals())).toBe("desktop");
  });

  it("treats a phone (coarse primary pointer, no hover, no fine pointer) as touch-only", () => {
    const phone = signals({
      maxTouchPoints: 5,
      coarsePointer: true,
      anyFinePointer: false,
      canHover: false,
      viewportWidth: 915,
      viewportHeight: 412,
    });
    expect(classifyDevice(phone)).toBe("touch-only");
  });

  it("treats a tablet without a mouse as touch-only", () => {
    const tablet = signals({
      maxTouchPoints: 5,
      coarsePointer: true,
      anyFinePointer: false,
      canHover: false,
      viewportWidth: 1280,
      viewportHeight: 800,
    });
    expect(classifyDevice(tablet)).toBe("touch-only");
  });

  it("keeps a touch laptop (touchscreen plus a trackpad) as desktop", () => {
    const touchLaptop = signals({ maxTouchPoints: 10, anyFinePointer: true });
    expect(classifyDevice(touchLaptop)).toBe("desktop");
  });

  it("treats a tablet with a paired mouse as desktop", () => {
    const tabletWithMouse = signals({
      maxTouchPoints: 5,
      coarsePointer: true,
      anyFinePointer: true,
      canHover: true,
    });
    expect(classifyDevice(tabletWithMouse)).toBe("desktop");
  });

  it("treats a tiny viewport without touch as small", () => {
    expect(classifyDevice(signals({ viewportWidth: 400, viewportHeight: 700 }))).toBe("small-screen");
  });

  it("keeps a short but wide desktop window as desktop", () => {
    expect(classifyDevice(signals({ viewportWidth: 800, viewportHeight: 600 }))).toBe("desktop");
  });
});

describe("isPortrait", () => {
  it("is true when the viewport is taller than wide", () => {
    expect(isPortrait(412, 915)).toBe(true);
    expect(isPortrait(915, 412)).toBe(false);
    expect(isPortrait(800, 800)).toBe(false);
  });
});

describe("shouldShowDeviceNotice", () => {
  it("never shows on desktop", () => {
    expect(shouldShowDeviceNotice("desktop", false)).toBe(false);
  });

  it("shows on touch-only and small screens until dismissed", () => {
    expect(shouldShowDeviceNotice("touch-only", false)).toBe(true);
    expect(shouldShowDeviceNotice("small-screen", false)).toBe(true);
    expect(shouldShowDeviceNotice("touch-only", true)).toBe(false);
  });
});
