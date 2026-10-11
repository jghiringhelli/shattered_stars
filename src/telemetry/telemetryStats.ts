/**
 * telemetryStats — pure aggregation of the local telemetry log for the
 * in-game Stats panel: per mode, matches / outcomes / win rate / duration
 * (median, mean) from `mode_end` (or `match_summary` when a mode never
 * logged `mode_end`), and kills / deaths / accuracy / specials per minute
 * from `match_summary`; the most common death causes; the Flight School
 * drop-off step and completion rate.
 *
 * Tolerant of malformed fields (hand-edited or older logs). Pure: no Phaser.
 */

import type {
  TelemetryData,
  TelemetryEvent,
  TelemetryValue,
} from "./TelemetryLog";

/** How many death causes the report keeps. */
export const TOP_DEATH_CAUSES = 5;
/** Mode id used when an event carries none. */
export const UNKNOWN_MODE = "unknown";
const MS_PER_MINUTE = 60_000;

/** One mode's numbers. */
export interface ModeStats {
  readonly mode: string;
  readonly matches: number;
  readonly victories: number;
  readonly defeats: number;
  readonly draws: number;
  readonly quits: number;
  /** Victories / (victories + defeats + draws); null when none decided. */
  readonly winRate: number | null;
  readonly medianDurationMs: number | null;
  readonly meanDurationMs: number | null;
  readonly kills: number;
  readonly deaths: number;
  /** Primary hits / shots; null without shots. */
  readonly accuracy: number | null;
  /** Special actions per minute of recorded matches; null without time. */
  readonly specialsPerMinute: number | null;
  /** Median time to the first kill (ms); null when unknown. */
  readonly medianFirstKillMs: number | null;
  /** Matches carrying combat stats (`match_summary`). */
  readonly summarizedMatches: number;
}

/** Flight School funnel. */
export interface FlightSchoolStats {
  readonly exits: number;
  readonly completionRate: number | null;
  /** The lesson most players left on (not completed); null when none. */
  readonly topDropOff: string | null;
  readonly dropOffs: readonly {
    readonly step: string;
    readonly count: number;
  }[];
}

/** The whole log, summarised. */
export interface TelemetryReport {
  readonly totalEvents: number;
  readonly sessions: number;
  readonly errors: number;
  /** Most played first. */
  readonly modes: readonly ModeStats[];
  readonly deathCauses: readonly {
    readonly cause: string;
    readonly count: number;
  }[];
  readonly flightSchool: FlightSchoolStats;
}

/**
 * @param events - The stored telemetry log.
 * @returns The report shown on the Stats panel.
 */
export function summarizeTelemetry(
  events: readonly TelemetryEvent[],
): TelemetryReport {
  const byMode = groupByMode(events);
  const modes = [...byMode.entries()]
    .map(([mode, group]) => modeStats(mode, group))
    .sort((a, b) => b.matches - a.matches || a.mode.localeCompare(b.mode));
  return {
    totalEvents: events.length,
    sessions: new Set(events.map((e) => e.session)).size,
    errors: events.filter((e) => e.type === "error").length,
    modes,
    deathCauses: topCounts(
      events
        .filter((e) => e.type === "death")
        .map((e) => text(e.data.cause, "unknown")),
      TOP_DEATH_CAUSES,
    ).map(([cause, count]) => ({ cause, count })),
    flightSchool: flightSchoolStats(events),
  };
}

interface ModeGroup {
  readonly ends: TelemetryData[];
  readonly summaries: TelemetryData[];
  deaths: number;
}

function groupByMode(
  events: readonly TelemetryEvent[],
): Map<string, ModeGroup> {
  const groups = new Map<string, ModeGroup>();
  const group = (data: TelemetryData): ModeGroup => {
    const mode = text(data.mode, UNKNOWN_MODE);
    const existing = groups.get(mode) ?? { ends: [], summaries: [], deaths: 0 };
    groups.set(mode, existing);
    return existing;
  };
  for (const e of events) {
    if (e.type === "mode_end") group(e.data).ends.push(e.data);
    else if (e.type === "match_summary") group(e.data).summaries.push(e.data);
    else if (e.type === "death") group(e.data).deaths += 1;
  }
  return groups;
}

function modeStats(mode: string, group: ModeGroup): ModeStats {
  const matches = group.ends.length > 0 ? group.ends : group.summaries;
  const outcome = (o: string): number =>
    matches.filter((m) => m.outcome === o).length;
  const victories = outcome("victory");
  const defeats = outcome("defeat");
  const draws = outcome("draw");
  const decided = victories + defeats + draws;
  const durations = matches
    .map((m) => m.durationMs)
    .filter((d): d is number => isNumber(d));
  const s = group.summaries;
  const shots = sum(s, "shotsPrimary");
  const minutes = sum(s, "durationMs") / MS_PER_MINUTE;
  return {
    mode,
    matches: matches.length,
    victories,
    defeats,
    draws,
    quits: outcome("quit"),
    winRate: decided > 0 ? victories / decided : null,
    medianDurationMs: median(durations),
    meanDurationMs:
      durations.length > 0 ? total(durations) / durations.length : null,
    kills: sum(s, "kills"),
    deaths: s.length > 0 ? sum(s, "playerDeaths") : group.deaths,
    accuracy: shots > 0 ? sum(s, "hitsPrimary") / shots : null,
    specialsPerMinute: minutes > 0 ? sum(s, "specials") / minutes : null,
    medianFirstKillMs: median(
      s.map((m) => m.firstKillMs).filter((d): d is number => isNumber(d)),
    ),
    summarizedMatches: s.length,
  };
}

function flightSchoolStats(
  events: readonly TelemetryEvent[],
): FlightSchoolStats {
  const exits = events.filter((e) => e.type === "tutorial_exit");
  const completed = exits.filter((e) => e.data.completed === true).length;
  const dropOffs = topCounts(
    exits
      .filter((e) => e.data.completed !== true)
      .map((e) => text(e.data.step, "unknown")),
    Number.POSITIVE_INFINITY,
  ).map(([step, count]) => ({ step, count }));
  return {
    exits: exits.length,
    completionRate: exits.length > 0 ? completed / exits.length : null,
    topDropOff: dropOffs[0]?.step ?? null,
    dropOffs,
  };
}

/**
 * @param values - Labels.
 * @param limit - How many to keep.
 * @returns [label, count] pairs, most frequent first (ties by label).
 */
function topCounts(
  values: readonly string[],
  limit: number,
): [string, number][] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

function isNumber(value: TelemetryValue | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function text(value: TelemetryValue | undefined, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function sum(rows: readonly TelemetryData[], field: string): number {
  return total(
    rows.map((r) => r[field]).filter((v): v is number => isNumber(v)),
  );
}

function total(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * @param values - Numbers.
 * @returns Their median, or null when empty.
 */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
