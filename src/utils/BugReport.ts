/**
 * Bug reporting — opens a pre-filled GitHub issue in a new tab.
 * No backend required; works from a fully static (GitHub Pages) build.
 */

const REPO_URL = "https://github.com/jghiringhelli/shattered_stars";

export interface BugReportContext {
  /** Key of the scene the player was in when they hit "Report Bug". */
  readonly sceneKey: string;
}

function buildIssueBody(context: BugReportContext): string {
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
    `Browser: ${navigator.userAgent}`,
    `Timestamp: ${new Date().toISOString()}`,
  ].join("\n");
}

/** Opens github.com/.../issues/new with title/body/labels pre-filled. */
export function openBugReport(context: BugReportContext): void {
  const params = new URLSearchParams({
    title: `[Bug] ${context.sceneKey}: `,
    body: buildIssueBody(context),
    labels: "bug",
  });
  window.open(
    `${REPO_URL}/issues/new?${params.toString()}`,
    "_blank",
    "noopener,noreferrer",
  );
}
