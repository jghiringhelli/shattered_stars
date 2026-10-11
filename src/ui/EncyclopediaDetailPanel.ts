/**
 * EncyclopediaDetailPanel
 *
 * The right-side panel in EncyclopediaScene: a HoloPanel bordered in the
 * selected ship's faction accent (faction name in the header strip), framed
 * cinematic art, the ship name as a heading, a role chip, lore body text
 * fitted to its column (never overlapping the stats), and the combat stat
 * gauges below.
 */

import Phaser from "phaser";
import type { FactionId } from "../config";
import type { EncyclopediaEntry } from "../data/ShipEncyclopedia";
import { getShipDefinition } from "../data/ShipDefinitions";
import { addContainedImage } from "./picker/catalogHelpers";
import { createHoloPanel, type HoloPanel } from "./hud/HoloPanel";
import { drawHoloFrame, type HoloRect } from "./menu/holoChrome";
import { holoFont } from "./theme/holoFont";
import { toCssColor } from "./theme/colorMath";
import {
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_RADIUS,
  HOLO_SPACING,
  HOLO_TYPE_SCALE,
  factionAccent,
} from "./theme/HoloTheme";
import {
  PANEL_HEADER_HEIGHT,
  ROLE_COLORS,
  snakeToLabel,
} from "./encyclopedia/encyclopediaLayout";
import { EncyclopediaStatBlock } from "./encyclopedia/EncyclopediaStatBlock";
import { fitLoreText, LORE_STYLE } from "./encyclopedia/loreFit";

/** Detail panel geometry. */
const DETAIL_LAYOUT = {
  /** Inner padding. */
  padding: HOLO_SPACING.lg,
  /** Art frame height. */
  artHeight: 256,
  /** Inset of the art image inside its frame. */
  artInset: HOLO_SPACING.xs,
  /** Gap between the art/text row and the stats block. */
  statsGap: HOLO_SPACING.xl,
  /** Ship name size. */
  nameSize: 22,
  /** Role chip height and horizontal padding. */
  chipHeight: 22,
  chipPaddingX: HOLO_SPACING.md,
  /** Art frame fill opacity (darker than the panel). */
  artFillAlpha: 0.85,
  /** Art frame border opacity. */
  artBorderAlpha: 0.6,
  /** Role chip fill opacity. */
  chipFillAlpha: 0.18,
} as const;

/** Detail view of one encyclopedia entry. */
export class EncyclopediaDetailPanel {
  private readonly scene: Phaser.Scene;
  private readonly panel: HoloPanel;
  private readonly artRect: HoloRect;
  private readonly textColumn: HoloRect;
  private readonly artFrame: Phaser.GameObjects.Graphics;
  private readonly artPlaceholderLabel: Phaser.GameObjects.Text;
  private artImage: Phaser.GameObjects.Image | null = null;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly roleBadge: Phaser.GameObjects.Graphics;
  private readonly roleText: Phaser.GameObjects.Text;
  private readonly loreText: Phaser.GameObjects.Text;
  private readonly stats: EncyclopediaStatBlock;

  /**
   * @param scene - Owning scene.
   * @param area - Panel bounds in world coordinates.
   */
  constructor(scene: Phaser.Scene, area: HoloRect) {
    this.scene = scene;
    const pad = DETAIL_LAYOUT.padding;
    this.panel = createHoloPanel(
      scene,
      area.x + area.width / 2,
      area.y + area.height / 2,
      { width: area.width, height: area.height, title: " " },
    );
    const top = area.y + PANEL_HEADER_HEIGHT + pad;
    const columnWidth = (area.width - pad * 3) / 2;
    this.artRect = {
      x: area.x + pad,
      y: top,
      width: columnWidth,
      height: DETAIL_LAYOUT.artHeight,
    };
    this.textColumn = {
      x: this.artRect.x + columnWidth + pad,
      y: top,
      width: columnWidth,
      height: DETAIL_LAYOUT.artHeight,
    };
    this.artFrame = scene.add.graphics();
    this.artPlaceholderLabel = this.createPlaceholderLabel();
    this.nameText = this.createNameText();
    this.roleBadge = scene.add.graphics();
    this.roleText = this.createRoleText();
    this.loreText = this.createLoreText();
    const statsTop = top + DETAIL_LAYOUT.artHeight + DETAIL_LAYOUT.statsGap;
    this.stats = new EncyclopediaStatBlock(
      scene,
      {
        x: area.x + pad,
        y: statsTop,
        width: area.width - pad * 2,
        height: area.y + area.height - pad - statsTop,
      },
      HOLO_PALETTE.accent,
    );
  }

  /**
   * Update the panel to display the given encyclopedia entry.
   * @param entry - The encyclopedia entry to display.
   */
  show(entry: EncyclopediaEntry): void {
    const faction = getShipDefinition(entry.shipId)?.faction;
    const accent = factionAccent(faction);
    this.panel.setAccent(accent).setTitle(this.factionTitle(faction));
    this.stats.setAccent(accent);
    this.updateArt(entry, accent);
    this.updateTextBlocks(entry);
    this.stats.show(entry);
  }

