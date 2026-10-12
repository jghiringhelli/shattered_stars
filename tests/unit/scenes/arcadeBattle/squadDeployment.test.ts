import { describe, expect, it } from "vitest";
import { planSquadDeployment } from "../../../../src/scenes/arcadeBattle/squadDeployment";

const WORLD = 4000;
const noBuilds = (slot: { ships: readonly string[] }) =>
  slot.ships.map(() => null);

describe("planSquadDeployment — offline squads", () => {
  it("a mirror match puts the same faction on two hostile teams", () => {
    const plan = planSquadDeployment(
      [
        {
          factionId: "terran_hegemony",
          controller: "player",
          ships: ["terran_viper", "terran_gladius"],
          teamId: "team_1",
        },
        {
          factionId: "terran_hegemony",
          controller: "ai",
          ships: ["terran_viper"],
          teamId: "team_2",
        },
      ],
      { worldSize: WORLD, buildsOf: noBuilds },
    );
    expect(plan.playerTeam).toBe(1);
    expect(plan.squadTeams).toEqual([1, 2]);
    const foe = plan.specs.find((s) => s.squad === 1)!;
    expect(foe.faction).toBe("terran_hegemony");
    expect(foe.team).toBe(2);
    expect(foe.pilot).toBe("ai");
    expect(plan.specs.filter((s) => s.team === 1)).toHaveLength(2);
  });

  it("an old config without teams gives every squad its own team", () => {
    const plan = planSquadDeployment(
      [
        { factionId: "terran_hegemony", ships: ["terran_viper"] },
        { factionId: "terran_hegemony", ships: ["terran_viper"] },
      ],
      { worldSize: WORLD, buildsOf: noBuilds },
    );
    expect(plan.squadTeams[0]).not.toBe(plan.squadTeams[1]);
    expect(plan.specs[0]!.id).toBe("player_0");
    expect(plan.specs[1]!.id).toBe("enemy_0");
  });

  it("a teammate squad of another faction flies beside the player as wingmen", () => {
    const plan = planSquadDeployment(
      [
        {
          factionId: "terran_hegemony",
          controller: "player",
          ships: ["terran_viper"],
          teamId: "team_1",
        },
        {
          factionId: "void_corsairs",
          controller: "ai",
          ships: ["corsair_raider"],
          teamId: "team_1",
        },
        {
          factionId: "terran_hegemony",
          controller: "ai",
          ships: ["terran_viper"],
          teamId: "team_2",
        },
        {
          factionId: "free_confederation",
          controller: "ai",
          ships: ["confed_sparrow"],
          teamId: "team_2",
        },
      ],
      { worldSize: WORLD, buildsOf: noBuilds },
    );
    const mate = plan.specs.find((s) => s.squad === 1)!;
    expect(mate.id).toBe("ally_0");
    expect(mate.faction).toBe("void_corsairs");
    expect(mate.team).toBe(1);
    expect(mate.pilot).toBe("wingman");
    expect(mate.angle).toBe(0);
    const foes = plan.specs.filter((s) => s.team === 2);
    expect(foes.map((s) => s.id)).toEqual(["enemy_0", "enemy_1"]);
    expect(foes.every((s) => s.angle === 180 && s.pilot === "ai")).toBe(true);
  });

  it("free-for-all: each enemy team holds its own arc of the ring", () => {
    const plan = planSquadDeployment(
      [
        {
          factionId: "terran_hegemony",
          controller: "player",
          ships: ["terran_viper"],
        },
        {
          factionId: "void_corsairs",
          ships: ["corsair_raider"],
          teamId: "team_7",
        },
        { factionId: "free_confederation", ships: ["confed_sparrow"] },
        {
          factionId: "void_corsairs",
          ships: ["corsair_raider"],
          teamId: "team_7",
        },
      ],
      { worldSize: WORLD, buildsOf: noBuilds },
    );
    const ring = plan.specs.filter((s) => s.id.startsWith("enemy_"));
    expect(ring.map((s) => s.squad)).toEqual([1, 3, 2]);
    expect(new Set(plan.squadTeams).size).toBe(3);
  });
});

describe("planSquadDeployment — online seats", () => {
  const slots = [
    {
      factionId: "void_corsairs",
      ships: ["corsair_raider"],
      teamId: "team_1",
      seat: 1,
    },
    {
      factionId: "terran_hegemony",
      ships: ["terran_viper", "terran_gladius"],
      teamId: "team_0",
      seat: 0,
    },
    {
      factionId: "void_corsairs",
      ships: ["corsair_raider"],
      teamId: "team_0",
      seat: 2,
    },
  ] as const;
  const online = { worldSize: WORLD, buildsOf: noBuilds, homeSeat: 0 };

  it("puts seat 0's squad on the player lines whatever the local seat", () => {
    const plan = planSquadDeployment(slots, online);
    expect(plan.playerFaction).toBe("terran_hegemony");
    expect(plan.playerTeam).toBe(0);
    const flagship = plan.specs.find((s) => s.id === "player_0")!;
    expect(flagship.definitionId).toBe("terran_viper");
    expect(flagship.pilot).toBe("player");
  });

  it("names every seat's flagship and keeps mixed-faction teammates beside the home squad", () => {
    const plan = planSquadDeployment(slots, online);
    expect([...plan.seatShips.entries()].sort()).toEqual([
      [0, "player_0"],
      [1, "enemy_0"],
      [2, "ally_1"],
    ]);
    const teammate = plan.specs.find((s) => s.id === "ally_1")!;
    expect(teammate.angle).toBe(0);
    expect(teammate.team).toBe(0);
    expect(teammate.faction).toBe("void_corsairs");
    const foe = plan.specs.find((s) => s.id === "enemy_0")!;
    expect(foe.angle).toBe(180);
    expect(foe.team).toBe(1);
  });

  it("is a pure function of the canonical config", () => {
    expect(planSquadDeployment(slots, online)).toEqual(
      planSquadDeployment(slots, online),
    );
  });
});
