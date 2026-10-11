/**
 * telemetry — the game's one local event log and the one-line calls scenes
 * make: `trackModeStart("dogfight")`, `trackModeEnd("dogfight", "victory")`,
 * `trackDeath(...)`, tutorial progress, plus session and uncaught-error
 * capture installed once at boot. Gated by Settings › Advanced › Local
 * telemetry; never leaves the machine (export is a manual JSON download).
 */

import { browserStore } from "../systems/keyValueStore";
import { isTelemetryEnabled } from "../systems/SettingsStorage";
import {
  TelemetryLog,
  type TelemetryData,
  type TelemetryEvent,
} from "./TelemetryLog";

/** Mode ids used in mode_start / mode_end events. */
export type TelemetryMode =
  | "skirmish"
  | "dogfight"
  | "ace_duel"
  | "boss_raid"
  | "continuous"
  | "survival"
  | "campaign"
  | "flight_school";

/** Radix and length of the random session id. */
const SESSION_ID_RADIX = 36;
const SESSION_ID_START = 2;
const SESSION_ID_END = 10;

let log: TelemetryLog | null = null;
let installed = false;
let sessionStartedAt = 0;
const modeStartedAt = new Map<string, number>();

function newSessionId(): string {
  return Math.random()
    .toString(SESSION_ID_RADIX)
    .slice(SESSION_ID_START, SESSION_ID_END);
}

function telemetryLog(): TelemetryLog {
  log ??= new TelemetryLog({
    store: browserStore(),
    sessionId: newSessionId(),
    isEnabled: () => isTelemetryEnabled(),
  });
  return log;
}

/**
 * A game mode began (one line at the point the battle actually starts).
 *
 * @param mode - Mode id.
 * @param details - Optional flat context (difficulty, faction...).
 */
export function trackModeStart(
  mode: TelemetryMode,
  details: TelemetryData = {},
): void {
  modeStartedAt.set(mode, Date.now());
  telemetryLog().record("mode_start", { ...details, mode });
}

/**
 * A game mode ended.
 *
 * @param mode - Mode id.
 * @param outcome - "victory", "defeat", "draw", "quit"...
 * @param details - Optional flat context (score, wave...).
 */
export function trackModeEnd(
  mode: TelemetryMode,
  outcome: string,
  details: TelemetryData = {},
): void {
  const started = modeStartedAt.get(mode);
  modeStartedAt.delete(mode);
  const durationMs = started === undefined ? null : Date.now() - started;
  telemetryLog().record("mode_end", { ...details, mode, outcome, durationMs });
}

/**
 * The player's ship was destroyed.
 *
 * @param mode - Mode id.
 * @param cause - What killed it (attacker ship id/definition, "hazard"...).
 * @param details - Optional flat context.
 */
export function trackDeath(
  mode: TelemetryMode,
  cause: string,
  details: TelemetryData = {},
): void {
  telemetryLog().record("death", { ...details, mode, cause });
}

/**
 * @param stepId - Lesson id reached.
 * @param index - Lesson index.
 */
export function trackTutorialStep(stepId: string, index: number): void {
  telemetryLog().record("tutorial_step", { step: stepId, index });
}

/**
 * The player left Flight School (drop-off point when not completed).
 *
 * @param stepId - Lesson on screen when leaving ("complete" when done).
 * @param completed - Whether the course was finished.
 */
export function trackTutorialExit(stepId: string, completed: boolean): void {
  telemetryLog().record("tutorial_exit", { step: stepId, completed });
}

/** @returns Every stored event. */
export function telemetryEvents(): readonly TelemetryEvent[] {
  return telemetryLog().events();
}

/** @returns The log as an export JSON document. */
export function exportTelemetryJson(): string {
  return telemetryLog().exportJson();
}

/** Delete the stored log. */
export function clearTelemetry(): void {
  telemetryLog().clear();
}

/** The window events telemetry listens to. */
export interface TelemetryHost {
  addEventListener(type: string, listener: (event: unknown) => void): void;
}

/**
 * Record session start and capture session end and uncaught errors.
 * Idempotent.
 *
 * @param host - The window.
 */
export function installTelemetry(host: TelemetryHost): void {
  if (installed) return;
  installed = true;
  sessionStartedAt = Date.now();
  telemetryLog().record("session_start", {});
  host.addEventListener("pagehide", () =>
    telemetryLog().record("session_end", {
      durationMs: Date.now() - sessionStartedAt,
    }),
  );
  host.addEventListener("error", (event) => {
    const e = event as { message?: string; filename?: string; lineno?: number };
    telemetryLog().record("error", {
      message: e.message ?? "unknown error",
      source: (e.filename ?? "").split("/").pop() ?? "",
      line: e.lineno ?? null,
    });
  });
  host.addEventListener("unhandledrejection", (event) => {
    const reason = (event as { reason?: unknown }).reason;
    telemetryLog().record("error", {
      message: reason instanceof Error ? reason.message : String(reason),
      source: "unhandledrejection",
      line: null,
    });
  });
}
