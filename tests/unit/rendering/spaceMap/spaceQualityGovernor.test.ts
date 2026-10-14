import { describe, expect, it } from "vitest";
import {
  DROP_HOLD_MS,
  RESTORE_HOLD_MS,
  SPACE_QUALITY_FULL,
  SPACE_QUALITY_MIN,
  SpaceQualityGovernor,
  isSoftwareRenderer,
} from "../../../../src/rendering/spaceMap/spaceQualityGovernor";

/** Run `seconds` of frames at `frameMs`, returning the final level. */
function run(
  governor: SpaceQualityGovernor,
  startMs: number,
  seconds: number,
  frameMs: number,
): { level: number; endMs: number } {
  let now = startMs;
  let level = governor.quality;
  const end = startMs + seconds * 1000;
  while (now < end) {
    now += frameMs;
    level = governor.observe(frameMs, now);
  }
  return { level, endMs: now };
}

describe("SpaceQualityGovernor", () => {
  it("stays at full quality at 60 fps", () => {
    const governor = new SpaceQualityGovernor();
    expect(run(governor, 0, 30, 16.7).level).toBe(SPACE_QUALITY_FULL);
  });

  it("does not react to a single long frame", () => {
    const governor = new SpaceQualityGovernor();
    const now = run(governor, 0, 2, 16.7).endMs;
    expect(governor.observe(200, now + 200)).toBe(SPACE_QUALITY_FULL);
  });

  it("drops a level after a sustained slow stretch", () => {
    const governor = new SpaceQualityGovernor();
    const { level } = run(governor, 0, (DROP_HOLD_MS / 1000) * 3, 40);
    expect(level).toBeLessThan(SPACE_QUALITY_FULL);
  });

  it("keeps dropping while slow, but never below the minimum", () => {
    const governor = new SpaceQualityGovernor();
    expect(run(governor, 0, 60, 80).level).toBe(SPACE_QUALITY_MIN);
  });

  it("restores a level only after a long steady recovery", () => {
    const governor = new SpaceQualityGovernor();
    const slow = run(governor, 0, 20, 60);
    expect(slow.level).toBeLessThan(SPACE_QUALITY_FULL);
    const brief = run(governor, slow.endMs, (RESTORE_HOLD_MS / 1000) * 0.5, 16.7);
    expect(brief.level).toBe(slow.level);
    const long = run(governor, brief.endMs, 200, 16.7);
    expect(long.level).toBeGreaterThan(slow.level);
    const forever = run(governor, long.endMs, 1500, 16.7);
    expect(forever.level).toBe(SPACE_QUALITY_FULL);
  });

  it("ignores frames that are not real (zero, negative, tab-switch gaps)", () => {
    const governor = new SpaceQualityGovernor();
    for (let i = 0; i < 200; i++) governor.observe(0, i * 20);
    for (let i = 0; i < 200; i++) governor.observe(5000, 4000 + i * 20);
    expect(governor.quality).toBe(SPACE_QUALITY_FULL);
  });
});

describe("quality cap and renderer detection", () => {
  it("never draws above its cap, even when frames are fast", () => {
    const governor = new SpaceQualityGovernor(1);
    expect(governor.quality).toBe(1);
    expect(run(governor, 0, 600, 16.7).level).toBe(1);
  });

  it("recognises CPU rasterisers", () => {
    expect(isSoftwareRenderer("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)")).toBe(true);
    expect(isSoftwareRenderer("llvmpipe (LLVM 15.0.7, 256 bits)")).toBe(true);
    expect(isSoftwareRenderer("Microsoft Basic Render Driver")).toBe(true);
    expect(isSoftwareRenderer("ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)")).toBe(false);
    expect(isSoftwareRenderer("Apple M2")).toBe(false);
  });
});
