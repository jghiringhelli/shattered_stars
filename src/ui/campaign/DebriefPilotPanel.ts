/**
 * DebriefPilotPanel — "PILOT PROGRESSION" HoloPanel of the debrief: one row
 * per pilot (ship thumbnail, callsign, skill chip, animated XP gauge and a
 * level-up callout).
 */

import type Phaser from "phaser";
import type { CampaignPilotState } from "../../systems/CampaignSaveManager";
import {
  getPilotDefinition,
  type LevelUpEvent,
} from "../../systems/CampaignPilotManager";
import { xpProgress } from "./campaignProgress";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import { drawHoloFrame, drawHoloGauge } from "../menu/holoChrome";
import { drawMenuIcon } from "../menu/MenuIcons";
import { HOLO_PALETTE, HOLO_RADIUS } from "../theme/HoloTheme";
import { CAMPAIGN_TEXT, addCaptionChip, addHoloText } from "./campaignUi";
import { STATS_LAYOUT, type DebriefSceneData } from "./debriefTypes";

/** Pilot row internals (local to the row's top-left). */
const PILOT_ROW = {
  thumbSize: 48,
  textX: 64,
  nameY: 4,
  chipY: 12,
  gaugeY: 32,
  gaugeHeight: 8,
  xpY: 46,
  levelUpY: 66,
  nameSize: 15,
  levelUpSize: 12,
  iconScale: 0.55,
} as const;

/** XP animation timing. */
const XP_ANIMATION = {
  durationMs: 1200,
  staggerMs: 200,
  settleMs: 200,
  blinkAlpha: 0.4,
  blinkMs: 700,
  blinkRepeats: 3,
} as const;

/** Built pilot panel and how long its animations run. */
export interface PilotPanelResult {
  readonly panel: HoloPanel;
  readonly animationMs: number;
}

/**
 * Build the pilot-progression panel and start its XP animations.
 *
 * @param scene - Owning scene.
 * @param top - Panel top edge (screen y).
 * @param height - Panel height.
 * @param accent - Faction accent (gauge colour).
 * @param data - Debrief data (pre/post saves, level-ups).
 * @returns The panel and total animation time.
 */
export function createPilotProgressPanel(
  scene: Phaser.Scene,
  top: number,
  height: number,
  accent: number,
  data: DebriefSceneData,
): PilotPanelResult {
  const L = STATS_LAYOUT;
  const panel = createHoloPanel(
    scene,
    L.rightX + L.width / 2,
    top + height / 2,
    {
      width: L.width,
      height,
      accentColor: accent,
      title: "PILOT PROGRESSION",
    },
  );
  const pilots = data.updatedSave.campaignPilots;
  const rowTop = -height / 2 + L.headerHeight + L.padding;
  const left = -L.width / 2 + L.padding;
  if (pilots.length === 0) {
    panel.add(
      addHoloText(scene, left, rowTop, "No pilots assigned", {
        ...CAMPAIGN_TEXT.body,
        color: HOLO_PALETTE.textMuted,
      }),
    );
  }
  pilots.forEach((pilot, i) => {
    const row = scene.add.container(
      left,
      rowTop + i * (L.pilotRowHeight + L.rowGap),
    );
    panel.add(row);
    buildPilotRow(scene, row, pilot, data);
    animateRow(scene, row, pilot, data, { accent, index: i });
  });
  const animationMs =
    Math.max(0, pilots.length - 1) * XP_ANIMATION.staggerMs +
    XP_ANIMATION.durationMs +
    XP_ANIMATION.settleMs;
  return { panel, animationMs };
}

function rowWidth(): number {
  return STATS_LAYOUT.width - STATS_LAYOUT.padding * 2;
}

function buildPilotRow(
  scene: Phaser.Scene,
  row: Phaser.GameObjects.Container,
  pilot: CampaignPilotState,
  data: DebriefSceneData,
): void {
  const R = PILOT_ROW;
  const def = getPilotDefinition(data.factionId, pilot.pilotId);
  const name = def ? (def.callsign ?? def.displayName) : pilot.pilotId;
  row.add(createShipThumb(scene, pilot.currentShipId));
  row.add([
    addHoloText(scene, R.textX, R.nameY, name.toUpperCase(), {
      size: R.nameSize,
      weight: "600",
      letterSpacing: 1,
    }),
    addCaptionChip(
      scene,
      rowWidth(),
      R.chipY,
      `SKILL ${pilot.pilotSkill}`,
      HOLO_PALETTE.textSecondary,
    ),
  ]);
}

