/**
 * EncyclopediaShipList — the scrollable list of the encyclopedia (ships,
 * pilots, upgrade cards or factions): a HoloPanel ("SHIPS · N" header,
 * filter accent border), masked rows, a thin scroll indicator and the
 * selected-row state.
 */

import Phaser from "phaser";
import type { CodexEntry } from "../../data/encyclopedia/codex";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import type { HoloRect } from "../menu/holoChrome";
import { HOLO_PALETTE, HOLO_SPACING, factionAccent } from "../theme/HoloTheme";
import { ENCYCLOPEDIA_LAYOUT, PANEL_HEADER_HEIGHT } from "./encyclopediaLayout";
import { EncyclopediaShipRow } from "./EncyclopediaShipRow";

/** Scroll indicator geometry. */
const SCROLLBAR = { width: 3, gap: HOLO_SPACING.xs, minThumb: 24 } as const;
/** Scroll indicator track opacity. */
const SCROLL_TRACK_ALPHA = 0.12;
/** Panel header size (px) — nothing under 12 px at 1280x720. */
const PANEL_TITLE_PX = 12;

/** Scrollable, selectable ship list. */
export class EncyclopediaShipList {
  private readonly panel: HoloPanel;
  private readonly rowsContainer: Phaser.GameObjects.Container;
  private readonly scrollbar: Phaser.GameObjects.Graphics;
  private readonly viewport: HoloRect;
  private rows: EncyclopediaShipRow[] = [];
  private scrollY = 0;

  /**
   * @param scene - Owning scene.
   * @param area - Panel bounds.
   * @param onSelect - Invoked with an entry id when a row is pressed.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    area: HoloRect,
    private readonly onSelect: (id: string) => void,
  ) {
    this.panel = createHoloPanel(
      scene,
      area.x + area.width / 2,
      area.y + area.height / 2,
      { width: area.width, height: area.height, title: "SHIPS", titleSize: PANEL_TITLE_PX },
    );
    const inset = HOLO_SPACING.sm;
    const top = area.y + PANEL_HEADER_HEIGHT + inset;
    this.viewport = {
      x: area.x + inset,
      y: top,
      width: area.width - inset * 2 - SCROLLBAR.width - SCROLLBAR.gap,
      height: area.y + area.height - inset - top,
    };
    this.rowsContainer = scene.add.container(this.viewport.x, top);
    const maskShape = scene.make.graphics({}, false);
    maskShape.fillStyle(HOLO_PALETTE.panelFill, 1);
    maskShape.fillRect(
      this.viewport.x,
      this.viewport.y,
      this.viewport.width,
      this.viewport.height,
    );
    this.rowsContainer.setMask(maskShape.createGeometryMask());
    this.scrollbar = scene.add.graphics();
  }

  /**
   * Replace the listed entries.
   *
   * @param entries - Entries to list, in order.
   * @param accent - Panel accent (active faction or neutral).
   * @param title - Panel title before the count (e.g. "SHIPS").
   */
  setEntries(
    entries: ReadonlyArray<CodexEntry>,
    accent: number,
    title: string,
  ): void {
    this.rowsContainer.removeAll(true);
    this.rows = entries.map((entry, i) => this.createRow(entry, i));
    this.panel.setAccent(accent).setTitle(`${title} · ${entries.length}`);
    this.scrollTo(0);
  }

  /**
   * Highlight the row of an entry and scroll it into view.
   *
   * @param id - Selected entry id.
   */
  setSelected(id: string): void {
    this.rows.forEach((row, i) => {
      const selected = row.id === id;
      row.setSelected(selected);
      if (selected) this.ensureVisible(i);
    });
  }

  /**
   * Scroll by a pixel delta (mouse wheel).
   *
   * @param delta - Positive scrolls down.
   */
  scrollBy(delta: number): void {
    this.scrollTo(this.scrollY + delta);
  }

  private get maxScroll(): number {
    return Math.max(0, this.rows.length * this.rowPitch - this.viewport.height);
  }

  private get rowPitch(): number {
    return ENCYCLOPEDIA_LAYOUT.rowHeight + ENCYCLOPEDIA_LAYOUT.rowGap;
  }

  private createRow(entry: CodexEntry, index: number): EncyclopediaShipRow {
    const row = new EncyclopediaShipRow(
      this.scene,
      {
        id: entry.id,
        name: entry.name,
        caption: entry.tag,
        accent: factionAccent(entry.faction ?? undefined),
      },
      { width: this.viewport.width, height: ENCYCLOPEDIA_LAYOUT.rowHeight },
      {
        onSelect: this.onSelect,
        isInViewport: (pointer) => this.contains(pointer),
      },
    );
    row.container.setY(index * this.rowPitch);
    this.rowsContainer.add(row.container);
    return row;
  }

  private contains(pointer: Phaser.Input.Pointer): boolean {
    const { x, y, width, height } = this.viewport;
    return (
      pointer.x >= x &&
      pointer.x <= x + width &&
      pointer.y >= y &&
      pointer.y <= y + height
    );
  }

  private ensureVisible(index: number): void {
    const top = index * this.rowPitch;
    const bottom = top + ENCYCLOPEDIA_LAYOUT.rowHeight;
    if (top < this.scrollY) this.scrollTo(top);
    else if (bottom > this.scrollY + this.viewport.height)
      this.scrollTo(bottom - this.viewport.height);
  }

  private scrollTo(offset: number): void {
    this.scrollY = Phaser.Math.Clamp(offset, 0, this.maxScroll);
    this.rowsContainer.setY(this.viewport.y - this.scrollY);
    this.drawScrollbar();
  }

  private drawScrollbar(): void {
    const g = this.scrollbar;
    g.clear();
    const max = this.maxScroll;
    if (max <= 0) return;
    const { y, height } = this.viewport;
    const x = this.viewport.x + this.viewport.width + SCROLLBAR.gap;
    const content = this.rows.length * this.rowPitch;
    const thumb = Math.max(SCROLLBAR.minThumb, (height / content) * height);
    const thumbY = y + (this.scrollY / max) * (height - thumb);
    g.fillStyle(HOLO_PALETTE.track, SCROLL_TRACK_ALPHA);
    g.fillRect(x, y, SCROLLBAR.width, height);
    g.fillStyle(HOLO_PALETTE.accent, 1);
    g.fillRect(x, thumbY, SCROLLBAR.width, thumb);
  }
}
