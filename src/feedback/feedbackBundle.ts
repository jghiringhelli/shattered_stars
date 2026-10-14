/**
 * The feedback bundle: one JSON document a tester downloads and attaches to
 * an issue — build, settings, browser/GPU/FPS facts, the last local telemetry
 * events and match summaries, and an optional note. Built only when the
 * player asks for it; nothing is sent anywhere. Pure and deterministic: the
 * caller gathers the inputs (including the clock).
 */

import {
  formatVersionTag,
  RELEASE_CHANNEL,
  type BuildInfo,
} from "../buildInfo";
import type { TelemetryEvent } from "../telemetry/TelemetryLog";
import { redactDeep, redactString } from "./redaction";
import { describeScene } from "./sceneModes";

/** Document identification. */
export const FEEDBACK_BUNDLE_FORMAT = "shattered-stars-feedback";
export const FEEDBACK_BUNDLE_VERSION = 1;
/** Hard cap on the serialized bundle (bytes). */
export const FEEDBACK_MAX_BYTES = 128 * 1024;
/** Most recent telemetry events carried. */
export const FEEDBACK_MAX_EVENTS = 100;
/** Most recent match summaries carried (also present among the events). */
export const FEEDBACK_MAX_MATCH_SUMMARIES = 10;
/** Longest free-text note (characters). */
export const FEEDBACK_MAX_NOTE_CHARS = 2000;
/** Said inside every bundle. */
export const FEEDBACK_PRIVACY_STATEMENT =
  "Created on request only. Nothing is sent automatically: you attach this file yourself. It holds no account, name or e-mail; credential-like text is removed.";
const INDENT = 2;
const SETTINGS_OMITTED = "[omitted: bundle too large]";

/** Kinds of feedback (mirrors the GitHub issue templates). */
export type FeedbackKind = "bug" | "balance" | "ui_ux" | "idea";

/** Browser and machine facts (no personal data). */
export interface FeedbackEnvironment {
  readonly userAgent: string;
  readonly language: string;
  readonly screen: {
    readonly width: number;
    readonly height: number;
    readonly pixelRatio: number;
  };
  readonly viewport: { readonly width: number; readonly height: number };
  readonly renderer: "webgl" | "canvas" | "unknown";
  /** Unmasked GPU renderer string when the browser exposes it. */
  readonly gpu: string | null;
  /** Phaser's smoothed frames per second at the moment of the report. */
  readonly fps: number | null;
  readonly touch: boolean;
  readonly hardwareConcurrency: number | null;
}

/** Where the player was. */
export interface FeedbackContext {
  readonly sceneKey: string;
  readonly activeScenes: readonly string[];
  /** Mode name; derived from the scene key when omitted. */
  readonly mode?: string;
}

/** Everything the builder needs. */
export interface FeedbackInput {
  readonly build: BuildInfo;
  readonly kind: FeedbackKind;
  readonly note: string;
  readonly context: FeedbackContext;
  readonly environment: FeedbackEnvironment;
  readonly settings: unknown;
  /** Whether Settings › Advanced › Local telemetry is on. */
  readonly telemetryEnabled: boolean;
  readonly events: readonly TelemetryEvent[];
  /** Epoch ms of the report. */
  readonly now: number;
}

/** A serialized bundle. */
export interface SerializedFeedback {
  readonly json: string;
  /** Whether content was dropped to fit {@link FEEDBACK_MAX_BYTES}. */
  readonly truncated: boolean;
}

/** How much of each part one attempt keeps. */
interface Budget {
  readonly events: number;
  readonly summaries: number;
  readonly settings: boolean;
}

/** Attempts from fullest to smallest. */
const BUDGETS: readonly Budget[] = [
  {
    events: FEEDBACK_MAX_EVENTS,
    summaries: FEEDBACK_MAX_MATCH_SUMMARIES,
    settings: true,
  },
  { events: 50, summaries: FEEDBACK_MAX_MATCH_SUMMARIES, settings: true },
  { events: 20, summaries: 5, settings: true },
  { events: 5, summaries: 2, settings: true },
  { events: 0, summaries: 0, settings: true },
  { events: 0, summaries: 0, settings: false },
];

/** @returns The document for one budget, keys in fixed order. */
function assemble(
  input: FeedbackInput,
  budget: Budget,
  truncated: boolean,
): Record<string, unknown> {
  const events = input.events.slice(-budget.events);
  const summaries = input.events
    .filter((event) => event.type === "match_summary")
    .slice(-budget.summaries)
    .map((event) => event.data);
  return {
    format: FEEDBACK_BUNDLE_FORMAT,
    version: FEEDBACK_BUNDLE_VERSION,
    generatedAt: new Date(input.now).toISOString(),
    kind: input.kind,
    build: {
      ...input.build,
      channel: RELEASE_CHANNEL,
      tag: formatVersionTag(input.build),
    },
    context: {
      sceneKey: input.context.sceneKey,
      mode: input.context.mode ?? describeScene(input.context.sceneKey),
      activeScenes: input.context.activeScenes,
    },
    environment: redactDeep(input.environment),
    settings: budget.settings ? redactDeep(input.settings) : SETTINGS_OMITTED,
    telemetry: {
      enabled: input.telemetryEnabled,
      eventCount: input.events.length,
      events: redactDeep(events),
    },
    matchSummaries: redactDeep(summaries),
    note: redactString(input.note).slice(0, FEEDBACK_MAX_NOTE_CHARS),
    privacy: FEEDBACK_PRIVACY_STATEMENT,
    truncated,
  };
}

/** @returns UTF-8 byte length. */
function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * @param input - Build, context, environment, settings and telemetry.
 * @returns The bundle JSON, within {@link FEEDBACK_MAX_BYTES}: the oldest
 *   events go first, then summaries, then the settings.
 */
export function serializeFeedbackBundle(
  input: FeedbackInput,
): SerializedFeedback {
  let json = "";
  for (const [index, budget] of BUDGETS.entries()) {
    json = JSON.stringify(assemble(input, budget, index > 0), null, INDENT);
    if (byteLength(json) <= FEEDBACK_MAX_BYTES) {
      return { json, truncated: index > 0 };
    }
  }
  return { json, truncated: true };
}
