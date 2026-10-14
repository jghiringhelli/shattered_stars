import { describe, expect, it } from "vitest";
import {
  FEEDBACK_BUNDLE_FORMAT,
  FEEDBACK_MAX_BYTES,
  FEEDBACK_MAX_EVENTS,
  FEEDBACK_MAX_MATCH_SUMMARIES,
  FEEDBACK_MAX_NOTE_CHARS,
  serializeFeedbackBundle,
  type FeedbackInput,
} from "../../../src/feedback/feedbackBundle";
import type { TelemetryEvent } from "../../../src/telemetry/TelemetryLog";

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0);

function event(
  index: number,
  type: TelemetryEvent["type"] = "mode_start",
  data: TelemetryEvent["data"] = { mode: "dogfight" },
): TelemetryEvent {
  return { t: NOW - 1000 * (1000 - index), type, session: "s1", data };
}

function input(overrides: Partial<FeedbackInput> = {}): FeedbackInput {
  return {
    build: { version: "0.1.0", commit: "abc1234", builtAt: "2026-10-14" },
    kind: "bug",
    note: "The boost felt weak",
    context: { sceneKey: "DogfightScene", activeScenes: ["DogfightScene"] },
    environment: {
      userAgent: "Mozilla/5.0 test",
      language: "en-US",
      screen: { width: 1920, height: 1080, pixelRatio: 1 },
      viewport: { width: 1280, height: 720 },
      renderer: "webgl",
      gpu: "ANGLE (Intel UHD)",
      fps: 59.4,
      touch: false,
      hardwareConcurrency: 8,
    },
    settings: { audio: { master: 0.8 } },
    telemetryEnabled: true,
    events: [event(1), event(2)],
    now: NOW,
    ...overrides,
  };
}

function parse(json: string): Record<string, unknown> {
  return JSON.parse(json) as Record<string, unknown>;
}

describe("serializeFeedbackBundle", () => {
  it("has a fixed, self-describing top-level shape", () => {
    const { json } = serializeFeedbackBundle(input());
    expect(Object.keys(parse(json))).toEqual([
      "format",
      "version",
      "generatedAt",
      "kind",
      "build",
      "context",
      "environment",
      "settings",
      "telemetry",
      "matchSummaries",
      "note",
      "privacy",
      "truncated",
    ]);
    expect(parse(json)["format"]).toBe(FEEDBACK_BUNDLE_FORMAT);
    expect(parse(json)["generatedAt"]).toBe("2026-10-14T12:00:00.000Z");
  });

  it("is deterministic: the same input gives byte-identical output", () => {
    expect(serializeFeedbackBundle(input()).json).toBe(
      serializeFeedbackBundle(input()).json,
    );
  });

  it("names the build with the version tag and channel", () => {
    const build = parse(serializeFeedbackBundle(input()).json)["build"] as {
      tag: string;
    };
    expect(build.tag).toBe("v0.1.0 BETA · abc1234 · 2026-10-14");
  });

  it("carries only the last events up to the event cap", () => {
    const many = Array.from({ length: FEEDBACK_MAX_EVENTS + 40 }, (_, i) =>
      event(i, "death", { cause: `c${i}` }),
    );
    const telemetry = parse(
      serializeFeedbackBundle(input({ events: many })).json,
    )["telemetry"] as { events: TelemetryEvent[]; eventCount: number };
    expect(telemetry.events).toHaveLength(FEEDBACK_MAX_EVENTS);
    expect(telemetry.eventCount).toBe(FEEDBACK_MAX_EVENTS + 40);
    expect(telemetry.events.at(-1)?.data["cause"]).toBe(
      `c${FEEDBACK_MAX_EVENTS + 39}`,
    );
  });

  it("lists the latest match summaries separately", () => {
    const summaries = Array.from({ length: 14 }, (_, i) =>
      event(i, "match_summary", { mode: "skirmish", shots: i }),
    );
    const parsed = parse(
      serializeFeedbackBundle(input({ events: summaries })).json,
    );
    const list = parsed["matchSummaries"] as { shots: number }[];
    expect(list).toHaveLength(FEEDBACK_MAX_MATCH_SUMMARIES);
    expect(list.at(-1)?.shots).toBe(13);
  });

  it("clips the free-text note", () => {
    const note = "x ".repeat(FEEDBACK_MAX_NOTE_CHARS);
    const out = parse(serializeFeedbackBundle(input({ note })).json)[
      "note"
    ] as string;
    expect(out.length).toBeLessThanOrEqual(FEEDBACK_MAX_NOTE_CHARS);
  });

  it("stays under the byte cap even with enormous settings and events", () => {
    const events = Array.from({ length: 5000 }, (_, i) =>
      event(i, "match_summary", { blob: "y".repeat(1500), i }),
    );
    const settings = { blob: "z".repeat(FEEDBACK_MAX_BYTES * 2) };
    const result = serializeFeedbackBundle(input({ events, settings }));
    expect(new TextEncoder().encode(result.json).length).toBeLessThanOrEqual(
      FEEDBACK_MAX_BYTES,
    );
    expect(result.truncated).toBe(true);
    expect(parse(result.json)["truncated"]).toBe(true);
  });

  it("is not truncated for a normal report", () => {
    expect(serializeFeedbackBundle(input()).truncated).toBe(false);
  });

  it("reports telemetry as off and carries no events when disabled", () => {
    const telemetry = parse(
      serializeFeedbackBundle(input({ telemetryEnabled: false, events: [] }))
        .json,
    )["telemetry"] as { enabled: boolean; events: unknown[] };
    expect(telemetry.enabled).toBe(false);
    expect(telemetry.events).toEqual([]);
  });

  it("redacts credential-like values anywhere in the bundle", () => {
    const secrets = [
      "gh" + "p_abcdefghijklmnopqrstuvwxyz0123456789",
      "Bearer abcDEF123456",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
      "player@example.com",
      "password=hunter2",
      "AK" + "IAABCDEFGHIJKLMNOP",
      "https://user:pass@example.com/path",
    ];
    const result = serializeFeedbackBundle(
      input({
        note: `see ${secrets.join(" and ")}`,
        events: [event(1, "error", { message: secrets[0] ?? "" })],
        settings: { online: { sessionToken: "abc", nested: { apiKey: "k" } } },
      }),
    );
    for (const secret of secrets) expect(result.json).not.toContain(secret);
    expect(result.json).not.toContain("hunter2");
    const settings = parse(result.json)["settings"] as {
      online: { sessionToken: string; nested: { apiKey: string } };
    };
    expect(settings.online.sessionToken).toBe("[redacted]");
    expect(settings.online.nested.apiKey).toBe("[redacted]");
  });

  it("keeps ordinary ids and numbers intact", () => {
    const json = serializeFeedbackBundle(
      input({
        events: [
          event(1, "mode_start", {
            mode: "ace_duel",
            ship: "terran_viper_mk2",
          }),
        ],
      }),
    ).json;
    expect(json).toContain("terran_viper_mk2");
    expect(json).toContain("59.4");
  });

  it("does not mutate its input", () => {
    const original = input();
    const snapshot = JSON.stringify(original);
    serializeFeedbackBundle(original);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it("states that nothing is sent automatically", () => {
    const privacy = parse(serializeFeedbackBundle(input()).json)[
      "privacy"
    ] as string;
    expect(privacy).toMatch(/nothing is sent automatically/i);
  });
});
