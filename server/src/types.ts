/**
 * Shared server-side types: the connection seam between the socket layer and
 * the relay logic, and a player session.
 */

import type { MatchMode, ServerMessage } from "../../src/net/protocol";
import type { Scheduler, TimerHandle } from "../../src/net/time";
import type { ServerConfig } from "./config";
import type { Logger } from "./logger";

/** One open socket, as the relay logic sees it. */
export interface Connection {
  send(message: ServerMessage): void;
  close(code: number, reason: string): void;
}

/** A player identity that survives socket drops for the reconnection window. */
export interface Session {
  readonly id: string;
  readonly token: string;
  name: string;
  build: string;
  connection: Connection | null;
  /** Round trip the client last reported (ms). */
  rttMs: number;
  roomCode: string | null;
  /** Reconnection-window expiry while disconnected. */
  expiry: TimerHandle | null;
}

/** Randomness the relay needs (crypto-backed in production, seeded in tests). */
export interface RelayRandom {
  /** @returns An integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** @returns An unguessable session token. */
  token(): string;
}

/** Everything the relay logic depends on. */
export interface RelayDeps {
  readonly scheduler: Scheduler;
  readonly random: RelayRandom;
  readonly logger: Logger;
  readonly config: ServerConfig;
}

/** Quick-match queue key: players only meet others on the same mode and build. */
export interface QueueKey {
  readonly mode: MatchMode;
  readonly build: string;
}
