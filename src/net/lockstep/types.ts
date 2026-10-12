/**
 * Contracts between the lockstep session and the game simulation it drives.
 */

import type { ClientMessage, TeamId, TickInput } from "../protocol";

/**
 * The deterministic simulation, as a battle scene exposes it to the net
 * layer (Phase 2 adapters for DogfightScene / ArcadeBattleScene).
 */
export interface LockstepSimulation {
  /**
   * Advance exactly one fixed tick (TICK_MS) with every seat's input.
   * Must not read wall-clock time, Math.random or anything seat-relative.
   */
  step(tick: number, inputs: readonly TickInput[]): void;
  /** Fingerprint of the full simulation state after `tick`. */
  hash(tick: number): number;
  /** Serialize the full simulation state after `tick` (authority only). */
  snapshot(tick: number): string;
  /** Replace the full simulation state with a snapshot taken after `tick`. */
  restore(tick: number, data: string): void;
}

/** Where the session's outgoing messages go (the NetClient, or a test link). */
export interface LockstepOutbox {
  send(message: ClientMessage): void;
}

/** Session lifecycle. */
export type LockstepStatus =
  "loading" | "running" | "stalled" | "resyncing" | "ended";

/** Notifications for the HUD (all optional). */
export interface LockstepEvents {
  onPeer?(
    seat: number,
    status: "disconnected" | "reconnected" | "left",
    graceMs: number,
  ): void;
  onResync?(tick: number, reason: "desync" | "reconnect"): void;
  onSnapshotApplied?(tick: number): void;
  onMatchEnd?(
    reason: "finished" | "abandoned",
    winnerTeam: TeamId | null,
  ): void;
}

/** Round trips feeding the pacing estimate. */
export interface LatencyEstimate {
  readonly selfRttMs: number;
  /** Largest round trip among the other players. */
  readonly peerRttMs: number;
}

/** What one rendered frame did. */
export interface FrameResult {
  readonly ticksRun: number;
  /** A tick was due but an input (or the resync snapshot) was missing. */
  readonly stalled: boolean;
  /** Fraction of the next tick already elapsed (render interpolation). */
  readonly alpha: number;
}

/** Counters for diagnostics, the measurement harness and the HUD. */
export interface LockstepStats {
  ticksRun: number;
  stallFrames: number;
  stallMs: number;
  longestStallMs: number;
  resyncs: number;
  snapshotsApplied: number;
  snapshotsSent: number;
  hashesSent: number;
  messagesSent: number;
  bytesSent: number;
}
