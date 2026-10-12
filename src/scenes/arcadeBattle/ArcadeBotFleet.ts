/**
 * ArcadeBotFleet — the Skirmish scene's AI: one BotPilot per AI ship and one
 * SquadCommand per faction, plus the battle's squad marks.
 *
 * The AI flies the same bots the skill gates measure, through the player's
 * own controls. Tiers:
 * - enemy factions fly the battle's difficulty (difficultyToTier: easy ->
 *   novice, normal -> average, hard -> expert, brutal -> expert with faster
 *   reaction);
 * - the player's AI wingmen fly {@link WINGMAN_SKILL} at every difficulty —
 *   difficulty sets the opposition, not how good the player's help is.
 *
 * Squads: every enemy faction's command has an AI leader that marks its
 * focus (novice squads focus without marking — focus fire is a skill); the
 * player's faction has none — the player marks (R), and the wingmen focus
 * the player's mark, or mark the coordinator's choice while there is none
 * (mark assist — Settings › Gameplay › Wingmen Mark Assist). A side down to
 * one living ship flies on its own (no orders, no mark), as SquadMark defines.
 *
 * Pure: no Phaser.
 */

import {
  BotPilot,
  DEFAULT_BOT_SKILL,
  SquadCommand,
  botProfile,
  difficultyToTier,
  type BotContact,
  type BotSkill,
  type BotTier,
  type Point,
  type SquadOrder,
} from "../../arcade/ai";
import type { CycleFlightState } from "../../arcade/systems/CycleFlight";
import type { FlightControlResult } from "../../arcade/systems/PilotFlightTypes";
import { isMarkAssistEnabled } from "../../systems/SettingsStorage";
import {
  NO_SQUAD_MARKS,
  clearMark,
  forgetMarkedTarget,
  isMarkedBy,
  markedTargetOf,
  placeMark,
  type SquadMarks,
} from "../../arcade/systems/SquadMark";
import type { ManeuverDefinition, ManeuverDirection } from "../../core/types";

/** Tier the player's AI wingmen fly at every difficulty (the average pilot). */
export const WINGMAN_SKILL: BotSkill = DEFAULT_BOT_SKILL;

/** Difficulty assumed when the battle config names none. */
export const DEFAULT_SKIRMISH_DIFFICULTY = "normal";

/** Living ships a side needs to fly as a squad (orders, mark); fewer = on its own. */
export const MIN_SQUAD_SIZE = 2;

/** Fleet setup. */
export interface ArcadeBotFleetOptions {
  /** The battle's difficulty label (battleConfig.aiDifficulty). */
  readonly difficulty: string;
  /** The human player's faction (its squad has no AI leader). */
  readonly playerFaction: string;
  /** The battle's seeded random source (shared by every pilot). */
  readonly random: () => number;
  /** Torus side length (px). */
  readonly worldSize: number;
  /**
   * Every faction a human leads (online: one per seat's squad); default:
   * the player's faction only. Their squads take the player's rules.
   */
  readonly humanFactions?: ReadonlySet<string>;
  /** Mark assist for the human squads; default: the local setting (online fixes it). */
  readonly markAssist?: boolean;
}

/** One frame of one AI ship. */
export interface FleetFlightInput {
  readonly self: BotContact;
  readonly flight: CycleFlightState;
  readonly dial: readonly ManeuverDefinition[];
  readonly nowMs: number;
  readonly deltaMs: number;
}

export class ArcadeBotFleet {
  private readonly enemySkill: BotSkill;
  private readonly pilots = new Map<string, BotPilot>();
  private readonly squadCommands = new Map<string, SquadCommand>();
  private marks: SquadMarks = NO_SQUAD_MARKS;
  private contacts: readonly BotContact[] = [];
  private goalOf: ((shipId: string) => Point | null) | null = null;

  /** @param options - Difficulty, player faction, random source, world size. */
  constructor(private readonly options: ArcadeBotFleetOptions) {
    this.enemySkill = difficultyToTier(options.difficulty);
  }

  /** The battle's current squad marks (every side). */
  get currentMarks(): SquadMarks {
    return this.marks;
  }

  /**
   * @param side - A faction.
   * @returns The tier and reaction scale its AI ships fly with.
   */
  skillFor(side: string): BotSkill {
    return this.isHumanSide(side) ? WINGMAN_SKILL : this.enemySkill;
  }

  /** @param side - A faction. @returns Whether a human leads it. */
  private isHumanSide(side: string): boolean {
    return (
      this.options.humanFactions?.has(side) ??
      side === this.options.playerFaction
    );
  }

  /**
   * Give an AI ship its pilot (replacing any it had).
   * @param shipId - The ship.
   * @param side - Its faction.
   * @param skill - Tier and reaction; default: {@link skillFor} its side.
   */
  enlist(shipId: string, side: string, skill = this.skillFor(side)): void {
    this.pilots.set(
      shipId,
      new BotPilot(skill.tier, {
        reactionScale: skill.reactionScale,
        random: this.options.random,
      }),
    );
  }

  /**
   * @param shipId - A ship.
   * @returns Its pilot's tier, or null when it has no AI pilot.
   */
  tierOf(shipId: string): BotTier | null {
    return this.pilots.get(shipId)?.tier ?? null;
  }

