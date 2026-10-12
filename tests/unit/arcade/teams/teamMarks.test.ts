/**
 * Team marks — specification: in a mirror match (one faction on both
 * teams) squad marks and squad focus are scoped by team, never by faction;
 * a mixed-faction team shares one mark.
 */

import { describe, expect, it } from "vitest";
import { ArcadeBotFleet } from "../../../../src/scenes/arcadeBattle/ArcadeBotFleet";
import { toBotContact } from "../../../../src/scenes/arcadeBattle/arcadeBotContact";
import { teamKey } from "../../../../src/arcade/teams";
import { createSeededRng } from "../../../../src/utils/random";

const WORLD = 6000;
const TICK_MS = 1000 / 60;

/** A contact as the AI sees it; its faction is documentation only (contacts carry teams). */
function ship(
  id: string,
  team: number,
  _faction: string,
  x: number,
  y: number,
) {
  return toBotContact({
    id,
    team,
    definitionId: "terran_viper",
    x,
    y,
    angle: team === 0 ? 0 : 180,
    hull: 30,
    maxHull: 30,
    shields: 0,
    maxShields: 0,
    control: { speed: 2 },
    stress: { isStressed: false },
    combatStats: { firingArc: 60, weaponRange: 1200 },
  });
}

const HEG = "terran_hegemony";
const MIRROR = [
  ship("player_0", 0, HEG, 3000, 3500),
  ship("ally_0", 0, HEG, 2800, 3600),
  ship("enemy_0", 1, HEG, 2900, 2500),
  ship("enemy_1", 1, HEG, 3100, 2500),
];

function fleet(): ArcadeBotFleet {
  return new ArcadeBotFleet({
    difficulty: "hard",
    playerSide: teamKey(0),
    random: createSeededRng(3).next,
    worldSize: WORLD,
  });
}

describe("squad marks by team", () => {
  it("a mark placed by one team never counts for the other team of the same faction", () => {
    const f = fleet();
    f.command(0, MIRROR);
    f.markTarget(teamKey(0), "enemy_0", 0);
    expect(f.isMarkedBy(teamKey(0), "enemy_0", 0)).toBe(true);
    expect(f.isMarkedBy(teamKey(1), "enemy_0", 0)).toBe(false);
    expect(f.markedTargetOf(teamKey(1), 0)).not.toBe("enemy_0");
  });

  it("the enemy team's squad focuses a ship of the other team, never its own", () => {
    const f = fleet();
    for (let t = 0; t <= 3000; t += TICK_MS) f.command(t, MIRROR);
    for (const id of ["enemy_0", "enemy_1"]) {
      const focus = f.orderFor(id, teamKey(1))?.focusTargetId ?? null;
      if (focus !== null) expect(["player_0", "ally_0"]).toContain(focus);
    }
    const mark = f.markedTargetOf(teamKey(1), 3000);
    if (mark !== null) expect(["player_0", "ally_0"]).toContain(mark);
  });

  it("a mixed-faction team is one squad with one mark", () => {
    const f = fleet();
    const mixed = [
      ship("player_0", 0, HEG, 3000, 3500),
      ship("ally_0", 0, "void_corsairs", 2800, 3600),
      ship("enemy_0", 1, HEG, 2900, 2500),
    ];
    f.command(0, mixed);
    expect(f.isSquad(teamKey(0))).toBe(true);
    f.markTarget(teamKey(0), "enemy_0", 0);
    expect(f.markedTargetOf(teamKey(0), 0)).toBe("enemy_0");
  });
});
