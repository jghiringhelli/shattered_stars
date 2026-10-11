/**
 * RosterRow — one squad row card of the picker roster: sprite, ship name,
 * build name, points, duplicate count, and a close-glyph remove button that
 * turns danger-red on hover.
 */

import type Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import type { ShipLoadout } from "../../data/ShipLoadouts";
import { drawMenuIcon } from "../menu/MenuIcons";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { addPickerText, fitOrEllipsize, MIN_NAME_SIZE } from "./pickerStyle";

/** Row card interior. */
export const ROSTER_ROW = {
  height: 36,
  spriteX: 18,
  spriteSize: 22,
  textX: 36,
  nameY: 3,
  loadoutY: 19,
  removeSize: 24,
  removeIcon: 9,
  pointsGap: 6,
} as const;

/** What a row shows and where. */
export interface RosterRowArgs {
  readonly def: ShipDefinition;
  readonly loadout: ShipLoadout | null;
  /** Copies of this ship in the squad (shown as ×N when > 1). */
  readonly dupeCount: number;
  /** Card left edge. */
  readonly x: number;
  /** Card top. */
  readonly y: number;
  /** Card width (remove button included). */
  readonly width: number;
}

/**
 * Sprite, names, points and duplicate badge.
 *
 * @param scene - Owning scene.
 * @param container - Target container.
 * @param args - Row content and box.
 */
export function drawRosterRowContent(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  args: RosterRowArgs,
): void {
  const { def, loadout, x, y } = args;
  const right = x + args.width - ROSTER_ROW.removeSize;
  const textX = x + ROSTER_ROW.textX;
  const spriteKey = `ship_${def.faction}_${def.baseStats.size}`;
  const sprite = scene.add
    .image(x + ROSTER_ROW.spriteX, y + ROSTER_ROW.height / 2, spriteKey)
    .setDisplaySize(ROSTER_ROW.spriteSize, ROSTER_ROW.spriteSize);
  const points = addPickerText(
    scene,
    { x: right, y: y + ROSTER_ROW.nameY + 2 },
    `${loadout?.pointCost ?? def.baseStats.pointCost}pt`,
    "micro",
    HOLO_PALETTE.textSecondary,
  ).setOrigin(1, 0);
  const name = addPickerText(
    scene,
    { x: textX, y: y + ROSTER_ROW.nameY },
    def.name,
    "name",
    HOLO_PALETTE.textPrimary,
  );
  const nameMax = points.x - points.width - ROSTER_ROW.pointsGap - textX;
  fitOrEllipsize(name, nameMax, MIN_NAME_SIZE);
  const build = addPickerText(
    scene,
    { x: textX, y: y + ROSTER_ROW.loadoutY },
    loadout?.name ?? "Base",
    "small",
    HOLO_PALETTE.textSecondary,
  );
  fitOrEllipsize(build, right - ROSTER_ROW.pointsGap * 4 - textX);
  container.add([sprite, name, build, points]);
  if (args.dupeCount <= 1) return;
  container.add(
    addPickerText(
      scene,
      { x: right, y: y + ROSTER_ROW.loadoutY + 1 },
      `\u00d7${args.dupeCount}`,
      "micro",
      HOLO_PALETTE.warning,
    ).setOrigin(1, 0),
  );
}

/**
 * Close-glyph remove button at the row's right edge.
 *
 * @param scene - Owning scene.
 * @param container - Target container.
 * @param args - Row box (content fields unused).
 * @param onRemove - Invoked on press.
 */
export function drawRosterRemoveButton(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  args: Pick<RosterRowArgs, "x" | "y" | "width">,
  onRemove: () => void,
): void {
  const cx = args.x + args.width - ROSTER_ROW.removeSize / 2;
  const cy = args.y + ROSTER_ROW.height / 2;
  const glyph = scene.add.graphics();
  const paint = (hover: boolean): void => {
    glyph.clear();
    drawMenuIcon(
      glyph,
      "close",
      { x: cx, y: cy },
      ROSTER_ROW.removeIcon,
      hover ? HOLO_PALETTE.danger : HOLO_PALETTE.textMuted,
    );
  };
  paint(false);
  const zone = scene.add
    .rectangle(cx, cy, ROSTER_ROW.removeSize, ROSTER_ROW.removeSize, 0, 0)
    .setInteractive({ useHandCursor: true });
  zone.on("pointerover", () => paint(true));
  zone.on("pointerout", () => paint(false));
  zone.on("pointerdown", onRemove);
  container.add([glyph, zone]);
}
