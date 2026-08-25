/**
 * ShipCatalogPanel — left panel of ShipPickerScene.
 * Shows faction ship catalog; user clicks a ship to stage it, picks a loadout,
 * then clicks [→ ADD TO SQUAD] to add the config to the roster.
 *
 * Emits: 'addInstance' { shipId: string, loadoutId: string | null }
 */

import Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import { FACTION_COLORS } from "../../config";
import type { FactionId } from "../../config";
import { getShipLoadouts } from "../../data/ShipLoadouts";
import { ShipTooltip } from "./ShipTooltip";
import { CatalogScroll } from "./CatalogScroll";
import { CatalogStaging } from "./CatalogStaging";
import {
  computeLoadoutBonuses,
  secondaryTags,
  CAT_X,
  CAT_W,
} from "./catalogHelpers";
import type { LoadoutBonuses } from "./types";

export type { LoadoutBonuses };
export { CAT_X, CAT_W };

/** XP-gating hooks: which ship ids are locked and why. Defaults to "nothing locked". */
export interface CatalogGating {
  readonly lockedShipIds: ReadonlySet<string>;
  reasonFor(shipId: string): string;
}

const NO_GATING: CatalogGating = {
  lockedShipIds: new Set<string>(),
  reasonFor: () => "",
};

const ROLE_SORT: Record<string, number> = {
  interceptor: 0,
  light_fighter: 1,
  heavy_fighter: 2,
  bomber: 3,
  gunship: 4,
  support: 5,
  capital: 6,
};

const TOP_Y = 98;
const PANEL_H = 570;
const COL_W = CAT_W / 2;
const ROW_H = 50;
const ROW_GAP = 4;
const GRID_ROWS = 7;
const STAGE_TOP = TOP_Y + 10 + GRID_ROWS * (ROW_H + ROW_GAP);

