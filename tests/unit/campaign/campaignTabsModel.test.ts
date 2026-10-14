/**
 * Spec: which campaign panels carry detail tabs on each hub tab, which tab
 * set each uses and which panel the Q / E keys drive.
 */

import { describe, expect, it } from "vitest";
import {
  defaultTabPanel,
  resolveActivePanel,
  screenOfPanel,
  tabPanelsFor,
} from "../../../src/ui/campaign/campaignTabsModel";

describe("campaign tab panels", () => {
  it("shows the main panel only on the armory and research hub tabs", () => {
    expect(tabPanelsFor("armory")).toEqual(["main", "hero", "squad"]);
    expect(tabPanelsFor("research")).toEqual(["main", "hero", "squad"]);
    expect(tabPanelsFor("missions")).toEqual(["hero", "squad"]);
    expect(tabPanelsFor("chronicle")).toEqual(["hero", "squad"]);
  });

  it("maps each panel to its tab set", () => {
    expect(screenOfPanel("main", "armory")).toBe("campaignArmory");
    expect(screenOfPanel("main", "research")).toBe("campaignResearch");
    expect(screenOfPanel("main", "missions")).toBeNull();
    expect(screenOfPanel("hero", "missions")).toBe("heroCard");
    expect(screenOfPanel("squad", "armory")).toBe("campaignSquad");
  });

  it("drives the main panel by default, else the hero card", () => {
    expect(defaultTabPanel("armory")).toBe("main");
    expect(defaultTabPanel("missions")).toBe("hero");
  });

  it("keeps the last touched panel while it exists on the hub tab", () => {
    expect(resolveActivePanel("squad", "armory")).toBe("squad");
    expect(resolveActivePanel("main", "missions")).toBe("hero");
    expect(resolveActivePanel(null, "research")).toBe("main");
  });
});
