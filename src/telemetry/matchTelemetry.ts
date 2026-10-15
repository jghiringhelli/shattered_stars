/**
 * matchTelemetry — the one-line calls battle scenes make to collect a
 * match's combat stats (see matchStats.ts):
 *
 * ```ts
 * matchStats.start("dogfight", { difficulty }, this.events); // battle starts
 * matchStats.record({ kind: "shot", friendly, weapon: "primary", hit });
 * matchStats.finish("victory");                              // battle ends
 * ```
 *
 * One match runs at a time. Passing the scene's event emitter closes an
 * unfinished match as "quit" when the scene shuts down. The summary goes to
 * the local telemetry log as one `match_summary` event (gated by the
 * privacy setting like every other event).
 */

import {
  MatchStatsAccumulator,
  type MatchStatEvent,
  type MatchSummary,
} from "./matchStats";
import type { TelemetryData } from "./TelemetryLog";
import { trackMatchSummary } from "./telemetry";
import { saveLastBattle } from "./lastBattleStore";
import { awardMatchXp } from "../systems/matchXp";

/** Outcome recorded for a match left without a result. */
export const QUIT_OUTCOME = "quit";

/** Scene event emitter (Phaser `scene.events`) — only `once` is used. */
export interface MatchLifecycle {
  once(event: "shutdown", listener: () => void): unknown;
}

/** MatchTelemetry dependencies. */
export interface MatchTelemetryOptions {
  /** Where a finished summary goes. */
  readonly emit: (summary: TelemetryData) => void;
  /** Clock (ms). */
  readonly now: () => number;
  /** Runs for every match that ended with a result (not a quit). */
  readonly onResult?: (summary: MatchSummary) => void;
}

export class MatchTelemetry {
  private active: MatchStatsAccumulator | null = null;
  private last: MatchSummary | null = null;

  /** @param options - Summary sink and clock. */
  constructor(private readonly options: MatchTelemetryOptions) {}

  /** Whether a match is being recorded. */
  get isActive(): boolean {
    return this.active !== null;
  }

  /**
   * Begin recording a match (a still-running one is closed as "quit").
   *
   * @param mode - Mode id.
   * @param details - Flat start context (difficulty, matchup...).
   * @param lifecycle - The scene's events: shutdown closes the match as quit.
   */
  start(
    mode: string,
    details: TelemetryData = {},
    lifecycle?: MatchLifecycle,
  ): void {
    this.finish(QUIT_OUTCOME);
    const match = new MatchStatsAccumulator(mode, this.options.now, details);
    this.active = match;
    lifecycle?.once("shutdown", () => {
      if (this.active === match) this.finish(QUIT_OUTCOME);
    });
  }

  /**
   * Tally an event of the running match (no-op when none runs).
   *
   * @param event - What happened.
   */
  record(event: MatchStatEvent): void {
    this.active?.record(event);
  }

  /**
   * Close the running match and emit its summary (no-op when none runs).
   *
   * @param outcome - "victory", "defeat", "draw", "quit"...
   * @param details - Flat end context (wave, rounds...).
   */
  finish(outcome: string, details: TelemetryData = {}): void {
    const match = this.active;
    if (!match) return;
    this.active = null;
    const summary = { ...match.finish(outcome), ...details };
    if (outcome !== QUIT_OUTCOME) {
      this.last = summary;
      this.options.onResult?.(summary);
    }
    this.options.emit(summary);
  }

  /** The latest match that ended with a result (never a quit), or null. */
  get lastSummary(): MatchSummary | null {
    return this.last;
  }
}

/** The game's match recorder (local telemetry log, wall clock). */
export const matchStats = new MatchTelemetry({
  emit: trackMatchSummary,
  now: () => Date.now(),
  onResult: (summary) => {
    saveLastBattle(summary);
    awardMatchXp(summary);
  },
});
