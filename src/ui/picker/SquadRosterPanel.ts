/**
 * SquadRosterPanel — right panel of ShipPickerScene.
 * Shows the current squad as instance rows (one holo card per ship+loadout
 * slot) under a points gauge. Hovering a row reveals stats, lore and
 * upgrade effects in the block below the rows (RosterHoverDetail).
 *
 * Emits: 'removeInstance' { id: string }
 */

import Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import type { FactionId } from "../../config";
import { getShipLoadouts, type ShipLoadout } from "../../data/ShipLoadouts";
import { drawHoloFrame, drawHoloGauge } from "../menu/holoChrome";
import {
  factionAccent,
  HOLO_ALPHA,
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_RADIUS,
  HOLO_SPACING,
} from "../theme/HoloTheme";
import { addPickerText, drawPickerCard } from "./pickerStyle";
import { drawRosterHoverDetail } from "./RosterHoverDetail";
import {
  drawRosterRemoveButton,
  drawRosterRowContent,
  ROSTER_ROW,
} from "./RosterRow";

export interface SquadInstance {
  id: string;
  shipId: string;
  loadoutId: string | null;
}

/** Roster column width (right column of the picker). */
export const ROSTER_W = 256;
/** Roster left edge — right-aligned on the 32-px menu margin of a 1280 canvas. */
export const ROSTER_X = 1280 - HOLO_SPACING.xxl - ROSTER_W;

const TOP_Y = 104;
const PANEL_H = 528;
const PAD = HOLO_SPACING.md;
const MAX_ROWS = 7;

/** Vertical layout, relative to TOP_Y. */
const LAYOUT = {
  headerY: 14,
  gaugeY: 36,
  gaugeH: 4,
  rowsY: 52,
  rowPitch: 40,
  overflowGap: 2,
  dividerGap: 20,
  detailGap: 12,
} as const;
const ROWS_BOTTOM = TOP_Y + LAYOUT.rowsY + MAX_ROWS * LAYOUT.rowPitch;
const DETAIL_TOP = ROWS_BOTTOM + LAYOUT.dividerGap + LAYOUT.detailGap;

