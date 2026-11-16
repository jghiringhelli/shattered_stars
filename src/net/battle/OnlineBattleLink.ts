/**
 * OnlineBattleLink — what a battle scene holds while it runs an online
 * match: the lockstep session bound to the relay (OnlineSession.startLockstep),
 * the local pilot's sampler, a per-tick hash trace (desync diagnostics and
 * the e2e determinism check), HUD notices for peers and resyncs, and the
 * match result. The scene supplies its LockstepSimulation every frame.
 * Phaser-free.
 */

import type { BoundLockstep, OnlineSession } from "../lobby/OnlineSession";
import { lockTrickRuleToIdentity } from "../../arcade/systems/FlightCapabilities";
import { lockSteeringToOnlineMode } from "../../arcade/systems/SteeringMode";
import { EDGE_MASK, type PilotCommand } from "../input/PilotInputCodec";
import type {
  FrameResult,
  LockstepSimulation,
  LockstepStats,
} from "../lockstep/types";
import type { MatchStart, TeamId } from "../protocol";
import { LocalPilotSampler, type PilotIntentSource } from "./LocalPilotSampler";
import {
  noticeForPeer,
  noticeForResync,
  type OnlineNotice,
} from "./onlineNotices";

export type { OnlineNotice } from "./onlineNotices";

/** Ticks of hash trace kept (3 minutes at 60 Hz). */
export const TRACE_TICKS = 10_800;

/** How a battle scene starts its online link. */
export interface OnlineBattleOptions {
  /** The local pilot's input (InputManager). */
  readonly intents: PilotIntentSource;
  /** A notice for the HUD (peer dropped / back, resync). */
  readonly onNotice?: (notice: OnlineNotice) => void;
  /** The relay ended the match (`winnerTeam` null = draw or abandoned). */
  readonly onMatchEnd?: (
    reason: "finished" | "abandoned",
    winnerTeam: TeamId | null,
  ) => void;
}

/** What the e2e tests and the HUD read. */
export interface OnlineBattleDebug {
  readonly tick: number;
  readonly status: string;
  readonly inputDelay: number;
  readonly stats: Readonly<LockstepStats>;
  /** [tick, hash] for the last {@link TRACE_TICKS} ticks simulated. */
  readonly hashes: [number, number][];
}

/**
 * @param session - The game's OnlineSession (registry).
 * @param options - Local input and HUD callbacks.
 * @returns The link, or null when no match is running.
 */
export function startOnlineBattle(
  session: OnlineSession,
  options: OnlineBattleOptions,
): OnlineBattleLink | null {
  const match = session.state.match;
  if (!match) {
    lockTrickRuleToIdentity(false);
    lockSteeringToOnlineMode(false);
    return null;
  }
  // Lockstep needs identical rules everywhere: the local "Full card" setting must not apply.
  lockTrickRuleToIdentity(true);
  lockSteeringToOnlineMode(true);
  let link: OnlineBattleLink | null = null;
  const bound = session.startLockstep({
    edgeMask: EDGE_MASK,
    events: {
      onPeer: (seat, status, graceMs) =>
        options.onNotice?.(noticeForPeer(match, seat, status, graceMs)),
      onResync: (_tick, reason) => options.onNotice?.(noticeForResync(reason)),
      onSnapshotApplied: () =>
        options.onNotice?.({ text: "Back in sync", tone: "success" }),
      onMatchEnd: (reason, winner) => {
        link?.closeLocally();
        options.onMatchEnd?.(reason, winner);
      },
    },
  });
  if (!bound) {
    lockTrickRuleToIdentity(false);
    lockSteeringToOnlineMode(false);
    return null;
  }
  const resumed = session.client.on("match_start", (message) => {
    if (message.resume && message.match.matchId === match.matchId)
      bound.session.markLoaded();
  });
  link = new OnlineBattleLink(match, bound, options.intents, resumed);
  return link;
}

export class OnlineBattleLink {
  private readonly sampler: LocalPilotSampler;
  private readonly trace = new Map<number, number>();
  private reported = false;
  private disposed = false;

  /**
   * @param match - The match as the relay started it.
   * @param bound - The lockstep session bound to the relay.
   * @param intents - The local pilot's input.
   * @param unsubscribeResume - Stops the reconnect listener.
   */
  constructor(
    readonly match: MatchStart,
    private readonly bound: BoundLockstep,
    intents: PilotIntentSource,
    private readonly unsubscribeResume: () => void,
  ) {
    this.sampler = new LocalPilotSampler(intents);
    this.sampler.attach();
  }

  /** @returns This client's seat. */
  get localSeat(): number {
    return this.bound.localSeat;
  }

  /** @returns Diagnostics (tick, status, delay, counters, hash trace). */
  get debug(): OnlineBattleDebug {
    const { session } = this.bound;
    return {
      tick: session.tick,
      status: session.status,
      inputDelay: session.inputDelay,
      stats: { ...session.stats },
      hashes: [...this.trace.entries()],
    };
  }

  /** The battle is built: the relay starts the match once every seat is. */
  markLoaded(): void {
    this.bound.session.markLoaded();
  }

  /** @param command - Sent with the next input (a reinforcement pick). */
  queueCommand(command: PilotCommand): void {
    this.sampler.queueCommand(command);
  }

  /**
   * One rendered frame: sample the local pilot, run every due tick.
   * @param frameMs - Real time since the last frame (ms).
   * @param sim - The scene's simulation.
   * @returns What the frame did.
   */
  frame(frameMs: number, sim: LockstepSimulation): FrameResult {
    if (this.disposed) return { ticksRun: 0, stalled: false, alpha: 0 };
    this.bound.session.sampleInput(this.sampler.sample());
    return this.bound.session.update(frameMs, this.traced(sim));
  }

  /** @param winnerTeam - The team this client's simulation says won (null = draw). Sent once. */
  reportMatchOver(winnerTeam: TeamId | null): void {
    if (this.reported) return;
    this.reported = true;
    this.bound.session.reportMatchOver(winnerTeam);
  }

  /** Quit mid-match: the AI flies this seat for the others. */
  leave(): void {
    if (this.bound.session.status !== "ended") this.bound.session.leave();
  }

  /** The match is over here: stop sampling (the relay connection stays). */
  closeLocally(): void {
    this.sampler.detach();
  }

  /** Scene shutdown: stop listening to the relay. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    lockTrickRuleToIdentity(false);
    lockSteeringToOnlineMode(false);
    this.sampler.detach();
    this.unsubscribeResume();
    this.bound.dispose();
  }

  private traced(sim: LockstepSimulation): LockstepSimulation {
    return {
      step: (tick, inputs) => {
        sim.step(tick, inputs);
        this.trace.set(tick, sim.hash(tick) >>> 0);
        if (this.trace.size > TRACE_TICKS)
          this.trace.delete(this.trace.keys().next().value as number);
      },
      hash: (tick) => sim.hash(tick),
      snapshot: (tick) => sim.snapshot(tick),
      restore: (tick, data) => {
        for (const traced of [...this.trace.keys()])
          if (traced > tick) this.trace.delete(traced);
        sim.restore(tick, data);
      },
    };
  }
}
