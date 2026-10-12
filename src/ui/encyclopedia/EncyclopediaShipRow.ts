/**
 * EncyclopediaShipRow — one selectable row of the encyclopedia list (a ship,
 * pilot, upgrade card or faction): a faction-accent bar, the name and a
 * right-aligned caption (role, initiative, slot).
 * Idle rows are bare text on the list panel; hover raises the row with a
 * faint accent border and the selected row gets a tinted accent frame.
 */

import Phaser from "phaser";
import { drawHoloFrame } from "../menu/holoChrome";
import { holoFont } from "../theme/holoFont";
import { toCssColor } from "../theme/colorMath";
import {
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_RADIUS,
  HOLO_SPACING,
  HOLO_TYPE_SCALE,
} from "../theme/HoloTheme";

/** Data shown by a row. */
export interface ShipRowModel {
  /** Id of the codex entry the row selects. */
  readonly id: string;
  readonly name: string;
  /** Right-aligned caption (role, initiative, slot). */
  readonly caption: string;
  /** Faction accent of the entry. */
  readonly accent: number;
}

/** Row interaction callbacks. */
export interface ShipRowHandlers {
  /** Invoked when the row is pressed. */
  readonly onSelect: (id: string) => void;
  /** Whether the pointer is inside the visible list viewport. */
  readonly isInViewport: (pointer: Phaser.Input.Pointer) => boolean;
}

/** Row typography and decoration. */
const ROW_STYLE = {
  nameSize: 13,
  roleSize: 10,
  barWidth: 3,
  barInsetY: 8,
  hoverFillAlpha: 0.6,
  hoverBorderAlpha: 0.45,
  selectedFillAlpha: 0.16,
  ellipsis: "…",
} as const;

/** One selectable ship row (origin = row top-left). */
export class EncyclopediaShipRow {
  /** Root container; position it inside the scrolling list. */
  readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly nameText: Phaser.GameObjects.Text;
  private hovered = false;
  private selected = false;

  /**
   * @param scene - Owning scene.
   * @param model - Entry data to show.
   * @param size - Row width and height.
   * @param handlers - Selection and viewport callbacks.
   */
  constructor(
    scene: Phaser.Scene,
    private readonly model: ShipRowModel,
    private readonly size: { readonly width: number; readonly height: number },
    handlers: ShipRowHandlers,
  ) {
    this.container = scene.add.container(0, 0);
    this.background = scene.add.graphics();
    const bar = scene.add.graphics();
    bar.fillStyle(model.accent, 1);
    bar.fillRect(
      HOLO_SPACING.sm,
      ROW_STYLE.barInsetY,
      ROW_STYLE.barWidth,
      size.height - ROW_STYLE.barInsetY * 2,
    );
    const role = this.createRoleText(scene);
    this.nameText = scene.add
      .text(HOLO_SPACING.lg + HOLO_SPACING.xs, size.height / 2, model.name, {
        ...holoFont(ROW_STYLE.nameSize, "400"),
        color: toCssColor(HOLO_PALETTE.textPrimary),
      })
      .setOrigin(0, 0.5);
    const maxNameWidth =
      role.x - role.width - this.nameText.x - HOLO_SPACING.sm;
    fitTextToWidth(this.nameText, model.name, maxNameWidth);
    const hit = scene.add
      .zone(size.width / 2, size.height / 2, size.width, size.height)
      .setInteractive({ useHandCursor: true });
    this.container.add([this.background, bar, this.nameText, role, hit]);
    this.bindPointer(hit, handlers);
    this.redraw();
  }

  /** Codex entry id shown by this row. */
  get id(): string {
    return this.model.id;
  }

  /**
   * Show or clear the selected state.
   *
   * @param selected - New state.
   */
  setSelected(selected: boolean): void {
    this.selected = selected;
    this.redraw();
  }

  private createRoleText(scene: Phaser.Scene): Phaser.GameObjects.Text {
    return scene.add
      .text(
        this.size.width - HOLO_SPACING.md,
        this.size.height / 2,
        this.model.caption,
        {
          ...holoFont(ROW_STYLE.roleSize, HOLO_TYPE_SCALE.caption.weight),
          color: toCssColor(HOLO_PALETTE.textMuted),
        },
      )
      .setLetterSpacing(1)
      .setOrigin(1, 0.5);
  }

  private bindPointer(
    hit: Phaser.GameObjects.Zone,
    handlers: ShipRowHandlers,
  ): void {
    hit.on(
      Phaser.Input.Events.GAMEOBJECT_POINTER_OVER,
      (pointer: Phaser.Input.Pointer) => {
        this.hovered = handlers.isInViewport(pointer);
        this.redraw();
      },
    );
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      this.hovered = false;
      this.redraw();
    });
    hit.on(
      Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN,
      (pointer: Phaser.Input.Pointer) => {
        if (handlers.isInViewport(pointer)) handlers.onSelect(this.model.id);
      },
    );
  }

  private redraw(): void {
    const g = this.background;
    const rect = { x: 0, y: 0, ...this.size };
    g.clear();
    if (this.selected) {
      drawHoloFrame(g, rect, {
        radius: HOLO_RADIUS.sm,
        accent: this.model.accent,
        fill: this.model.accent,
        fillAlpha: ROW_STYLE.selectedFillAlpha,
        borderWidth: HOLO_BORDER.regular,
        borderAlpha: 1,
      });
    } else if (this.hovered) {
      drawHoloFrame(g, rect, {
        radius: HOLO_RADIUS.sm,
        accent: this.model.accent,
        fill: HOLO_PALETTE.panelFillRaised,
        fillAlpha: ROW_STYLE.hoverFillAlpha,
        borderAlpha: ROW_STYLE.hoverBorderAlpha,
      });
    }
  }
}

/**
 * Set a text's content, shortening it with an ellipsis until it fits.
 *
 * @param text - Text object (style already applied).
 * @param content - Full content.
 * @param maxWidth - Maximum rendered width in pixels.
 */
export function fitTextToWidth(
  text: Phaser.GameObjects.Text,
  content: string,
  maxWidth: number,
): void {
  text.setText(content);
  let length = content.length;
  while (text.width > maxWidth && length > 1) {
    length -= 1;
    text.setText(content.slice(0, length).trimEnd() + ROW_STYLE.ellipsis);
  }
}
