/**
 * Survival setup ship card — one slim holo card per starter ship (its name).
 * The details live in the panel below the row (OVERVIEW / LOADOUT / BUILDS
 * tabs). Selected = faction-accent border, tint and corner ticks; hovering
 * explains the ship's role.
 *
 * Objects are created as direct scene children and returned for the caller
 * to track/destroy (setup screens rebuild cards on every selection).
 */

import Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import { roleTermId } from "../../data/tooltips";
import { attachHintTooltip } from "../menu/HintTooltip";
import { drawHoloFrame } from "../menu/holoChrome";
import { contentFromTerm } from "../menu/tooltipContent";
import { addPickerText } from "../picker/pickerStyle";
import { HOLO_BORDER, HOLO_PALETTE } from "../theme/HoloTheme";

/** Fill opacity of a selected card. */
const SELECTED_FILL_ALPHA = 0.14;

/** What a card shows and where. */
export interface SurvivalShipCardOptions {
  /** Card centre x. */
  readonly x: number;
  /** Card top y. */
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly def: ShipDefinition;
  readonly selected: boolean;
  /** Faction accent for the selected state. */
  readonly accent: number;
  readonly onSelect: () => void;
}

/**
 * Render one ship card.
 *
 * @param scene - Setup scene (camera zoom 1).
 * @param options - Card placement, ship and state.
 * @returns Every created object (caller destroys them on rebuild).
 */
export function renderSurvivalShipCard(
  scene: Phaser.Scene,
  options: SurvivalShipCardOptions,
): Phaser.GameObjects.GameObject[] {
  const { x, top, width, height, def, selected, accent } = options;
  const bg = scene.add.graphics();
  drawHoloFrame(
    bg,
    { x: x - width / 2, y: top, width, height },
    {
      accent: selected ? accent : HOLO_PALETTE.border,
      fill: selected ? accent : HOLO_PALETTE.panelFill,
      fillAlpha: selected ? SELECTED_FILL_ALPHA : HOLO_PALETTE.panelAlpha,
      borderWidth: selected ? HOLO_BORDER.regular : HOLO_BORDER.hairline,
      borderAlpha: selected ? 1 : HOLO_PALETTE.borderAlpha,
      cornerTicks: selected,
    },
  );
  const name = addPickerText(
    scene,
    { x, y: top + height / 2 },
    def.name,
    "title",
    selected ? HOLO_PALETTE.textPrimary : HOLO_PALETTE.textSecondary,
  ).setOrigin(0.5);
  const hit = scene.add
    .rectangle(x, top + height / 2, width, height, 0x000000, 0)
    .setInteractive({ useHandCursor: true });
  hit.on("pointerdown", options.onSelect);
  attachHintTooltip(scene, hit, contentFromTerm(roleTermId(def.role)));
  return [bg, name, hit];
}
