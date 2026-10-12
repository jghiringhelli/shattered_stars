/**
 * CodexSearchField — the encyclopedia's type-to-search box: a holo frame
 * showing the query with a caret, or a hint while it is empty. The scene
 * owns the keyboard; this only displays.
 */

import Phaser from "phaser";
import { drawHoloFrame, type HoloRect } from "../menu/holoChrome";
import { holoFont } from "../theme/holoFont";
import { toCssColor } from "../theme/colorMath";
import { HOLO_PALETTE, HOLO_RADIUS, HOLO_SPACING } from "../theme/HoloTheme";

/** Field text size. */
const FIELD_TEXT_SIZE = 12;
/** Shown while the query is empty. */
const EMPTY_HINT = "Type to search…";
/** Search glyph before the text. */
const SEARCH_PREFIX = "⌕  ";
/** Caret after a typed query. */
const CARET = "▏";

/** Display-only search box. */
export class CodexSearchField {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;

  /**
   * @param scene - Owning scene.
   * @param area - Field bounds.
   */
  constructor(
    scene: Phaser.Scene,
    private readonly area: HoloRect,
  ) {
    this.frame = scene.add.graphics();
    this.label = scene.add
      .text(area.x + HOLO_SPACING.md, area.y + area.height / 2, "", {
        ...holoFont(FIELD_TEXT_SIZE, "400"),
      })
      .setOrigin(0, 0.5);
    this.setQuery("");
  }

  /**
   * Show the current query (or the hint when it is empty).
   * @param query - The typed text.
   */
  setQuery(query: string): void {
    const empty = query.length === 0;
    this.label
      .setText(SEARCH_PREFIX + (empty ? EMPTY_HINT : query + CARET))
      .setColor(
        toCssColor(empty ? HOLO_PALETTE.textMuted : HOLO_PALETTE.textPrimary),
      );
    this.frame.clear();
    drawHoloFrame(this.frame, this.area, {
      radius: HOLO_RADIUS.sm,
      accent: empty ? HOLO_PALETTE.border : HOLO_PALETTE.accent,
      borderAlpha: empty ? HOLO_PALETTE.borderAlpha : 1,
      fill: HOLO_PALETTE.panelFill,
    });
  }
}
