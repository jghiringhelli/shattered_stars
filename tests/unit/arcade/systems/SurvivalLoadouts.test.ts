/**
 * SurvivalLoadouts — specification tests for Survival's wave rosters and
 * the quick builds handed to wave ships and joining squad ships.
 */

import { describe, it, expect } from "vitest";
import {
  flagshipLoadout,
  joiningSquadLoadouts,
  planWaveRoster,
  type RosterShip,
} from "../../../../src/arcade/systems/SurvivalLoadouts";
import { assignQuickBuilds } from "../../../../src/arcade/systems/QuickBuildEquip";
import { getEquippableLoadouts } from "../../../../src/data/ShipLoadouts";
import { uniquePilotOf } from "../../../../src/data/squadRules";

/** corsair_fang's first quick build is flown by a unique ace (Poison Fang). */
const FANG = "corsair_fang";

const FIGHTER: RosterShip = { id: FANG, role: "light_fighter" };
const BOMBER: RosterShip = { id: "bomber_ship", role: "bomber" };
const GUNSHIP: RosterShip = { id: "gunship_ship", role: "gunship" };
const PLAIN_WAVE = { enemyCount: 0, eliteCount: 0, isMilestone: false };

const idsOf = (slots: readonly { definitionId: string }[]): string[] =>
  slots.map((slot) => slot.definitionId);

describe("planWaveRoster", () => {
  it("an empty roster fields no ships", () => {
    expect(
      planWaveRoster([], { enemyCount: 3, eliteCount: 1, isMilestone: true }),
    ).toEqual([]);
  });

  it("regulars cycle through the roster", () => {
    const slots = planWaveRoster([FIGHTER, BOMBER], {
      ...PLAIN_WAVE,
      enemyCount: 3,
    });
    expect(idsOf(slots)).toEqual([FANG, BOMBER.id, FANG]);
    expect(slots.every((slot) => slot.tier === "regular")).toBe(true);
  });

  it("elites are the roster's first gunship or bomber", () => {
    const slots = planWaveRoster([FIGHTER, BOMBER, GUNSHIP], {
      ...PLAIN_WAVE,
      eliteCount: 2,
    });
    expect(slots).toMatchObject([
      { definitionId: BOMBER.id, tier: "elite" },
      { definitionId: BOMBER.id, tier: "elite" },
    ]);
  });

  it("elites fall back to the roster's first ship", () => {
    const slots = planWaveRoster([FIGHTER], { ...PLAIN_WAVE, eliteCount: 1 });
    expect(slots).toMatchObject([{ definitionId: FANG, tier: "elite" }]);
  });

  it("elites follow a given role preference, first role first", () => {
    const HEAVY: RosterShip = { id: "heavy_ship", role: "heavy_fighter" };
    const roster = [FIGHTER, GUNSHIP, BOMBER, HEAVY];
    const pick = (eliteRoles: readonly string[]) =>
      planWaveRoster(roster, { ...PLAIN_WAVE, eliteCount: 1, eliteRoles })[0]!
        .definitionId;
    expect(pick(["heavy_fighter", "bomber"])).toBe(HEAVY.id);
    expect(pick(["bomber", "gunship"])).toBe(BOMBER.id);
    expect(pick(["gunship", "bomber"])).toBe(GUNSHIP.id);
    expect(pick(["support"])).toBe(FANG);
  });

  it("a milestone adds one boss, the roster's first gunship, last", () => {
    const slots = planWaveRoster([GUNSHIP, FIGHTER], {
      enemyCount: 1,
      eliteCount: 0,
      isMilestone: true,
    });
    expect(slots.map((slot) => slot.tier)).toEqual(["regular", "boss"]);
    expect(slots[1]!.definitionId).toBe(GUNSHIP.id);
  });

  it("without a gunship the boss is the roster's last ship", () => {
    const slots = planWaveRoster([FIGHTER, BOMBER], {
      ...PLAIN_WAVE,
      isMilestone: true,
    });
    expect(slots).toMatchObject([{ definitionId: BOMBER.id, tier: "boss" }]);
  });

  it("no boss joins a wave that is not a milestone", () => {
    const slots = planWaveRoster([GUNSHIP], { ...PLAIN_WAVE, enemyCount: 2 });
    expect(slots.some((slot) => slot.tier === "boss")).toBe(false);
  });

  it("the whole wave shares one quick-build assignment", () => {
    const slots = planWaveRoster([FIGHTER, BOMBER], {
      enemyCount: 3,
      eliteCount: 1,
      isMilestone: true,
    });
    expect(slots.map((slot) => slot.loadoutId)).toEqual(
      assignQuickBuilds(idsOf(slots)),
    );
  });

  it("never fields the same unique ace twice in a wave", () => {
    const slots = planWaveRoster([FIGHTER], { ...PLAIN_WAVE, enemyCount: 2 });
    const [first, second] = slots.map((slot) => uniquePilotOf(slot.loadoutId));
    expect(first).not.toBeNull();
    expect(second).not.toBe(first);
  });

  it("ships without quick builds fly bare", () => {
    const slots = planWaveRoster([BOMBER], { ...PLAIN_WAVE, enemyCount: 1 });
    expect(slots[0]!.loadoutId).toBeNull();
  });
});

describe("joiningSquadLoadouts", () => {
  it("the first ship of an empty squad gets its default build", () => {
    expect(joiningSquadLoadouts([], [FANG])).toEqual(assignQuickBuilds([FANG]));
  });

  it("returns one build per joining ship", () => {
    expect(joiningSquadLoadouts([], [FANG, FANG, "no_such_ship"])).toHaveLength(
      3,
    );
  });

  it("an ace already in the squad is not handed out again", () => {
    const [aceBuild] = assignQuickBuilds([FANG]);
    const [joining] = joiningSquadLoadouts(
      [{ definitionId: FANG, loadoutId: aceBuild ?? null }],
      [FANG],
    );
    expect(uniquePilotOf(aceBuild ?? null)).not.toBeNull();
    expect(uniquePilotOf(joining ?? null)).not.toBe(
      uniquePilotOf(aceBuild ?? null),
    );
  });

  it("a chosen ace anywhere in the squad is not handed out again", () => {
    const squad = [
      { definitionId: FANG, loadoutId: "fang_raider" },
      { definitionId: "no_such_ship", loadoutId: null },
    ];
    expect(joiningSquadLoadouts(squad, [FANG])).not.toContain("fang_raider");
  });
});

describe("flagshipLoadout", () => {
  it("without a pick flies the default quick build", () => {
    expect(flagshipLoadout(FANG, null)).toBe(assignQuickBuilds([FANG])[0]);
  });

  it("flies the quick build picked on the setup screen", () => {
    const last = getEquippableLoadouts(FANG).at(-1)!.id;
    expect(flagshipLoadout(FANG, last)).toBe(last);
  });

  it("ignores a pick that is not one of the ship's quick builds", () => {
    expect(flagshipLoadout(FANG, "viper_ace")).toBe(
      assignQuickBuilds([FANG])[0],
    );
  });
});
