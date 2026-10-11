/**
 * TacticalHud — Continuous Tactical's holographic HUD. There is no
 * keyboard-flown ship, so BattleHud is centred on the *selected* ship: its
 * status ring, a heading-up radar around it (replacing the old whole-map
 * Minimap), edge arrows to every off-screen ship, its laser cooldown and
 * its ordered maneuver in the flight readout. A title/clock panel sits at
 * top centre and the order card at top left; all pixel-stable at any zoom.
 */

import type Phaser from "phaser";
import { formatMatchClock } from "../../systems/arena/MatchTimer";
import { BattleHud } from "../../ui/hud/BattleHud";
import { DEFAULT_EDGE_INSETS } from "../../ui/hud/EdgeIndicators";
import { HoloPanel } from "../../ui/hud/HoloPanel";
import { createHoloText } from "../../ui/hud/holoPrimitives";
import type { BattleHudSnapshot } from "../../ui/hud/types";
import { HOLO_DEPTH, HOLO_SPACING } from "../../ui/theme/HoloTheme";
import { toCssColor } from "../../ui/theme/colorMath";
import { matchClockColor } from "../battleUi/hudSnapshot";
import { ZoomStableLayer } from "../battleUi/ZoomStableLayer";
import { ORDERS_CARD_SIZE, OrdersPanel, type OrdersView } from "./OrdersPanel";

/** Radar reach around the selected ship (fights stay within ~1 km). */
const RADAR_RANGE_PX = 1500;
/** Title/clock panel geometry. */
const TITLE_PANEL = {
  width: 240,
  height: 64,
  centerY: 48,
  clockY: 12,
} as const;
/** Edge arrows stay below the top-band panels (order card bottom + a margin). */
const EDGE_INSETS = {
  ...DEFAULT_EDGE_INSETS,
  top: HOLO_SPACING.lg + ORDERS_CARD_SIZE.height + HOLO_SPACING.lg,
} as const;

/** Everything the tactical HUD shows in one frame. */
export interface TacticalHudFrame {
  readonly battle: BattleHudSnapshot;
  readonly orders: OrdersView | null;
  readonly remainingMs: number;
}

/** Continuous Tactical HUD. */
export class TacticalHud {
  private readonly battleHud: BattleHud;
  private readonly layer: ZoomStableLayer;
  private readonly orders: OrdersPanel;
  private readonly clock: Phaser.GameObjects.Text;
  private lastClock = "";

  /**
   * @param scene - The tactical scene.
   * @param worldSize - Battlefield side length.
   */
  constructor(scene: Phaser.Scene, worldSize: number) {
    this.battleHud = new BattleHud(scene, {
      worldSize,
      radarRangePx: RADAR_RANGE_PX,
      edgeInsets: EDGE_INSETS,
    });
    this.layer = new ZoomStableLayer(scene, HOLO_DEPTH.hud);
    const title = new HoloPanel(
      scene,
      scene.scale.width / 2,
      TITLE_PANEL.centerY,
      {
        width: TITLE_PANEL.width,
        height: TITLE_PANEL.height,
        title: "Tactical combat",
      },
    );
    this.clock = createHoloText(scene, 0, TITLE_PANEL.clockY, "", "numeric");
    title.add(this.clock);
    this.orders = new OrdersPanel(
      scene,
      HOLO_SPACING.lg + ORDERS_CARD_SIZE.width / 2,
      HOLO_SPACING.lg + ORDERS_CARD_SIZE.height / 2,
    );
    this.layer.add(title, this.orders.panel);
  }

  /**
   * @param frame - HUD snapshot, selected ship's orders and match clock.
   */
  update(frame: TacticalHudFrame): void {
    this.layer.sync(frame.battle.camera);
    this.battleHud.update(frame.battle);
    this.orders.update(frame.orders);
    const clock = formatMatchClock(frame.remainingMs);
    if (clock === this.lastClock) return;
    this.lastClock = clock;
    this.clock
      .setText(clock)
      .setColor(toCssColor(matchClockColor(frame.remainingMs)));
  }

  /**
   * @param visible - Whether the HUD shows (hidden under the end screen).
   */
  setVisible(visible: boolean): void {
    this.battleHud.setVisible(visible);
    this.layer.setVisible(visible);
  }

  /** Destroy every HUD object. */
  destroy(): void {
    this.battleHud.destroy();
    this.layer.destroy();
  }
}
