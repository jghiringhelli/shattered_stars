import { describe, expect, it } from "vitest";
import {
  accuracyPercent,
  resultRows,
} from "../../../../src/ui/results/resultsModel";
import { MatchStatsAccumulator } from "../../../../src/telemetry/matchStats";

function summaryOf(build: (m: MatchStatsAccumulator) => void) {
  let now = 0;
  const match = new MatchStatsAccumulator("skirmish", () => now);
  build(match);
  now = 125_000;
  return match.finish("victory");
}

describe("resultsModel", () => {
  it("reports accuracy as hits over shots, null without shots", () => {
    const none = summaryOf(() => undefined);
    expect(accuracyPercent(none)).toBeNull();
    const some = summaryOf((m) => {
      m.record({ kind: "shot", friendly: true, weapon: "primary", hit: true });
      m.record({ kind: "shot", friendly: true, weapon: "primary", hit: false });
      m.record({ kind: "shot", friendly: true, weapon: "ordnance", hit: true });
      m.record({ kind: "shot", friendly: true, weapon: "primary", hit: false });
    });
    expect(accuracyPercent(some)).toBe(50);
  });

  it("lists duration, kills/deaths, damage and specials", () => {
    const summary = summaryOf((m) => {
      m.record({ kind: "kill", victimFriendly: false });
      m.record({ kind: "kill", victimFriendly: true });
      m.record({ kind: "damage", toFriendly: false, hull: 10, shield: 5 });
      m.record({ kind: "damage", toFriendly: true, hull: 4, shield: 0 });
      m.record({ kind: "flight", events: ["boost", "barrel_roll"] });
    });
    const rows = new Map(resultRows(summary).map((r) => [r.label, r.value]));
    expect(rows.get("Duration")).toBe("2:05");
    expect(rows.get("Kills / Deaths")).toBe("1 / 1");
    expect(rows.get("Damage dealt / taken")).toBe("15 / 4");
    expect(rows.get("Specials used")).toBe("2");
  });

  it("puts mode rows first and adds points only when given", () => {
    const rows = resultRows(null, {
      leadRows: [{ label: "Score", value: "3 – 1" }],
      pointsDestroyed: 40,
      pointsLost: 12,
    });
    expect(rows.map((r) => r.label)).toEqual([
      "Score",
      "Points destroyed / lost",
    ]);
    expect(rows[1]?.value).toBe("40 / 12");
  });

  it("names the MVP ship by its dealt damage", () => {
    const summary = summaryOf((m) => {
      m.record({
        kind: "damage",
        toFriendly: false,
        hull: 8,
        shield: 0,
        byShip: { id: "a", definitionId: "nope_ship" },
      });
      m.record({
        kind: "damage",
        toFriendly: false,
        hull: 30,
        shield: 0,
        byShip: { id: "b", definitionId: "other_ship" },
      });
    });
    expect(summary.mvpShip).toBe("other_ship");
    expect(summary.mvpDamage).toBe(30);
    expect(resultRows(summary).at(-1)?.label).toBe("MVP");
  });

  it("ignores damage dealt to the player's side for the MVP", () => {
    const summary = summaryOf((m) =>
      m.record({
        kind: "damage",
        toFriendly: true,
        hull: 9,
        shield: 0,
        byShip: { id: "x", definitionId: "enemy" },
      }),
    );
    expect(summary.mvpShip).toBeNull();
  });
});
