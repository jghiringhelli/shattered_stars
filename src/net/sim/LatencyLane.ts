/**
 * LatencyLane — one direction of a simulated network link on a virtual
 * clock: fixed latency, uniform jitter, and loss. WebSocket runs on TCP, so
 * by default a lane is ordered and a "lost" packet is retransmitted (it and
 * everything behind it arrive late: head-of-line blocking); `drop` mode
 * instead loses messages outright, to stress the redundant input resend.
 */

import type { Scheduler } from "../time";

/** Network conditions of one direction. */
export interface LinkConditions {
  readonly latencyMs: number;
  /** Extra delay drawn uniformly from [0, jitterMs]. */
  readonly jitterMs: number;
  /** Probability a message is lost (0–1). */
  readonly lossRate: number;
  /** "retransmit": TCP-like, delayed by retransmitMs; "drop": never delivered. */
  readonly lossMode: "retransmit" | "drop";
  /** Retransmission delay (ms) for retransmit mode (≈ TCP's minimum RTO). */
  readonly retransmitMs?: number;
}

/** Default retransmission delay (ms): Linux TCP's minimum RTO. */
export const DEFAULT_RETRANSMIT_MS = 200;

/** A perfect link. */
export const IDEAL_LINK: LinkConditions = {
  latencyMs: 0,
  jitterMs: 0,
  lossRate: 0,
  lossMode: "retransmit",
};

export class LatencyLane<T> {
  sent = 0;
  delivered = 0;
  dropped = 0;
  private lastArrival = 0;
  private open = true;

  /**
   * @param scheduler - Virtual clock.
   * @param conditions - Latency, jitter, loss.
   * @param random - Seeded [0, 1) source.
   * @param deliver - Receives each message on arrival.
   */
  constructor(
    private readonly scheduler: Scheduler,
    private conditions: LinkConditions,
    private readonly random: () => number,
    private readonly deliver: (message: T) => void,
  ) {}

  /** @param message - Message to carry. */
  send(message: T): void {
    if (!this.open) return;
    this.sent++;
    const lost = this.random() < this.conditions.lossRate;
    if (lost && this.conditions.lossMode === "drop") {
      this.dropped++;
      return;
    }
    const now = this.scheduler.now();
    const retransmit = lost
      ? (this.conditions.retransmitMs ?? DEFAULT_RETRANSMIT_MS)
      : 0;
    const jitter = this.random() * this.conditions.jitterMs;
    let arrival = now + this.conditions.latencyMs + jitter + retransmit;
    if (this.conditions.lossMode === "retransmit")
      arrival = Math.max(arrival, this.lastArrival);
    this.lastArrival = arrival;
    this.scheduler.setTimeout(() => {
      if (!this.open) return;
      this.delivered++;
      this.deliver(message);
    }, arrival - now);
  }

  /** @param conditions - New conditions for messages sent from now on. */
  setConditions(conditions: LinkConditions): void {
    this.conditions = conditions;
  }

  /** Cut the lane: nothing in flight or sent later arrives. */
  cut(): void {
    this.open = false;
  }
}
