import { describe, it, expect } from "vitest";
import { DURABILITY_SCALE } from "../../../../../src/config";
import {
  MAX_SHIELD_SEGMENTS,
  MAX_HULL_TICKS,
  OVERLAY_GEOMETRY,
  hullStateOf,
  hullTickCount,
  layoutOverlayRows,
  overlaySide,
  overlayVisible,
  segmentFill,
  shieldSegmentCount,
} from "../../../../../src/ui/hud/overlay/overlayLayout";

const S = DURABILITY_SCALE;

describe("shieldSegmentCount", () => {
  it("has one segment per miniature shield token", () => {
    expect(shieldSegmentCount(3 * S)).toBe(3);
  });

  it("has no segments for an unshielded ship", () => {
    expect(shieldSegmentCount(0)).toBe(0);
  });

  it("shows at least one segment for a sliver of shields", () => {
    expect(shieldSegmentCount(S / 4)).toBe(1);
  });

  it("caps big ships at a readable number of segments", () => {
    expect(shieldSegmentCount(40 * S)).toBe(MAX_SHIELD_SEGMENTS);
  });
});

describe("segmentFill", () => {
  it("lights one segment per full shield token", () => {
    expect(segmentFill(2 * S, 3 * S, 3)).toEqual({ lit: 2, partial: 0 });
  });

  it("shows a partly recharged token as a partial segment", () => {
    const fill = segmentFill(1.5 * S, 3 * S, 3);
    expect(fill.lit).toBe(1);
    expect(fill.partial).toBeCloseTo(0.5, 10);
  });

  it("lights every segment at full shields", () => {
    expect(segmentFill(3 * S, 3 * S, 3)).toEqual({ lit: 3, partial: 0 });
  });

  it("lights nothing with shields down", () => {
    expect(segmentFill(0, 3 * S, 3)).toEqual({ lit: 0, partial: 0 });
  });

  it("clamps out-of-range values", () => {
    expect(segmentFill(99 * S, 3 * S, 3).lit).toBe(3);
    expect(segmentFill(-5, 3 * S, 3).lit).toBe(0);
  });

  it("spreads capped segments evenly over a big shield pool", () => {
    const fill = segmentFill(20 * S, 40 * S, MAX_SHIELD_SEGMENTS);
    expect(fill.lit).toBe(MAX_SHIELD_SEGMENTS / 2);
  });
});

describe("hullTickCount", () => {
  it("marks every miniature hull point", () => {
    expect(hullTickCount(4 * S)).toBe(4);
  });

  it("drops ticks when there would be too many to read", () => {
    expect(hullTickCount((MAX_HULL_TICKS + 1) * S)).toBe(0);
  });

  it("drops ticks for a one-point hull", () => {
    expect(hullTickCount(S)).toBe(0);
  });
});

describe("hullStateOf", () => {
  it("reads healthy, damaged and critical bands", () => {
    expect(hullStateOf(0.9)).toBe("healthy");
    expect(hullStateOf(0.5)).toBe("damaged");
    expect(hullStateOf(0.2)).toBe("critical");
  });
});

describe("OVERLAY_GEOMETRY", () => {
  it("grows with ship size", () => {
    expect(OVERLAY_GEOMETRY.huge.width).toBeGreaterThan(
      OVERLAY_GEOMETRY.medium.width,
    );
    expect(OVERLAY_GEOMETRY.medium.width).toBeGreaterThan(
      OVERLAY_GEOMETRY.small.width,
    );
  });
});

describe("layoutOverlayRows", () => {
  it("stacks the shield row above the hull bar, centred on the origin", () => {
    const geometry = OVERLAY_GEOMETRY.medium;
    const layout = layoutOverlayRows(geometry, true);
    expect(layout.shieldRow!.y).toBeLessThan(layout.hullRow.y);
    expect(layout.top + layout.height / 2).toBeCloseTo(0, 10);
    expect(layout.left).toBe(-geometry.width / 2);
  });

  it("drops the shield row for an unshielded ship", () => {
    const layout = layoutOverlayRows(OVERLAY_GEOMETRY.small, false);
    expect(layout.shieldRow).toBeNull();
    expect(layout.height).toBe(OVERLAY_GEOMETRY.small.hullHeight);
  });
});

describe("overlaySide", () => {
  it("tells the player's ship, friendlies and hostiles apart", () => {
    expect(overlaySide(true, true)).toBe("player");
    expect(overlaySide(false, true)).toBe("ally");
    expect(overlaySide(false, false)).toBe("enemy");
  });
});

describe("overlayVisible", () => {
  const quiet = { atFull: true, targeted: false, animating: false };

  it("always shows the player's and allies' overlays", () => {
    expect(overlayVisible({ ...quiet, side: "player" })).toBe(true);
    expect(overlayVisible({ ...quiet, side: "ally" })).toBe(true);
  });

  it("hides a full-health enemy that is not targeted", () => {
    expect(overlayVisible({ ...quiet, side: "enemy" })).toBe(false);
  });

  it("shows an enemy once damaged, targeted or animating", () => {
    expect(overlayVisible({ ...quiet, side: "enemy", atFull: false })).toBe(
      true,
    );
    expect(overlayVisible({ ...quiet, side: "enemy", targeted: true })).toBe(
      true,
    );
    expect(overlayVisible({ ...quiet, side: "enemy", animating: true })).toBe(
      true,
    );
  });
});
