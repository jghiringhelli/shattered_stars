import { describe, expect, it } from "vitest";
import { radarSeamLines } from "../../../../src/ui/hud/radarSeams";

const OPTIONS = { rangePx: 2000, radiusPx: 80, worldSize: 6000 } as const;
const pose = (x: number, y: number, angle = 0) => ({ x, y, angle });

describe("radarSeamLines", () => {
  it("shows no seam when the player is far from every edge", () => {
    expect(radarSeamLines(pose(3000, 3000), OPTIONS)).toEqual([]);
  });

  it("draws the left edge as a vertical line to the player's left", () => {
    const [seam, ...rest] = radarSeamLines(pose(500, 3000), OPTIONS);
    expect(rest).toEqual([]);
    expect(seam!.nearest.x).toBeCloseTo(-20);
    expect(seam!.nearest.y).toBeCloseTo(0);
    expect(seam!.from.x).toBeCloseTo(-20);
    expect(seam!.to.x).toBeCloseTo(-20);
    expect(seam!.crossing).toEqual({ x: -1, y: 0 });
  });

  it("shows the right edge from the other side of the wrap", () => {
    const [seam] = radarSeamLines(pose(5800, 3000), OPTIONS);
    expect(seam!.nearest.x).toBeCloseTo(8);
    expect(seam!.crossing.x).toBe(1);
  });

  it("clips the line to the radar circle", () => {
    const [seam] = radarSeamLines(pose(500, 3000), OPTIONS);
    const rim = Math.hypot(seam!.from.x, seam!.from.y);
    expect(rim).toBeCloseTo(80);
  });

  it("shows both axes near a corner", () => {
    expect(radarSeamLines(pose(300, 400), OPTIONS)).toHaveLength(2);
  });

  it("rotates with the player's heading", () => {
    const [seam] = radarSeamLines(pose(500, 3000, 90), OPTIONS);
    expect(seam!.nearest.x).toBeCloseTo(0);
    expect(Math.abs(seam!.nearest.y)).toBeCloseTo(20);
  });

  it("draws nothing for an unwrapped world", () => {
    expect(radarSeamLines(pose(5, 5), { ...OPTIONS, worldSize: 0 })).toEqual([]);
  });
});
