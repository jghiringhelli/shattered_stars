/**
 * TelemetryStatsScene — the Stats panel: a read-only overlay summarising
 * the local telemetry log (summarizeTelemetry → buildTelemetryStatsView).
 * Opened from Settings › Advanced with {@link openTelemetryStats}; the
 * scene is registered on first use, so the game config stays untouched.
 * ESC / gamepad B / right-click / CLOSE return to the caller.
 */

import Phaser from "phaser";
import { SHIP_DEFINITIONS } from "../../data/ShipDefinitions";
import { telemetryEvents } from "../../telemetry/telemetry";
import { summarizeTelemetry } from "../../telemetry/telemetryStats";
import { createHoverButton } from "../ButtonFactory";
import { drawHoloFrame } from "../menu/holoChrome";
import { bindMenuBack } from "../menu/menuTransitions";
import { toCssColor } from "../theme/colorMath";
import { holoFont } from "../theme/holoFont";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import {
  buildTelemetryStatsView,
  MODE_TABLE_HEADER,
  type TelemetryStatsView,
} from "./telemetryStatsViewModel";

/** Scene key of the Stats panel. */
export const TELEMETRY_STATS_SCENE_KEY = "TelemetryStatsScene";

/** Panel layout (px, 1280×720 canvas). */
const LAYOUT = {
  marginX: 80,
  top: 60,
  bottom: 660,
  inset: 28,
  titleSize: 24,
  bodySize: 14,
  rowHeight: 24,
  sectionGap: 22,
  /** Column x offsets of the mode table, from the panel's inner left. */
  columns: [0, 180, 270, 350, 430, 510, 610, 720],
  closeWidth: 180,
  closeHeight: 40,
  backdropAlpha: 0.82,
  depth: 5000,
} as const;

interface StatsSceneData {
  /** The scene paused underneath (resumed on close). */
  readonly returnScene?: string;
}

export class TelemetryStatsScene extends Phaser.Scene {
  private returnScene: string | null = null;

  constructor() {
    super({ key: TELEMETRY_STATS_SCENE_KEY });
  }

  init(data: StatsSceneData = {}): void {
    this.returnScene = data.returnScene ?? null;
  }

  create(): void {
    const view = buildTelemetryStatsView(
      summarizeTelemetry(telemetryEvents()),
      (id) => SHIP_DEFINITIONS[id]?.name ?? id,
    );
    this.drawPanel();
    const left = LAYOUT.marginX + LAYOUT.inset;
    let y = this.drawHeader(view, left);
    y = this.drawModeTable(view, left, y);
    this.drawFooterSections(view, left, y);
    createHoverButton(
      this,
      this.scale.width / 2,
      LAYOUT.bottom - LAYOUT.inset - LAYOUT.closeHeight / 2,
      {
        width: LAYOUT.closeWidth,
        height: LAYOUT.closeHeight,
        label: "CLOSE",
        color: HOLO_PALETTE.panelFill,
        variant: "secondary",
      },
      () => this.close(),
    );
    bindMenuBack(this, () => this.close());
  }

  private drawPanel(): void {
    const { width, height } = this.scale;
    this.add
      .rectangle(0, 0, width, height, 0x000000, LAYOUT.backdropAlpha)
      .setOrigin(0)
      .setInteractive();
    drawHoloFrame(
      this.add.graphics(),
      {
        x: LAYOUT.marginX,
        y: LAYOUT.top,
        width: width - LAYOUT.marginX * 2,
        height: LAYOUT.bottom - LAYOUT.top,
      },
      { cornerTicks: true, accent: HOLO_PALETTE.accent },
    );
  }

  private drawHeader(view: TelemetryStatsView, left: number): number {
    const top = LAYOUT.top + LAYOUT.inset;
    this.text(
      left,
      top,
      "YOUR STATS",
      LAYOUT.titleSize,
      HOLO_PALETTE.accent,
      "700",
    );
    this.text(
      left,
      top + LAYOUT.titleSize + 8,
      `${view.summaryLine} · stored on this device only`,
      LAYOUT.bodySize,
      HOLO_PALETTE.textSecondary,
    );
    return top + LAYOUT.titleSize + 8 + LAYOUT.rowHeight + LAYOUT.sectionGap;
  }

  private drawModeTable(
    view: TelemetryStatsView,
    left: number,
    top: number,
  ): number {
    if (view.empty) {
      this.text(
        left,
        top,
        "No matches recorded yet — play a battle and come back.",
        LAYOUT.bodySize,
        HOLO_PALETTE.textPrimary,
      );
      return top + LAYOUT.rowHeight + LAYOUT.sectionGap;
    }
    const row = (
      cells: readonly string[],
      y: number,
      color: number,
      weight = "400",
    ): void =>
      cells.forEach((cell, i) =>
        this.text(
          left + (LAYOUT.columns[i] ?? 0),
          y,
          cell,
          LAYOUT.bodySize,
          color,
          weight,
        ),
      );
    row(MODE_TABLE_HEADER, top, HOLO_PALETTE.accent, "600");
    view.modeRows.forEach((cells, i) =>
      row(cells, top + (i + 1) * LAYOUT.rowHeight, HOLO_PALETTE.textPrimary),
    );
    return (
      top + (view.modeRows.length + 1) * LAYOUT.rowHeight + LAYOUT.sectionGap
    );
  }

  private drawFooterSections(
    view: TelemetryStatsView,
    left: number,
    top: number,
  ): void {
    this.text(
      left,
      top,
      "MOST COMMON DEATH CAUSES",
      LAYOUT.bodySize,
      HOLO_PALETTE.accent,
      "600",
    );
    const causes =
      view.deathCauses.length > 0 ? view.deathCauses : ["None recorded"];
    causes.forEach((line, i) =>
      this.text(
        left,
        top + (i + 1) * LAYOUT.rowHeight,
        line,
        LAYOUT.bodySize,
        HOLO_PALETTE.textPrimary,
      ),
    );
    const fsY =
      top + (causes.length + 1) * LAYOUT.rowHeight + LAYOUT.sectionGap;
    this.text(
      left,
      fsY,
      view.flightSchool,
      LAYOUT.bodySize,
      HOLO_PALETTE.textSecondary,
    );
  }

  private text(
    x: number,
    y: number,
    content: string,
    size: number,
    color: number,
    weight = "400",
  ): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, content, {
        ...holoFont(size, weight),
        color: toCssColor(color),
      })
      .setDepth(LAYOUT.depth);
  }

  private close(): void {
    if (this.returnScene) this.scene.resume(this.returnScene);
    this.scene.stop();
  }
}

/**
 * Open the Stats panel over a scene (which is paused until it closes).
 *
 * @param from - The scene opening it (e.g. Settings).
 */
export function openTelemetryStats(from: Phaser.Scene): void {
  const scenes = from.scene;
  if (!scenes.get(TELEMETRY_STATS_SCENE_KEY)) {
    scenes.add(TELEMETRY_STATS_SCENE_KEY, TelemetryStatsScene, false);
  }
  scenes.launch(TELEMETRY_STATS_SCENE_KEY, { returnScene: from.scene.key });
  scenes.bringToTop(TELEMETRY_STATS_SCENE_KEY);
  scenes.pause();
}
