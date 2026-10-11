/**
 * DuelBotCrew — the AI crew of a duel battle (Dogfight, Ace Duel and the
 * headless DuelTempoSim, so the simulation flies exactly what the scenes
 * fly): one BotPilot per AI ship, one SquadCommand per side that starts the
 * round with two or more ships, and the battle's squad marks.
 *
 * - AI sides lead themselves (`aiLeader: true`): the squad's focus is its mark.
 * - The human's side follows the player's mark (R → markTarget); its AI
 *   wingmen focus it.
 * - The mark is a squad order: a shot gets the mark bonus only when the
 *   shooter's side flies as a squad (SquadMark: pilots flying on their own
 *   have no mark). A lone pilot's mark is still stored and shown on the HUD.
 *
 * One crew per round (ships respawn, pilots start fresh). Pure: no Phaser.
 */

import {
  BotPilot,
  SquadCommand,
  type BotContact,
  type BotSkill,
  type SideKey,
} from "../ai";
import type { ManeuverDefinition } from "../../core/types";
import type { CycleFlightState } from "./CycleFlight";
import type { FlightControlResult } from "./PilotFlightTypes";
import {
  NO_SQUAD_MARKS,
  forgetMarkedTarget,
  isMarkedBy,
  markedTargetOf,
  placeMark,
  type SquadMarks,
} from "./SquadMark";

/** A side flies as a squad when it starts the round with this many ships. */
export const MIN_SQUAD_SIZE = 2;

/** What the crew reads of a duel ship record. */
export interface DuelCrewShip {
  readonly id: string;
  readonly definitionId: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
  readonly combatStats: {
    /** Full primary firing arc (°). */
    readonly firingArc: number;
    /** Primary weapon range (px). */
    readonly weaponRange: number;
  };
  readonly flight: CycleFlightState;
  readonly dial: readonly ManeuverDefinition[];
}

/** One ship of the round and who flies it. */
export interface DuelCrewMember {
  readonly shipId: string;
  readonly side: SideKey;
  /** The bot skill flying it, or null for a human (local or remote). */
  readonly skill: BotSkill | null;
}

/** How a round's crew is made up. */
export interface DuelCrewOptions {
  /** Every ship of the round. */
  readonly roster: readonly DuelCrewMember[];
  /** The side the human leads (its squad follows the player's mark); null = AI only. */
  readonly playerSide: SideKey | null;
  /** Uniform random source in [0, 1) every pilot draws from. */
  readonly random: () => number;
  /** Torus edge (px). */
  readonly worldSize: number;
}

export class DuelBotCrew {
  private readonly sides = new Map<string, SideKey>();
  private readonly pilotsById = new Map<string, BotPilot>();
  private readonly squads = new Map<SideKey, SquadCommand>();
  private currentMarks: SquadMarks = NO_SQUAD_MARKS;

  /** @param options - Roster, the human's side, random source, world size. */
  constructor(private readonly options: DuelCrewOptions) {
    for (const member of options.roster) {
      this.sides.set(member.shipId, member.side);
      if (!member.skill) continue;
      const { tier, reactionScale } = member.skill;
      this.pilotsById.set(
        member.shipId,
        new BotPilot(tier, { reactionScale, random: options.random }),
      );
    }
    for (const side of new Set(this.sides.values())) {
      if (this.sizeOf(side) < MIN_SQUAD_SIZE) continue;
      this.squads.set(
        side,
        new SquadCommand({
          side,
          aiLeader: side !== options.playerSide,
          worldSize: options.worldSize,
        }),
      );
    }
  }

  /** The bot flying each AI ship, by ship id. */
  get pilots(): ReadonlyMap<string, BotPilot> {
    return this.pilotsById;
  }

  /** The battle's current squad marks (all sides). */
  get marks(): SquadMarks {
    return this.currentMarks;
  }

  /**
   * @param side - A side key.
   * @returns Whether that side flies as a squad (has a SquadCommand).
   */
  isSquad(side: SideKey): boolean {
    return this.squads.has(side);
  }

  /**
   * @param shipId - A ship of the round.
   * @returns Its side, or null for an unknown ship.
   */
  sideOf(shipId: string): SideKey | null {
    return this.sides.get(shipId) ?? null;
  }

  /**
   * @param ships - Every ship of the round (dead ones included).
   * @returns Each rostered ship as the AI sees it.
   */
  contactsOf(ships: Iterable<DuelCrewShip>): BotContact[] {
    const contacts: BotContact[] = [];
    for (const ship of ships) {
      const side = this.sides.get(ship.id);
      if (side !== undefined) contacts.push(contactOf(ship, side));
    }
    return contacts;
  }

