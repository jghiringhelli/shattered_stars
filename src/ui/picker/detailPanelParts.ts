/**
 * detailPanelParts — pieces of the ship detail panel that need no panel
 * state: the header (name, role · size · points badge, the build's price)
 * and the flown-cost line under the loadout tab.
 */

import type Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import type { ShipLoadout } from "../../data/ShipLoadouts";
import { explainBaseShip, explainQuickBuild } from "../../data/roleHints";
import { addTipZone } from "../menu/tooltipTargets";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import { drawBadge } from "./detailHeader";
import { costSummary } from "./guideSections";
import { addPickerText } from "./pickerStyle";

/** The badge sits this far under the name (px). */
const BADGE_OFFSET = 24;

/** Where the header goes. */
export interface HeaderBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

/**
 * Name, role · size · points badge and the selected build's price.
 *
 * @param scene - Owning scene.
 * @param container - Target container.
 * @param def - The ship.
 * @param loadout - The selected build (undefined for the bare hull).
 * @param box - Header box.
 * @param accent - Faction accent.
 */
export function drawPanelHeader(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  def: ShipDefinition,
  loadout: ShipLoadout | undefined,
  box: HeaderBox,
  accent: number,
): void {
  container.add(
    addPickerText(scene, { x: box.x, y: box.y }, def.name, "title", HOLO_PALETTE.textPrimary),
  );
  drawBadge(scene, container, { x: box.x, y: box.y + BADGE_OFFSET }, def, accent, true);
  const cost = loadout?.pointCost ?? def.baseStats.pointCost;
  const price = addPickerText(
    scene,
    { x: box.x + box.width, y: box.y },
    `${cost} pt`,
    "title",
    loadout ? HOLO_PALETTE.success : HOLO_PALETTE.textSecondary,
  ).setOrigin(1, 0);
  container.add(price);
  addTipZone(
    scene,
    container,
    { x: price.x - price.width, y: price.y, width: price.width, height: price.height },
    "ui.flown_cost",
  );
}

/**
 * "FLOWN COST  HULL 45 + PILOT 5 + 3 CARDS 9 = 59 PT" at the panel's foot.
 *
 * @param scene - Owning scene.
 * @param container - Target container.
 * @param def - The ship.
 * @param loadout - The selected build (undefined for the bare hull).
 * @param at - Left edge and y of the line.
 */
export function drawFlownCostLine(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  def: ShipDefinition,
  loadout: ShipLoadout | undefined,
  at: { readonly x: number; readonly bottom: number },
): void {
  const guide = loadout ? explainQuickBuild(loadout) : explainBaseShip(def.id);
  const y = at.bottom - HOLO_SPACING.lg;
  const line = addPickerText(
    scene,
    { x: at.x, y },
    `FLOWN COST  ${costSummary(guide)}`.toUpperCase(),
    "caption",
    HOLO_PALETTE.accent,
  );
  container.add(line);
  addTipZone(
    scene,
    container,
    { x: at.x, y, width: line.width, height: line.height },
    "ui.flown_cost",
  );
}
