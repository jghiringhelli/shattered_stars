/**
 * detailTabBodies — the OVERVIEW and STATS bodies of the ship detail panel.
 * Overview: art, short description, the build line, aura tag, four key
 * numbers and the speed range. Stats: the full numbers grid, the maneuver
 * dial and the action bar.
 */

import type { ShipDefinition } from "../../core/types";
import { shipArtAsset } from "../../assets/assetManifest";
import { swapWhenLoaded } from "../../assets/textureLoading";
import type { ShipLoadout } from "../../data/ShipLoadouts";
import { roleTermId, termEntry, type TermId } from "../../data/tooltips";
import { firstSentence } from "../menu/tooltipContent";
import { addTipZone } from "../menu/tooltipTargets";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import { addContainedImage } from "./catalogHelpers";
import { drawDialDiagram } from "./DialDiagram";
import { drawActions, drawStatGauges, type SectionArea } from "./detailSections";
import { overviewModel } from "./overviewModel";
import { addPickerText, pickerTextStyle } from "./pickerStyle";
import type { LoadoutBonuses } from "./types";

/** What a tab body needs. */
export interface TabBodyArgs {
  readonly area: SectionArea;
  readonly def: ShipDefinition;
  readonly loadout: ShipLoadout | undefined;
  readonly bonuses: LoadoutBonuses;
  /** Lowest y the body may reach. */
  readonly bottom: number;
}

/** Overview metrics (px). */
const OVERVIEW = { artMaxW: 280, artMaxH: 200, textGap: HOLO_SPACING.xl } as const;

/**
 * Overview tab.
 *
 * @param args - Area, ship, build and limits.
 * @returns y below the body.
 */
export function drawOverviewBody(args: TabBodyArgs): number {
  const { area, def, loadout, bonuses } = args;
  const { scene, container, x, y, width } = area;
  const model = overviewModel(def, bonuses);
  const artW = Math.min(OVERVIEW.artMaxW, width * 0.4);
  const artH = Math.min(OVERVIEW.artMaxH, args.bottom - y - 112);
  const artKey = [`ship_art_${def.id}`, def.spriteKey].find((key) =>
    scene.textures.exists(key),
  ) ?? `ship_${def.faction}_${def.baseStats.size}`;
  const art = addContainedImage(scene, artKey, x + artW / 2, y + artH / 2, artW, artH);
  swapWhenLoaded(scene, art, shipArtAsset(def), { maxWidth: artW, maxHeight: artH });
  container.add(art);
  const textX = x + artW + OVERVIEW.textGap;
  const textW = width - artW - OVERVIEW.textGap;
  const description = scene.add.text(
    textX,
    y,
    model.description,
    pickerTextStyle("body", HOLO_PALETTE.textPrimary, { wordWrap: { width: textW } }),
  );
  container.add(description);
  let ty = y + description.height + HOLO_SPACING.md;
  ty = drawRoleLine(area, { x: textX, y: ty, width: textW }, def);
  ty = drawBuildLine(
    area,
    { x: textX, y: ty + HOLO_SPACING.md, width: textW },
    def,
    loadout,
  );
  ty = drawAuraTag(area, { x: textX, y: ty + HOLO_SPACING.sm, width: textW }, model.aura);
  const gaugesY = Math.max(y + artH, ty) + HOLO_SPACING.lg;
  const bottom = drawStatGauges(areaAt(area, gaugesY), def, bonuses);
  return drawSpeedLine(area, model.speedText, bottom + HOLO_SPACING.md);
}

function areaAt(area: SectionArea, y: number): SectionArea {
  return { ...area, y };
}

function drawRoleLine(
  area: SectionArea,
  box: { x: number; y: number; width: number },
  def: ShipDefinition,
): number {
  const id = roleTermId(def.role);
  const entry = termEntry(id);
  const line = area.scene.add.text(
    box.x,
    box.y,
    `${entry.title}: ${firstSentence(entry.definition)}`,
    pickerTextStyle("small", HOLO_PALETTE.textSecondary, {
      wordWrap: { width: box.width },
    }),
  );
  area.container.add(line);
  addTipZone(
    area.scene,
    area.container,
    { x: box.x, y: box.y, width: box.width, height: line.height },
    id,
  );
  return box.y + line.height;
}

