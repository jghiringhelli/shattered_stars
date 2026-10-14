/**
 * Where "Send feedback" goes. The default is the repository's GitHub new-issue
 * page, prefilled with the build, the mode and the instruction to attach the
 * downloaded bundle. `VITE_FEEDBACK_URL` can point at any form instead: the
 * placeholders {version} {commit} {mode} {scene} {kind} {title} {body} in it
 * are replaced with URL-encoded values.
 */

import type { FeedbackKind } from "./feedbackBundle";

/** Repository that receives feedback by default. */
export const FEEDBACK_REPO_URL =
  "https://github.com/jghiringhelli/shattered_stars";
/** GitHub's new-issue page of that repository. */
export const DEFAULT_FEEDBACK_URL = `${FEEDBACK_REPO_URL}/issues/new`;
/** Width of the zero-padded date and time parts of the file name. */
const TWO_DIGITS = 2;

/** Human label and GitHub label of each kind of feedback. */
export const FEEDBACK_KINDS: Readonly<
  Record<FeedbackKind, { readonly title: string; readonly label: string }>
> = {
  bug: { title: "Bug", label: "bug" },
  balance: { title: "Balance", label: "balance" },
  ui_ux: { title: "UI/UX", label: "ui-ux" },
  idea: { title: "Idea", label: "enhancement" },
};

/** What the link needs to know about the report. */
export interface FeedbackLinkFields {
  readonly kind: FeedbackKind;
  readonly versionTag: string;
  readonly commit: string;
  readonly mode: string;
  readonly sceneKey: string;
  /** Name of the downloaded bundle the user should attach. */
  readonly fileName: string;
}

/**
 * @param configured - Raw `VITE_FEEDBACK_URL` (may be empty or missing).
 * @returns The configured http(s) URL, else the GitHub new-issue page.
 */
export function resolveFeedbackBase(configured: string | undefined): string {
  const candidate = configured?.trim() ?? "";
  if (candidate === "") return DEFAULT_FEEDBACK_URL;
  try {
    const protocol = new URL(candidate.replace(/\{\w+\}/g, "x")).protocol;
    return protocol === "https:" || protocol === "http:"
      ? candidate
      : DEFAULT_FEEDBACK_URL;
  } catch {
    return DEFAULT_FEEDBACK_URL;
  }
}

/** @returns The prefilled body of a GitHub issue. */
function issueBody(fields: FeedbackLinkFields): string {
  return [
    "**What happened / what do you think?**",
    "",
    "",
    "**What did you expect instead? (bugs)**",
    "",
    "",
    "---",
    `Build: ${fields.versionTag}`,
    `Mode: ${fields.mode} (${fields.sceneKey})`,
    "",
    `Attach the file **${fields.fileName}** that the game just downloaded (drag it into this box). It has your settings, recent local events and browser info. Nothing was sent automatically.`,
  ].join("\n");
}

/**
 * @param base - A URL from {@link resolveFeedbackBase}.
 * @param fields - Kind, build, mode and bundle file name.
 * @returns The URL to open in a new tab.
 */
export function buildFeedbackLink(
  base: string,
  fields: FeedbackLinkFields,
): string {
  const kind = FEEDBACK_KINDS[fields.kind];
  const title = `[${kind.title}] ${fields.mode}: `;
  if (/\{\w+\}/.test(base)) {
    const values: Record<string, string> = {
      version: fields.versionTag,
      commit: fields.commit,
      mode: fields.mode,
      scene: fields.sceneKey,
      kind: fields.kind,
      title,
      body: issueBody(fields),
    };
    return base.replace(/\{(\w+)\}/g, (_, name: string) =>
      encodeURIComponent(values[name] ?? ""),
    );
  }
  if (base !== DEFAULT_FEEDBACK_URL) return base;
  const params = new URLSearchParams({
    title,
    body: issueBody(fields),
    labels: kind.label,
  });
  return `${base}?${params.toString()}`;
}

/**
 * @param commit - Build commit (made filesystem-safe).
 * @param epochMs - Time of the report.
 * @returns e.g. "shattered-stars-feedback-abc1234-20261014-120000.json".
 */
export function bundleFileName(commit: string, epochMs: number): string {
  const safeCommit = commit.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const d = new Date(epochMs);
  const pad = (n: number): string => String(n).padStart(TWO_DIGITS, "0");
  const day = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  const time = `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  return `shattered-stars-feedback-${safeCommit}-${day}-${time}.json`;
}
