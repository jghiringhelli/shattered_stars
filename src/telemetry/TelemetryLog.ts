/**
 * TelemetryLog — a local, privacy-respecting event log: a capped ring
 * buffer persisted in a key/value store (localStorage in the browser).
 * Nothing is ever sent over the network; the player can export the buffer
 * as JSON (to attach to a playtest report) or clear it from Settings.
 *
 * Pure: no Phaser, no DOM (storage and clock are injected).
 */

import type { KeyValueStore } from "../systems/keyValueStore";

/** Storage key of the ring buffer. */
export const TELEMETRY_STORAGE_KEY = "ss_telemetry_v1";

/** Default number of events kept (oldest dropped first). */
export const TELEMETRY_CAPACITY = 500;

/** Longest string kept in an event field (error stacks are truncated). */
export const TELEMETRY_MAX_STRING = 300;

/** Export document identification. */
const EXPORT_FORMAT = "shattered-stars-telemetry";
const EXPORT_VERSION = 1;

/** What happened. */
export type TelemetryEventType =
  | "session_start"
  | "session_end"
  | "mode_start"
  | "mode_end"
  | "death"
  | "tutorial_step"
  | "tutorial_exit"
  | "error";

/** A primitive event field value. */
export type TelemetryValue = string | number | boolean | null;

/** Event payload: flat primitive fields only. */
export type TelemetryData = Readonly<Record<string, TelemetryValue>>;

/** One logged event. */
export interface TelemetryEvent {
  /** Epoch ms. */
  readonly t: number;
  readonly type: TelemetryEventType;
  /** Session id (one per page load). */
  readonly session: string;
  readonly data: TelemetryData;
}

/** TelemetryLog dependencies. */
export interface TelemetryLogOptions {
  readonly store: KeyValueStore;
  readonly sessionId: string;
  /** Whether recording is allowed right now (the privacy setting). */
  readonly isEnabled: () => boolean;
  readonly capacity?: number;
  readonly now?: () => number;
}

function sanitize(data: TelemetryData): TelemetryData {
  const clean: Record<string, TelemetryValue> = {};
  for (const [key, value] of Object.entries(data)) {
    clean[key] =
      typeof value === "string" ? value.slice(0, TELEMETRY_MAX_STRING) : value;
  }
  return clean;
}

export class TelemetryLog {
  private readonly capacity: number;
  private readonly now: () => number;

  /** @param options - Store, session id, opt-in predicate, capacity, clock. */
  constructor(private readonly options: TelemetryLogOptions) {
    this.capacity = options.capacity ?? TELEMETRY_CAPACITY;
    this.now = options.now ?? Date.now;
  }

  /**
   * Append an event (no-op while disabled); the oldest events are dropped
   * past capacity.
   *
   * @param type - Event type.
   * @param data - Flat payload.
   */
  record(type: TelemetryEventType, data: TelemetryData): void {
    if (!this.options.isEnabled()) return;
    const event: TelemetryEvent = {
      t: this.now(),
      type,
      session: this.options.sessionId,
      data: sanitize(data),
    };
    const next = [...this.events(), event].slice(-this.capacity);
    try {
      this.options.store.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage full or disabled: telemetry must never break the game.
    }
  }

  /** @returns Every stored event, oldest first. */
  events(): readonly TelemetryEvent[] {
    const raw = this.options.store.getItem(TELEMETRY_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as TelemetryEvent[]) : [];
    } catch {
      return [];
    }
  }

  /** Delete every stored event. */
  clear(): void {
    this.options.store.removeItem(TELEMETRY_STORAGE_KEY);
  }

  /** @returns The buffer as a self-describing JSON document. */
  exportJson(): string {
    return JSON.stringify(
      {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        exportedAt: new Date(this.now()).toISOString(),
        events: this.events(),
      },
      null,
      2,
    );
  }
}
