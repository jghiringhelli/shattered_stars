/**
 * resultsModel — pure description of a results screen: the banner and the
 * stat rows, built from the match-stats summary (src/telemetry/matchStats)
 * plus whatever extra rows the mode contributes. Same rows in every mode, so
 * a Dogfight win and a Skirmish win read alike.
 */

import type { MatchSummary } from "../../telemetry/matchStatTypes";
import { formatDuration } from "../../telemetry/lastBattleStore";
import { shipDisplayName } from "../idLabels";

/** Result of the battle for the local player. */
export type ResultTone = "victory" | "defeat" | "draw";

/** One label/value line. */
export interface ResultRow {
  readonly label: string;
  readonly value: string;
}

/** Mode-specific facts the match stats do not hold. */
export interface ResultExtras {
  /** Squad points of enemy ships destroyed. */
  readonly pointsDestroyed?: number;
  /** Squad points of the player's ships lost. */
  readonly pointsLost?: number;
  /** Rows shown above the standard stats (score, rounds, boss hull...). */
  readonly leadRows?: readonly ResultRow[];
}

/** Default banner text per tone. */
const BANNERS: Readonly<Record<ResultTone, string>> = {
  victory: "VICTORY",
  defeat: "DEFEAT",
  draw: "DRAW",
};

/**
 * @param tone - Outcome.
 * @returns The default banner text.
 */
export function bannerFor(tone: ResultTone): string {
  return BANNERS[tone];
}

/**
 * @param summary - Match stats.
 * @returns Primary + ordnance hit rate in [0, 100], or null with no shots.
 */
export function accuracyPercent(summary: MatchSummary): number | null {
  const shots = summary.shotsPrimary + summary.shotsOrdnance;
  if (shots <= 0) return null;
  const hits = summary.hitsPrimary + summary.hitsOrdnance;
  return Math.min(100, Math.round((hits / shots) * 100));
}

function whole(value: number): string {
  return `${Math.round(value)}`;
}

/**
 * @param summary - Match stats (null: the match recorded none).
 * @param extras - Mode-specific rows and points.
 * @returns The stat rows, in display order.
 */
export function resultRows(
  summary: MatchSummary | null,
  extras: ResultExtras = {},
): readonly ResultRow[] {
  const rows: ResultRow[] = [...(extras.leadRows ?? [])];
  if (summary) {
    const accuracy = accuracyPercent(summary);
    rows.push(
      { label: "Duration", value: formatDuration(summary.durationMs) },
      {
        label: "Kills / Deaths",
        value: `${summary.kills} / ${summary.losses}`,
      },
      {
        label: "Accuracy",
        value: accuracy === null ? "—" : `${accuracy}%`,
      },
      {
        label: "Damage dealt / taken",
        value: `${whole(summary.dmgDealtHull + summary.dmgDealtShield)} / ${whole(
          summary.dmgTakenHull + summary.dmgTakenShield,
        )}`,
      },
      { label: "Specials used", value: `${summary.specials}` },
      { label: "Marks", value: `${summary.marks}` },
    );
  }
  if (extras.pointsDestroyed !== undefined || extras.pointsLost !== undefined) {
    rows.push({
      label: "Points destroyed / lost",
      value: `${extras.pointsDestroyed ?? 0} / ${extras.pointsLost ?? 0}`,
    });
  }
  if (summary?.mvpShip) {
    rows.push({
      label: "MVP",
      value: `${shipDisplayName(summary.mvpShip)} (${whole(summary.mvpDamage)})`,
    });
  }
  return rows;
}
