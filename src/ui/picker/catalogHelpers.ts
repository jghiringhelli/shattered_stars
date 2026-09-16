/**
 * catalogHelpers — pure functions for loadout bonus computation and display.
 * Shared between ShipCatalogPanel (tooltip) and CatalogStaging (loadout area).
 */

import Phaser from "phaser";
import { UPGRADE_DEFINITIONS } from "../../systems/UpgradeSystem";
import type { ShipDefinition } from "../../core/types";
import type { LoadoutBonuses } from "./types";

export const CAT_X = 60;
export const CAT_W = 440;

/**
 * Adds an image scaled to FIT (preserve aspect ratio) within a maxW × maxH
 * box, centered at (cx, cy) — never stretches/distorts the source texture,
 * unlike `setDisplaySize(w, h)` with a fixed box of a different ratio.
 *
 * @param scene - Owning scene.
 * @param key - Texture key (must already be loaded).
 * @param cx - Box center X.
 * @param cy - Box center Y.
 * @param maxW - Box width.
 * @param maxH - Box height.
 */
export function addContainedImage(
  scene: Phaser.Scene,
  key: string,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
): Phaser.GameObjects.Image {
  const src = scene.textures.get(key).getSourceImage();
  const srcW = "width" in src ? src.width : maxW;
  const srcH = "height" in src ? src.height : maxH;
  const scale = Math.min(maxW / srcW, maxH / srcH);
  return scene.add
    .image(cx, cy, key)
    .setDisplaySize(srcW * scale, srcH * scale);
}

/** Maps an action key to a human-readable in-game label. */
export function formatActionName(action: string): string {
  const labels: Record<string, string> = {
    boost: "Boost",
    barrel_roll: "Barrel Roll",
    calculate: "Calculate",
    coordinate: "Coordinate",
    target_lock: "Target Lock",
    evade: "Evade",
    focus: "Focus",
  };
  return labels[action] ?? action.replace(/_/g, " ");
}

/** Aggregates stat and special effects from a list of upgrade IDs. */
export function computeLoadoutBonuses(
  upgradeIds: readonly string[],
): LoadoutBonuses {
  const b: LoadoutBonuses = {
    hull: 0,
    shld: 0,
    atk: 0,
    agi: 0,
    range: 0,
    actions: [],
    rerolls: 0,
    charges: 0,
  };
  for (const upId of upgradeIds) {
    const e = UPGRADE_DEFINITIONS[upId]?.effects;
    if (!e) continue;
    if (e.hullBonus) b.hull += e.hullBonus;
    if (e.shieldBonus) b.shld += e.shieldBonus;
    if (e.attackBonus) b.atk += e.attackBonus;
    if (e.agilityBonus) b.agi += e.agilityBonus;
    if (e.rangeBonus) b.range += e.rangeBonus;
    if (e.addsAction) b.actions.push(formatActionName(e.addsAction));
    if (e.addsActionLinked)
      b.actions.push(
        `${formatActionName(e.addsActionLinked.action)} (linked → ${formatActionName(e.addsActionLinked.linkedTo)})`,
      );
    if (e.rerollCount) b.rerolls += e.rerollCount;
    if (e.chargesAdded) b.charges += e.chargesAdded;
  }
  return b;
}

/** Produces short colored-stat strings like "+2 HUL  +1 ATK". */
export function buildStatLine(b: LoadoutBonuses, basePt: number): string {
  const parts: string[] = [`${basePt}pt`];
  if (b.hull) parts.push(`${b.hull > 0 ? "+" : ""}${b.hull} HUL`);
  if (b.shld) parts.push(`${b.shld > 0 ? "+" : ""}${b.shld} SHD`);
  if (b.atk) parts.push(`${b.atk > 0 ? "+" : ""}${b.atk} ATK`);
  if (b.agi) parts.push(`${b.agi > 0 ? "+" : ""}${b.agi} AGI`);
  if (b.range) parts.push(`+${b.range} RNG`);
  return parts.join("  ");
}

/** Secondary capability tags derived from ship role and available actions. */
export function secondaryTags(def: ShipDefinition): string[] {
  const tags: string[] = [];
  if (def.role === "gunship" || def.baseStats.actions.includes("rotate_arc"))
    tags.push("TURRET");
  if (def.role === "bomber" || def.baseStats.actions.includes("reload"))
    tags.push("ORDNANCE");
  if (def.role === "support" || def.baseStats.actions.includes("coordinate"))
    tags.push("SUPPORT");
  return tags;
}
