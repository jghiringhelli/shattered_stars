import { describe, expect, it } from "vitest";
import {
  buildDirectorSetup,
  freshShipId,
  openingRegistrations,
  reinforcementPose,
  sideOrder,
  type OpeningShip,
} from "../../../../src/scenes/arcadeBattle/reinforcements/reinforcementSetup";
import {
  DEPLOY_EDGE_OFFSET_PX,
  parseReinforcementSetup,
} from "../../../../src/arcade/reinforcements";
import { homePoint } from "../../../../src/arcade/scenarios";

const P = "free_confederation";
const E = "void_corsairs";
const ships: OpeningShip[] = [
  {
    id: "player_0",
    faction: P,
    definitionId: "confed_kestrel",
    loadoutId: null,
    owner: "player",
  },
  {
    id: "ally_0",
    faction: P,
    definitionId: "confed_wasp",
    loadoutId: "wasp_swarm",
    owner: "ai",
  },
  {
    id: "enemy_0",
    faction: E,
    definitionId: "corsair_venom",
    loadoutId: null,
    owner: "ai",
  },
];
const config = {
  factions: [
    { factionId: P, controller: "player", ships: [] },
    { factionId: E, controller: "ai", ships: [] },
  ],
  battle: "reinforcements",
};

describe("reinforcement scene setup", () => {
  it("orders sides: the player's first, then opponents as they appear", () => {
    expect(sideOrder(P, ships)).toEqual([P, E]);
  });

  it("registers the opening squads with their pilots and loadout costs", () => {
    const regs = openingRegistrations(ships);
    expect(regs.map((r) => [r.shipId, r.pilot])).toEqual([
      ["player_0", "player"],
      ["ally_0", "wingman"],
      ["enemy_0", "ai"],
    ]);
    expect(regs[1]!.option.loadoutId).toBe("wasp_swarm");
  });

  it("builds the player's reserve from the strategy when none was planned", () => {
    const setup = parseReinforcementSetup(config)!;
    const director = buildDirectorSetup({
      setup,
      playerFaction: P,
      ships,
      ownsOutcome: true,
      nextShipId: () => "x",
    });
    const player = director.sides.find((s) => s.faction === P)!;
    const total = player.plan.reduce((sum, o) => sum + o.cost, 0);
    expect(total).toBeGreaterThan(0);
    expect(player.plan.every((o) => o.definitionId.startsWith("confed_"))).toBe(
      true,
    );
    expect(director.playerCatalog.length).toBeGreaterThan(0);
  });

  it("uses the player's planned reserve when given", () => {
    const setup = parseReinforcementSetup({
      ...config,
      reinforcements: {
        sides: {
          [P]: {
            strategy: "swarm",
            reserve: [{ definitionId: "confed_finch", loadoutId: null }],
          },
        },
      },
    })!;
    const director = buildDirectorSetup({
      setup,
      playerFaction: P,
      ships,
      ownsOutcome: true,
      nextShipId: () => "x",
    });
    expect(director.sides[0]!.plan.map((o) => o.definitionId)).toEqual([
      "confed_finch",
    ]);
  });

  it("Skirmish arrivals warp in at their side's edge", () => {
    const pose = reinforcementPose({
      faction: E,
      slot: 0,
      sides: [P, E],
      worldSize: 6000,
      scenario: false,
    });
    expect(pose.y).toBeCloseTo(3000 - DEPLOY_EDGE_OFFSET_PX);
    expect(pose.angle).toBeCloseTo(180);
  });

  it("Scenario arrivals warp in on the side's deployment line", () => {
    const pose = reinforcementPose({
      faction: P,
      slot: 0,
      sides: [P, E],
      worldSize: 6000,
      scenario: true,
    });
    const home = homePoint("player", 6000);
    expect(pose.x).toBeCloseTo(home.x);
    expect(pose.y).toBeCloseTo(home.y);
    expect(pose.angle).toBe(0);
  });

  it("fresh ids continue each pilot's numbering past ids in use", () => {
    const taken = new Set(["enemy_0", "enemy_1", "ally_0"]);
    expect(freshShipId("ai", (id) => taken.has(id))).toBe("enemy_2");
    expect(freshShipId("wingman", (id) => taken.has(id))).toBe("ally_1");
    expect(freshShipId("player", (id) => taken.has(id))).toBe("player_0");
  });
});
