/**
 * telemetryStatsViewModel — turns a {@link TelemetryReport} into the text
 * the Stats panel draws: a per-mode table, the top death causes and the
 * Flight School funnel. Pure (no Phaser) so the formatting is unit tested.
 */

import type {
  ModeStats,
  TelemetryReport,
} from "../../telemetry/telemetryStats";

/** Display names of mode ids. */
export const MODE_LABELS: Readonly<Record<string, string>> = {
  skirmish: "Skirmish",
  dogfight: "Dogfight",
  ace_duel: "Ace Duel",
  boss_raid: "Boss Raid",
  continuous: "Continuous",
  survival: "Survival",
  campaign: "Campaign",
  flight_school: "Flight School",
};

/** Column headers of the per-mode table. */
export const MODE_TABLE_HEADER: readonly string[] = [
  "Mode",
  "Matches",
  "Win %",
  "Median",
  "Avg",
  "K / D",
  "Accuracy",
  "Specials/min",
];

/** Placeholder for a value that cannot be computed yet. */
export const NO_VALUE = "—";
const MS_PER_S = 1000;
const S_PER_MIN = 60;
const PERCENT = 100;

/** What the Stats panel shows. */
export interface TelemetryStatsView {
  readonly summaryLine: string;
  readonly modeRows: readonly (readonly string[])[];
  readonly deathCauses: readonly string[];
  readonly flightSchool: string;
  readonly empty: boolean;
}

/**
 * @param report - The aggregated log.
 * @param nameOf - Display name of a death cause (ship definition id).
 * @returns The panel's text.
 */
export function buildTelemetryStatsView(
  report: TelemetryReport,
  nameOf: (id: string) => string = (id) => id,
): TelemetryStatsView {
  const played = report.modes.filter((m) => m.matches > 0);
  return {
    summaryLine:
      `${report.totalEvents} events · ${report.sessions} sessions · ` +
      `${played.reduce((n, m) => n + m.matches, 0)} matches · ${report.errors} errors`,
    modeRows: played.map(modeRow),
    deathCauses: report.deathCauses.map(
      (d, i) => `${i + 1}. ${nameOf(d.cause)} ×${d.count}`,
    ),
    flightSchool: flightSchoolLine(report),
    empty: played.length === 0 && report.deathCauses.length === 0,
  };
}

/**
 * @param m - One mode's stats.
 * @returns Its table row (cells in {@link MODE_TABLE_HEADER} order).
 */
export function modeRow(m: ModeStats): string[] {
  return [
    MODE_LABELS[m.mode] ?? m.mode,
    String(m.matches),
    percent(m.winRate),
    duration(m.medianDurationMs),
    duration(m.meanDurationMs),
    `${m.kills} / ${m.deaths}`,
    percent(m.accuracy),
    m.specialsPerMinute === null ? NO_VALUE : m.specialsPerMinute.toFixed(1),
  ];
}

function flightSchoolLine(report: TelemetryReport): string {
  const fs = report.flightSchool;
  if (fs.exits === 0) return "Flight School: not started yet";
  const dropOff = fs.topDropOff ? ` · most left at "${fs.topDropOff}"` : "";
  return `Flight School: ${fs.exits} visits · ${percent(fs.completionRate)} completed${dropOff}`;
}

/**
 * @param fraction - 0–1, or null.
 * @returns "63%" or the placeholder.
 */
export function percent(fraction: number | null): string {
  return fraction === null ? NO_VALUE : `${Math.round(fraction * PERCENT)}%`;
}

/**
 * @param ms - Duration in ms, or null.
 * @returns "1:05" (m:ss) or the placeholder.
 */
export function duration(ms: number | null): string {
  if (ms === null) return NO_VALUE;
  const totalS = Math.round(ms / MS_PER_S);
  const minutes = Math.floor(totalS / S_PER_MIN);
  const seconds = totalS % S_PER_MIN;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
