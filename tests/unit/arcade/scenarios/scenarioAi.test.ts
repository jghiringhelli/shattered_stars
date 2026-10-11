import { describe, expect, it } from "vitest";
import {
  CONTROL_RANGE_PX,
  HOLD_LEASH_FRACTION,
  SCENARIO_DEFINITIONS,
  createScenarioState,
  homePoint,
  objectiveRunnerCount,
  planScenarioSide,
  steeringGoal,
  type PlannerShip,
  type ScenarioDirective,
  type ScenarioState,
} from "../../../../src/arcade/scenarios";

const WORLD = 6000;
const C = WORLD / 2;

function ship(
  id: string,
  side: "player" | "enemy",
  x: number,
  y: number,
  isHuman = false,
): PlannerShip {
  return { id, side, x, y, isHuman };
}

function plan(
  state: ScenarioState,
  ships: readonly PlannerShip[],
  side: "player" | "enemy" = "enemy",
  extra: {
    previous?: ReadonlyMap<string, ScenarioDirective>;
    markActive?: boolean;
  } = {},
): Map<string, ScenarioDirective> {
  return planScenarioSide({
    state,
    side,
    ships,
    worldSize: WORLD,
    previous: extra.previous ?? new Map(),
    markActive: extra.markActive ?? false,
  });
}

const satellites = (): ScenarioState =>
  createScenarioState(SCENARIO_DEFINITIONS.satellite_array, WORLD);

describe("objectiveRunnerCount", () => {
  it("sends one ship of a small side and two of a bigger one to the objectives", () => {
    expect(objectiveRunnerCount(0)).toBe(0);
    expect(objectiveRunnerCount(1)).toBe(1);
    expect(objectiveRunnerCount(2)).toBe(1);
    expect(objectiveRunnerCount(3)).toBe(2);
    expect(objectiveRunnerCount(5)).toBe(2);
  });
});

describe("planScenarioSide — control objectives", () => {
  const enemies = [
    ship("e0", "enemy", C - 1200, C - 1400),
    ship("e1", "enemy", C, C - 1400),
    ship("e2", "enemy", C + 1200, C - 1400),
  ];

  it("sends two of three ships to hold two different satellites; the third screens", () => {
    const orders = plan(satellites(), enemies);
    const holders = [...orders.values()].filter((o) => o.role === "hold");
    expect(holders).toHaveLength(2);
    expect(new Set(holders.map((o) => o.objectiveId)).size).toBe(2);
    expect(
      [...orders.values()].filter((o) => o.role === "screen"),
    ).toHaveLength(1);
  });

  it("a holder's goal is its satellite, leashed inside the control range", () => {
    const orders = plan(satellites(), enemies);
    const holder = [...orders.values()].find((o) => o.role === "hold")!;
    expect(holder.leashPx).toBe(CONTROL_RANGE_PX * HOLD_LEASH_FRACTION);
    const zone = satellites().zones.find((z) => z.id === holder.objectiveId)!;
    expect(holder.goal).toEqual({ x: zone.x, y: zone.y });
  });

  it("never gives the human player an order", () => {
    const ships = [
      ship("player_0", "player", C, C + 1400, true),
      ship("ally_0", "player", C, C + 1400),
    ];
    const orders = plan(satellites(), ships, "player");
    expect(orders.has("player_0")).toBe(false);
    expect(orders.get("ally_0")!.role).toBe("hold");
  });

  it("keeps a holder on its satellite rather than swapping to a slightly nearer one", () => {
    const first = plan(satellites(), [ship("e0", "enemy", C - 650, C)]);
    expect(first.get("e0")!.objectiveId).toBe("zone_A");
    const drifted = [ship("e0", "enemy", C - 550, C)];
    expect(plan(satellites(), drifted).get("e0")!.objectiveId).toBe("zone_B");
    expect(
      plan(satellites(), drifted, "enemy", { previous: first }).get("e0")!
        .objectiveId,
    ).toBe("zone_A");
  });

  it("the player's mark takes priority: wingmen leave the objectives to follow it", () => {
    const ships = [
      ship("ally_0", "player", C, C),
      ship("ally_1", "player", C, C),
    ];
    const orders = plan(satellites(), ships, "player", { markActive: true });
    expect(
      [...orders.values()].every((o) => o.role === "screen" && o.goal === null),
    ).toBe(true);
  });
});

