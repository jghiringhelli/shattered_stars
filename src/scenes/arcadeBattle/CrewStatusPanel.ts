/**
 * CrewStatusPanel — top left of the Skirmish HUD: the crew role as the
 * title, then flight-action readiness (pilot / gunner) or the commander's
 * four orders, each with its key, label and READY / countdown.
 */

import Phaser from "phaser";
import type { HoloPanel } from "../../ui/hud/HoloPanel";
import { addPinned, createHoloText } from "../../ui/hud/holoPrimitives";
import type { ScreenRect } from "../../ui/hud/screenRect";
import { toCssColor } from "../../ui/theme/colorMath";
import { HOLO_PALETTE, HOLO_SPACING } from "../../ui/theme/HoloTheme";
import type { StatusRow } from "./arcadeStatusModel";
import {
  HEADER_HEIGHT,
  PANEL_MARGIN,
  panelRect,
  pinnedPanel,
  setText,
} from "./hudPanelParts";

const CREW = { width: 236, rowHeight: 18 } as const;

/** Crew role, flight-action readiness or commander orders, top left. */
export class CrewStatusPanel {
  private readonly scene: Phaser.Scene;
  private readonly panel: HoloPanel;
  private readonly rows: Array<
    [Phaser.GameObjects.Text, Phaser.GameObjects.Text, Phaser.GameObjects.Text]
  > = [];
  private shownRows = -1;
  private title = "";

  /**
   * @param scene - Owning scene.
   * @param parent - Screen-space HUD root.
   */
  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.panel = pinnedPanel(
      scene,
      parent,
      CREW.width,
      HEADER_HEIGHT * 2,
      "Pilot",
    );
  }

  /** Current panel title (crew role). */
  get crewTitle(): string {
    return this.title;
  }

  /**
   * @param title - Crew role title.
   * @param rows - Action or order rows.
   */
  update(title: string, rows: ReadonlyArray<StatusRow>): void {
    if (title !== this.title) {
      this.title = title;
      this.panel.setTitle(title);
    }
    if (rows.length !== this.shownRows) this.resize(rows.length);
    const top =
      -this.panelHeight(rows.length) / 2 + HEADER_HEIGHT + HOLO_SPACING.sm;
    this.rows.forEach((cells, i) => {
      const row = rows[i];
      cells.forEach((cell) => cell.setVisible(row !== undefined));
      if (row) this.drawRow(cells, row, top + i * CREW.rowHeight);
    });
  }

  /** @returns Panel rect in HUD-root px. */
  bounds(): ScreenRect {
    return panelRect(this.panel, CREW.width, this.panelHeight(this.shownRows));
  }

  private panelHeight(rowCount: number): number {
    return HEADER_HEIGHT + HOLO_SPACING.sm * 2 + rowCount * CREW.rowHeight;
  }

  private resize(rowCount: number): void {
    this.shownRows = rowCount;
    const height = this.panelHeight(rowCount);
    this.panel.resize(CREW.width, height);
    this.panel.setPosition(
      PANEL_MARGIN + CREW.width / 2,
      PANEL_MARGIN + height / 2,
    );
    while (this.rows.length < rowCount) this.rows.push(this.createRow());
  }

  private createRow(): [
    Phaser.GameObjects.Text,
    Phaser.GameObjects.Text,
    Phaser.GameObjects.Text,
  ] {
    const key = createHoloText(
      this.scene,
      0,
      0,
      "",
      "caption",
      HOLO_PALETTE.accent,
    ).setOrigin(0, 0);
    const label = createHoloText(
      this.scene,
      0,
      0,
      "",
      "caption",
      HOLO_PALETTE.textSecondary,
    ).setOrigin(0, 0);
    const status = createHoloText(this.scene, 0, 0, "", "caption").setOrigin(
      1,
      0,
    );
    addPinned(this.panel, key, label, status);
    return [key, label, status];
  }

  private drawRow(
    [key, label, status]: [
      Phaser.GameObjects.Text,
      Phaser.GameObjects.Text,
      Phaser.GameObjects.Text,
    ],
    row: StatusRow,
    y: number,
  ): void {
    const left = -CREW.width / 2 + HOLO_SPACING.md;
    setText(key, row.key);
    setText(label, row.label);
    setText(status, row.status);
    key.setPosition(left, y);
    label.setPosition(left + HOLO_SPACING.xxl + HOLO_SPACING.xs, y);
    status
      .setPosition(CREW.width / 2 - HOLO_SPACING.md, y)
      .setColor(
        toCssColor(row.ready ? HOLO_PALETTE.success : HOLO_PALETTE.warning),
      );
  }
}
