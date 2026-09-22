/**
 * Gate: projectiles are drawn rounded and rimmed, not as bare primitives.
 *
 * Cannon bolts used to be a flat fillRect and ordnance a flat fillCircle.
 * These tests pin the four-layer build (glow, body, rim, core) and the
 * rounded geometry, using a recording fake Graphics rather than Phaser.
 */

import { describe, it, expect } from "vitest";
import type Phaser from "phaser";
import {
  drawEnergyBolt,
  drawEnergyOrb,
  lighten,
} from "../../../src/rendering/BoltRenderer";

interface DrawCall {
  readonly op: string;
  readonly args: readonly number[];
}

/**
 * Records every draw call instead of rasterising. A fake, not a mock: it has
 * no expectations, tests assert on the recording afterwards.
 */
class RecordingGraphics {
  readonly calls: DrawCall[] = [];

  fillStyle(color: number, alpha: number): this {
    return this.record("fillStyle", [color, alpha]);
  }
  lineStyle(width: number, color: number, alpha: number): this {
    return this.record("lineStyle", [width, color, alpha]);
  }
  fillRect(...args: number[]): this {
    return this.record("fillRect", args);
  }
  fillRoundedRect(...args: number[]): this {
    return this.record("fillRoundedRect", args);
  }
  strokeRoundedRect(...args: number[]): this {
    return this.record("strokeRoundedRect", args);
  }
  fillCircle(...args: number[]): this {
    return this.record("fillCircle", args);
  }
  strokeCircle(...args: number[]): this {
    return this.record("strokeCircle", args);
  }

  /** Every op name in call order. */
  ops(): string[] {
    return this.calls.map((c) => c.op);
  }

  /** All calls for one op. */
  of(op: string): DrawCall[] {
    return this.calls.filter((c) => c.op === op);
  }

  private record(op: string, args: readonly number[]): this {
    this.calls.push({ op, args });
    return this;
  }
}

/** The fake stands in for Graphics at the surface BoltRenderer actually uses. */
function fakeGraphics(): RecordingGraphics {
  return new RecordingGraphics();
}

const asGraphics = (g: RecordingGraphics): Phaser.GameObjects.Graphics =>
  g as unknown as Phaser.GameObjects.Graphics;

describe("lighten", () => {
  it("returns the input colour when the amount is zero", () => {
    expect(lighten(0x3366cc, 0)).toBe(0x3366cc);
  });

  it("returns white when the amount is one", () => {
    expect(lighten(0x3366cc, 1)).toBe(0xffffff);
  });

  it("moves every channel toward white for a partial amount", () => {
    const result = lighten(0x000000, 0.5);
    expect((result >> 16) & 0xff).toBeGreaterThan(0);
    expect((result >> 8) & 0xff).toBeGreaterThan(0);
    expect(result & 0xff).toBeGreaterThan(0);
  });

  it("never produces a channel above 0xff", () => {
    const result = lighten(0xffffff, 1);
    expect((result >> 16) & 0xff).toBeLessThanOrEqual(0xff);
    expect(result & 0xff).toBeLessThanOrEqual(0xff);
  });

  it("clamps an out-of-range amount instead of overflowing", () => {
    expect(lighten(0x3366cc, 5)).toBe(0xffffff);
    expect(lighten(0x3366cc, -5)).toBe(0x3366cc);
  });
});

