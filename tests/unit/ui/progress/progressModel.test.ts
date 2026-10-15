/**
 * progressModel — the profile panel shows name, level, XP, unlocks, stats.
 */

import { describe, it, expect } from "vitest";
import { progressRows } from "../../../../src/ui/progress/progressModel";
import { createProfile } from "../../../../src/systems/PlayerProfile";
import { SHIP_DEFINITIONS } from "../../../../src/data/ShipDefinitions";

const SHIPS = Object.values(SHIP_DEFINITIONS);

function valueOf(rows: ReturnType<typeof progressRows>, label: string): string {
  return rows.find((row) => row.label === label)?.value ?? "";
}

describe("progressRows", () => {
  it("shows a fresh profile at level 1 with no battles", () => {
    const rows = progressRows(createProfile("Ada"), SHIPS);
    expect(valueOf(rows, "Pilot")).toBe("Ada");
    expect(valueOf(rows, "Level")).toBe("1");
    expect(valueOf(rows, "XP")).toBe("0 / 500 to next level (0 total)");
    expect(valueOf(rows, "Battles")).toBe("0 (0 won, 0 lost, 0 kills)");
  });

  it("shows level, XP into the level and the battle record", () => {
    const profile = createProfile("Ada", {
      totalXp: 620,
      stats: { battles: 5, kills: 12, wins: 3, losses: 2 },
    });
    const rows = progressRows(profile, SHIPS);
    expect(valueOf(rows, "Level")).toBe("2");
    expect(valueOf(rows, "XP")).toBe("120 / 500 to next level (620 total)");
    expect(valueOf(rows, "Battles")).toBe("5 (3 won, 2 lost, 12 kills)");
  });

  it("counts unlocked ships and factions out of the whole roster", () => {
    const rows = progressRows(createProfile("Ada"), SHIPS);
    expect(valueOf(rows, "Ships unlocked")).toMatch(
      new RegExp(`^\\d+ / ${SHIPS.length}$`),
    );
    expect(valueOf(rows, "Factions unlocked")).toBe("3 / 5");
  });
});
