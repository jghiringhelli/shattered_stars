/**
 * HarnessClient — one simulated player for the latency simulator: a socket
 * made of two LatencyLanes, the lobby script (create or join, loadout,
 * ready), and a LockstepSession driving a simulation once the match starts,
 * rendered at a (jittery) frame rate on the virtual clock.
 */

import {
  PROTOCOL_VERSION,
  type ClientMessage,
  type Loadout,
  type MatchMode,
  type MatchStart,
  type ServerMessage,
  type TeamId,
  type TickInput,
} from "../protocol";
import { repeatEvery, type TimerHandle } from "../time";
import { LockstepSession } from "../lockstep/LockstepSession";
import type { LatencyEstimate, LockstepSimulation } from "../lockstep/types";
import { LatencyLane, type LinkConditions } from "./LatencyLane";
import type { RelayEndpoint, RelayHost } from "./RelayHost";
import type { VirtualScheduler } from "./VirtualScheduler";

/** A simulated player. */
export interface HarnessClientSpec {
  readonly name: string;
  readonly up: LinkConditions;
  readonly down: LinkConditions;
  /** Render-frame jitter (ms, uniform ±). */
  readonly frameJitterMs?: number;
}

/** Shared wiring the harness gives each client. */
export interface HarnessWiring {
  readonly scheduler: VirtualScheduler;
  readonly relay: RelayHost;
  readonly random: () => number;
  readonly mode: MatchMode;
  readonly loadout: Loadout;
  readonly frameMs: number;
  readonly edgeMask: number;
  readonly adaptiveDelay: boolean;
  readonly createSim: (match: MatchStart) => LockstepSimulation;
  readonly input: (client: number, tick: number) => TickInput;
  readonly roomCode: () => string | null;
  readonly publishCode: (code: string) => void;
  readonly latency: (client: number) => LatencyEstimate;
}

export class HarnessClient {
  session: LockstepSession | null = null;
  sim: LockstepSimulation | null = null;
  /** Hash after every simulated (or restored) tick. */
  readonly hashes = new Map<number, number>();
  readonly errors: string[] = [];
  bytesDown = 0;
  playerId = "";
  private token: string | null = null;
  private endpoint: RelayEndpoint | null = null;
  private up: LatencyLane<ClientMessage> | null = null;
  private down: LatencyLane<ServerMessage> | null = null;
  private frames: TimerHandle | null = null;
  private configured = false;
  private joined = false;
  private reloadOnResume = false;

  /** @param index - Client number. @param spec - Name and links. @param wiring - Shared wiring. */
  constructor(
    readonly index: number,
    readonly spec: HarnessClientSpec,
    private readonly wiring: HarnessWiring,
  ) {}

  /** Open the socket and say hello (with the resume token after a drop). */
  connect(): void {
    const { scheduler, random, relay } = this.wiring;
    this.down = new LatencyLane<ServerMessage>(
      scheduler,
      this.spec.down,
      random,
      (m) => this.onServer(m),
    );
    const endpoint = relay.open((m) => {
      this.bytesDown += JSON.stringify(m).length;
      this.down?.send(m);
    });
    this.endpoint = endpoint;
    this.up = new LatencyLane<ClientMessage>(
      scheduler,
      this.spec.up,
      random,
      (m) => endpoint.receive(m),
    );
    this.send({
      t: "hello",
      protocol: PROTOCOL_VERSION,
      build: "harness",
      name: this.spec.name,
      ...(this.token ? { token: this.token } : {}),
    });
    this.frames ??= this.startFrames();
  }

  /** @param reload - Also lose the simulation (a page reload) instead of a socket blip. */
  drop(reload = false): void {
    this.up?.cut();
    this.down?.cut();
    this.endpoint?.close();
    this.reloadOnResume = reload;
    if (reload) {
      this.session = null;
      this.sim = null;
    }
  }

  /** Lobby: join the published room once its code is known. */
  joinIfReady(): void {
    const code = this.wiring.roomCode();
    if (this.joined || this.index === 0 || !code || !this.playerId) return;
    this.joined = true;
    this.send({ t: "join_room", code });
  }

  /** Stop rendering frames. */
  stop(): void {
    this.frames?.cancel();
    this.frames = null;
  }

  private onServer(message: ServerMessage): void {
    switch (message.t) {
      case "welcome":
        this.token = message.token;
        this.playerId = message.playerId;
        // Report the link's round trip, as NetClient's heartbeat does, so the relay sizes the input delay.
        this.send({
          t: "ping",
          id: 1,
          ct: this.wiring.scheduler.now(),
          rtt: this.wiring.latency(this.index).selfRttMs,
        });
        if (this.index === 0 && !this.joined) {
          this.joined = true;
          this.send({ t: "create_room", mode: this.wiring.mode });
        }
        return this.joinIfReady();
      case "room":
        return this.onRoom(
          message.room.code,
          message.room.players.find((p) => p.id === this.playerId)?.team ??
            null,
        );
      case "match_start":
        return this.onMatchStart(message.match);
      case "error":
        this.errors.push(message.code);
        return;
      default:
        this.session?.receive(message);
    }
  }

  private onRoom(code: string, team: TeamId | null): void {
    if (this.index === 0 && !this.wiring.roomCode())
      this.wiring.publishCode(code);
    if (team === null || this.configured) return;
    this.configured = true;
    // Both teams fly the harness loadout: a side is a team, never a faction.
    this.send({ t: "set_loadout", loadout: this.wiring.loadout });
    this.send({ t: "set_ready", ready: true });
  }

  private onMatchStart(match: MatchStart): void {
    if (!this.session || this.reloadOnResume) {
      const localSeat =
        match.seats.find((s) => s.playerId === this.playerId)?.seat ?? 0;
      const sim = this.recording(this.wiring.createSim(match));
      this.sim = sim;
      this.session = new LockstepSession({
        match,
        localSeat,
        clock: this.wiring.scheduler,
        edgeMask: this.wiring.edgeMask,
        adaptiveDelay: this.wiring.adaptiveDelay,
        outbox: { send: (m) => this.send(m) },
        latency: () => this.wiring.latency(this.index),
      });
      this.reloadOnResume = false;
    }
    this.session.markLoaded();
  }

  private recording(sim: LockstepSimulation): LockstepSimulation {
    return {
      step: (tick, inputs) => {
        sim.step(tick, inputs);
        this.hashes.set(tick, sim.hash(tick));
      },
      hash: (tick) => sim.hash(tick),
      snapshot: (tick) => sim.snapshot(tick),
      restore: (tick, data) => {
        sim.restore(tick, data);
        this.hashes.set(tick, sim.hash(tick));
      },
    };
  }

  private startFrames(): TimerHandle {
    const { scheduler, frameMs, random } = this.wiring;
    let last = scheduler.now();
    const jitter = this.spec.frameJitterMs ?? 0;
    return repeatEvery(
      scheduler,
      () => {
        const now = scheduler.now();
        const elapsed = now - last + (random() * 2 - 1) * jitter;
        last = now;
        const session = this.session;
        if (!session || !this.sim) return;
        session.sampleInput(this.wiring.input(this.index, session.tick + 1));
        session.update(Math.max(0, elapsed), this.sim);
      },
      frameMs,
    );
  }

  private send(message: ClientMessage): void {
    this.up?.send(message);
  }
}
