/**
 * Survival roguelite — the map's side panel: run status (sector, seed,
 * ascension, salvage, rerolls), fleet hull, relics with synergy tags,
 * mutations, set bonuses and the node legend. The text is built by pure
 * functions (runStatusText.ts); the panel only lays it out.
 */

import Phaser from "phaser";
import { LEGEND_ORDER, NODE_INFO } from "../../data/survival/nodes";
import type { RunState } from "../../systems/survival/RunTypes";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { holoFont } from "../theme/holoFont";
import { toCssColor } from "../theme/colorMath";
import { buildLines, fleetLines, statusLines } from "./runStatusText";

/** Panel column (px). */
const PANEL_X = 900;
const PANEL_TOP = 110;
const PANEL_WIDTH = 360;
const LINE_SPACING = 3;
/** Legend line (px): one row under the map. */
const LEGEND_X = 60;
const LEGEND_Y = 690;

export class RunStatusPanel {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];

  /** @param scene - The map scene. */
  constructor(private readonly scene: Phaser.Scene) {}

  /**
   * Redraws the panel for the run.
   *
   * @param run - The run.
   */
  render(run: RunState): void {
    this.objects.forEach((o) => o.destroy());
    this.objects.length = 0;
    let y = PANEL_TOP;
    y = this.block(statusLines(run), y, HOLO_PALETTE.textPrimary, "600");
    y = this.block(
      ["FLEET", ...fleetLines(run)],
      y + 8,
      HOLO_PALETTE.textSecondary,
    );
    this.block(
      ["BUILD", ...buildLines(run)],
      y + 8,
      HOLO_PALETTE.textSecondary,
    );
    const legend = LEGEND_ORDER.map(
      (t) => `${NODE_INFO[t].icon} ${NODE_INFO[t].label}`,
    ).join("    ");
    this.objects.push(
      this.scene.add
        .text(LEGEND_X, LEGEND_Y, `LEGEND   ${legend}`, {
          ...holoFont(13, "400"),
          color: toCssColor(HOLO_PALETTE.textMuted),
        })
        .setOrigin(0, 0.5),
    );
  }

  private block(
    lines: readonly string[],
    top: number,
    color: number,
    weight = "400",
  ): number {
    const text = this.scene.add
      .text(PANEL_X, top, lines.join("\n"), {
        ...holoFont(13, weight),
        color: toCssColor(color),
        lineSpacing: LINE_SPACING,
        wordWrap: { width: PANEL_WIDTH },
      })
      .setOrigin(0, 0);
    this.objects.push(text);
    return top + text.height;
  }
}
