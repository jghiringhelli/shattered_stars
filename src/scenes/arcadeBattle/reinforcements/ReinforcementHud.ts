/**
 * ReinforcementHud — the reinforcement panel of the Skirmish HUD (left of
 * the match clock): every side's pool left and field points vs the cap
 * with a pool bar, the player's next reserve ships, and the latest deploy
 * notification (fading). Zoom-compensated like the rest of the HUD; every
 * state is spelled out in text (YOU / FOE, EXHAUSTED, ▲ ▼ ★ glyphs), and
 * lines are fitted to the panel so nothing spills onto other widgets.
 */

import Phaser from "phaser";
import type { DeployOption, SideSummary } from "../../../arcade/reinforcements";
import { cameraViewFrom, type CameraLike } from "../../../ui/hud";
import {
  addPinned,
  createHoloText,
  createScreenContainer,
} from "../../../ui/hud/holoPrimitives";
import type { HoloPanel } from "../../../ui/hud/HoloPanel";
import { hudRootTransform } from "../../../ui/hud/hudMath";
import type { ScreenRect } from "../../../ui/hud/screenRect";
import { toCssColor } from "../../../ui/theme/colorMath";
import {
  HOLO_DEPTH,
  HOLO_PALETTE,
  HOLO_SPACING,
} from "../../../ui/theme/HoloTheme";
import { TONE_COLORS } from "../ArcadeHudPanels";
import {
  HEADER_HEIGHT,
  PANEL_MARGIN,
  panelRect,
  pinnedPanel,
  setText,
} from "../hudPanelParts";
import { nextLine, poolTone, sideRow } from "./reinforcementHudModel";

/** Width of the match clock panel this panel sits left of (ArcadeHudPanels). */
const CLOCK_PANEL_WIDTH = 168;
const PANEL = { width: 280, rowHeight: 18, barHeight: 3, barGap: 2 } as const;
/** Text width available inside the panel. */
const TEXT_WIDTH = PANEL.width - HOLO_SPACING.md * 2;
/** Reserve ships previewed, most first, fewer when the names do not fit. */
const PREVIEW_COUNTS = [3, 2, 1] as const;
/** Notifications remembered for the readout. */
const RECENT_EVENTS = 3;
/** How long a deploy notification stays (ms) and the share spent fading. */
const EVENT_MS = 2600;
const EVENT_FADE_SHARE = 0.3;
const ELLIPSIS = "…";

/** What the panel shows this frame. */
export interface ReinforcementHudFrame {
  readonly sides: readonly SideSummary[];
  /** The viewer's team side key (its row reads YOU). */
  readonly viewSide: string;
  readonly preview: readonly DeployOption[];
  readonly camera: CameraLike;
  /** Scene time (ms). */
  readonly nowMs: number;
}

export class ReinforcementHud {
  private readonly root: Phaser.GameObjects.Container;
  private readonly panel: HoloPanel;
  private readonly height: number;
  private readonly rows: Phaser.GameObjects.Text[];
  private readonly next: Phaser.GameObjects.Text;
  private readonly event: Phaser.GameObjects.Text;
  private readonly bars: Phaser.GameObjects.Graphics;
  private eventBornMs = Number.NEGATIVE_INFINITY;
  private readonly recent: string[] = [];
  private screenWidth = 0;

  /**
   * @param scene - The battle scene.
   * @param sideCount - Sides in the battle (one pool row each).
   */
  constructor(
    private readonly scene: Phaser.Scene,
    sideCount: number,
  ) {
    const lines = sideCount + 2;
    this.height =
      HEADER_HEIGHT +
      HOLO_SPACING.sm +
      lines * PANEL.rowHeight +
      HOLO_SPACING.xs;
    this.root = createScreenContainer(scene).setDepth(HOLO_DEPTH.hud);
    this.panel = pinnedPanel(
      scene,
      this.root,
      PANEL.width,
      this.height,
      "Reinforcements",
    );
    const left = -PANEL.width / 2 + HOLO_SPACING.md;
    const top = -this.height / 2 + HEADER_HEIGHT + HOLO_SPACING.sm;
    this.rows = Array.from({ length: sideCount }, (_, i) =>
      this.text(left, top + i * PANEL.rowHeight),
    );
    this.next = this.text(
      left,
      top + sideCount * PANEL.rowHeight,
      HOLO_PALETTE.accent,
    );
    this.event = this.text(left, top + (sideCount + 1) * PANEL.rowHeight);
    this.bars = scene.add.graphics();
    addPinned(this.panel, ...this.rows, this.next, this.event, this.bars);
  }

