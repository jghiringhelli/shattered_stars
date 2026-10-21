/**
 * Contracts and tuning constants of NetClient.
 */

import type { Scheduler } from "../time";
import type { TransportFactory } from "../transport/Transport";

/** Connection lifecycle. */
export type NetClientState =
  | "idle"
  | "connecting"
  | "online"
  | "reconnecting"
  | "unreachable"
  | "refused"
  | "expired"
  | "closed";

/** Where the resume token survives a page reload (sessionStorage in the game). */
export interface TokenStore {
  load(): string | null;
  save(token: string | null): void;
}

/** Client settings. */
export interface NetClientOptions {
  readonly url: string;
  readonly build: string;
  readonly name: string;
  readonly transport: TransportFactory;
  readonly scheduler: Scheduler;
  readonly tokenStore?: TokenStore;
  readonly pingIntervalMs?: number;
}

/** Heartbeat period (ms). */
export const PING_INTERVAL_MS = 2_000;
/** Silence after which the connection counts as dead (ms). */
export const SILENCE_TIMEOUT_MS = 3 * PING_INTERVAL_MS;
/** First reconnection back-off (ms); doubles up to the max. */
export const RECONNECT_BASE_MS = 500;
export const RECONNECT_MAX_MS = 4_000;
/** Attempts before an initial connection is declared unreachable. */
export const INITIAL_ATTEMPTS = 3;
/** Reconnection window assumed until the server states its own (ms). */
export const DEFAULT_RECONNECT_WINDOW_MS = 30_000;
/** Normal close code. */
export const NORMAL_CLOSE = 1000;
