import { describe, expect, it } from "vitest";
import { toDeployOption } from "../../../../src/arcade/reinforcements/shipOptions";
import {
  createSideLedger,
  deployShip,
  fieldPoints,
  isOnField,
  remainingPoints,
  retireShip,
  categoryCount,
} from "../../../../src/arcade/reinforcements/poolLedger";

const kestrel = toDeployOption({
  definitionId: "confed_kestrel",
  loadoutId: null,
})!;
const pelican = toDeployOption({
  definitionId: "confed_pelican",
  loadoutId: "pelican_bomber",
})!;

describe("pool ledger", () => {
  it("starts with the whole pool and an empty field", () => {
    const ledger = createSideLedger({ poolPoints: 1000, fieldCapPoints: 250 });
    expect(remainingPoints(ledger)).toBe(1000);
    expect(fieldPoints(ledger)).toBe(0);
    expect(ledger.deployedCount).toBe(0);
  });

  it("spends a ship's cost from the pool when it deploys", () => {
    const ledger = deployShip(
      createSideLedger({ poolPoints: 1000, fieldCapPoints: 250 }),
      "a",
      kestrel,
    );
    expect(remainingPoints(ledger)).toBe(1000 - kestrel.cost);
    expect(fieldPoints(ledger)).toBe(kestrel.cost);
    expect(isOnField(ledger, "a")).toBe(true);
    expect(ledger.deployedCount).toBe(1);
  });

  it("frees field points but not pool points when the ship is destroyed", () => {
    let ledger = createSideLedger({ poolPoints: 1000, fieldCapPoints: 250 });
    ledger = deployShip(ledger, "a", kestrel);
    ledger = retireShip(ledger, "a");
    expect(fieldPoints(ledger)).toBe(0);
    expect(remainingPoints(ledger)).toBe(1000 - kestrel.cost);
    expect(ledger.lostPoints).toBe(kestrel.cost);
    expect(ledger.lostCount).toBe(1);
  });

  it("ignores retiring a ship that is not on the field", () => {
    const ledger = createSideLedger({ poolPoints: 1000, fieldCapPoints: 250 });
    expect(retireShip(ledger, "ghost")).toBe(ledger);
  });

  it("never reports a negative remainder", () => {
    let ledger = createSideLedger({ poolPoints: 30, fieldCapPoints: 250 });
    ledger = deployShip(ledger, "a", kestrel);
    expect(remainingPoints(ledger)).toBe(0);
  });

  it("counts categories on the field and per match", () => {
    let ledger = createSideLedger({ poolPoints: 1000, fieldCapPoints: 250 });
    ledger = deployShip(ledger, "b1", pelican);
    ledger = deployShip(ledger, "b2", pelican);
    ledger = retireShip(ledger, "b1");
    expect(categoryCount(ledger, "bomber", "field")).toBe(1);
    expect(categoryCount(ledger, "bomber", "match")).toBe(2);
    expect(categoryCount(ledger, "ace", "field")).toBe(1);
  });

  it("throws when the same ship id deploys twice", () => {
    const ledger = deployShip(
      createSideLedger({ poolPoints: 1000, fieldCapPoints: 250 }),
      "a",
      kestrel,
    );
    expect(() => deployShip(ledger, "a", kestrel)).toThrow(/already/);
  });
});
