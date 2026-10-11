/**
 * Health Bar Component
 * Displays ship health (shields + hull) above ships
 */

import Phaser from "phaser";
import type { FactionId } from "../config";
import { factionAccent, HOLO_PALETTE } from "./theme/HoloTheme";

/** Hull fraction above which the bar reads healthy / below which critical. */
const HULL_HEALTHY = 0.6;
const HULL_CRITICAL = 0.3;
/** Frame and track opacities (holo look: dark translucent frame, faint track). */
const FRAME_ALPHA = 0.7;
const FRAME_BORDER_ALPHA = 0.6;
const FILL_ALPHA = 0.95;

export interface HealthBarConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width?: number;
  height?: number;
  faction: FactionId;
  maxHull: number;
  maxShields: number;
  currentHull: number;
  currentShields: number;
}

export class HealthBar extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Graphics;
  private shieldBar: Phaser.GameObjects.Graphics;
  private hullBar: Phaser.GameObjects.Graphics;
  private flashTween: Phaser.Tweens.Tween | null = null;

  private barWidth: number;
  private barHeight: number;
  private maxHull: number;
  private maxShields: number;
  private currentHull: number;
  private currentShields: number;
  private faction: FactionId;

  constructor(config: HealthBarConfig) {
    super(config.scene, config.x, config.y);

    this.barWidth = config.width ?? 40;
    this.barHeight = config.height ?? 4;
    this.maxHull = config.maxHull;
    this.maxShields = config.maxShields;
    this.currentHull = config.currentHull;
    this.currentShields = config.currentShields;
    this.faction = config.faction;

    // Background (dark)
    this.background = config.scene.add.graphics();
    this.add(this.background);

    // Shield bar (faction color, on top)
    this.shieldBar = config.scene.add.graphics();
    this.add(this.shieldBar);

    // Hull bar (red/green gradient based on health)
    this.hullBar = config.scene.add.graphics();
    this.add(this.hullBar);

    this.draw();
    config.scene.add.existing(this);
  }

  private draw(): void {
    const totalHeight =
      this.maxShields > 0 ? this.barHeight * 2 + 1 : this.barHeight;
    const yOffset = -totalHeight / 2;

    // Clear previous
    this.background.clear();
    this.shieldBar.clear();
    this.hullBar.clear();

    // Background frame
    this.background.fillStyle(HOLO_PALETTE.panelFill, FRAME_ALPHA);
    this.background.fillRect(
      -this.barWidth / 2 - 1,
      yOffset - 1,
      this.barWidth + 2,
      totalHeight + 2,
    );
    this.background.lineStyle(1, HOLO_PALETTE.border, FRAME_BORDER_ALPHA);
    this.background.strokeRect(
      -this.barWidth / 2 - 1,
      yOffset - 1,
      this.barWidth + 2,
      totalHeight + 2,
    );

    // Shield bar (if ship has shields)
    if (this.maxShields > 0) {
      const shieldPercent = this.currentShields / this.maxShields;
      const shieldColor = factionAccent(this.faction);

      // Background for shield
      this.shieldBar.fillStyle(HOLO_PALETTE.track, HOLO_PALETTE.trackAlpha);
      this.shieldBar.fillRect(
        -this.barWidth / 2,
        yOffset,
        this.barWidth,
        this.barHeight,
      );

      // Filled portion
      if (shieldPercent > 0) {
        this.shieldBar.fillStyle(shieldColor, FILL_ALPHA);
        this.shieldBar.fillRect(
          -this.barWidth / 2,
          yOffset,
          this.barWidth * shieldPercent,
          this.barHeight,
        );
      }
    }

    // Hull bar
    const hullPercent = this.currentHull / this.maxHull;
    const hullYOffset =
      this.maxShields > 0 ? yOffset + this.barHeight + 1 : yOffset;

    // Hull color: healthy / caution / critical from the holo palette
    let hullColor: number;
    if (hullPercent > HULL_HEALTHY) {
      hullColor = HOLO_PALETTE.success;
    } else if (hullPercent > HULL_CRITICAL) {
      hullColor = HOLO_PALETTE.warning;
    } else {
      hullColor = HOLO_PALETTE.danger;
    }

    // Background for hull
    this.hullBar.fillStyle(HOLO_PALETTE.track, HOLO_PALETTE.trackAlpha);
    this.hullBar.fillRect(
      -this.barWidth / 2,
      hullYOffset,
      this.barWidth,
      this.barHeight,
    );

    // Filled portion
    if (hullPercent > 0) {
      this.hullBar.fillStyle(hullColor, FILL_ALPHA);
      this.hullBar.fillRect(
        -this.barWidth / 2,
        hullYOffset,
        this.barWidth * hullPercent,
        this.barHeight,
      );
    }
  }

  update(currentHull: number, currentShields: number): void {
    const tookDamage =
      currentHull < this.currentHull || currentShields < this.currentShields;

    this.currentHull = currentHull;
    this.currentShields = currentShields;
    this.draw();

    // Flash on damage
    if (tookDamage) {
      this.flash();
    }

    // Hide when at full health (declutter)
    const atFullHealth =
      this.currentHull >= this.maxHull &&
      this.currentShields >= this.maxShields;
    this.setVisible(!atFullHealth);
  }

  private flash(): void {
    if (this.flashTween) {
      this.flashTween.stop();
    }

    this.setAlpha(1);
    this.flashTween = this.scene.tweens.add({
      targets: this,
      alpha: { from: 1, to: 0.3 },
      duration: 100,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        this.setAlpha(1);
      },
    });
  }

  setPosition(x: number, y: number): this {
    super.setPosition(x, y);
    return this;
  }

  destroy(): void {
    if (this.flashTween) {
      this.flashTween.stop();
    }
    super.destroy();
  }
}
