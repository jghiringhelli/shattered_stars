import { describe, it, expect } from "vitest";
import {
  DAMAGE_FLASH_MS,
  GHOST_HOLD_MS,
  SHIMMER_DURATION_MS,
  SHIMMER_SWEEP_MS,
  createChannel,
  flashStrength,
  isChannelAnimating,
  setChannelValue,
  shimmerStrength,
  shimmerSweep,
  stepChannel,
  triggerShimmer,
} from "../../../../../src/ui/hud/overlay/overlayAnimator";

describe("overlay channel animation", () => {
  it("starts idle at the given fraction", () => {
    const channel = createChannel(1);
    expect(channel.value).toBe(1);
    expect(isChannelAnimating(channel)).toBe(false);
  });

  it("reads a loss as damage: flash plus a ghost at the old value", () => {
    const channel = createChannel(1);
    expect(setChannelValue(channel, 0.6)).toBe("damage");
    expect(channel.value).toBe(0.6);
    expect(channel.ghost).toBe(1);
    expect(flashStrength(channel)).toBe(1);
  });

  it("finishes the damage flash within 200 ms of the hit", () => {
    const channel = createChannel(1);
    setChannelValue(channel, 0.5);
    stepChannel(channel, 200);
    expect(DAMAGE_FLASH_MS).toBeLessThanOrEqual(200);
    expect(flashStrength(channel)).toBe(0);
  });

  it("holds the ghost trail, then drains it down to the value", () => {
    const channel = createChannel(1);
    setChannelValue(channel, 0.5);
    stepChannel(channel, GHOST_HOLD_MS - 1);
    expect(channel.ghost).toBe(1);
    stepChannel(channel, 2000);
    expect(channel.ghost).toBe(0.5);
    expect(isChannelAnimating(channel)).toBe(false);
  });

  it("reads a gain as repair: shimmer, no flash", () => {
    const channel = createChannel(0.5);
    expect(setChannelValue(channel, 0.6)).toBe("repair");
    expect(shimmerStrength(channel)).toBe(1);
    expect(flashStrength(channel)).toBe(0);
  });

  it("sweeps the shimmer band along the bar, then stops", () => {
    const channel = createChannel(0.5);
    triggerShimmer(channel);
    expect(shimmerSweep(channel)).toBe(0);
    stepChannel(channel, SHIMMER_SWEEP_MS / 2);
    expect(shimmerSweep(channel)).toBeCloseTo(0.5, 10);
    stepChannel(channel, SHIMMER_DURATION_MS);
    expect(shimmerSweep(channel)).toBeNull();
    expect(isChannelAnimating(channel)).toBe(false);
  });

  it("extends an active shimmer without restarting its sweep", () => {
    const channel = createChannel(0.5);
    triggerShimmer(channel);
    stepChannel(channel, SHIMMER_SWEEP_MS / 4);
    triggerShimmer(channel);
    expect(shimmerSweep(channel)).toBeCloseTo(0.25, 10);
    expect(shimmerStrength(channel)).toBe(1);
  });

  it("ignores changes below float noise", () => {
    const channel = createChannel(0.5);
    expect(setChannelValue(channel, 0.5 + 1e-12)).toBe("none");
    expect(isChannelAnimating(channel)).toBe(false);
  });

  it("lifts the ghost with a repair so it never trails below the value", () => {
    const channel = createChannel(0.4);
    setChannelValue(channel, 0.8);
    expect(channel.ghost).toBe(0.8);
  });
});
