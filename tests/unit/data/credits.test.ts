import { describe, it, expect } from "vitest";
import { CREDITS, CREDIT_LINE_MAX_CHARS } from "../../../src/data/credits";

const allText = CREDITS.map((line) => line.text).join("\n");

describe("credits", () => {
  it("credits the AI art pipeline honestly (no 'procedural' art claim)", () => {
    expect(allText).toContain("Stable Diffusion");
    expect(allText).toContain("DreamShaper 8");
    expect(allText).toMatch(/Forge/);
    expect(allText).toMatch(/ComfyUI/);
    expect(allText).not.toMatch(/Procedural Generation/);
  });

  it("credits the music: the author's Suno tracks plus ACE-Step faction tracks", () => {
    expect(allText).toContain("Suno");
    expect(allText).toContain("ACE-Step");
    expect(allText).toContain("Harmonia");
    expect(allText).toMatch(/Synthetic/);
    expect(allText).toMatch(/Ascendant/);
  });

  it("credits every checkpoint family the art scripts use (SDXL and DreamShaper)", () => {
    expect(allText).toContain("SDXL 1.0");
    expect(allText).toContain("DreamShaper 8");
  });

  it("names the bundled Phaser sub-libraries and the font policy", () => {
    for (const lib of ["Matter.js", "poly-decomp", "earcut"])
      expect(allText).toContain(lib);
    expect(allText).toMatch(/System fonts only/);
  });

  it("names no third-party game or franchise", () => {
    expect(allText).not.toMatch(/X-Wing|Star Wars|Wing Commander|Lucasfilm/i);
  });

  it("discloses AI-generated content", () => {
    expect(allText).toMatch(/AI-generated/i);
  });

  it("carries the non-affiliation and trademark disclaimer", () => {
    expect(allText).toMatch(/not affiliated/i);
    expect(allText).toMatch(/trademarks/i);
    expect(allText).toMatch(/classic dogfighting games/i);
  });

  it("states the proprietary license and free alpha", () => {
    expect(allText).toMatch(/All rights reserved/);
    expect(allText).toMatch(/free-to-play alpha/i);
  });

  it("names the open-source libraries it ships", () => {
    for (const lib of ["Phaser", "seedrandom"]) expect(allText).toContain(lib);
  });

  it("keeps every line short enough to fit the credit roll", () => {
    const long = CREDITS.filter((l) => l.text.length > CREDIT_LINE_MAX_CHARS);
    expect(long.map((l) => l.text)).toEqual([]);
  });
});
