/**
 * duelSetupBodies — the STATS, BUILDS and MATCH tab bodies shared by the
 * Dogfight and Ace Duel setups. Each draws into the tab's root container
 * and keeps the screen to a handful of text elements.
 */

import type Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import {
  explainBaseShip,
  explainQuickBuild,
  quickBuildHint,
} from "../../data/roleHints";
import { getEquippableLoadouts, getLoadoutById, type ShipLoadout } from "../../data/ShipLoadouts";
import { addSelectable } from "../../ui/menu/FlatControls";
import { addTipZone } from "../../ui/menu/tooltipTargets";
import { computeLoadoutBonuses } from "../../ui/picker/catalogHelpers";
import { BuildGuideView } from "../../ui/picker/BuildGuideView";
import { buildToggleTooltip } from "../../ui/picker/buildTooltips";
import { buildsSections, costSummary } from "../../ui/picker/guideSections";
import { addPickerText, pickerTextStyle } from "../../ui/picker/pickerStyle";
import { HOLO_PALETTE, HOLO_SPACING, SIDE_COLORS } from "../../ui/theme/HoloTheme";
import { compareStats, type StatBonuses, type StatCompareRow } from "./duelStatsModel";
import { measureText } from "./duelSetupWidgets";
import type { BodyArea } from "./duelSetupChrome";
export type { BodyArea } from "./duelSetupChrome";

/** One side of the comparison. */
export interface StatSide {
  readonly name: string;
  readonly def: ShipDefinition;
  readonly loadoutId: string | null;
}

/** Width of the stats table (px). */
const TABLE_W = 640;
/** Table geometry (px). */
const ROW = { pitch: 56, heading: 48, barH: 8, gutter: 96, valueGap: 16 } as const;

/**
 * @param loadoutId - A quick build or null.
 * @returns Its stat bonuses.
 */
function bonusesOf(loadoutId: string | null): StatBonuses {
  const loadout = loadoutId ? getLoadoutById(loadoutId) : undefined;
  return computeLoadoutBonuses(loadout?.upgrades ?? []);
}

/**
 * STATS tab: the two ships stat by stat as mirrored bars; the better value of
 * a row is highlighted.
 *
 * @param area - Where to draw.
 * @param you - Your side.
 * @param enemy - The enemy side.
 */
export function drawStatsBody(area: BodyArea, you: StatSide, enemy: StatSide): void {
  const { scene, root } = area;
  const left = area.x + (area.width - TABLE_W) / 2;
  const centre = left + TABLE_W / 2;
  const heading = (text: string, color: number, atX: number, origin: number): void => {
    const title = addPickerText(scene, { x: atX, y: area.y }, text, "title", color).setOrigin(origin, 0);
    root.add(title);
    const box = title.getBounds();
    addTipZone(scene, root, { x: box.x, y: box.y, width: box.width, height: box.height }, "duel.stat_compare");
  };
  heading(you.name, SIDE_COLORS.player, centre - ROW.gutter, 1);
  heading(enemy.name, SIDE_COLORS.enemy, centre + ROW.gutter, 0);
  const rows = compareStats(you.def, bonusesOf(you.loadoutId), enemy.def, bonusesOf(enemy.loadoutId));
  rows.forEach((row, i) => drawStatRow(area, row, centre, area.y + ROW.heading + i * ROW.pitch));
}

function drawStatRow(
  area: BodyArea,
  row: StatCompareRow,
  centre: number,
  y: number,
): void {
  const { scene, root } = area;
  const half = TABLE_W / 2 - ROW.gutter;
  const scale = Math.max(row.you, row.enemy, 1);
  const bars = scene.add.graphics();
  const barY = y + 24;
  bars.fillStyle(HOLO_PALETTE.border, 0.5);
  bars.fillRect(centre - ROW.gutter - half, barY, half, ROW.barH);
  bars.fillRect(centre + ROW.gutter, barY, half, ROW.barH);
  bars.fillStyle(SIDE_COLORS.player, row.better === "enemy" ? 0.45 : 1);
  const youW = (half * row.you) / scale;
  bars.fillRect(centre - ROW.gutter - youW, barY, youW, ROW.barH);
  bars.fillStyle(SIDE_COLORS.enemy, row.better === "you" ? 0.45 : 1);
  bars.fillRect(centre + ROW.gutter, barY, (half * row.enemy) / scale, ROW.barH);
  const value = (lead: boolean): Phaser.Types.GameObjects.Text.TextStyle =>
    pickerTextStyle("numeric", lead ? HOLO_PALETTE.textPrimary : HOLO_PALETTE.textMuted);
  const youText = scene.add.text(centre - ROW.gutter, y, String(row.you), value(row.better !== "enemy")).setOrigin(1, 0);
  const enemyText = scene.add.text(centre + ROW.gutter, y, String(row.enemy), value(row.better !== "you")).setOrigin(0, 0);
  const label = addPickerText(scene, { x: centre, y: y + 2 }, row.label, "caption", HOLO_PALETTE.textSecondary).setOrigin(0.5, 0);
  root.add([bars, youText, enemyText, label]);
  addTipZone(scene, root, { x: centre - TABLE_W / 2, y, width: TABLE_W, height: ROW.pitch - HOLO_SPACING.sm }, row.term);
}

