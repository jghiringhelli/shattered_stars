/**
 * LockstepSession — deterministic input lockstep for one client.
 *
 * Every rendered frame the scene samples its input, then calls `update`:
 * the session schedules this client's input `inputDelay` ticks ahead, sends
 * it (with every input the relay has not acknowledged), and simulates each
 * due tick for which all seats' inputs are present — otherwise it stalls.
 * Every HASH_INTERVAL_TICKS it reports a state hash; on a resync barrier it
 * waits for the authority's snapshot and jumps to it; when it is the
 * authority it captures the requested snapshot.
 */

import {
  encodeMessage,
  HASH_INTERVAL_TICKS,
  NET_LIMITS,
  NEUTRAL_INPUT,
  TICK_MS,
  type MatchStart,
  type ServerMessage,
  type TeamId,
  type TickInput,
} from "../protocol";
import type { Clock } from "../time";
import { InputBuffer } from "./InputBuffer";
import { AdaptiveDelay } from "./AdaptiveDelay";
import { LocalInputSampler } from "./LocalInputSampler";
import { MAX_TICKS_PER_FRAME, TickPacer } from "./TickPacer";
import type {
  FrameResult,
  LatencyEstimate,
  LockstepEvents,
  LockstepOutbox,
  LockstepSimulation,
  LockstepStats,
  LockstepStatus,
} from "./types";

/** Resend un-acknowledged inputs at least this often while nothing new is scheduled (ms). */
export const RESEND_INTERVAL_MS = 100;

/** Session construction options. */
export interface LockstepOptions {
  readonly match: MatchStart;
  readonly localSeat: number;
  readonly outbox: LockstepOutbox;
  readonly clock: Clock;
  /** Bits of an input's first word that are one-shot presses (PilotInputCodec.EDGE_MASK). */
  readonly edgeMask?: number;
  readonly hashIntervalTicks?: number;
  readonly latency?: () => LatencyEstimate;
  readonly events?: LockstepEvents;
  /** Raise / lower this client's input delay with its stall rate (default on). */
  readonly adaptiveDelay?: boolean;
}

export class LockstepSession {
  /** Last simulated tick (-1 before the first). */
  tick = -1;
  status: LockstepStatus = "loading";
  authority: number;
  readonly stats: LockstepStats = {
    ticksRun: 0,
    stallFrames: 0,
    stallMs: 0,
    longestStallMs: 0,
    resyncs: 0,
    snapshotsApplied: 0,
    snapshotsSent: 0,
    hashesSent: 0,
    messagesSent: 0,
    bytesSent: 0,
  };
  private readonly buffer: InputBuffer;
  private readonly pacer = new TickPacer();
  private readonly sampler: LocalInputSampler;
  private readonly adaptive: AdaptiveDelay;
  private readonly localLog = new Map<number, TickInput>();
  private readonly remoteAt = new Map<
    number,
    { at: number; receivedAt: number }
  >();
  private localNext: number;
  private serverAck: number;
  private sentNext: number;
  private lastSendAt = Number.NEGATIVE_INFINITY;
  private barrier: number | null = null;
  private captureAt: number | null = null;
  private pendingSnapshot: { tick: number; data: string } | null = null;
  private currentStallMs = 0;

  /** @param options - Match, seat, outbox, clock and tuning. */
  constructor(private readonly options: LockstepOptions) {
    const { match, localSeat } = options;
    this.authority = match.authoritySeat;
    this.buffer = new InputBuffer(
      match.seats.length,
      localSeat,
      match.inputDelay,
    );
    this.sampler = new LocalInputSampler(options.edgeMask ?? 0);
    this.adaptive = new AdaptiveDelay(match.inputDelay, match.inputDelay);
    this.localNext = match.inputDelay;
    this.serverAck = match.inputDelay;
    this.sentNext = match.inputDelay;
  }

  /** @returns Ticks between sampling and simulating this client's input (adapts to stalls). */
  get inputDelay(): number {
    return this.adaptive.delay;
  }

