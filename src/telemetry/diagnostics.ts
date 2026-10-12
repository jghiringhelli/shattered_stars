/**
 * Diagnostics attached to bug reports: the build, the player's settings and
 * the most recent local telemetry events, as compact text that fits in a
 * GitHub "new issue" URL. Pure — the caller gathers the inputs.
 */

import { formatVersionTag, type BuildInfo } from "../buildInfo";
import type { TelemetryEvent } from "./TelemetryLog";

/** How many recent telemetry events a bug report carries. */
export const BUG_REPORT_EVENT_COUNT = 20;
/** Cap on the diagnostics text (GitHub rejects very long issue URLs). */
export const BUG_REPORT_MAX_DIAGNOSTICS_CHARS = 4000;
/** Cap on the settings JSON within that budget. */
const SETTINGS_MAX_CHARS = 1500;
const TRUNCATED = "…(truncated)";

/** Inputs of {@link formatDiagnostics}. */
export interface DiagnosticsInput {
  readonly build: BuildInfo;
  readonly settings: unknown;
  readonly events: readonly TelemetryEvent[];
}

/** @returns `text` cut to `max` characters, marked when cut. */
function clip(text: string, max: number): string {
  return text.length <= max
    ? text
    : text.slice(0, max - TRUNCATED.length) + TRUNCATED;
}

/** @returns One line per event: ISO time, type, flat payload. */
function eventLine(event: TelemetryEvent): string {
  return `${new Date(event.t).toISOString()} ${event.type} ${JSON.stringify(event.data)}`;
}

/**
 * @param input - Build, settings and the telemetry buffer.
 * @returns Markdown-friendly diagnostics text (≤ the URL budget).
 */
export function formatDiagnostics(input: DiagnosticsInput): string {
  const recent = input.events.slice(-BUG_REPORT_EVENT_COUNT);
  const text = [
    `Build: ${formatVersionTag(input.build)}`,
    "",
    "Settings:",
    "```json",
    clip(JSON.stringify(input.settings ?? null), SETTINGS_MAX_CHARS),
    "```",
    `Last ${recent.length} telemetry events:`,
    "```",
    ...recent.map(eventLine),
    "```",
  ].join("\n");
  return clip(text, BUG_REPORT_MAX_DIAGNOSTICS_CHARS);
}
