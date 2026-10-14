/**
 * SquadPilotTabs — the squad panel's STATS, LOADOUT and PILOT bodies: the
 * selected pilot's ship numbers, equipped abilities and skill progress. Each
 * line explains itself on hover (short) or hold / focus (full).
 */

import type Phaser from "phaser";
import type { FactionId } from "../../config";
import type { CampaignPilotState } from "../../campaign/save/campaignSaveTypes";
import { getShipDefinition } from "../../data/ShipDefinitions";
import { roleTermId, termEntry } from "../../data/tooltips";
import { shipDisplayName } from "../idLabels";
import type { DetailTabId } from "../menu/detailTabsModel";
import { addTipZone } from "../menu/tooltipTargets";
import { addPickerText } from "../picker/pickerStyle";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import {
  pilotLoadout,
  pilotProgress,
  pilotStatRows,
} from "./squadModel";

/** Where a body is drawn (container coordinates, top-left). */
export interface SquadBodyBox {
  readonly scene: Phaser.Scene;
  readonly container: Phaser.GameObjects.Container;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly accent: number;
}

/** Height of one stat row (px, 8 px grid) and stats per row. */
const STAT_ROW_HEIGHT = 32;
const STAT_COLUMNS = 2;
/** Gap between stacked lines (px). */
const LINE_GAP = HOLO_SPACING.md;

/**
 * Draws the tab's body for a pilot (the overview is drawn by the panel).
 *
 * @param box - Where to draw.
 * @param tab - Open tab (stats, loadout or pilot).
 * @param factionId - Campaign faction.
 * @param pilot - The selected pilot.
 */
export function drawPilotTab(
  box: SquadBodyBox,
  tab: DetailTabId,
  factionId: FactionId,
  pilot: CampaignPilotState,
): void {
  const y = drawShipLine(box, pilot);
  if (tab === "stats") drawStats(box, pilot, y);
  else if (tab === "loadout") drawLoadout(box, factionId, pilot, y);
  else drawProgress(box, factionId, pilot, y);
}

/** Ship and role line under the pilot header; returns the y below it. */
function drawShipLine(box: SquadBodyBox, pilot: CampaignPilotState): number {
  const { scene, container, x, y, width } = box;
  const def = getShipDefinition(pilot.currentShipId);
  const line = addPickerText(
    scene,
    { x, y },
    shipDisplayName(pilot.currentShipId).toUpperCase(),
    "caption",
    box.accent,
  );
  line.setWordWrapWidth(width);
  container.add(line);
  addTipZone(
    scene,
    container,
    { x, y, width, height: line.height },
    def ? roleTermId(def.role) : "campaign.squad_ship",
  );
  return y + line.height + LINE_GAP * 2;
}

function drawStats(box: SquadBodyBox, pilot: CampaignPilotState, top: number): void {
  const { scene, container, x, width } = box;
  const cell = width / STAT_COLUMNS;
  pilotStatRows(pilot).forEach((row, i) => {
    const cx = x + (i % STAT_COLUMNS) * cell;
    const cy = top + Math.floor(i / STAT_COLUMNS) * STAT_ROW_HEIGHT;
    container.add(
      addPickerText(scene, { x: cx, y: cy }, `${row.label} ${row.value}`, "name", HOLO_PALETTE.textPrimary),
    );
    addTipZone(
      scene,
      container,
      { x: cx, y: cy, width: cell, height: STAT_ROW_HEIGHT },
      row.value.includes("(") ? "campaign.pilot_bonus" : row.term,
    );
  });
}

function drawLoadout(
  box: SquadBodyBox,
  factionId: FactionId,
  pilot: CampaignPilotState,
  top: number,
): void {
  const { scene, container, x, width } = box;
  const loadout = pilotLoadout(factionId, pilot);
  const slots = addPickerText(scene, { x, y: top }, loadout.slotsText, "caption", HOLO_PALETTE.textSecondary);
  container.add(slots);
  addTipZone(scene, container, { x, y: top, width, height: slots.height }, "campaign.pilot_slots");
  const entry = termEntry("campaign.pilot_ability");
  let y = top + slots.height + LINE_GAP;
  for (const ability of loadout.abilities) {
    const name = addPickerText(scene, { x, y }, ability.name, "name", HOLO_PALETTE.textPrimary);
    container.add(name);
    addTipZone(scene, container, { x, y, width, height: name.height }, {
      title: ability.name,
      body: ability.description || entry.definition,
      howItPlays: entry.howItPlays ?? entry.definition,
      example: entry.example,
    });
    y += name.height + LINE_GAP;
  }
}

function drawProgress(
  box: SquadBodyBox,
  factionId: FactionId,
  pilot: CampaignPilotState,
  top: number,
): void {
  const { scene, container, x, width } = box;
  const progress = pilotProgress(factionId, pilot);
  const lines = [
    { text: progress.skillText, role: "numeric", term: "campaign.pilot_skill" },
    { text: progress.xpText, role: "name", term: "campaign.pilot_xp" },
    { text: progress.nextText, role: "small", term: "campaign.pilot_next" },
    { text: progress.roleText, role: "caption", term: "campaign.pilot_role" },
  ] as const;
  let y = top;
  for (const line of lines) {
    const text = addPickerText(scene, { x, y }, line.text, line.role, HOLO_PALETTE.textPrimary);
    text.setWordWrapWidth(width);
    container.add(text);
    addTipZone(scene, container, { x, y, width, height: text.height }, line.term);
    y += text.height + LINE_GAP * 2;
  }
}
