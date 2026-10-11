import { describe, it, expect } from "vitest";
import {
  eventCards,
  metaUnlockCards,
  powerCards,
  relicCard,
  shopCards,
} from "../../../../src/ui/survival/choiceViewModels";
import {
  statusLines,
  fleetLines,
  buildLines,
} from "../../../../src/ui/survival/runStatusText";
import {
  historyRow,
  summaryLines,
  summaryTitle,
} from "../../../../src/ui/survival/runSummaryText";
import { getRelic } from "../../../../src/data/survival/relicCatalog";
import { getEvent } from "../../../../src/data/survival/events";
import { ATOMS } from "../../../../src/data/survival/powers";
import { shopStock } from "../../../../src/systems/survival/ShopService";
import { emptyMeta } from "../../../../src/systems/survival/MetaProgression";
import { summarizeRun } from "../../../../src/systems/survival/RunHistory";
import { RunBuilder } from "../../systems/survival/survivalRunBuilder";

describe("choice view models", () => {
  it("adds a reroll card (disabled without charges) and a skip card to drafts", () => {
    const cards = powerCards(ATOMS.slice(0, 3), 0);
    expect(cards).toHaveLength(5);
    expect(cards[3]).toMatchObject({
      name: "Reroll draft",
      disabled: true,
      note: "0 left",
    });
    expect(cards[4]!.name).toBe("Skip");
    expect(powerCards(ATOMS.slice(0, 3), 2)[3]!.disabled).toBe(false);
  });

  it("shows a relic's tags, archetype progress and synergies", () => {
    const card = relicCard(getRelic("predator_optics")!, ["target_painter"]);
    expect(card.description).toContain("[mark]");
    expect(card.note).toBe("Hunter 2/3 · synergy ×1");
  });

  it("locks faction options and shows costs on event cards", () => {
    const cards = eventCards(
      getEvent("corsair_toll")!,
      RunBuilder.aRun().build(),
    );
    expect(cards[0]!.note).toBe("-30 ⚙");
    expect(cards[2]).toMatchObject({
      disabled: true,
      note: "Void Corsairs only",
    });
  });

  it("lists shop prices, reasons and a leave card", () => {
    const cards = shopCards(shopStock(RunBuilder.aRun().build(), "s1-r2-c0"));
    expect(cards.at(-1)!.name).toBe("Leave shop");
    expect(cards[0]).toMatchObject({ disabled: true, note: "Hull intact" });
  });

  it("prices meta unlocks and marks prerequisites", () => {
    const cards = metaUnlockCards({ ...emptyMeta(), charts: 100 });
    expect(cards.find((c) => c.name === "Twin Wing Package")).toMatchObject({
      disabled: true,
      note: "Locked",
    });
    expect(cards.find((c) => c.name === "War Chest")).toMatchObject({
      disabled: false,
      note: "35 ★",
    });
  });
});

describe("map side panel and summary text", () => {
  it("shows sector, seed, ascension, salvage, fleet hull and relic tags", () => {
    const run = RunBuilder.aRun()
      .withAscension(2)
      .with({
        relics: ["wing_link"],
        flagship: {
          definitionId: "terran_viper",
          loadoutId: null,
          hull: 0.42,
          shields: 1,
          upgrades: 1,
        },
      })
      .build();
    expect(statusLines(run)[0]).toContain("SECTOR 1/3");
    expect(statusLines(run)[1]).toContain("Ascension 2");
    expect(fleetLines(run)[0]).toContain("Lv1");
    expect(fleetLines(run)[0]).toContain("42%");
    expect(buildLines(run)[0]).toContain("[wingman, escort]");
  });

  it("summarizes a defeat with its cause and lists it in the history", () => {
    const run = RunBuilder.aRun()
      .with({
        status: "defeat",
        cause: "Destroyed by the boss",
        relics: ["wing_link"],
      })
      .build();
    const summary = summarizeRun(run, Date.UTC(2026, 9, 11));
    expect(summaryTitle(summary)).toBe("DEFEAT — Destroyed by the boss");
    expect(summaryLines(summary).join("\n")).toContain("Wing Link");
    expect(summaryLines(summary).join("\n")).toContain("Squadron ×1");
    expect(historyRow(summary, 0)).toContain("2026-10-11");
  });
});
