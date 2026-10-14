import { describe, it, expect } from "vitest";
import {
  eventCards,
  metaUnlockCards,
  powerCards,
  relicCard,
  relicCards,
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
    expect(card.description).not.toContain("[");
    expect(card.chips?.map((chip) => chip.label)).toEqual(["mark", "crit"]);
    expect(card.note).toBe("Hunter 2/3 · synergy ×1");
  });

  it("explains each relic tag with a definition and an example", () => {
    const card = relicCard(getRelic("predator_optics")!, []);
    for (const chip of card.chips ?? []) {
      expect(chip.tip.title).toContain(chip.label);
      expect(chip.tip.body!.length).toBeGreaterThan(20);
      expect(chip.tip.example!.length).toBeGreaterThan(10);
    }
  });

  it("explains the relic card with its role, set bonus and rarity", () => {
    const card = relicCard(getRelic("predator_optics")!, []);
    expect(card.tip).toMatchObject({ title: "Predator Optics" });
    expect(card.tip?.role).toBeTruthy();
    expect(card.tip?.howItPlays).toContain("marked targets");
    expect(card.noteTip?.title).toContain("Hunter");
  });

  it("explains a shop price and its item kind", () => {
    const cards = shopCards(shopStock(RunBuilder.aRun().build(), "s1-r2-c0"));
    expect(cards[0]!.noteTip?.title).toBe("Price");
    expect(cards[0]!.tip?.example).toBeTruthy();
  });

  it("gives every card of every choice overlay a tooltip, and every note one too", () => {
    const run = RunBuilder.aRun().build();
    const all = [
      ...powerCards(ATOMS.slice(0, 3), 1),
      ...relicCards([getRelic("predator_optics")!], run),
      ...shopCards(shopStock(run, "s1-r2-c0")),
      ...eventCards(getEvent("corsair_toll")!, run),
      ...metaUnlockCards({ ...emptyMeta(), charts: 100 }),
    ];
    for (const card of all) {
      if (card.name === "Close") continue;
      expect(card.tip, card.name).toBeDefined();
      if (card.note) expect(card.noteTip, `${card.name} note`).toBeDefined();
    }
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

  it("reports the wing: escorts lost over the run (free wingman included)", () => {
    const run = RunBuilder.aRun()
      .with({
        status: "defeat",
        cause: "Shot down",
        stats: { ...RunBuilder.aRun().build().stats, escortsLost: 2 },
      })
      .build();
    const summary = summarizeRun(run, Date.UTC(2026, 9, 11));
    expect(summary.escortsLost).toBe(2);
    expect(summaryLines(summary).join("\n")).toContain("Escorts lost 2");
  });

  it("reads older history entries without an escort count as none lost", () => {
    const run = RunBuilder.aRun().with({ status: "defeat" }).build();
    const { escortsLost: _dropped, ...old } = summarizeRun(run, 0);
    expect(summaryLines(old).join("\n")).toContain("Escorts lost 0");
  });
});
