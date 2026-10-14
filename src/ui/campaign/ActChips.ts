/**
 * ActChips — the hub's act strip: one chip per act of the campaign showing
 * done / open / locked, and the lock reason of the act being viewed. Chips
 * are buttons that switch the mission board to that act. Presentation only.
 */

import type Phaser from "phaser";
import {
  actNumeral,
  type ActState,
  type ActStatus,
} from "../../campaign/chronicle/actUnlocks";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { CAMPAIGN_TEXT, addCaptionChip, addHoloText } from "./campaignUi";

/** Strip layout (screen px). */
export const ACT_CHIPS_LAYOUT = {
  x: 32,
  y: 604,
  gap: 28,
  reasonY: 624,
  reasonWidth: 640,
  reasonSize: 12,
} as const;

/** Chip wording by state. */
const STATE_LABEL: Readonly<Record<ActState, string>> = {
  complete: "DONE",
  open: "OPEN",
  locked: "LOCKED",
};

/** Inputs for {@link createActChips}. */
export interface ActChipsConfig {
  readonly statuses: readonly ActStatus[];
  /** The act the board shows. */
  readonly viewedAct: number;
  readonly accent: number;
  readonly onSelectAct: (act: number) => void;
}

/**
 * @param state - An act state.
 * @param accent - Faction accent.
 * @returns The chip tint.
 */
function tintOf(state: ActState, accent: number): number {
  if (state === "complete") return HOLO_PALETTE.success;
  if (state === "open") return accent;
  return HOLO_PALETTE.textMuted;
}

/**
 * @param scene - Owning scene.
 * @param config - Statuses, viewed act and callback.
 * @returns The chips and the viewed act's lock reason (when locked).
 */
export function createActChips(
  scene: Phaser.Scene,
  config: ActChipsConfig,
): Phaser.GameObjects.GameObject[] {
  const L = ACT_CHIPS_LAYOUT;
  const objects: Phaser.GameObjects.GameObject[] = [];
  let x = L.x;
  for (const status of config.statuses) {
    const label = `ACT ${actNumeral(status.act)} · ${STATE_LABEL[status.state]}`;
    const chip = addCaptionChip(
      scene,
      x,
      L.y,
      status.act === config.viewedAct ? `▸ ${label}` : label,
      tintOf(status.state, config.accent),
      "center",
    );
    const { width, height } = chip.getBounds();
    chip.setName(`act_chip_${status.act}`).setX(x + width / 2);
    chip
      .setSize(width, height)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => config.onSelectAct(status.act));
    x += width + L.gap;
    objects.push(chip);
  }
  const viewed = config.statuses.find((s) => s.act === config.viewedAct);
  if (viewed?.reason) {
    const reason = addHoloText(scene, L.x, L.reasonY, viewed.reason, {
      ...CAMPAIGN_TEXT.body,
      size: L.reasonSize,
      color: HOLO_PALETTE.warning,
      wrapWidth: L.reasonWidth,
    });
    reason.setName("act_lock_reason");
    objects.push(reason);
  }
  return objects;
}
