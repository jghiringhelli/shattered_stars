/**
 * CodexTextPanel — the encyclopedia's detail view for a pilot, upgrade card
 * or faction: name, subtitle and labelled paragraphs (ability text, real-time
 * reading, role hint, the quick builds that fly it). An opaque HoloPanel
 * drawn above the ship detail panel in the same region; shown or hidden as
 * the section changes. Text shrinks to fit the panel.
 */

import Phaser from "phaser";
import type { CodexEntry } from "../../data/encyclopedia/codex";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import type { HoloRect } from "../menu/holoChrome";
import { holoFont } from "../theme/holoFont";
import { toCssColor } from "../theme/colorMath";
import {
  HOLO_PALETTE,
  HOLO_SPACING,
  HOLO_TYPE_SCALE,
  factionAccent,
} from "../theme/HoloTheme";
import { PANEL_HEADER_HEIGHT } from "./encyclopediaLayout";

/** Renders above the ship panel (and its late-loading art). */
const PANEL_DEPTH = 10;
/** Typography: name, subtitle and body sizes (body shrinks to fit). */
const TEXT_STYLE = {
  nameSize: 22,
  subtitleSize: 13,
  bodySizes: [14, 13, 12, 11] as readonly number[],
  headingGap: 2,
  paragraphGap: 10,
  lineSpacing: 3,
} as const;

/** Detail view of a non-ship codex entry. */
export class CodexTextPanel {
  private readonly root: Phaser.GameObjects.Container;
  private readonly panel: HoloPanel;
  private readonly body: Phaser.GameObjects.Container;
  private readonly content: HoloRect;

  /**
   * @param scene - Owning scene.
   * @param area - Panel bounds (the detail region).
   */
  constructor(
    private readonly scene: Phaser.Scene,
    area: HoloRect,
  ) {
    const backing = scene.add.graphics();
    backing.fillStyle(HOLO_PALETTE.panelFill, 1);
    backing.fillRect(area.x, area.y, area.width, area.height);
    this.panel = createHoloPanel(
      scene,
      area.x + area.width / 2,
      area.y + area.height / 2,
      { width: area.width, height: area.height, title: " " },
    );
    const pad = HOLO_SPACING.lg;
    const top = area.y + PANEL_HEADER_HEIGHT + pad;
    this.content = {
      x: area.x + pad,
      y: top,
      width: area.width - pad * 2,
      height: area.y + area.height - pad - top,
    };
    this.body = scene.add.container(0, 0);
    this.root = scene.add
      .container(0, 0, [backing, this.panel, this.body])
      .setDepth(PANEL_DEPTH)
      .setVisible(false);
  }

  /** Whether the panel is on screen. */
  get visible(): boolean {
    return this.root.visible;
  }

  /**
   * Show an entry.
   * @param entry - The pilot, upgrade or faction entry.
   */
  show(entry: CodexEntry): void {
    const accent = factionAccent(entry.faction ?? undefined);
    this.panel.setAccent(accent).setTitle(entry.tag);
    this.body.removeAll(true);
    for (const size of TEXT_STYLE.bodySizes) {
      if (this.layout(entry, accent, size) <= this.content.height) break;
      this.body.removeAll(true);
    }
    if (this.body.length === 0) {
      this.layout(entry, accent, TEXT_STYLE.bodySizes.at(-1)!);
    }
    this.root.setVisible(true);
  }

  /** Hide the panel (the ship detail panel shows through). */
  hide(): void {
    this.root.setVisible(false);
  }

  /**
   * Lay out an entry at one body size.
   * @param entry - The entry.
   * @param accent - Heading colour.
   * @param bodySize - Body font size.
   * @returns Height used.
   */
  private layout(entry: CodexEntry, accent: number, bodySize: number): number {
    let y = this.content.y;
    y += this.addText(entry.name, TEXT_STYLE.nameSize, "700", y).height;
    const subtitle = this.addText(
      entry.subtitle,
      TEXT_STYLE.subtitleSize,
      "400",
      y,
    );
    subtitle.setColor(toCssColor(HOLO_PALETTE.textSecondary));
    y += subtitle.height + TEXT_STYLE.paragraphGap;
    for (const paragraph of entry.paragraphs) {
      const caption = HOLO_TYPE_SCALE.caption;
      const heading = this.addText(
        paragraph.heading,
        caption.size,
        caption.weight,
        y,
      );
      heading
        .setColor(toCssColor(accent))
        .setLetterSpacing(caption.letterSpacing);
      y += heading.height + TEXT_STYLE.headingGap;
      y += this.addText(paragraph.text, bodySize, "400", y).height;
      y += TEXT_STYLE.paragraphGap;
    }
    return y - this.content.y;
  }

  private addText(
    content: string,
    size: number,
    weight: string,
    y: number,
  ): Phaser.GameObjects.Text {
    const text = this.scene.add.text(this.content.x, y, content, {
      ...holoFont(size, weight),
      color: toCssColor(HOLO_PALETTE.textPrimary),
      wordWrap: { width: this.content.width, useAdvancedWrap: true },
      lineSpacing: TEXT_STYLE.lineSpacing,
    });
    this.body.add(text);
    return text;
  }
}
