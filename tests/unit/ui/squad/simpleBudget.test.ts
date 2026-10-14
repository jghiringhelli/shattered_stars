/**
 * Spec: the simple Skirmish flow previews where the budget goes — the
 * player's ship (as flown, with the chosen build) plus the AI wingmen that
 * fill the rest — and never goes over the point limit.
 */

import { describe, it, expect } from "vitest";
import { previewSimpleSquad } from "../../../../src/ui/squad/simpleBudget";
import { getEquippableLoadouts } from "../../../../src/data/ShipLoadouts";

describe("previewSimpleSquad", () => {
  const ship = "terran_gladius";
  const build = getEquippableLoadouts(ship)[0]!;

  it("prices the player's ship with the chosen build", () => {
    const preview = previewSimpleSquad("terran_hegemony", ship, build.id, "arcade", 200);
    expect(preview.ownCost).toBe(build.pointCost);
  });

  it("prices a bare hull when no build is chosen", () => {
    const preview = previewSimpleSquad("terran_hegemony", ship, null, "arcade", 200);
    expect(preview.ownCost).toBeGreaterThan(0);
  });

  it("fills wingmen without exceeding the limit", () => {
    const preview = previewSimpleSquad("terran_hegemony", ship, build.id, "arcade", 200);
    expect(preview.squadTotal).toBeLessThanOrEqual(200);
    expect(preview.squadTotal).toBeGreaterThanOrEqual(preview.ownCost);
    expect(preview.wingmen).toBe(preview.squadTotal > preview.ownCost);
  });

  it("has no wingmen when the limit equals the ship's cost", () => {
    const preview = previewSimpleSquad("terran_hegemony", ship, build.id, "arcade", build.pointCost);
    expect(preview.squadTotal).toBe(build.pointCost);
    expect(preview.wingmen).toBe(false);
  });

  it("reports a ship that alone exceeds the limit as over budget", () => {
    const preview = previewSimpleSquad("terran_hegemony", ship, build.id, "arcade", 10);
    expect(preview.squadTotal).toBe(build.pointCost);
    expect(preview.limit).toBe(10);
  });
});