  /**
   * Every faction's squad command perceives the battle, re-plans when due
   * and updates its side's mark. A side down to one living ship flies on its
   * own: no orders and no mark (SquadMark). Call once per tick, before
   * {@link fly}.
   * @param nowMs - Battle time (ms).
   * @param contacts - Every ship in the battle, as the AI sees it.
   */
  command(nowMs: number, contacts: readonly BotContact[]): void {
    this.contacts = contacts;
    for (const contact of contacts) this.squadFor(contact.side);
    for (const [side, squad] of this.squadCommands) {
      if (this.isSquad(side)) {
        this.marks = squad.update({
          nowMs,
          ships: contacts,
          marks: this.marks,
        });
      } else {
        squad.reset();
        this.marks = clearMark(this.marks, side);
      }
    }
  }

  /**
   * @param side - A faction.
   * @returns Whether it flies as a squad: at least {@link MIN_SQUAD_SIZE}
   *   living ships at the last {@link command}.
   */
  isSquad(side: string): boolean {
    let alive = 0;
    for (const contact of this.contacts) {
      if (contact.side === side && contact.alive) alive++;
    }
    return alive >= MIN_SQUAD_SIZE;
  }

  /**
   * One frame of an AI ship's pilot (enlisted on first use if needed).
   * @param input - The ship, its flight and dial, and timing.
   * @returns New motion, stress and effect events — apply like the player's.
   */
  fly(input: FleetFlightInput): FlightControlResult {
    const { self } = input;
    if (!this.pilots.has(self.id)) this.enlist(self.id, self.side);
    return this.pilots.get(self.id)!.fly({
      self,
      flight: input.flight,
      dial: input.dial,
      contacts: this.contacts.filter((contact) => contact.id !== self.id),
      order: this.orderFor(self.id, self.side),
      nowMs: input.nowMs,
      deltaMs: input.deltaMs,
      worldSize: this.options.worldSize,
      safePoint: this.goalOf?.(self.id) ?? null,
    });
  }

  /**
   * Scenario mode: a ship whose goal source names a point steers for it
   * (BotPilot's safe-point path — no specials, boosts or rolls) and keeps
   * shooting; null = fly the squad's orders as usual.
   * @param source - Ship id → goal point, or null to clear the source.
   */
  setGoalSource(source: ((shipId: string) => Point | null) | null): void {
    this.goalOf = source;
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
   * @param shipId - A ship.
   * @param side - Its faction.
   * @returns Its squad order, or null.
   */
  orderFor(shipId: string, side: string): SquadOrder | null {
    return this.squadCommands.get(side)?.orderFor(shipId) ?? null;
  }

  /**
   * The enemy an AI ship is after: its pilot's target, else its squad focus.
   * @param shipId - A ship.
   * @param side - Its faction.
   * @returns The target's id, or null.
   */
  targetIdFor(shipId: string, side: string): string | null {
    return (
      this.pilots.get(shipId)?.targetId ??
      this.orderFor(shipId, side)?.focusTargetId ??
      null
    );
  }

  /**
   * A side marks a target (the player pressing R marks for its faction).
   * Ignored for a side flying on its own (fewer than two living ships).
   * @param side - The marking faction.
   * @param targetId - The enemy marked.
   * @param nowMs - Battle time (ms).
   */
  markTarget(side: string, targetId: string, nowMs: number): void {
    if (!this.isSquad(side)) return;
    this.marks = placeMark(this.marks, side, targetId, nowMs);
  }

  /**
   * @param side - A faction.
   * @param nowMs - Battle time (ms).
   * @returns Its live marked target, or null.
   */
  markedTargetOf(side: string, nowMs: number): string | null {
    return markedTargetOf(this.marks, side, nowMs);
  }

  /**
   * @param side - The attacker's faction.
   * @param targetId - The ship attacked.
   * @param nowMs - Battle time (ms).
   * @returns Whether the attacker's side has that ship marked right now.
   */
  isMarkedBy(side: string, targetId: string, nowMs: number): boolean {
    return isMarkedBy(this.marks, side, targetId, nowMs);
  }

  /**
   * A ship was destroyed: drop every mark on it and its pilot.
   * @param shipId - The ship.
   */
  forget(shipId: string): void {
    this.marks = forgetMarkedTarget(this.marks, shipId);
    this.pilots.delete(shipId);
  }

  /**
   * @param side - A faction.
   * @returns Its squad command (created on first sight).
   */
  private squadFor(side: string): SquadCommand {
    let squad = this.squadCommands.get(side);
    if (squad) return squad;
    const skill = this.skillFor(side);
    const isPlayerSide = this.isHumanSide(side);
    squad = new SquadCommand({
      side,
      aiLeader: !isPlayerSide && skill.tier !== "novice",
      assistMark:
        isPlayerSide && (this.options.markAssist ?? isMarkAssistEnabled()),
      reactionMs: botProfile(skill.tier, skill.reactionScale).reactionMs,
      worldSize: this.options.worldSize,
    });
    this.squadCommands.set(side, squad);
    return squad;
  }
}
