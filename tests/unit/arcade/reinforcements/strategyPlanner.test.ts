import { describe, expect, it } from "vitest";
import { toDeployOption } from "../../../../src/arcade/reinforcements/shipOptions";
import {
  createSideLedger,
  deployShip,
} from "../../../../src/arcade/reinforcements/poolLedger";
import {
  createPlannerState,
  planNextDeployment,
  type PlanInput,
} from "../../../../src/arcade/reinforcements/strategyPlanner";
import type {
  DeployOption,
  QuotaRule,
} from "../../../../src/arcade/reinforcements/reinforcementTypes";

const opt = (definitionId: string, loadoutId: string | null = null) =>
  toDeployOption({ definitionId, loadoutId })!;

const wasp = opt("confed_wasp"); // light fighter, 25
const kestrel = opt("confed_kestrel"); // interceptor, 42
const pelican = opt("confed_pelican"); // bomber, 55
const thunderbird = opt("confed_thunderbird"); // gunship, 75

const QUOTAS: readonly QuotaRule[] = [
  { category: "bomber", maxOnField: 1, maxPerMatch: Infinity },
];

function input(
  rotation: readonly DeployOption[],
  overrides: Partial<PlanInput> = {},
): PlanInput {
  return {
    strategy: "balanced",
    state: createPlannerState(rotation),
    ledger: createSideLedger({ poolPoints: 1000, fieldCapPoints: 250 }),
    quotas: QUOTAS,
    battle: { opposingRoles: [] },
    ...overrides,
  };
}

describe("AI deployment planner", () => {
  it("deploys the head of its rotation and moves on", () => {
    const step = planNextDeployment(input([wasp, kestrel]));
    expect(step.option).toBe(wasp);
    expect(step.state.cursor).toBe(1);
  });

  it("wraps around the rotation", () => {
    const start = input([wasp, kestrel]);
    const step = planNextDeployment({
      ...start,
      state: { ...start.state, cursor: 1 },
    });
    expect(step.option).toBe(kestrel);
    expect(step.state.cursor).toBe(0);
  });

  it("skips a ship the pool can no longer pay, for good", () => {
    const step = planNextDeployment(
      input([thunderbird, wasp], {
        ledger: createSideLedger({ poolPoints: 30, fieldCapPoints: 250 }),
      }),
    );
    expect(step.option).toBe(wasp);
    expect(step.state.cursor).toBe(0);
  });

  it("a patient strategy waits for room for its planned ship", () => {
    const ledger = deployShip(
      createSideLedger({ poolPoints: 1000, fieldCapPoints: 100 }),
      "x",
      pelican,
    );
    const step = planNextDeployment(
      input([thunderbird, wasp], { strategy: "heavy", ledger }),
    );
    expect(step.option).toBeNull();
    expect(step.state.cursor).toBe(0);
  });

  it("an eager strategy fills the room with a later ship that fits", () => {
    const ledger = deployShip(
      createSideLedger({ poolPoints: 1000, fieldCapPoints: 100 }),
      "x",
      pelican,
    );
    const step = planNextDeployment(
      input([thunderbird, wasp], { strategy: "swarm", ledger }),
    );
    expect(step.option).toBe(wasp);
    expect(step.state.cursor).toBe(0);
  });

  it("an eager strategy steps past a quota-blocked ship", () => {
    const ledger = deployShip(
      createSideLedger({ poolPoints: 1000, fieldCapPoints: 250 }),
      "b",
      pelican,
    );
    const step = planNextDeployment(input([pelican, kestrel], { ledger }));
    expect(step.option).toBe(kestrel);
  });

  it("Balanced counters heavy threats with an interceptor from its next ships", () => {
    const step = planNextDeployment(
      input([thunderbird, wasp, kestrel], {
        battle: { opposingRoles: ["bomber", "gunship", "light_fighter"] },
      }),
    );
    expect(step.option).toBe(kestrel);
    expect(step.state.cursor).toBe(0);
  });

  it("does not counter-pick without a heavy threat", () => {
    const step = planNextDeployment(
      input([thunderbird, wasp, kestrel], {
        battle: { opposingRoles: ["bomber", "light_fighter"] },
      }),
    );
    expect(step.option).toBe(thunderbird);
  });

  it("deploys nothing when nothing fits", () => {
    const step = planNextDeployment(
      input([thunderbird], {
        ledger: createSideLedger({ poolPoints: 10, fieldCapPoints: 250 }),
      }),
    );
    expect(step.option).toBeNull();
  });

  it("an empty rotation plans nothing", () => {
    expect(planNextDeployment(input([])).option).toBeNull();
  });
});
