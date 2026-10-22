/**
 * Spec: the HUD stress readout classifies the player's stress into CALM /
 * NORMAL / RECOVERING / STRESSED from the level + latched flag and the HUD's
 * own memory of the previous level. Small hysteresis so it never flickers.
 */

import { describe, it, expect } from "vitest";
import {
  CALM_ENTER_LEVEL,
  CALM_EXIT_LEVEL,
  FALL_EPSILON,
  INITIAL_STRESS_TRACK,
  RISE_EPSILON,
  emphasisAlpha,
  stepStressTrack,
  stressCounterText,
  stressLabel,
  stressPercent,
  type StressTrack,
} from "../../../../src/ui/hud/stressState";

/** Feed a level sequence; returns the track after each step. */
function run(
  levels: readonly number[],
  isStressed: (level: number, index: number) => boolean = () => false,
  start: StressTrack = INITIAL_STRESS_TRACK,
): StressTrack[] {
  const out: StressTrack[] = [];
  let track = start;
  levels.forEach((level, i) => {
    track = stepStressTrack(track, level, isStressed(level, i));
    out.push(track);
  });
  return out;
}

describe("stepStressTrack", () => {
  it("starts calm at level 0", () => {
    expect(stepStressTrack(INITIAL_STRESS_TRACK, 0, false).kind).toBe("calm");
  });

  it("treats rising stress below the stressed latch as normal, not calm", () => {
    const kinds = run([0.1, 0.2, 0.3, 0.45, 0.6]).map((t) => t.kind);
    expect(kinds).toEqual(["normal", "normal", "normal", "normal", "normal"]);
  });

  it("stays calm while level creeps up inside the calm band", () => {
    const kinds = run([0.01, 0.03, 0.045]).map((t) => t.kind);
    expect(kinds).toEqual(["calm", "calm", "calm"]);
    expect(stepStressTrack(run([0.04])[0]!, CALM_EXIT_LEVEL, false).kind).toBe(
      "normal",
    );
  });

  it("reports stressed while the latch is set and the level is not falling", () => {
    const track = run([0.7, 0.8, 0.95, 1], () => true).at(-1)!;
    expect(track.kind).toBe("stressed");
    expect(track.locked).toBe(true);
  });

  it("reports recovering once a normal level falls past the epsilon", () => {
    const tracks = run([0.5, 0.5 - FALL_EPSILON / 2, 0.5 - FALL_EPSILON]);
    expect(tracks[1]!.kind).toBe("normal");
    expect(tracks[2]!.kind).toBe("recovering");
  });

  it("reports recovering (still locked) for a stressed pilot whose level falls", () => {
    const track = run([0.9, 0.85, 0.8, 0.5], () => true).at(-1)!;
    expect(track.kind).toBe("recovering");
    expect(track.locked).toBe(true);
  });

  it("clears the lock but keeps recovering when the latch drops at STRESS_LOW", () => {
    const levels = [0.9, 0.5, 0.2, 0.15, 0.1];
    const track = run(levels, (l) => l > 0.15).at(-1)!;
    expect(track.kind).toBe("recovering");
    expect(track.locked).toBe(false);
  });

  it("returns to calm when the level drains to the calm entry level", () => {
    const track = run([0.3, 0.2, 0.1, CALM_ENTER_LEVEL]).at(-1)!;
    expect(track.kind).toBe("calm");
    expect(track.locked).toBe(false);
  });

  it("does not flicker on slow passive decay (0.05 per second at 60 fps)", () => {
    const levels = Array.from({ length: 120 }, (_, i) => 0.6 - (i * 0.05) / 60);
    const kinds = run(levels).map((t) => t.kind);
    const changes = kinds.filter((k, i) => i > 0 && k !== kinds[i - 1]);
    expect(changes).toEqual(["recovering"]);
  });

  it("ignores jitter smaller than the epsilons around a steady level", () => {
    const jitter = [0.5, 0.504, 0.499, 0.503, 0.498, 0.502];
    const kinds = run(jitter).map((t) => t.kind);
    expect(new Set(kinds)).toEqual(new Set(["normal"]));
  });

  it("stays recovering through a tiny bump, leaves it on a real rise", () => {
    const base = run([0.5, 0.4, 0.3]).at(-1)!;
    expect(stepStressTrack(base, 0.3 + RISE_EPSILON / 2, false).kind).toBe(
      "recovering",
    );
    expect(stepStressTrack(base, 0.3 + RISE_EPSILON, false).kind).toBe(
      "normal",
    );
  });

  it("goes from recovering to stressed when a rise re-latches the flag", () => {
    const levels = [0.9, 0.6, 0.4, 0.75];
    const track = run(levels, (l, i) => i < 2 || l >= 0.7).at(-1)!;
    expect(track.kind).toBe("stressed");
  });

  it("tolerates NaN and out-of-range levels", () => {
    expect(stepStressTrack(INITIAL_STRESS_TRACK, Number.NaN, false).kind).toBe(
      "calm",
    );
    expect(stepStressTrack(INITIAL_STRESS_TRACK, 7, true).kind).toBe(
      "stressed",
    );
  });
});

describe("stress text", () => {
  it("rounds the level to a whole percent, clamped to 0..100", () => {
    expect(stressPercent(0.424)).toBe(42);
    expect(stressPercent(0.425)).toBe(43);
    expect(stressPercent(-1)).toBe(0);
    expect(stressPercent(3)).toBe(100);
    expect(stressPercent(Number.NaN)).toBe(0);
  });

  it("formats the counter as STRESS n%", () => {
    expect(stressCounterText(0.42)).toBe("STRESS 42%");
    expect(stressCounterText(0)).toBe("STRESS 0%");
  });

  it("labels each state with text (never colour alone)", () => {
    const at = (kind: StressTrack["kind"], locked = false): StressTrack => ({
      kind,
      anchor: 0,
      locked,
    });
    expect(stressLabel(at("calm"))).toBe("CALM");
    expect(stressLabel(at("normal"))).toBe("NORMAL");
    expect(stressLabel(at("recovering"))).toBe("RECOVERING");
    expect(stressLabel(at("stressed", true))).toBe("STRESSED");
  });

  it("marks a still-locked recovery so red moves are not assumed available", () => {
    const locked: StressTrack = { kind: "recovering", anchor: 0, locked: true };
    expect(stressLabel(locked)).toBe("RECOVERING !");
  });
});

describe("emphasisAlpha", () => {
  it("fades out once, monotonically, to 0", () => {
    const a = [0, 200, 400, 800].map((t) => emphasisAlpha(t, false));
    expect(a[0]).toBeGreaterThan(a[1]!);
    expect(a[1]).toBeGreaterThan(a[2]!);
    expect(a[3]).toBe(0);
  });

  it("is a steady (non-animated) highlight under reduced motion, then off", () => {
    expect(emphasisAlpha(0, true)).toBe(emphasisAlpha(500, true));
    expect(emphasisAlpha(500, true)).toBeGreaterThan(0);
    expect(emphasisAlpha(2000, true)).toBe(0);
  });

  it("is 0 before the emphasis starts", () => {
    expect(emphasisAlpha(-5, false)).toBe(0);
  });
});
