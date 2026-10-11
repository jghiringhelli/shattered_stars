/**
 * Spec: the Stats panel's text — per-mode table rows, death causes and the
 * Flight School funnel line, with placeholders for unknown values.
 */

import { describe, it, expect } from "vitest";
import {
  buildTelemetryStatsView,
  duration,
  percent,
  NO_VALUE,
} from "../../../../src/ui/telemetry/telemetryStatsViewModel";
import { summarizeTelemetry } from "../../../../src/telemetry/telemetryStats";
import type { TelemetryEvent } from "../../../../src/telemetry/TelemetryLog";

const events: TelemetryEvent[] = [
  { t: 1, type: "session_start", session: "a", data: {} },
  {
    t: 2,
    type: "mode_end",
    session: "a",
    data: { mode: "ace_duel", outcome: "victory", durationMs: 65_000 },
  },
  {
    t: 3,
    type: "match_summary",
    session: "a",
    data: {
      mode: "ace_duel",
      outcome: "victory",
      durationMs: 60_000,
      kills: 2,
      playerDeaths: 0,
      shotsPrimary: 8,
      hitsPrimary: 2,
      specials: 3,
    },
  },
  {
    t: 4,
    type: "death",
    session: "a",
    data: { mode: "ace_duel", cause: "terran_raptor" },
  },
  {
    t: 5,
    type: "tutorial_exit",
    session: "a",
    data: { step: "kturn", completed: false },
  },
];

describe("buildTelemetryStatsView", () => {
  const view = buildTelemetryStatsView(summarizeTelemetry(events), (id) =>
    id === "terran_raptor" ? "Raptor" : id,
  );

  it("renders one table row per played mode with display names", () => {
    expect(view.modeRows).toEqual([
      ["Ace Duel", "1", "100%", "1:05", "1:05", "2 / 0", "25%", "3.0"],
    ]);
  });

  it("lists death causes by display name", () => {
    expect(view.deathCauses).toEqual(["1. Raptor ×1"]);
  });

  it("describes the Flight School funnel", () => {
    expect(view.flightSchool).toBe(
      'Flight School: 1 visits · 0% completed · most left at "kturn"',
    );
  });

  it("summarises the log", () => {
    expect(view.summaryLine).toBe(
      "5 events · 1 sessions · 1 matches · 0 errors",
    );
    expect(view.empty).toBe(false);
  });

  it("is flagged empty for a fresh log", () => {
    const fresh = buildTelemetryStatsView(summarizeTelemetry([]));
    expect(fresh.empty).toBe(true);
    expect(fresh.flightSchool).toBe("Flight School: not started yet");
  });
});

describe("formatting", () => {
  it("formats durations as m:ss", () => {
    expect(duration(125_400)).toBe("2:05");
    expect(duration(null)).toBe(NO_VALUE);
  });

  it("formats fractions as whole percentages", () => {
    expect(percent(0.666)).toBe("67%");
    expect(percent(null)).toBe(NO_VALUE);
  });
});
