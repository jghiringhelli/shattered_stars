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
import { punch } from "../UIJuice";

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

  /** Render the staging area into the given container. */
  render(
    container: Phaser.GameObjects.Container,
    stageTop: number,
    stageH: number,
  ): void {
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x090e18, 1);
    bg.fillRoundedRect(CAT_X + 4, stageTop, CAT_W - 8, stageH, 6);
    bg.lineStyle(1, 0x1e2d40, 1);
    bg.strokeRoundedRect(CAT_X + 4, stageTop, CAT_W - 8, stageH, 6);
    container.add(bg);

    if (!this.selectedShipId) {
      container.add(
        this.scene.add
          .text(
            CAT_X + CAT_W / 2,
            stageTop + stageH / 2,
            "Click a ship above to select it",
            { font: "13px Arial", color: "#3a5566" },
          )
          .setOrigin(0.5),
      );
      return;
    }

    const def = this.ships.find((s) => s.id === this.selectedShipId);
    if (!def) return;
    container.add(
      this.scene.add.text(CAT_X + 10, stageTop + 10, def.name, {
        font: "bold 14px Arial",
        color: "#88ffcc",
      }),
    );
    container.add(
      this.scene.add
        .text(
          CAT_X + CAT_W - 10,
          stageTop + 10,
          def.baseStats.size.toUpperCase(),
          { font: "11px Arial", color: "#5588aa" },
        )
        .setOrigin(1, 0),
    );
    this.drawAddButton(container, def, stageTop + stageH - 36);
  }

  private drawAddButton(
    container: Phaser.GameObjects.Container,
    def: ShipDefinition,
    y: number,
  ): void {
    const w = CAT_W - 16;
    const h = 28;
    const c = this.scene.add.container(CAT_X + 8, y);
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a3322, 1);
    bg.fillRoundedRect(0, 0, w, h, 5);
    bg.lineStyle(2, 0x44ff88, 1);
    bg.strokeRoundedRect(0, 0, w, h, 5);
    const loadoutId = this.selectedLoadoutId;
    const ldLabel = loadoutId
      ? (getShipLoadouts(def.id).find((l) => l.id === loadoutId)?.name ??
        "Loadout")
      : "Base";
    c.add([
      bg,
      this.scene.add
        .text(
          w / 2,
          h / 2,
          `→  ${this.confirmLabel}  ${def.name.toUpperCase()} — ${ldLabel.toUpperCase()}`,
          { font: "bold 12px Arial", color: "#44ff88" },
        )
        .setOrigin(0.5),
    ]);
    c.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    c.on("pointerdown", () => {
      punch(this.scene, c, { scale: 1.08, durationMs: 160 });
      // Give the punch a beat to play before the panel rebuilds and destroys `c`.
      this.scene.time.delayedCall(90, () =>
        this.emit("addInstance", { shipId: def.id, loadoutId }),
      );
    });
    container.add(c);
  }
}
