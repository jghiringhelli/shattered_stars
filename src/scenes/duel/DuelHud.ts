/**
 * DuelHud — the duel scenes' in-battle HUD: the holographic BattleHud
 * (status ring, radar, weapon bar, flight readout, edge arrows) plus the
 * duel-specific overlay in the same holo style — a scoreboard panel (round,
 * best-of score with side dots, round clock), the ROUND / result banners
 * and a compact controls hint in the bottom-left corner.
 *
 * Like BattleHud, the overlay cancels camera zoom so it is pixel-stable.
 */

import Phaser from "phaser";
import { BATTLEFIELD_SIZE } from "../../config";
import { BattleHud } from "../../ui/hud/BattleHud";
import { createHoloPanel, type HoloPanel } from "../../ui/hud/HoloPanel";
import { addPinned, createHoloText } from "../../ui/hud/holoPrimitives";
import { hudRootTransform } from "../../ui/hud/hudMath";
import type { BattleHudSnapshot } from "../../ui/hud/types";
import { toCssColor } from "../../ui/theme/colorMath";
import {
  HOLO_DEPTH,
  HOLO_PALETTE,
  HOLO_SPACING,
} from "../../ui/theme/HoloTheme";
import { DuelBanner } from "./DuelBanner";
import { duelControlsHintLines } from "./duelControls";

/** Scoreboard panel size. */
const BOARD = { width: 300, height: 64, top: HOLO_SPACING.sm } as const;
/** Scoreboard rows (local y) and columns (local x). */
const BOARD_LAYOUT = {
  captionY: -18,
  valueY: 10,
  scoreX: -48,
  dotOffset: 46,
  dotRadius: 6,
  dividerX: 42,
  clockX: 96,
} as const;
/** Clock turns amber / red at these remaining times (ms). */
const CLOCK_WARNING_MS = 60_000;
const CLOCK_DANGER_MS = 30_000;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
/** Extra space between hint lines (px). */
const HINT_LINE_SPACING = 3;

/** DuelHud options. */
export interface DuelHudConfig {
  /** Scoreboard border / header accent (the player's faction). */
  readonly accent: number;
  /** Dot colours of the left and right score (left = first score). */
  readonly scoreColors: readonly [number, number];
  /** Extra caption after the round number (e.g. the matchup). */
  readonly subtitle?: string;
}

/** BattleHud plus the duel scoreboard, banners and hint. */
export class DuelHud {
  private readonly battle: BattleHud;
  private readonly root: Phaser.GameObjects.Container;
  private readonly board: HoloPanel;
  private readonly caption: Phaser.GameObjects.Text;
  private readonly score: Phaser.GameObjects.Text;
  private readonly clock: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly banner: DuelBanner;
  private readonly subtitle: string;
  private lastZoom = Number.NaN;

  /**
   * @param scene - The duel scene.
   * @param config - Accent, score colours and optional subtitle.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    config: DuelHudConfig,
  ) {
    this.battle = new BattleHud(scene, { worldSize: BATTLEFIELD_SIZE });
    this.subtitle = config.subtitle?.toUpperCase() ?? "";
    this.root = scene.add
      .container(0, 0)
      .setScrollFactor(0)
      .setDepth(HOLO_DEPTH.hud);
    this.board = this.createBoard(config.accent);
    this.caption = this.boardText(0, BOARD_LAYOUT.captionY, "caption");
    this.score = this.boardText(
      BOARD_LAYOUT.scoreX,
      BOARD_LAYOUT.valueY,
      "heading",
    );
    this.clock = this.boardText(
      BOARD_LAYOUT.clockX,
      BOARD_LAYOUT.valueY,
      "heading",
    );
    this.drawBoardMarks(config.scoreColors);
    this.hint = this.createHint();
    this.banner = new DuelBanner(scene);
    addPinned(this.root, this.board, this.hint, this.banner.container);
    this.board.setScrollFactor(0, 0, true);
    this.applyZoom();
  }

  /** Text on the scoreboard's round caption (e2e hook). */
  get roundLabel(): string {
    return this.caption.text;
  }

  /** Text on the scoreboard's score (e2e hook). */
  get scoreLabel(): string {
    return this.score.text;
  }

  /** Text on the scoreboard's clock (e2e hook). */
  get clockLabel(): string {
    return this.clock.text;
  }

  /** The text of the banner currently shown, or null (e2e hook). */
  get bannerLabel(): string | null {
    return this.banner.label;
  }

  /** Number of edge arrows shown (e2e hook). */
  get edgeArrowCount(): number {
    return this.battle.edgeArrowCount;
  }

  /**
   * Refresh the battle HUD and keep the overlay zoom-independent.
   *
   * @param snapshot - This frame's player, contacts, weapons and camera.
   */
  update(snapshot: BattleHudSnapshot): void {
    this.battle.update(snapshot);
    this.applyZoom();
  }

