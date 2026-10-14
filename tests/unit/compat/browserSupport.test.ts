import { describe, expect, it } from "vitest";
import {
  detectSupport,
  MIN_BROWSER_VERSIONS,
  parseBrowser,
  REQUIRED_API_NAMES,
  type SupportEnvironment,
} from "../../../src/compat/browserSupport";

const UA = {
  chrome120:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  chrome89:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36",
  headless:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36",
  edge110:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Edg/110.0.1587.50",
  firefox89:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
  firefox130:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0",
  safari14:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15",
  safari17:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  iosChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1",
  iosSafari16:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1",
  opera:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 OPR/104.0.0.0",
  samsung:
    "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
  ie11: "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko",
  unknown: "SomeCustomEngine/1.0",
} as const;

const ALL_APIS = Object.fromEntries(
  REQUIRED_API_NAMES.map((name) => [name, true]),
) as Record<string, boolean>;

function env(over: Partial<SupportEnvironment> = {}): SupportEnvironment {
  return {
    userAgent: UA.chrome120,
    webgl: true,
    canvas2d: true,
    apis: ALL_APIS,
    forceCanvas: false,
    ...over,
  };
}

describe("parseBrowser", () => {
  it.each([
    [UA.chrome120, "chrome", 120],
    [UA.headless, "chrome", 141],
    [UA.edge110, "edge", 110],
    [UA.firefox130, "firefox", 130],
    [UA.safari17, "safari", 17],
    [UA.opera, "chrome", 118],
    [UA.samsung, "chrome", 115],
  ])("reads %s as %s %i", (ua, family, major) => {
    expect(parseBrowser(ua)).toEqual({ family, major });
  });

  it("reports Chrome on iOS by its iOS version because it runs WebKit", () => {
    expect(parseBrowser(UA.iosChrome)).toEqual({ family: "safari", major: 14 });
  });

  it("reads Safari on iOS by its Version token", () => {
    expect(parseBrowser(UA.iosSafari16)).toEqual({ family: "safari", major: 16 });
  });

  it("treats Internet Explorer and unknown agents as other with no version", () => {
    expect(parseBrowser(UA.ie11)).toEqual({ family: "other", major: 0 });
    expect(parseBrowser(UA.unknown)).toEqual({ family: "other", major: 0 });
    expect(parseBrowser("")).toEqual({ family: "other", major: 0 });
  });
});

describe("MIN_BROWSER_VERSIONS", () => {
  it("matches the ES2020 build target floor", () => {
    expect(MIN_BROWSER_VERSIONS).toEqual({ chrome: 90, edge: 90, firefox: 90, safari: 15 });
  });
});

describe("detectSupport", () => {
  it("passes a modern browser with WebGL and lets Phaser pick the renderer", () => {
    expect(detectSupport(env())).toMatchObject({
      status: "ok",
      renderer: "auto",
      reasons: [],
    });
  });

  it("falls back to Canvas when WebGL is missing but Canvas 2D works", () => {
    expect(detectSupport(env({ webgl: false }))).toMatchObject({
      status: "compat-canvas",
      renderer: "canvas",
      reasons: ["webgl-missing"],
    });
  });

  it("blocks when neither WebGL nor Canvas 2D exist", () => {
    expect(detectSupport(env({ webgl: false, canvas2d: false }))).toMatchObject({
      status: "blocked",
      reasons: ["no-renderer"],
    });
  });

  it("blocks and names every required API that is missing", () => {
    const report = detectSupport(env({ apis: { ...ALL_APIS, "Promise.allSettled": false } }));
    expect(report.status).toBe("blocked");
    expect(report.reasons).toEqual(["missing-apis"]);
    expect(report.missingApis).toEqual(["Promise.allSettled"]);
  });

  it("warns, without blocking, on a browser older than the minimum", () => {
    expect(detectSupport(env({ userAgent: UA.chrome89 }))).toMatchObject({
      status: "outdated",
      renderer: "auto",
      reasons: ["browser-outdated"],
    });
    expect(detectSupport(env({ userAgent: UA.safari14 })).status).toBe("outdated");
    expect(detectSupport(env({ userAgent: UA.firefox89 })).status).toBe("outdated");
    expect(detectSupport(env({ userAgent: UA.iosChrome })).status).toBe("outdated");
  });

  it("accepts browsers exactly at the minimum version", () => {
    expect(detectSupport(env({ userAgent: UA.firefox130 })).status).toBe("ok");
    const chrome90 = UA.chrome120.replace("Chrome/120", "Chrome/90");
    expect(detectSupport(env({ userAgent: chrome90 })).status).toBe("ok");
  });

  it("never blocks on an unrecognised agent whose APIs are all present", () => {
    expect(detectSupport(env({ userAgent: UA.unknown })).status).toBe("ok");
  });

  it("keeps Canvas forced (?renderer=canvas, webdriver) silent when WebGL is absent or unprobed", () => {
    expect(detectSupport(env({ forceCanvas: true, webgl: false }))).toMatchObject({
      status: "ok",
      renderer: "canvas",
      reasons: [],
    });
  });

  it("still blocks a forced-Canvas run whose Canvas 2D is missing", () => {
    expect(detectSupport(env({ forceCanvas: true, canvas2d: false })).status).toBe("blocked");
  });

  it("reports the parsed browser and the minimums for the notice text", () => {
    const report = detectSupport(env({ userAgent: UA.chrome89 }));
    expect(report.browser).toEqual({ family: "chrome", major: 89 });
    expect(report.minimums).toBe(MIN_BROWSER_VERSIONS);
  });

  it("lists outdated-browser alongside a Canvas fallback", () => {
    const report = detectSupport(env({ userAgent: UA.chrome89, webgl: false }));
    expect(report.status).toBe("compat-canvas");
    expect(report.reasons).toEqual(["webgl-missing", "browser-outdated"]);
  });
});
