/**
 * ChroniclePanel — the hub's global story timeline: the 15 crossover battles
 * by day of the crisis, which campaigns have witnessed each (filled pip =
 * played), whose point of view wrote canon, and the unity / key tallies the
 * Act V ending reads. Presentation only; the model is chronicleTimeline.
 */

import type Phaser from "phaser";
import type { FactionId } from "../../config";
import type {
  ChronicleSummary,
  TimelineRow,
} from "../../campaign/chronicle/chronicleTimeline";
import {
  UNITY_FLAGS,
  FACTION_KEYS,
  STORY_ACT_DAYS,
} from "../../data/campaign/crossovers";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import { HOLO_PALETTE, factionAccent } from "../theme/HoloTheme";
import { CAMPAIGN_TEXT, addHoloText } from "./campaignUi";

/** Last day of the crisis. */
const LAST_DAY = STORY_ACT_DAYS[STORY_ACT_DAYS.length - 1]!.toDay;

/** Panel layout (screen px for x/top/width). */
export const CHRONICLE_LAYOUT = {
  x: 32,
  top: 104,
  width: 640,
  headerHeight: 28,
  padding: 16,
  summaryHeight: 22,
  rowHeight: 26,
  dayWidth: 70,
  pipRadius: 6,
  pipGap: 18,
  pipsX: 330,
  canonRight: 608,
} as const;

/** Short point-of-view names. */
export const POV_LABEL: Readonly<Record<FactionId, string>> = {
  terran_hegemony: "HEGEMONY",
  free_confederation: "CONFEDERATION",
  synthetic_collective: "COLLECTIVE",
  void_corsairs: "CORSAIRS",
  ascendant_empire: "ASCENDANT",
};

/**
 * @param summary - The Chronicle's summary.
 * @returns The one-line tally above the timeline.
 */
export function summaryLine(summary: ChronicleSummary): string {
  return (
    `DAY ${summary.dayReached} OF ${LAST_DAY}  ·  ` +
    `CROSSOVERS ${summary.resolved} / ${summary.rows.length}  ·  ` +
    `UNITY ${summary.unity} / ${UNITY_FLAGS.length}  ·  ` +
    `KEYS ${summary.keys} / ${FACTION_KEYS.length}`
  );
}

/**
 * @param scene - Owning scene.
 * @param panel - Panel to draw in.
 * @param row - A crossover row.
 * @param y - Row centre (panel-local).
 * @param left - Panel-local left edge of the content.
 */
function addRow(
  scene: Phaser.Scene,
  panel: HoloPanel,
  row: TimelineRow,
  y: number,
  left: number,
): void {
  const L = CHRONICLE_LAYOUT;
  const resolved = row.canonFaction !== null;
  const color = resolved ? HOLO_PALETTE.textPrimary : HOLO_PALETTE.textMuted;
  const day = addHoloText(scene, left, y, `DAY ${row.day}`, {
    ...CAMPAIGN_TEXT.caption,
    color,
  }).setOrigin(0, 0.5);
  const name = addHoloText(
    scene,
    left + L.dayWidth,
    y,
    `${row.id}  ${row.name}`,
    { size: 13, weight: resolved ? "600" : "400", color },
  ).setOrigin(0, 0.5);
  name.setName(`chronicle_row_${row.id}`);
  name.setData("canon", row.canonFaction);
  const pips = scene.add.graphics();
  row.sides.forEach((side, i) => {
    const cx = left + L.pipsX + i * L.pipGap;
    const accent = factionAccent(side.faction);
    if (side.witnessed) pips.fillStyle(accent, 1).fillCircle(cx, y, L.pipRadius);
    pips.lineStyle(1.5, accent, side.witnessed ? 1 : 0.5);
    pips.strokeCircle(cx, y, L.pipRadius);
  });
  const canon = addHoloText(
    scene,
    left + L.canonRight - L.padding * 2,
    y,
    resolved ? `CANON · ${POV_LABEL[row.canonFaction!]}` : "UNRESOLVED",
    {
      ...CAMPAIGN_TEXT.caption,
      color: resolved
        ? factionAccent(row.canonFaction!)
        : HOLO_PALETTE.textMuted,
    },
  ).setOrigin(1, 0.5);
  panel.add([day, name, pips, canon]);
}

/**
 * @param scene - Owning scene.
 * @param summary - The Chronicle's summary.
 * @param accent - Faction accent.
 * @returns The panel.
 */
export function createChroniclePanel(
  scene: Phaser.Scene,
  summary: ChronicleSummary,
  accent: number,
): HoloPanel {
  const L = CHRONICLE_LAYOUT;
  const height =
    L.headerHeight +
    L.padding * 2 +
    L.summaryHeight +
    summary.rows.length * L.rowHeight;
  const panel = createHoloPanel(scene, L.x + L.width / 2, L.top + height / 2, {
    width: L.width,
    height,
    accentColor: accent,
    title: "CHRONICLE · ONE WAR, FIVE WITNESSES",
  });
  const left = -L.width / 2 + L.padding;
  const top = -height / 2 + L.headerHeight + L.padding;
  const tally = addHoloText(scene, left, top, summaryLine(summary), {
    ...CAMPAIGN_TEXT.caption,
    color: accent,
  });
  tally.setName("chronicle_summary");
  panel.add(tally);
  summary.rows.forEach((row, i) =>
    addRow(
      scene,
      panel,
      row,
      top + L.summaryHeight + i * L.rowHeight + L.rowHeight / 2,
      left,
    ),
  );
  return panel;
}
