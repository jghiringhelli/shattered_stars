/**
 * Spec: aggregation of the local telemetry log into the in-game Stats
 * panel — matches per mode, win rate, duration median/mean, kills/deaths,
 * accuracy, specials per minute, top death causes and the Flight School
 * drop-off step.
 */

import { describe, it, expect } from "vitest";
import { summarizeTelemetry } from "../../../src/telemetry/telemetryStats";
import type {
  TelemetryData,
  TelemetryEvent,
  TelemetryEventType,
} from "../../../src/telemetry/TelemetryLog";

let clock = 0;
function event(
  type: TelemetryEventType,
  data: TelemetryData,
  session = "s1",
): TelemetryEvent {
  clock += 1;
  return { t: clock, type, session, data };
}

const modeEnd = (mode: string, outcome: string, durationMs: number | null) =>
  event("mode_end", { mode, outcome, durationMs });

const summary = (mode: string, extra: TelemetryData) =>
  event("match_summary", {
    mode,
    outcome: "victory",
    durationMs: 60_000,
    ...extra,
  });

describe("summarizeTelemetry", () => {
  it("is empty for an empty log", () => {
    const report = summarizeTelemetry([]);
    expect(report.totalEvents).toBe(0);
    expect(report.sessions).toBe(0);
    expect(report.modes).toEqual([]);
    expect(report.deathCauses).toEqual([]);
    expect(report.flightSchool.exits).toBe(0);
  });

  it("counts matches per mode with outcomes and win rate over decided matches", () => {
    const report = summarizeTelemetry([
      modeEnd("dogfight", "victory", 30_000),
      modeEnd("dogfight", "defeat", 50_000),
      modeEnd("dogfight", "victory", 40_000),
      modeEnd("dogfight", "quit", 5_000),
      modeEnd("survival", "defeat", 100_000),
    ]);
    const dogfight = report.modes.find((m) => m.mode === "dogfight")!;
    expect(dogfight.matches).toBe(4);
    expect(dogfight.victories).toBe(2);
    expect(dogfight.defeats).toBe(1);
    expect(dogfight.quits).toBe(1);
    expect(dogfight.winRate).toBeCloseTo(2 / 3);
    expect(report.modes[0]!.mode).toBe("dogfight");
  });

  it("reports median and mean duration per mode, skipping missing durations", () => {
    const report = summarizeTelemetry([
      modeEnd("ace_duel", "victory", 10_000),
      modeEnd("ace_duel", "victory", 20_000),
      modeEnd("ace_duel", "defeat", 60_000),
      modeEnd("ace_duel", "defeat", null),
    ]);
    const ace = report.modes[0]!;
    expect(ace.medianDurationMs).toBe(20_000);
    expect(ace.meanDurationMs).toBe(30_000);
  });

  it("has no win rate for a mode with no decided matches", () => {
    const report = summarizeTelemetry([
      modeEnd("flight_school", "completed", 1),
    ]);
    expect(report.modes[0]!.winRate).toBeNull();
  });

  it("sums kills, deaths, accuracy and specials per minute from match summaries", () => {
    const report = summarizeTelemetry([
      summary("dogfight", {
        kills: 2,
        playerDeaths: 1,
        shotsPrimary: 10,
        hitsPrimary: 4,
        specials: 3,
        durationMs: 60_000,
      }),
      summary("dogfight", {
        kills: 1,
        playerDeaths: 0,
        shotsPrimary: 10,
        hitsPrimary: 6,
        specials: 6,
        durationMs: 120_000,
      }),
    ]);
    const dogfight = report.modes[0]!;
    expect(dogfight.kills).toBe(3);
    expect(dogfight.deaths).toBe(1);
    expect(dogfight.accuracy).toBeCloseTo(0.5);
    expect(dogfight.specialsPerMinute).toBeCloseTo(3);
    expect(dogfight.summarizedMatches).toBe(2);
  });

  it("counts matches from summaries when a mode never logged mode_end", () => {
    const report = summarizeTelemetry([
      summary("campaign", { outcome: "defeat" }),
    ]);
    expect(report.modes[0]).toMatchObject({
      mode: "campaign",
      matches: 1,
      defeats: 1,
    });
  });

  it("falls back to death events for deaths when no summary exists", () => {
    const report = summarizeTelemetry([
      modeEnd("skirmish", "defeat", 1000),
      event("death", { mode: "skirmish", cause: "terran_raptor" }),
    ]);
    expect(report.modes[0]!.deaths).toBe(1);
    expect(report.modes[0]!.accuracy).toBeNull();
  });

  it("lists the most common death causes, most frequent first", () => {
    const report = summarizeTelemetry([
      event("death", { mode: "dogfight", cause: "terran_raptor" }),
      event("death", { mode: "survival", cause: "corsair_fang" }),
      event("death", { mode: "dogfight", cause: "terran_raptor" }),
    ]);
    expect(report.deathCauses).toEqual([
      { cause: "terran_raptor", count: 2 },
      { cause: "corsair_fang", count: 1 },
    ]);
  });

  it("finds the Flight School drop-off step and the completion rate", () => {
    const report = summarizeTelemetry([
      event("tutorial_exit", { step: "kturn", completed: false }),
      event("tutorial_exit", { step: "kturn", completed: false }),
      event("tutorial_exit", { step: "boost", completed: false }),
      event("tutorial_exit", { step: "complete", completed: true }),
    ]);
    expect(report.flightSchool.exits).toBe(4);
    expect(report.flightSchool.completionRate).toBeCloseTo(0.25);
    expect(report.flightSchool.topDropOff).toBe("kturn");
    expect(report.flightSchool.dropOffs[0]).toEqual({
      step: "kturn",
      count: 2,
    });
  });

  it("counts distinct sessions and errors", () => {
    const report = summarizeTelemetry([
      event("session_start", {}, "a"),
      event("session_start", {}, "b"),
      event("error", { message: "x" }, "b"),
    ]);
    expect(report.sessions).toBe(2);
    expect(report.errors).toBe(1);
  });

  it("tolerates malformed fields from older or hand-edited logs", () => {
    const report = summarizeTelemetry([
      event("mode_end", { outcome: "victory" }),
      event("match_summary", { mode: "dogfight", kills: "lots" }),
    ]);
    expect(report.modes.find((m) => m.mode === "unknown")!.matches).toBe(1);
    expect(report.modes.find((m) => m.mode === "dogfight")!.kills).toBe(0);
  });
});
