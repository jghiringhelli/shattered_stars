/**
 * ArcadeBotFleet — the Skirmish scene's AI: one BotPilot per AI ship and one
 * SquadCommand per side (a team's side key, never a faction — a mirror
 * match fields one faction on two sides), plus the battle's squad marks.
 *
 * The AI flies the same bots the skill gates measure, through the player's
 * own controls. Tiers:
 * - enemy sides are crewed from the battle difficulty's squad plan
 *   (BotDifficulty.squadSkillPlan, classic or reinforced): a skill per ship
 *   slot in enlistment order, reinforcements continuing the slots (Easy: an
 *   average leader with novice wingmen; Hard / Brutal: experts);
 * - the player's AI wingmen fly {@link WINGMAN_SKILL} at every difficulty —
 *   difficulty sets the opposition, not how good the player's help is.
 *
 * Squads: every enemy side's command has an AI leader that marks its focus
 * (a squad that never marks loses ~100 %, so every plan marks); the
 * player's side has none — the player marks (R), and the wingmen focus
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
  type BotContact,
  type BotSkill,
  type BotTier,
  type Point,
  type SquadOrder,
} from "../../arcade/ai";
import {
  squadLeaderSkill,
  squadSkillPlan,
  squadSlotSkill,
  type SquadFormat,
  type SquadSkillPlan,
} from "../../arcade/ai/BotDifficulty";
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
  /** The human player's side key (its team's squad has no AI leader). */
  readonly playerSide: string;
  /** The battle's seeded random source (shared by every pilot). */
  readonly random: () => number;
  /** Torus side length (px). */
  readonly worldSize: number;
  /**
   * Every side a human leads (online: each seat's team); default: the
   * player's side only. Their squads take the player's rules.
   */
  readonly humanSides?: ReadonlySet<string>;
  /** Mark assist for the human squads; default: the local setting (online fixes it). */
  readonly markAssist?: boolean;
  /**
   * Classic squads or reinforcement pools: picks the difficulty's squad
   * plan (BotDifficulty.squadSkillPlan); default classic.
   */
  readonly squadFormat?: SquadFormat;
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
  private readonly squadPlan: SquadSkillPlan;
  /** AI pilots enlisted per side so far (the next ship's crew slot). */
  private readonly crewed = new Map<string, number>();
  private readonly pilots = new Map<string, BotPilot>();
  private readonly squadCommands = new Map<string, SquadCommand>();
  private marks: SquadMarks = NO_SQUAD_MARKS;
  private contacts: readonly BotContact[] = [];
  private goalOf: ((shipId: string) => Point | null) | null = null;

  /** @param options - Difficulty, player faction, random source, world size. */
  constructor(private readonly options: ArcadeBotFleetOptions) {
    this.squadPlan = squadSkillPlan(
      options.difficulty,
      options.squadFormat ?? "classic",
    );
  }

  /** The battle's current squad marks (every side). */
  get currentMarks(): SquadMarks {
    return this.marks;
  }

  /**
   * @param side - A side.
   * @param slot - A ship's crew slot on that side (0 = its first AI pilot).
   * @returns The tier and reaction scale that ship flies with: the
   *   difficulty's squad plan for AI sides, the wingman tier for human ones.
   */
  skillFor(side: string, slot = 0): BotSkill {
    return this.isHumanSide(side)
      ? WINGMAN_SKILL
      : squadSlotSkill(this.squadPlan, slot);
  }

  /** @param side - A faction. @returns Whether a human leads it. */
  private isHumanSide(side: string): boolean {
    return (
      this.options.humanSides?.has(side) ?? side === this.options.playerSide
    );
  }

  /**
   * Give an AI ship its pilot (replacing any it had).
   * @param shipId - The ship.
   * @param side - Its side.
   * @param skill - Tier and reaction; default: {@link skillFor} its side's
   *   next crew slot (reinforcements continue the slots).
   */
  enlist(shipId: string, side: string, skill?: BotSkill): void {
    const pilotSkill = skill ?? this.skillFor(side, this.nextSlot(side));
    this.pilots.set(
      shipId,
      new BotPilot(pilotSkill.tier, {
        reactionScale: pilotSkill.reactionScale,
        random: this.options.random,
      }),
    );
  }

  /** @param side - A side. @returns Its next crew slot (and counts it). */
  private nextSlot(side: string): number {
    const slot = this.crewed.get(side) ?? 0;
    this.crewed.set(side, slot + 1);
    return slot;
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
    const isPlayerSide = this.isHumanSide(side);
    const skill = isPlayerSide
      ? WINGMAN_SKILL
      : squadLeaderSkill(this.squadPlan);
    squad = new SquadCommand({
      side,
      aiLeader: !isPlayerSide && this.squadPlan.marks,
      assistMark:
        isPlayerSide && (this.options.markAssist ?? isMarkAssistEnabled()),
      reactionMs: botProfile(skill.tier, skill.reactionScale).reactionMs,
      worldSize: this.options.worldSize,
    });
    this.squadCommands.set(side, squad);
    return squad;
  }
}
