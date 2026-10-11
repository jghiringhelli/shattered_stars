/**
 * CampaignMissionMap — the mission list panel of the campaign screen:
 * act heading strip, campaign progress gauge and one row per mission
 * (branch pairs side by side under a "choose your path" caption).
 */

import type Phaser from "phaser";
import type { CampaignMission, FactionCampaign } from "../../data/CampaignData";
import type { CampaignSaveData } from "../../systems/CampaignSaveManager";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import { drawHoloGauge } from "../menu/holoChrome";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { CAMPAIGN_TEXT, addHoloText } from "./campaignUi";
import { MISSION_ROW_LAYOUT, createMissionRow } from "./MissionRow";
import { currentActGroups } from "./campaignProgress";
import {
  availableMissions,
  hubMissionStatus,
  slotCount,
  ACT_LENGTH,
} from "../../campaign/hub/missionGraph";
import type { SelectableCard } from "./SelectableCard";

/** Act headings, indexed by act number. */
const ACT_NAMES = [
  "",
  "Act I: The Convergence",
  "Act II: Rising Tensions",
  "Act III: Galactic War",
  "Act IV: Ascendancy",
];

/** Mission panel layout (screen coordinates for x/top/width). */
export const MISSION_MAP_LAYOUT = {
  x: 32,
  top: 104,
  width: 640,
  headerHeight: 28,
  padding: 24,
  progressLabelHeight: 16,
  gaugeHeight: 6,
  progressGap: 8,
  rowsGap: 24,
  rowGap: 12,
  branchCaptionHeight: 20,
  branchCaptionGap: 8,
  branchColumnGap: 48,
} as const;

/** Inputs for {@link createMissionMapPanel}. */
export interface MissionMapConfig {
  readonly campaign: FactionCampaign;
  readonly save: CampaignSaveData;
  /** Faction accent colour. */
  readonly accent: number;
  readonly onSelectMission: (mission: CampaignMission) => void;
}

/** Built panel plus its keyboard-focusable rows. */
export interface MissionMapPanel {
  readonly panel: HoloPanel;
  readonly focusTargets: readonly SelectableCard[];
}

function groupHeight(group: readonly CampaignMission[]): number {
  const L = MISSION_MAP_LAYOUT;
  if (group.length === 1) return MISSION_ROW_LAYOUT.height;
  return (
    L.branchCaptionHeight + L.branchCaptionGap + MISSION_ROW_LAYOUT.branchHeight
  );
}

/**
 * Build the mission list panel.
 *
 * @param scene - Owning scene.
 * @param config - Campaign, save, accent and selection callback.
 * @returns The panel and its selectable rows.
 */
export function createMissionMapPanel(
  scene: Phaser.Scene,
  config: MissionMapConfig,
): MissionMapPanel {
  const L = MISSION_MAP_LAYOUT;
  const { campaign, save } = config;
  const groups = currentActGroups(campaign, hubActStart(campaign, save));
  const act = groups[0]?.[0]?.act ?? 1;
  const rowsHeight =
    groups.reduce((sum, g) => sum + groupHeight(g), 0) +
    Math.max(0, groups.length - 1) * L.rowGap;
  const progressHeight = L.progressLabelHeight + L.progressGap + L.gaugeHeight;
  const height =
    L.headerHeight + L.padding * 2 + progressHeight + L.rowsGap + rowsHeight;
  const panel = createHoloPanel(scene, L.x + L.width / 2, L.top + height / 2, {
    width: L.width,
    height,
    accentColor: config.accent,
    title: ACT_NAMES[act] ?? "Unknown Act",
  });
  const top = -height / 2 + L.headerHeight + L.padding;
  addProgress(scene, panel, top, campaign, save, config.accent);
  const focusTargets = addRows(
    scene,
    panel,
    top + progressHeight + L.rowsGap,
    groups,
    config,
  );
  return { panel, focusTargets };
}

/**
 * First mission slot of the act the hub shows: the earliest act with a
 * mission available now (the last act once the campaign is complete).
 *
 * @param campaign - Faction campaign.
 * @param save - Campaign save.
 * @returns A mission number inside that act.
 */
