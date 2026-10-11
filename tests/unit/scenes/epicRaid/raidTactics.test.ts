/**
 * raidTactics — specification tests: the boss is an all-round threat
 * contact; the player's squad leaves it out of its plan while any escort
 * flies, unless the player marked it; with the coordinator that means the
 * wingmen clear the escort screen first, and marking the boss turns them
 * onto it.
 */

import { describe, expect, it } from "vitest";
import type { BotContact } from "../../../../src/arcade/ai";
import { BattleBots } from "../../../../src/scenes/battleUi/BattleBots";
import { BOSS_BROADSIDE_RANGE_PX } from "../../../../src/scenes/epicRaid/bossDefinitions";
import {
  BOSS_CONTACT_ARC_DEG,
  bossContact,
  escortWaveKey,
  RAID_BOSS_SIDE,
  RAID_PLAYER_SIDE,
  screenBossUntilEscortsFall,
} from "../../../../src/scenes/epicRaid/raidTactics";
import { contact } from "../../arcade/ai/aiFixtures";

const FIGHTER = "confed_sparrow";
const ESCORT = "terran_viper";
const BOSS_ID = "boss";
const STEP_MS = 50;

const BOSS = bossContact({
  id: BOSS_ID,
  x: 3000,
  y: 1500,
  angle: 180,
  totalHull: 1000,
  maxTotalHull: 1440,
  shields: 0,
  maxShields: 320,
});

/** The raid at the start: the squad half a world south, escorts near the boss. */
function raid(escortHull?: number): BotContact[] {
  const escortOverrides = escortHull === undefined ? {} : { hull: escortHull };
  return [
    contact("p0", RAID_PLAYER_SIDE, FIGHTER, { x: 2900, y: 4500, angle: 0 }),
    contact("p1", RAID_PLAYER_SIDE, FIGHTER, { x: 3000, y: 4560, angle: 0 }),
    contact("p2", RAID_PLAYER_SIDE, FIGHTER, { x: 3100, y: 4500, angle: 0 }),
    contact(
      "e1",
      RAID_BOSS_SIDE,
      ESCORT,
      { x: 3000, y: 1750, angle: 180 },
      escortOverrides,
    ),
    BOSS,
  ];
}

describe("bossContact", () => {
  it("is a living boss-side contact whose broadside reaches all around", () => {
    expect(BOSS).toMatchObject({
      id: BOSS_ID,
      side: RAID_BOSS_SIDE,
      alive: true,
      hull: 1000,
      maxHull: 1440,
      firingArcDeg: BOSS_CONTACT_ARC_DEG,
      weaponRange: BOSS_BROADSIDE_RANGE_PX,
      speed: 0,
    });
  });
});

describe("screenBossUntilEscortsFall", () => {
  const screen = (contacts: BotContact[], bossMarked: boolean) =>
    screenBossUntilEscortsFall(contacts, { bossId: BOSS_ID, bossMarked }).map(
      (c) => c.id,
    );

  it("hides the boss while an escort flies", () => {
    expect(screen(raid(), false)).not.toContain(BOSS_ID);
  });

  it("shows the boss once the player marked it", () => {
    expect(screen(raid(), true)).toContain(BOSS_ID);
  });

  it("shows the boss once every escort is down", () => {
    expect(screen(raid(0), false)).toContain(BOSS_ID);
  });
});

describe("the player's raid squad (coordinator + screen)", () => {
  function squad(): BattleBots {
    const crew = new BattleBots({ worldSize: 6000, random: () => 0.5 });
    crew.addSquad({
      key: RAID_PLAYER_SIDE,
      side: RAID_PLAYER_SIDE,
      aiLeader: false,
      screen: (contacts, nowMs) =>
        screenBossUntilEscortsFall(contacts, {
          bossId: BOSS_ID,
          bossMarked: crew.markedTarget(RAID_PLAYER_SIDE, nowMs) === BOSS_ID,
        }),
    });
    for (const id of ["p0", "p1", "p2"]) crew.enlist(id, RAID_PLAYER_SIDE);
    return crew;
  }

  it("engages the escorts first", () => {
    const crew = squad();
    for (let t = 0; t <= 1000; t += STEP_MS) crew.command(t, raid());
    expect(crew.orderFor("p1")?.focusTargetId).toBe("e1");
  });

  it("turns onto the boss when the player marks it", () => {
    const crew = squad();
    for (let t = 0; t <= 1000; t += STEP_MS) crew.command(t, raid());
    crew.mark(RAID_PLAYER_SIDE, BOSS_ID, 1000);
    for (let t = 1000; t <= 2000; t += STEP_MS) crew.command(t, raid());
    expect(crew.orderFor("p1")?.focusTargetId).toBe(BOSS_ID);
    expect(crew.orderFor("p2")?.focusTargetId).toBe(BOSS_ID);
  });
});

describe("escortWaveKey", () => {
  it("numbers each escort wave's squad", () => {
    expect(escortWaveKey(1)).not.toBe(escortWaveKey(2));
  });
});
