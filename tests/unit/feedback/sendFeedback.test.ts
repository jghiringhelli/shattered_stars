import { describe, expect, it } from "vitest";
import {
  activeSceneKeys,
  collectEnvironment,
} from "../../../src/feedback/feedbackEnvironment";
import {
  sendFeedback,
  type FeedbackEffects,
} from "../../../src/feedback/sendFeedback";

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0);

function recorder(configuredUrl?: string) {
  const downloads: Array<{ name: string; text: string }> = [];
  const opened: string[] = [];
  const effects: FeedbackEffects = {
    download: (name, text) => downloads.push({ name, text }),
    open: (url) => opened.push(url),
    now: () => NOW,
    readEnvironment: () => ({
      userAgent: "UA",
      language: "en",
      screen: { width: 1, height: 1, pixelRatio: 1 },
      viewport: { width: 1, height: 1 },
      renderer: "unknown",
      gpu: null,
      fps: null,
      touch: false,
      hardwareConcurrency: null,
    }),
    configuredUrl,
  };
  return { downloads, opened, effects };
}

const REQUEST = {
  kind: "bug" as const,
  note: "boost stuck",
  sceneKey: "DogfightScene",
  game: undefined,
};

describe("sendFeedback", () => {
  it("DOWNLOAD ONLY saves one parseable bundle and opens nothing", () => {
    const { downloads, opened, effects } = recorder();
    const result = sendFeedback({ ...REQUEST, openForm: false }, effects);
    expect(opened).toEqual([]);
    expect(downloads).toHaveLength(1);
    expect(downloads[0]?.name).toBe(result.fileName);
    const bundle = JSON.parse(downloads[0]?.text ?? "{}") as {
      format: string;
      context: { mode: string };
      note: string;
    };
    expect(bundle.format).toBe("shattered-stars-feedback");
    expect(bundle.context.mode).toBe("dogfight");
    expect(bundle.note).toBe("boost stuck");
    expect(result.openedUrl).toBeNull();
  });

  it("SEND saves the bundle and opens the GitHub issue naming that file", () => {
    const { downloads, opened, effects } = recorder();
    const result = sendFeedback({ ...REQUEST, openForm: true }, effects);
    expect(downloads).toHaveLength(1);
    expect(opened).toHaveLength(1);
    const url = new URL(opened[0] ?? "");
    expect(url.pathname).toBe("/jghiringhelli/shattered_stars/issues/new");
    expect(url.searchParams.get("body")).toContain(result.fileName);
  });

  it("uses a configured form URL instead of GitHub", () => {
    const { opened, effects } = recorder(
      "https://forms.example.com/f?m={mode}&k={kind}",
    );
    sendFeedback({ ...REQUEST, kind: "idea", openForm: true }, effects);
    expect(opened[0]).toBe("https://forms.example.com/f?m=dogfight&k=idea");
  });

  it("falls back to GitHub when the configured URL is not http(s)", () => {
    const { opened, effects } = recorder("javascript:alert(1)");
    sendFeedback({ ...REQUEST, openForm: true }, effects);
    expect(opened[0]).toMatch(/^https:\/\/github\.com\//);
  });
});

describe("collectEnvironment", () => {
  const win = {
    navigator: {
      userAgent: "UA",
      language: "en-GB",
      maxTouchPoints: 0,
      hardwareConcurrency: 8,
    },
    screen: { width: 1920, height: 1080 },
    devicePixelRatio: 1.25,
    innerWidth: 1280,
    innerHeight: 720,
  } as unknown as Window;

  it("reads browser, screen and FPS facts", () => {
    const env = collectEnvironment(
      { loop: { actualFps: 59.46 }, renderer: { type: 1 } },
      win,
    );
    expect(env).toMatchObject({
      userAgent: "UA",
      renderer: "canvas",
      fps: 59.5,
      touch: false,
      gpu: null,
      viewport: { width: 1280, height: 720 },
    });
  });

  it("reports unknown renderer and no FPS before the game exists", () => {
    const env = collectEnvironment(undefined, win);
    expect(env.renderer).toBe("unknown");
    expect(env.fps).toBeNull();
  });

  it("lists the running scenes", () => {
    const game = {
      scene: {
        getScenes: () => [{ scene: { key: "A" } }, { scene: { key: "B" } }],
      },
    };
    expect(activeSceneKeys(game)).toEqual(["A", "B"]);
    expect(activeSceneKeys(undefined)).toEqual([]);
  });
});
