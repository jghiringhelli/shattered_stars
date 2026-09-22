/**
 * Gate: positional sound math.
 *
 * Combat sounds used to play at a fixed volume with no panning, so a laser
 * fired across the map was as loud as one fired from your own cockpit. These
 * pin the rolloff and panning curves that make distance audible.
 */

import { describe, it, expect } from "vitest";
import {
  attenuationAt,
  panAt,
  MAX_PAN,
  HALF_VOLUME_DISTANCE,
} from "../../../src/audio/spatial";

describe("attenuationAt", () => {
  it("plays a sound at the listener at full volume", () => {
    expect(attenuationAt(0, 2000)).toBe(1);
  });

  it("silences a sound at or beyond the audible radius", () => {
    expect(attenuationAt(2000, 2000)).toBe(0);
    expect(attenuationAt(5000, 2000)).toBe(0);
  });

  it("never gets louder as the source moves away", () => {
    let previous = attenuationAt(0, 2000);
    for (let distance = 50; distance <= 2000; distance += 50) {
      const current = attenuationAt(distance, 2000);
      expect(current, `distance ${distance}`).toBeLessThanOrEqual(previous);
      previous = current;
    }
  });

  it("stays within the unit range across the whole radius", () => {
    for (let distance = 0; distance <= 2500; distance += 25) {
      const level = attenuationAt(distance, 2000);
      expect(level, `distance ${distance}`).toBeGreaterThanOrEqual(0);
      expect(level, `distance ${distance}`).toBeLessThanOrEqual(1);
    }
  });

  it("falls off sharply near the listener rather than linearly", () => {
    // The old code used a straight 1 - d/max line, which keeps far-away shots
    // uselessly loud. An inverse rolloff should be well under the linear value
    // once the source is past the half-volume distance.
    const radius = 2000;
    const distance = HALF_VOLUME_DISTANCE * 2;
    expect(attenuationAt(distance, radius)).toBeLessThan(1 - distance / radius);
  });

  it("treats a non-positive radius as inaudible rather than dividing by zero", () => {
    expect(attenuationAt(10, 0)).toBe(0);
    expect(attenuationAt(10, -5)).toBe(0);
  });
});

describe("panAt", () => {
  it("centres a sound directly on the listener", () => {
    expect(panAt(0, 600)).toBe(0);
  });

  it("pans right for a source to the right, left for one to the left", () => {
    expect(panAt(300, 600)).toBeGreaterThan(0);
    expect(panAt(-300, 600)).toBeLessThan(0);
  });

  it("is symmetric about the listener", () => {
    expect(panAt(250, 600)).toBeCloseTo(-panAt(-250, 600), 10);
  });

  it("never hard-pans to a single ear, which is fatiguing over a long fight", () => {
    expect(panAt(99999, 600)).toBe(MAX_PAN);
    expect(panAt(-99999, 600)).toBe(-MAX_PAN);
    expect(MAX_PAN).toBeLessThan(1);
  });

  it("centres rather than dividing by zero when the span is degenerate", () => {
    expect(panAt(100, 0)).toBe(0);
  });
});
