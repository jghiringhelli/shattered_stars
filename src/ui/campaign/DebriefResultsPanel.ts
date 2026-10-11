/**
 * DebriefResultsPanel — "MISSION RESULTS" HoloPanel of the debrief: one
 * tile per result (icon, caption label, large value).
 */

import type Phaser from "phaser";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import { drawHoloFrame } from "../menu/holoChrome";
import { drawMenuIcon, type MenuIconName } from "../menu/MenuIcons";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { CAMPAIGN_TEXT, addHoloText } from "./campaignUi";
import { STATS_LAYOUT } from "./debriefTypes";

/** One mission-result row. */
export interface ResultItem {
  readonly label: string;
  readonly value: string;
  readonly icon: MenuIconName;
  readonly tint: number;
}

/** Tile internals. */
const RESULT_TILE = {
  iconX: 28,
  iconSize: 22,
  labelX: 56,
  valueInset: 16,
  valueSize: 22,
  fillAlpha: 0.35,
  borderAlpha: 0.4,
} as const;

/**
 * Mission-result rows for the debrief numbers.
 *
 * @param stats - Kills, losses, XP, credits and (campaign v3) research.
 * @returns The result rows (a research row when research was reported).
 */
export function missionResultItems(stats: {
  readonly kills: number;
  readonly shipsLost: number;
  readonly xpEarned: number;
  readonly creditsEarned: number;
  readonly researchEarned?: number | undefined;
  readonly bonusObjectives?: readonly string[] | undefined;
}): ResultItem[] {
  const research: ResultItem[] =
    stats.researchEarned === undefined
      ? []
      : [
          {
            label: `RESEARCH · ${stats.bonusObjectives?.length ?? 0} BONUS`,
            value: `+${stats.researchEarned}`,
            icon: "network",
            tint: HOLO_PALETTE.shield,
          },
        ];
  return [
    {
      label: "ENEMY SHIPS DESTROYED",
      value: `${stats.kills}`,
      icon: "crosshair",
      tint: HOLO_PALETTE.success,
    },
    {
      label: "SHIPS LOST",
      value: `${stats.shipsLost}`,
      icon: "fleet",
      tint: HOLO_PALETTE.danger,
    },
    {
      label: "XP EARNED",
      value: `+${stats.xpEarned}`,
      icon: "star",
      tint: HOLO_PALETTE.accent,
    },
    {
      label: "CREDITS EARNED",
      value: `+${stats.creditsEarned}`,
      icon: "crown",
      tint: HOLO_PALETTE.warning,
    },
    ...research,
  ];
}

/**
 * Build the mission-results panel.
 *
 * @param scene - Owning scene.
 * @param top - Panel top edge (screen y).
 * @param height - Panel height.
 * @param accent - Faction accent.
 * @param items - Result rows.
 * @returns The panel.
 */
export function createResultsPanel(
  scene: Phaser.Scene,
  top: number,
  height: number,
  accent: number,
  items: readonly ResultItem[],
): HoloPanel {
  const L = STATS_LAYOUT;
  const panel = createHoloPanel(
    scene,
    L.leftX + L.width / 2,
    top + height / 2,
    {
      width: L.width,
      height,
      accentColor: accent,
      title: "MISSION RESULTS",
    },
  );
  const rowTop = -height / 2 + L.headerHeight + L.padding;
  items.forEach((item, i) => {
    const y = rowTop + i * (L.resultRowHeight + L.rowGap);
    panel.add(createResultTile(scene, y, item));
  });
  return panel;
}

function createResultTile(
  scene: Phaser.Scene,
  top: number,
  item: ResultItem,
): Phaser.GameObjects.Container {
  const L = STATS_LAYOUT;
  const width = L.width - L.padding * 2;
  const left = -width / 2;
  const centerY = L.resultRowHeight / 2;
  const g = scene.add.graphics();
  drawHoloFrame(
    g,
    { x: left, y: 0, width, height: L.resultRowHeight },
    { fillAlpha: RESULT_TILE.fillAlpha, borderAlpha: RESULT_TILE.borderAlpha },
  );
  drawMenuIcon(
    g,
    item.icon,
    { x: left + RESULT_TILE.iconX, y: centerY },
    RESULT_TILE.iconSize,
    item.tint,
  );
  const label = addHoloText(
    scene,
    left + RESULT_TILE.labelX,
    centerY,
    item.label,
    CAMPAIGN_TEXT.caption,
  ).setOrigin(0, 0.5);
  const value = addHoloText(
    scene,
    -left - RESULT_TILE.valueInset,
    centerY,
    item.value,
    { ...CAMPAIGN_TEXT.numeric, size: RESULT_TILE.valueSize },
  ).setOrigin(1, 0.5);
  return scene.add.container(0, top, [g, label, value]);
}
