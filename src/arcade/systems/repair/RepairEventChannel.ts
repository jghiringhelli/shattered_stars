/**
 * RepairEventChannel — turns per-frame repair trickles into readable pulses
 * and fans them out to subscribers (the overlay shimmer, the drone VFX).
 *
 * Shield regen restores a few hundredths of a point per frame; reacting to
 * each would make the cue flicker. The channel delivers the FIRST trickle of
 * a repair immediately (feedback within a frame), then folds further
 * trickles into one pulse per {@link REPAIR_PULSE_INTERVAL_MS} per
 * (ship, kind, source). Discrete repairs (a commander's repair order) use
 * {@link RepairEventChannel.publish} and bypass the timer.
 *
 * Framework-free and deterministic: time only advances through `tick`.
 * Pending pulse records are reused, so steady-state reporting allocates no
 * new records.
 */

import {
  detectRepairs,
  type RepairEvent,
  type RepairKind,
  type RepairObservation,
  type RepairSourceKind,
} from "./RepairEvents";

/** One pulse per source every tabletop maneuver cycle (500 ms). */
export const REPAIR_PULSE_INTERVAL_MS = 500;

/** Receives every delivered repair event. */
export type RepairListener = (event: RepairEvent) => void;

/** Mutable accumulator for one (ship, kind, source) stream. */
interface PendingPulse {
  shipId: string;
  kind: RepairKind;
  sourceShipId: string | null;
  sourceKind: RepairSourceKind;
  amount: number;
  sinceEmitMs: number;
}

/**
 * Stable key of a repair stream.
 * @param event - Any event of the stream.
 * @returns The key.
 */
function streamKey(event: RepairEvent): string {
  return `${event.shipId}|${event.kind}|${event.sourceKind}|${event.sourceShipId ?? ""}`;
}

/** Pulse-folding publish/subscribe channel for repair events. */
export class RepairEventChannel {
  private readonly listeners = new Set<RepairListener>();
  private readonly pending = new Map<string, PendingPulse>();

  /**
   * @param intervalMs - Minimum time between two pulses of one stream.
   */
  constructor(private readonly intervalMs: number = REPAIR_PULSE_INTERVAL_MS) {}

  /**
   * Register a listener.
   * @param listener - Called with each delivered event.
   * @returns A function that unsubscribes the listener.
   */
  subscribe(listener: RepairListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Deliver an event to every listener now (discrete repairs).
   * @param event - The repair.
   */
  publish(event: RepairEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  /**
   * Report a repair trickle; it is delivered now if its stream is idle,
   * otherwise folded into the stream's next pulse.
   * @param event - The trickle.
   */
  report(event: RepairEvent): void {
    const key = streamKey(event);
    let pulse = this.pending.get(key);
    if (!pulse) {
      pulse = { ...event, amount: 0, sinceEmitMs: this.intervalMs };
      this.pending.set(key, pulse);
    }
    pulse.amount += event.amount;
    if (pulse.sinceEmitMs >= this.intervalMs) this.flush(pulse);
  }

  /**
   * Detect the repairs between two durability snapshots and report them.
   * @param observation - Before/after values and the known source.
   */
  observe(observation: RepairObservation): void {
    for (const event of detectRepairs(observation)) this.report(event);
  }

  /**
   * Advance time; streams whose interval elapsed deliver their pulse.
   * @param deltaMs - Elapsed time (ms).
   */
  tick(deltaMs: number): void {
    for (const pulse of this.pending.values()) {
      pulse.sinceEmitMs += deltaMs;
      if (pulse.amount > 0 && pulse.sinceEmitMs >= this.intervalMs) {
        this.flush(pulse);
      }
    }
  }

  /**
   * Drop every pending stream of a ship (destroyed / removed).
   * @param shipId - The ship.
   */
  forget(shipId: string): void {
    for (const [key, pulse] of this.pending) {
      if (pulse.shipId === shipId) this.pending.delete(key);
    }
  }

  /**
   * Deliver a stream's accumulated amount and restart its timer.
   * @param pulse - The stream.
   */
  private flush(pulse: PendingPulse): void {
    const event: RepairEvent = {
      shipId: pulse.shipId,
      kind: pulse.kind,
      amount: pulse.amount,
      sourceShipId: pulse.sourceShipId,
      sourceKind: pulse.sourceKind,
    };
    pulse.amount = 0;
    pulse.sinceEmitMs = 0;
    this.publish(event);
  }
}
