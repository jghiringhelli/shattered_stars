/**
 * Spec: the Skirmish budget preview follows the WINGMEN choice, using the
 * same fill the launch uses.
 */

import { describe, expect, it } from "vitest";
import { planWingmen, type WingmenRequest } from "../../../../src/systems/setup/wingmen";
import { previewWingmenSquad } from "../../../../src/ui/squad/simpleBudget";

function request(type: WingmenRequest["type"], extra: Partial<WingmenRequest> = {}): WingmenRequest {
  return {
    faction: "terran_hegemony",
    shipId: "terran_gladius",
    loadoutId: null,
    type,
    gameMode: "arcade",
    pointLimit: 200,
    seed: 5,
    ...extra,
  };
}

describe("previewWingmenSquad", () => {
  it("prices the squad the wingmen plan would fly", () => {
    const plan = planWingmen(request("fighters"));
    const preview = previewWingmenSquad(request("fighters"));
    expect(preview.squadTotal).toBe(plan.pointsUsed);
    expect(preview.wingmen).toBe(plan.ships.length > 1);
    expect(preview.squadTotal).toBeLessThanOrEqual(200);
    expect(preview.limit).toBe(200);
  });

  it("prices the flagship alone as its own cost", () => {
    const preview = previewWingmenSquad(request("auto"));
    expect(preview.ownCost).toBeGreaterThan(0);
    expect(preview.squadTotal).toBeGreaterThanOrEqual(preview.ownCost);
  });

  it("shows only the flagship for CUSTOM without picked wingmen", () => {
    const preview = previewWingmenSquad(request("custom"));
    expect(preview.wingmen).toBe(false);
    expect(preview.squadTotal).toBe(preview.ownCost);
  });
});
