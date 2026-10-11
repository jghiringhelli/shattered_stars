/**
 * Spec: the per-match combat stats accumulator — a pure tally of what
 * happened in one battle (shots, hits, damage, kills, maneuvers, specials,
 * marks, stress, repairs, deployments) flattened into one compact
 * `match_summary` telemetry payload when the match finishes.
 */

import { describe, it, expect } from "vitest";
import {
  MatchStatsAccumulator,
  type MatchStatEvent,
} from "../../../src/telemetry/matchStats";
import type { ManeuverDefinition } from "../../../src/core/types";

function clockAt(start: number): {
  now: () => number;
  advance: (ms: number) => void;
} {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms) };
}

function accumulator(events: readonly MatchStatEvent[] = []) {
  const clock = clockAt(10_000);
  const stats = new MatchStatsAccumulator("dogfight", clock.now, {
    difficulty: "normal",
  });
  for (const event of events) stats.record(event);
  return { stats, clock };
}

const DIAL: readonly ManeuverDefinition[] = [
  { direction: "straight", speed: 3, difficulty: "green" },
  { direction: "bank_left", speed: 3, difficulty: "white" },
  { direction: "kturn", speed: 3, difficulty: "red" },
] as unknown as ManeuverDefinition[];

describe("MatchStatsAccumulator", () => {
  it("reports mode, outcome, duration and the start details", () => {
    const { stats, clock } = accumulator();
    clock.advance(42_000);
    const summary = stats.finish("victory");
    expect(summary).toMatchObject({
      mode: "dogfight",
      outcome: "victory",
      durationMs: 42_000,
      difficulty: "normal",
    });
  });

  it("counts primary and ordnance shots and hits separately for the friendly side", () => {
    const { stats } = accumulator([
      { kind: "shot", friendly: true, weapon: "primary", hit: true },
      { kind: "shot", friendly: true, weapon: "primary", hit: false },
      { kind: "shot", friendly: true, weapon: "ordnance", hit: true },
      { kind: "shot", friendly: false, weapon: "primary", hit: true },
    ]);
    expect(stats.finish("victory")).toMatchObject({
      shotsPrimary: 2,
      hitsPrimary: 1,
      shotsOrdnance: 1,
      hitsOrdnance: 1,
      enemyShots: 1,
      enemyHits: 1,
    });
  });

  it("counts projectile hits separately from the shots that fired them", () => {
    const { stats } = accumulator([
      { kind: "shot", friendly: true, weapon: "primary", hit: false },
      { kind: "shot", friendly: true, weapon: "ordnance", hit: false },
      { kind: "hit", friendly: true, weapon: "primary" },
      { kind: "hit", friendly: true, weapon: "ordnance" },
      { kind: "hit", friendly: false, weapon: "primary" },
    ]);
    expect(stats.finish("victory")).toMatchObject({
      shotsPrimary: 1,
      hitsPrimary: 1,
      shotsOrdnance: 1,
      hitsOrdnance: 1,
      enemyShots: 0,
      enemyHits: 1,
    });
  });

  it("splits damage dealt and taken into hull and shields", () => {
    const { stats } = accumulator([
      { kind: "damage", toFriendly: false, hull: 5, shield: 3 },
      { kind: "damage", toFriendly: true, hull: 2, shield: 0 },
      { kind: "damage", toFriendly: true, hull: 0, shield: 4 },
    ]);
    expect(stats.finish("defeat")).toMatchObject({
      dmgDealtHull: 5,
      dmgDealtShield: 3,
      dmgTakenHull: 2,
      dmgTakenShield: 4,
    });
  });

  it("ignores negative or non-finite damage (healing is not damage)", () => {
    const { stats } = accumulator([
      { kind: "damage", toFriendly: false, hull: -3, shield: Number.NaN },
    ]);
    expect(stats.finish("draw")).toMatchObject({
      dmgDealtHull: 0,
      dmgDealtShield: 0,
    });
  });

  it("counts kills and losses per side, player deaths, and time to first kill", () => {
    const { stats, clock } = accumulator();
    clock.advance(7_500);
    stats.record({ kind: "kill", victimFriendly: false });
    clock.advance(1_000);
    stats.record({ kind: "kill", victimFriendly: true, victimIsPlayer: true });
    expect(stats.finish("defeat")).toMatchObject({
      kills: 1,
      losses: 1,
      playerDeaths: 1,
      firstKillMs: 7_500,
    });
  });

  it("leaves time to first kill null when nobody died", () => {
    const { stats } = accumulator();
    expect(stats.finish("quit").firstKillMs).toBeNull();
  });

  it("classifies the player's committed maneuvers green / white / red from the dial", () => {
    const { stats } = accumulator([
      { kind: "cycle", dial: DIAL, direction: "straight", speed: 3 },
      { kind: "cycle", dial: DIAL, direction: "bank_left", speed: 3 },
      { kind: "cycle", dial: DIAL, direction: "drift_left", speed: 3 },
      { kind: "cycle", dial: DIAL, direction: "turn_right", speed: 5 },
    ]);
    expect(stats.finish("victory")).toMatchObject({
      mvGreen: 1,
      mvWhite: 2,
      mvRed: 1,
    });
  });

  it("counts special actions from flight events (hard turns are not specials)", () => {
    const { stats } = accumulator([
      { kind: "flight", events: ["kturn", "boost"] },
      {
        kind: "flight",
        events: ["segnor", "tallon", "barrel_roll", "hard_turn"],
      },
      { kind: "flight", events: ["barrel_roll"] },
    ]);
    expect(stats.finish("victory")).toMatchObject({
      kturn: 1,
      segnor: 1,
      tallon: 1,
      boost: 1,
      barrelRoll: 2,
      specials: 6,
    });
  });

  it("counts marks, stressed time, repairs and deployed ships", () => {
    const { stats } = accumulator([
      { kind: "mark" },
      { kind: "mark" },
      { kind: "stress", ms: 16, stressed: true },
      { kind: "stress", ms: 16, stressed: false },
      { kind: "stress", ms: 20, stressed: true },
      { kind: "repair", hull: 6 },
      { kind: "repair", hull: 4 },
      { kind: "deploy", friendly: true },
      { kind: "deploy", friendly: false, count: 3 },
    ]);
    expect(stats.finish("victory")).toMatchObject({
      marks: 2,
      stressMs: 36,
      repairs: 2,
      repairHull: 10,
      deployedFriendly: 1,
      deployedHostile: 3,
    });
  });

  it("does not count hull repairs of ships deployed as hostile", () => {
    const { stats } = accumulator([
      { kind: "deploy", friendly: false, shipId: "enemy_1" },
      { kind: "deploy", friendly: true, shipId: "player_0" },
      { kind: "repair", hull: 5, shipId: "enemy_1" },
      { kind: "repair", hull: 2, shipId: "player_0" },
    ]);
    expect(stats.finish("victory")).toMatchObject({
      repairs: 1,
      repairHull: 2,
    });
  });

  it("produces a flat payload of primitives only (a valid telemetry event)", () => {
    const { stats } = accumulator([{ kind: "mark" }]);
    for (const value of Object.values(stats.finish("victory"))) {
      expect(
        ["string", "number", "boolean"].includes(typeof value) ||
          value === null,
      ).toBe(true);
    }
  });

  it("ignores events recorded after finish", () => {
    const { stats } = accumulator();
    const first = stats.finish("victory");
    stats.record({ kind: "mark" });
    expect(first.marks).toBe(0);
    expect(stats.isFinished).toBe(true);
  });
});
