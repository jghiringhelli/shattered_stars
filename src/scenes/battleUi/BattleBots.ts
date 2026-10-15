/**
 * BattleBots — a battle scene's AI crew: one BotPilot per AI-flown ship,
 * one SquadCommand per squad, and the battle's squad marks.
 *
 * Scenes describe every ship as a BotContact each frame; BattleBots feeds
 * the squads (orders + AI leaders' marks) and flies the pilots through the
 * player's controls. A squad may be a part of a side (an escort wave): its
 * picture then holds its own ships and the enemy, not the rest of its side,
 * and its mark is keyed by the squad. The player marks through `mark`.
 *
 * Pure: no Phaser.
 */

import {
  BotPilot,
  SquadCommand,
  type BotContact,
  type BotTier,
  type SquadOrder,
} from "../../arcade/ai";
import type { CycleFlightState } from "../../arcade/systems/CycleFlight";
import { isMarkAssistEnabled } from "../../systems/SettingsStorage";
import type { FlightControlResult } from "../../arcade/systems/PilotFlightTypes";
import {
  forgetMarkedTarget,
  markedTargetOf,
  NO_SQUAD_MARKS,
  placeMark,
  type SquadMarks,
} from "../../arcade/systems/SquadMark";
import type { ManeuverDefinition, ManeuverDirection } from "../../core/types";

/** What a squad sees: every contact, or a scene-chosen subset. */
export type SquadScreen = (
  contacts: readonly BotContact[],
  nowMs: number,
) => readonly BotContact[];

/** A squad: its key (marks, membership), its side, and who leads it. */
export interface SquadSpec {
  /** Squad key: its mark's key; equal to `side` for a whole-side squad. */
  readonly key: string;
  /** The side its ships fly for (contacts' `side`). */
  readonly side: string;
  /** True: the AI leader marks the focus. False: the player marks. */
  readonly aiLeader: boolean;
  /** Player-led squads: mark the squad's own focus while the player has none. */
  readonly assistMark?: boolean;
  /** Narrows what the squad plans against (e.g. hides an objective). */
  readonly screen?: SquadScreen;
}

/** An AI pilot for one ship. */
export interface PilotSpec {
  readonly shipId: string;
  readonly tier: BotTier;
  /** Multiplier on reaction and decision cadence (default 1). */
  readonly reactionScale?: number;
}

/** One ship's flight this frame, as the scene supplies it. */
export interface BotFlightInput {
  readonly flight: CycleFlightState;
  readonly dial: readonly ManeuverDefinition[];
  readonly nowMs: number;
  readonly deltaMs: number;
}

/** BattleBots settings. */
export interface BattleBotsOptions {
  readonly worldSize: number;
  /** The battle's uniform random source in [0, 1). */
  readonly random: () => number;
  /** Player-led squads' wingmen mark their own focus; default Settings > Gameplay. */
  readonly markAssist?: boolean;
}

interface Squad {
  readonly spec: SquadSpec;
  readonly command: SquadCommand;
}

export class BattleBots {
  private readonly pilots = new Map<string, BotPilot>();
  private readonly squads = new Map<string, Squad>();
  private readonly squadOfShip = new Map<string, string>();
  private currentMarks: SquadMarks = NO_SQUAD_MARKS;

  /** @param options - World size and random source. */
  constructor(private readonly options: BattleBotsOptions) {}

  /** The battle's marks (every squad's and the player's). */
  get marks(): SquadMarks {
    return this.currentMarks;
  }

  /**
   * Add a squad (replaces one with the same key).
   * @param spec - Key, side, leadership, screen.
   */
  addSquad(spec: SquadSpec): void {
    const command = new SquadCommand({
      side: spec.key,
      aiLeader: spec.aiLeader,
      assistMark:
        (spec.assistMark ?? false) &&
        (this.options.markAssist ?? isMarkAssistEnabled()),
      worldSize: this.options.worldSize,
    });
    this.squads.set(spec.key, { spec, command });
  }

  /**
   * Put a ship in a squad.
   * @param shipId - The ship.
   * @param squadKey - A squad added with addSquad.
   */
  enlist(shipId: string, squadKey: string): void {
    this.squadOfShip.set(shipId, squadKey);
  }

  /**
   * Give a ship its AI pilot (replaces any previous one).
   * @param spec - Ship, tier, reaction scale.
   */
  addPilot(spec: PilotSpec): void {
    this.pilots.set(
      spec.shipId,
      new BotPilot(spec.tier, {
        random: this.options.random,
        ...(spec.reactionScale !== undefined
          ? { reactionScale: spec.reactionScale }
          : {}),
      }),
    );
  }

  /**
   * @param shipId - A ship.
   * @returns The tier of its AI pilot, or null when it has none.
   */
  tierOf(shipId: string): BotTier | null {
    return this.pilots.get(shipId)?.tier ?? null;
  }

