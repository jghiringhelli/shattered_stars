/**
 * quickBuildDetails — what a quick build really is: pilot, ability (card
 * text + real-time reading), the slot bar it fills and each upgrade's
 * real-time reading.
 */

import { describe, it, expect } from "vitest";
import {
  describeQuickBuild,
  fillSlotBar,
  pilotSlotBar,
  summarizePilotAbility,
  summarizeUpgrade,
} from "../../../src/data/quickBuildDetails";
import { summarizeRealtimeEffect } from "../../../src/data/realtimeEffectSummary";
import { PILOT_ABILITY_REALTIME } from "../../../src/data/pilotAbilityEffects";
import { slotBarFor } from "../../../src/data/ShipSlots";
import {
  SHIP_LOADOUTS,
  type ShipLoadout,
} from "../../../src/data/ShipLoadouts";
import { PILOT_CARDS } from "../../../src/systems/SquadBuilder";
import { UPGRADE_DEFINITIONS } from "../../../src/systems/UpgradeSystem";

const FANG = "corsair_fang";
const POISON_FANG = PILOT_CARDS.poison_fang!;

/** A Poison Fang build with known contents (independent of catalogue edits). */
function fangBuild(overrides: Partial<ShipLoadout> = {}): ShipLoadout {
  return {
    id: "test_fang",
    name: "Test Fang",
    shipId: FANG,
    pilotId: "poison_fang",
    upgrades: ["predator", "hull_upgrade"],
    pointCost: 42,
    description: "test build",
    role: "offense",
    ...overrides,
  };
}

describe("pilotSlotBar", () => {
  it("is the ship's bar plus the pilot's extra slots", () => {
    const bar = pilotSlotBar(FANG, POISON_FANG);
    expect(bar.map((slot) => slot.type)).toEqual(
      slotBarFor(FANG, POISON_FANG.extraSlots, POISON_FANG.removedSlots),
    );
  });

  it("marks exactly the pilot's extra slots as pilot slots", () => {
    const bar = pilotSlotBar(FANG, POISON_FANG);
    const fromPilot = bar.filter((slot) => slot.fromPilot);
    expect(fromPilot.map((slot) => slot.type)).toEqual(
      POISON_FANG.extraSlots ?? [],
    );
  });

  it("without a pilot it is the bare ship's bar", () => {
    expect(pilotSlotBar(FANG).map((slot) => slot.type)).toEqual(
      slotBarFor(FANG),
    );
  });

  it("a removed slot comes off the ship's own slots first", () => {
    const bar = pilotSlotBar(FANG, {
      extraSlots: ["talent"],
      removedSlots: ["talent"],
    });
    expect(bar.filter((slot) => slot.type === "talent")).toEqual([
      { type: "talent", fromPilot: true },
    ]);
  });
});

describe("fillSlotBar", () => {
  const bar = [
    { type: "talent", fromPilot: false },
    { type: "modification", fromPilot: false },
    { type: "talent", fromPilot: true },
  ] as const;

  it("each upgrade takes the first free slot of its category", () => {
    const filled = fillSlotBar(bar, ["predator", "hull_upgrade"]);
    expect(filled.map((slot) => slot.upgradeId)).toEqual([
      "predator",
      "hull_upgrade",
      null,
    ]);
  });

  it("a second card of a category takes the next slot", () => {
    const filled = fillSlotBar(bar, ["predator", "marksman"]);
    expect(filled.map((slot) => slot.upgradeId)).toEqual([
      "predator",
      null,
      "marksman",
    ]);
  });

  it("names the card in its slot", () => {
    expect(fillSlotBar(bar, ["predator"])[0]!.upgradeName).toBe(
      UPGRADE_DEFINITIONS.predator!.name,
    );
  });

  it("ignores unknown cards and cards with no free slot", () => {
    const filled = fillSlotBar(bar, ["no_such_card", "concussion_missile"]);
    expect(filled.every((slot) => slot.upgradeId === null)).toBe(true);
  });
});

describe("summarizeUpgrade", () => {
  it("reads a card's real-time effect", () => {
    expect(summarizeUpgrade(UPGRADE_DEFINITIONS.predator!)).toBe(
      summarizeRealtimeEffect(UPGRADE_DEFINITIONS.predator!.realtime!),
    );
  });

  it("reads stat bonuses", () => {
    expect(summarizeUpgrade(UPGRADE_DEFINITIONS.hull_upgrade!)).toBe("+1 hull");
  });

  it("reads a secondary weapon's damage, reload and homing", () => {
    const text = summarizeUpgrade(UPGRADE_DEFINITIONS.concussion_missile!);
    expect(text).toContain("3 dmg every 4s");
    expect(text).toContain("homing");
  });
});

describe("summarizePilotAbility", () => {
  it("is the ability's real-time reading", () => {
    expect(summarizePilotAbility("ambush")).toBe(
      summarizeRealtimeEffect(PILOT_ABILITY_REALTIME.ambush!),
    );
  });

  it("is empty for an ability with no real-time effect", () => {
    expect(summarizePilotAbility("no_such_ability")).toBe("");
  });
});

describe("describeQuickBuild", () => {
  it("names the pilot with initiative and uniqueness", () => {
    expect(describeQuickBuild(fangBuild()).pilot).toEqual({
      id: "poison_fang",
      name: "Poison Fang",
      initiative: POISON_FANG.initiative,
      isUnique: true,
    });
  });

  it("describes the ability: name, card text and real-time summary", () => {
    const { ability } = describeQuickBuild(fangBuild());
    expect(ability).toEqual({
      id: "ambush",
      name: "Ambush",
      cardText: POISON_FANG.abilityText,
      summary: "+1 laser dmg from behind the target",
    });
  });

  it("a generic pilot has no ability", () => {
    expect(
      describeQuickBuild(fangBuild({ pilotId: "fang_raider" })).ability,
    ).toBeNull();
  });

  it("an unknown pilot is reported as none", () => {
    const details = describeQuickBuild(fangBuild({ pilotId: "nobody" }));
    expect(details.pilot).toBeNull();
    expect(details.ability).toBeNull();
  });

  it("lists every upgrade with its slot and real-time summary", () => {
    expect(describeQuickBuild(fangBuild()).upgrades).toEqual([
      {
        id: "predator",
        name: "Predator",
        slotType: "talent",
        summary: "+1 laser dmg vs unshielded targets",
      },
      {
        id: "hull_upgrade",
        name: "Hull Upgrade",
        slotType: "modification",
        summary: "+1 hull",
      },
    ]);
  });

  it("carries the loadout's derived price", () => {
    expect(describeQuickBuild(fangBuild()).pointCost).toBe(42);
  });

  it("every catalogue build fills one slot per upgrade", () => {
    for (const loadout of Object.values(SHIP_LOADOUTS).flat()) {
      const filled = describeQuickBuild(loadout).slots.filter(
        (slot) => slot.upgradeId !== null,
      );
      expect(filled.length, loadout.id).toBe(loadout.upgrades.length);
    }
  });
});
