import { describe, expect, it } from "vitest";
import {
  CHANCE_ENGAGEMENT_QUIET_ROUNDS,
  SCENARIO_DEFINITIONS,
  SCENARIO_ROUND_MS,
  createScenarioState,
  stepScenario,
  withBonusPoints,
  type ScenarioShip,
  type ScenarioState,
} from "../../../../src/arcade/scenarios";
import { aFrame, aShip } from "./scenarioBuilders";

const WORLD = 6000;
const C = WORLD / 2;

/** An enemy parked far from every objective (keeps the enemy side alive). */
const FAR_ENEMY = aShip({ id: "far", side: "enemy", x: C, y: C - 2000 });

function run(
  state: ScenarioState,
  ships: readonly ScenarioShip[],
  totalMs: number,
  stepMs = 100,
): ScenarioState {
  let s = state;
  for (let t = 0; t < totalMs; t += stepMs) {
    s = stepScenario(
      s,
      aFrame(ships, [], Math.min(stepMs, totalMs - t), WORLD),
    );
  }
  return s;
}

describe("createScenarioState", () => {
  it("Satellite Array places three satellites across the centre line", () => {
    const state = createScenarioState(
      SCENARIO_DEFINITIONS.satellite_array,
      WORLD,
    );
    expect(state.zones.map((z) => [z.label, z.x, z.y])).toEqual([
      ["A", C - 1200, C],
      ["B", C, C],
      ["C", C + 1200, C],
    ]);
    expect(state.zones.every((z) => z.controller === "none")).toBe(true);
    expect(state.nodes).toHaveLength(0);
    expect(state.crates).toHaveLength(0);
  });

  it("Chance Engagement has one central objective", () => {
    const state = createScenarioState(
      SCENARIO_DEFINITIONS.chance_engagement,
      WORLD,
    );
    expect(state.zones.map((z) => [z.x, z.y])).toEqual([[C, C]]);
  });

  it("Salvage Mission lays loose crates in the middle", () => {
    const state = createScenarioState(
      SCENARIO_DEFINITIONS.salvage_mission,
      WORLD,
    );
    expect(state.crates).toHaveLength(3);
    expect(state.crates.every((c) => c.carrierId === null && c.y === C)).toBe(
      true,
    );
  });

  it("Scramble the Transmissions has three unowned network nodes", () => {
    const state = createScenarioState(
      SCENARIO_DEFINITIONS.scramble_transmissions,
      WORLD,
    );
    expect(state.nodes).toHaveLength(3);
    expect(state.nodes.every((n) => n.owner === null)).toBe(true);
  });

  it("starts at zero points with no result", () => {
    const state = createScenarioState(
      SCENARIO_DEFINITIONS.satellite_array,
      WORLD,
    );
    expect(state.points).toEqual({
      player: { objective: 0, destruction: 0 },
      enemy: { objective: 0, destruction: 0 },
    });
    expect(state.result).toBeNull();
  });
});

