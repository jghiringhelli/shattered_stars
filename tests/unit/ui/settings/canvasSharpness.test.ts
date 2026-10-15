import { describe, expect, it } from "vitest";
import { renderingFor } from "../../../../src/ui/settings/canvasSharpness";

describe("canvasSharpness", () => {
  it("keeps smooth scaling at the native size and at fractional factors", () => {
    expect(renderingFor(1, true)).toBe("auto");
    expect(renderingFor(1.5, true)).toBe("auto");
    expect(renderingFor(2.5, true)).toBe("auto");
  });

  it("uses crisp scaling at integer factors from 2x", () => {
    expect(renderingFor(2, true)).toBe("pixelated");
    expect(renderingFor(3, true)).toBe("pixelated");
    expect(renderingFor(2.01, true)).toBe("pixelated");
  });

  it("stays smooth when the player turned sharp scaling off", () => {
    expect(renderingFor(2, false)).toBe("auto");
  });

  it("ignores a non-finite scale", () => {
    expect(renderingFor(Number.NaN, true)).toBe("auto");
  });
});
