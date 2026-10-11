/**
 * Spec: the scene-facing match telemetry facade — one active match at a
 * time, events recorded while it runs, one `match_summary` emitted when it
 * finishes (or as "quit" when its scene shuts down unfinished).
 */

import { describe, it, expect } from "vitest";
import { MatchTelemetry } from "../../../src/telemetry/matchTelemetry";
import type { TelemetryData } from "../../../src/telemetry/TelemetryLog";

function facade() {
  const emitted: TelemetryData[] = [];
  let t = 0;
  const telemetry = new MatchTelemetry({
    emit: (summary) => emitted.push(summary),
    now: () => (t += 1000),
  });
  return { telemetry, emitted };
}

/** A minimal scene event emitter (Phaser's `scene.events`). */
function lifecycle() {
  const handlers = new Map<string, () => void>();
  return {
    once: (event: string, fn: () => void) => handlers.set(event, fn),
    fire: (event: string) => handlers.get(event)?.(),
  };
}

describe("MatchTelemetry", () => {
  it("emits exactly one summary when the match finishes", () => {
    const { telemetry, emitted } = facade();
    telemetry.start("dogfight");
    telemetry.record({ kind: "mark" });
    telemetry.finish("victory");
    telemetry.finish("defeat");
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      mode: "dogfight",
      outcome: "victory",
      marks: 1,
    });
  });

  it("merges finish details into the summary", () => {
    const { telemetry, emitted } = facade();
    telemetry.start("survival", { ascension: 2 });
    telemetry.finish("defeat", { node: "s1r3" });
    expect(emitted[0]).toMatchObject({ ascension: 2, node: "s1r3" });
  });

  it("ignores records and finishes when no match is running", () => {
    const { telemetry, emitted } = facade();
    telemetry.record({ kind: "mark" });
    telemetry.finish("victory");
    expect(emitted).toEqual([]);
    expect(telemetry.isActive).toBe(false);
  });

  it("reports an unfinished match as quit when its scene shuts down", () => {
    const { telemetry, emitted } = facade();
    const scene = lifecycle();
    telemetry.start("ace_duel", {}, scene);
    scene.fire("shutdown");
    expect(emitted[0]).toMatchObject({ mode: "ace_duel", outcome: "quit" });
  });

  it("does not emit a quit after a finished match's scene shuts down", () => {
    const { telemetry, emitted } = facade();
    const scene = lifecycle();
    telemetry.start("ace_duel", {}, scene);
    telemetry.finish("victory");
    scene.fire("shutdown");
    expect(emitted.map((e) => e.outcome)).toEqual(["victory"]);
  });

  it("closes a still-running match as quit when a new one starts", () => {
    const { telemetry, emitted } = facade();
    telemetry.start("dogfight");
    telemetry.start("continuous");
    telemetry.finish("victory");
    expect(emitted.map((e) => `${e.mode}:${e.outcome}`)).toEqual([
      "dogfight:quit",
      "continuous:victory",
    ]);
  });

  it("does not let a stale scene's shutdown close the next match", () => {
    const { telemetry, emitted } = facade();
    const first = lifecycle();
    telemetry.start("dogfight", {}, first);
    telemetry.finish("victory");
    telemetry.start("dogfight");
    first.fire("shutdown");
    expect(telemetry.isActive).toBe(true);
    expect(emitted).toHaveLength(1);
  });
});