  /**
   * Every squad updates its orders and its side's mark.
   * @param contacts - Every ship as the AI sees it (contactsOf).
   * @param nowMs - Battle time (ms).
   */
  command(contacts: readonly BotContact[], nowMs: number): void {
    for (const squad of this.squads.values()) {
      this.currentMarks = squad.update({
        nowMs,
        ships: contacts,
        marks: this.currentMarks,
      });
    }
  }

  /**
   * The ship's bot flies one frame through the player's controls.
   * @param ship - The ship.
   * @param contacts - Every ship as the AI sees it (contactsOf).
   * @param nowMs - Battle time (ms).
   * @param deltaMs - Frame length (ms).
   * @returns New motion / stress / events to apply like the player's, or
   *   null when no bot flies this ship.
   */
  fly(
    ship: DuelCrewShip,
    contacts: readonly BotContact[],
    nowMs: number,
    deltaMs: number,
  ): FlightControlResult | null {
    const pilot = this.pilotsById.get(ship.id);
    const self = contacts.find((contact) => contact.id === ship.id);
    if (!pilot || !self) return null;
    return pilot.fly({
      self,
      flight: ship.flight,
      dial: ship.dial,
      contacts: contacts.filter((contact) => contact.id !== ship.id),
      order: this.squads.get(self.side)?.orderFor(ship.id) ?? null,
      nowMs,
      deltaMs,
      worldSize: this.options.worldSize,
    });
  }

  /**
   * Tell a ship's bot (if any) that its cycle committed.
   * @param ship - The ship whose maneuver cycle just committed.
   */
  onCycleCommitted(ship: DuelCrewShip): void {
    const started = ship.flight.motion.control.currentManeuver ?? "straight";
    this.pilotsById.get(ship.id)?.onCycleCommitted(started);
  }

  /**
   * @param shipId - An AI ship.
   * @returns The enemy its bot is trying to shoot, or null.
   */
  targetOf(shipId: string): string | null {
    return this.pilotsById.get(shipId)?.targetId ?? null;
  }

  /**
   * The human marks a target for their side (R / gamepad R3).
   * @param side - The marking side.
   * @param targetId - The enemy marked.
   * @param nowMs - Battle time (ms).
   */
  markTarget(side: SideKey, targetId: string, nowMs: number): void {
    this.currentMarks = placeMark(this.currentMarks, side, targetId, nowMs);
  }

  /**
   * @param side - A side.
   * @param nowMs - Battle time (ms).
   * @returns The side's live marked target, or null.
   */
  markedTargetOf(side: SideKey, nowMs: number): string | null {
    return markedTargetOf(this.currentMarks, side, nowMs);
  }

  /**
   * @param attackerId - The shooter.
   * @param targetId - The ship shot at.
   * @param nowMs - Battle time (ms).
   * @returns Whether the shot gets the squad-mark bonus (the shooter's
   *   side flies as a squad and has this target marked).
   */
  isMarkedShot(attackerId: string, targetId: string, nowMs: number): boolean {
    const side = this.sides.get(attackerId);
    if (side === undefined || !this.squads.has(side)) return false;
    return isMarkedBy(this.currentMarks, side, targetId, nowMs);
  }

  /**
   * A ship was destroyed: every mark on it lapses.
   * @param shipId - The destroyed ship.
   */
  forget(shipId: string): void {
    this.currentMarks = forgetMarkedTarget(this.currentMarks, shipId);
  }

  /**
   * @param side - A side.
   * @returns How many ships of the roster fly for it.
   */
  private sizeOf(side: SideKey): number {
    return this.options.roster.filter((m) => m.side === side).length;
  }
}

/**
 * @param ship - A duel ship record.
 * @param side - Its side.
 * @returns The ship as the AI sees it.
 */
export function contactOf(ship: DuelCrewShip, side: SideKey): BotContact {
  return {
    id: ship.id,
    side,
    definitionId: ship.definitionId,
    x: ship.x,
    y: ship.y,
    angle: ship.angle,
    alive: ship.hull > 0,
    hull: ship.hull,
    maxHull: ship.maxHull,
    shields: ship.shields,
    maxShields: ship.maxShields,
    firingArcDeg: ship.combatStats.firingArc,
    weaponRange: ship.combatStats.weaponRange,
    speed: ship.flight.motion.control.speed,
    isStressed: ship.flight.stress.isStressed,
  };
}
