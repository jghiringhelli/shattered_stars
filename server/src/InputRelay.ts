/**
 * InputRelay — the input side of a running match: accepts each seat's stream
 * in tick order, caps how far a seat may run ahead, forwards every other seat
 * the part it has not acknowledged (redundant resend) and fills absent seats
 * with the AI input so nobody stalls.
 */

import {
  INPUT_AI_CONTROL,
  MAX_LEAD_TICKS,
  NET_LIMITS,
  type ClientInputMessage,
} from "../../src/net/protocol";
import {
  isFeeding,
  isPresent,
  type MatchRelayHooks,
  type SeatState,
} from "./matchRelayTypes";

export class InputRelay {
  /**
   * @param seats - The match's seats (shared with MatchRelay).
   * @param hooks - Delivery to a seat's player.
   * @param isRunning - Whether the match is in its running phase.
   */
  constructor(
    private readonly seats: readonly SeatState[],
    private readonly hooks: MatchRelayHooks,
    private readonly isRunning: () => boolean,
  ) {}

  /** @param seat - Sender. @param message - Its input batch. */
  accept(seat: number, message: ClientInputMessage): void {
    const s = this.seats[seat];
    if (!this.isRunning() || !s || !isFeeding(s)) return;
    message.ack.forEach((next, sender) => {
      const log = this.seats[sender]?.log;
      if (log)
        s.acks[sender] = Math.min(
          log.next,
          Math.max(s.acks[sender] ?? 0, next),
        );
    });
    const lastTick = message.from + message.inputs.length - 1;
    if (lastTick > this.maxOtherNext(seat) + MAX_LEAD_TICKS) return;
    if (s.log.accept(message.from, message.inputs) === 0) return;
    this.relaySeat(seat, message.at);
    this.fillAbsent();
  }

  /** Give every seat that is not feeding the AI input up to the furthest feeding seat. */
  fillAbsent(): void {
    if (!this.isRunning()) return;
    const feeding = this.seats.filter((s) => isFeeding(s));
    if (feeding.length === 0) return;
    const target = Math.max(...feeding.map((s) => s.log.next));
    for (const s of this.seats) {
      if (!isFeeding(s) && s.log.fill(target, INPUT_AI_CONTROL) > 0)
        this.relaySeat(s.seat, -1);
    }
  }

  /**
   * A rejoining seat jumps to a snapshot: resend it everything after the barrier.
   *
   * @param target - The rejoining seat.
   * @param tick - The snapshot tick.
   */
  catchUp(target: SeatState, tick: number): void {
    for (const sender of this.seats) {
      target.acks[sender.seat] = tick + 1;
      this.sendRange(target, sender.seat, -1);
    }
  }

  private maxOtherNext(seat: number): number {
    return Math.max(
      0,
      ...this.seats.filter((x) => x.seat !== seat).map((x) => x.log.next),
    );
  }

  private relaySeat(seat: number, at: number): void {
    for (const r of this.seats) {
      if (r.seat !== seat && isPresent(r) && !r.holdInputs)
        this.sendRange(r, seat, at);
    }
  }

  private sendRange(recipient: SeatState, seat: number, at: number): void {
    const log = this.seats[seat]?.log;
    if (!log) return;
    const range = log.range(
      recipient.acks[seat] ?? 0,
      NET_LIMITS.maxInputFramesPerMessage,
    );
    if (range.inputs.length === 0) return;
    this.hooks.sendToSeat(recipient.seat, {
      t: "in",
      seat,
      from: range.from,
      inputs: range.inputs,
      at,
      ack: recipient.log.next,
    });
  }
}
