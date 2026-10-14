import { describe, it, expect } from "vitest";
import { BUILD_INFO, formatVersionTag } from "../../src/buildInfo";

const BUILD = { version: "0.1.0", commit: "abc1234", builtAt: "2026-10-11" };

describe("formatVersionTag", () => {
  it("shows version, channel, commit and build date", () => {
    expect(formatVersionTag(BUILD)).toBe("v0.1.0 BETA · abc1234 · 2026-10-11");
  });

  it("omits an unknown build date", () => {
    expect(formatVersionTag({ ...BUILD, builtAt: "" })).toBe(
      "v0.1.0 BETA · abc1234",
    );
  });

  it("falls back to dev values when no build constants are injected (node)", () => {
    expect(BUILD_INFO.commit).toBe("dev");
  });
});

