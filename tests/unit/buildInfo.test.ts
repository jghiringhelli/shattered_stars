import { describe, it, expect } from "vitest";
import { BUILD_INFO, formatVersionTag } from "../../src/buildInfo";
import {
  BUG_REPORT_EVENT_COUNT,
  BUG_REPORT_MAX_DIAGNOSTICS_CHARS,
  formatDiagnostics,
} from "../../src/telemetry/diagnostics";
import type { TelemetryEvent } from "../../src/telemetry/TelemetryLog";

const BUILD = { version: "0.1.0", commit: "abc1234", builtAt: "2026-10-11" };

const event = (i: number): TelemetryEvent => ({
  t: 1_700_000_000_000 + i * 1000,
  type: "mode_start",
  session: "s1",
  data: { mode: `mode_${i}` },
});

describe("formatVersionTag", () => {
  it("shows version, channel, commit and build date", () => {
    expect(formatVersionTag(BUILD)).toBe("v0.1.0 ALPHA · abc1234 · 2026-10-11");
  });

  it("omits an unknown build date", () => {
    expect(formatVersionTag({ ...BUILD, builtAt: "" })).toBe(
      "v0.1.0 ALPHA · abc1234",
    );
  });

  it("falls back to dev values when no build constants are injected (node)", () => {
    expect(BUILD_INFO.commit).toBe("dev");
  });
});

describe("formatDiagnostics", () => {
  const events = Array.from({ length: BUG_REPORT_EVENT_COUNT + 5 }, (_, i) =>
    event(i),
  );

  it("names the build, the settings and the last N telemetry events", () => {
    const text = formatDiagnostics({
      build: BUILD,
      settings: { musicVolume: 0.25 },
      events,
    });
    expect(text).toContain("v0.1.0 ALPHA · abc1234 · 2026-10-11");
    expect(text).toContain('"musicVolume":0.25');
    expect(text).toContain(`mode_${events.length - 1}`);
    expect(text).not.toContain('mode_4"');
    const lines = text.split("\n").filter((l) => l.includes("mode_start"));
    expect(lines).toHaveLength(BUG_REPORT_EVENT_COUNT);
  });

  it("stays short enough for a GitHub new-issue URL", () => {
    const huge = { blob: "x".repeat(20_000) };
    const text = formatDiagnostics({ build: BUILD, settings: huge, events });
    expect(text.length).toBeLessThanOrEqual(BUG_REPORT_MAX_DIAGNOSTICS_CHARS);
    expect(text).toContain("v0.1.0 ALPHA");
  });
});
