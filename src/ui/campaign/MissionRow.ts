/**
 * MissionRow — a mission entry on the campaign mission map: number badge,
 * title, optional branch tag and a status chip. Only the currently
 * available mission is selectable.
 */

import type Phaser from "phaser";
import type { CampaignMission } from "../../data/CampaignData";
import { drawHoloFrame } from "../menu/holoChrome";
import { HOLO_PALETTE, HOLO_RADIUS, HOLO_SPACING } from "../theme/HoloTheme";
import { SelectableCard } from "./SelectableCard";
import { CAMPAIGN_TEXT, addCaptionChip, addHoloText } from "./campaignUi";
import type { MissionStatus } from "./campaignProgress";

/** Per-status chip text and colours. */
const STATUS_STYLE: Readonly<
  Record<MissionStatus, { label: string; tint: number; dim: boolean }>
> = {
  completed: { label: "✓ COMPLETE", tint: HOLO_PALETTE.success, dim: false },
  not_taken: { label: "NOT TAKEN", tint: HOLO_PALETTE.textMuted, dim: true },
  available: { label: "AVAILABLE", tint: HOLO_PALETTE.accent, dim: false },
  locked: { label: "LOCKED", tint: HOLO_PALETTE.textMuted, dim: true },
};

/** Row layout (local to the row centre). */
export const MISSION_ROW_LAYOUT = {
  height: 52,
  branchHeight: 64,
  badgeSize: 32,
  badgeX: 16,
  titleX: 64,
  tagOffsetY: -12,
  titleOffsetY: 8,
  titleSize: 16,
  dimBorderAlpha: 0.35,
  completedBorderAlpha: 0.55,
  availableFillAlpha: 0.1,
  badgeFillAlpha: 0.18,
} as const;

/** Mission row options. */
export interface MissionRowConfig {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly mission: CampaignMission;
  readonly status: MissionStatus;
  /** Faction accent. */
  readonly accent: number;
  /** Branch-choice card (taller, shows the branch tag). */
  readonly branch?: boolean;
}

/**
 * Build a mission row.
 *
 * @param scene - Owning scene.
 * @param config - Position, size, mission and status.
 * @param onSelect - Invoked when the available mission is chosen.
 * @returns The row card.
 */
export function createMissionRow(
  scene: Phaser.Scene,
  config: MissionRowConfig,
  onSelect: () => void,
): SelectableCard {
  const L = MISSION_ROW_LAYOUT;
  const { status, accent } = config;
  const style = STATUS_STYLE[status];
  const available = status === "available";
  const height = config.branch === true ? L.branchHeight : L.height;
  const card = new SelectableCard(
    scene,
    config.x,
    config.y,
    {
      width: config.width,
      height,
      accent,
      ...rowIdleLook(status, accent),
    },
    available ? onSelect : undefined,
  );
  const tint = available ? accent : style.tint;
  card.add(createBadge(scene, card.left + L.badgeX, config.mission, tint));
  card.add(createRowTitle(scene, card, config, style.dim));
  card.add(
    addCaptionChip(
      scene,
      card.right - HOLO_SPACING.lg,
      0,
      style.label,
      available ? accent : style.tint,
    ),
  );
  return card;
}

/**
 * @param mission - A mission.
 * @returns Its card tag: style and story day ("ESCORT · DAY 52").
 */
function missionTag(mission: CampaignMission): string | undefined {
  const style = mission.style?.toUpperCase();
  if (mission.day === undefined) return style;
  return style ? `${style} · DAY ${mission.day}` : `DAY ${mission.day}`;
}

function rowIdleLook(
  status: MissionStatus,
  accent: number,
): {
  idleBorder: number;
  idleBorderAlpha: number;
  idleFill?: { color: number; alpha: number };
} {
  const L = MISSION_ROW_LAYOUT;
  if (status === "available") {
    return {
      idleBorder: accent,
      idleBorderAlpha: 1,
      idleFill: { color: accent, alpha: L.availableFillAlpha },
    };
  }
  if (status === "completed") {
    return {
      idleBorder: HOLO_PALETTE.success,
      idleBorderAlpha: L.completedBorderAlpha,
    };
  }
  return { idleBorder: HOLO_PALETTE.border, idleBorderAlpha: L.dimBorderAlpha };
}

function createBadge(
  scene: Phaser.Scene,
  left: number,
  mission: CampaignMission,
  tint: number,
): Phaser.GameObjects.Container {
  const size = MISSION_ROW_LAYOUT.badgeSize;
  const frame = scene.add.graphics();
  drawHoloFrame(
    frame,
    { x: 0, y: -size / 2, width: size, height: size },
    {
      accent: tint,
      fill: tint,
      fillAlpha: MISSION_ROW_LAYOUT.badgeFillAlpha,
      radius: HOLO_RADIUS.sm,
    },
  );
  const label = addHoloText(scene, size / 2, 0, `${mission.missionNumber}`, {
    ...CAMPAIGN_TEXT.numeric,
    size: 14,
  }).setOrigin(0.5);
  return scene.add.container(left, 0, [frame, label]);
}

function createRowTitle(
  scene: Phaser.Scene,
  card: SelectableCard,
  config: MissionRowConfig,
  dim: boolean,
): Phaser.GameObjects.Container {
  const L = MISSION_ROW_LAYOUT;
  const x = card.left + L.titleX;
  const tag =
    config.branch === true
      ? config.mission.branchTag
      : missionTag(config.mission);
  const titleY = tag !== undefined ? L.titleOffsetY : 0;
  const title = addHoloText(scene, x, titleY, config.mission.title, {
    size: L.titleSize,
    weight: config.status === "available" ? "600" : "400",
    color: dim ? HOLO_PALETTE.textMuted : HOLO_PALETTE.textPrimary,
  }).setOrigin(0, 0.5);
  const parts: Phaser.GameObjects.GameObject[] = [title];
  if (tag !== undefined) {
    const tagTint =
      config.status === "available"
        ? HOLO_PALETTE.warning
        : HOLO_PALETTE.textMuted;
    parts.push(
      addHoloText(scene, x, L.tagOffsetY, tag.toUpperCase(), {
        ...CAMPAIGN_TEXT.caption,
        color: config.status === "completed" ? HOLO_PALETTE.success : tagTint,
      }).setOrigin(0, 0.5),
    );
  }
  return scene.add.container(0, 0, parts);
}
