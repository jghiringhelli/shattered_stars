import { describe, expect, it } from "vitest";
import {
  buildDirectorSetup,
  freshShipId,
  memberKey,
  openingRegistrations,
  reinforcementPose,
  scenePilotOf,
  sideOrder,
  type OpeningShip,
} from "../../../../src/scenes/arcadeBattle/reinforcements/reinforcementSetup";
import {
  DEPLOY_EDGE_OFFSET_PX,
  parseReinforcementSetup,
} from "../../../../src/arcade/reinforcements";
import { homePoint } from "../../../../src/arcade/scenarios";
import { teamKey } from "../../../../src/arcade/teams";

const P = "free_confederation";
const E = "void_corsairs";
const ships: OpeningShip[] = [
  {
    id: "player_0",
    faction: P,
    team: 1,
    squad: 0,
    definitionId: "confed_kestrel",
    loadoutId: null,
  },
  {
    id: "ally_0",
    faction: P,
    team: 1,
    squad: 0,
    definitionId: "confed_wasp",
    loadoutId: "wasp_swarm",
  },
  {
    id: "enemy_0",
    faction: E,
    team: 2,
    squad: 1,
    definitionId: "corsair_venom",
    loadoutId: null,
  },
];
const config = {
  factions: [
    { factionId: P, controller: "player", ships: [] },
    { factionId: E, controller: "ai", ships: [] },
  ],
  battle: "reinforcements",
};
const humans = new Map([[0, "player_0"]]);

function setupFor(battleConfig: unknown, squadTeams = [1, 2]) {
  return buildDirectorSetup({
    setup: parseReinforcementSetup(battleConfig)!,
    playerTeam: 1,
    squadTeams,
    humanSquads: humans,
    ships,
    ownsOutcome: true,
    nextShipId: () => "x",
  });
}

describe("reinforcement scene setup", () => {
  it("orders sides by team: the player's team first, then the others as they appear", () => {
    expect(sideOrder(1, [2, 1, 3, 2])).toEqual([1, 2, 3]);
  });

  it("registers the opening squads with their squads, pilots and loadout costs", () => {
    const regs = openingRegistrations(ships, humans);
    expect(regs.map((r) => [r.shipId, r.member, r.pilot])).toEqual([
      ["player_0", memberKey(0), "player"],
      ["ally_0", memberKey(0), "wingman"],
      ["enemy_0", memberKey(1), "ai"],
    ]);
    expect(regs[1]!.option.loadoutId).toBe("wasp_swarm");
  });

  it("builds the player's reserve from the strategy when none was planned", () => {
    const director = setupFor(config);
    const player = director.sides.find((s) => s.key === teamKey(1))!;
    const squad = player.members[0]!;
    expect(squad.human).toBe(true);
    const total = squad.plan.reduce((sum, o) => sum + o.cost, 0);
    expect(total).toBeGreaterThan(0);
    expect(squad.plan.every((o) => o.definitionId.startsWith("confed_"))).toBe(
      true,
    );
    expect(squad.catalog.length).toBeGreaterThan(0);
    expect(director.playerSide).toBe(teamKey(1));
  });

  it("uses the player's planned reserve when given", () => {
    const director = setupFor({
      ...config,
      reinforcements: {
        squads: [
          {
            strategy: "swarm",
            reserve: [{ definitionId: "confed_finch", loadoutId: null }],
          },
        ],
      },
    });
    expect(
      director.sides[0]!.members[0]!.plan.map((o) => o.definitionId),
    ).toEqual(["confed_finch"]);
  });

  it("a mirror match is two team sides of one faction, each with its own plan", () => {
    const mirror = {
      ...config,
      factions: [config.factions[0]!, { ...config.factions[1]!, factionId: P }],
    };
    const director = setupFor(mirror);
    expect(director.sides.map((s) => s.key)).toEqual([teamKey(1), teamKey(2)]);
    expect(director.sides.map((s) => s.members[0]!.faction)).toEqual([P, P]);
    expect(director.sides[1]!.members[0]!.human).toBe(false);
    expect(director.sides[1]!.members[0]!.catalog).toEqual([]);
  });

  it("two squads of one team are two members of one side, each with its faction", () => {
    const mixed = {
      ...config,
      factions: [
        config.factions[0]!,
        { factionId: E, controller: "ai", ships: [] },
        { factionId: "terran_hegemony", controller: "ai", ships: [] },
      ],
    };
    const director = setupFor(mixed, [1, 1, 2]);
    expect(director.sides).toHaveLength(2);
    expect(director.sides[0]!.members.map((m) => [m.key, m.faction])).toEqual([
      [memberKey(0), P],
      [memberKey(1), E],
    ]);
    expect(
      director.sides[0]!.members[1]!.plan.every((o) =>
        o.definitionId.startsWith("corsair_"),
      ),
    ).toBe(true);
  });

  it("Skirmish arrivals warp in at their side's edge", () => {
    const pose = reinforcementPose({
      side: teamKey(2),
      slot: 0,
      sides: [teamKey(1), teamKey(2)],
      worldSize: 6000,
      scenario: false,
    });
    expect(pose.y).toBeCloseTo(3000 - DEPLOY_EDGE_OFFSET_PX);
    expect(pose.angle).toBeCloseTo(180);
  });

  it("Scenario arrivals warp in on the side's deployment line", () => {
    const pose = reinforcementPose({
      side: teamKey(1),
      slot: 0,
      sides: [teamKey(1), teamKey(2)],
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

  it("only the primary human's replacement is the scene's player; other ships fly by team", () => {
    const teams = { playerTeam: 1, primarySquad: 0, squadTeams: [1, 2, 1, 2] };
    expect(scenePilotOf({ pilot: "player", squad: 0 }, teams)).toBe("player");
    expect(scenePilotOf({ pilot: "player", squad: 2 }, teams)).toBe("wingman");
    expect(scenePilotOf({ pilot: "player", squad: 3 }, teams)).toBe("ai");
    expect(scenePilotOf({ pilot: "ai", squad: 2 }, teams)).toBe("wingman");
    expect(scenePilotOf({ pilot: "wingman", squad: 1 }, teams)).toBe("ai");
  });
});