describe("drawEnergyBolt", () => {
  const style = { color: 0xff8800, length: 34, width: 10 };

  it("draws no square-cornered rectangle", () => {
    const g = fakeGraphics();
    drawEnergyBolt(asGraphics(g), style);
    expect(g.of("fillRect")).toHaveLength(0);
  });

  it("rounds every layer to a stadium — radius is half the short side", () => {
    const g = fakeGraphics();
    drawEnergyBolt(asGraphics(g), style);
    const rounded = [...g.of("fillRoundedRect"), ...g.of("strokeRoundedRect")];
    expect(rounded.length).toBeGreaterThan(0);
    for (const call of rounded) {
      const [, , width, height, radius] = call.args as [
        number,
        number,
        number,
        number,
        number,
      ];
      expect(radius).toBeCloseTo(Math.min(width, height) / 2, 6);
    }
  });

  it("strokes a rim around the body", () => {
    const g = fakeGraphics();
    drawEnergyBolt(asGraphics(g), style);
    expect(g.of("strokeRoundedRect")).toHaveLength(1);
    expect(g.of("lineStyle")).toHaveLength(1);
  });

  it("makes the rim lighter than the body colour", () => {
    const g = fakeGraphics();
    drawEnergyBolt(asGraphics(g), style);
    const rimColor = g.of("lineStyle")[0]!.args[1]!;
    expect(rimColor).toBe(lighten(style.color, 0.55));
    expect(rimColor).not.toBe(style.color);
  });

  it("draws a glow wider than the body", () => {
    const g = fakeGraphics();
    drawEnergyBolt(asGraphics(g), style);
    const widths = g.of("fillRoundedRect").map((c) => c.args[2]!);
    expect(Math.max(...widths)).toBeGreaterThan(style.width);
  });

  it("draws a white core narrower than the body", () => {
    const g = fakeGraphics();
    drawEnergyBolt(asGraphics(g), style);
    const coreFill = g.of("fillStyle").find((c) => c.args[0] === 0xffffff);
    expect(coreFill).toBeDefined();
    const widths = g.of("fillRoundedRect").map((c) => c.args[2]!);
    expect(Math.min(...widths)).toBeLessThan(style.width);
  });

  it("centres every layer on the origin", () => {
    const g = fakeGraphics();
    drawEnergyBolt(asGraphics(g), style);
    for (const call of [
      ...g.of("fillRoundedRect"),
      ...g.of("strokeRoundedRect"),
    ]) {
      const [x, y, width, height] = call.args as [
        number,
        number,
        number,
        number,
      ];
      expect(x).toBeCloseTo(-width / 2, 6);
      expect(y).toBeCloseTo(-height / 2, 6);
    }
  });

  it("layers glow, body, rim, then core in that order", () => {
    const g = fakeGraphics();
    drawEnergyBolt(asGraphics(g), style);
    expect(g.ops()).toEqual([
      "fillStyle",
      "fillRoundedRect",
      "fillStyle",
      "fillRoundedRect",
      "lineStyle",
      "strokeRoundedRect",
      "fillStyle",
      "fillRoundedRect",
    ]);
  });
});

describe("drawEnergyOrb", () => {
  const style = { color: 0xffcc00, radius: 4 };

  it("strokes a rim around the body", () => {
    const g = fakeGraphics();
    drawEnergyOrb(asGraphics(g), style);
    expect(g.of("strokeCircle")).toHaveLength(1);
    expect(g.of("strokeCircle")[0]!.args[2]).toBe(style.radius);
  });

  it("makes the rim lighter than the body colour", () => {
    const g = fakeGraphics();
    drawEnergyOrb(asGraphics(g), style);
    expect(g.of("lineStyle")[0]!.args[1]).toBe(lighten(style.color, 0.55));
  });

  it("draws a glow larger than the body and a core smaller than it", () => {
    const g = fakeGraphics();
    drawEnergyOrb(asGraphics(g), style);
    const radii = g.of("fillCircle").map((c) => c.args[2]!);
    expect(Math.max(...radii)).toBeGreaterThan(style.radius);
    expect(Math.min(...radii)).toBeLessThan(style.radius);
  });

  it("layers glow, body, rim, then core in that order", () => {
    const g = fakeGraphics();
    drawEnergyOrb(asGraphics(g), style);
    expect(g.ops()).toEqual([
      "fillStyle",
      "fillCircle",
      "fillStyle",
      "fillCircle",
      "lineStyle",
      "strokeCircle",
      "fillStyle",
      "fillCircle",
    ]);
  });
});
