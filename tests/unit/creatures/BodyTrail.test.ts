/**
 * Spec: a body trail places segments on the path the head flew, at fixed
 * distances behind it, and restarts when the head wraps across the map seam.
 */

import { describe, it, expect } from "vitest";
import {
  BodyTrail,
  type TrailPoint,
} from "../../../src/arcade/creatures/BodyTrail";

function trailAlongX(length: number): BodyTrail {
  const trail = new BodyTrail(64, 10, 3000);
  for (let x = 0; x <= length; x += 10) trail.record(x, 100);
  return trail;
}

describe("BodyTrail", () => {
  it("puts_a_segment_the_asked_distance_behind_the_head_on_the_path", () => {
    const point: TrailPoint = { x: 0, y: 0 };
    trailAlongX(300).pointAt(100, point);
    expect(point.x).toBeCloseTo(200, 3);
    expect(point.y).toBeCloseTo(100, 3);
  });

  it("clamps_to_the_oldest_point_when_the_path_is_shorter_than_asked", () => {
    const point: TrailPoint = { x: 0, y: 0 };
    trailAlongX(50).pointAt(500, point);
    expect(point.x).toBe(0);
  });

  it("ignores_sub_step_jitter", () => {
    const trail = new BodyTrail(8, 10, 3000);
    trail.record(0, 0);
    trail.record(3, 0);
    const point: TrailPoint = { x: 0, y: 0 };
    trail.pointAt(2, point);
    expect(point.x).toBe(0);
  });

  it("restarts_after_a_seam_wrap", () => {
    const trail = new BodyTrail(16, 10, 1000);
    trail.record(5990, 50);
    trail.record(6000, 50);
    trail.record(10, 50);
    const point: TrailPoint = { x: 0, y: 0 };
    trail.pointAt(500, point);
    expect(point.x).toBe(10);
  });
});
