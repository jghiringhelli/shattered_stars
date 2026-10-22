/**
 * Spec: the screen-edge stress tint intensity — none when calm/normal,
 * gentle and level-following while STRESSED, dimmer and fading with the
 * level while RECOVERING, always subtle, and static under reduced motion.
 */

import { describe, it, expect } from "vitest";
import {
  EDGE_BAND_COUNT,
  MAX_TINT_ALPHA,
  edgeBandAlpha,
  smoothTintAlpha,
  stressTintAlpha,
} from "../../../../src/ui/hud/stressTintMath";
import type { StressKind } from "../../../../src/ui/hud/stressState";

const track = (kind: StressKind, locked = kind === "stressed") => ({
  kind,
  anchor: 0,
  locked,
});

describe("stressTintAlpha", () => {
  it("is zero when calm or normal, whatever the level", () => {
    for (const level of [0, 0.3, 0.69]) {
      expect(stressTintAlpha(track("calm"), level, false)).toBe(0);
      expect(stressTintAlpha(track("normal"), level, false)).toBe(0);
    }
  });

  it("is clearly visible but gentle while stressed", () => {
    for (const level of [0.7, 0.85, 1]) {
      const a = stressTintAlpha(track("stressed"), level, false);
      expect(a).toBeGreaterThanOrEqual(0.15);
      expect(a).toBeLessThanOrEqual(MAX_TINT_ALPHA);
    }
  });

  it("grows smoothly with the level while stressed", () => {
    const low = stressTintAlpha(track("stressed"), 0.7, false);
    const high = stressTintAlpha(track("stressed"), 1, false);
    expect(high).toBeGreaterThan(low);
  });

  it("is dimmer than stressed at the same level while recovering", () => {
    const stressed = stressTintAlpha(track("stressed"), 0.8, false);
    const recovering = stressTintAlpha(track("recovering", true), 0.8, false);
    expect(recovering).toBeGreaterThan(0);
    expect(recovering).toBeLessThan(stressed);
  });

  it("fades out as the recovering level falls, reaching 0 at level 0", () => {
    const levels = [0.8, 0.5, 0.3, 0.1, 0];
    const alphas = levels.map((l) =>
      stressTintAlpha(track("recovering", false), l, false),
    );
    for (let i = 1; i < alphas.length; i++) {
      expect(alphas[i]!).toBeLessThan(alphas[i - 1]!);
    }
    expect(alphas.at(-1)).toBe(0);
  });

  it("never exceeds the subtle cap and tolerates NaN / out-of-range levels", () => {
    expect(stressTintAlpha(track("stressed"), 9, false)).toBeLessThanOrEqual(
      MAX_TINT_ALPHA,
    );
    expect(
      stressTintAlpha(track("stressed"), Number.NaN, false),
    ).toBeLessThanOrEqual(MAX_TINT_ALPHA);
    expect(stressTintAlpha(track("recovering"), -1, false)).toBe(0);
  });

  it("is static under reduced motion: one steady value per state", () => {
    const a = stressTintAlpha(track("stressed"), 0.75, true);
    expect(stressTintAlpha(track("stressed"), 1, true)).toBe(a);
    const r = stressTintAlpha(track("recovering", true), 0.9, true);
    expect(stressTintAlpha(track("recovering", true), 0.2, true)).toBe(r);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(a);
    expect(stressTintAlpha(track("calm"), 0, true)).toBe(0);
  });
});

describe("smoothTintAlpha", () => {
  it("eases toward the target without overshooting", () => {
    let a = 0;
    for (let i = 0; i < 200; i++) {
      const next = smoothTintAlpha(a, 0.2, false);
      expect(next).toBeGreaterThanOrEqual(a);
      expect(next).toBeLessThanOrEqual(0.2);
      a = next;
    }
    expect(a).toBe(0.2);
  });

  it("snaps to zero once it is imperceptible, and snaps under reduced motion", () => {
    expect(smoothTintAlpha(0.001, 0, false)).toBe(0);
    expect(smoothTintAlpha(0, 0.2, true)).toBe(0.2);
    expect(smoothTintAlpha(0.2, 0, true)).toBe(0);
  });
});

describe("edgeBandAlpha", () => {
  it("is strongest at the screen edge and fades to 0 inside", () => {
    const alphas = Array.from({ length: EDGE_BAND_COUNT }, (_, i) =>
      edgeBandAlpha(i, 0.2),
    );
    for (let i = 1; i < alphas.length; i++) {
      expect(alphas[i]!).toBeLessThan(alphas[i - 1]!);
    }
    expect(alphas[0]!).toBeGreaterThan(0);
    expect(alphas[0]!).toBeLessThanOrEqual(0.2);
  });
});
