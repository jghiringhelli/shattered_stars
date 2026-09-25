import { describe, it, expect } from "vitest";
import {
  INITIAL_BANK_STATE,
  updateBankState,
  bankSquashFor,
} from "../../../src/rendering/ShipBanking";

describe("ShipBanking", () => {
  it("stays unsquashed when heading never changes", () => {
    let state = { ...INITIAL_BANK_STATE, lastAngle: 90 };
    for (let i = 0; i < 10; i++) {
      state = updateBankState(state, 90, 1 / 60);
    }
    const { scaleX, scaleY } = bankSquashFor(state);
    expect(scaleX).toBeCloseTo(1, 5);
    expect(scaleY).toBeCloseTo(1, 5);
  });

  it("squashes scaleX and stretches scaleY while turning hard", () => {
    let state = { ...INITIAL_BANK_STATE, lastAngle: 0 };
    for (let i = 0; i < 30; i++) {
      state = updateBankState(state, (i + 1) * 20, 1 / 60);
    }
    const { scaleX, scaleY } = bankSquashFor(state);
    expect(scaleX).toBeLessThan(1);
    expect(scaleY).toBeGreaterThan(1);
  });

  it("treats a left turn and a right turn as equally banked", () => {
    let left = { ...INITIAL_BANK_STATE, lastAngle: 0 };
    let right = { ...INITIAL_BANK_STATE, lastAngle: 0 };
    for (let i = 0; i < 10; i++) {
      left = updateBankState(left, -(i + 1) * 15, 1 / 60);
      right = updateBankState(right, (i + 1) * 15, 1 / 60);
    }
    const leftSquash = bankSquashFor(left);
    const rightSquash = bankSquashFor(right);
    expect(leftSquash.scaleX).toBeCloseTo(rightSquash.scaleX, 5);
    expect(leftSquash.scaleY).toBeCloseTo(rightSquash.scaleY, 5);
  });

  it("handles the 360/0 wraparound as a small turn, not a huge one", () => {
    const state = updateBankState(
      { lastAngle: 350, smoothedRate: 0 },
      10,
      1 / 60,
    );
    // 350 -> 10 is a 20 degree turn the short way, not a 340 degree one.
    expect(Math.abs(state.smoothedRate)).toBeLessThan(400);
  });

  it("clamps squash so a violent spin never inverts or flattens the sprite", () => {
    let state = { ...INITIAL_BANK_STATE, lastAngle: 0 };
    for (let i = 0; i < 60; i++) {
      state = updateBankState(state, (i + 1) * 170, 1 / 60);
    }
    const { scaleX, scaleY } = bankSquashFor(state);
    expect(scaleX).toBeGreaterThan(0.3);
    expect(scaleY).toBeLessThan(1.5);
  });

  it("eases toward the new turn rate instead of snapping instantly", () => {
    let state = { ...INITIAL_BANK_STATE, lastAngle: 0 };
    state = updateBankState(state, 90, 1 / 60);
    expect(Math.abs(state.smoothedRate)).toBeLessThan(90 / (1 / 60));
  });

  it("ignores a non-positive delta instead of dividing by zero", () => {
    const seed = { lastAngle: 45, smoothedRate: 12 };
    expect(updateBankState(seed, 90, 0)).toEqual(seed);
    expect(updateBankState(seed, 90, -1 / 60)).toEqual(seed);
  });
});