function hubActStart(
  campaign: FactionCampaign,
  save: CampaignSaveData,
): number {
  const open = availableMissions(campaign, save);
  const act =
    open.length > 0
      ? Math.min(...open.map((m) => m.act))
      : Math.max(...campaign.missions.map((m) => m.act));
  return (act - 1) * ACT_LENGTH + 1;
}

function addProgress(
  scene: Phaser.Scene,
  panel: HoloPanel,
  top: number,
  campaign: FactionCampaign,
  save: CampaignSaveData,
  accent: number,
): void {
  const L = MISSION_MAP_LAYOUT;
  const left = -L.width / 2 + L.padding;
  const innerWidth = L.width - L.padding * 2;
  const total = slotCount(campaign);
  const done = new Set(
    campaign.missions
      .filter((m) => save.completedMissions.includes(m.id))
      .map((m) => m.missionNumber),
  ).size;
  const label = addHoloText(
    scene,
    left,
    top,
    `Missions ${done} of ${total}`.toUpperCase(),
    CAMPAIGN_TEXT.caption,
  );
  const completed = addHoloText(
    scene,
    left + innerWidth,
    top,
    `${save.completedMissions.length} COMPLETE`,
    { ...CAMPAIGN_TEXT.caption, color: HOLO_PALETTE.textMuted },
  ).setOrigin(1, 0);
  const gauge = scene.add.graphics();
  drawHoloGauge(
    gauge,
    {
      x: left,
      y: top + L.progressLabelHeight + L.progressGap,
      width: innerWidth,
      height: L.gaugeHeight,
    },
    done / total,
    accent,
  );
  panel.add([gauge, label, completed]);
}

function addRows(
  scene: Phaser.Scene,
  panel: HoloPanel,
  top: number,
  groups: readonly CampaignMission[][],
  config: MissionMapConfig,
): SelectableCard[] {
  const L = MISSION_MAP_LAYOUT;
  const rowWidth = L.width - L.padding * 2;
  const cards: SelectableCard[] = [];
  let y = top;
  for (const group of groups) {
    if (group.length === 1) {
      const row = buildRow(scene, config, group[0]!, {
        x: 0,
        y: y + MISSION_ROW_LAYOUT.height / 2,
        width: rowWidth,
        branch: false,
      });
      cards.push(row);
      panel.add(row);
    } else {
      cards.push(...addBranchPair(scene, panel, y, group, config));
    }
    y += groupHeight(group) + L.rowGap;
  }
  return cards.filter((c) => c.enabled);
}

function buildRow(
  scene: Phaser.Scene,
  config: MissionMapConfig,
  mission: CampaignMission,
  place: { x: number; y: number; width: number; branch: boolean },
): SelectableCard {
  const { save } = config;
  return createMissionRow(
    scene,
    {
      ...place,
      mission,
      status: hubMissionStatus(mission, config.campaign, save),
      accent: config.accent,
    },
    () => config.onSelectMission(mission),
  );
}

function addBranchPair(
  scene: Phaser.Scene,
  panel: HoloPanel,
  top: number,
  group: readonly CampaignMission[],
  config: MissionMapConfig,
): SelectableCard[] {
  const L = MISSION_MAP_LAYOUT;
  const rowWidth = L.width - L.padding * 2;
  const cardWidth = (rowWidth - L.branchColumnGap) / 2;
  const cardY =
    top +
    L.branchCaptionHeight +
    L.branchCaptionGap +
    MISSION_ROW_LAYOUT.branchHeight / 2;
  const offset = (cardWidth + L.branchColumnGap) / 2;
  const caption = addHoloText(
    scene,
    0,
    top + L.branchCaptionHeight / 2,
    "⬡  CHOOSE YOUR PATH  ⬡",
    { ...CAMPAIGN_TEXT.caption, color: config.accent },
  ).setOrigin(0.5);
  const orLabel = addHoloText(scene, 0, cardY, "OR", {
    ...CAMPAIGN_TEXT.caption,
    color: HOLO_PALETTE.textMuted,
  }).setOrigin(0.5);
  const cards = [group[0]!, group[1]!].map((mission, i) =>
    buildRow(scene, config, mission, {
      x: i === 0 ? -offset : offset,
      y: cardY,
      width: cardWidth,
      branch: true,
    }),
  );
  panel.add([caption, orLabel, ...cards]);
  return cards;
}
