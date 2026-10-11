/**
 * CampaignPilotEquip — specification tests for seating campaign pilots in
 * the squad and folding their unlocked abilities into the quick build.
 */

import { describe, it, expect } from "vitest";
import {
  campaignAbilityIds,
  campaignPilotModifiers,
  seatCampaignPilots,
} from "../../../../src/arcade/systems/CampaignPilotEquip";
import { resolveLoadoutModifiers } from "../../../../src/arcade/ArcadeUpgradeEffects";
import { combineEffects } from "../../../../src/core/CombatModifiers";
import { CAMPAIGN_PILOTS } from "../../../../src/data/PilotData";
import { PILOT_ABILITY_REALTIME } from "../../../../src/data/pilotAbilityEffects";
import { getShipLoadouts } from "../../../../src/data/ShipLoadouts";
import { initializePilots } from "../../../../src/systems/CampaignPilotManager";
import type { CampaignPilotState } from "../../../../src/systems/CampaignSaveManager";
import { PILOT_CARDS } from "../../../../src/systems/SquadBuilder";

const TERRAN_DEFS = CAMPAIGN_PILOTS.terran_hegemony!;
const TERRAN_PILOTS = initializePilots("terran_hegemony");
const PROTAGONIST_ID = "admiral_chen";

/**
 * @param pilotId - Campaign pilot id.
 * @param overrides - Fields to change on its fresh save state.
 * @returns The pilot's save state.
 */
function pilotState(
  pilotId: string,
  overrides: Partial<CampaignPilotState> = {},
): CampaignPilotState {
  const state = TERRAN_PILOTS.find((pilot) => pilot.pilotId === pilotId)!;
  return { ...state, ...overrides };
}

describe("seatCampaignPilots", () => {
  it("seats the protagonist in the flagship even when saved last", () => {
    const seats = seatCampaignPilots(
      [...TERRAN_PILOTS].reverse(),
      TERRAN_DEFS,
      3,
    );
    expect(seats[0]?.state.pilotId).toBe(PROTAGONIST_ID);
  });

  it("seats support pilots in the escorts in roster order", () => {
    const seats = seatCampaignPilots(
      [...TERRAN_PILOTS].reverse(),
      TERRAN_DEFS,
      3,
    );
    expect(seats.slice(1).map((seat) => seat?.state.pilotId)).toEqual([
      "striker",
      "whisper",
    ]);
  });

  it("leaves seats without a campaign pilot empty", () => {
    const seats = seatCampaignPilots(TERRAN_PILOTS, TERRAN_DEFS, 5);
    expect(seats.slice(3)).toEqual([null, null]);
  });

  it("seats no one for a save without pilots", () => {
    expect(seatCampaignPilots([], TERRAN_DEFS, 2)).toEqual([null, null]);
  });

  it("never seats more pilots than the squad has ships", () => {
    expect(seatCampaignPilots(TERRAN_PILOTS, TERRAN_DEFS, 1)).toHaveLength(1);
  });

  it("skips saved pilots that have no definition", () => {
    const stranger = pilotState(PROTAGONIST_ID, { pilotId: "nobody" });
    const seats = seatCampaignPilots([stranger], TERRAN_DEFS, 1);
    expect(seats).toEqual([null]);
  });
});

describe("campaignAbilityIds", () => {
  const chen = TERRAN_DEFS.find((pilot) => pilot.id === PROTAGONIST_ID)!;

  it("a level-1 pilot flies with its starting abilities", () => {
    const seat = { state: pilotState(PROTAGONIST_ID), definition: chen };
    expect(campaignAbilityIds(seat)).toEqual(["marksman"]);
  });

  it("adds every ability unlocked up to the pilot's level", () => {
    const state = pilotState(PROTAGONIST_ID, { pilotSkill: 3 });
    expect(campaignAbilityIds({ state, definition: chen })).toEqual([
      "marksman",
      "predatory_instinct",
      "barrel_roll_efficiency",
    ]);
  });

  it("keeps abilities granted outside the level track, once each", () => {
    const state = pilotState(PROTAGONIST_ID, {
      unlockedAbilityIds: ["marksman", "stalwart"],
    });
    expect(campaignAbilityIds({ state, definition: chen })).toEqual([
      "marksman",
      "stalwart",
    ]);
  });
});

describe("campaignPilotModifiers", () => {
  const ship = "terran_viper";
  const loadouts = getShipLoadouts(ship);

  it("without abilities flies exactly the quick build's sheet", () => {
    for (const loadout of loadouts) {
      expect(campaignPilotModifiers(ship, loadout.id, [])).toEqual(
        resolveLoadoutModifiers(ship, loadout.id),
      );
    }
  });

  it("folds a pilot ability into the bare hull", () => {
    expect(campaignPilotModifiers(ship, null, ["fanatical"])).toEqual(
      combineEffects([PILOT_ABILITY_REALTIME.fanatical!]),
    );
  });

  it("stacks the pilot's abilities on the quick build", () => {
    const loadoutId = loadouts[0]!.id;
    expect(
      campaignPilotModifiers(ship, loadoutId, ["fanatical"]).damagedLaserBonus,
    ).toBe(resolveLoadoutModifiers(ship, loadoutId).damagedLaserBonus + 1);
  });

  it("never counts the quick build's own pilot ability twice", () => {
    const loadout = loadouts.find(
      (candidate) => PILOT_CARDS[candidate.pilotId]?.abilityId,
    )!;
    const abilityId = PILOT_CARDS[loadout.pilotId]!.abilityId!;
    expect(campaignPilotModifiers(ship, loadout.id, [abilityId])).toEqual(
      resolveLoadoutModifiers(ship, loadout.id),
    );
  });

  it("ignores abilities without a real-time effect", () => {
    expect(campaignPilotModifiers(ship, null, ["no_such_ability"])).toEqual(
      combineEffects([]),
    );
  });
});
