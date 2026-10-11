/**
 * Spec: the local telemetry event log — a capped ring buffer persisted in a
 * key/value store, gated by the privacy setting, exportable as JSON.
 */

import { describe, it, expect } from "vitest";
import {
  TELEMETRY_STORAGE_KEY,
  TelemetryLog,
  type TelemetryLogOptions,
} from "../../../src/telemetry/TelemetryLog";
import { createMemoryStore } from "../../../src/systems/keyValueStore";

function makeLog(overrides: Partial<TelemetryLogOptions> = {}): TelemetryLog {
  let clock = 1000;
  return new TelemetryLog({
    store: createMemoryStore(),
    sessionId: "s1",
    capacity: 3,
    now: () => clock++,
    isEnabled: () => true,
    ...overrides,
  });
}

describe("TelemetryLog", () => {
  it("records events with time, type, session and data", () => {
    const log = makeLog();
    log.record("mode_start", { mode: "dogfight" });
    expect(log.events()).toEqual([
      {
        t: 1000,
        type: "mode_start",
        session: "s1",
        data: { mode: "dogfight" },
      },
    ]);
  });

  it("drops the oldest events past capacity (ring buffer)", () => {
    const log = makeLog();
    for (const mode of ["a", "b", "c", "d", "e"])
      log.record("mode_start", { mode });
    expect(log.events().map((e) => e.data.mode)).toEqual(["c", "d", "e"]);
  });

  it("persists across instances sharing a store", () => {
    const store = createMemoryStore();
    makeLog({ store }).record("death", { cause: "laser" });
    expect(makeLog({ store }).events()).toHaveLength(1);
  });

  it("records nothing while disabled", () => {
    const log = makeLog({ isEnabled: () => false });
    log.record("session_start", {});
    expect(log.events()).toEqual([]);
  });

  it("starts empty when the stored buffer is corrupt", () => {
    const store = createMemoryStore();
    store.setItem(TELEMETRY_STORAGE_KEY, "[{broken");
    const log = makeLog({ store });
    expect(log.events()).toEqual([]);
    log.record("session_start", {});
    expect(log.events()).toHaveLength(1);
  });

  it("truncates long strings (error stacks) to keep the buffer small", () => {
    const log = makeLog();
    log.record("error", { message: "x".repeat(5000) });
    const message = String(log.events()[0]?.data.message);
    expect(message.length).toBeLessThanOrEqual(300);
  });

  it("clear() empties the buffer", () => {
    const log = makeLog();
    log.record("session_start", {});
    log.clear();
    expect(log.events()).toEqual([]);
  });

  it("exports a self-describing JSON document", () => {
    const log = makeLog();
    log.record("mode_end", { mode: "dogfight", outcome: "victory" });
    const doc = JSON.parse(log.exportJson());
    expect(doc.format).toBe("shattered-stars-telemetry");
    expect(doc.version).toBe(1);
    expect(doc.events).toHaveLength(1);
    expect(doc.events[0].data.outcome).toBe("victory");
  });
});
