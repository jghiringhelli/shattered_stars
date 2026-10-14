/**
 * Spec: DetailTabs shows one tab at a time; each screen has its own tab set,
 * the last tab used on a screen is remembered for the session, tabs step
 * with Q / E / LB / RB / left / right (wrapping) and every tab explains
 * itself from the tooltip catalog.
 */

import { beforeEach, describe, it, expect } from "vitest";
import { TERM_CATALOG } from "../../../../src/data/tooltips";
import {
  DETAIL_TAB_SETS,
  recallTab,
  resetRememberedTabs,
  rememberTab,
  stepTab,
  tabsFor,
  TAB_KEY_HINT,
} from "../../../../src/ui/menu/detailTabsModel";

const ids = (screen: Parameters<typeof tabsFor>[0]): string[] =>
  tabsFor(screen).map((tab) => tab.id);

describe("detail tab sets", () => {
  it("ship picker: overview, stats, loadout, pilot, builds", () => {
    expect(ids("shipPicker")).toEqual([
      "overview",
      "stats",
      "loadout",
      "pilot",
      "builds",
    ]);
  });

  it("survival starter: overview, loadout, builds", () => {
    expect(ids("survivalStarter")).toEqual(["overview", "loadout", "builds"]);
  });

  it("campaign armory: overview, effects, cost", () => {
    expect(ids("campaignArmory")).toEqual(["overview", "effects", "cost"]);
  });

  it("encyclopedia ship: overview, stats, loadout, lore", () => {
    expect(ids("encyclopediaShip")).toEqual([
      "overview",
      "stats",
      "loadout",
      "lore",
    ]);
  });

  it("every screen starts on overview", () => {
    for (const screen of Object.keys(DETAIL_TAB_SETS) as Array<
      keyof typeof DETAIL_TAB_SETS
    >)
      expect(ids(screen)[0], screen).toBe("overview");
  });

  it("every tab has an icon, a label and a catalog tooltip", () => {
    for (const screen of Object.keys(DETAIL_TAB_SETS) as Array<
      keyof typeof DETAIL_TAB_SETS
    >)
      for (const tab of tabsFor(screen)) {
        expect(tab.label.trim(), tab.id).not.toBe("");
        expect(tab.icon, tab.id).toBeTruthy();
        expect(TERM_CATALOG[tab.term], tab.term).toBeDefined();
      }
  });
});

describe("remembered tab", () => {
  beforeEach(() => resetRememberedTabs());

  it("defaults to the first tab", () => {
    expect(recallTab("shipPicker")).toBe("overview");
  });

  it("remembers the last tab used on a screen", () => {
    rememberTab("shipPicker", "builds");
    expect(recallTab("shipPicker")).toBe("builds");
  });

  it("remembers each screen separately", () => {
    rememberTab("shipPicker", "pilot");
    expect(recallTab("campaignArmory")).toBe("overview");
  });

  it("falls back to the first tab when the remembered one is not on the screen", () => {
    rememberTab("survivalStarter", "pilot");
    expect(recallTab("survivalStarter")).toBe("overview");
  });
});

describe("stepTab", () => {
  const tabs = tabsFor("shipPicker");

  it("moves forward and backward", () => {
    expect(stepTab(tabs, "stats", 1)).toBe("loadout");
    expect(stepTab(tabs, "stats", -1)).toBe("overview");
  });

  it("wraps around at both ends", () => {
    expect(stepTab(tabs, "builds", 1)).toBe("overview");
    expect(stepTab(tabs, "overview", -1)).toBe("builds");
  });

  it("keeps the same tab when it is not in the set", () => {
    expect(stepTab(tabs, "lore", 1)).toBe("overview");
  });
});

describe("key hint", () => {
  it("names the keyboard and gamepad keys that switch tabs", () => {
    expect(TAB_KEY_HINT).toContain("Q");
    expect(TAB_KEY_HINT).toContain("E");
    expect(TAB_KEY_HINT).toContain("LB");
    expect(TAB_KEY_HINT).toContain("RB");
  });
});
