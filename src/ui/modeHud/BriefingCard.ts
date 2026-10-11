/**
 * BriefingCard — the mission briefing shown as the battle opens: a centred
 * HoloPanel with the mission title, briefing text and objectives. Not
 * interactive (no zoom constraint); it fades out and removes itself.
 */

import Phaser from "phaser";
import type { FactionId } from "../../config";
import { HOLO_PALETTE, HOLO_SPACING, holoTextStyle } from "../theme/HoloTheme";
import { HoloPanel } from "../hud/HoloPanel";
import { BONUS_PREFIX, type TrackedObjective } from "./objectiveRows";

/** Card width (px). */
const CARD_WIDTH = 560;
/** Card centre as a fraction of the screen height. */
const CARD_Y_FRACTION = 0.4;
/** How long the card is readable, then how long it fades (ms). */
export const BRIEFING_HOLD_MS = 5000;
const BRIEFING_FADE_MS = 600;
/** Bullet marking each objective line. */
const OBJECTIVE_BULLET = "▸ ";

/** The mission fields a briefing shows. */
export interface BriefingMission {
  readonly act: number;
  readonly missionNumber: number;
  readonly title: string;
  readonly briefing: string;
  readonly objectives: readonly TrackedObjective[];
  readonly newMechanic?: string | undefined;
}

/**
 * Build the briefing card, already fading on a timer.
 *
 * @param scene - Owning scene.
 * @param faction - Player faction (accent).
 * @param mission - The mission briefed.
 * @returns The card (a HoloPanel container; add it to a screen-space root).
 */
export function createBriefingCard(
  scene: Phaser.Scene,
  faction: FactionId,
  mission: BriefingMission,
): HoloPanel {
  const lines = briefingLines(scene, mission);
  const contentHeight = lines.reduce(
    (sum, line) => sum + line.height + HOLO_SPACING.sm,
    0,
  );
  const panel = new HoloPanel(
    scene,
    scene.scale.width / 2,
    scene.scale.height * CARD_Y_FRACTION,
    {
      width: CARD_WIDTH,
      height: contentHeight + HOLO_SPACING.xxl * 2,
      faction,
      title: `Briefing · Act ${mission.act} · Mission ${mission.missionNumber}`,
    },
  );
  scene.add.existing(panel);
  let y = panel.contentTop;
  for (const line of lines) {
    line.setPosition(0, y);
    y += line.height + HOLO_SPACING.sm;
  }
  panel.add(lines);
  scene.tweens.add({
    targets: panel,
    alpha: 0,
    delay: BRIEFING_HOLD_MS,
    duration: BRIEFING_FADE_MS,
    onComplete: () => panel.destroy(),
  });
  return panel;
}

function briefingLines(
  scene: Phaser.Scene,
  mission: BriefingMission,
): Phaser.GameObjects.Text[] {
  const wrap = { width: CARD_WIDTH - HOLO_SPACING.xl * 2 };
  const text = (
    content: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text =>
    scene.add
      .text(0, 0, content, { ...style, wordWrap: wrap, align: "center" })
      .setOrigin(0.5, 0);
  const lines = [
    text(mission.title.toUpperCase(), holoTextStyle("title")),
    text(mission.briefing, holoTextStyle("body", HOLO_PALETTE.textSecondary)),
  ];
  for (const objective of mission.objectives) {
    const prefix = objective.optional ? BONUS_PREFIX : "";
    lines.push(
      text(
        `${OBJECTIVE_BULLET}${prefix}${objective.description}`,
        holoTextStyle("body"),
      ),
    );
  }
  if (mission.newMechanic) {
    lines.push(
      text(
        `NEW · ${mission.newMechanic.toUpperCase()}`,
        holoTextStyle("caption", HOLO_PALETTE.accent),
      ),
    );
  }
  return lines;
}