describe("planScenarioSide — salvage", () => {
  const salvage = (): ScenarioState =>
    createScenarioState(SCENARIO_DEFINITIONS.salvage_mission, WORLD);

  it("a carrier runs home and is never released to evade", () => {
    const base = salvage();
    const state = {
      ...base,
      crates: base.crates.map((c, i) =>
        i === 0 ? { ...c, carrierId: "e0", carrierSide: "enemy" as const } : c,
      ),
    };
    const orders = plan(state, [
      ship("e0", "enemy", C, C),
      ship("e1", "enemy", C, C - 1400),
    ]);
    expect(orders.get("e0")).toMatchObject({
      role: "carry",
      goal: homePoint("enemy", WORLD),
      leashPx: 0,
    });
    expect(orders.get("e1")!.role).toBe("collect");
  });

  it("a carrier keeps carrying even when the player marks a target", () => {
    const base = salvage();
    const state = {
      ...base,
      crates: base.crates.map((c, i) =>
        i === 0
          ? { ...c, carrierId: "ally_0", carrierSide: "player" as const }
          : c,
      ),
    };
    const orders = plan(state, [ship("ally_0", "player", C, C)], "player", {
      markActive: true,
    });
    expect(orders.get("ally_0")!.role).toBe("carry");
  });

  it("hunts an enemy carrier when no crate is loose", () => {
    const base = salvage();
    const state = {
      ...base,
      crates: base.crates.map((c) => ({
        ...c,
        carrierId: "p0",
        carrierSide: "player" as const,
        x: 100,
        y: 200,
      })),
    };
    const orders = plan(state, [ship("e0", "enemy", C, C - 1400)]);
    expect(orders.get("e0")).toMatchObject({
      role: "hunt",
      goal: { x: 100, y: 200 },
    });
  });
});

describe("planScenarioSide — scramble", () => {
  it("goes for a node it has not scrambled before one it already owns", () => {
    const base = createScenarioState(
      SCENARIO_DEFINITIONS.scramble_transmissions,
      WORLD,
    );
    const state = {
      ...base,
      nodes: base.nodes.map((n, i) =>
        i === 1 ? { ...n, owner: "enemy" as const } : n,
      ),
    };
    const node = state.nodes[1]!;
    const orders = plan(state, [ship("e0", "enemy", node.x, node.y - 300)]);
    expect(orders.get("e0")!.objectiveId).not.toBe(node.id);
  });
});

describe("steeringGoal", () => {
  const hold: ScenarioDirective = {
    role: "hold",
    objectiveId: "zone_B",
    goal: { x: 0, y: 0 },
    leashPx: 200,
  };

  it("lets the pilot fight freely inside the leash", () => {
    expect(steeringGoal(hold, { x: 150, y: 0 }, 0)).toBeNull();
  });

  it("steers back to the objective outside the leash", () => {
    expect(steeringGoal(hold, { x: 250, y: 0 }, 0)).toEqual({ x: 0, y: 0 });
  });

  it("a carrier always steers (no boost or roll that would drop the crate)", () => {
    const carry: ScenarioDirective = { ...hold, role: "carry", leashPx: 0 };
    expect(steeringGoal(carry, { x: 0, y: 0 }, 0)).toEqual({ x: 0, y: 0 });
  });

  it("a screen has no goal", () => {
    const screen: ScenarioDirective = {
      role: "screen",
      objectiveId: null,
      goal: null,
      leashPx: 0,
    };
    expect(steeringGoal(screen, { x: 999, y: 0 }, 0)).toBeNull();
  });
});
