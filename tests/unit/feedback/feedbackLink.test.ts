import { describe, expect, it } from "vitest";
import {
  DEFAULT_FEEDBACK_URL,
  buildFeedbackLink,
  bundleFileName,
  resolveFeedbackBase,
} from "../../../src/feedback/feedbackLink";
import { describeScene } from "../../../src/feedback/sceneModes";

const FIELDS = {
  kind: "balance" as const,
  versionTag: "v0.1.0 BETA · abc1234 · 2026-10-14",
  commit: "abc1234",
  mode: "dogfight",
  sceneKey: "DogfightScene",
  fileName: "shattered-stars-feedback-abc1234-20261014-120000.json",
};

describe("resolveFeedbackBase", () => {
  it("defaults to the GitHub new-issue page", () => {
    expect(resolveFeedbackBase(undefined)).toBe(DEFAULT_FEEDBACK_URL);
    expect(resolveFeedbackBase("   ")).toBe(DEFAULT_FEEDBACK_URL);
    expect(DEFAULT_FEEDBACK_URL).toBe(
      "https://github.com/jghiringhelli/shattered_stars/issues/new",
    );
  });

  it("accepts a configured https form URL", () => {
    expect(resolveFeedbackBase("https://forms.example.com/f/1")).toBe(
      "https://forms.example.com/f/1",
    );
  });

  it("rejects non-http(s) schemes", () => {
    expect(resolveFeedbackBase("javascript:alert(1)")).toBe(
      DEFAULT_FEEDBACK_URL,
    );
    expect(resolveFeedbackBase("not a url")).toBe(DEFAULT_FEEDBACK_URL);
  });
});

describe("buildFeedbackLink", () => {
  it("prefills a GitHub issue with version, mode and the attach instruction", () => {
    const link = new URL(buildFeedbackLink(DEFAULT_FEEDBACK_URL, FIELDS));
    expect(link.origin + link.pathname).toBe(DEFAULT_FEEDBACK_URL);
    expect(link.searchParams.get("title")).toMatch(/^\[Balance\] dogfight: /);
    const body = link.searchParams.get("body") ?? "";
    expect(body).toContain("v0.1.0 BETA");
    expect(body).toContain("dogfight");
    expect(body).toContain(FIELDS.fileName);
    expect(body).toMatch(/attach|drag/i);
    expect(link.searchParams.get("labels")).toBe("balance");
  });

  it("keeps the URL short enough for GitHub", () => {
    expect(buildFeedbackLink(DEFAULT_FEEDBACK_URL, FIELDS).length).toBeLessThan(
      2000,
    );
  });

  it("fills placeholders of a custom form URL, encoded", () => {
    const url = buildFeedbackLink(
      "https://forms.example.com/f?v={version}&m={mode}&k={kind}&t={title}",
      FIELDS,
    );
    expect(url).toContain("m=dogfight");
    expect(url).toContain("k=balance");
    expect(url).toContain(`v=${encodeURIComponent(FIELDS.versionTag)}`);
    expect(url).not.toContain("{");
  });

  it("opens a custom URL without placeholders unchanged", () => {
    expect(buildFeedbackLink("https://forms.example.com/f/1", FIELDS)).toBe(
      "https://forms.example.com/f/1",
    );
  });
});

describe("bundleFileName", () => {
  it("is stable and filesystem-safe", () => {
    expect(bundleFileName("abc1234", Date.UTC(2026, 9, 14, 12, 0, 0))).toBe(
      "shattered-stars-feedback-abc1234-20261014-120000.json",
    );
    expect(bundleFileName("we ird/../x", 0)).toMatch(/^[a-z0-9._-]+$/);
  });
});

describe("describeScene", () => {
  it("maps battle scenes to a mode and falls back to the scene key", () => {
    expect(describeScene("DogfightScene")).toBe("dogfight");
    expect(describeScene("SurvivalScene")).toBe("survival");
    expect(describeScene("MainMenuScene")).toBe("menu");
    expect(describeScene("SomethingNewScene")).toBe("SomethingNewScene");
  });
});