export class SquadRosterPanel extends Phaser.Events.EventEmitter {
  private container!: Phaser.GameObjects.Container;
  private detailContainer!: Phaser.GameObjects.Container;
  private rowBgMap = new Map<string, Phaser.GameObjects.Graphics>();
  private hoveredId: string | null = null;
  private instances: SquadInstance[] = [];
  private ships: ShipDefinition[] = [];
  private pointLimit = 200;
  private readonly accent: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly factionId: FactionId,
  ) {
    super();
    this.accent = factionAccent(this.factionId);
  }

  /** Full re-render (called when roster changes) */
  render(
    instances: SquadInstance[],
    ships: ShipDefinition[],
    pointLimit: number,
  ): void {
    this.instances = instances;
    this.ships = ships;
    this.pointLimit = pointLimit;
    this.hoveredId = null;
    this.rowBgMap.clear();
    this.container?.destroy();
    this.detailContainer?.destroy();
    this.container = this.scene.add.container(0, 0);
    this.drawBackground();
    this.drawHeader();
    if (instances.length === 0) {
      this.drawEmptyState();
    } else {
      this.drawInstanceRows();
    }
    this.detailContainer = this.scene.add.container(0, 0);
    this.drawDetailSection();
  }

  destroy(): void {
    this.container?.destroy();
    this.detailContainer?.destroy();
    super.destroy();
  }

  private drawBackground(): void {
    const g = this.scene.add.graphics();
    drawHoloFrame(
      g,
      { x: ROSTER_X, y: TOP_Y, width: ROSTER_W, height: PANEL_H },
      { accent: this.accent, radius: HOLO_RADIUS.lg },
    );
    g.lineStyle(HOLO_BORDER.hairline, this.accent, HOLO_ALPHA.structure);
    const dividerY = ROWS_BOTTOM + LAYOUT.dividerGap;
    g.lineBetween(
      ROSTER_X + PAD,
      dividerY,
      ROSTER_X + ROSTER_W - PAD,
      dividerY,
    );
    this.container.add(g);
  }

  private drawHeader(): void {
    const total = this.computeTotal();
    const over = total > this.pointLimit;
    const count = this.instances.length;
    const gauge = this.scene.add.graphics();
    drawHoloGauge(
      gauge,
      {
        x: ROSTER_X + PAD,
        y: TOP_Y + LAYOUT.gaugeY,
        width: ROSTER_W - PAD * 2,
        height: LAYOUT.gaugeH,
      },
      total / Math.max(1, this.pointLimit),
      over ? HOLO_PALETTE.danger : HOLO_PALETTE.success,
    );
    this.container.add([
      addPickerText(
        this.scene,
        { x: ROSTER_X + PAD, y: TOP_Y + LAYOUT.headerY },
        "SQUAD",
        "heading",
        HOLO_PALETTE.textPrimary,
      ).setOrigin(0, 0.5),
      addPickerText(
        this.scene,
        { x: ROSTER_X + ROSTER_W - PAD, y: TOP_Y + LAYOUT.headerY },
        `${count} ${count === 1 ? "SHIP" : "SHIPS"}`,
        "caption",
        HOLO_PALETTE.textSecondary,
      ).setOrigin(1, 0.5),
      gauge,
    ]);
  }

  private drawEmptyState(): void {
    this.container.add(
      addPickerText(
        this.scene,
        {
          x: ROSTER_X + ROSTER_W / 2,
          y: TOP_Y + LAYOUT.rowsY + (MAX_ROWS * LAYOUT.rowPitch) / 2,
        },
        "Select a ship on the left,\nthen click  \u2192  ADD TO SQUAD",
        "body",
        HOLO_PALETTE.textMuted,
      )
        .setAlign("center")
        .setOrigin(0.5),
    );
  }

  private drawInstanceRows(): void {
    this.instances.slice(0, MAX_ROWS).forEach((inst, i) => {
      this.drawInstanceRow(inst, this.rowY(i));
    });
    if (this.instances.length > MAX_ROWS) {
      this.container.add(
        addPickerText(
          this.scene,
          { x: ROSTER_X + PAD, y: ROWS_BOTTOM + LAYOUT.overflowGap },
          `+${this.instances.length - MAX_ROWS} more \u2014 remove some to see all`,
          "micro",
          HOLO_PALETTE.textMuted,
        ),
      );
    }
  }

  private rowY(index: number): number {
    return TOP_Y + LAYOUT.rowsY + index * LAYOUT.rowPitch;
  }

  private loadoutOf(inst: SquadInstance): ShipLoadout | null {
    return (
      getShipLoadouts(inst.shipId).find((l) => l.id === inst.loadoutId) ?? null
    );
  }

  private drawInstanceRow(inst: SquadInstance, y: number): void {
    const def = this.ships.find((s) => s.id === inst.shipId);
    if (!def) return;
    const bg = this.scene.add.graphics();
    this.paintRowBg(bg, y, this.hoveredId === inst.id);
    this.rowBgMap.set(inst.id, bg);
    this.container.add(bg);
    const box = { x: ROSTER_X + PAD, y, width: ROSTER_W - PAD * 2 };
    drawRosterRowContent(this.scene, this.container, {
      ...box,
      def,
      loadout: this.loadoutOf(inst),
      dupeCount: this.instances.filter((i) => i.shipId === inst.shipId).length,
    });
    drawRosterRemoveButton(this.scene, this.container, box, () =>
      this.emit("removeInstance", { id: inst.id }),
    );

    const hitW = box.width - ROSTER_ROW.removeSize;
    const hit = this.scene.add
      .rectangle(
        box.x + hitW / 2,
        y + ROSTER_ROW.height / 2,
        hitW,
        ROSTER_ROW.height,
        0,
        0,
      )
      .setInteractive();
    hit.on("pointerover", () => this.setHovered(inst.id));
    hit.on("pointerout", () => {
      if (this.hoveredId === inst.id) this.setHovered(null);
    });
    this.container.add(hit);
  }

  private paintRowBg(
    g: Phaser.GameObjects.Graphics,
    y: number,
    hovered: boolean,
  ): void {
    g.clear();
    drawPickerCard(
      g,
      {
        x: ROSTER_X + PAD,
        y,
        width: ROSTER_W - PAD * 2,
        height: ROSTER_ROW.height,
      },
      hovered ? "selected" : "idle",
      this.accent,
    );
  }

  /** Update only the hovered state without a full re-render */
  private setHovered(id: string | null): void {
    if (this.hoveredId === id) return;
    const prev = this.hoveredId;
    this.hoveredId = id;
    this.updateRowBgHighlight(prev, false);
    this.updateRowBgHighlight(id, true);
    this.detailContainer?.destroy();
    this.detailContainer = this.scene.add.container(0, 0);
    this.drawDetailSection();
  }

  private updateRowBgHighlight(
    instanceId: string | null,
    hovered: boolean,
  ): void {
    if (!instanceId) return;
    const i = this.instances.findIndex((inst) => inst.id === instanceId);
    if (i < 0 || i >= MAX_ROWS) return;
    const bg = this.rowBgMap.get(instanceId);
    if (!bg) return;
    this.paintRowBg(bg, this.rowY(i), hovered);
  }

  private drawDetailSection(): void {
    const inst = this.instances.find((i) => i.id === this.hoveredId);
    const def = inst ? this.ships.find((s) => s.id === inst.shipId) : undefined;
    const subject = inst && def ? { def, loadout: this.loadoutOf(inst) } : null;
    drawRosterHoverDetail(this.scene, this.detailContainer, subject, {
      x: ROSTER_X + PAD,
      y: DETAIL_TOP,
      width: ROSTER_W - PAD * 2,
      height: TOP_Y + PANEL_H - PAD - DETAIL_TOP,
    });
  }

  private computeTotal(): number {
    return this.instances.reduce((sum, inst) => {
      const def = this.ships.find((s) => s.id === inst.shipId);
      const loadout = getShipLoadouts(inst.shipId).find(
        (l) => l.id === inst.loadoutId,
      );
      return sum + (loadout?.pointCost ?? def?.baseStats.pointCost ?? 0);
    }, 0);
  }
}
