/**
 * Matchmaker — quick-match queues. Players wait per (mode, build) so a
 * client never meets one running different game data (which would desync);
 * the first two waiting on a key are paired, oldest first. Pure.
 */

import type { MatchMode } from "../../src/net/protocol";
import type { QueueKey } from "./types";

/** A waiting player. */
interface Waiting {
  readonly playerId: string;
  readonly since: number;
}

/** Players a quick match seats together. */
export const QUICK_MATCH_SIZE = 2;

export class Matchmaker {
  private readonly queues = new Map<string, Waiting[]>();
  private readonly keyOf = new Map<string, QueueKey>();

  /**
   * @param playerId - Player joining the queue (re-queuing moves them).
   * @param key - Mode and build.
   * @param nowMs - Current time.
   * @returns The matched group (oldest first) when the queue filled, else null.
   */
  enqueue(playerId: string, key: QueueKey, nowMs: number): string[] | null {
    this.remove(playerId);
    const id = keyString(key);
    const queue = this.queues.get(id) ?? [];
    queue.push({ playerId, since: nowMs });
    this.queues.set(id, queue);
    this.keyOf.set(playerId, key);
    if (queue.length < QUICK_MATCH_SIZE) return null;
    const group = queue.splice(0, QUICK_MATCH_SIZE).map((w) => w.playerId);
    for (const member of group) this.keyOf.delete(member);
    if (queue.length === 0) this.queues.delete(id);
    return group;
  }

  /**
   * @param playerId - Player leaving the queue.
   * @returns The mode they were queued for, or null when not queued.
   */
  remove(playerId: string): MatchMode | null {
    const key = this.keyOf.get(playerId);
    if (!key) return null;
    this.keyOf.delete(playerId);
    const id = keyString(key);
    const queue = (this.queues.get(id) ?? []).filter(
      (w) => w.playerId !== playerId,
    );
    if (queue.length === 0) this.queues.delete(id);
    else this.queues.set(id, queue);
    return key.mode;
  }

  /** @returns How many players are waiting in total. */
  size(): number {
    return this.keyOf.size;
  }
}

function keyString(key: QueueKey): string {
  return `${key.mode}|${key.build}`;
}
