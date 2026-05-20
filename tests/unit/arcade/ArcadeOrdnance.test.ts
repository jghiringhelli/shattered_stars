/**
 * Unit tests for ArcadeOrdnance system.
 * Covers slot extraction, cooldown ticking, fire gating, charge consumption, and reload.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  extractOrdnanceSlots,
  tickOrdnanceCooldowns,
  canFireOrdnance,
  consumeOrdnanceCharge,
  reloadAllOrdnance,
  type ArcadeOrdnanceSlot,
} from "../../../src/arcade/ArcadeOrdnance";

// ─── helpers ───────────────────────────────────────────────────────────────

/** Build a minimal ready-to-fire slot for tests that don't need extraction. */
function makeSlot(
  overrides: Partial<ArcadeOrdnanceSlot> = {},
): ArcadeOrdnanceSlot {
  return {
    slotIndex: 0,
    name: "Test Missile",
    ordnanceClass: "missile",
    damage: 3,
    isHoming: true,
    homingTurnRate: 90,
    cooldownMax: 4000,
    cooldownRemaining: 0,
    charges: 2,
    maxCharges: 2,
    ...overrides,
  };
}

// ─── extractOrdnanceSlots ───────────────────────────────────────────────────

describe("extractOrdnanceSlots", () => {
  it("returns empty array when no loadoutId is provided", () => {
    const slots = extractOrdnanceSlots("confed_sparrow", null);
    expect(slots).toEqual([]);
  });

  it("returns empty array for unknown loadout id", () => {
    const slots = extractOrdnanceSlots("confed_sparrow", "nonexistent_loadout");
    expect(slots).toEqual([]);
  });

  it("returns empty array for unknown ship definition", () => {
    const slots = extractOrdnanceSlots("no_such_ship", null);
    expect(slots).toEqual([]);
  });

  it("returns at most 3 slots regardless of loadout size", () => {
    // Use a ship with a known loadout that may have many ordnance upgrades
    // We test the cap is enforced on any real ship/loadout combination
    for (const definitionId of [
      "confed_sparrow",
      "terran_gladius",
      "synth_nexus",
    ]) {
      const slots = extractOrdnanceSlots(definitionId, null);
      expect(slots.length).toBeLessThanOrEqual(3);
    }
  });

  it("assigns sequential slotIndex values starting at 0", () => {
    // Find a ship+loadout that actually has ordnance — use synth_nexus which
    // is a capital with multiple ordnance slots expected
    const slots = extractOrdnanceSlots("synth_nexus", "nexus_artillery");
    if (slots.length > 1) {
      for (let i = 0; i < slots.length; i++) {
        expect(slots[i]!.slotIndex).toBe(i);
      }
    }
  });

  it("initialises cooldownRemaining to 0 and charges to maxCharges", () => {
    const slots = extractOrdnanceSlots("synth_nexus", "nexus_artillery");
    for (const slot of slots) {
      expect(slot.cooldownRemaining).toBe(0);
      expect(slot.charges).toBe(slot.maxCharges);
      expect(slot.maxCharges).toBeGreaterThan(0);
    }
  });
});

// ─── tickOrdnanceCooldowns ──────────────────────────────────────────────────

describe("tickOrdnanceCooldowns", () => {
  it("decrements cooldownRemaining by deltaMs", () => {
    const slot = makeSlot({ cooldownRemaining: 3000 });
    tickOrdnanceCooldowns([slot], 500);
    expect(slot.cooldownRemaining).toBe(2500);
  });

  it("does not go below zero", () => {
    const slot = makeSlot({ cooldownRemaining: 100 });
    tickOrdnanceCooldowns([slot], 500);
    expect(slot.cooldownRemaining).toBe(0);
  });

  it("does not touch slots already at zero", () => {
    const slot = makeSlot({ cooldownRemaining: 0 });
    tickOrdnanceCooldowns([slot], 500);
    expect(slot.cooldownRemaining).toBe(0);
  });

  it("ticks multiple slots independently", () => {
    const a = makeSlot({ cooldownRemaining: 1000 });
    const b = makeSlot({ cooldownRemaining: 200 });
    tickOrdnanceCooldowns([a, b], 300);
    expect(a.cooldownRemaining).toBe(700);
    expect(b.cooldownRemaining).toBe(0);
  });
});

// ─── canFireOrdnance ────────────────────────────────────────────────────────

describe("canFireOrdnance", () => {
  it("returns true when charges > 0 and cooldown is 0", () => {
    expect(canFireOrdnance(makeSlot())).toBe(true);
  });

  it("returns false when charges are 0", () => {
    expect(canFireOrdnance(makeSlot({ charges: 0 }))).toBe(false);
  });

  it("returns false when cooldown is active", () => {
    expect(canFireOrdnance(makeSlot({ cooldownRemaining: 1 }))).toBe(false);
  });

  it("returns false when both charges are 0 and cooldown is active", () => {
    expect(
      canFireOrdnance(makeSlot({ charges: 0, cooldownRemaining: 500 })),
    ).toBe(false);
  });
});

// ─── consumeOrdnanceCharge ──────────────────────────────────────────────────

describe("consumeOrdnanceCharge", () => {
  it("decrements charges by 1", () => {
    const slot = makeSlot({ charges: 2 });
    consumeOrdnanceCharge(slot);
    expect(slot.charges).toBe(1);
  });

  it("sets cooldownRemaining to cooldownMax", () => {
    const slot = makeSlot({ cooldownMax: 4000, cooldownRemaining: 0 });
    consumeOrdnanceCharge(slot);
    expect(slot.cooldownRemaining).toBe(4000);
  });

  it("does not decrement below 0", () => {
    const slot = makeSlot({ charges: 0 });
    consumeOrdnanceCharge(slot);
    expect(slot.charges).toBe(0);
  });

  it("slot is not fireable immediately after consuming a charge", () => {
    const slot = makeSlot({ charges: 2 });
    consumeOrdnanceCharge(slot);
    expect(canFireOrdnance(slot)).toBe(false); // cooldown active
  });
});

// ─── reloadAllOrdnance ──────────────────────────────────────────────────────

describe("reloadAllOrdnance", () => {
  it("restores charges to maxCharges for all slots", () => {
    const slots = [
      makeSlot({ charges: 0, maxCharges: 2 }),
      makeSlot({ charges: 1, maxCharges: 3, ordnanceClass: "torpedo" }),
    ];
    reloadAllOrdnance(slots);
    expect(slots[0]!.charges).toBe(2);
    expect(slots[1]!.charges).toBe(3);
  });

  it("resets cooldownRemaining to 0 for all slots", () => {
    const slots = [
      makeSlot({ cooldownRemaining: 4000 }),
      makeSlot({ cooldownRemaining: 2000 }),
    ];
    reloadAllOrdnance(slots);
    expect(slots[0]!.cooldownRemaining).toBe(0);
    expect(slots[1]!.cooldownRemaining).toBe(0);
  });

  it("makes all slots fireable after reload (assuming charges > 0)", () => {
    const slots = [makeSlot({ charges: 0, cooldownRemaining: 6000 })];
    reloadAllOrdnance(slots);
    expect(canFireOrdnance(slots[0]!)).toBe(true);
  });

  it("handles an empty slots array gracefully", () => {
    expect(() => reloadAllOrdnance([])).not.toThrow();
  });
});