export class ShipCatalogPanel extends Phaser.Events.EventEmitter {
  private container!: Phaser.GameObjects.Container;
  private gridContainer!: Phaser.GameObjects.Container;
  private readonly tooltip: ShipTooltip;
  private readonly scroll: CatalogScroll;
  private readonly staging: CatalogStaging;
  private scrollWired = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly ships: ShipDefinition[],
    private readonly factionId: FactionId,
    private readonly gating: CatalogGating = NO_GATING,
  ) {
    super();
    this.tooltip = new ShipTooltip(scene);
    const gridClipH = GRID_ROWS * (ROW_H + ROW_GAP);
    this.scroll = new CatalogScroll({
      clipX: CAT_X,
      clipY: TOP_Y + 10,
      clipW: CAT_W,
      clipH: gridClipH,
    });
    this.staging = new CatalogStaging(scene, ships);
    this.staging.on("addInstance", (e: unknown) => this.emit("addInstance", e));
    this.staging.on("requestRender", () => this.render());
  }

  render(): void {
    this.container?.destroy();
    this.container = this.scene.add.container(0, 0);
    this.gridContainer = this.scene.add.container(0, TOP_Y + 10);
    this.drawBackground();
    this.drawGrid();
    this.scroll.applyMask(this.scene, this.gridContainer);
    this.scroll.drawScrollbar(this.scene);
    if (!this.scrollWired) {
      this.scroll.setupWheel(this.scene, this.gridContainer);
      this.scrollWired = true;
    }
    const stageH = PANEL_H - (STAGE_TOP - TOP_Y) - 8;
    this.staging.render(this.container, STAGE_TOP, stageH);
  }

  destroy(): void {
    this.tooltip.destroy();
    this.scroll.destroy();
    this.staging.destroy();
    this.container?.destroy();
    super.destroy();
  }

  private drawBackground(): void {
    const fCol = FACTION_COLORS[this.factionId];
    const g = this.scene.add.graphics();
    g.fillStyle(0x0d1525, 1);
    g.fillRoundedRect(CAT_X, TOP_Y, CAT_W, PANEL_H, 10);
    g.lineStyle(2, fCol, 0.7);
    g.strokeRoundedRect(CAT_X, TOP_Y, CAT_W, PANEL_H, 10);
    this.container.add(g);
  }

  private drawGrid(): void {
    const sorted = [...this.ships].sort(
      (a, b) => (ROLE_SORT[a.role] ?? 9) - (ROLE_SORT[b.role] ?? 9),
    );
    sorted.forEach((def, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = CAT_X + 4 + col * COL_W;
      const y = row * (ROW_H + ROW_GAP);
      this.drawShipRow(def, x, y);
    });
    const totalRows = Math.ceil(sorted.length / 2);
    this.scroll.setContentHeight(totalRows * (ROW_H + ROW_GAP));
  }

  private drawShipRow(def: ShipDefinition, x: number, y: number): void {
    const locked = this.gating.lockedShipIds.has(def.id);
    const isSel = !locked && this.staging.getSelectedShipId() === def.id;
    const base = this.buildRowBase(def, x, y, isSel, locked);
    const tags = locked ? [] : this.buildTags(def, x, y);
    const hit = this.buildRowHit(def, x, y, locked);
    const lock = locked ? this.buildLockBadge(def, x, y) : [];
    this.gridContainer.add([...base, ...tags, hit, ...lock]);
  }

  private buildRowBase(
    def: ShipDefinition,
    x: number,
    y: number,
    isSel: boolean,
    locked: boolean,
  ): Phaser.GameObjects.GameObject[] {
    const bg = this.scene.add.graphics();
    bg.fillStyle(locked ? 0x0b0f16 : isSel ? 0x0e2618 : 0x111a28, 1);
    bg.fillRoundedRect(x, y, COL_W - 8, ROW_H, 5);
    bg.lineStyle(1, locked ? 0x2a2f38 : isSel ? 0x44ff88 : 0x223040, 1);
    bg.strokeRoundedRect(x, y, COL_W - 8, ROW_H, 5);
    const spriteKey = this.scene.textures.exists(def.spriteKey)
      ? def.spriteKey
      : `ship_${def.faction}_${def.baseStats.size}`;
    const sprite = this.scene.add
      .image(x + 18, y + ROW_H / 2, spriteKey)
      .setDisplaySize(32, 32)
      .setAlpha(locked ? 0.35 : 1);
    const nameT = this.scene.add.text(x + 38, y + 6, def.name, {
      font: `bold 12px Arial`,
      color: locked ? "#5a6472" : isSel ? "#88ffcc" : "#d8ecff",
    });
    const ptsT = this.scene.add
      .text(x + COL_W - 12, y + 6, `${def.baseStats.pointCost}pt`, {
        font: "11px Arial",
        color: locked ? "#556" : isSel ? "#aaddaa" : "#88aa66",
      })
      .setOrigin(1, 0);
    const roleT = this.scene.add.text(
      x + 38,
      y + 24,
      def.role.replace(/_/g, " "),
      {
        font: "10px Arial",
        color: locked ? "#48505c" : isSel ? "#55cc88" : "#5a8060",
      },
    );
    return [bg, sprite, nameT, ptsT, roleT];
  }

  private buildTags(
    def: ShipDefinition,
    x: number,
    y: number,
  ): Phaser.GameObjects.Text[] {
    const tagObjs: Phaser.GameObjects.Text[] = [];
    let tagX = x + 38 + 72;
    for (const tag of secondaryTags(def)) {
      const tObj = this.scene.add.text(tagX, y + 24, tag, {
        font: "8px Arial",
        color: "#446688",
        backgroundColor: "#0a1520",
        padding: { x: 3, y: 1 },
      });
      tagObjs.push(tObj);
      tagX += (tObj.width ?? 40) + 4;
    }
    return tagObjs;
  }

  private buildLockBadge(
    def: ShipDefinition,
    x: number,
    y: number,
  ): Phaser.GameObjects.GameObject[] {
    const reason = this.gating.reasonFor(def.id);
    const badge = this.scene.add
      .text(x + COL_W - 14, y + 26, `\uD83D\uDD12 ${reason}`, {
        font: "8px Arial",
        color: "#c8a24a",
      })
      .setOrigin(1, 0);
    return [badge];
  }

  private buildRowHit(
    def: ShipDefinition,
    x: number,
    y: number,
    locked: boolean,
  ): Phaser.GameObjects.Rectangle {
    const hit = this.scene.add
      .rectangle(x + (COL_W - 8) / 2, y + ROW_H / 2, COL_W - 8, ROW_H, 0, 0)
      .setInteractive({ useHandCursor: !locked });
    hit.on("pointerdown", () => {
      if (locked) return;
      this.staging.selectShip(def.id);
      this.render();
    });
    hit.on("pointerover", () => {
      const selLd = getShipLoadouts(def.id).find(
        (l) => l.id === this.staging.getSelectedLoadoutId(),
      );
      const b = computeLoadoutBonuses(selLd?.upgrades ?? []);
      this.tooltip.show(def, CAT_X + CAT_W + 8, this.gridContainer.y + y, b);
    });
    hit.on("pointerout", () => this.tooltip.hide());
    return hit;
  }
}
