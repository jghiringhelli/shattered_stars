import { describe, expect, it } from "vitest";
import {
  BattleRenderSmoothing,
  type FollowCamera,
} from "../../../../src/rendering/smoothing/BattleRenderSmoothing";
import {
  CameraFollowFilter,
  type FollowSample,
} from "../../../../src/rendering/smoothing/CameraFollowFilter";

const SIZE = 6000;

function sample(x: number, y: number, vx = 0, vy = 0): FollowSample {
  return { x, y, vx, vy };
}

describe("CameraFollowFilter", () => {
  it("jumps to the target on its first step", () => {
    const filter = new CameraFollowFilter({ worldSize: SIZE });
    filter.step(sample(1234, 4321), 16, null);
    expect([filter.x, filter.y]).toEqual([1234, 4321]);
  });

  it("keeps a target flying straight at the centre at any frame rate", () => {
    for (const frameMs of [1000 / 144, 1000 / 60, 33]) {
      const filter = new CameraFollowFilter({ worldSize: SIZE });
      const speed = 380;
      let x = 500;
      filter.step(sample(x, 800, speed), frameMs, null);
      for (let t = 0; t < 3000; t += frameMs) {
        x += (speed * frameMs) / 1000;
        filter.step(sample(x, 800, speed), frameMs, null);
      }
      expect(Math.abs(x - filter.x)).toBeLessThan(0.01);
    }
  });

  it("closes a standing gap with a frame-rate independent time constant", () => {
    const gapAfter = (frameMs: number): number => {
      const filter = new CameraFollowFilter({ worldSize: SIZE });
      filter.step(sample(1000, 1000), 16, null);
      for (let t = 0; t < 400; t += frameMs) filter.step(sample(1100, 1000), frameMs, null);
      return 1100 - filter.x;
    };
    expect(gapAfter(10)).toBeCloseTo(gapAfter(20), 3);
    expect(gapAfter(20)).toBeCloseTo(gapAfter(40), 3);
  });

  it("follows across the arena seam the short way and stays in the arena", () => {
    const filter = new CameraFollowFilter({ worldSize: SIZE });
    filter.step(sample(5990, 100), 16, null);
    filter.step(sample(30, 100), 16, null);
    expect(filter.x).toBeGreaterThanOrEqual(0);
    expect(filter.x).toBeLessThan(SIZE);
    const moved = (((filter.x - 5990) % SIZE) + SIZE) % SIZE;
    expect(moved).toBeLessThan(40);
  });

  it("snaps instead of sliding when the target jumps far (respawn)", () => {
    const filter = new CameraFollowFilter({ worldSize: SIZE });
    filter.step(sample(1000, 1000), 16, null);
    filter.step(sample(3000, 3000), 16, null);
    expect([filter.x, filter.y]).toEqual([3000, 3000]);
  });

  it("snapNext jumps even to a nearby target", () => {
    const filter = new CameraFollowFilter({ worldSize: SIZE });
    filter.step(sample(1000, 1000), 16, null);
    filter.snapNext();
    filter.step(sample(1200, 1000), 16, null);
    expect(filter.x).toBe(1200);
  });

  it("eases the zoom slowly so a one-notch speed step barely moves it", () => {
    const filter = new CameraFollowFilter({ worldSize: SIZE });
    filter.zoom = 1;
    filter.step(sample(0, 0), 16, 0.9375);
    filter.step(sample(0, 0), 16, 0.9375);
    expect(1 - filter.zoom).toBeGreaterThan(0);
    expect(1 - filter.zoom).toBeLessThan(0.0625 * 0.05);
  });

  it("leaves the zoom alone without a zoom target", () => {
    const filter = new CameraFollowFilter({ worldSize: SIZE });
    filter.zoom = 0.8;
    filter.step(sample(0, 0), 16, null);
    expect(filter.zoom).toBe(0.8);
  });

  it("bounds a long hitch to the maximum step", () => {
    const filter = new CameraFollowFilter({ worldSize: SIZE, maxStepMs: 100 });
    filter.step(sample(0, 0), 16, null);
    filter.step(sample(300, 0, 0), 5000, null);
    expect(filter.x).toBeLessThan(300);
    expect(filter.x).toBeGreaterThan(100);
  });
});

function fakeCamera(): FollowCamera & { centre: { x: number; y: number } } {
  const camera = {
    zoom: 1,
    centre: { x: 0, y: 0 },
    centerOn(x: number, y: number) {
      camera.centre = { x, y };
    },
    setZoom(zoom: number) {
      camera.zoom = zoom;
    },
  };
  return camera;
}

describe("BattleRenderSmoothing", () => {
  const TICK = 1000 / 60;

  it("centres the camera on the focus ship at once, then keeps it there", () => {
    const camera = fakeCamera();
    const smoothing = new BattleRenderSmoothing(camera, SIZE);
    let x = 1000;
    for (let i = 0; i < 120; i++) {
      x += 6;
      smoothing.capture({ id: "p", x, y: 500, angle: 0 }, TICK);
      smoothing.beginFrame(TICK, 1);
      smoothing.stepCamera(TICK, { id: "p", x, y: 500 });
    }
    expect(camera.centre.x).toBeCloseTo(x, 1);
    expect(camera.centre.y).toBeCloseTo(500, 1);
  });

  it("jumps the camera after reset", () => {
    const camera = fakeCamera();
    const smoothing = new BattleRenderSmoothing(camera, SIZE);
    smoothing.stepCamera(TICK, { x: 1000, y: 1000 });
    smoothing.reset();
    smoothing.stepCamera(TICK, { x: 1200, y: 1000 });
    expect(camera.centre.x).toBe(1200);
  });

  it("holds the camera when there is no focus", () => {
    const camera = fakeCamera();
    const smoothing = new BattleRenderSmoothing(camera, SIZE);
    smoothing.stepCamera(TICK, null);
    expect(camera.centre).toEqual({ x: 0, y: 0 });
  });

  it("only writes the zoom when a zoom target is given", () => {
    const camera = fakeCamera();
    camera.setZoom(1.1);
    const smoothing = new BattleRenderSmoothing(camera, SIZE);
    smoothing.stepCamera(TICK, { x: 10, y: 10 });
    expect(camera.zoom).toBe(1.1);
    smoothing.stepCamera(TICK, { x: 10, y: 10 }, { zoomTarget: 0.75 });
    expect(camera.zoom).toBeLessThan(1.1);
    expect(camera.zoom).toBeGreaterThan(0.75);
  });

  it("places sprite and overlay at the interpolated pose", () => {
    const smoothing = new BattleRenderSmoothing(fakeCamera(), SIZE);
    smoothing.capture({ id: "p", x: 100, y: 100, angle: 0 }, TICK);
    smoothing.capture({ id: "p", x: 110, y: 100, angle: 10 }, TICK);
    smoothing.beginFrame(0, 0.5);
    const calls: string[] = [];
    const sprite = {
      setPosition: (x: number, y: number) => calls.push(`sprite ${x} ${y}`),
      setAngle: (a: number) => calls.push(`angle ${a}`),
    };
    const bar = { setPosition: (x: number, y: number) => calls.push(`bar ${x} ${y}`) };
    smoothing.place({ id: "p", x: 110, y: 100, angle: 10 }, sprite, bar, -40);
    expect(calls).toEqual(["sprite 105 100", "angle 5", "bar 105 60"]);
  });
});
