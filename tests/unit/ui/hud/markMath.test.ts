/**
 * markMath — specification tests for the squad-mark reticle geometry: which
 * contacts are marked, the nearest torus image, reticle size vs zoom, and
 * the bracket / crosshair segments.
 */

import { describe, expect, it } from "vitest";
import { SHIP_SIZES } from "../../../../src/config";
import {
  bracketSegments,
  crosshairTicks,
  MARK_BRACKET_ARM,
  MARK_RETICLE_MIN_SCREEN_PX,
  MARK_RETICLE_SIZE_FACTOR,
  MARK_TICK_INNER,
  MARK_TICK_OUTER,
  markedContacts,
  markReticleWorldRadius,
  nearestImage,
} from "../../../../src/ui/hud/markMath";
import type { ContactHudState } from "../../../../src/ui/hud/types";

const contact = (overrides: Partial<ContactHudState>): ContactHudState => ({
  id: "c",
  pose: { x: 0, y: 0, angle: 0 },
  side: "enemy",
  sizeClass: "small",
  isTarget: false,
  alive: true,
  ...overrides,
});

describe("markedContacts", () => {
  it("keeps only live contacts flagged as marked", () => {
    const list = [
      contact({ id: "a", isMarked: true }),
      contact({ id: "b" }),
      contact({ id: "c", isMarked: true, alive: false }),
      contact({ id: "d", isMarked: false }),
    ];
    expect(markedContacts(list).map((c) => c.id)).toEqual(["a"]);
  });
});

describe("nearestImage", () => {
  it("returns the point itself when it is the nearest image", () => {
    expect(nearestImage({ x: 100, y: 100 }, { x: 150, y: 80 }, 6000)).toEqual({
      x: 150,
      y: 80,
    });
  });

  it("unwraps across the torus seam toward the anchor", () => {
    expect(
      nearestImage({ x: 5950, y: 3000 }, { x: 30, y: 3000 }, 6000),
    ).toEqual({ x: 6030, y: 3000 });
    expect(nearestImage({ x: 20, y: 10 }, { x: 5990, y: 5980 }, 6000)).toEqual({
      x: -10,
      y: -20,
    });
  });

  it("leaves an unwrapped plane alone", () => {
    expect(nearestImage({ x: 0, y: 0 }, { x: 9000, y: 0 }, 0)).toEqual({
      x: 9000,
      y: 0,
    });
  });
});

describe("markReticleWorldRadius", () => {
  it("hugs the ship at normal zoom", () => {
    expect(markReticleWorldRadius("large", 1)).toBeCloseTo(
      SHIP_SIZES.large * MARK_RETICLE_SIZE_FACTOR,
    );
  });

  it("never shrinks below the minimum on-screen size when zoomed out", () => {
    const zoom = 0.25;
    expect(markReticleWorldRadius("tiny", zoom) * zoom).toBeCloseTo(
      MARK_RETICLE_MIN_SCREEN_PX,
    );
  });

  it("grows with the ship's size class", () => {
    expect(markReticleWorldRadius("huge", 1)).toBeGreaterThan(
      markReticleWorldRadius("small", 1),
    );
  });
});

describe("bracketSegments", () => {
  const segments = bracketSegments(10, 20, 8);

  it("draws two arms at each of the four corners", () => {
    expect(segments).toHaveLength(8);
    const corners = new Set(segments.map((s) => `${s.x1},${s.y1}`));
    expect(corners).toEqual(new Set(["2,12", "2,28", "18,12", "18,28"]));
  });

  it("points every arm inward with the configured length", () => {
    for (const s of segments) {
      expect(Math.hypot(s.x2 - s.x1, s.y2 - s.y1)).toBeCloseTo(
        8 * MARK_BRACKET_ARM,
      );
      expect(Math.abs(s.x2 - 10) + Math.abs(s.y2 - 20)).toBeLessThan(
        Math.abs(s.x1 - 10) + Math.abs(s.y1 - 20),
      );
    }
  });
});

describe("crosshairTicks", () => {
  it("places four ticks on the axes between the inner and outer radius", () => {
    const ticks = crosshairTicks(0, 0, 10);
    expect(ticks).toHaveLength(4);
    for (const t of ticks) {
      expect(t.x1 === 0 || t.y1 === 0).toBe(true);
      expect(Math.hypot(t.x1, t.y1)).toBeCloseTo(10 * MARK_TICK_INNER);
      expect(Math.hypot(t.x2, t.y2)).toBeCloseTo(10 * MARK_TICK_OUTER);
    }
  });
});