/** What the BUILDS tab shows. */
export interface BuildsView {
  readonly shipId: string;
  readonly loadoutId: string | null;
  readonly accent: number;
  /** Chip page shown when the ship has many builds. */
  readonly onPick: (loadoutId: string | null) => void;
  /** Several ships on your side: which one the chips edit. */
  readonly shipSwitch?: {
    readonly count: number;
    readonly index: number;
    readonly onSelect: (index: number) => void;
  };
  /** The enemy's build, summarised in one line (null = hide the line). */
  readonly enemy: { readonly shipId: string; readonly loadoutId: string | null } | null;
}

/** Height of a build chip (px). */
const CHIP_H = 32;
/** Horizontal padding inside a build chip (px). */
const CHIP_PAD = 16;
/** Width of a ship-switch chip (px). */
const SWITCH_W = 96;

/**
 * BUILDS tab: a chip per quick build of your ship, what the selected build is
 * for, how to fly it and one line about the enemy's build.
 *
 * @param area - Where to draw.
 * @param view - Ship, selection and callbacks.
 */
export function drawBuildsBody(area: BodyArea, view: BuildsView): number {
  const { scene, root } = area;
  const loadouts = getEquippableLoadouts(view.shipId);
  const chipsBottom = drawBuildChips(area, view, loadouts);
  const selected = loadouts.find((l) => l.id === view.loadoutId);
  const guide = selected ? explainQuickBuild(selected) : explainBaseShip(view.shipId);
  const { left, right } = buildsSections(guide);
  const colW = (area.width - HOLO_SPACING.xl) / 2;
  const box = { x: area.x, y: chipsBottom + HOLO_SPACING.lg, width: colW, bottom: area.bottom - HOLO_SPACING.xxl };
  const guideView = new BuildGuideView(scene, root);
  const leftBottom = guideView.renderSections(left.slice(0, 2), box);
  const rightBottom = guideView.renderSections(right, { ...box, x: area.x + colW + HOLO_SPACING.xl });
  const costY = Math.max(leftBottom, rightBottom) + HOLO_SPACING.lg;
  const cost = addPickerText(scene, { x: area.x, y: costY }, `FLOWN COST  ${costSummary(guide)}`.toUpperCase(), "caption", HOLO_PALETTE.accent);
  root.add(cost);
  addTipZone(scene, root, { x: cost.x, y: cost.y, width: cost.width, height: cost.height }, "ui.cost_breakdown");
  const bottom = costY + cost.height;
  if (view.enemy) drawEnemyLine(area, view.enemy, bottom + HOLO_SPACING.lg);
  return bottom;
}

/**
 * Draws the ship switch (several ships) and one chip per quick build, wrapping
 * onto a new row at the area's right edge.
 *
 * @returns y just below the last chip row.
 */
function drawBuildChips(
  area: BodyArea,
  view: BuildsView,
  loadouts: readonly ShipLoadout[],
): number {
  const { scene, root } = area;
  let y = area.y;
  if (view.shipSwitch) {
    const { count, index, onSelect } = view.shipSwitch;
    for (let i = 0; i < count; i++) {
      addSelectable(scene, root, {
        x: area.x + i * (SWITCH_W + HOLO_SPACING.sm),
        y,
        width: SWITCH_W,
        height: CHIP_H,
        label: `SHIP ${i + 1}`,
        role: "micro",
        selected: i === index,
        accent: view.accent,
        onPress: () => onSelect(i),
      });
    }
    y += CHIP_H + HOLO_SPACING.sm;
  }
  let x = area.x;
  for (const loadout of loadouts) {
    const label = `${loadout.name.toUpperCase()} \u00b7 ${loadout.pointCost}`;
    const width = measureText(scene, label, "micro") + CHIP_PAD * 2;
    if (x + width > area.x + area.width) {
      x = area.x;
      y += CHIP_H + HOLO_SPACING.sm;
    }
    addSelectable(scene, root, {
      x,
      y,
      width,
      height: CHIP_H,
      label,
      role: "micro",
      selected: loadout.id === view.loadoutId,
      accent: view.accent,
      tip: buildToggleTooltip(loadout),
      onPress: () => view.onPick(loadout.id),
    });
    x += width + HOLO_SPACING.sm;
  }
  return y + CHIP_H;
}

function drawEnemyLine(
  area: BodyArea,
  enemy: { readonly shipId: string; readonly loadoutId: string | null },
  y: number,
): void {
  const loadout = enemy.loadoutId ? getLoadoutById(enemy.loadoutId) : undefined;
  const hint = loadout ? quickBuildHint(loadout) : null;
  const text = loadout
    ? `ENEMY FLIES  ${loadout.name} \u00b7 ${loadout.pointCost} pt${hint ? ` \u2014 ${hint.role}` : ""}`
    : "ENEMY FLIES  the stock hull";
  const line = addPickerText(area.scene, { x: area.x, y }, text, "name", SIDE_COLORS.enemy);
  area.root.add(line);
  addTipZone(area.scene, area.root, { x: line.x, y: line.y, width: line.width, height: line.height }, "duel.enemy_build");
}
