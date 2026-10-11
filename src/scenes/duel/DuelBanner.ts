/**
 * DuelBanner — the duel scenes' centre-screen banners in the holo style: a
 * translucent strip with accent rules and a large light title. The ROUND
 * banner grows and fades (weapons go live when it is gone); a result banner
 * holds, then drifts up and fades.
 */

import Phaser from "phaser";
import { createHoloText } from "../../ui/hud/holoPrimitives";
import { toCssColor } from "../../ui/theme/colorMath";
import { HOLO_BORDER, HOLO_PALETTE } from "../../ui/theme/HoloTheme";

/** Banner strip size (px). */
const STRIP = { width: 520, height: 84 } as const;
/** Banner title size (px) and letter spacing. */
const TITLE_SIZE_PX = 46;
const TITLE_LETTER_SPACING = 10;
/** ROUND banner: grow to this scale while fading out over this long (ms). */
const ROUND_END_SCALE = 1.5;
const ROUND_BANNER_MS = 1500;
/** Result banner: hold, then drift up while fading (ms / px). */
const RESULT_HOLD_MS = 1500;
const RESULT_FADE_MS = 500;
const RESULT_DRIFT_PX = 50;
/** Strip fill opacity. */
const STRIP_ALPHA = 0.55;

/** Centre-screen banner (one at a time). */
export class DuelBanner {
  /** Screen-space parent; positioned by the owning HUD. */
  readonly container: Phaser.GameObjects.Container;
  private readonly strip: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private tween: Phaser.Tweens.Tween | null = null;

  /**
   * @param scene - Owning scene.
   */
  constructor(private readonly scene: Phaser.Scene) {
    this.strip = scene.add.graphics();
    this.title = createHoloText(scene, 0, 0, "", "title")
      .setFontSize(TITLE_SIZE_PX)
      .setLetterSpacing(TITLE_LETTER_SPACING);
    this.container = scene.add
      .container(0, 0, [this.strip, this.title])
      .setScrollFactor(0, 0, true)
      .setVisible(false);
  }

  /** Text of the banner on screen, or null when none is shown. */
  get label(): string | null {
    return this.container.visible ? this.title.text : null;
  }

  /**
   * Show the ROUND banner: grows and fades, then `onDone`.
   *
   * @param text - Banner text.
   * @param onDone - Called once the banner has faded.
   */
  showRound(text: string, onDone: () => void): void {
    this.present(text, HOLO_PALETTE.warning);
    this.tween = this.scene.tweens.add({
      targets: this.container,
      scale: ROUND_END_SCALE,
      alpha: 0,
      duration: ROUND_BANNER_MS,
      onComplete: () => {
        this.hide();
        onDone();
      },
    });
  }

  /**
   * Show a result banner that holds, then drifts up and fades.
   *
   * @param text - Banner text.
   * @param color - Text and rule colour.
   */
  showResult(text: string, color: number): void {
    this.present(text, color);
    const restY = this.container.y;
    this.tween = this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      y: restY - RESULT_DRIFT_PX,
      delay: RESULT_HOLD_MS,
      duration: RESULT_FADE_MS,
      onComplete: () => {
        this.container.setY(restY);
        this.hide();
      },
    });
  }

  /** Stop any running banner and destroy its objects. */
  destroy(): void {
    this.tween?.stop();
    this.container.destroy();
  }

  private present(text: string, color: number): void {
    this.tween?.complete();
    this.title.setText(text).setColor(toCssColor(color));
    this.drawStrip(color);
    this.container.setScale(1).setAlpha(1).setVisible(true);
  }

  private hide(): void {
    this.tween = null;
    this.container.setVisible(false);
  }

  private drawStrip(color: number): void {
    const halfW = STRIP.width / 2;
    const halfH = STRIP.height / 2;
    this.strip.clear();
    this.strip.fillStyle(HOLO_PALETTE.panelFill, STRIP_ALPHA);
    this.strip.fillRect(-halfW, -halfH, STRIP.width, STRIP.height);
    this.strip.lineStyle(HOLO_BORDER.regular, color, 1);
    this.strip.lineBetween(-halfW, -halfH, halfW, -halfH);
    this.strip.lineBetween(-halfW, halfH, halfW, halfH);
  }
}
