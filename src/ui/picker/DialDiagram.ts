/**
 * DialDiagram — a ship's maneuver dial drawn as a speed x direction grid of
 * green / white / red cells (stats tab). Each cell and the colour legend
 * explain themselves on hover.
 */

import type { ManeuverDifficulty } from "../../core/types";
import { effectiveDial } from "../../data/shipSpecials";
import { shipSpecialsRule } from "../../systems/SettingsStorage";
import { termEntry } from "../../data/tooltips";
import { firstSentence } from "../menu/tooltipContent";
import { addTipZone } from "../menu/tooltipTargets";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { buildDialGrid } from "./dialGrid";
import { addPickerText } from "./pickerStyle";
import type { SectionArea } from "./detailSections";

/** Grid metrics (px). */
const CELL = { width: 28, height: 18, gap: 4, labelW: 32, headerH: 18 } as const;
/** Cell fill by maneuver colour. */
const DIFFICULTY_COLOR: Readonly<Record<ManeuverDifficulty, number>> = {
  green: HOLO_PALETTE.success,
  white: HOLO_PALETTE.textPrimary,
  red: HOLO_PALETTE.danger,
};
/** Opacity of a present / absent cell. */
const PRESENT_ALPHA = 0.85;
const ABSENT_ALPHA = 0.12;
const LEGEND_GAP = 16;

/**
 * Draws the dial grid with a legend line under it.
 *
 * @param area - Target and box (width is the room for the grid).
 * @param shipId - Ship whose dial to draw.
 * @returns y below the diagram.
 */
export function drawDialDiagram(area: SectionArea, shipId: string): number {
  const { scene, container, x, y } = area;
  const grid = buildDialGrid(effectiveDial(shipId, shipSpecialsRule()));
  const step = CELL.width + CELL.gap;
  const gridX = x + CELL.labelW;
  const g = scene.add.graphics();
  container.add(g);
  grid.columns.forEach((column, i) => {
    container.add(
      addPickerText(
        scene,
        { x: gridX + i * step + CELL.width / 2, y },
        column.label,
        "caption",
        HOLO_PALETTE.textSecondary,
      ).setOrigin(0.5, 0),
    );
  });
  grid.rows.forEach((row, r) => {
    const top = y + CELL.headerH + r * (CELL.height + CELL.gap);
    container.add(
      addPickerText(
        scene,
        { x, y: top + 1 },
        `${row.speed}`,
        "caption",
        HOLO_PALETTE.textSecondary,
      ),
    );
    row.cells.forEach((cell, c) => {
      const cx = gridX + c * step;
      g.fillStyle(
        cell.difficulty ? DIFFICULTY_COLOR[cell.difficulty] : HOLO_PALETTE.border,
        cell.difficulty ? PRESENT_ALPHA : ABSENT_ALPHA,
      );
      g.fillRoundedRect(cx, top, CELL.width, CELL.height, 3);
      if (!cell.difficulty) return;
      const name = grid.columns[c]!.name;
      const colour = termEntry(`dial.${cell.difficulty}`);
      addTipZone(
        scene,
        container,
        { x: cx, y: top, width: CELL.width, height: CELL.height },
        {
          title: `${name} \u00b7 speed ${row.speed}`,
          body: `${colour.title}: ${firstSentence(colour.definition)}`,
        },
      );
    });
  });
  const bottom = y + CELL.headerH + grid.rows.length * (CELL.height + CELL.gap);
  return drawLegend(area, grid.counts, bottom);
}

function drawLegend(
  area: SectionArea,
  counts: Readonly<Record<ManeuverDifficulty, number>>,
  top: number,
): number {
  let lx = area.x;
  for (const difficulty of ["green", "white", "red"] as const) {
    const label = addPickerText(
      area.scene,
      { x: lx + 12, y: top },
      `${counts[difficulty]} ${difficulty.toUpperCase()}`,
      "caption",
      DIFFICULTY_COLOR[difficulty],
    );
    const dot = area.scene.add.circle(lx + 4, top + 7, 4, DIFFICULTY_COLOR[difficulty]);
    area.container.add([dot, label]);
    addTipZone(
      area.scene,
      area.container,
      { x: lx, y: top, width: label.width + 12, height: label.height },
      `dial.${difficulty}`,
    );
    lx += label.width + 12 + LEGEND_GAP;
  }
  return top + CELL.headerH;
}
