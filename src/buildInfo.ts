/**
 * Build identification — version from package.json, git short SHA and build
 * date, injected at build time by vite.config.ts (`define`). Shown in the
 * main-menu corner and attached to bug reports and telemetry exports, so a
 * report always names the exact build it came from.
 */

/** Identifies one build of the game. */
export interface BuildInfo {
  /** package.json version, e.g. "0.1.0". */
  readonly version: string;
  /** Short git commit SHA ("dev" outside a Vite build). */
  readonly commit: string;
  /** Build date (YYYY-MM-DD), empty when unknown. */
  readonly builtAt: string;
}

/** Release channel shown next to the version. */
export const RELEASE_CHANNEL = "ALPHA";

/** This build (dev fallbacks in node tests, where nothing is injected). */
export const BUILD_INFO: BuildInfo = {
  version: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0",
  commit: typeof __GIT_SHA__ === "string" ? __GIT_SHA__ : "dev",
  builtAt: typeof __BUILD_DATE__ === "string" ? __BUILD_DATE__ : "",
};

/**
 * @param info - A build.
 * @returns e.g. "v0.1.0 ALPHA · 7548cff · 2026-10-11".
 */
export function formatVersionTag(info: BuildInfo): string {
  return [`v${info.version} ${RELEASE_CHANNEL}`, info.commit, info.builtAt]
    .filter((part) => part.length > 0)
    .join(" · ");
}
