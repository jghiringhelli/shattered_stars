/**
 * LoadoutRow — the detail panel's PAYLOAD caption and toggle row: BASE plus
 * one page of quick builds, with a page arrow that cycles when a ship
 * offers more builds than fit.
 */

import type Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import { getEquippableLoadouts } from "../../data/ShipLoadouts";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import { createLoadoutToggle, createPageArrow } from "./LoadoutToggle";
import { addPickerText } from "./pickerStyle";

/** Payload button row layout. */
const LOADOUT = {
  captionH: 18,
  maxWidth: 150,
  height: 44,
  gap: HOLO_SPACING.sm,
  arrowW: 24,
  perPage: 3,
} as const;

/** Inputs for {@link drawLoadoutRow}. */
export interface LoadoutRowArgs {
  readonly def: ShipDefinition;
  readonly selectedLoadoutId: string | null;
  /** Requested page (wrapped to the ship's page count). */
  readonly page: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly accent: number;
  /** A toggle was pressed (null = BASE). */
  readonly onSelect: (loadoutId: string | null) => void;
  /** The arrow was pressed; receives the next page index. */
  readonly onPage: (page: number) => void;
}

/** One toggle's content. */
interface LoadoutOption {
  readonly id: string | null;
  readonly label: string;
  readonly pointCost: number;
}

/**
 * BASE plus the builds on one page (page index wrapped to the page count).
 *
 * @param def - The ship.
 * @param requestedPage - Requested page index.
 * @returns Options, the wrapped page and the page count.
 */
function loadoutPage(
  def: ShipDefinition,
  requestedPage: number,
): { options: LoadoutOption[]; page: number; pages: number } {
  const offered = getEquippableLoadouts(def.id);
  const pages = Math.max(1, Math.ceil(offered.length / LOADOUT.perPage));
  const page = requestedPage % pages;
  const options: LoadoutOption[] = [
    { id: null, label: "BASE", pointCost: def.baseStats.pointCost },
    ...offered
      .slice(page * LOADOUT.perPage, (page + 1) * LOADOUT.perPage)
      .map((ld) => ({
        id: ld.id,
        label: ld.name.toUpperCase(),
        pointCost: ld.pointCost,
      })),
  ];
  return { options, page, pages };
}

/**
 * Draw the caption and the toggle row into a container.
 *
 * @param scene - Owning scene.
 * @param container - Target container.
 * @param args - Ship, selection, page, box and callbacks.
 * @returns y just below the buttons.
 */
export function drawLoadoutRow(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  args: LoadoutRowArgs,
): number {
  container.add(
    addPickerText(
      scene,
      { x: args.x, y: args.y },
      "PAYLOAD",
      "caption",
      HOLO_PALETTE.textSecondary,
    ),
  );
  const btnY = args.y + LOADOUT.captionH;
  const { options, page, pages } = loadoutPage(args.def, args.page);
  const slots = 1 + LOADOUT.perPage;
  const arrowSpace = pages > 1 ? LOADOUT.arrowW + LOADOUT.gap : 0;
  const btnW = Math.min(
    LOADOUT.maxWidth,
    (args.width - arrowSpace - LOADOUT.gap * (slots - 1)) / slots,
  );
  options.forEach((option, i) => {
    const spec = {
      x: args.x + i * (btnW + LOADOUT.gap),
      y: btnY,
      width: btnW,
      height: LOADOUT.height,
      label: option.label,
      pointCost: option.pointCost,
      active: args.selectedLoadoutId === option.id,
      accent: args.accent,
    };
    container.add(
      createLoadoutToggle(scene, spec, () => args.onSelect(option.id)),
    );
  });
  if (pages > 1) {
    const arrowRect = {
      x: args.x + slots * (btnW + LOADOUT.gap),
      y: btnY,
      width: LOADOUT.arrowW,
      height: LOADOUT.height,
    };
    container.add(
      createPageArrow(scene, arrowRect, () => args.onPage((page + 1) % pages)),
    );
  }
  return btnY + LOADOUT.height;
}
