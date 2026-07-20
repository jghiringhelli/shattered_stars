/**
 * CatalogStaging — staging area at the bottom of ShipCatalogPanel.
 * Emits: 'addInstance', 'requestRender'
 */

import Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import { getShipLoadouts } from "../../data/ShipLoadouts";
import {
  computeLoadoutBonuses,
  buildStatLine,
  CAT_X,
  CAT_W,
} from "./catalogHelpers";
import type { LoadoutBonuses } from "./types";

const BTN_W = 66;
const BTN_GAP = 4;
const ARROW_W = 14;
const PAGE_SIZE = 4;
const BTN_H = 20;

export class CatalogStaging extends Phaser.Events.EventEmitter {
  private selectedShipId: string | null = null;
  private selectedLoadoutId: string | null = null;
  private loadoutPage = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly ships: readonly ShipDefinition[],
  ) {
    super();
  }

  /** Called by the parent when a ship is clicked in the grid. */
  selectShip(shipId: string): void {
    this.selectedShipId = shipId;
    this.selectedLoadoutId = null;
    this.loadoutPage = 0;
  }

  getSelectedShipId(): string | null {
    return this.selectedShipId;
  }
  getSelectedLoadoutId(): string | null {
    return this.selectedLoadoutId;
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
      this.scene.add.text(CAT_X + 10, stageTop + 6, def.name, {
        font: "bold 14px Arial",
        color: "#88ffcc",
      }),
    );
    container.add(
      this.scene.add
        .text(
          CAT_X + CAT_W - 10,
          stageTop + 6,
          def.baseStats.size.toUpperCase(),
          { font: "11px Arial", color: "#5588aa" },
        )
        .setOrigin(1, 0),
    );
    this.drawLoadoutOptions(container, def, stageTop + 26);
    this.drawAddButton(container, def, stageTop + stageH - 36);
  }

  private drawLoadoutOptions(
    container: Phaser.GameObjects.Container,
    def: ShipDefinition,
    y: number,
  ): void {
    const loadouts = getShipLoadouts(def.id);
    const maxPage = Math.max(0, Math.ceil(loadouts.length / PAGE_SIZE) - 1);
    const page = Math.min(this.loadoutPage, maxPage);
    const visible = loadouts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const hasPages = maxPage > 0;
    const baseX = hasPages ? CAT_X + 8 + ARROW_W + 2 : CAT_X + 8;

    if (hasPages) {
      container.add(
        this.makePageArrow(CAT_X + 8, y, "◀", page > 0, () => {
          this.loadoutPage = Math.max(0, this.loadoutPage - 1);
          this.emit("requestRender");
        }),
      );
    }

    container.add(
      this.makeLoadoutBtn(
        baseX,
        y,
        "Base",
        this.selectedLoadoutId === null,
        () => {
          this.selectedLoadoutId = null;
          this.emit("requestRender");
        },
      ),
    );
    visible.forEach((ld, i) => {
      const isActive = this.selectedLoadoutId === ld.id;
      const label = ld.name.length > 9 ? `${ld.name.slice(0, 8)}…` : ld.name;
      container.add(
        this.makeLoadoutBtn(
          baseX + (BTN_W + BTN_GAP) * (i + 1),
          y,
          label,
          isActive,
          () => {
            this.selectedLoadoutId = ld.id;
            this.emit("requestRender");
          },
        ),
      );
    });

    if (hasPages) {
      const arrowX = baseX + (BTN_W + BTN_GAP) * (visible.length + 1) + 2;
      container.add(
        this.makePageArrow(arrowX, y, "▶", page < maxPage, () => {
          this.loadoutPage = Math.min(maxPage, this.loadoutPage + 1);
          this.emit("requestRender");
        }),
      );
    }

    const selLd = loadouts.find((l) => l.id === this.selectedLoadoutId);
    const bonuses = computeLoadoutBonuses(selLd?.upgrades ?? []);
    const statLine = buildStatLine(
      bonuses,
      selLd?.pointCost ?? def.baseStats.pointCost,
    );
    container.add(
      this.scene.add.text(CAT_X + 8, y + 24, statLine, {
        font: "bold 11px Arial",
        color: selLd ? "#88cc55" : "#6688aa",
      }),
    );

    const description = selLd?.description ?? def.description;
    container.add(
      this.scene.add.text(CAT_X + 8, y + 40, description, {
        font: "11px Arial",
        color: "#7090a8",
        wordWrap: { width: CAT_W - 20 },
      }),
    );

    this.drawUsageTips(container, bonuses, y + 66);
  }

  private drawUsageTips(
    container: Phaser.GameObjects.Container,
    bonuses: LoadoutBonuses,
    y: number,
  ): void {
    const tips: Array<{ text: string; color: string }> = [];
    if (bonuses.actions.length > 0)
      tips.push({
        text: `+ Abilities: ${bonuses.actions.join(", ")} — activate in battle`,
        color: "#558844",
      });
    if (bonuses.rerolls > 0)
      tips.push({
        text: `+ Hit bonus: +${bonuses.rerolls * 5}% accuracy`,
        color: "#ffcc66",
      });
    if (bonuses.charges > 0)
      tips.push({
        text: `+ ${bonuses.charges} charge${bonuses.charges > 1 ? "s" : ""} — spend when firing ordnance or activating an ability`,
        color: "#cc88ff",
      });
    tips.forEach((tip, i) => {
      container.add(
        this.scene.add.text(CAT_X + 8, y + i * 15, tip.text, {
          font: "10px Arial",
          color: tip.color,
          wordWrap: { width: CAT_W - 20 },
        }),
      );
    });
  }

  private makeLoadoutBtn(
    x: number,
    y: number,
    label: string,
    active: boolean,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const c = this.scene.add.container(x, y);
    const bg = this.scene.add.graphics();
    bg.fillStyle(active ? 0x1a3322 : 0x131c28, 1);
    bg.fillRoundedRect(0, 0, BTN_W, BTN_H, 3);
    bg.lineStyle(1, active ? 0x44ff88 : 0x253545, 1);
    bg.strokeRoundedRect(0, 0, BTN_W, BTN_H, 3);
    c.add([
      bg,
      this.scene.add
        .text(BTN_W / 2, BTN_H / 2, label, {
          font: `${active ? "bold " : ""}11px Arial`,
          color: active ? "#88ffcc" : "#5577aa",
        })
        .setOrigin(0.5),
    ]);
    c.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, BTN_W, BTN_H),
      Phaser.Geom.Rectangle.Contains,
    );
    c.on("pointerdown", onClick);
    return c;
  }

  private makePageArrow(
    x: number,
    y: number,
    label: string,
    enabled: boolean,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const c = this.scene.add.container(x, y);
    const bg = this.scene.add.graphics();
    bg.fillStyle(enabled ? 0x1a2838 : 0x0e1420, 1);
    bg.fillRoundedRect(0, 0, ARROW_W, BTN_H, 3);
    c.add([
      bg,
      this.scene.add
        .text(ARROW_W / 2, BTN_H / 2, label, {
          font: "bold 11px Arial",
          color: enabled ? "#5588cc" : "#223344",
        })
        .setOrigin(0.5),
    ]);
    if (enabled) {
      c.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, ARROW_W, BTN_H),
        Phaser.Geom.Rectangle.Contains,
      );
      c.on("pointerdown", onClick);
    }
    return c;
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
          `→  ADD  ${def.name.toUpperCase()} — ${ldLabel.toUpperCase()}`,
          { font: "bold 12px Arial", color: "#44ff88" },
        )
        .setOrigin(0.5),
    ]);
    c.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    c.on("pointerdown", () =>
      this.emit("addInstance", { shipId: def.id, loadoutId }),
    );
    container.add(c);
  }
}
