/**
 * Browser support detection (pure): which browser is this, can it draw, and
 * does it have the APIs the ES2020 build relies on? The impure probing of a
 * real window lives in probeEnvironment.ts; everything here takes plain data
 * so it can be tested in node.
 */

/** Browser families the support table knows. `other` = unknown / unsupported engine. */
export type BrowserFamily = "chrome" | "edge" | "firefox" | "safari" | "other";

/** A parsed user agent. `major` is 0 when the version is unknown. */
export interface BrowserInfo {
  readonly family: BrowserFamily;
  readonly major: number;
}

/** Oldest browser majors that run the ES2020 build (vite `build.target`). */
export const MIN_BROWSER_VERSIONS: Readonly<
  Record<Exclude<BrowserFamily, "other">, number>
> = { chrome: 90, edge: 90, firefox: 90, safari: 15 };

/** Display names for the notices. */
export const BROWSER_DISPLAY_NAMES: Readonly<
  Record<Exclude<BrowserFamily, "other">, string>
> = {
  chrome: "Chrome",
  edge: "Edge",
  firefox: "Firefox",
  safari: "Safari",
};

/** Globals the game cannot start without (ES2020 library + frame loop). */
export const REQUIRED_API_NAMES: readonly string[] = [
  "requestAnimationFrame",
  "Promise.allSettled",
  "globalThis",
  "String.prototype.matchAll",
  "BigInt",
  "Float32Array",
];

/** Why support is degraded or missing. */
export type SupportReason =
  | "no-renderer"
  | "missing-apis"
  | "webgl-missing"
  | "browser-outdated";

/**
 * ok — start normally; compat-canvas — start on Canvas with a notice;
 * outdated — start with a dismissible warning; blocked — do not start.
 */
export type SupportStatus = "ok" | "compat-canvas" | "outdated" | "blocked";

/** Everything the decision needs, gathered by probeEnvironment. */
export interface SupportEnvironment {
  readonly userAgent: string;
  /** A WebGL context could be created (not probed when Canvas is forced). */
  readonly webgl: boolean;
  /** A 2D canvas context could be created. */
  readonly canvas2d: boolean;
  /** Presence of each REQUIRED_API_NAMES entry. */
  readonly apis: Readonly<Record<string, boolean>>;
  /** `?renderer=canvas` or an automation driver: Canvas is a choice, not a fallback. */
  readonly forceCanvas: boolean;
}

/** The outcome of {@link detectSupport}. */
export interface SupportReport {
  readonly status: SupportStatus;
  readonly renderer: "auto" | "canvas";
  readonly reasons: readonly SupportReason[];
  readonly missingApis: readonly string[];
  readonly browser: BrowserInfo;
  readonly minimums: typeof MIN_BROWSER_VERSIONS;
}

const OTHER: BrowserInfo = { family: "other", major: 0 };
const IOS_DEVICE = /iPhone|iPad|iPod/;
const IOS_VERSION = /OS (\d+)[_.]/;

/**
 * @param userAgent - `navigator.userAgent`.
 * @param pattern - Regex with the major version as its first group.
 * @returns The major version, or 0 when absent.
 */
function majorOf(userAgent: string, pattern: RegExp): number {
  const match = pattern.exec(userAgent);
  return match?.[1] ? Number.parseInt(match[1], 10) : 0;
}

/**
 * Parse a user agent into a family and major version. Chromium forks (Opera,
 * Samsung Internet, Brave) report as Chrome with the Chromium version; every
 * browser on iOS runs WebKit, so it reports as Safari with the iOS version.
 *
 * @param userAgent - `navigator.userAgent`.
 * @returns The family and major version.
 */
export function parseBrowser(userAgent: string): BrowserInfo {
  if (/Trident|MSIE/.test(userAgent)) return OTHER;
  if (IOS_DEVICE.test(userAgent)) {
    const major =
      majorOf(userAgent, IOS_VERSION) || majorOf(userAgent, /Version\/(\d+)/);
    return { family: "safari", major };
  }
  if (/\bEdg(?:e|A|iOS)?\//.test(userAgent)) {
    return { family: "edge", major: majorOf(userAgent, /\bEdg(?:e|A|iOS)?\/(\d+)/) };
  }
  if (/Firefox\//.test(userAgent)) {
    return { family: "firefox", major: majorOf(userAgent, /Firefox\/(\d+)/) };
  }
  if (/(?:Chrome|Chromium)\//.test(userAgent)) {
    return { family: "chrome", major: majorOf(userAgent, /(?:Chrome|Chromium)\/(\d+)/) };
  }
  if (/Version\/\d+.*Safari\//.test(userAgent)) {
    return { family: "safari", major: majorOf(userAgent, /Version\/(\d+)/) };
  }
  return OTHER;
}

/**
 * @param browser - Parsed browser.
 * @returns True when the browser is known and older than its minimum.
 */
function isOutdated(browser: BrowserInfo): boolean {
  if (browser.family === "other") return false;
  return browser.major < MIN_BROWSER_VERSIONS[browser.family];
}

/**
 * Decide whether the game can start, and on which renderer.
 *
 * Only a missing renderer or missing required API blocks: a version below the
 * minimum only warns, because user agents lie and the API probe is the real test.
 *
 * @param env - Probed facts about the browser.
 * @returns The status, renderer choice and reasons.
 */
export function detectSupport(env: SupportEnvironment): SupportReport {
  const browser = parseBrowser(env.userAgent);
  const missingApis = REQUIRED_API_NAMES.filter((name) => env.apis[name] !== true);
  const reasons: SupportReason[] = [];
  // Phaser draws all text and generated textures through Canvas 2D, even on WebGL.
  if (!env.canvas2d) reasons.push("no-renderer");
  if (missingApis.length > 0) reasons.push("missing-apis");
  const blocked = reasons.length > 0;
  const webglFallback = !blocked && !env.forceCanvas && !env.webgl;
  if (webglFallback) reasons.push("webgl-missing");
  if (isOutdated(browser)) reasons.push("browser-outdated");
  const renderer = env.forceCanvas || webglFallback ? "canvas" : "auto";
  return {
    status: statusFor(blocked, webglFallback, reasons),
    renderer,
    reasons,
    missingApis,
    browser,
    minimums: MIN_BROWSER_VERSIONS,
  };
}

/**
 * @param blocked - A hard requirement is missing.
 * @param webglFallback - Running on Canvas because WebGL is unavailable.
 * @param reasons - All reasons found.
 * @returns The status to report.
 */
function statusFor(
  blocked: boolean,
  webglFallback: boolean,
  reasons: readonly SupportReason[],
): SupportStatus {
  if (blocked) return "blocked";
  if (webglFallback) return "compat-canvas";
  return reasons.includes("browser-outdated") ? "outdated" : "ok";
}
