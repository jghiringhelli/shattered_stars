/**
 * Spec: the Armory and Research panels show ONE data set per tab —
 * overview (what is there and its state), effects (what each does) and cost
 * (what it takes) — built from plain view-models with tooltips on every row.
 */

import { describe, expect, it } from "vitest";
import { armoryModel } from "../../../src/ui/campaign/armoryModel";
import { researchModel } from "../../../src/ui/campaign/researchModel";
import type { OptionPanelModel } from "../../../src/ui/campaign/optionPanelTypes";

const allCards = (model: OptionPanelModel) =>
  model.groups.flatMap((group) => group.cards);

describe("armoryModel", () => {
  const model = armoryModel({
    credits: 160,
    installed: { capacitor_array: 150 },
  });

  it("groups the eight mods by slot, two per slot", () => {
    expect(model.groups.map((g) => g.caption)).toEqual([
      "HULL",
      "SHIELDS",
      "WEAPONS",
      "SYSTEMS",
    ]);
    expect(allCards(model)).toHaveLength(8);
    expect(model.groups.every((g) => g.cards.length === 2)).toBe(true);
  });

  it("marks only the installed mod on the overview", () => {
    const marks = allCards(model).filter((card) => card.mark !== "");
    expect(marks.map((card) => card.name)).toEqual(["Capacitor Array"]);
    expect(marks[0]?.mark).toContain("INSTALLED");
  });

  it("dims what the player cannot pay for, counting the refund of a swap", () => {
    const byName = (name: string) =>
      allCards(model).find((card) => card.name === name)!;
    expect(byName("Overcharged Cannons").dim).toBe(true);
    expect(byName("Reinforced Bulkheads").dim).toBe(false);
    expect(byName("Regenerative Emitters").dim).toBe(false);
  });

  it("states cost and the missing credits on the cost tab", () => {
    const cost = (name: string) =>
      model.costs.find((row) => row.text.startsWith(name))!.text;
    expect(cost("Capacitor Array")).toContain("150 CR");
    expect(cost("Capacitor Array")).toContain("INSTALLED");
    expect(cost("Overcharged Cannons")).toContain("NEED 100 MORE");
    expect(cost("Reinforced Bulkheads")).toContain("AFFORDABLE");
  });

  it("summarises credits and the refund of everything installed", () => {
    expect(model.summary[0]?.text).toContain("CREDITS 160");
    expect(model.summary[0]?.text).toContain("INSTALLED 150 CR");
  });

  it("gives every effect and cost row a tooltip", () => {
    expect(model.effects).toHaveLength(8);
    for (const row of [...model.effects, ...model.costs, ...model.summary])
      expect(row.tip).toBeDefined();
  });
});

describe("researchModel", () => {
  it("opens only the tiers whose points are earned", () => {
    const model = researchModel({ points: 3, choices: {}, pending: null });
    expect(model.groups).toHaveLength(4);
    expect(model.groups[0]?.cards.map((c) => c.actionKey)).toEqual([
      "hull_doctrine:A",
      "hull_doctrine:B",
    ]);
    expect(model.groups[1]?.caption).toContain("LOCKED (6 POINTS)");
    expect(model.groups[1]?.cards.every((c) => c.actionKey === null)).toBe(
      true,
    );
    expect(model.groups[1]?.cards.every((c) => c.dim)).toBe(true);
  });

  it("marks the chosen option and closes the other", () => {
    const model = researchModel({
      points: 3,
      choices: { hull_doctrine: "B" },
      pending: null,
    });
    const [a, b] = model.groups[0]!.cards;
    expect(b?.mark).toContain("CHOSEN");
    expect(a?.dim).toBe(true);
    expect(a?.actionKey).toBeNull();
  });

  it("asks for a confirming click on the pending option", () => {
    const model = researchModel({
      points: 3,
      choices: {},
      pending: "hull_doctrine:A",
    });
    expect(model.groups[0]?.cards[0]?.mark).toContain("CONFIRM");
  });

  it("lists one cost row per tier and the points earned", () => {
    const model = researchModel({ points: 3, choices: {}, pending: null });
    expect(model.costs).toHaveLength(4);
    expect(model.costs[0]?.text).toContain("OPEN");
    expect(model.costs[1]?.text).toContain("NEED 3 MORE");
    expect(model.summary[0]?.text).toContain("POINTS EARNED 3");
    expect(model.effects).toHaveLength(8);
  });
});