  /**
   * @param round - Round number (1-based).
   */
  setRound(round: number): void {
    const suffix = this.subtitle === "" ? "" : `  \u00b7  ${this.subtitle}`;
    this.caption.setText(`ROUND ${round}${suffix}`);
  }

  /**
   * Show the round clock, amber under a minute and red under 30 s.
   *
   * @param remainingMs - Time left in the round (ms).
   */
  setClock(remainingMs: number): void {
    const totalSeconds = Math.max(0, Math.ceil(remainingMs / MS_PER_SECOND));
    const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
    const seconds = totalSeconds % SECONDS_PER_MINUTE;
    this.clock.setText(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    const color =
      remainingMs <= CLOCK_DANGER_MS
        ? HOLO_PALETTE.danger
        : remainingMs <= CLOCK_WARNING_MS
          ? HOLO_PALETTE.warning
          : HOLO_PALETTE.textPrimary;
    this.clock.setColor(toCssColor(color));
  }

  /**
   * Show the match score; match point is highlighted.
   *
   * @param left - Left score (player in Dogfight, side 1 in Ace Duel).
   * @param right - Right score.
   * @param matchPoint - Whether either side is one round from winning.
   */
  setScore(left: number, right: number, matchPoint: boolean): void {
    this.score.setText(`${left}  \u2013  ${right}`);
    this.score.setColor(
      toCssColor(matchPoint ? HOLO_PALETTE.warning : HOLO_PALETTE.textPrimary),
    );
  }

  /**
   * The ROUND N banner: grows and fades, then weapons go live.
   *
   * @param round - Round number.
   * @param onDone - Called when the banner has faded.
   */
  showRoundBanner(round: number, onDone: () => void): void {
    this.banner.showRound(`ROUND ${round}`, onDone);
  }

  /**
   * A round result banner (VICTORY / DEFEAT / DRAW) that holds then fades.
   *
   * @param text - Banner text.
   * @param color - Text and accent colour.
   */
  showResultBanner(text: string, color: number): void {
    this.banner.showResult(text, color);
  }

  /**
   * Show or hide the whole HUD (e.g. under the end-of-match screen).
   *
   * @param visible - Visibility.
   */
  setVisible(visible: boolean): void {
    this.battle.setVisible(visible);
    this.root.setVisible(visible);
  }

  /** Destroy every HUD object. */
  destroy(): void {
    this.banner.destroy();
    this.battle.destroy();
    this.root.destroy();
  }

  private applyZoom(): void {
    const camera = this.scene.cameras.main;
    if (camera.zoom === this.lastZoom) return;
    this.lastZoom = camera.zoom;
    const t = hudRootTransform(camera.zoom, camera.width, camera.height);
    this.root.setPosition(t.x, t.y).setScale(t.scale);
    this.board.setPosition(camera.width / 2, BOARD.top + BOARD.height / 2);
    this.hint.setPosition(HOLO_SPACING.lg, camera.height - HOLO_SPACING.lg);
    this.banner.container.setPosition(camera.width / 2, camera.height / 2);
  }

  private createBoard(accent: number): HoloPanel {
    return createHoloPanel(this.scene, 0, 0, {
      width: BOARD.width,
      height: BOARD.height,
      accentColor: accent,
    });
  }

  private boardText(
    x: number,
    y: number,
    role: "caption" | "heading",
  ): Phaser.GameObjects.Text {
    const color =
      role === "caption"
        ? HOLO_PALETTE.textSecondary
        : HOLO_PALETTE.textPrimary;
    const text = createHoloText(this.scene, x, y, "", role, color);
    this.board.add(text);
    return text;
  }

  private drawBoardMarks(colors: readonly [number, number]): void {
    const { scoreX, valueY, dotOffset, dotRadius, dividerX } = BOARD_LAYOUT;
    const marks = this.scene.add.graphics();
    marks
      .fillStyle(colors[0], 1)
      .fillCircle(scoreX - dotOffset, valueY, dotRadius);
    marks
      .fillStyle(colors[1], 1)
      .fillCircle(scoreX + dotOffset, valueY, dotRadius);
    marks.lineStyle(1, HOLO_PALETTE.border, HOLO_PALETTE.borderAlpha);
    marks.lineBetween(
      dividerX,
      valueY - dotRadius * 2,
      dividerX,
      valueY + dotRadius * 2,
    );
    this.board.add(marks);
  }

  private createHint(): Phaser.GameObjects.Text {
    return createHoloText(
      this.scene,
      0,
      0,
      duelControlsHintLines().join("\n"),
      "caption",
      HOLO_PALETTE.textMuted,
    )
      .setOrigin(0, 1)
      .setLineSpacing(HINT_LINE_SPACING);
  }
}