  /**
   * @param shipId - A ship.
   * @returns The enemy its pilot is trying to shoot, or null.
   */
  pilotTargetOf(shipId: string): string | null {
    return this.pilots.get(shipId)?.targetId ?? null;
  }

  /**
   * @param shipId - A ship.
   * @returns Its squad key, or null when it flies alone.
   */
  squadKeyOf(shipId: string): string | null {
    return this.squadOfShip.get(shipId) ?? null;
  }

  /**
   * @param shipId - A ship.
   * @returns Its squad's current order for it, or null.
   */
  orderFor(shipId: string): SquadOrder | null {
    const key = this.squadOfShip.get(shipId);
    return key
      ? (this.squads.get(key)?.command.orderFor(shipId) ?? null)
      : null;
  }

  /**
   * Every squad updates its orders and (AI leaders) its mark.
   * @param nowMs - Scene time (ms).
   * @param contacts - Every ship in the battle, as it is now.
   */
  command(nowMs: number, contacts: readonly BotContact[]): void {
    for (const { spec, command } of this.squads.values()) {
      const seen = spec.screen ? spec.screen(contacts, nowMs) : contacts;
      this.currentMarks = command.update({
        nowMs,
        ships: this.squadPicture(spec, seen),
        marks: this.currentMarks,
      });
    }
  }

  /**
   * The ship's AI pilot flies one frame.
   * @param shipId - The ship (must be among `contacts`).
   * @param contacts - Every ship in the battle, as it is now.
   * @param input - Its flight, dial and timing.
   * @returns Motion, stress and effect events to apply, or null (no pilot).
   */
  fly(
    shipId: string,
    contacts: readonly BotContact[],
    input: BotFlightInput,
  ): FlightControlResult | null {
    const pilot = this.pilots.get(shipId);
    const self = contacts.find((c) => c.id === shipId);
    if (!pilot || !self) return null;
    return pilot.fly({
      self,
      flight: input.flight,
      dial: input.dial,
      contacts: contacts.filter((c) => c.id !== shipId),
      order: this.orderFor(shipId),
      nowMs: input.nowMs,
      deltaMs: input.deltaMs,
      worldSize: this.options.worldSize,
    });
  }

  /**
   * Tell a ship's pilot its cycle committed.
   * @param shipId - The ship.
   * @param started - The maneuver the new cycle started.
   */
  onCycleCommitted(shipId: string, started: ManeuverDirection): void {
    this.pilots.get(shipId)?.onCycleCommitted(started);
  }

  /**
   * A ship left the battle: its pilot, membership and any mark on it go.
   * @param shipId - The ship.
   */
  remove(shipId: string): void {
    this.pilots.delete(shipId);
    this.squadOfShip.delete(shipId);
    this.currentMarks = forgetMarkedTarget(this.currentMarks, shipId);
  }

  /**
   * A leader (the player) marks a target for a squad / side.
   * @param markKey - The squad key (the player's side).
   * @param targetId - The enemy to mark.
   * @param nowMs - Scene time (ms).
   */
  mark(markKey: string, targetId: string, nowMs: number): void {
    this.currentMarks = placeMark(this.currentMarks, markKey, targetId, nowMs);
  }

  /**
   * @param markKey - A squad key.
   * @param nowMs - Scene time (ms).
   * @returns Its live marked target, or null.
   */
  markedTarget(markKey: string, nowMs: number): string | null {
    return markedTargetOf(this.currentMarks, markKey, nowMs);
  }

  /**
   * @param shipId - The shooter.
   * @param fallbackKey - Mark key for a ship in no squad (e.g. its side).
   * @param nowMs - Scene time (ms).
   * @returns The target the shooter's squad has marked, or null.
   */
  markedTargetFor(
    shipId: string,
    fallbackKey: string,
    nowMs: number,
  ): string | null {
    return this.markedTarget(this.squadKeyOf(shipId) ?? fallbackKey, nowMs);
  }

  /** Forget every pilot, squad and mark (new battle). */
  reset(): void {
    this.pilots.clear();
    this.squads.clear();
    this.squadOfShip.clear();
    this.currentMarks = NO_SQUAD_MARKS;
  }

  /**
   * The squad's picture: its own ships under its key, the enemy as is; the
   * rest of its side is left out (not its business, and not an enemy).
   * @param spec - The squad.
   * @param contacts - Contacts it may see.
   * @returns Contacts for its SquadCommand.
   */
  private squadPicture(
    spec: SquadSpec,
    contacts: readonly BotContact[],
  ): BotContact[] {
    if (spec.key === spec.side) return [...contacts];
    return contacts.flatMap((contact) => {
      if (this.squadOfShip.get(contact.id) === spec.key)
        return [{ ...contact, side: spec.key }];
      return contact.side === spec.side ? [] : [contact];
    });
  }
}
