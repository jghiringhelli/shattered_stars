/**
 * SlotChip — one upgrade-slot chip of the quick-build slot bar: tinted
 * with the slot category colour when filled, outlined when empty, edged in
 * the warning (gold) colour when the pilot added the slot.
 */

import type Phaser from "phaser";
import type { UpgradeSlotType } from "../../core/upgradeTypes";
import type { FilledSlot } from "../../data/quickBuildDetails";
import { HOLO_PALETTE, HOLO_RADIUS } from "../theme/HoloTheme";
import { PICKER_TYPE, pickerTextStyle } from "./pickerStyle";

/** Short chip label and colour per slot category. */
const SLOT_STYLE: Readonly<
  Record<UpgradeSlotType, { readonly label: string; readonly color: number }>
> = {
  talent: { label: "TAL", color: 0xffcc66 },
  missile: { label: "MSL", color: 0xff7755 },
  torpedo: { label: "TRP", color: 0xff5566 },
  cannon: { label: "CAN", color: 0xff9944 },
  turret: { label: "TUR", color: 0xffaa77 },
  bomb: { label: "BMB", color: 0xdd6644 },
  crew: { label: "CRW", color: 0x66ccff },
  gunner: { label: "GUN", color: 0xff8866 },
  astromech: { label: "AST", color: 0x88ddff },
  sensor: { label: "SEN", color: 0x55ddcc },
  tech: { label: "TEC", color: 0x88aaff },
  modification: { label: "MOD", color: 0x99cc66 },
  illicit: { label: "ILL", color: 0xcc66cc },
  title: { label: "TTL", color: 0xddddaa },
  configuration: { label: "CFG", color: 0xaabbcc },
  force_power: { label: "FRC", color: 0xbb88ff },
};

/** Chip geometry and tints. */
export const SLOT_CHIP = {
  width: 44,
  height: 18,
  gap: 4,
  /** Fill opacity of a filled chip (category colour tint). */
  fillAlpha: 0.28,
  /** Opacity of an empty chip's outline and label. */
  emptyAlpha: 0.55,
  pilotEdgeWidth: 2,
} as const;

/**
 * Draw one slot chip and add it to a container.
 *
 * @param scene - Owning scene.
 * @param container - Target container.
 * @param slot - The slot.
 * @param origin - Chip top-left.
 */
export function drawSlotChip(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  slot: FilledSlot,
  origin: { readonly x: number; readonly y: number },
): void {
  const { x, y } = origin;
  const style = SLOT_STYLE[slot.type];
  const isFilled = slot.upgradeId !== null;
  const g = scene.add.graphics();
  g.fillStyle(
    isFilled ? style.color : HOLO_PALETTE.panelFill,
    isFilled ? SLOT_CHIP.fillAlpha : HOLO_PALETTE.panelAlpha,
  );
  g.fillRoundedRect(x, y, SLOT_CHIP.width, SLOT_CHIP.height, HOLO_RADIUS.sm);
  g.lineStyle(
    slot.fromPilot ? SLOT_CHIP.pilotEdgeWidth : 1,
    slot.fromPilot ? HOLO_PALETTE.warning : style.color,
    isFilled || slot.fromPilot ? 1 : SLOT_CHIP.emptyAlpha,
  );
  g.strokeRoundedRect(x, y, SLOT_CHIP.width, SLOT_CHIP.height, HOLO_RADIUS.sm);
  const label = scene.add
    .text(
      x + SLOT_CHIP.width / 2,
      y + SLOT_CHIP.height / 2,
      style.label,
      pickerTextStyle(
        "micro",
        isFilled ? HOLO_PALETTE.textPrimary : style.color,
      ),
    )
    .setLetterSpacing(PICKER_TYPE.micro.letterSpacing)
    .setOrigin(0.5)
    .setAlpha(isFilled ? 1 : SLOT_CHIP.emptyAlpha);
  container.add([g, label]);
}