describe("round scoring", () => {
  const satellites = (): ScenarioState =>
    createScenarioState(SCENARIO_DEFINITIONS.satellite_array, WORLD);

  it("scores nothing before the round ends", () => {
    const state = run(
      satellites(),
      [aShip({ x: C, y: C }), FAR_ENEMY],
      SCENARIO_ROUND_MS - 100,
    );
    expect(state.points.player.objective).toBe(0);
    expect(state.round).toBe(0);
  });

  it("scores 1 per controlled satellite at each round's end", () => {
    const ships = [aShip({ x: C, y: C }), FAR_ENEMY];
    const one = run(satellites(), ships, SCENARIO_ROUND_MS);
    expect(one.round).toBe(1);
    expect(one.points.player.objective).toBe(1);
    expect(one.lastRoundAwards).toEqual({ player: 1, enemy: 0 });
    const two = run(one, ships, SCENARIO_ROUND_MS);
    expect(two.points.player.objective).toBe(2);
  });

  it("scores each satellite a side controls", () => {
    const ships = [
      aShip({ id: "a", x: C - 1200, y: C }),
      aShip({ id: "b", x: C + 1200, y: C }),
      aShip({ id: "e", side: "enemy", x: C, y: C }),
    ];
    const state = run(satellites(), ships, SCENARIO_ROUND_MS);
    expect(state.points.player.objective).toBe(2);
    expect(state.points.enemy.objective).toBe(1);
  });

  it("a contested satellite scores for nobody", () => {
    const ships = [
      aShip({ x: C, y: C }),
      aShip({ id: "e", side: "enemy", x: C, y: C }),
    ];
    const state = run(satellites(), ships, SCENARIO_ROUND_MS);
    expect(state.points.player.objective).toBe(0);
    expect(state.points.enemy.objective).toBe(0);
  });

  it("one long frame spanning two rounds scores both", () => {
    const state = stepScenario(
      satellites(),
      aFrame(
        [aShip({ x: C, y: C }), FAR_ENEMY],
        [],
        SCENARIO_ROUND_MS * 2,
        WORLD,
      ),
    );
    expect(state.round).toBe(2);
    expect(state.points.player.objective).toBe(2);
  });

  it("Chance Engagement scores only after its quiet rounds", () => {
    const start = createScenarioState(
      SCENARIO_DEFINITIONS.chance_engagement,
      WORLD,
    );
    const ships = [aShip({ x: C, y: C }), FAR_ENEMY];
    const quiet = run(
      start,
      ships,
      SCENARIO_ROUND_MS * CHANCE_ENGAGEMENT_QUIET_ROUNDS,
    );
    expect(quiet.points.player.objective).toBe(0);
    const scoring = run(quiet, ships, SCENARIO_ROUND_MS);
    expect(scoring.points.player.objective).toBe(1);
  });

  it("Salvage Mission: each carried crate scores for its carrier's side", () => {
    const start = createScenarioState(
      SCENARIO_DEFINITIONS.salvage_mission,
      WORLD,
    );
    const ships = [aShip({ id: "p", x: C, y: C }), FAR_ENEMY];
    const state = run(start, ships, SCENARIO_ROUND_MS);
    expect(state.crates.find((c) => c.carrierId === "p")).toBeDefined();
    expect(state.points.player.objective).toBe(1);
  });

  it("Scramble the Transmissions: a scrambled node scores each round for its owner", () => {
    const start = createScenarioState(
      SCENARIO_DEFINITIONS.scramble_transmissions,
      WORLD,
    );
    const node = start.nodes[1]!;
    const state = run(
      start,
      [aShip({ x: node.x, y: node.y }), FAR_ENEMY],
      SCENARIO_ROUND_MS,
    );
    expect(state.nodes[1]!.owner).toBe("player");
    expect(state.points.player.objective).toBe(1);
  });

  it("destroyed enemies add destruction points", () => {
    const state = stepScenario(
      satellites(),
      aFrame(
        [FAR_ENEMY],
        [
          {
            kind: "destroyed",
            shipId: "x",
            side: "enemy",
            value: 5,
            x: 0,
            y: 0,
          },
        ],
        16,
        WORLD,
      ),
    );
    expect(state.points.player.destruction).toBe(5);
  });
});

describe("match end", () => {
  it("reaching the threshold ends the match", () => {
    const near = withBonusPoints(
      createScenarioState(SCENARIO_DEFINITIONS.satellite_array, WORLD),
      "player",
      19,
    );
    const state = run(
      near,
      [aShip({ x: C, y: C }), FAR_ENEMY],
      SCENARIO_ROUND_MS,
    );
    expect(state.result).toMatchObject({
      winner: "player",
      reason: "threshold",
    });
  });

  it("wiping out the opponent ends the match", () => {
    const start = createScenarioState(
      SCENARIO_DEFINITIONS.satellite_array,
      WORLD,
    );
    const state = stepScenario(start, aFrame([aShip()], [], 16, WORLD));
    expect(state.result).toMatchObject({
      winner: "player",
      reason: "annihilation",
    });
  });

  it("the time limit ends the match on points", () => {
    const def = {
      ...SCENARIO_DEFINITIONS.satellite_array,
      timeLimitMs: SCENARIO_ROUND_MS,
    };
    const state = run(
      createScenarioState(def, WORLD),
      [aShip({ x: C, y: C }), FAR_ENEMY],
      SCENARIO_ROUND_MS,
    );
    expect(state.result).toMatchObject({ winner: "player", reason: "time" });
  });

  it("a finished match no longer changes", () => {
    const start = createScenarioState(
      SCENARIO_DEFINITIONS.satellite_array,
      WORLD,
    );
    const ended = stepScenario(start, aFrame([aShip()], [], 16, WORLD));
    const after = run(
      ended,
      [aShip({ x: C, y: C }), FAR_ENEMY],
      SCENARIO_ROUND_MS * 2,
    );
    expect(after).toBe(ended);
  });
});
