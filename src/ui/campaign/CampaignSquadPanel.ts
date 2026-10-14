/**
 * CampaignSquadPanel — right-hand sidebar of the mission map: campaign
 * totals (XP, credits, kills) and the squadron roster with portraits.
 */

import type Phaser from "phaser";
import type { FactionId } from "../../config";
import type {
  CampaignPilotState,
  CampaignSaveData,
} from "../../systems/CampaignSaveManager";
import { getPilotDefinition } from "../../systems/CampaignPilotManager";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import { shipDisplayName } from "../idLabels";
import { drawHoloFrame } from "../menu/holoChrome";
import { HOLO_PALETTE, HOLO_RADIUS } from "../theme/HoloTheme";
import { CAMPAIGN_TEXT, addHoloText } from "./campaignUi";

/** Sidebar layout (screen coordinates). */
export const SQUAD_PANEL_LAYOUT = {
  right: 1248,
  top: 104,
  width: 264,
  headerHeight: 28,
  padding: 12,
  statRowHeight: 24,
  panelGap: 16,
  pilotRowHeight: 64,
  pilotRowGap: 8,
  thumbWidth: 40,
  thumbHeight: 60,
  textGap: 12,
  skillHigh: 5,
  skillMid: 3,
} as const;

/** Fallback portrait texture. */
const DEFAULT_PORTRAIT = "portrait_command";

/**
 * Build the stats + squadron sidebar.
 *
 * @param scene - Owning scene.
 * @param factionId - Campaign faction.
 * @param save - Campaign save.
 * @param accent - Faction accent.
 * @returns The created panels (one or two).
 */
export function createCampaignSidebar(
  scene: Phaser.Scene,
  factionId: FactionId,
  save: CampaignSaveData,
  accent: number,
): HoloPanel[] {
  const L = SQUAD_PANEL_LAYOUT;
  const stats = createStatsPanel(scene, save, accent);
  const panels = [stats];
  if (save.campaignPilots.length > 0) {
    const top = L.top + stats.height + L.panelGap;
    panels.push(createSquadPanel(scene, factionId, save, accent, top));
  }
  return panels;
}

function createStatsPanel(
  scene: Phaser.Scene,
  save: CampaignSaveData,
  accent: number,
): HoloPanel {
  const L = SQUAD_PANEL_LAYOUT;
  const rows = [
    { label: "XP", value: save.totalXp.toString() },
    { label: "Credits", value: save.credits.toString() },
    { label: "Research", value: (save.researchPoints ?? 0).toString() },
    { label: "Kills", value: save.totalKills.toString() },
  ];
  const height = L.headerHeight + L.padding * 2 + rows.length * L.statRowHeight;
  const panel = createHoloPanel(
    scene,
    L.right - L.width / 2,
    L.top + height / 2,
    { width: L.width, height, accentColor: accent, title: "STATS" },
  );
  panel.setSize(L.width, height);
  const left = -L.width / 2 + L.padding;
  rows.forEach((row, i) => {
    const y = panel.contentTop + (i + 0.5) * L.statRowHeight;
    panel.add([
      addHoloText(scene, left, y, row.label.toUpperCase(), {
        ...CAMPAIGN_TEXT.caption,
      }).setOrigin(0, 0.5),
      addHoloText(scene, -left, y, row.value, {
        ...CAMPAIGN_TEXT.numeric,
        size: 15,
      }).setOrigin(1, 0.5),
    ]);
  });
  return panel;
}

function createSquadPanel(
  scene: Phaser.Scene,
  factionId: FactionId,
  save: CampaignSaveData,
  accent: number,
  top: number,
): HoloPanel {
  const L = SQUAD_PANEL_LAYOUT;
  const pilots = save.campaignPilots;
  const height =
    L.headerHeight +
    L.padding * 2 +
    pilots.length * L.pilotRowHeight +
    (pilots.length - 1) * L.pilotRowGap;
  const panel = createHoloPanel(
    scene,
    L.right - L.width / 2,
    top + height / 2,
    {
      width: L.width,
      height,
      accentColor: accent,
      title: "SQUADRON",
    },
  );
  panel.setSize(L.width, height);
  pilots.forEach((pilot, i) => {
    const rowTop = panel.contentTop + i * (L.pilotRowHeight + L.pilotRowGap);
    panel.add(createPilotEntry(scene, factionId, pilot, accent, rowTop));
  });
  return panel;
}

function skillColor(skill: number): number {
  const L = SQUAD_PANEL_LAYOUT;
  if (skill >= L.skillHigh) return HOLO_PALETTE.warning;
  if (skill >= L.skillMid) return HOLO_PALETTE.accent;
  return HOLO_PALETTE.textSecondary;
}

function createPilotEntry(
  scene: Phaser.Scene,
  factionId: FactionId,
  pilot: CampaignPilotState,
  accent: number,
  rowTop: number,
): Phaser.GameObjects.Container {
  const L = SQUAD_PANEL_LAYOUT;
  const def = getPilotDefinition(factionId, pilot.pilotId);
  const portraitKey = def?.portraitKey ?? DEFAULT_PORTRAIT;
  const left = -L.width / 2 + L.padding;
  const parts: Phaser.GameObjects.GameObject[] = [];
  if (scene.textures.exists(portraitKey)) {
    parts.push(
      scene.add
        .image(left + L.thumbWidth / 2, rowTop + L.thumbHeight / 2, portraitKey)
        .setDisplaySize(L.thumbWidth, L.thumbHeight),
    );
  }
  const frame = scene.add.graphics();
  drawHoloFrame(
    frame,
    { x: left, y: rowTop, width: L.thumbWidth, height: L.thumbHeight },
    { accent, fillAlpha: 0, radius: HOLO_RADIUS.sm },
  );
  const textX = left + L.thumbWidth + L.textGap;
  const textWidth = L.width / 2 - L.padding - textX;
  const callsign = def?.callsign ?? pilot.pilotId.toUpperCase();
  const shipName = shipDisplayName(pilot.currentShipId).toUpperCase();
  parts.push(
    frame,
    addHoloText(scene, textX, rowTop + 2, callsign, {
      size: 14,
      weight: "600",
    }),
    addHoloText(scene, textX, rowTop + 22, `SKILL ${pilot.pilotSkill}`, {
      ...CAMPAIGN_TEXT.caption,
      color: skillColor(pilot.pilotSkill),
    }),
    addHoloText(scene, textX, rowTop + 40, shipName, {
      ...CAMPAIGN_TEXT.caption,
      size: 10,
      color: HOLO_PALETTE.textMuted,
      wrapWidth: textWidth,
    }),
  );
  return scene.add.container(0, 0, parts);
}
