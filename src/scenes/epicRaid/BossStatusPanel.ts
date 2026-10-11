/**
 * BossStatusPanel — the Boss Raid's top-centre holographic boss readout:
 * boss name header with the raid clock, phase banner, shield gauge and a
 * hull gauge split into the boss's sections (disabled sections dimmed).
 * Redraws only when what it shows changes.
 */

import type Phaser from "phaser";
import { HoloPanel } from "../../ui/hud/HoloPanel";
import { createHoloText } from "../../ui/hud/holoPrimitives";
import { HOLO_PALETTE, HOLO_SPACING } from "../../ui/theme/HoloTheme";
import { toCssColor } from "../../ui/theme/colorMath";
import { formatMatchClock } from "../../systems/arena/MatchTimer";
import { matchClockColor } from "../battleUi/hudSnapshot";
import {
  bossHullColor,
  bossPhaseColor,
  bossPhaseLabel,
  sectionSegments,
  type BossStatusView,
} from "./bossStatus";

/** Panel geometry (px, relative to the panel centre). */
const LAYOUT = {
  width: 480,
  height: 92,
  headerCenterY: -32,
  infoY: -4,
  shieldY: 10,
  shieldHeight: 5,
  hullY: 19,
  hullHeight: 12,
} as const;
/** Gauge inset from the panel edges. */
const GAUGE_INSET = HOLO_SPACING.lg;
/** Opacity of a disabled section's slice. */
const DISABLED_ALPHA = 0.5;
/** Opacity of the gauge track. */
const TRACK_ALPHA = HOLO_PALETTE.trackAlpha;

/** Top-centre boss readout. */
export class BossStatusPanel {
  /** The panel (add it to a screen-space layer). */
  readonly panel: HoloPanel;
  private readonly clock: Phaser.GameObjects.Text;
  private readonly phase: Phaser.GameObjects.Text;
  private readonly values: Phaser.GameObjects.Text;
  private readonly gauges: Phaser.GameObjects.Graphics;
  private lastSignature = "";

  /**
   * @param scene - Owning scene.
   * @param x - Panel centre x (screen px).
   * @param y - Panel centre y (screen px).
   * @param bossName - Header title.
   */
  constructor(scene: Phaser.Scene, x: number, y: number, bossName: string) {
    this.panel = new HoloPanel(scene, x, y, {
      width: LAYOUT.width,
      height: LAYOUT.height,
      title: bossName,
      accentColor: HOLO_PALETTE.danger,
    });
    const right = LAYOUT.width / 2 - GAUGE_INSET;
    const left = -right;
    this.clock = createHoloText(
      scene,
      right,
      LAYOUT.headerCenterY,
      "",
      "numeric",
    ).setOrigin(1, 0.5);
    this.phase = createHoloText(
      scene,
      left,
      LAYOUT.infoY,
      "",
      "caption",
    ).setOrigin(0, 0.5);
    this.values = createHoloText(
      scene,
      right,
      LAYOUT.infoY,
      "",
      "caption",
      HOLO_PALETTE.textSecondary,
    ).setOrigin(1, 0.5);
    this.gauges = scene.add.graphics();
    this.panel.add([this.gauges, this.clock, this.phase, this.values]);
  }

  /**
   * @param boss - The boss's current state.
   * @param remainingMs - Raid time left.
   */
  update(boss: BossStatusView, remainingMs: number): void {
    const clock = formatMatchClock(remainingMs);
    const signature = `${clock}|${boss.phase}|${boss.shields}|${boss.hull}|${boss.sections.map((s) => s.hull).join(",")}`;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.clock
      .setText(clock)
      .setColor(toCssColor(matchClockColor(remainingMs)));
    this.phase
      .setText(bossPhaseLabel(boss.phase))
      .setColor(toCssColor(bossPhaseColor(boss.phase)));
    this.values.setText(
      `SHIELDS ${Math.ceil(boss.shields)}/${boss.maxShields}   HULL ${Math.ceil(boss.hull)}/${boss.maxHull}`,
    );
    this.drawGauges(boss);
  }

  private drawGauges(boss: BossStatusView): void {
    const g = this.gauges.clear();
    const width = LAYOUT.width - GAUGE_INSET * 2;
    const left = -width / 2;
    g.fillStyle(HOLO_PALETTE.track, TRACK_ALPHA);
    g.fillRect(left, LAYOUT.shieldY, width, LAYOUT.shieldHeight);
    g.fillRect(left, LAYOUT.hullY, width, LAYOUT.hullHeight);
    const shieldFraction =
      boss.maxShields > 0 ? boss.shields / boss.maxShields : 0;
    g.fillStyle(HOLO_PALETTE.shield, 1);
    g.fillRect(
      left,
      LAYOUT.shieldY,
      width * shieldFraction,
      LAYOUT.shieldHeight,
    );
    const hullColor = bossHullColor(
      boss.maxHull > 0 ? boss.hull / boss.maxHull : 0,
    );
    for (const segment of sectionSegments(boss.sections, width)) {
      const x = left + segment.x;
      g.fillStyle(
        segment.disabled ? HOLO_PALETTE.textMuted : hullColor,
        segment.disabled ? DISABLED_ALPHA : 1,
      );
      const fillWidth = segment.disabled
        ? segment.width
        : segment.width * segment.fill;
      g.fillRect(x, LAYOUT.hullY, fillWidth, LAYOUT.hullHeight);
      g.lineStyle(1, HOLO_PALETTE.border, 1);
      g.strokeRect(x, LAYOUT.hullY, segment.width, LAYOUT.hullHeight);
    }
  }
}
