/**
 * detailTabsModel — the tab sets of the pick screens' detail panels, the
 * tab remembered per screen for the session and the stepping rule. One tab
 * is visible at a time (progressive disclosure). Pure: no Phaser.
 */

import type { TermId } from "../../data/tooltips";
import type { MenuIconName } from "./MenuIcons";

/** Every tab any screen offers. */
export type DetailTabId =
  | "overview"
  | "stats"
  | "loadout"
  | "pilot"
  | "builds"
  | "effects"
  | "cost"
  | "match"
  | "abilities"
  | "lore";

/** One tab of the bar. */
export interface DetailTab {
  readonly id: DetailTabId;
  readonly label: string;
  readonly icon: MenuIconName;
  /** Catalog term that explains the tab on hover. */
  readonly term: TermId;
}

/** Screens that have a tabbed detail panel. */
export type DetailScreen =
  | "shipPicker"
  | "survivalStarter"
  | "campaignArmory"
  | "campaignResearch"
  | "campaignSquad"
  | "encyclopediaShip"
  | "duelSetup"
  | "raidSetup"
  | "heroCard";

const TAB_DEFS: Readonly<Record<DetailTabId, DetailTab>> = {
  overview: { id: "overview", label: "OVERVIEW", icon: "eye", term: "ui.tab_overview" },
  stats: { id: "stats", label: "STATS", icon: "crosshair", term: "ui.tab_stats" },
  loadout: { id: "loadout", label: "LOADOUT", icon: "gear", term: "ui.tab_loadout" },
  pilot: { id: "pilot", label: "PILOT", icon: "star", term: "ui.tab_pilot" },
  builds: { id: "builds", label: "BUILDS", icon: "fleet", term: "ui.tab_builds" },
  effects: { id: "effects", label: "EFFECTS", icon: "shield", term: "ui.tab_effects" },
  cost: { id: "cost", label: "COST", icon: "key", term: "ui.tab_cost" },
  match: { id: "match", label: "MATCH", icon: "dogfight", term: "ui.tab_match" },
  abilities: { id: "abilities", label: "ABILITIES", icon: "star", term: "ui.tab_abilities" },
  lore: { id: "lore", label: "LORE", icon: "book", term: "ui.tab_lore" },
};

/** The tabs each screen offers, in bar order. */
export const DETAIL_TAB_SETS: Readonly<Record<DetailScreen, readonly DetailTabId[]>> = {
  shipPicker: ["overview", "stats", "loadout", "pilot", "builds"],
  survivalStarter: ["overview", "loadout", "builds"],
  campaignArmory: ["overview", "effects", "cost"],
  campaignResearch: ["overview", "effects", "cost"],
  campaignSquad: ["overview", "stats", "loadout", "pilot"],
  encyclopediaShip: ["overview", "stats", "loadout", "lore"],
  duelSetup: ["overview", "stats", "builds", "match"],
  raidSetup: ["overview", "abilities", "match"],
  heroCard: ["overview", "effects", "lore"],
};

/** Key hint shown beside the tab bar. */
export const TAB_KEY_HINT = "Q / E  \u00b7  LB / RB";

/**
 * @param screen - A screen with a tabbed detail panel.
 * @returns Its tabs in bar order.
 */
export function tabsFor(screen: DetailScreen): readonly DetailTab[] {
  return DETAIL_TAB_SETS[screen].map((id) => TAB_DEFS[id]);
}

/** Last tab used per screen (this session only). */
const remembered = new Map<DetailScreen, DetailTabId>();

/**
 * @param screen - A screen.
 * @param tab - The tab the player just opened.
 */
export function rememberTab(screen: DetailScreen, tab: DetailTabId): void {
  remembered.set(screen, tab);
}

/**
 * @param screen - A screen.
 * @returns The remembered tab, or the first tab when none (or one the screen lacks).
 */
export function recallTab(screen: DetailScreen): DetailTabId {
  const tabs = DETAIL_TAB_SETS[screen];
  const last = remembered.get(screen);
  return last && tabs.includes(last) ? last : tabs[0]!;
}

/** Forgets every remembered tab (tests). */
export function resetRememberedTabs(): void {
  remembered.clear();
}

/**
 * @param tabs - The screen's tabs.
 * @param active - The open tab.
 * @param direction - +1 next, -1 previous.
 * @returns The neighbouring tab id, wrapping at the ends.
 */
export function stepTab(
  tabs: readonly DetailTab[],
  active: DetailTabId,
  direction: 1 | -1,
): DetailTabId {
  const index = tabs.findIndex((tab) => tab.id === active);
  const next = (index + direction + tabs.length) % tabs.length;
  return tabs[next]!.id;
}
