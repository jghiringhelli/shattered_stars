/**
 * Boot-time compatibility gate: decides whether the game may start and on
 * which renderer, and puts up the matching HTML notice (outside Phaser).
 */

import { detectSupport, type SupportReport } from "./browserSupport";
import {
  installDeviceNotices,
  showBlockedNotice,
  showSupportBanner,
} from "./compatNotice";
import { probeSupportEnvironment } from "./probeEnvironment";

/** What main.ts needs to start (or not start) Phaser. */
export interface BootDecision {
  /** False when the game must not be created (a blocking notice is up). */
  readonly start: boolean;
  /** Renderer to configure: Phaser's AUTO, or Canvas (forced or fallback). */
  readonly renderer: SupportReport["renderer"];
  readonly report: SupportReport;
}

declare global {
  interface Window {
    /** Set once src/compat ran; the index.html error guard stays quiet after it. */
    __ssBootStarted?: boolean;
  }
}

/**
 * Probe the browser, show any notice, and report the decision. Never throws.
 *
 * @param win - The page window (injectable for tests).
 * @returns Whether to start and with which renderer.
 */
export function prepareBoot(win: Window = window): BootDecision {
  const report = detectSupport(probeSupportEnvironment(win));
  win.__ssBootStarted = true;
  if (report.status === "blocked") {
    showBlockedNotice(win.document, report);
    return { start: false, renderer: report.renderer, report };
  }
  showSupportBanner(win.document, report);
  installDeviceNotices(win);
  return { start: true, renderer: report.renderer, report };
}
