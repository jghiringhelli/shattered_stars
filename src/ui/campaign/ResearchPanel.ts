/**
 * ResearchPanel — the hub's Research tab: one row per tier with its two
 * mutually exclusive options as tabs OVERVIEW / EFFECTS / COST. Locked tiers
 * show the research points still needed; a chosen tier shows CHOSEN for good;
 * an open tier needs a confirming second click (choices are permanent).
 * Layout and drawing are shared with the Armory panel (OptionTabsPanel); the
 * data comes from researchModel.
 */

import type Phaser from "phaser";
import {
  RESEARCH_TREE,
  type ResearchPick,
  type ResearchTier,
} from "../../data/campaign/research";
import type { DetailTabId } from "../menu/detailTabsModel";
import {
  createOptionTabsPanel,
  type OptionTabsView,
} from "./OptionTabsPanel";
import { researchModel } from "./researchModel";

/** Fine print under the overview. */
const RESEARCH_FOOTER =
  "Click an option to mark it, click again to confirm. Choices are permanent.";

/** Inputs of the panel. */
export interface ResearchPanelConfig {
  readonly points: number;
  readonly choices: Readonly<Record<string, ResearchPick>>;
  /** Option awaiting confirmation ("tierId:A"), if any. */
  readonly pending: string | null;
  readonly accent: number;
  readonly tab: DetailTabId;
  readonly showKeyHint: boolean;
  readonly onSelectTab: (tab: DetailTabId) => void;
  readonly onPick: (tier: ResearchTier, pick: ResearchPick) => void;
}

/**
 * @param scene - Owning scene.
 * @param config - Points, choices, pending pick, open tab, accent and callbacks.
 * @returns The panel and its focus targets.
 */
export function createResearchPanel(
  scene: Phaser.Scene,
  config: ResearchPanelConfig,
): OptionTabsView {
  return createOptionTabsPanel(scene, {
    model: researchModel({
      points: config.points,
      choices: config.choices,
      pending: config.pending,
    }),
    screen: "campaignResearch",
    tab: config.tab,
    accent: config.accent,
    footer: RESEARCH_FOOTER,
    showKeyHint: config.showKeyHint,
    onSelectTab: config.onSelectTab,
    onAction: (key) => {
      const [tierId, pick] = key.split(":");
      const tier = RESEARCH_TREE.find((t) => t.id === tierId);
      if (tier && (pick === "A" || pick === "B")) config.onPick(tier, pick);
    },
  });
}
