/**
 * SeatLog — one seat's input stream as the relay holds it: the next tick it
 * expects, and a bounded window of past inputs kept for redundant resends
 * and reconnection catch-up. Pure.
 */

import { INPUT_LOG_TICKS, type TickInput } from "../../src/net/protocol";

/** A contiguous run of inputs. */
export interface InputRange {
  readonly from: number;
  readonly inputs: readonly TickInput[];
}

export class SeatLog {
  /** Next tick this seat must send. */
  next: number;
  private start: number;
  private inputs: TickInput[] = [];

  /**
   * @param startTick - First tick of the stream (the match's input delay: earlier ticks are neutral by rule).
   * @param capacity - Ticks kept (older ones are dropped).
   */
  constructor(
    startTick = 0,
    private readonly capacity: number = INPUT_LOG_TICKS,
  ) {
    this.next = startTick;
    this.start = startTick;
  }

  /**
   * Appends the part of a batch that continues the stream. A batch that
   * starts past `next` (a gap) or ends before it (a duplicate) adds nothing.
   *
   * @param from - Tick of the batch's first input.
   * @param batch - Inputs for from, from+1, ….
   * @returns How many new inputs were appended.
   */
  accept(from: number, batch: readonly TickInput[]): number {
    if (from > this.next) return 0;
    const fresh = batch.slice(this.next - from);
    if (fresh.length === 0) return 0;
    this.inputs.push(...fresh);
    this.next += fresh.length;
    this.trim();
    return fresh.length;
  }

  /**
   * Appends one input repeated up to (excluding) a tick (AI fill).
   *
   * @param untilTick - First tick not filled.
   * @param input - Input to repeat.
   * @returns How many inputs were appended.
   */
  fill(untilTick: number, input: TickInput): number {
    const count = Math.max(0, untilTick - this.next);
    for (let i = 0; i < count; i++) this.inputs.push(input);
    this.next += count;
    this.trim();
    return count;
  }

  /**
   * @param from - First wanted tick (clamped to what is still logged).
   * @param maxCount - Most inputs returned.
   * @returns The logged inputs from there up to `next`.
   */
  range(from: number, maxCount: number): InputRange {
    const first = Math.max(from, this.start);
    const offset = first - this.start;
    return {
      from: first,
      inputs: this.inputs.slice(offset, offset + maxCount),
    };
  }

  private trim(): void {
    const excess = this.inputs.length - this.capacity;
    if (excess <= 0) return;
    this.inputs.splice(0, excess);
    this.start += excess;
  }
}