  private factionTitle(faction: FactionId | undefined): string {
    return faction ? snakeToLabel(faction) : "UNKNOWN ORIGIN";
  }

  private createPlaceholderLabel(): Phaser.GameObjects.Text {
    const { x, y, width, height } = this.artRect;
    return this.scene.add
      .text(x + width / 2, y + height / 2, "", {
        ...holoFont(HOLO_TYPE_SCALE.body.size - 1, "400"),
        color: toCssColor(HOLO_PALETTE.textMuted),
        align: "center",
        wordWrap: { width: width - DETAIL_LAYOUT.padding * 2 },
      })
      .setOrigin(0.5);
  }

  private createRoleText(): Phaser.GameObjects.Text {
    const caption = HOLO_TYPE_SCALE.caption;
    return this.scene.add
      .text(0, 0, "", {
        ...holoFont(caption.size, caption.weight),
        color: toCssColor(HOLO_PALETTE.textPrimary),
      })
      .setLetterSpacing(caption.letterSpacing)
      .setOrigin(0, 0.5);
  }

  private createLoreText(): Phaser.GameObjects.Text {
    return this.scene.add.text(this.textColumn.x, 0, "", {
      ...holoFont(LORE_STYLE.sizes[0], "400"),
      color: toCssColor(HOLO_PALETTE.textSecondary),
      wordWrap: { width: this.textColumn.width, useAdvancedWrap: true },
      lineSpacing: LORE_STYLE.lineSpacing,
    });
  }

  private createNameText(): Phaser.GameObjects.Text {
    const { x, y, width } = this.textColumn;
    return this.scene.add.text(x, y, "", {
      ...holoFont(DETAIL_LAYOUT.nameSize, HOLO_TYPE_SCALE.heading.weight),
      color: toCssColor(HOLO_PALETTE.textPrimary),
      wordWrap: { width },
    });
  }

  private updateArt(entry: EncyclopediaEntry, accent: number): void {
    const { scene, artRect } = this;
    this.artImage?.destroy();
    this.artImage = null;
    this.artFrame.clear();
    drawHoloFrame(this.artFrame, artRect, {
      accent,
      fillAlpha: DETAIL_LAYOUT.artFillAlpha,
      borderAlpha: DETAIL_LAYOUT.artBorderAlpha,
      radius: HOLO_RADIUS.sm,
      cornerTicks: true,
    });
    if (!scene.textures.exists(entry.artKey)) {
      this.artPlaceholderLabel.setText(
        "[ Art not generated — run scripts/generate_ship_art.py ]",
      );
      return;
    }
    const inset = DETAIL_LAYOUT.artInset;
    this.artImage = addContainedImage(
      scene,
      entry.artKey,
      artRect.x + artRect.width / 2,
      artRect.y + artRect.height / 2,
      artRect.width - inset * 2,
      artRect.height - inset * 2,
    );
    this.artPlaceholderLabel.setText("");
  }

  private updateTextBlocks(entry: EncyclopediaEntry): void {
    const def = getShipDefinition(entry.shipId);
    this.nameText.setText(def?.name ?? entry.shipId);
    const chipTop = this.nameText.y + this.nameText.height + HOLO_SPACING.sm;
    this.drawRoleChip(def?.role, chipTop);
    const loreTop = chipTop + DETAIL_LAYOUT.chipHeight + HOLO_SPACING.md;
    this.loreText.setY(loreTop);
    fitLoreText(
      this.loreText,
      entry.lore,
      this.textColumn.y + this.textColumn.height - loreTop,
    );
  }

  private drawRoleChip(role: string | undefined, top: number): void {
    const label = snakeToLabel(role ?? "");
    const color =
      role !== undefined && role in ROLE_COLORS
        ? ROLE_COLORS[role as keyof typeof ROLE_COLORS]
        : HOLO_PALETTE.textSecondary;
    const padX = DETAIL_LAYOUT.chipPaddingX;
    this.roleText.setText(label);
    this.roleText.setPosition(
      this.textColumn.x + padX,
      top + DETAIL_LAYOUT.chipHeight / 2,
    );
    this.roleBadge.clear();
    if (!label) return;
    drawHoloFrame(
      this.roleBadge,
      {
        x: this.textColumn.x,
        y: top,
        width: this.roleText.width + padX * 2,
        height: DETAIL_LAYOUT.chipHeight,
      },
      {
        accent: color,
        fill: color,
        fillAlpha: DETAIL_LAYOUT.chipFillAlpha,
        borderWidth: HOLO_BORDER.regular,
        borderAlpha: 1,
        radius: DETAIL_LAYOUT.chipHeight / 2,
      },
    );
  }
}
