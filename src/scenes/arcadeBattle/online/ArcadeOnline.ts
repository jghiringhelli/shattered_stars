/**
 * ArcadeOnline — the online Skirmish / Scenario / Reinforcements battle's
 * seat model, owned by ArcadeBattleScene during an online match:
 * - reads the canonical seats from the lobby's battle config (seat order,
 *   squad, faction, team — teams are independent of factions: mirror and
 *   mixed-faction teams are fine); seat 0's team is the simulation's
 *   "player" side on every client, only presentation reads the local seat;
 * - one SeatInput per human seat, fed from the lockstep tick, and which
 *   ship each seat flies (a seat whose ship is lost flies the replacement
 *   its own squad's picker deploys; the relay may hand a seat to the AI);
 * - the match's saveable RNGs (combat dice, bot fleet).
 * Pure: no Phaser.
 */

import type { ActionIntent } from "../../../input/InputTypes";
import { SeatInput } from "../../../net/battle/SeatInput";
import { decodePilotInput } from "../../../net/input/PilotInputCodec";
import { DeterministicRng } from "../../../net/lockstep/DeterministicRng";
import type { OnlineBattleContext } from "../../../net/lobby/matchSetup";
import type { TeamId, TickInput } from "../../../net/protocol";
import { parseTeamId, teamKey } from "../../../arcade/teams";

/** One human seat of the battle. */
export interface OnlineArcadeSeat {
  readonly seat: number;
  /** Its squad's index in the battle config. */
  readonly squad: number;
  readonly faction: string;
  readonly team: TeamId;
}

/** The online part of an ArcadeBattleScene battle config. */
export interface OnlineArcadeBattle {
  readonly seed: number;
  readonly localSeat: number;
  readonly context: OnlineBattleContext;
  /** Human seats in seat order. */
  readonly seats: readonly OnlineArcadeSeat[];
}

/** A pilot's keys for one step (InputManager offline, a seat online). */
export interface PilotKeys {
  held(intent: ActionIntent): boolean;
  /** A press this step, consumed. */
  consume(intent: ActionIntent): boolean;
  /** A press this step, not consumed. */
  pressed(intent: ActionIntent): boolean;
}

/** Combat dice draw from a different stream than the bot fleet's. */
const COMBAT_SEED_SALT = 0x9e3779b9;

/**
 * @param config - The registry's battle config.
 * @returns Its online battle, or null for a local battle.
 */
export function readOnlineBattle(config: unknown): OnlineArcadeBattle | null {
  const c = config as
    | {
        seed?: unknown;
        online?: OnlineBattleContext;
        factions?: Array<{ factionId: string; teamId?: string; seat?: number }>;
      }
    | undefined;
  if (!c?.online || typeof c.seed !== "number" || !c.factions) return null;
  const seats = c.factions
    .flatMap((f, squad) =>
      typeof f.seat === "number"
        ? [
            {
              seat: f.seat,
              squad,
              faction: f.factionId,
              team: (parseTeamId(f.teamId) ?? 0) as TeamId,
            },
          ]
        : [],
    )
    .sort((a, b) => a.seat - b.seat);
  return {
    seed: c.seed,
    localSeat: c.online.localSeat,
    context: c.online,
    seats,
  };
}

export class ArcadeOnline {
  readonly seats: SeatInput[];
  readonly combatRng: DeterministicRng;
  readonly fleetRng: DeterministicRng;
  private seatShips: (string | null)[];

  /** @param battle - The online battle (seats, local seat, seed). */
  constructor(readonly battle: OnlineArcadeBattle) {
    this.seats = battle.seats.map(() => new SeatInput());
    this.seatShips = battle.seats.map(() => null);
    this.fleetRng = new DeterministicRng(battle.seed);
    this.combatRng = new DeterministicRng(
      (battle.seed ^ COMBAT_SEED_SALT) >>> 0,
    );
  }

  /** @returns The seat this client flies. */
  get localSeat(): number {
    return this.battle.localSeat;
  }

  /** @returns The faction this client flies (music, stingers). */
  get localFaction(): string {
    return this.battle.seats[this.localSeat]?.faction ?? "";
  }

  /** @returns The team this client flies for (allies, HUD, colours). */
  get localTeam(): TeamId {
    return this.battle.seats[this.localSeat]?.team ?? 0;
  }

  /** @returns The squad this client flies (its picker). */
  get localSquad(): number {
    return this.squadOf(this.localSeat);
  }

  /** @returns Side keys of every team a human flies for (no AI leader). */
  get humanSides(): ReadonlySet<string> {
    return new Set(this.battle.seats.map((s) => teamKey(s.team)));
  }

  /** @param seat - A seat. @returns Its squad's config index, or -1. */
  squadOf(seat: number): number {
    return this.battle.seats[seat]?.squad ?? -1;
  }

  /** @param squad - A config squad. @returns The seat flying it, or -1. */
  seatOfSquad(squad: number): number {
    return this.battle.seats.findIndex((s) => s.squad === squad);
  }

  /** @param inputs - Every seat's input for this tick. */
  feed(inputs: readonly TickInput[]): void {
    inputs.forEach((input, seat) =>
      this.seats[seat]?.feed(decodePilotInput(input)),
    );
  }

  /** @param seat - A seat. @param shipId - The ship it flies from now on. */
  assignShip(seat: number, shipId: string): void {
    if (seat >= 0 && seat < this.seatShips.length)
      this.seatShips[seat] = shipId;
  }

  /** @param seat - A seat. @returns The ship it flies, or null. */
  shipOf(seat: number): string | null {
    return this.seatShips[seat] ?? null;
  }

  /** @param shipId - A ship. @returns The seat flying it, or -1. */
  seatOfShip(shipId: string): number {
    return this.seatShips.indexOf(shipId);
  }

  /** @param shipId - A ship. @returns Whether its seat's human flies it this tick. */
  isHumanFlown(shipId: string): boolean {
    const seat = this.seats[this.seatOfShip(shipId)];
    return seat !== undefined && !seat.aiControl;
  }

  /** @param seat - A seat. @returns Its keys this tick, or null. */
  keysOf(seat: number): PilotKeys | null {
    const input = this.seats[seat];
    if (!input) return null;
    return {
      held: (intent) => input.isHeld(intent),
      consume: (intent) => input.consume(intent),
      pressed: (intent) => input.pressed(intent),
    };
  }

  /**
   * @param seat0SideWon - Whether seat 0's side won (null = draw).
   * @returns The winning team, or null.
   */
  winnerTeam(seat0SideWon: boolean | null): TeamId | null {
    if (seat0SideWon === null) return null;
    const team = this.battle.seats[0]?.team ?? 0;
    return seat0SideWon ? team : ((1 - team) as TeamId);
  }

  /** @param seat0SideWon - Whether seat 0's side won. @returns Whether this client's side won. */
  localVictory(seat0SideWon: boolean): boolean {
    const local = this.battle.seats[this.localSeat]?.team;
    const seat0 = this.battle.seats[0]?.team;
    return local === seat0 ? seat0SideWon : !seat0SideWon;
  }
}
