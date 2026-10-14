/**
 * ArmoryPanel — the hub's Armory tab: the eight campaign-only modifications
 * (two per slot) as tabs OVERVIEW / EFFECTS / COST; click a mod to install
 * it or, when installed, to refund it. The free RESPEC button lives in the
 * hub. Layout and drawing are shared with the Research panel
 * (OptionTabsPanel); the data comes from armoryModel.
 */

import type Phaser from "phaser";
import { ARMORY_MODS, type ArmoryMod } from "../../data/campaign/armory";
import type { DetailTabId } from "../menu/detailTabsModel";
import { armoryModel } from "./armoryModel";
import {
  createOptionTabsPanel,
  type OptionTabsView,
} from "./OptionTabsPanel";

/** Fine print under the overview. */
const ARMORY_FOOTER =
  "Click a mod to install it. Click an installed mod to refund it.";

/** Inputs of the panel. */
export interface ArmoryPanelConfig {
  readonly credits: number;
  /** Installed mod ids with the price paid for each. */
  readonly installed: Readonly<Record<string, number>>;
  readonly accent: number;
  readonly tab: DetailTabId;
  readonly showKeyHint: boolean;
  readonly onSelectTab: (tab: DetailTabId) => void;
  readonly onToggle: (mod: ArmoryMod) => void;
}

/**
 * @param scene - Owning scene.
 * @param config - Credits, installed mods, open tab, accent and callbacks.
 * @returns The panel and its focus targets.
 */
export function createArmoryPanel(
  scene: Phaser.Scene,
  config: ArmoryPanelConfig,
): OptionTabsView {
  return createOptionTabsPanel(scene, {
    model: armoryModel({
      credits: config.credits,
      installed: config.installed,
    }),
    screen: "campaignArmory",
    tab: config.tab,
    accent: config.accent,
    footer: ARMORY_FOOTER,
    showKeyHint: config.showKeyHint,
    onSelectTab: config.onSelectTab,
    onAction: (id) => {
      const mod = ARMORY_MODS.find((m) => m.id === id);
      if (mod) config.onToggle(mod);
    },
  });
}
