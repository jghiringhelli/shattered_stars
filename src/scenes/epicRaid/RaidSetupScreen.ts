/**
 * RaidSetupScreen — the Boss Raid briefing: a tab bar (OVERVIEW pick the
 * target and read its numbers, ABILITIES what the boss does, MATCH raid
 * difficulty) and BEGIN ASSAULT. Built as one container over the battle
 * scene at camera zoom 1; the owner rebuilds it after every choice.
 */

import Phaser from "phaser";
import { createHoloButton } from "../../ui/hud/HoloButton";
import { drawDetailTabs } from "../../ui/menu/DetailTabs";
import {
  recallTab,
  rememberTab,
  tabsFor,
  type DetailTabId,
} from "../../ui/menu/detailTabsModel";
import { attachTermTooltip } from "../../ui/menu/HintTooltip";
import {
  MENU_LAYOUT,
  addBackButton,
  addMenuHeader,
} from "../../ui/menu/MenuScaffold";
import { HOLO_DEPTH, HOLO_PALETTE } from "../../ui/theme/HoloTheme";
import {
  drawAbilitiesTab,
  drawMatchTab,
  drawTargetTab,
  type RaidSetupConfig,
} from "./raidSetupTabs";

export type { RaidSetupConfig } from "./raidSetupTabs";

/** Screen layout (px, 8 px grid). */
const LAYOUT = {
  tabsY: MENU_LAYOUT.contentTop,
  contentTop: 160,
  startWidth: 208,
  startHeight: 44,
} as const;
/** Backdrop opacity over the battle scene. */
const BACKDROP_ALPHA = 0.85;
/** The screen the tab bar belongs to. */
const SCREEN = "raidSetup";

/** @returns The tab the raid setup has open (remembered for the session). */
export function openRaidTab(): DetailTabId {
  return recallTab(SCREEN);
}

/** @param direction - +1 opens the next tab, -1 the previous one. */
export function stepRaidTab(direction: 1 | -1): void {
  const tabs = tabsFor(SCREEN);
  const index = tabs.findIndex((tab) => tab.id === openRaidTab());
  rememberTab(SCREEN, tabs[(index + direction + tabs.length) % tabs.length]!.id);
}

/**
 * Build the setup screen.
 *
 * @param config - Choices and callbacks.
 * @returns Root container (screen space); destroy it to dismiss the screen.
 */
export function buildRaidSetupScreen(
  config: RaidSetupConfig,
): Phaser.GameObjects.Container {
  const { scene } = config;
  const { width, height } = scene.scale;
  const backdrop = scene.add
    .rectangle(0, 0, width, height, 0x000000, BACKDROP_ALPHA)
    .setOrigin(0);
  const root = scene.add.container(0, 0, [backdrop]);
  const header = addMenuHeader(scene, {
    title: "Capital Assault",
    subtitle: "Destroy the enemy capital ship",
    accent: HOLO_PALETTE.danger,
  });
  root.add([
    header.title,
    ...(header.subtitle ? [header.subtitle] : []),
    header.rule,
    addBackButton(scene, config.onBack),
  ]);
  const tab = openRaidTab();
  drawDetailTabs(scene, root, {
    x: MENU_LAYOUT.margin,
    y: LAYOUT.tabsY,
    width: width - 2 * MENU_LAYOUT.margin,
    accent: HOLO_PALETTE.danger,
    tabs: tabsFor(SCREEN),
    active: tab,
    onSelect: (next) => {
      rememberTab(SCREEN, next);
      config.onSelectTab();
    },
  });
  const area = {
    scene,
    root,
    x: MENU_LAYOUT.margin,
    y: LAYOUT.contentTop,
    width: width - 2 * MENU_LAYOUT.margin,
  };
  if (tab === "abilities") drawAbilitiesTab(area, config);
  else if (tab === "match") drawMatchTab(area, config);
  else drawTargetTab(area, config);
  root.add(startButton(config, width / 2, height - MENU_LAYOUT.primaryInset));
  return root.setDepth(HOLO_DEPTH.menuPanel).setScrollFactor(0, 0, true);
}

function startButton(
  config: RaidSetupConfig,
  x: number,
  y: number,
): Phaser.GameObjects.Container {
  const button = createHoloButton(
    config.scene,
    x,
    y,
    {
      width: LAYOUT.startWidth,
      height: LAYOUT.startHeight,
      label: "Begin assault",
      variant: "primary",
    },
    config.onStart,
  );
  attachTermTooltip(config.scene, button, "raid.begin");
  return button;
}
