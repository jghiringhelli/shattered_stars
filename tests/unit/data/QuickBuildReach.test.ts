/**
 * Quick-build reach — specification tests: battles fly quick builds only,
 * so every pilot card and every upgrade card must appear in at least one
 * equippable quick build (one the pickers offer: it carries at least one
 * card) that is legal and affordable in a mode where its ship can fly.
 */

import { describe, it, expect } from "vitest";
import { PILOT_CARDS } from "../../../src/systems/SquadBuilder";
import { UPGRADE_DEFINITIONS } from "../../../src/systems/UpgradeSystem";
import { SHIP_DEFINITIONS } from "../../../src/data/ShipDefinitions";
import { slotBarFor } from "../../../src/data/ShipSlots";
import {
  findDeadCards,
  findLoadoutViolations,
} from "../../../src/data/loadoutRules";
import {
  buildsFlyingCard,
  buildsFlyingPilot,
  modeLimitFor,
  offeredQuickBuilds,
} from "../../../src/data/quickBuildIndex";

describe("quick-build reach", () => {
  it("flies every pilot card in at least one offered quick build", () => {
    const grounded = Object.keys(PILOT_CARDS).filter(
      (pilotId) => buildsFlyingPilot(pilotId).length === 0,
    );
    expect(grounded).toEqual([]);
  });

  it("flies every upgrade card in at least one offered quick build", () => {
    const shelved = Object.keys(UPGRADE_DEFINITIONS).filter(
      (cardId) => buildsFlyingCard(cardId).length === 0,
    );
    expect(shelved).toEqual([]);
  });

  it("keeps every offered build legal, live and affordable where its ship flies", () => {
    const problems = offeredQuickBuilds().flatMap((build) => {
      const ship = SHIP_DEFINITIONS[build.shipId]!;
      const pilot = PILOT_CARDS[build.pilotId];
      const slots = slotBarFor(
        build.shipId,
        pilot?.extraSlots,
        pilot?.removedSlots,
      );
      const issues = [
        ...findLoadoutViolations(build.upgrades, ship, slots).map(
          (v) => `${v.upgradeId} (${v.reason})`,
        ),
        ...findDeadCards(build.upgrades, ship).map((id) => `${id} (dead)`),
      ];
      if (build.pointCost > modeLimitFor(build.shipId))
        issues.push("over limit");
      return issues.map((issue) => `${build.id}: ${issue}`);
    });
    expect(problems).toEqual([]);
  });

  it("lets huge ships fly in the Epic format and every other hull in a standard squad", () => {
    expect(modeLimitFor("terran_dominator")).toBe(500);
    expect(modeLimitFor("terran_viper")).toBe(200);
  });
});
