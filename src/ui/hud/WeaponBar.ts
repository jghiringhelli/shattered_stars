/**
 * WeaponBar — bottom HUD strip of icon slots (primary, ordnance, turret,
 * bomb…), data-driven by an array of {@link WeaponSlotDescriptor}s.
 *
 * Each slot shows its weapon icon, a clockwise cooldown sweep, charge pips
 * (or a charge bar for large magazines), an optional key hint and a
 * highlight when selected. One Graphics is redrawn per update; key-hint
 * texts are pooled and only grow when the slot count grows.
 *
 * Origin: the container sits at the bar's LEFT edge, vertical centre.
 */

import Phaser from "phaser";
import {
  HOLO_ALPHA,
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_RADIUS,
  HOLO_SPACING,
} from "../theme/HoloTheme";
import {
  addPinned,
  createHoloText,
  createScreenContainer,
} from "./holoPrimitives";
import { drawWeaponIcon } from "./HudIcons";
import { cooldownArc, gaugeFraction, rowCenters } from "./hudStyleMath";
import type { ScreenRect } from "./screenRect";
import type { WeaponSlotDescriptor } from "./types";

const DEFAULT_SLOT_SIZE = 46;
const DEFAULT_GAP = 6;
const BAR_PADDING = HOLO_SPACING.sm;
/** Icon box as a fraction of the slot. */
const ICON_SCALE = 0.6;
/** Icons sit slightly high to leave room for charge pips. */
const ICON_OFFSET = -0.06;
const PIP = { radius: 2, pitch: 6, bottomInset: 6 } as const;
/** Above this many charges, a bar replaces pips. */
const MAX_PIPS = 6;
const CHARGE_BAR = { height: 3, inset: 8 } as const;
/** Cooldown sweep radius as a fraction of the slot. */
const SWEEP_RADIUS = 0.4;
const SWEEP_SHADE_ALPHA = 0.6;
const SWEEP_EDGE_WIDTH = 2;
const SELECT_MARKER = { halfWidth: 5, height: 5, gap: 4 } as const;
const HINT_INSET = 7;
const BAR_ALPHA_SCALE = 0.6;

/** WeaponBar options. */
export interface WeaponBarConfig {
  /** Slot edge length in px. Default: 46. */
  readonly slotSize?: number | undefined;
  /** Gap between slots in px. Default: 6. */
  readonly gap?: number | undefined;
}

/** Bottom weapon strip. */
export class WeaponBar {
  /** Screen-space container (scrollFactor 0). */
  readonly container: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly hints: Phaser.GameObjects.Text[] = [];
  private readonly slotSize: number;
  private readonly gap: number;
  private centers: number[] = [];

  /**
   * @param scene - Owning scene.
   * @param config - Slot size and gap.
   */
  constructor(scene: Phaser.Scene, config: WeaponBarConfig = {}) {
    this.scene = scene;
    this.slotSize = config.slotSize ?? DEFAULT_SLOT_SIZE;
    this.gap = config.gap ?? DEFAULT_GAP;
    this.container = createScreenContainer(scene);
    this.graphics = scene.add.graphics();
    addPinned(this.container, this.graphics);
  }

  /** Current bar width in px (0 when empty). */
  get width(): number {
    const n = this.centers.length;
    return n === 0
      ? 0
      : BAR_PADDING * 2 + n * this.slotSize + (n - 1) * this.gap;
  }

  /** Bar height in px. */
  get height(): number {
    return this.slotSize + BAR_PADDING * 2;
  }

  /**
   * Bounding box in the parent's coordinates, including the selection marker.
   *
   * @returns The bar rect (zero width when empty).
   */
  bounds(): ScreenRect {
    const markerHeight = SELECT_MARKER.gap + SELECT_MARKER.height;
    const { x, y } = this.container;
    return {
      x,
      y: y - this.height / 2 - markerHeight,
      width: this.width,
      height: this.height + markerHeight,
    };
  }

  /**
   * Position the bar's left edge / vertical centre.
   *
   * @param x - Left edge x.
   * @param y - Vertical centre y.
   */
  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  /**
   * Redraw all slots.
   *
   * @param slots - Slot descriptors, left to right.
   */
  update(slots: ReadonlyArray<WeaponSlotDescriptor>): void {
    if (slots.length !== this.centers.length)
      this.centers = rowCenters(slots.length, this.slotSize, this.gap);
    const g = this.graphics;
    g.clear();
    this.hints.forEach((t) => t.setVisible(false));
    if (slots.length === 0) return;
    this.drawBackdrop();
    const half = this.width / 2;
    slots.forEach((slot, i) =>
      this.drawSlot(slot, half + (this.centers[i] ?? 0), i),
    );
  }

  /** Destroy all game objects. */
  destroy(): void {
    this.container.destroy();
  }

  private drawBackdrop(): void {
    const g = this.graphics;
    const h = this.height;
    g.fillStyle(
      HOLO_PALETTE.panelFill,
      HOLO_PALETTE.panelAlpha * BAR_ALPHA_SCALE,
    );
    g.fillRoundedRect(0, -h / 2, this.width, h, HOLO_RADIUS.md);
    g.lineStyle(
      HOLO_BORDER.hairline,
      HOLO_PALETTE.border,
      HOLO_PALETTE.borderAlpha,
    );
    g.strokeRoundedRect(0, -h / 2, this.width, h, HOLO_RADIUS.md);
  }

