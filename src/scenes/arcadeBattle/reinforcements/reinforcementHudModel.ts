/**
 * reinforcementHudModel — every string the reinforcement HUD and picker
 * show, plus the pool's tone. State is always spelled out in words or
 * glyphs (YOU / FOE, EXHAUSTED, ▲ ▼ ★, the refusal reason), so colour is
 * never the only signal.
 *
 * Pure.
 */

import {
  isPermanentBlock,
  type DeployOption,
  type Deployment,
  type PickerView,
  type PickerOption,
  type SideSummary,
} from "../../../arcade/reinforcements";
import type { HudTone } from "../arcadeStatusModel";

/** Pool share left below which the pool reads as a warning. */
export const POOL_WARNING_FRACTION = 0.25;

const MS_PER_SECOND = 1000;

/** Who is looking: the local pilot's team and squad. */
export interface ReinforcementView {
  /** The viewer's team side key. */
  readonly side: string;
  /** The viewer's squad (member key), or null for a spectator. */
  readonly member: string | null;
}

/**
 * @param side - A team's summary.
 * @param viewSide - The viewer's team side key.
 * @returns "YOU  POOL 640  FIELD 180/250" (FOE for other teams; EXHAUSTED when out).
 */
export function sideRow(side: SideSummary, viewSide: string): string {
  const who = side.key === viewSide ? "YOU" : "FOE";
  const pool = side.exhausted ? "EXHAUSTED" : `POOL ${side.remainingPoints}`;
  return `${who}  ${pool}  FIELD ${side.fieldPoints}/${side.fieldCapPoints}`;
}

/**
 * @param side - A side's summary.
 * @returns The pool's tone: danger when empty, warning under a quarter.
 */
export function poolTone(side: SideSummary): HudTone {
  if (side.remainingPoints <= 0) return "danger";
  return side.remainingPoints < side.poolPoints * POOL_WARNING_FRACTION
    ? "warning"
    : "normal";
}

/**
 * @param preview - The player's next reserve ships.
 * @returns "NEXT ▸ A · B · C".
 */
export function nextLine(preview: readonly DeployOption[]): string {
  const names = preview.map((o) => o.label.toUpperCase());
  return `NEXT ▸ ${names.length > 0 ? names.join(" · ") : "—"}`;
}

/**
 * @param deployment - A ship that just warped in.
 * @param view - The viewer's team and squad.
 * @returns The notification line (by team: a same-faction foe is a FOE).
 */
export function deployToast(
  deployment: Deployment,
  view: ReinforcementView,
): string {
  const ship = `${deployment.option.label.toUpperCase()}  ${deployment.option.cost} PTS`;
  if (deployment.pilot === "player" && deployment.member === view.member)
    return `★ YOU  ${ship}`;
  if (deployment.side === view.side) return `▲ ALLY  ${ship}`;
  return `▼ FOE  ${ship}`;
}

/**
 * @param row - A picker row.
 * @param index - Its position (key = index + 1).
 * @returns "1  NAME  55 PTS  · NEXT" or "… — REASON" when disabled.
 */
export function pickerRowLabel(row: PickerOption, index: number): string {
  const base = `${index + 1}  ${row.option.label.toUpperCase()}  ${row.option.cost} PTS`;
  if (!row.check.allowed) return `${base}  — ${row.check.reason}`;
  return row.isDefault ? `${base}  · NEXT` : base;
}

/**
 * @param view - The open picker.
 * @returns The countdown line, or why the countdown is held.
 */
export function countdownLabel(view: PickerView): string {
  if (view.counting) {
    const seconds = Math.ceil(view.remainingMs / MS_PER_SECOND);
    return `AUTO-DEPLOY NEXT IN ${seconds} S  ·  1–${view.options.length} PICK  ·  ENTER NOW`;
  }
  const anyRoomLater = view.options.some(
    (row) => !isPermanentBlock(row.check.block),
  );
  return anyRoomLater
    ? "WAITING FOR ROOM ON THE FIELD"
    : "POOL EXHAUSTED — WATCHING YOUR WINGMEN";
}
