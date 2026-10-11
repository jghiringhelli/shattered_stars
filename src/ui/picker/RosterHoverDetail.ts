/**
 * RosterHoverDetail — the lower block of the squad roster: details of the
 * hovered squad row (name, role, stat gauges, lore excerpt and the build's
 * upgrades), clamped to its box so it never spills past the panel.
 */

import type Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import type { ShipLoadout } from "../../data/ShipLoadouts";
import { getEncyclopediaEntry } from "../../data/ShipEncyclopedia";
import { UPGRADE_DEFINITIONS } from "../../systems/UpgradeSystem";
import { drawHoloGauge, type HoloRect } from "../menu/holoChrome";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import {
  addPickerText,
  pickerTextStyle,
  STAT_COLORS,
  STAT_GAUGE_MAX,
} from "./pickerStyle";

/** What is hovered. */
export interface RosterHoverSubject {
  readonly def: ShipDefinition;
  readonly loadout: ShipLoadout | null;
}

/** Block layout. */
const DETAIL = {
  roleY: 18,
  statsY: 38,
  statGap: HOLO_SPACING.sm,
  gaugeY: 16,
  gaugeH: 4,
  statsH: 28,
  loreLines: 2,
  lineGap: 2,
  upgradeIndent: HOLO_SPACING.sm,
} as const;

/**
 * Draw the hover detail block, or a muted hint when nothing is hovered.
 *
 * @param scene - Owning scene.
 * @param container - Target container.
 * @param subject - Hovered ship + build, or null.
 * @param rect - Block bounds.
 */
export function drawRosterHoverDetail(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  subject: RosterHoverSubject | null,
  rect: HoloRect,
): void {
  if (!subject) {
    container.add(
      addPickerText(
        scene,
        { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
        "Hover a row to see ship details",
        "small",
        HOLO_PALETTE.textMuted,
      ).setOrigin(0.5),
    );
    return;
  }
  const { def, loadout } = subject;
  const role = [def.role.replace(/_/g, " "), def.baseStats.size]
    .join(" \u00b7 ")
    .toUpperCase();
  container.add([
    addPickerText(scene, rect, def.name, "name", HOLO_PALETTE.textPrimary),
    addPickerText(
      scene,
      { x: rect.x, y: rect.y + DETAIL.roleY },
      role,
      "micro",
      HOLO_PALETTE.textSecondary,
    ),
  ]);
  let y = drawStats(scene, container, def, {
    ...rect,
    y: rect.y + DETAIL.statsY,
  });
  const lore = scene.add.text(
    rect.x,
    y,
    getEncyclopediaEntry(def.id)?.lore ?? def.description,
    pickerTextStyle("small", HOLO_PALETTE.textSecondary, {
      wordWrap: { width: rect.width },
      maxLines: DETAIL.loreLines,
    }),
  );
  container.add(lore);
  y += lore.height + HOLO_SPACING.sm;
  if (loadout?.upgrades.length) {
    const height = rect.y + rect.height - y;
    drawUpgrades(scene, container, loadout, { ...rect, y, height });
  }
}

/**
 * Five compact stat gauges.
 *
 * @param scene - Owning scene.
 * @param container - Target container.
 * @param def - The ship.
 * @param rect - Row bounds (top-left + width).
 * @returns y below the row.
 */
function drawStats(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  def: ShipDefinition,
  rect: HoloRect,
): number {
  const stats = [
    { label: "ATK", value: def.baseStats.attack, color: STAT_COLORS.attack },
    { label: "AGI", value: def.baseStats.agility, color: STAT_COLORS.agility },
    { label: "HUL", value: def.baseStats.hull, color: STAT_COLORS.hull },
    { label: "SHD", value: def.baseStats.shields, color: STAT_COLORS.shields },
    { label: "SPD", value: def.baseStats.speed.max, color: STAT_COLORS.speed },
  ];
  const colW =
    (rect.width - DETAIL.statGap * (stats.length - 1)) / stats.length;
  stats.forEach((stat, i) => {
    const sx = rect.x + i * (colW + DETAIL.statGap);
    const gauge = scene.add.graphics();
    drawHoloGauge(
      gauge,
      { x: sx, y: rect.y + DETAIL.gaugeY, width: colW, height: DETAIL.gaugeH },
      stat.value / STAT_GAUGE_MAX,
      stat.color,
    );
    container.add([
      addPickerText(
        scene,
        { x: sx, y: rect.y },
        stat.label,
        "micro",
        HOLO_PALETTE.textSecondary,
      ),
      addPickerText(
        scene,
        { x: sx + colW, y: rect.y },
        String(stat.value),
        "micro",
        HOLO_PALETTE.textPrimary,
      ).setOrigin(1, 0),
      gauge,
    ]);
  });
  return rect.y + DETAIL.statsH;
}

/**
 * Upgrade effect summary of a stat bonus record.
 *
 * @param upgradeId - Upgrade id.
 * @returns "• Name  [+1 hull, …]" or null for unknown ids.
 */
function upgradeLine(upgradeId: string): string | null {
  const upg = UPGRADE_DEFINITIONS[upgradeId];
  if (!upg) return null;
  const e = (upg.effects ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (e["hullBonus"]) parts.push(`+${e["hullBonus"]} hull`);
  if (e["shieldBonus"]) parts.push(`+${e["shieldBonus"]} shld`);
  if (e["attackBonus"]) parts.push(`+${e["attackBonus"]} atk`);
  if (e["agilityBonus"]) parts.push(`+${e["agilityBonus"]} agi`);
  if (e["addsAction"]) parts.push(`+${e["addsAction"]}`);
  if (e["rerollCount"]) parts.push(`reroll ${e["rerollCount"]}`);
  if (e["chargesAdded"]) parts.push(`+${e["chargesAdded"]} charges`);
  return `\u2022 ${upg.name}${parts.length ? `  [${parts.join(", ")}]` : ""}`;
}

/**
 * The build's name/description and its upgrades, stopping at the box bottom.
 *
 * @param scene - Owning scene.
 * @param container - Target container.
 * @param loadout - The build.
 * @param rect - Remaining box (y = first line).
 */
function drawUpgrades(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  loadout: ShipLoadout,
  rect: HoloRect,
): void {
  const bottom = rect.y + rect.height;
  const lines = [
    { text: `${loadout.name}: ${loadout.description}`, header: true },
    ...loadout.upgrades
      .map(upgradeLine)
      .filter((line): line is string => line !== null)
      .map((text) => ({ text, header: false })),
  ];
  let y = rect.y;
  for (const line of lines) {
    const indent = line.header ? 0 : DETAIL.upgradeIndent;
    const color = line.header
      ? HOLO_PALETTE.success
      : HOLO_PALETTE.textSecondary;
    const t = scene.add.text(
      rect.x + indent,
      y,
      line.text,
      pickerTextStyle("micro", color, {
        fontStyle: line.header ? "600" : "400",
        wordWrap: { width: rect.width - indent },
        maxLines: 1,
      }),
    );
    if (y + t.height > bottom) {
      t.destroy();
      return;
    }
    container.add(t);
    y += t.height + DETAIL.lineGap;
  }
}
