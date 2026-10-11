/**
 * hudAdapters — maps mission state onto the existing HUD kit: objective
 * tracker rows for the Campaign mode HUD (progress and failure spelled out,
 * never colour-only) and objective markers as neutral radar / edge-arrow
 * contacts. Pure.
 */

import type { ObjectiveMarker } from "../../arcade/objectives";
import type { TrackerRow } from "../../arcade/systems/CampaignMissionRuntime";
import type { ContactHudState } from "../../ui/hud/types";
import type { ObjectiveProgress } from "../../ui/modeHud/objectiveRows";

/** Tracker type that gets no automatic suffix (the row text carries it). */
export const TRACKED_TYPE = "tracked";
/** Suffix of a failed objective. */
export const FAILED_MARK = " ✗ FAILED";
/** Marker kinds worth a radar blip / edge arrow (crates and sentries stay local). */
const RADAR_KINDS: ReadonlySet<ObjectiveMarker["kind"]> = new Set([
  "zone",
  "waypoint",
  "exit",
  "dropzone",
]);

/**
 * @param rows - Runtime tracker rows.
 * @returns Mode-HUD objective rows.
 */
export function trackerProgress(
  rows: readonly TrackerRow[],
): ObjectiveProgress[] {
  return rows.map((row) => {
    const progress =
      row.status === "active" && row.progressText
        ? ` (${row.progressText})`
        : "";
    const failed = row.status === "failed" ? FAILED_MARK : "";
    return {
      objective: {
        type: TRACKED_TYPE,
        description: `${row.description}${progress}${failed}`,
        optional: row.optional,
      },
      completed: row.status === "completed",
      progress: 0,
      target: 1,
    };
  });
}

/**
 * @param markers - Objective markers.
 * @returns Neutral contacts so radar and edge arrows point at objectives.
 */
export function markerContacts(
  markers: readonly ObjectiveMarker[],
): ContactHudState[] {
  return markers
    .filter((m) => RADAR_KINDS.has(m.kind))
    .map((m) => ({
      id: `objective:${m.id}`,
      pose: { x: m.x, y: m.y, angle: 0 },
      side: "neutral" as const,
      sizeClass: "medium" as const,
      isTarget: false,
      isMarked: false,
      alive: true,
    }));
}