  /** @returns The delay the relay negotiated at match start (the adaptive floor). */
  get matchDelay(): number {
    return this.options.match.inputDelay;
  }

  /** The battle finished loading: tell the relay (it answers `go`). */
  markLoaded(): void {
    this.send({ t: "loaded" });
  }

  /** @param input - This frame's encoded local input. */
  sampleInput(input: TickInput): void {
    this.sampler.sample(input);
  }

  /**
   * @param frameMs - Real time since the previous frame (ms).
   * @param sim - The simulation to advance.
   * @returns What the frame did.
   */
  update(frameMs: number, sim: LockstepSimulation): FrameResult {
    if (this.status === "loading" || this.status === "ended")
      return { ticksRun: 0, stalled: false, alpha: 0 };
    this.applyPendingSnapshot(sim);
    this.pacer.observeAdvantage(this.advantage());
    this.pacer.addFrame(frameMs);
    let ticksRun = 0;
    let stalled = false;
    while (this.pacer.hasDueTick() && ticksRun < MAX_TICKS_PER_FRAME) {
      const next = this.tick + 1;
      if (this.barrier !== null && next > this.barrier) {
        stalled = true;
        break;
      }
      this.scheduleLocalThrough(next + this.inputDelay);
      const inputs = this.buffer.inputsFor(next);
      if (!inputs) {
        stalled = true;
        break;
      }
      sim.step(next, inputs);
      this.tick = next;
      this.pacer.consumeTick();
      this.afterStep(sim);
      ticksRun++;
    }
    this.flushInputs();
    this.recordFrame(frameMs, ticksRun, stalled);
    if (this.options.adaptiveDelay !== false && this.barrier === null)
      this.adaptive.observe(frameMs, stalled);
    return { ticksRun, stalled, alpha: this.pacer.alpha() };
  }

  /** @param message - A message from the relay. */
  receive(message: ServerMessage): void {
    switch (message.t) {
      case "go":
        if (this.status !== "loading") return;
        this.status = "running";
        // The relay sent `go` one-way-latency ago: start that far in so every client's tick 0 lines up in real time.
        this.pacer.addFrame((this.options.latency?.().selfRttMs ?? 0) / 2);
        return;
      case "in":
        return this.receiveInputs(message);
      case "resync":
        this.barrier = message.tick;
        this.stats.resyncs++;
        this.options.events?.onResync?.(message.tick, message.reason);
        return;
      case "snapshot_request":
        this.captureAt = message.tick;
        return;
      case "snapshot":
        this.pendingSnapshot = { tick: message.tick, data: message.data };
        return;
      case "authority":
        this.authority = message.seat;
        return;
      case "peer":
        if (message.status !== "reconnected")
          this.remoteAt.delete(message.seat);
        this.options.events?.onPeer?.(
          message.seat,
          message.status,
          message.graceMs,
        );
        return;
      case "match_end":
        this.status = "ended";
        this.options.events?.onMatchEnd?.(message.reason, message.winnerTeam);
        return;
      default:
        return;
    }
  }

  /** @param winnerTeam - The team this client's simulation says won (null = draw). */
  reportMatchOver(winnerTeam: TeamId | null): void {
    this.send({ t: "match_over", tick: Math.max(0, this.tick), winnerTeam });
  }

  /** Leave the match for good (the AI takes over this seat). */
  leave(): void {
    this.send({ t: "leave_match" });
    this.status = "ended";
  }

  /** @returns How many ticks this client runs ahead of the slowest human peer (estimate). */
  advantage(): number {
    if (this.remoteAt.size === 0) return 0;
    const now = this.options.clock.now();
    const latency = this.options.latency?.() ?? { selfRttMs: 0, peerRttMs: 0 };
    const oneWayMs = (latency.selfRttMs + latency.peerRttMs) / 2;
    let slowest = Number.POSITIVE_INFINITY;
    for (const { at, receivedAt } of this.remoteAt.values()) {
      slowest = Math.min(slowest, at + (oneWayMs + now - receivedAt) / TICK_MS);
    }
    return this.tick - slowest;
  }

