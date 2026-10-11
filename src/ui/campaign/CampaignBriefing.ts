/**
 * CampaignBriefing — mission briefing panels: briefing text with the
 * protagonist portrait, objectives, enemy intel + rewards and the
 * available-ships strip. All panels carry the faction accent.
 */

import type Phaser from "phaser";
import type { FactionId } from "../../config";
import type { CampaignMission } from "../../data/CampaignData";
import { CAMPAIGN_PILOTS } from "../../data/PilotData";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import { drawHoloFrame } from "../menu/holoChrome";
import { HOLO_PALETTE, HOLO_RADIUS } from "../theme/HoloTheme";
import { CAMPAIGN_TEXT, addCaptionChip, addHoloText } from "./campaignUi";

/** Briefing layout (screen coordinates). */
export const BRIEFING_LAYOUT = {
  left: 32,
  width: 1216,
  columnGap: 16,
  briefingTop: 104,
  briefingHeight: 180,
  detailTop: 300,
  detailHeight: 180,
  shipsTop: 496,
  shipsHeight: 88,
  padding: 16,
  /** HoloPanel header strip height. */
  headerHeight: 28,
  portraitWidth: 80,
  portraitHeight: 120,
  portraitGap: 24,
  bodySize: 15,
  lineSpacing: 6,
  objectiveRowHeight: 28,
  bulletRadius: 4,
  bulletTextGap: 16,
  intelRowHeight: 24,
  chipGap: 8,
} as const;

/** Fallback portrait texture. */
const DEFAULT_PORTRAIT = "portrait_command";

/** Inputs for {@link createBriefingPanels}. */
export interface BriefingConfig {
  readonly factionId: FactionId;
  readonly mission: CampaignMission;
  readonly accent: number;
}

/**
 * Build every briefing panel.
 *
 * @param scene - Owning scene.
 * @param config - Faction, mission and accent.
 * @returns The panels, top to bottom.
 */
export function createBriefingPanels(
  scene: Phaser.Scene,
  config: BriefingConfig,
): HoloPanel[] {
  return [
    createBriefingPanel(scene, config),
    createObjectivesPanel(scene, config),
    createIntelPanel(scene, config),
    createShipsPanel(scene, config),
  ];
}

function panelAt(
  scene: Phaser.Scene,
  rect: { x: number; y: number; width: number; height: number },
  accent: number,
  title: string,
): HoloPanel {
  return createHoloPanel(
    scene,
    rect.x + rect.width / 2,
    rect.y + rect.height / 2,
    { width: rect.width, height: rect.height, accentColor: accent, title },
  );
}

function halfWidth(): number {
  const L = BRIEFING_LAYOUT;
  return (L.width - L.columnGap) / 2;
}

function createBriefingPanel(
  scene: Phaser.Scene,
  config: BriefingConfig,
): HoloPanel {
  const L = BRIEFING_LAYOUT;
  const panel = panelAt(
    scene,
    { x: L.left, y: L.briefingTop, width: L.width, height: L.briefingHeight },
    config.accent,
    "BRIEFING",
  );
  const left = -L.width / 2 + L.padding;
  const top = panel.contentTop + HOLO_RADIUS.sm;
  addProtagonistPortrait(scene, panel, config, { x: left, y: top });
  const textX = left + L.portraitWidth + L.portraitGap;
  const text = addHoloText(scene, textX, top, config.mission.briefing, {
    size: L.bodySize,
    color: HOLO_PALETTE.textPrimary,
    wrapWidth: L.width / 2 - L.padding - textX,
    lineSpacing: L.lineSpacing,
  });
  panel.add(text);
  return panel;
}

function addProtagonistPortrait(
  scene: Phaser.Scene,
  panel: HoloPanel,
  config: BriefingConfig,
  topLeft: { x: number; y: number },
): void {
  const L = BRIEFING_LAYOUT;
  const pilots = CAMPAIGN_PILOTS[config.factionId];
  const protagonist = pilots.find((p) => p.role === "protagonist") ?? pilots[0];
  if (!protagonist) return;
  const key = scene.textures.exists(protagonist.portraitKey)
    ? protagonist.portraitKey
    : DEFAULT_PORTRAIT;
  const image = scene.add
    .image(
      topLeft.x + L.portraitWidth / 2,
      topLeft.y + L.portraitHeight / 2,
      key,
    )
    .setDisplaySize(L.portraitWidth, L.portraitHeight);
  const frame = scene.add.graphics();
  drawHoloFrame(
    frame,
    { ...topLeft, width: L.portraitWidth, height: L.portraitHeight },
    { accent: config.accent, fillAlpha: 0, radius: HOLO_RADIUS.sm },
  );
  panel.add([image, frame]);
}