function drawBuildLine(
  area: SectionArea,
  box: { x: number; y: number; width: number },
  def: ShipDefinition,
  loadout: ShipLoadout | undefined,
): number {
  const text = loadout
    ? `${loadout.name} \u00b7 ${loadout.pointCost} pt`
    : `Stock ship \u00b7 ${def.baseStats.pointCost} pt \u2014 open BUILDS for pilots and cards`;
  const line = addPickerText(
    area.scene,
    { x: box.x, y: box.y },
    text.toUpperCase(),
    "caption",
    loadout ? HOLO_PALETTE.success : HOLO_PALETTE.textSecondary,
  );
  line.setWordWrapWidth(box.width);
  area.container.add(line);
  addTipZone(
    area.scene,
    area.container,
    { x: box.x, y: box.y, width: line.width, height: line.height },
    "ui.flown_cost",
  );
  return box.y + line.height;
}

function drawAuraTag(
  area: SectionArea,
  box: { x: number; y: number; width: number },
  aura: { name: string; text: string },
): number {
  const tag = addPickerText(
    area.scene,
    { x: box.x, y: box.y },
    `\u2605 ${aura.name.toUpperCase()}`,
    "caption",
    HOLO_PALETTE.warning,
  );
  area.container.add(tag);
  addTipZone(
    area.scene,
    area.container,
    { x: box.x, y: box.y, width: tag.width, height: tag.height },
    "ui.aura_tag",
  );
  return box.y + tag.height;
}

function drawSpeedLine(
  area: SectionArea,
  speed: string,
  y: number,
): number {
  const line = addPickerText(
    area.scene,
    { x: area.x, y },
    `SPEED  ${speed}`,
    "caption",
    HOLO_PALETTE.textSecondary,
  );
  area.container.add(line);
  addTipZone(
    area.scene,
    area.container,
    { x: area.x, y, width: line.width, height: line.height },
    "stat.speed",
  );
  return y + line.height;
}

/** Rows of the stats grid: label, value, term. */
function statRows(
  def: ShipDefinition,
  b: LoadoutBonuses,
): ReadonlyArray<{ label: string; value: string; term: TermId }> {
  const s = def.baseStats;
  const num = (base: number, bonus: number): string =>
    bonus ? `${base + bonus} (+${bonus})` : String(base);
  return [
    { label: "HULL", value: num(s.hull, b.hull), term: "stat.hull" },
    { label: "SHIELDS", value: num(s.shields, b.shld), term: "stat.shields" },
    { label: "ATTACK", value: num(s.attack, b.atk), term: "stat.attack" },
    { label: "AGILITY", value: num(s.agility, b.agi), term: "stat.agility" },
    { label: "SPEED", value: `${s.speed.min}\u2013${s.speed.max}`, term: "stat.speed" },
    ...(s.armor ? [{ label: "ARMOR", value: String(s.armor), term: "stat.hull" as TermId }] : []),
  ];
}

/**
 * Stats tab: numbers grid and dial side by side, actions below.
 *
 * @param args - Area, ship, build and limits.
 * @returns y below the body.
 */
export function drawStatsBody(args: TabBodyArgs): number {
  const { area, def, bonuses } = args;
  const { scene, container, x, y, width } = area;
  const gridW = Math.min(220, width * 0.38);
  const rowH = 24;
  statRows(def, bonuses).forEach((row, i) => {
    const ry = y + i * rowH;
    container.add([
      addPickerText(scene, { x, y: ry }, row.label, "caption", HOLO_PALETTE.textSecondary),
      addPickerText(scene, { x: x + gridW, y: ry }, row.value, "numeric", HOLO_PALETTE.textPrimary).setOrigin(1, 0),
    ]);
    addTipZone(scene, container, { x, y: ry, width: gridW, height: rowH - 2 }, row.term);
  });
  const dialX = x + gridW + HOLO_SPACING.xl;
  const dialBottom = drawDialDiagram({ ...area, x: dialX, width: width - gridW - HOLO_SPACING.xl }, def.id);
  const gridBottom = y + statRows(def, bonuses).length * rowH;
  return drawActions(areaAt(area, Math.max(dialBottom, gridBottom) + HOLO_SPACING.lg), def, true);
}
