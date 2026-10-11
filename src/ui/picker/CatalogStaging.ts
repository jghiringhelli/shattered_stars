/**
 * CatalogStaging — thin confirm strip at the bottom of ShipCatalogPanel.
 * Owns the selected ship/loadout state (read by ShipDetailPanel) and
 * renders only the ship name + the ADD/LAUNCH confirm button; the full
 * stats/payload picker lives in ShipDetailPanel to its right.
 * Emits: 'addInstance', 'requestRender'
 */

import Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import { getShipLoadouts } from "../../data/ShipLoadouts";
import { CAT_X, CAT_W } from "./catalogHelpers";
import type { StagingSelection } from "./ShipDetailPanel";
import { createHoverButton } from "../ButtonFactory";
import {
  HOLO_ALPHA,
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_SPACING,
} from "../theme/HoloTheme";
import { addPickerText, fitOrEllipsize, fittedFontSize } from "./pickerStyle";

/** Staging strip layout (inside the catalog panel). */
const STAGE = {
  pad: HOLO_SPACING.lg,
  buttonH: 40,
  /** Label font of the confirm button before fitting. */
  buttonFont: { size: 14, weight: "600" },
  /** Room the button's icon and padding take from the label width. */
  buttonChrome: 56,
  /** Lets the press punch play before the panel rebuilds. */
  emitDelayMs: 90,
} as const;

export class CatalogStaging
  extends Phaser.Events.EventEmitter
  implements StagingSelection
{
  private selectedShipId: string | null = null;
  private selectedLoadoutId: string | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly ships: readonly ShipDefinition[],
    private readonly confirmLabel = "ADD",
  ) {
    super();
  }

  /** Called by the parent when a ship is clicked in the grid. */
  selectShip(shipId: string): void {
    this.selectedShipId = shipId;
    this.selectedLoadoutId = null;
  }

  getSelectedShipId(): string | null {
    return this.selectedShipId;
  }
  getSelectedLoadoutId(): string | null {
    return this.selectedLoadoutId;
  }

  /** Changes the selected loadout (or clears it with null) and asks the parent to re-render. */
  selectLoadout(loadoutId: string | null): void {
    this.selectedLoadoutId = loadoutId;
    this.emit("requestRender");
  }

  /**
   * Render the staging strip into the given container.
   *
   * @param container - Catalog panel container.
   * @param stageTop - Strip top.
   * @param stageH - Strip height.
   * @param accent - Faction accent for the divider.
   */
  render(
    container: Phaser.GameObjects.Container,
    stageTop: number,
    stageH: number,
    accent: number = HOLO_PALETTE.border,
  ): void {
    const divider = this.scene.add.graphics();
    divider.lineStyle(HOLO_BORDER.hairline, accent, HOLO_ALPHA.structure);
    divider.lineBetween(
      CAT_X + STAGE.pad,
      stageTop,
      CAT_X + CAT_W - STAGE.pad,
      stageTop,
    );
    container.add(divider);

    const def = this.ships.find((s) => s.id === this.selectedShipId);
    if (!def) {
      container.add(
        addPickerText(
          this.scene,
          { x: CAT_X + CAT_W / 2, y: stageTop + stageH / 2 },
          "Click a ship above to select it",
          "body",
          HOLO_PALETTE.textMuted,
        ).setOrigin(0.5),
      );
      return;
    }
    this.drawSelectionLine(container, def, stageTop + STAGE.pad);
    this.drawAddButton(
      container,
      def,
      stageTop + stageH - STAGE.pad - STAGE.buttonH / 2,
    );
  }

  private drawSelectionLine(
    container: Phaser.GameObjects.Container,
    def: ShipDefinition,
    y: number,
  ): void {
    const size = addPickerText(
      this.scene,
      { x: CAT_X + CAT_W - STAGE.pad, y: y + 3 },
      def.baseStats.size.toUpperCase(),
      "caption",
      HOLO_PALETTE.textSecondary,
    ).setOrigin(1, 0);
    const name = addPickerText(
      this.scene,
      { x: CAT_X + STAGE.pad, y },
      def.name,
      "heading",
      HOLO_PALETTE.textPrimary,
    ).setLetterSpacing(0);
    fitOrEllipsize(name, size.x - size.width - STAGE.pad - name.x);
    container.add([name, size]);
  }

  private drawAddButton(
    container: Phaser.GameObjects.Container,
    def: ShipDefinition,
    centreY: number,
  ): void {
    const width = CAT_W - STAGE.pad * 2;
    const loadoutId = this.selectedLoadoutId;
    const ldLabel = loadoutId
      ? (getShipLoadouts(def.id).find((l) => l.id === loadoutId)?.name ??
        "Loadout")
      : "Base";
    const label = `${this.confirmLabel}  ${def.name.toUpperCase()} \u2014 ${ldLabel.toUpperCase()}`;
    const fontSize = fittedFontSize(
      this.scene,
      label,
      width - STAGE.buttonChrome,
      STAGE.buttonFont,
    );
    const button = createHoverButton(
      this.scene,
      CAT_X + CAT_W / 2,
      centreY,
      {
        width,
        height: STAGE.buttonH,
        color: HOLO_PALETTE.accent,
        variant: "primary",
        label,
        font: `${STAGE.buttonFont.weight} ${fontSize}px`,
        icon: this.confirmLabel === "ADD" ? "plus" : "next",
      },
      () => {
        // Give the punch a beat to play before the panel rebuilds and destroys the button.
        this.scene.time.delayedCall(STAGE.emitDelayMs, () =>
          this.emit("addInstance", { shipId: def.id, loadoutId }),
        );
      },
    );
    container.add(button);
  }
}