  private receiveInputs(message: Extract<ServerMessage, { t: "in" }>): void {
    this.buffer.receive(message.seat, message.from, message.inputs);
    this.serverAck = Math.max(this.serverAck, message.ack);
    if (message.at >= 0 && message.seat !== this.options.localSeat) {
      this.remoteAt.set(message.seat, {
        at: message.at,
        receivedAt: this.options.clock.now(),
      });
    }
  }

  private scheduleLocalThrough(target: number): void {
    if (this.serverAck > this.localNext) this.localNext = this.serverAck;
    while (this.localNext <= target) {
      const input =
        this.localNext === target ? this.sampler.take() : this.sampler.held();
      this.buffer.setLocal(this.localNext, input);
      this.localLog.set(this.localNext, input);
      this.localNext++;
    }
  }

  private flushInputs(): void {
    for (const tick of this.localLog.keys())
      if (tick < this.serverAck) this.localLog.delete(tick);
    const from = this.serverAck;
    const count = Math.min(
      this.localNext - from,
      NET_LIMITS.maxInputFramesPerMessage,
    );
    if (count <= 0) return;
    const now = this.options.clock.now();
    if (
      this.localNext <= this.sentNext &&
      now - this.lastSendAt < RESEND_INTERVAL_MS
    )
      return;
    const inputs: TickInput[] = [];
    for (let t = from; t < from + count; t++)
      inputs.push(this.localLog.get(t) ?? NEUTRAL_INPUT);
    this.send({
      t: "in",
      from,
      inputs,
      at: this.tick,
      ack: this.buffer.ackVector(),
    });
    this.sentNext = this.localNext;
    this.lastSendAt = now;
  }

  private afterStep(sim: LockstepSimulation): void {
    const tick = this.tick;
    this.buffer.discardThrough(tick);
    this.stats.ticksRun++;
    if (this.captureAt === tick) {
      this.captureAt = null;
      this.send({ t: "snapshot", tick, data: sim.snapshot(tick) });
      this.stats.snapshotsSent++;
    }
    const interval = this.options.hashIntervalTicks ?? HASH_INTERVAL_TICKS;
    if (tick > 0 && tick % interval === 0) {
      this.send({ t: "hash", tick, hash: sim.hash(tick) >>> 0 });
      this.stats.hashesSent++;
    }
  }

  private applyPendingSnapshot(sim: LockstepSimulation): void {
    const snapshot = this.pendingSnapshot;
    if (!snapshot) return;
    this.pendingSnapshot = null;
    if (snapshot.tick < this.tick) return;
    sim.restore(snapshot.tick, snapshot.data);
    this.tick = snapshot.tick;
    this.buffer.discardThrough(snapshot.tick);
    if (this.barrier !== null && this.barrier <= snapshot.tick)
      this.barrier = null;
    if (this.localNext <= snapshot.tick) this.localNext = snapshot.tick + 1;
    this.stats.snapshotsApplied++;
    this.options.events?.onSnapshotApplied?.(snapshot.tick);
  }

  private recordFrame(
    frameMs: number,
    ticksRun: number,
    stalled: boolean,
  ): void {
    this.status =
      this.barrier !== null && this.tick >= this.barrier
        ? "resyncing"
        : stalled
          ? "stalled"
          : "running";
    if (stalled) this.stats.stallFrames++;
    if (!stalled || ticksRun > 0) {
      this.currentStallMs = 0;
      return;
    }
    this.stats.stallMs += frameMs;
    this.currentStallMs += frameMs;
    this.stats.longestStallMs = Math.max(
      this.stats.longestStallMs,
      this.currentStallMs,
    );
  }

  private send(message: Parameters<LockstepOutbox["send"]>[0]): void {
    this.stats.messagesSent++;
    this.stats.bytesSent += encodeMessage(message).length;
    this.options.outbox.send(message);
  }
}
