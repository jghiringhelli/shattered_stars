/**
 * Contracts and per-seat state of the match relay.
 */

import type { ServerMessage, TeamId } from "../../src/net/protocol";
import type { SeatLog } from "./SeatLog";

/** What the relay asks of the relay core. */
export interface MatchRelayHooks {
  /** Deliver to the seat's player if their socket is open. */
  sendToSeat(seat: number, message: ServerMessage): void;
  onEnded(reason: "finished" | "abandoned", winnerTeam: TeamId | null): void;
}

/** Timings the relay needs. */
export interface MatchRelayTimings {
  readonly loadTimeoutMs: number;
  readonly reconnectWindowMs: number;
}

/** Wait after the first match-over report for the other seats' reports (ms). */
export const MATCH_OVER_GRACE_MS = 5_000;

/** One seat as the relay tracks it. */
export interface SeatState {
  readonly seat: number;
  readonly log: SeatLog;
  connected: boolean;
  loaded: boolean;
  left: boolean;
  /** Per sender seat: the next tick this seat still needs. */
  acks: number[];
  /** Rejoining: no inputs until the resync snapshot arrives. */
  holdInputs: boolean;
  report: { readonly winner: TeamId | null } | null;
}

/** @param s - A seat. @returns Whether it is connected, loaded and still in the match. */
export function isPresent(s: SeatState): boolean {
  return s.connected && s.loaded && !s.left;
}

/** @param s - A seat. @returns Whether it sends its own inputs (a rejoining seat is AI-filled until its snapshot lands). */
export function isFeeding(s: SeatState): boolean {
  return isPresent(s) && !s.holdInputs;
}
