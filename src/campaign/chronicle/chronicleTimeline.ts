/**
 * chronicleTimeline — the Chronicle panel's model: the 15 crossover battles
 * in story order (day of the crisis), which campaigns have witnessed each,
 * whose point of view wrote canon, plus the unity and key tallies. Pure.
 */

import type { FactionId } from "../../config";
import { CROSSOVERS } from "../../data/campaign/crossovers";
import { earnedKeys, unityCount } from "./chronicleRules";
import type { ChronicleData } from "./chronicleTypes";

/** One witness slot of a crossover. */
export interface TimelineSide {
  readonly faction: FactionId;
  readonly witnessed: boolean;
}

/** One crossover row. */
export interface TimelineRow {
  readonly id: string;
  readonly name: string;
  readonly day: number;
  readonly sides: readonly TimelineSide[];
  /** The point of view that wrote canon, once anyone has played it. */
  readonly canonFaction: FactionId | null;
}

/** The whole panel. */
export interface ChronicleSummary {
  readonly rows: readonly TimelineRow[];
  /** Crossovers resolved from at least one point of view. */
  readonly resolved: number;
  /** Latest day of the crisis reached by a resolved crossover (0 = none). */
  readonly dayReached: number;
  readonly unity: number;
  readonly keys: number;
}

/**
 * @param chronicle - The Chronicle.
 * @returns The timeline rows and tallies.
 */
export function summarizeChronicle(chronicle: ChronicleData): ChronicleSummary {
  const rows = [...CROSSOVERS]
    .sort((a, b) => a.day - b.day)
    .map((c): TimelineRow => {
      const record = chronicle.crossovers[c.id];
      return {
        id: c.id,
        name: c.name,
        day: c.day,
        canonFaction: record?.canonFaction ?? null,
        sides: c.sides.map((s) => ({
          faction: s.faction,
          witnessed: record?.witnesses.includes(s.faction) ?? false,
        })),
      };
    });
  const resolvedRows = rows.filter((r) => r.canonFaction !== null);
  return {
    rows,
    resolved: resolvedRows.length,
    dayReached: Math.max(0, ...resolvedRows.map((r) => r.day)),
    unity: unityCount(chronicle.flags),
    keys: earnedKeys(chronicle.flags).length,
  };
}
