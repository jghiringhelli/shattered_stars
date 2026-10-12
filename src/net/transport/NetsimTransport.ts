/**
 * NetsimTransport — wraps a real transport in the latency simulator's lanes
 * (LatencyLane: latency, jitter, TCP-like loss) in both directions, so two
 * browser windows on one machine play as if over a real network. Enabled
 * with `?netsim=latencyMs[,jitterMs[,lossRate]]` (one-way, client↔relay),
 * e.g. `?netsim=40,10,0.01`. Testing aid; never on by default.
 */

import { LatencyLane, type LinkConditions } from "../sim/LatencyLane";
import type { Scheduler } from "../time";
import type { TransportFactory } from "./Transport";

/** Most a `?netsim` latency or jitter may be (ms). */
const MAX_NETSIM_MS = 2000;

/**
 * @param value - The `netsim` query value.
 * @returns The link conditions, or null when absent or malformed.
 */
export function parseNetsim(value: string | null): LinkConditions | null {
  if (!value) return null;
  const [latency, jitter = 0, loss = 0] = value.split(",").map(Number);
  const valid = (n: number | undefined, max: number): boolean =>
    n !== undefined && Number.isFinite(n) && n >= 0 && n <= max;
  if (!valid(latency, MAX_NETSIM_MS) || !valid(jitter, MAX_NETSIM_MS))
    return null;
  if (!valid(loss, 1)) return null;
  return {
    latencyMs: latency!,
    jitterMs: jitter,
    lossRate: loss,
    lossMode: "retransmit",
  };
}

/** What the wrapper needs. */
export interface NetsimOptions {
  readonly scheduler: Scheduler;
  readonly conditions: LinkConditions;
  /** Uniform [0, 1) source for jitter and loss. */
  readonly random: () => number;
}

/**
 * @param base - The real transport factory (WebSocket).
 * @param options - Clock, link conditions and random source.
 * @returns A factory whose sockets delay every message both ways.
 */
export function netsimTransport(
  base: TransportFactory,
  options: NetsimOptions,
): TransportFactory {
  return (url, handlers) => {
    const lane = <T>(deliver: (message: T) => void): LatencyLane<T> =>
      new LatencyLane<T>(
        options.scheduler,
        options.conditions,
        options.random,
        deliver,
      );
    const incoming = lane<string>((text) => handlers.onMessage(text));
    const socket = base(url, {
      onOpen: () => handlers.onOpen(),
      onMessage: (text) => incoming.send(text),
      onClose: (code, reason) => {
        incoming.cut();
        outgoing.cut();
        handlers.onClose(code, reason);
      },
    });
    const outgoing = lane<string>((text) => socket.send(text));
    return {
      send: (text) => outgoing.send(text),
      close: (code, reason) => {
        outgoing.cut();
        incoming.cut();
        socket.close(code, reason);
      },
    };
  };
}
