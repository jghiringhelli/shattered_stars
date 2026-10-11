import { describe, expect, it } from "vitest";
import { toDeployOption } from "../../../../src/arcade/reinforcements/shipOptions";
import {
  createSideLedger,
  deployShip,
  retireShip,
} from "../../../../src/arcade/reinforcements/poolLedger";
import {
  canEverDeploy,
  checkDeploy,
  isSideExhausted,
} from "../../../../src/arcade/reinforcements/quotaRules";
import type { QuotaRule } from "../../../../src/arcade/reinforcements/reinforcementTypes";

const option = (definitionId: string, loadoutId: string | null = null) =>
  toDeployOption({ definitionId, loadoutId })!;

const kestrel = option("confed_kestrel");
const pelican = option("confed_pelican");
const ace = option("terran_viper", "viper_ace");
const capital = option("terran_imperator");

const QUOTAS: readonly QuotaRule[] = [
  { category: "bomber", maxOnField: 1, maxPerMatch: Infinity },
  { category: "ace", maxOnField: 2, maxPerMatch: 2 },
  { category: "capital", maxOnField: 0, maxPerMatch: 0 },
];

const fresh = (pool = 1000, cap = 250) =>
  createSideLedger({ poolPoints: pool, fieldCapPoints: cap });

describe("deploy checks", () => {
  it("allows a ship within pool, cap and quotas", () => {
    expect(checkDeploy(fresh(), QUOTAS, kestrel)).toEqual({
      allowed: true,
      block: null,
      reason: "",
    });
  });

  it("refuses a ship the remaining pool cannot pay", () => {
    const check = checkDeploy(fresh(kestrel.cost - 1), QUOTAS, kestrel);
    expect(check.block).toBe("pool");
    expect(check.reason).toMatch(/POOL/);
  });

  it("refuses a ship that would push the field over the cap", () => {
    let ledger = fresh(1000, kestrel.cost * 2);
    ledger = deployShip(ledger, "a", kestrel);
    ledger = deployShip(ledger, "b", kestrel);
    const check = checkDeploy(ledger, QUOTAS, kestrel);
    expect(check.block).toBe("cap");
    expect(check.reason).toMatch(/CAP/);
  });

  it("refuses a category past its field quota until one is lost", () => {
    let ledger = deployShip(fresh(), "b1", pelican);
    expect(checkDeploy(ledger, QUOTAS, pelican).block).toBe("quota_field");
    expect(checkDeploy(ledger, QUOTAS, pelican).reason).toMatch(/BOMBER/);
    ledger = retireShip(ledger, "b1");
    expect(checkDeploy(ledger, QUOTAS, pelican).allowed).toBe(true);
  });

  it("refuses a category past its per-match quota for good", () => {
    const other = option("terran_raptor", "raptor_striker");
    let ledger = deployShip(fresh(2000, 1000), "a1", ace);
    ledger = retireShip(ledger, "a1");
    ledger = deployShip(ledger, "a2", other);
    ledger = retireShip(ledger, "a2");
    const check = checkDeploy(ledger, QUOTAS, ace);
    expect(check.block).toBe("quota_match");
    expect(canEverDeploy(ledger, QUOTAS, ace)).toBe(false);
  });

  it("refuses a unique pilot already flying", () => {
    const ledger = deployShip(fresh(), "a1", ace);
    expect(checkDeploy(ledger, QUOTAS, ace).block).toBe("unique");
  });

  it("refuses a forbidden category (quota 0)", () => {
    const check = checkDeploy(fresh(5000, 5000), QUOTAS, capital);
    expect(check.block).toBe("quota_match");
    expect(check.reason).toBe("CAPITALS NOT ALLOWED");
    expect(canEverDeploy(fresh(5000, 5000), QUOTAS, capital)).toBe(false);
  });

  it("a cap block is temporary; a pool block is permanent", () => {
    let ledger = fresh(1000, kestrel.cost);
    ledger = deployShip(ledger, "a", kestrel);
    expect(canEverDeploy(ledger, QUOTAS, kestrel)).toBe(true);
    expect(canEverDeploy(fresh(10), QUOTAS, kestrel)).toBe(false);
  });

  it("a ship costlier than the cap can never deploy", () => {
    expect(canEverDeploy(fresh(1000, 30), QUOTAS, kestrel)).toBe(false);
  });
});

describe("side exhaustion", () => {
  it("is exhausted with no ship alive and nothing affordable", () => {
    expect(isSideExhausted(fresh(10), QUOTAS, [kestrel])).toBe(true);
  });

  it("is not exhausted while a ship is alive", () => {
    let ledger = fresh(kestrel.cost);
    ledger = deployShip(ledger, "a", kestrel);
    expect(isSideExhausted(ledger, QUOTAS, [kestrel])).toBe(false);
  });

  it("is not exhausted while some option can still deploy", () => {
    expect(isSideExhausted(fresh(), QUOTAS, [capital, kestrel])).toBe(false);
    expect(isSideExhausted(fresh(), QUOTAS, [capital])).toBe(true);
  });
});
