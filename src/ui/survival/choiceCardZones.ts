/**
 * Survival choice overlay — the hover parts of a card: tag texts beside the
 * name and invisible zones over a card's texts, each with its own tooltip.
 */

import type Phaser from "phaser";
import type { TooltipContent } from "../menu/tooltipContent";
import { addTipZone } from "../menu/tooltipTargets";
import { pickerTextStyle } from "../picker/pickerStyle";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import type { ChoiceChip } from "./choiceTips";
import type { HoloPanel } from "../hud/HoloPanel";

/** Gap between the name and its first tag, and between tags (px). */
const CHIP_GAP = 16;
/** Height of a hover zone over a name-row element (px). */
const ZONE_HEIGHT = 24;

/** The overlay a zone joins. */
export interface ZoneHost {
  readonly scene: Phaser.Scene;
  /** Overlay container (screen space); zones sit above the cards. */
  readonly container: Phaser.GameObjects.Container;
  /** Card accent restored when the pointer leaves a zone. */
  readonly accent: number;
}

/**
 * @param scene - Owning scene.
 * @param chips - The card's tags.
 * @param name - The card's name text (tags continue on its row).
 * @returns One text per tag, in card-local coordinates (not yet added to the card).
 */
export function chipTexts(
  scene: Phaser.Scene,
  chips: readonly ChoiceChip[],
  name: Phaser.GameObjects.Text,
): Array<{ text: Phaser.GameObjects.Text; tip: TooltipContent }> {
  let left = name.x + name.width + CHIP_GAP;
  return chips.map((chip) => {
    const text = scene.add
      .text(
        left,
        name.y,
        chip.label.toUpperCase(),
        pickerTextStyle("micro", HOLO_PALETTE.accent),
      )
      .setOrigin(0, 0.5);
    left += text.width + CHIP_GAP;
    return { text, tip: chip.tip };
  });
}

/**
 * A hover zone over one text of a card, above the card's hit area: it shows
 * its own tooltip, lights the card and still picks the card on click.
 *
 * @param host - Scene, overlay container and card accent.
 * @param group - The card.
 * @param text - A text inside the card.
 * @param tip - What the zone explains.
 * @param onPress - Picks the card.
 */
export function addElementZone(
  host: ZoneHost,
  group: HoloPanel,
  text: Phaser.GameObjects.Text,
  tip: TooltipContent,
  onPress: () => void,
): void {
  const zone = addTipZone(
    host.scene,
    host.container,
    {
      x: group.x + text.x - text.originX * text.width - HOLO_SPACING.sm,
      y: group.y + text.y - ZONE_HEIGHT / 2,
      width: text.width + HOLO_SPACING.sm * 2,
      height: ZONE_HEIGHT,
    },
    tip,
    onPress,
  );
  zone.on("pointerover", () => group.setAccent(HOLO_PALETTE.accent));
  zone.on("pointerout", () => group.setAccent(host.accent));
}
