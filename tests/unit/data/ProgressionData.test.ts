/**
 * Progression unlock rules — PRG-1…PRG-7 gates from docs/specs/progression.md.
 */

import { describe, it, expect } from "vitest";
import {
  STARTING_FACTIONS,
  FACTION_UNLOCK_XP,
  FACTION_ROLE_TIERS,
  XP_REWARDS,
  isFactionUnlocked,
  unlockedRolesForFaction,
  isShipUnlocked,
  nextRoleTier,
  lockReason,
  STARTER_SHIP_IDS,
  isStarterPick,
  type ProgressionState,
} from "../../../src/data/ProgressionData";
import {
  SHIP_DEFINITIONS,
  getShipsByFaction,
} from "../../../src/data/ShipDefinitions";
import { FACTION_COLORS, type FactionId } from "../../../src/config";
import type { ShipDefinition } from "../../../src/core/types";

const ALL_FACTIONS = Object.keys(FACTION_COLORS) as FactionId[];

function state(partial: Partial<ProgressionState>): ProgressionState {
  return {
    totalXp: 0,
    unlockAll: false,
    unlockedFactionIds: [],
    unlockedShipIds: [],
    ...partial,
  };
}

function shipByRole(
  faction: FactionId,
  role: string,
): ShipDefinition | undefined {
  return getShipsByFaction(faction).find((s) => s.role === role);
}

describe("PRG-1 starting factions available at 0 XP", () => {
  it("all starting factions are unlocked at 0 XP", () => {
    for (const f of STARTING_FACTIONS) {
      expect(isFactionUnlocked(f, state({ totalXp: 0 }))).toBe(true);
    }
  });
  it("there are 2-3 starting factions", () => {
    expect(STARTING_FACTIONS.length).toBeGreaterThanOrEqual(2);
    expect(STARTING_FACTIONS.length).toBeLessThanOrEqual(3);
  });
});

describe("PRG-2 non-starting factions unlock at XP threshold", () => {
  it("locked below threshold, unlocked at/after threshold", () => {
    for (const [faction, xp] of Object.entries(FACTION_UNLOCK_XP)) {
      const f = faction as FactionId;
      expect(isFactionUnlocked(f, state({ totalXp: xp - 1 }))).toBe(false);
      expect(isFactionUnlocked(f, state({ totalXp: xp }))).toBe(true);
    }
  });
  it("explicit unlockedFactionIds overrides the XP gate", () => {
    const f = Object.keys(FACTION_UNLOCK_XP)[0] as FactionId;
    expect(
      isFactionUnlocked(f, state({ totalXp: 0, unlockedFactionIds: [f] })),
    ).toBe(true);
  });
});

describe("PRG-3 role unlocks are cumulative by XP", () => {
  it("higher XP never unlocks fewer roles", () => {
    for (const f of ALL_FACTIONS) {
      const low = unlockedRolesForFaction(f, 0).size;
      const high = unlockedRolesForFaction(f, 100_000).size;
      expect(high).toBeGreaterThanOrEqual(low);
    }
  });
  it("a role is unlocked exactly when XP reaches its tier", () => {
    const f: FactionId = "terran_hegemony";
    const tier = FACTION_ROLE_TIERS[f].find((t) =>
      t.roles.includes("interceptor"),
    )!;
    expect(unlockedRolesForFaction(f, tier.minXp - 1).has("interceptor")).toBe(
      false,
    );
    expect(unlockedRolesForFaction(f, tier.minXp).has("interceptor")).toBe(
      true,
    );
  });
});

describe("PRG-4 every faction is flyable at its tier-0", () => {
  it("each faction ladder has a minXp=0 tier with at least one role", () => {
    for (const f of ALL_FACTIONS) {
      const tier0 = FACTION_ROLE_TIERS[f][0];
      expect(tier0.minXp).toBe(0);
      expect(tier0.roles.length).toBeGreaterThan(0);
    }
  });
  it("a starting faction has at least one unlocked ship at 0 XP", () => {
    const f = STARTING_FACTIONS[0];
    const unlocked = getShipsByFaction(f).filter((s) =>
      isShipUnlocked(s, state({ totalXp: 0 })),
    );
    expect(unlocked.length).toBeGreaterThan(0);
  });
});

describe("PRG-5 unlockAll unlocks everything", () => {
  it("every ship is unlocked for a dev profile", () => {
    const dev = state({ unlockAll: true });
    for (const def of Object.values(SHIP_DEFINITIONS)) {
      expect(isShipUnlocked(def, dev)).toBe(true);
    }
  });
});

describe("PRG-6 XP rewards are positive integers", () => {
  it("all reward values are > 0", () => {
    for (const v of Object.values(XP_REWARDS)) {
      expect(v).toBeGreaterThan(0);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe("PRG-7 lock reasons explain the requirement", () => {
  it("unlocked ship has empty reason; locked ship names an XP requirement", () => {
    const s = state({ totalXp: 0 });
    const capital = Object.values(SHIP_DEFINITIONS).find(
      (d) => d.role === "capital" && STARTING_FACTIONS.includes(d.faction),
    );
    if (capital) {
      expect(isShipUnlocked(capital, s)).toBe(false);
      expect(lockReason(capital, s)).toMatch(/XP/);
    }
    const starter = shipByRole(STARTING_FACTIONS[0], "heavy_fighter");
    if (starter) expect(lockReason(starter, s)).toBe("");
  });
  it("nextRoleTier returns null only when fully unlocked", () => {
    expect(nextRoleTier("terran_hegemony", 0)).not.toBeNull();
    expect(nextRoleTier("terran_hegemony", 1_000_000)).toBeNull();
  });
});

describe("Starter ship recommendations", () => {
  it("names exactly one starter ship per starting faction", () => {
    for (const faction of STARTING_FACTIONS) {
      expect(STARTER_SHIP_IDS[faction]).toBeDefined();
    }
  });

  it("every starter ship is a real, 0-XP-unlocked ship of its faction", () => {
    const zeroXp = state({ totalXp: 0 });
    for (const [faction, shipId] of Object.entries(STARTER_SHIP_IDS)) {
      const def = SHIP_DEFINITIONS[shipId!];
      expect(def, `${shipId} should exist`).toBeDefined();
      expect(def!.faction).toBe(faction);
      expect(isShipUnlocked(def!, zeroXp)).toBe(true);
    }
  });

  it("isStarterPick is true only for the designated ships", () => {
    for (const shipId of Object.values(STARTER_SHIP_IDS)) {
      expect(isStarterPick(shipId!)).toBe(true);
    }
    expect(isStarterPick("not_a_real_ship_id")).toBe(false);
  });
});