function createObjectivesPanel(
  scene: Phaser.Scene,
  config: BriefingConfig,
): HoloPanel {
  const L = BRIEFING_LAYOUT;
  const width = halfWidth();
  const panel = panelAt(
    scene,
    { x: L.left, y: L.detailTop, width, height: L.detailHeight },
    config.accent,
    "OBJECTIVES",
  );
  const left = -width / 2 + L.padding;
  const bullets = scene.add.graphics();
  panel.add(bullets);
  config.mission.objectives.forEach((obj, i) => {
    const y = panel.contentTop + (i + 0.5) * L.objectiveRowHeight;
    const tint = obj.optional ? HOLO_PALETTE.textMuted : HOLO_PALETTE.success;
    bullets.fillStyle(tint, 1);
    bullets.fillCircle(left + L.bulletRadius, y, L.bulletRadius);
    const label = obj.description + (obj.optional ? " (Optional)" : "");
    panel.add(
      addHoloText(scene, left + L.bulletTextGap, y, label, {
        ...CAMPAIGN_TEXT.body,
        color: obj.optional ? HOLO_PALETTE.textMuted : HOLO_PALETTE.textPrimary,
        wrapWidth: width - L.padding * 2 - L.bulletTextGap,
      }).setOrigin(0, 0.5),
    );
  });
  return panel;
}

function createIntelPanel(
  scene: Phaser.Scene,
  config: BriefingConfig,
): HoloPanel {
  const L = BRIEFING_LAYOUT;
  const width = halfWidth();
  const { mission } = config;
  const panel = panelAt(
    scene,
    {
      x: L.left + width + L.columnGap,
      y: L.detailTop,
      width,
      height: L.detailHeight,
    },
    config.accent,
    "ENEMY INTEL",
  );
  const left = -width / 2 + L.padding;
  const totalEnemies = mission.enemies.reduce((sum, e) => sum + e.count, 0);
  const lines = [
    `Expected hostiles: ${totalEnemies}`,
    mission.enemies.some((e) => e.isAce) ? "Warning: Ace pilot detected" : "",
    mission.enemies.some((e) => e.isBoss)
      ? "Warning: Capital ship detected"
      : "",
  ].filter((l) => l);
  lines.forEach((line, i) => {
    const warning = line.includes("Warning");
    panel.add(
      addHoloText(scene, left, panel.contentTop + i * L.intelRowHeight, line, {
        ...CAMPAIGN_TEXT.body,
        color: warning ? HOLO_PALETTE.warning : HOLO_PALETTE.textSecondary,
      }),
    );
  });
  addRewards(scene, panel, config, left);
  return panel;
}

function addRewards(
  scene: Phaser.Scene,
  panel: HoloPanel,
  config: BriefingConfig,
  left: number,
): void {
  const L = BRIEFING_LAYOUT;
  const bottom = L.detailHeight / 2 - L.padding;
  const { rewards } = config.mission;
  panel.add([
    addHoloText(scene, left, bottom - L.intelRowHeight * 2, "REWARDS", {
      ...CAMPAIGN_TEXT.caption,
      color: HOLO_PALETTE.success,
    }),
    addHoloText(
      scene,
      left,
      bottom - L.intelRowHeight,
      `XP: ${rewards.xp}  Credits: ${rewards.credits}`,
      { ...CAMPAIGN_TEXT.numeric, size: 15 },
    ),
  ]);
}

function createShipsPanel(
  scene: Phaser.Scene,
  config: BriefingConfig,
): HoloPanel {
  const L = BRIEFING_LAYOUT;
  const { mission } = config;
  const panel = panelAt(
    scene,
    { x: L.left, y: L.shipsTop, width: L.width, height: L.shipsHeight },
    config.accent,
    "AVAILABLE SHIPS",
  );
  const left = -L.width / 2 + L.padding;
  const rowY = L.headerHeight / 2;
  const sizeText = addHoloText(
    scene,
    left,
    rowY,
    `Squadron size: ${mission.maxSquadSize} ships`,
    { ...CAMPAIGN_TEXT.body },
  ).setOrigin(0, 0.5);
  panel.add(sizeText);
  let x = left + sizeText.width + L.portraitGap;
  for (const shipId of mission.playerShips) {
    const chip = addCaptionChip(
      scene,
      x,
      rowY,
      shipId.replace(/_/g, " "),
      config.accent,
      "left",
    );
    panel.add(chip);
    x += chip.getBounds().width + L.chipGap;
  }
  return panel;
}