function createShipThumb(
  scene: Phaser.Scene,
  shipId: string,
): Phaser.GameObjects.GameObject[] {
  const size = PILOT_ROW.thumbSize;
  const frame = scene.add.graphics();
  drawHoloFrame(
    frame,
    { x: 0, y: 0, width: size, height: size },
    { radius: HOLO_RADIUS.sm },
  );
  const key = `ship_${shipId}`;
  if (!scene.textures.exists(key)) {
    drawMenuIcon(
      frame,
      "fleet",
      { x: size / 2, y: size / 2 },
      size * PILOT_ROW.iconScale,
      HOLO_PALETTE.textMuted,
    );
    return [frame];
  }
  const image = scene.add.image(size / 2, size / 2, key);
  const scale = (size - HOLO_RADIUS.md) / Math.max(image.width, image.height);
  image.setScale(scale);
  return [frame, image];
}

function animateRow(
  scene: Phaser.Scene,
  row: Phaser.GameObjects.Container,
  pilot: CampaignPilotState,
  data: DebriefSceneData,
  style: { readonly accent: number; readonly index: number },
): void {
  const R = PILOT_ROW;
  const prePilot = data.preMissionSave.campaignPilots.find(
    (p) => p.pilotId === pilot.pilotId,
  );
  const xp = xpProgress(prePilot?.xp ?? 0, pilot);
  const gauge = scene.add.graphics();
  const rect = {
    x: R.textX,
    y: R.gaugeY,
    width: rowWidth() - R.textX,
    height: R.gaugeHeight,
  };
  drawHoloGauge(gauge, rect, xp.preRatio, style.accent);
  const xpText = addHoloText(scene, R.textX, R.xpY, `${xp.preXp} XP`, {
    ...CAMPAIGN_TEXT.caption,
    color: HOLO_PALETTE.textMuted,
  });
  row.add([gauge, xpText]);
  scene.tweens.addCounter({
    from: xp.preRatio,
    to: xp.postRatio,
    duration: XP_ANIMATION.durationMs,
    ease: "Cubic.easeOut",
    delay: style.index * XP_ANIMATION.staggerMs,
    onUpdate: (tween) => {
      gauge.clear();
      drawHoloGauge(gauge, rect, tween.getValue() ?? 0, style.accent);
      const shown = xp.preXp + (xp.postXp - xp.preXp) * tween.progress;
      xpText.setText(`${Math.floor(shown)} XP`);
    },
    onComplete: () => {
      xpText.setText(`${xp.postXp} XP`);
      showLevelUp(scene, row, pilot, data.levelUpEvents);
    },
  });
}

function showLevelUp(
  scene: Phaser.Scene,
  row: Phaser.GameObjects.Container,
  pilot: CampaignPilotState,
  levelUpEvents: readonly LevelUpEvent[],
): void {
  const events = levelUpEvents.filter((e) => e.pilotId === pilot.pilotId);
  if (events.length === 0 || !row.scene) return;
  const abilities = events
    .map((e) => e.newAbilityId.replace(/_/g, " ").toUpperCase())
    .join(", ");
  const text = addHoloText(
    scene,
    PILOT_ROW.textX,
    PILOT_ROW.levelUpY,
    `★ LEVEL UP!  Skill ${pilot.pilotSkill}  —  New: ${abilities}`,
    {
      size: PILOT_ROW.levelUpSize,
      weight: "600",
      letterSpacing: 1,
      color: HOLO_PALETTE.warning,
      wrapWidth: rowWidth() - PILOT_ROW.textX,
    },
  );
  row.add(text);
  scene.tweens.add({
    targets: text,
    alpha: XP_ANIMATION.blinkAlpha,
    duration: XP_ANIMATION.blinkMs,
    yoyo: true,
    repeat: XP_ANIMATION.blinkRepeats,
    ease: "Sine.easeInOut",
  });
}
