/**
 * Bug reporting — opens a pre-filled GitHub issue in a new tab.
 * No backend required; works from a fully static (GitHub Pages) build.
 * The body names the exact build and carries the player's settings and the
 * last telemetry events (local only; the player sees all of it before
 * submitting, and the full log is in Settings › Advanced › EXPORT LOG).
 */

import { BUILD_INFO } from "../buildInfo";
import { loadSettings } from "../systems/SettingsStorage";
import { formatDiagnostics } from "../telemetry/diagnostics";
import { telemetryEvents } from "../telemetry/telemetry";

const REPO_URL = "https://github.com/jghiringhelli/shattered_stars";

export interface BugReportContext {
  /** Key of the scene the player was in when they hit "Report Bug". */
  readonly sceneKey: string;
}

/** Environment facts for the report body (injected for tests). */
export interface BugReportEnvironment {
  readonly userAgent: string;
  readonly timestamp: string;
  /** Build + settings + recent telemetry (see diagnostics.ts). */
  readonly diagnostics: string;
}

/**
 * @param context - Where the player was.
 * @param env - Browser, time and diagnostics.
 * @returns The pre-filled issue body (Markdown).
 */
export function buildIssueBody(
  context: BugReportContext,
  env: BugReportEnvironment,
): string {
  return [
    "**What happened?**",
    "",
    "**What did you expect instead?**",
    "",
    "**Steps to reproduce**",
    "1. ",
    "",
    "---",
    `Scene: ${context.sceneKey}`,
    `Browser: ${env.userAgent}`,
    `Timestamp: ${env.timestamp}`,
    "",
    "<details><summary>Diagnostics (build, settings, recent events)</summary>",
    "",
    env.diagnostics,
    "",
    "</details>",
  ].join("\n");
}

/** Opens github.com/.../issues/new with title/body/labels pre-filled. */
export function openBugReport(context: BugReportContext): void {
  const diagnostics = formatDiagnostics({
    build: BUILD_INFO,
    settings: loadSettings(),
    events: telemetryEvents(),
  });
  const params = new URLSearchParams({
    title: `[Bug] ${context.sceneKey}: `,
    body: buildIssueBody(context, {
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      diagnostics,
    }),
    labels: "bug",
  });
  window.open(
    `${REPO_URL}/issues/new?${params.toString()}`,
    "_blank",
    "noopener,noreferrer",
  );
}