  private drawSlot(
    slot: WeaponSlotDescriptor,
    cx: number,
    index: number,
  ): void {
    const g = this.graphics;
    const s = this.slotSize;
    g.fillStyle(
      slot.selected ? HOLO_PALETTE.panelFillRaised : HOLO_PALETTE.panelFill,
      HOLO_PALETTE.panelAlpha,
    );
    g.fillRoundedRect(cx - s / 2, -s / 2, s, s, HOLO_RADIUS.sm);
    g.lineStyle(
      slot.selected ? HOLO_BORDER.regular : HOLO_BORDER.hairline,
      slot.selected ? HOLO_PALETTE.accent : HOLO_PALETTE.border,
      1,
    );
    g.strokeRoundedRect(cx - s / 2, -s / 2, s, s, HOLO_RADIUS.sm);
    const { color, alpha } = iconTone(slot);
    drawWeaponIcon(
      g,
      slot.kind,
      cx,
      ICON_OFFSET * s,
      s * ICON_SCALE,
      color,
      alpha,
    );
    this.drawCooldown(slot.cooldown, cx);
    this.drawCharges(slot, cx);
    if (slot.selected) this.drawSelectMarker(cx);
    this.showHint(index, slot.keyHint, cx);
  }

  private drawCooldown(cooldown: number, cx: number): void {
    const span = cooldownArc(cooldown);
    if (span === null) return;
    const g = this.graphics;
    const r = this.slotSize * SWEEP_RADIUS;
    g.fillStyle(HOLO_PALETTE.panelFill, SWEEP_SHADE_ALPHA);
    g.slice(cx, 0, r, span.start, span.end, false);
    g.fillPath();
    g.lineStyle(SWEEP_EDGE_WIDTH, HOLO_PALETTE.warning, 1);
    g.beginPath();
    g.arc(cx, 0, r, span.start, span.end, false);
    g.strokePath();
  }

  private drawCharges(slot: WeaponSlotDescriptor, cx: number): void {
    if (slot.maxCharges === undefined || slot.maxCharges <= 0) return;
    const g = this.graphics;
    const charges = slot.charges ?? slot.maxCharges;
    const y = this.slotSize / 2 - PIP.bottomInset;
    if (slot.maxCharges > MAX_PIPS) {
      const w = this.slotSize - CHARGE_BAR.inset * 2;
      g.fillStyle(HOLO_PALETTE.track, HOLO_PALETTE.trackAlpha);
      g.fillRect(cx - w / 2, y - CHARGE_BAR.height / 2, w, CHARGE_BAR.height);
      g.fillStyle(HOLO_PALETTE.accent, 1);
      g.fillRect(
        cx - w / 2,
        y - CHARGE_BAR.height / 2,
        w * gaugeFraction(charges, slot.maxCharges),
        CHARGE_BAR.height,
      );
      return;
    }
    rowCenters(slot.maxCharges, 0, PIP.pitch).forEach((dx, i) => {
      const full = i < charges;
      g.fillStyle(
        full ? HOLO_PALETTE.accent : HOLO_PALETTE.track,
        full ? 1 : HOLO_PALETTE.trackAlpha * 2,
      );
      g.fillCircle(cx + dx, y, PIP.radius);
    });
  }

  private drawSelectMarker(cx: number): void {
    const top = -this.height / 2 - SELECT_MARKER.gap;
    this.graphics.fillStyle(HOLO_PALETTE.accent, 1);
    this.graphics.fillTriangle(
      cx - SELECT_MARKER.halfWidth,
      top - SELECT_MARKER.height,
      cx + SELECT_MARKER.halfWidth,
      top - SELECT_MARKER.height,
      cx,
      top,
    );
  }

  private showHint(index: number, hint: string | undefined, cx: number): void {
    if (hint === undefined) return;
    while (this.hints.length <= index) {
      const text = createHoloText(
        this.scene,
        0,
        0,
        "",
        "caption",
        HOLO_PALETTE.textMuted,
      );
      addPinned(this.container, text);
      this.hints.push(text);
    }
    const text = this.hints[index] as Phaser.GameObjects.Text;
    if (text.text !== hint) text.setText(hint);
    text
      .setPosition(
        cx - this.slotSize / 2 + HINT_INSET,
        -this.slotSize / 2 + HINT_INSET,
      )
      .setVisible(true);
  }
}

function iconTone(slot: WeaponSlotDescriptor): {
  color: number;
  alpha: number;
} {
  const empty =
    slot.maxCharges !== undefined && (slot.charges ?? slot.maxCharges) <= 0;
  if (empty) return { color: HOLO_PALETTE.danger, alpha: HOLO_ALPHA.disabled };
  if (slot.cooldown > 0)
    return {
      color: HOLO_PALETTE.textSecondary,
      alpha: HOLO_ALPHA.disabled * 2,
    };
  return {
    color: slot.selected ? HOLO_PALETTE.accent : HOLO_PALETTE.textPrimary,
    alpha: 1,
  };
}
