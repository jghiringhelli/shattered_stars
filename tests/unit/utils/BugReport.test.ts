/**
 * BugReport Tests
 *
 * Tests for the pre-filled GitHub issue link builder.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { openBugReport } from "../../../src/utils/BugReport";

describe("openBugReport", () => {
  let openSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    openSpy = vi.fn();
    vi.stubGlobal("window", { open: openSpy });
    vi.stubGlobal("navigator", { userAgent: "test-agent" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens a new tab pointed at the repo's issues/new endpoint", () => {
    openBugReport({ sceneKey: "MainMenuScene" });

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = openSpy.mock.calls[0];
    expect(url).toContain(
      "https://github.com/jghiringhelli/shattered_stars/issues/new?",
    );
    expect(target).toBe("_blank");
    expect(features).toBe("noopener,noreferrer");
  });

  it("includes the scene key in the pre-filled title", () => {
    openBugReport({ sceneKey: "EpicBattleScene" });

    const [url] = openSpy.mock.calls[0];
    const params = new URL(url).searchParams;
    expect(params.get("title")).toContain("EpicBattleScene");
  });

  it("includes the scene key and a repro-steps template in the body", () => {
    openBugReport({ sceneKey: "SurvivalScene" });

    const [url] = openSpy.mock.calls[0];
    const params = new URL(url).searchParams;
    const body = params.get("body") ?? "";
    expect(body).toContain("Scene: SurvivalScene");
    expect(body).toContain("Steps to reproduce");
  });

  it("tags the issue with the bug label", () => {
    openBugReport({ sceneKey: "DogfightScene" });

    const [url] = openSpy.mock.calls[0];
    const params = new URL(url).searchParams;
    expect(params.get("labels")).toBe("bug");
  });

  it("attaches the build, settings and recent telemetry to the body", () => {
    openBugReport({ sceneKey: "DogfightScene" });

    const [url] = openSpy.mock.calls[0];
    const body = new URL(url).searchParams.get("body") ?? "";
    expect(body).toContain("Build: v");
    expect(body).toContain("Settings:");
    expect(body).toContain("telemetry events:");
  });

  it("keeps the whole issue URL under GitHub's practical length limit", () => {
    openBugReport({ sceneKey: "DogfightScene" });

    const [url] = openSpy.mock.calls[0];
    expect((url as string).length).toBeLessThan(MAX_ISSUE_URL_LENGTH);
  });
});

/** github.com rejects new-issue URLs much past ~8 KB. */
const MAX_ISSUE_URL_LENGTH = 8000;
