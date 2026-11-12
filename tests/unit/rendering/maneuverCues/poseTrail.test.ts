import { describe, expect, it } from "vitest";
import { PoseTrail } from "../../../../src/rendering/maneuverCues/poseTrail";

const out = { x: 0, y: 0, angle: 0 };

describe("PoseTrail", () => {
  it("has no sample before anything is pushed", () => {
    expect(new PoseTrail(8).sampleAt(100, out)).toBe(false);
  });

  it("returns the pose recorded at a time", () => {
    const trail = new PoseTrail(8);
    trail.push(0, { x: 0, y: 0, angle: 0 });
    trail.push(100, { x: 100, y: 0, angle: 90 });
    expect(trail.sampleAt(100, out)).toBe(true);
    expect(out).toEqual({ x: 100, y: 0, angle: 90 });
  });

  it("interpolates between two samples", () => {
    const trail = new PoseTrail(8);
    trail.push(0, { x: 0, y: 0, angle: 0 });
    trail.push(100, { x: 100, y: 40, angle: 0 });
    trail.sampleAt(50, out);
    expect(out.x).toBeCloseTo(50);
    expect(out.y).toBeCloseTo(20);
  });

  it("interpolates the heading the short way round", () => {
    const trail = new PoseTrail(8);
    trail.push(0, { x: 0, y: 0, angle: 350 });
    trail.push(100, { x: 0, y: 0, angle: 10 });
    trail.sampleAt(50, out);
    expect(Math.min(out.angle, 360 - out.angle)).toBeLessThan(1);
  });

  it("clamps to the oldest sample for older times", () => {
    const trail = new PoseTrail(8);
    trail.push(100, { x: 5, y: 6, angle: 7 });
    trail.push(200, { x: 50, y: 60, angle: 70 });
    trail.sampleAt(0, out);
    expect(out).toEqual({ x: 5, y: 6, angle: 7 });
  });

  it("forgets the oldest samples once full", () => {
    const trail = new PoseTrail(3);
    for (let i = 0; i < 6; i++) trail.push(i * 10, { x: i, y: 0, angle: 0 });
    trail.sampleAt(0, out);
    expect(out.x).toBe(3);
  });

  it("clears", () => {
    const trail = new PoseTrail(4);
    trail.push(0, { x: 1, y: 1, angle: 1 });
    trail.clear();
    expect(trail.sampleAt(0, out)).toBe(false);
  });
});
