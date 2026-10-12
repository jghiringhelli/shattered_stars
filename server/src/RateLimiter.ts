/**
 * Per-connection rate limiting: one token bucket per message category.
 * A message that finds its bucket empty is dropped; a connection that keeps
 * hammering accumulates violations and is closed by the socket layer.
 */

import type { ClientMessageType } from "../../src/net/protocol";
import type { Clock } from "../../src/net/time";

/** Bucket size and refill rate. */
export interface RateRule {
  readonly capacity: number;
  readonly perSecond: number;
}

/** Rate categories. */
export type RateCategory =
  "input" | "hash" | "snapshot" | "chat" | "ping" | "lobby";

/**
 * Inputs flow at the 60 Hz tick rate (one message per rendered frame, so up
 * to 144/s on fast monitors); hashes at 2 Hz; snapshots only on resync.
 */
export const RATE_RULES: Readonly<Record<RateCategory, RateRule>> = {
  input: { capacity: 240, perSecond: 160 },
  hash: { capacity: 20, perSecond: 10 },
  snapshot: { capacity: 4, perSecond: 1 },
  chat: { capacity: 5, perSecond: 1 },
  ping: { capacity: 10, perSecond: 4 },
  lobby: { capacity: 30, perSecond: 10 },
};

/** Violations within one window that get a connection closed. */
export const MAX_VIOLATIONS_PER_WINDOW = 100;
/** Violation counting window (ms). */
export const VIOLATION_WINDOW_MS = 10_000;

const CATEGORY_OF: Partial<Record<ClientMessageType, RateCategory>> = {
  in: "input",
  hash: "hash",
  snapshot: "snapshot",
  chat: "chat",
  ping: "ping",
};

/** A refilling token bucket. */
export class TokenBucket {
  private tokens: number;
  private updatedAt: number;

  /**
   * @param rule - Capacity and refill rate.
   * @param nowMs - Creation time (ms).
   */
  constructor(
    private readonly rule: RateRule,
    nowMs: number,
  ) {
    this.tokens = rule.capacity;
    this.updatedAt = nowMs;
  }

  /**
   * @param nowMs - Current time (ms).
   * @returns Whether a token was available (and consumed).
   */
  take(nowMs: number): boolean {
    const elapsed = Math.max(0, nowMs - this.updatedAt) / 1000;
    this.tokens = Math.min(
      this.rule.capacity,
      this.tokens + elapsed * this.rule.perSecond,
    );
    this.updatedAt = nowMs;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

/** One connection's buckets and violation count. */
export class ConnectionRateLimiter {
  private readonly buckets = new Map<RateCategory, TokenBucket>();
  private violations = 0;
  private windowStart: number;

  /**
   * @param clock - Time source.
   * @param rules - Bucket rules per category.
   */
  constructor(
    private readonly clock: Clock,
    private readonly rules: Readonly<
      Record<RateCategory, RateRule>
    > = RATE_RULES,
  ) {
    this.windowStart = clock.now();
  }

  /**
   * @param type - The message type.
   * @returns Whether the message may be processed.
   */
  allow(type: ClientMessageType | "invalid"): boolean {
    const now = this.clock.now();
    const category =
      type === "invalid" ? "lobby" : (CATEGORY_OF[type] ?? "lobby");
    let bucket = this.buckets.get(category);
    if (!bucket) {
      bucket = new TokenBucket(this.rules[category], now);
      this.buckets.set(category, bucket);
    }
    if (bucket.take(now)) return true;
    this.recordViolation();
    return false;
  }

  /** Count a violation (rate or validation). */
  recordViolation(): void {
    const now = this.clock.now();
    if (now - this.windowStart > VIOLATION_WINDOW_MS) {
      this.windowStart = now;
      this.violations = 0;
    }
    this.violations++;
  }

  /** @returns Whether the connection crossed the violation limit. */
  isAbusive(): boolean {
    return this.violations >= MAX_VIOLATIONS_PER_WINDOW;
  }
}
