/**
 * LockstepHarness — runs N simulated players through a relay over simulated
 * links on a virtual clock, then compares their per-tick state hashes and
 * reports stalls and bandwidth. The net-layer tests assert on it and
 * scripts/net_measure.ts prints its numbers for the netcode ADR.
 */

import {
  TICK_MS,
  type Loadout,
  type MatchMode,
  type MatchStart,
  type TickInput,
} from "../protocol";
import type { LockstepSimulation } from "../lockstep/types";
import { DeterministicRng } from "../lockstep/DeterministicRng";
import { HarnessClient, type HarnessClientSpec } from "./HarnessClient";
import type { RelayHost } from "./RelayHost";
import type { VirtualScheduler } from "./VirtualScheduler";

/** Harness setup. */
export interface HarnessOptions {
  readonly relay: RelayHost;
  readonly scheduler: VirtualScheduler;
  readonly clients: readonly HarnessClientSpec[];
  readonly seed: number;
  readonly createSim: (match: MatchStart) => LockstepSimulation;
  readonly input: (client: number, tick: number) => TickInput;
  readonly mode?: MatchMode;
  readonly loadout?: Loadout;
  readonly frameMs?: number;
  readonly edgeMask?: number;
  /** Per-client adaptive input delay (default on). */
  readonly adaptiveDelay?: boolean;
}

/** Result of comparing every client's per-tick hashes. */
export interface HashComparison {
  /** Ticks every client simulated. */
  readonly compared: number;
  readonly mismatches: number;
  readonly firstMismatch: number | null;
  readonly lastMismatch: number | null;
}

/** One client's numbers over a run. */
export interface ClientMetrics {
  readonly name: string;
  readonly ticks: number;
  /** Share of frames that wanted a tick but had to wait. */
  readonly stallFramePct: number;
  readonly stallMs: number;
  readonly longestStallMs: number;
  readonly upBytesPerS: number;
  readonly downBytesPerS: number;
  readonly upMessagesPerS: number;
  readonly resyncs: number;
}

/** Longest the lobby may take to reach `go` (virtual ms). */
const START_TIMEOUT_MS = 60_000;
/** Lobby polling step (virtual ms). */
const START_POLL_MS = 10;

export class LockstepHarness {
  readonly clients: HarnessClient[];
  private code: string | null = null;

  /** @param options - Relay, clock, players, simulation and input script. */
  constructor(private readonly options: HarnessOptions) {
    const rng = new DeterministicRng(options.seed);
    const random = (): number => rng.next();
    this.clients = options.clients.map(
      (spec, index) =>
        new HarnessClient(index, spec, {
          scheduler: options.scheduler,
          relay: options.relay,
          random,
          mode: options.mode ?? "dogfight",
          loadout: options.loadout ?? {
            faction: "free_confederation",
            ships: ["confed_falcon"],
          },
          frameMs: options.frameMs ?? TICK_MS,
          edgeMask: options.edgeMask ?? 0,
          adaptiveDelay: options.adaptiveDelay ?? true,
          createSim: options.createSim,
          input: options.input,
          roomCode: () => this.code,
          publishCode: (code) => {
            this.code = code;
          },
          latency: (client) => this.latencyFor(client),
        }),
    );
  }

  /** @returns Whether every client reached a running match before the timeout. */
  start(): boolean {
    for (const client of this.clients) client.connect();
    for (let waited = 0; waited < START_TIMEOUT_MS; waited += START_POLL_MS) {
      for (const client of this.clients) client.joinIfReady();
      if (
        this.clients.every((c) => c.session && c.session.status !== "loading")
      )
        return true;
      this.options.scheduler.advance(START_POLL_MS);
    }
    return false;
  }

  /** @param ms - Virtual time to run. */
  run(ms: number): void {
    this.options.scheduler.advance(ms);
  }

  /** @returns Agreement of every tick all clients simulated. */
  compareHashes(): HashComparison {
    const [first, ...rest] = this.clients;
    let compared = 0;
    let mismatches = 0;
    let firstMismatch: number | null = null;
    let lastMismatch: number | null = null;
    for (const [tick, hash] of first?.hashes ?? []) {
      if (!rest.every((c) => c.hashes.has(tick))) continue;
      compared++;
      if (rest.every((c) => c.hashes.get(tick) === hash)) continue;
      mismatches++;
      firstMismatch ??= tick;
      lastMismatch = tick;
    }
    return { compared, mismatches, firstMismatch, lastMismatch };
  }

  /** @param durationMs - Length of the measured run. @returns Per-client numbers. */
  metrics(durationMs: number): ClientMetrics[] {
    const seconds = durationMs / 1000;
    return this.clients.map((c) => {
      const stats = c.session?.stats;
      const frames = durationMs / (this.options.frameMs ?? TICK_MS);
      return {
        name: c.spec.name,
        ticks: stats?.ticksRun ?? 0,
        stallFramePct: (100 * (stats?.stallFrames ?? 0)) / Math.max(1, frames),
        stallMs: stats?.stallMs ?? 0,
        longestStallMs: stats?.longestStallMs ?? 0,
        upBytesPerS: (stats?.bytesSent ?? 0) / seconds,
        downBytesPerS: c.bytesDown / seconds,
        upMessagesPerS: (stats?.messagesSent ?? 0) / seconds,
        resyncs: stats?.resyncs ?? 0,
      };
    });
  }

  private latencyFor(client: number): { selfRttMs: number; peerRttMs: number } {
    // Jitter-inclusive round trip, as NetClient reports it (smoothed RTT + 2 × jitter ≈ the worst case).
    const rtt = (spec: HarnessClientSpec): number =>
      spec.up.latencyMs +
      spec.down.latencyMs +
      spec.up.jitterMs +
      spec.down.jitterMs;
    const self = this.options.clients[client];
    const peers = this.options.clients.filter((_, i) => i !== client).map(rtt);
    return {
      selfRttMs: self ? rtt(self) : 0,
      peerRttMs: Math.max(0, ...peers),
    };
  }
}