  /** Text on screen now, plus the last few notifications (e2e). */
  get readout(): { rows: string[]; next: string; toasts: string[] } {
    return {
      rows: this.rows.map((r) => r.text),
      next: this.next.text,
      toasts: [...this.recent],
    };
  }

  /** @returns The panel's rect in HUD-root px. */
  bounds(): ScreenRect {
    return panelRect(this.panel, PANEL.width, this.height);
  }

  /** @param frame - Sides, preview, camera and time. */
  update(frame: ReinforcementHudFrame): void {
    const camera = cameraViewFrom(frame.camera);
    const t = hudRootTransform(camera.zoom, camera.width, camera.height);
    this.root.setPosition(t.x, t.y).setScale(t.scale);
    this.layout(camera.width);
    this.drawRows(frame.sides, frame.viewSide);
    this.fitPreview(frame.preview);
    this.fadeEvent(frame.nowMs);
  }

  /**
   * Show a deploy notification on the panel's event line.
   * @param line - The notification.
   * @param nowMs - Scene time.
   */
  notify(line: string, nowMs: number): void {
    this.recent.unshift(line);
    this.recent.splice(RECENT_EVENTS);
    fitText(this.event, line);
    this.event.setAlpha(1);
    this.eventBornMs = nowMs;
  }

  /** @param visible - Show or hide the panel. */
  setVisible(visible: boolean): void {
    this.root.setVisible(visible);
  }

  /** Destroy every object. */
  destroy(): void {
    this.root.destroy();
  }

  private text(
    x: number,
    y: number,
    color: number = HOLO_PALETTE.textPrimary,
  ): Phaser.GameObjects.Text {
    return createHoloText(this.scene, x, y, "", "caption", color).setOrigin(
      0,
      0,
    );
  }

  private drawRows(sides: readonly SideSummary[], viewSide: string): void {
    this.bars.clear();
    this.rows.forEach((row, i) => {
      const side = sides[i];
      if (!side) return;
      setText(row, sideRow(side, viewSide));
      const color = TONE_COLORS[poolTone(side)];
      row.setColor(toCssColor(color));
      const share =
        side.poolPoints > 0 ? side.remainingPoints / side.poolPoints : 0;
      const y = row.y + PANEL.rowHeight - PANEL.barHeight - PANEL.barGap;
      this.bars.fillStyle(HOLO_PALETTE.track, HOLO_PALETTE.trackAlpha);
      this.bars.fillRect(row.x, y, TEXT_WIDTH, PANEL.barHeight);
      this.bars.fillStyle(color, 1);
      this.bars.fillRect(row.x, y, TEXT_WIDTH * share, PANEL.barHeight);
    });
  }

  private fitPreview(preview: readonly DeployOption[]): void {
    for (const count of PREVIEW_COUNTS) {
      setText(this.next, nextLine(preview.slice(0, count)));
      if (this.next.width <= TEXT_WIDTH) return;
    }
    fitText(this.next, this.next.text);
  }

  private fadeEvent(nowMs: number): void {
    const age = nowMs - this.eventBornMs;
    if (age >= EVENT_MS) {
      setText(this.event, "");
      return;
    }
    const fadeStart = EVENT_MS * (1 - EVENT_FADE_SHARE);
    if (age > fadeStart)
      this.event.setAlpha(1 - (age - fadeStart) / (EVENT_MS - fadeStart));
  }

  private layout(width: number): void {
    if (width === this.screenWidth) return;
    this.screenWidth = width;
    this.panel.setPosition(
      width / 2 - CLOCK_PANEL_WIDTH / 2 - PANEL_MARGIN - PANEL.width / 2,
      PANEL_MARGIN + this.height / 2,
    );
  }
}

/** Set a line, cutting it with an ellipsis until it fits the panel. */
function fitText(text: Phaser.GameObjects.Text, line: string): void {
  setText(text, line);
  let cut = line;
  while (text.width > TEXT_WIDTH && cut.length > 1) {
    cut = cut.slice(0, -1);
    setText(text, `${cut.trimEnd()}${ELLIPSIS}`);
  }
}
