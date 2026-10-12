import { describe, expect, it } from "vitest";
import {
  packSnapshot,
  unpackSnapshot,
} from "../../../src/net/lockstep/snapshotPacking";
import { DeterministicRng } from "../../../src/net/lockstep/DeterministicRng";

describe("snapshotPacking", () => {
  it("round-trips text exactly, unicode and edge cases included", () => {
    for (const text of [
      "",
      "a",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "abababababababab",
      '{"x":1.2345678901234567,"id":"enemy_1"}',
      "κόσμε — 星 \u0000 \uffff",
    ])
      expect(unpackSnapshot(packSnapshot(text))).toBe(text);
  });

  it("round-trips random text", () => {
    const rng = new DeterministicRng(9);
    for (let n = 0; n < 50; n++) {
      const length = rng.nextInt(0, 400);
      let text = "";
      for (let i = 0; i < length; i++)
        text += String.fromCharCode(
          rng.nextInt(32, rng.chance(0.1) ? 900 : 126),
        );
      expect(unpackSnapshot(packSnapshot(text))).toBe(text);
    }
  });

  it("shrinks repeated perception frames many times over", () => {
    const rng = new DeterministicRng(4);
    const ships = Array.from({ length: 30 }, (_, i) => ({
      id: `enemy_${i}`,
      side: i % 2 ? "void_corsairs" : "terran_hegemony",
      x: rng.next() * 4000,
      y: rng.next() * 4000,
      angle: rng.next() * 360,
      alive: true,
    }));
    const bots = Array.from({ length: 18 }, (_, b) => [
      ships[b]!,
      ...ships.filter((_, i) => i !== b),
    ]);
    const json = JSON.stringify({ bots });
    const packed = packSnapshot(json);
    expect(unpackSnapshot(packed)).toBe(json);
    expect(packed.length).toBeLessThan(json.length / 6);
    expect(packed).toMatch(/^[A-Za-z0-9+\-:]+$/);
  });

  it("refuses data it did not pack", () => {
    expect(() => unpackSnapshot("{}")).toThrow();
  });
});
