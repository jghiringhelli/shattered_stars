/**
 * MainMenuBriefing — the right-hand holo panel on the main menu that
 * explains the highlighted entry (glyph, name, one-line description).
 */

import Phaser from "phaser";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import { drawMenuIcon } from "./MenuIcons";
import type { MainMenuEntry } from "./mainMenuEntries";
import { holoFont } from "../theme/holoFont";
import {
  HOLO_PALETTE,
  HOLO_SPACING,
  HOLO_TYPE_SCALE,
} from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";

/** Panel geometry. */
const BRIEFING = {
  width: 320,
  height: 184,
  iconSize: 30,
  iconBox: 52,
  headingSize: 20,
} as const;

/** Holo briefing panel describing the highlighted main-menu entry. */
export class MainMenuBriefing {
  private readonly panel: HoloPanel;
  private readonly icon: Phaser.GameObjects.Graphics;
  private readonly heading: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;

  /**
   * @param scene - Main menu scene.
   * @param x - Panel centre x.
   * @param y - Panel centre y.
   */
  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.panel = createHoloPanel(scene, x, y, {
      width: BRIEFING.width,
      height: BRIEFING.height,
      title: "Briefing",
    });
    const left = -BRIEFING.width / 2 + HOLO_SPACING.lg;
    const top = this.panel.contentTop + HOLO_SPACING.xs;
    this.icon = scene.add.graphics({
      x: left + BRIEFING.iconBox / 2,
      y: top + BRIEFING.iconBox / 2,
    });
    this.heading = scene.add
      .text(
        left + BRIEFING.iconBox + HOLO_SPACING.md,
        top + BRIEFING.iconBox / 2,
        "",
        {
          ...holoFont(BRIEFING.headingSize, "600"),
          color: toCssColor(HOLO_PALETTE.textPrimary),
        },
      )
      .setLetterSpacing(3)
      .setOrigin(0, 0.5);
    this.body = scene.add
      .text(left, top + BRIEFING.iconBox + HOLO_SPACING.md, "", {
        ...holoFont(HOLO_TYPE_SCALE.body.size, HOLO_TYPE_SCALE.body.weight),
        color: toCssColor(HOLO_PALETTE.textSecondary),
        wordWrap: { width: BRIEFING.width - HOLO_SPACING.lg * 2 },
        lineSpacing: HOLO_SPACING.xs,
      })
      .setOrigin(0, 0);
    this.panel.add([this.icon, this.heading, this.body]);
    const hint = scene.add
      .text(
        left,
        BRIEFING.height / 2 - HOLO_SPACING.md,
        "ENTER OR CLICK TO LAUNCH",
        {
          ...holoFont(HOLO_TYPE_SCALE.caption.size, "600"),
          color: toCssColor(HOLO_PALETTE.textMuted),
        },
      )
      .setLetterSpacing(HOLO_TYPE_SCALE.caption.letterSpacing)
      .setOrigin(0, 1);
    this.panel.add(hint);
  }

  /** The panel container (for entrance tweens). */
  get container(): HoloPanel {
    return this.panel;
  }

  /**
   * Show an entry's briefing.
   *
   * @param entry - Highlighted main-menu entry.
   */
  show(entry: MainMenuEntry): void {
    const half = BRIEFING.iconBox / 2;
    this.icon.clear();
    this.icon.fillStyle(HOLO_PALETTE.accent, 0.12);
    this.icon.fillCircle(0, 0, half);
    this.icon.lineStyle(1, HOLO_PALETTE.accent, 0.6);
    this.icon.strokeCircle(0, 0, half);
    drawMenuIcon(
      this.icon,
      entry.icon,
      { x: 0, y: 0 },
      BRIEFING.iconSize,
      HOLO_PALETTE.accent,
    );
    this.heading.setText(entry.label);
    this.body.setText(entry.description);
  }
}
