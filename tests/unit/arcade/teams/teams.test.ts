import { describe, expect, it } from "vitest";
import {
  areAllies,
  areHostile,
  assignSquadTeams,
  parseTeamId,
  relationOf,
  teamKey,
} from "../../../../src/arcade/teams";

describe("teams — hostility is by team, never by faction", () => {
  it("ships of the same faction on different teams are hostile (mirror match)", () => {
    const a = { faction: "terran_hegemony", team: 0 };
    const b = { faction: "terran_hegemony", team: 1 };
    expect(areHostile(a, b)).toBe(true);
    expect(areAllies(a, b)).toBe(false);
  });

  it("ships of different factions on the same team are allies (mixed team)", () => {
    const a = { faction: "terran_hegemony", team: 0 };
    const b = { faction: "void_corsairs", team: 0 };
    expect(areHostile(a, b)).toBe(false);
    expect(areAllies(a, b)).toBe(true);
  });

  it("relationOf reads a team from the viewer's team", () => {
    expect(relationOf(1, 1)).toBe("ally");
    expect(relationOf(1, 2)).toBe("enemy");
  });

  it("teamKey is the string side key of a team", () => {
    expect(teamKey(0)).toBe("team_0");
    expect(teamKey(3)).toBe("team_3");
    expect(teamKey(0)).not.toBe(teamKey(1));
  });
});

describe("parseTeamId", () => {
  it("reads team_<n> strings and plain non-negative integers", () => {
    expect(parseTeamId("team_1")).toBe(1);
    expect(parseTeamId("team_0")).toBe(0);
    expect(parseTeamId(2)).toBe(2);
  });

  it("rejects anything else", () => {
    expect(parseTeamId(undefined)).toBeNull();
    expect(parseTeamId("red")).toBeNull();
    expect(parseTeamId(-1)).toBeNull();
    expect(parseTeamId(1.5)).toBeNull();
    expect(parseTeamId("team_x")).toBeNull();
  });
});

describe("assignSquadTeams", () => {
  it("keeps every declared team", () => {
    expect(
      assignSquadTeams([
        { teamId: "team_1" },
        { teamId: "team_2" },
        { teamId: "team_1" },
      ]),
    ).toEqual([1, 2, 1]);
  });

  it("gives each squad without a team its own team (backward compatible)", () => {
    expect(assignSquadTeams([{}, {}, {}])).toEqual([0, 1, 2]);
  });

  it("squads without a team never join a declared team", () => {
    const teams = assignSquadTeams([{ teamId: "team_0" }, {}, { teamId: 1 }]);
    expect(teams[0]).toBe(0);
    expect(teams[2]).toBe(1);
    expect(teams[1]).not.toBe(0);
    expect(teams[1]).not.toBe(1);
  });

  it("two squads of the same faction without teams fight each other", () => {
    const squads = [
      { factionId: "terran_hegemony" },
      { factionId: "terran_hegemony" },
    ];
    const [a, b] = assignSquadTeams(squads);
    expect(a).not.toBe(b);
  });
});
