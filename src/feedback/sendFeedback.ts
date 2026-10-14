/**
 * Send feedback: on the player's click only, build the bundle, save it
 * through the browser's download flow and open the prefilled issue (or the
 * configured form). Nothing is uploaded by the game itself.
 */

import { BUILD_INFO, formatVersionTag } from "../buildInfo";
import { isTelemetryEnabled, loadSettings } from "../systems/SettingsStorage";
import { telemetryEvents } from "../telemetry/telemetry";
import { downloadTextFile } from "../ui/settings/downloadFile";
import {
  serializeFeedbackBundle,
  type FeedbackEnvironment,
  type FeedbackKind,
} from "./feedbackBundle";
import {
  activeSceneKeys,
  collectEnvironment,
  type FeedbackGame,
} from "./feedbackEnvironment";
import {
  buildFeedbackLink,
  bundleFileName,
  resolveFeedbackBase,
} from "./feedbackLink";
import { describeScene } from "./sceneModes";

/** What the player asked for. */
export interface FeedbackRequest {
  readonly kind: FeedbackKind;
  readonly note: string;
  /** Scene the player was in. */
  readonly sceneKey: string;
  readonly game: FeedbackGame | undefined;
  /** Whether to open the issue/form page after the download. */
  readonly openForm: boolean;
}

/** Side effects, injectable for tests. */
export interface FeedbackEffects {
  readonly download: (fileName: string, text: string) => void;
  readonly open: (url: string) => void;
  readonly now: () => number;
  /** Browser, screen, renderer and FPS facts. */
  readonly readEnvironment: (
    game: FeedbackGame | undefined,
  ) => FeedbackEnvironment;
  /** Raw VITE_FEEDBACK_URL. */
  readonly configuredUrl: string | undefined;
}

/** Result shown to the player. */
export interface FeedbackResult {
  readonly fileName: string;
  readonly truncated: boolean;
  readonly openedUrl: string | null;
}

/** @returns The effects of the running page. */
export function pageEffects(): FeedbackEffects {
  return {
    download: (name, text) => downloadTextFile(name, text),
    open: (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    now: () => Date.now(),
    readEnvironment: (game) => collectEnvironment(game),
    configuredUrl: import.meta.env.VITE_FEEDBACK_URL as string | undefined,
  };
}

/**
 * @param request - Kind, note, scene and what to do.
 * @param effects - Download/open/clock (defaults to the page).
 * @returns What was saved and opened.
 */
export function sendFeedback(
  request: FeedbackRequest,
  effects: FeedbackEffects = pageEffects(),
): FeedbackResult {
  const now = effects.now();
  const bundle = serializeFeedbackBundle({
    build: BUILD_INFO,
    kind: request.kind,
    note: request.note,
    context: {
      sceneKey: request.sceneKey,
      activeScenes: activeSceneKeys(request.game),
    },
    environment: effects.readEnvironment(request.game),
    settings: loadSettings(),
    telemetryEnabled: isTelemetryEnabled(),
    events: telemetryEvents(),
    now,
  });
  const fileName = bundleFileName(BUILD_INFO.commit, now);
  effects.download(fileName, bundle.json);
  if (!request.openForm) {
    return { fileName, truncated: bundle.truncated, openedUrl: null };
  }
  const url = buildFeedbackLink(resolveFeedbackBase(effects.configuredUrl), {
    kind: request.kind,
    versionTag: formatVersionTag(BUILD_INFO),
    commit: BUILD_INFO.commit,
    mode: describeScene(request.sceneKey),
    sceneKey: request.sceneKey,
    fileName,
  });
  effects.open(url);
  return { fileName, truncated: bundle.truncated, openedUrl: url };
}
