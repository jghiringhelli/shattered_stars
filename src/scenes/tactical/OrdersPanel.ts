/**
 * OrdersPanel — Continuous Tactical's holographic order card for the
 * selected ship, laid out as a short top-band card: the maneuver dial at the
 * ordered speed on the left (markers coloured by difficulty, the ordered one
 * enlarged), and the ship's name, standing order, a stress warning and the
 * order controls on the right. Redraws only on change.
 */

import type Phaser from "phaser";
import type { ManeuverDefinition } from "../../core/types";
import { HoloPanel } from "../../ui/hud/HoloPanel";
import { createHoloText } from "../../ui/hud/holoPrimitives";
import { HOLO_PALETTE, HOLO_SPACING } from "../../ui/theme/HoloTheme";
import { toCssColor } from "../../ui/theme/colorMath";
import { maneuverLabel } from "../battleUi/hudSnapshot";
import { dialMarkers, difficultyColor } from "./dialMarkers";

/** Card size (px). */
export const ORDERS_CARD_SIZE = { width: 476, height: 128 } as const;

/** Content layout (px, relative to the card centre). */
const LAYOUT = {
  dialX: -174,
  dialY: 14,
  dialRadius: 38,
  textLeft: -118,
  nameY: -22,
  orderY: -2,
  stressY: 16,
  hintTop: 36,
  hintPitch: 15,
} as const;
/** Marker radii and alphas. */
const MARKER = {
  radius: 5,
  selectedRadius: 8,
  alpha: 0.5,
  ringAlpha: 0.35,
} as const;
/** Order-control hint lines. */
const HINT_LINES: readonly string[] = [
  "← / →  direction  ·  ↑ / ↓  speed  ·  flies next cycle",
  "Click a ship to select  ·  R mark target  ·  ESC pause",
];

/** What the card shows for the selected ship. */
export interface OrdersView {
  readonly shipName: string;
  readonly order: ManeuverDefinition;
  readonly dial: readonly ManeuverDefinition[];
  readonly isStressed: boolean;
}

/** Selected ship's order card. */
export class OrdersPanel {
  /** The card (add it to a screen-space layer). */
  readonly panel: HoloPanel;
  private readonly name: Phaser.GameObjects.Text;
  private readonly orderText: Phaser.GameObjects.Text;
  private readonly stressText: Phaser.GameObjects.Text;
  private readonly dial: Phaser.GameObjects.Graphics;
  private lastSignature = "";

  /**
   * @param scene - Owning scene.
   * @param x - Card centre x (screen px).
   * @param y - Card centre y (screen px).
   */
  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.panel = new HoloPanel(scene, x, y, {
      ...ORDERS_CARD_SIZE,
      title: "Orders",
    });
    const left = (text: Phaser.GameObjects.Text): Phaser.GameObjects.Text =>
      text.setOrigin(0, 0.5);
    this.name = left(
      createHoloText(scene, LAYOUT.textLeft, LAYOUT.nameY, "", "heading"),
    );
    this.orderText = left(
      createHoloText(scene, LAYOUT.textLeft, LAYOUT.orderY, "", "numeric"),
    );
    this.stressText = left(
      createHoloText(
        scene,
        LAYOUT.textLeft,
        LAYOUT.stressY,
        "STRESSED — NO RED ORDERS",
        "caption",
        HOLO_PALETTE.danger,
      ),
    );
    this.dial = scene.add.graphics();
    const hints = HINT_LINES.map((line, index) =>
      left(
        createHoloText(
          scene,
          LAYOUT.textLeft,
          LAYOUT.hintTop + index * LAYOUT.hintPitch,
          line,
          "caption",
          HOLO_PALETTE.textMuted,
        ),
      ),
    );
    this.panel.add([
      this.dial,
      this.name,
      this.orderText,
      this.stressText,
      ...hints,
    ]);
  }

  /**
   * @param view - The selected ship's orders, or null with none selected.
   */
  update(view: OrdersView | null): void {
    const signature = view
      ? `${view.shipName}|${view.order.direction}|${view.order.speed}|${view.isStressed}`
      : "";
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.panel.setVisible(view !== null);
    if (!view) return;
    this.name.setText(view.shipName.toUpperCase());
    this.orderText
      .setText(maneuverLabel(view.order.direction, view.order.speed) ?? "")
      .setColor(toCssColor(difficultyColor(view.order.difficulty)));
    this.stressText.setVisible(view.isStressed);
    this.drawDial(view);
  }

  private drawDial(view: OrdersView): void {
    const { dialX: cx, dialY: cy } = LAYOUT;
    const g = this.dial.clear();
    g.lineStyle(1, HOLO_PALETTE.border, MARKER.ringAlpha);
    g.strokeCircle(cx, cy, LAYOUT.dialRadius);
    g.fillStyle(HOLO_PALETTE.accent, 1);
    g.fillTriangle(
      cx,
      cy - HOLO_SPACING.sm,
      cx - HOLO_SPACING.xs,
      cy + HOLO_SPACING.xs,
      cx + HOLO_SPACING.xs,
      cy + HOLO_SPACING.xs,
    );
    for (const marker of dialMarkers(
      view.dial,
      view.order,
      LAYOUT.dialRadius,
    )) {
      g.fillStyle(marker.color, marker.selected ? 1 : MARKER.alpha);
      g.fillCircle(
        cx + marker.x,
        cy + marker.y,
        marker.selected ? MARKER.selectedRadius : MARKER.radius,
      );
    }
  }
}
