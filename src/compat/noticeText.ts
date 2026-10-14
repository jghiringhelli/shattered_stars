/**
 * Copy for the compatibility notices (pure strings, no DOM). The static
 * fallback text in index.html repeats the minimum versions; a unit test keeps
 * the two in step.
 */

import {
  BROWSER_DISPLAY_NAMES,
  MIN_BROWSER_VERSIONS,
  type SupportReport,
} from "./browserSupport";

/** One-time notice on phones / tablets without a mouse. */
export const DEVICE_NOTICE_TEXT =
  "Shattered Stars is built for desktop browsers with a keyboard or gamepad. " +
  "Phones are not supported in this beta: touch flight controls are experimental " +
  "(no squad mark, target or weapon cycling) and the HUD text is tiny. " +
  "You can continue anyway.";

/** Shown while a touch / small device is held in portrait. */
export const ROTATE_HINT_TEXT =
  "Rotate your device to landscape: Shattered Stars is a widescreen game.";

/** @returns "Chrome 90, Edge 90, Firefox 90, Safari 15". */
export function minimumVersionsText(): string {
  return (Object.keys(MIN_BROWSER_VERSIONS) as Array<keyof typeof MIN_BROWSER_VERSIONS>)
    .map((family) => `${BROWSER_DISPLAY_NAMES[family]} ${MIN_BROWSER_VERSIONS[family]}`)
    .join(", ");
}

/**
 * @param report - A support report.
 * @returns "Chrome 89" style label, or "an unrecognised browser".
 */
function browserLabel(report: SupportReport): string {
  const { family, major } = report.browser;
  if (family === "other") return "an unrecognised browser";
  return `${BROWSER_DISPLAY_NAMES[family]} ${major}`;
}

/**
 * @param report - A blocked support report.
 * @returns The sentence(s) saying what this browser is missing.
 */
export function blockedDetailFor(report: SupportReport): string {
  const parts = [`Detected: ${browserLabel(report)}.`];
  if (report.reasons.includes("no-renderer")) {
    parts.push("Graphics are unavailable: neither WebGL nor Canvas 2D could be created.");
  }
  if (report.reasons.includes("missing-apis")) {
    parts.push(`Missing browser features: ${report.missingApis.join(", ")}.`);
  }
  return parts.join(" ");
}

/**
 * @param report - A non-blocked support report.
 * @returns Text for the non-blocking banner, "" when nothing needs saying.
 */
export function bannerTextFor(report: SupportReport): string {
  if (report.status === "compat-canvas") {
    return (
      "Running in compatibility mode (WebGL is unavailable), so the game may be slower. " +
      "Turn on hardware acceleration in your browser settings for the best experience."
    );
  }
  if (report.status === "outdated") {
    return (
      `${browserLabel(report)} is older than the tested minimum (${minimumVersionsText()}). ` +
      "The game may not work correctly; please update your browser."
    );
  }
  return "";
}
