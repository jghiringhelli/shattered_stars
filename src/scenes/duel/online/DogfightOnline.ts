/**
 * DogfightOnline — the online duel's simulation-side seat model, owned by
 * DogfightScene during an online match:
 * - canonical sides: seat 0 flies the "player" side (`player_0`), seat 1
 *   the "ai" side (`ai_0`) on every client; only presentation reads the
 *   local seat;
 * - one SeatInput + PlayerFlightPilot per seat, fed from the lockstep tick
 *   (a seat the relay hands to the AI is flown by its bot instead);
 * - round flow (banner → weapons live, round → next round / match end) as
 *   data timers on the simulation clock, so snapshots carry them;
 * - the match's saveable RNG.
 * Pure: no Phaser.
 */

import { lockTrickRuleToIdentity } from "../../../arcade/systems/FlightCapabilities";
import { PlayerFlightPilot } from "../../../arcade/systems/PlayerFlightPilot";
import { SeatInput } from "../../../net/battle/SeatInput";
import { decodePilotInput } from "../../../net/input/PilotInputCodec";
import { DeterministicRng } from "../../../net/lockstep/DeterministicRng";
import type {
  OnlineDogfightInit,
  OnlineDogfightSeat,
} from "../../../net/lobby/matchSetup";
import type { TeamId, TickInput } from "../../../net/protocol";

/** The duel's sides in seat order. */
export const DUEL_SIDES = ["player", "ai"] as const;
export type DuelSide = (typeof DUEL_SIDES)[number];

/** Round-flow events on the simulation clock. */
export type DuelTimerKind = "round_live" | "next_round" | "end_match";

/** A pending round-flow event. */
export interface DuelSimTimer {
  readonly atMs: number;
  readonly kind: DuelTimerKind;
}

/** A round result from seat 0's side. */
export type DuelRoundResult = "player_win" | "enemy_win" | "draw";

export class DogfightOnline {
  readonly seats: SeatInput[];
  readonly pilots: PlayerFlightPilot[];
  readonly rng: DeterministicRng;
  /** Simulation time (ms): tick × TICK_MS. */
  nowMs = 0;
  timers: DuelSimTimer[] = [];

  /** @param init - The online duel (canonical seats, local seat, seed). */
  constructor(readonly init: OnlineDogfightInit) {
    lockTrickRuleToIdentity(true);
    this.seats = init.seats.map(() => new SeatInput());
    this.pilots = this.seats.map((seat) => {
      const pilot = new PlayerFlightPilot(seat);
      pilot.attach();
      return pilot;
    });
    this.rng = new DeterministicRng(init.seed);
  }

  /** @returns The seat this client flies. */
  get localSeat(): number {
    return this.init.online.localSeat;
  }

  /** @returns The side this client flies. */
  get localSide(): DuelSide {
    return DUEL_SIDES[this.localSeat] ?? "player";
  }

  /** @returns The ship this client flies. */
  get localShipId(): string {
    return this.shipIdOf(this.localSeat);
  }

  /** @param seat - A seat. @returns Its seat entry. */
  seat(seat: number): OnlineDogfightSeat | undefined {
    return this.init.seats[seat];
  }

  /** @param seat - A seat. @returns The ship id it flies. */
  shipIdOf(seat: number): string {
    return `${DUEL_SIDES[seat] ?? "ai"}_0`;
  }

  /** @param shipId - A ship. @returns Its seat, or -1. */
  seatOf(shipId: string): number {
    return this.init.seats.findIndex(
      (_, seat) => this.shipIdOf(seat) === shipId,
    );
  }

  /** @param inputs - Every seat's input for this tick. */
  feed(inputs: readonly TickInput[]): void {
    inputs.forEach((input, seat) =>
      this.seats[seat]?.feed(decodePilotInput(input)),
    );
  }

  /** @param shipId - A ship. @returns Whether its seat's human flies it this tick. */
  isHumanFlown(shipId: string): boolean {
    const seat = this.seats[this.seatOf(shipId)];
    return seat !== undefined && !seat.aiControl;
  }

  /** @param shipId - A ship. @returns Its seat's pilot, or null. */
  pilotFor(shipId: string): PlayerFlightPilot | null {
    return this.pilots[this.seatOf(shipId)] ?? null;
  }

  /** @param delayMs - From now (sim clock). @param kind - What happens then. */
  schedule(delayMs: number, kind: DuelTimerKind): void {
    this.timers = [...this.timers, { atMs: this.nowMs + delayMs, kind }].sort(
      (a, b) => a.atMs - b.atMs,
    );
  }

  /** @returns The events due now, in order (removed). */
  takeDue(): DuelTimerKind[] {
    const due = this.timers.filter((t) => t.atMs <= this.nowMs);
    this.timers = this.timers.filter((t) => t.atMs > this.nowMs);
    return due.map((t) => t.kind);
  }

  /** @param result - A round or match result from seat 0's side. @returns The winning team, or null. */
  winnerTeam(result: DuelRoundResult): TeamId | null {
    if (result === "draw") return null;
    return this.seat(result === "player_win" ? 0 : 1)?.team ?? null;
  }

  /** @param result - A result from seat 0's side. @returns It from the local seat's side. */
  localResult(result: DuelRoundResult): DuelRoundResult {
    if (this.localSeat === 0 || result === "draw") return result;
    return result === "player_win" ? "enemy_win" : "player_win";
  }

  /** Forget every pilot's input memory (new round). */
  resetPilots(): void {
    this.pilots.forEach((pilot) => pilot.reset());
  }

  /** Stop the seat pilots listening (scene shutdown). */
  dispose(): void {
    lockTrickRuleToIdentity(false);
    this.pilots.forEach((pilot) => pilot.detach());
  }
}
