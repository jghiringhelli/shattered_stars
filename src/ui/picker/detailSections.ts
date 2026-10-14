/**
 * detailSections — the stat gauges, actions and lore blocks of the ship
 * picker's detail panel, drawn in the holo style. Each function adds its
 * objects to the given container and returns the y just below the block.
 */

import Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import { getEncyclopediaEntry } from "../../data/ShipEncyclopedia";
import { ACTION_DEFINITIONS } from "../../systems/ActionsSystem";
import { drawHoloFrame, drawHoloGauge } from "../menu/holoChrome";
import { HOLO_PALETTE, HOLO_RADIUS, HOLO_SPACING } from "../theme/HoloTheme";
import { formatActionName } from "./catalogHelpers";
import {
  addPickerText,
  pickerTextStyle,
  STAT_COLORS,
  STAT_GAUGE_MAX,
} from "./pickerStyle";
import type { LoadoutBonuses } from "./types";
import { actionTermId } from "../../data/tooltips";
import { addTipZone } from "../menu/tooltipTargets";

/** Where a block goes. */
export interface SectionArea {
  readonly scene: Phaser.Scene;
  readonly container: Phaser.GameObjects.Container;
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

const STAT_DEFS = [
  { key: "attack", label: "ATTACK", bonus: "atk", term: "stat.attack" },
  { key: "agility", label: "AGILITY", bonus: "agi", term: "stat.agility" },
  { key: "hull", label: "HULL", bonus: "hull", term: "stat.hull" },
  { key: "shields", label: "SHIELDS", bonus: "shld", term: "stat.shields" },
] as const;

/** Section layout. */
const LAYOUT = {
  statGap: HOLO_SPACING.md,
  gaugeTop: 20,
  gaugeH: 6,
  captionH: 18,
  actionRowH: 32,
  actionDescY: 16,
  chipH: 18,
  chipPadX: 6,
  chipGap: HOLO_SPACING.xs,
  /** Longest lore excerpt shown (characters) before an ellipsis. */
  loreMaxChars: 120,
} as const;

/**
 * Four stat gauges (attack, agility, hull, shields) with the selected
 * build's bonuses folded into the value.
 *
 * @param area - Target and box.
 * @param def - The ship.
 * @param bonuses - Bonuses from the selected build.
 * @returns y below the gauges.
 */
export function drawStatGauges(
  area: SectionArea,
  def: ShipDefinition,
  bonuses: LoadoutBonuses,
): number {
  const { scene, container, x, y, width } = area;
  const colW =
    (width - LAYOUT.statGap * (STAT_DEFS.length - 1)) / STAT_DEFS.length;
  STAT_DEFS.forEach((stat, i) => {
    const sx = x + i * (colW + LAYOUT.statGap);
    const delta = bonuses[stat.bonus];
    const total = def.baseStats[stat.key] + delta;
    const value = delta !== 0 ? `${total} (+${delta})` : String(total);
    const gauge = scene.add.graphics();
    drawHoloGauge(
      gauge,
      { x: sx, y: y + LAYOUT.gaugeTop, width: colW, height: LAYOUT.gaugeH },
      total / STAT_GAUGE_MAX,
      STAT_COLORS[stat.key],
    );
    container.add([
      addPickerText(
        scene,
        { x: sx, y: y + 2 },
        stat.label,
        "caption",
        HOLO_PALETTE.textSecondary,
      ),
      addPickerText(
        scene,
        { x: sx + colW, y },
        value,
        "numeric",
        delta > 0 ? HOLO_PALETTE.success : HOLO_PALETTE.textPrimary,
      ).setOrigin(1, 0),
      gauge,
    ]);
    const zone = { x: sx, y, width: colW, height: LAYOUT.gaugeTop + LAYOUT.gaugeH };
    addTipZone(scene, container, zone, stat.term);
  });
  return y + LAYOUT.gaugeTop + LAYOUT.gaugeH;
}

/**
 * The ship's actions: two columns with descriptions, or (compact) a single
 * wrapping row of chips.
 *
 * @param area - Target and box.
 * @param def - The ship.
 * @param compact - Use the chip row.
 * @returns y below the block (unchanged when the ship has no actions).
 */
export function drawActions(
  area: SectionArea,
  def: ShipDefinition,
  compact: boolean,
): number {
  const actions = def.baseStats.actions ?? [];
  if (actions.length === 0) return area.y;
  const caption = addPickerText(
    area.scene,
    { x: area.x, y: area.y },
    "ACTIONS",
    "caption",
    HOLO_PALETTE.textSecondary,
  );
  area.container.add(caption);
  addTipZone(
    area.scene,
    area.container,
    { x: area.x, y: area.y, width: caption.width, height: caption.height },
    "ui.action_bar",
  );
  if (compact) return drawActionChips(area, actions, caption.width);
  const top = area.y + LAYOUT.captionH;
  const colW = area.width / 2;
  actions.forEach((actionKey, i) => {
    const cx = area.x + (i % 2) * colW;
    const ry = top + Math.floor(i / 2) * LAYOUT.actionRowH;
    const actionDef =
      ACTION_DEFINITIONS[actionKey as keyof typeof ACTION_DEFINITIONS];
    area.container.add([
      addPickerText(
        area.scene,
        { x: cx, y: ry },
        `\u25c6 ${formatActionName(actionKey)}`,
        "name",
        HOLO_PALETTE.accent,
      ),
      area.scene.add.text(
        cx,
        ry + LAYOUT.actionDescY,
        actionDef?.description ?? "",
        pickerTextStyle("caption", HOLO_PALETTE.textSecondary, {
          fontStyle: "400",
          wordWrap: { width: colW - HOLO_SPACING.lg },
        }),
      ),
    ]);
    addActionZone(area, actionKey, { x: cx, y: ry, width: colW - HOLO_SPACING.lg, height: LAYOUT.actionRowH });
  });
  return top + Math.ceil(actions.length / 2) * LAYOUT.actionRowH;
}

/**
 * Hover zone that explains one action of the bar.
 *
 * @param area - Target and box.
 * @param actionKey - Action key.
 * @param rect - Zone bounds.
 */
function addActionZone(
  area: SectionArea,
  actionKey: string,
  rect: { x: number; y: number; width: number; height: number },
): void {
  const id = actionTermId(actionKey);
  if (id) addTipZone(area.scene, area.container, rect, id);
}

/**
 * Action chips after the caption, wrapping onto further rows.
 *
 * @param area - Target and box.
 * @param actions - Action keys.
 * @param captionW - Width of the ACTIONS caption.
 * @returns y below the chips.
 */
function drawActionChips(
  area: SectionArea,
  actions: readonly string[],
  captionW: number,
): number {
  const startX = area.x + captionW + HOLO_SPACING.md;
  const right = area.x + area.width;
  let chipX = startX;
  let chipY = area.y - (LAYOUT.chipH - LAYOUT.captionH + 4) / 2;
  for (const actionKey of actions) {
    const label = addPickerText(
      area.scene,
      { x: 0, y: 0 },
      formatActionName(actionKey).toUpperCase(),
      "micro",
      HOLO_PALETTE.accent,
    ).setOrigin(0, 0.5);
    const chipW = label.width + LAYOUT.chipPadX * 2;
    if (chipX + chipW > right && chipX > startX) {
      chipX = startX;
      chipY += LAYOUT.chipH + LAYOUT.chipGap;
    }
    const chip = area.scene.add.graphics();
    drawHoloFrame(
      chip,
      { x: chipX, y: chipY, width: chipW, height: LAYOUT.chipH },
      { accent: HOLO_PALETTE.accent, borderAlpha: 0.5, radius: HOLO_RADIUS.sm },
    );
    label.setPosition(chipX + LAYOUT.chipPadX, chipY + LAYOUT.chipH / 2);
    area.container.add([chip, label]);
    addActionZone(area, actionKey, { x: chipX, y: chipY, width: chipW, height: LAYOUT.chipH });
    chipX += chipW + LAYOUT.chipGap;
  }
  return chipY + LAYOUT.chipH;
}

/**
 * Lore excerpt (encyclopedia entry or ship description).
 *
 * @param area - Target and box.
 * @param def - The ship.
 * @returns y below the text.
 */
export function drawLore(area: SectionArea, def: ShipDefinition): number {
  const full = getEncyclopediaEntry(def.id)?.lore ?? def.description;
  const desc =
    full.length > LAYOUT.loreMaxChars
      ? `${full.slice(0, LAYOUT.loreMaxChars - 3)}\u2026`
      : full;
  const text = area.scene.add.text(
    area.x,
    area.y,
    desc,
    pickerTextStyle("small", HOLO_PALETTE.textSecondary, {
      wordWrap: { width: area.width },
    }),
  );
  area.container.add(text);
  return area.y + text.height;
}
