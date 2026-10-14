/**
 * campaignTabsModel — which campaign panels carry detail tabs on each hub
 * tab, which tab set each one uses and which panel the Q / E keys drive.
 * Pure: no Phaser.
 */

import type { DetailScreen, DetailTabId } from "../menu/detailTabsModel";

/** Hub tabs (mirrors the hub's tab strip). */
export type HubTabName = "missions" | "armory" | "research" | "chronicle";

/** The tabbed panels of the hub: the Armory / Research panel, the hero card, the squad panel. */
export type TabPanelId = "main" | "hero" | "squad";

/**
 * @param hub - Open hub tab.
 * @returns The tabbed panels on screen (the main panel only on Armory / Research).
 */
export function tabPanelsFor(hub: HubTabName): readonly TabPanelId[] {
  return hub === "armory" || hub === "research"
    ? ["main", "hero", "squad"]
    : ["hero", "squad"];
}

/**
 * @param panel - A tabbed panel.
 * @param hub - Open hub tab.
 * @returns Its tab-set id, or null when the panel is not tabbed on this hub tab.
 */
export function screenOfPanel(
  panel: TabPanelId,
  hub: HubTabName,
): DetailScreen | null {
  if (panel === "hero") return "heroCard";
  if (panel === "squad") return "campaignSquad";
  if (hub === "armory") return "campaignArmory";
  return hub === "research" ? "campaignResearch" : null;
}

/**
 * @param hub - Open hub tab.
 * @returns The panel Q / E drive until the player touches another one.
 */
export function defaultTabPanel(hub: HubTabName): TabPanelId {
  return tabPanelsFor(hub)[0]!;
}

/**
 * @param touched - Panel the player last used (null when none).
 * @param hub - Open hub tab.
 * @returns That panel while it is on screen, else the default one.
 */
export function resolveActivePanel(
  touched: TabPanelId | null,
  hub: HubTabName,
): TabPanelId {
  return touched !== null && tabPanelsFor(hub).includes(touched)
    ? touched
    : defaultTabPanel(hub);
}

/** Tab state the hub hands to its tabbed panels. */
export interface CampaignPanelTabs {
  /** Panel the Q / E keys drive. */
  readonly active: TabPanelId;
  /** @returns The open tab of a panel. */
  readonly tabOf: (panel: TabPanelId) => DetailTabId;
  /** Opens a tab of a panel (and makes the panel the active one). */
  readonly onSelect: (panel: TabPanelId, tab: DetailTabId) => void;
  /** Squad pilot inspected on the squad panel's Stats / Loadout / Pilot tabs (null: the first). */
  readonly pilotId: string | null;
  readonly onSelectPilot: (pilotId: string) => void;
}
