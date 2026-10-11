/**
 * SquadBattleAi — the AI layer of the squad battle scenes (Survival,
 * Campaign): the same pilots and squad layer the skill gates measure.
 *
 * - Every AI-flown ship carries a BotPilot (`ship.bot`); `fly` hands it this
 *   frame's battle picture and returns the controls it pressed (apply them
 *   like the player's).
 * - The player's side has a SquadCommand without an AI leader but with mark
 *   assist: escorts and wingmen focus the player's mark (R), or mark their
 *   own choice while the player has none.
 * - The enemy side has a SquadCommand with an AI leader (focus, flanking,
 *   mark) while it fields {@link MIN_AI_SQUAD_SIZE}+ ships; a lone enemy
 *   flies on its own and has no mark, and a squad of novices focuses
 *   without marking (focus fire is a skill).
 * - It owns the battle's squad marks: the shot bonus (`isMarkedBy`, only for
 *   a side flying {@link MIN_AI_SQUAD_SIZE}+ ships), the HUD bracket
 *   (`playerMarkOf`), forgetting destroyed ships.
 * - `safePointFor` (optional) names a hazard escape point for a position;
 *   a bot there breaks off and flies to it.
 *
 * Pure: no Phaser. Mutates only its own state and the bots' memory.
 */

import { BotPilot } from "../ai/BotPilot";
import type { BotTier } from "../ai/BotTypes";
import type { BotContact } from "../ai/BotView";
import { SquadCommand } from "../ai/SquadCommand";
import type { ManeuverDefinition } from "../../core/types";
import type { CycleFlightState } from "./CycleFlight";
import type { FlightControlResult } from "./PilotFlightTypes";
import {
  clearMark,
  forgetMarkedTarget,
  isMarkedBy,
  markedTargetOf,
  NO_SQUAD_MARKS,
  placeMark,
  type SquadMarks,
} from "./SquadMark";

/** Side key of the player's squad (ships with owner "player"). */
export const PLAYER_SIDE = "player";

/** Side key of the AI's squad (ships with owner "ai"). */
export const ENEMY_SIDE = "ai";

/** Fewest living enemy ships that fly as a coordinated squad. */
export const MIN_AI_SQUAD_SIZE = 2;

/** The ship fields the AI layer reads (Survival's and Campaign's records). */
export interface SquadAiShip {
  readonly id: string;
  readonly definitionId: string;
  readonly owner: "player" | "ai";
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
  readonly combatStats: {
    readonly firingArc: number;
    readonly weaponRange: number;
  };
  readonly flight: CycleFlightState;
  readonly dial: readonly ManeuverDefinition[];
  /** Its AI pilot, or null when the player flies it. */
  readonly bot: BotPilot | null;
}

/** SquadBattleAi options. */
export interface SquadBattleAiOptions {
  /** Torus edge (px). */
  readonly worldSize: number;
  /** Uniform random source in [0, 1) for the pilots; default Math.random. */
  readonly random?: () => number;
  /**
   * Hazard escape: for a position, where a bot should flee to (the arena
   * centre near a belt...), or null when it is safe there.
   */
  readonly safePointFor?: (
    x: number,
    y: number,
  ) => { x: number; y: number } | null;
}

/**
 * @param ship - A scene ship.
 * @returns It as the AI sees it (sided by owner, so mirror matches work).
 */
export function squadContactOf(ship: SquadAiShip): BotContact {
  return {
    id: ship.id,
    side: ship.owner,
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

export class SquadBattleAi {
  private marks: SquadMarks = NO_SQUAD_MARKS;
  private readonly playerSquad: SquadCommand;
  private readonly enemySquad: SquadCommand;
  private enemySquadActive = false;
  private squadSides: ReadonlySet<string> = new Set();
  private contacts: readonly BotContact[] = [];
  private readonly random: () => number;

  /** @param options - World size and the pilots' random source. */
  constructor(private readonly options: SquadBattleAiOptions) {
    const { worldSize } = options;
    this.random = options.random ?? Math.random;
    this.playerSquad = new SquadCommand({
      side: PLAYER_SIDE,
      aiLeader: false,
      assistMark: true,
      worldSize,
    });
    this.enemySquad = new SquadCommand({
      side: ENEMY_SIDE,
      aiLeader: true,
      worldSize,
    });
  }

  /**
   * @param tier - Skill tier.
   * @returns A new pilot for an AI ship, drawing on the battle's random source.
   */
  createPilot(tier: BotTier): BotPilot {
    return new BotPilot(tier, { random: this.random });
  }

  /**
   * The player marks an enemy for their squad (R): escorts focus it and
   * every shot of the player's side at it gets the mark bonus.
   *
   * @param targetId - The enemy to mark.
   * @param nowMs - Scene time (ms).
   */
  markTarget(targetId: string, nowMs: number): void {
    this.marks = placeMark(this.marks, PLAYER_SIDE, targetId, nowMs);
  }

  /**
   * @param nowMs - Scene time (ms).
   * @returns The enemy the player's side has marked, or null.
   */
  playerMarkOf(nowMs: number): string | null {
    return markedTargetOf(this.marks, PLAYER_SIDE, nowMs);
  }

  /**
   * @param attackerOwner - The shooter's side.
   * @param targetId - The ship shot at.
   * @param nowMs - Scene time (ms).
   * @returns Whether the shooter's side has that ship marked.
   */
  isMarkedBy(attackerOwner: string, targetId: string, nowMs: number): boolean {
    return (
      this.squadSides.has(attackerOwner) &&
      isMarkedBy(this.marks, attackerOwner, targetId, nowMs)
    );
  }

  /**
   * Drop every mark on a ship that was destroyed or left the battle.
   * @param shipId - The ship.
   */
  forget(shipId: string): void {
    this.marks = forgetMarkedTarget(this.marks, shipId);
  }

  /** A new enemy squad takes the field (next wave): forget its old plan. */
  resetEnemySquad(): void {
    this.enemySquad.reset();
    this.enemySquadActive = false;
    this.marks = clearMark(this.marks, ENEMY_SIDE);
  }

  /** New battle: no marks, no orders, no memory. */
  reset(): void {
    this.marks = NO_SQUAD_MARKS;
    this.playerSquad.reset();
    this.resetEnemySquad();
    this.contacts = [];
    this.squadSides = new Set();
  }

  /**
   * Once per frame, before any ship flies: take the battle picture and let
   * both squad layers update their orders and marks.
   *
   * @param ships - Every ship of the battle.
   * @param nowMs - Scene time (ms).
   */
  command(ships: Iterable<SquadAiShip>, nowMs: number): void {
    const contacts: BotContact[] = [];
    let enemyCanMark = false;
    for (const ship of ships) {
      if (ship.hull <= 0) continue;
      contacts.push(squadContactOf(ship));
      if (ship.owner === ENEMY_SIDE && ship.bot && ship.bot.tier !== "novice")
        enemyCanMark = true;
    }
    this.contacts = contacts;
    this.squadSides = sidesFlyingAsSquads(contacts);
    this.marks = this.squadSides.has(PLAYER_SIDE)
      ? this.playerSquad.update({ nowMs, ships: contacts, marks: this.marks })
      : this.marks;
    this.enemySquadActive = this.squadSides.has(ENEMY_SIDE);
    this.marks = this.enemySquadActive
      ? this.enemySquad.update({ nowMs, ships: contacts, marks: this.marks })
      : this.marks;
    if (!this.enemySquadActive || !enemyCanMark)
      this.marks = clearMark(this.marks, ENEMY_SIDE);
  }

  /**
   * One frame of an AI ship's pilot (after {@link command}).
   *
   * @param ship - The ship.
   * @param nowMs - Scene time (ms).
   * @param deltaMs - Frame length (ms).
   * @returns The controls it pressed, or null when the player flies it.
   */
  fly(
    ship: SquadAiShip,
    nowMs: number,
    deltaMs: number,
  ): FlightControlResult | null {
    if (!ship.bot) return null;
    return ship.bot.fly({
      self: squadContactOf(ship),
      flight: ship.flight,
      dial: ship.dial,
      contacts: this.contacts.filter((c) => c.id !== ship.id),
      order: this.orderFor(ship),
      nowMs,
      deltaMs,
      worldSize: this.options.worldSize,
      safePoint: this.options.safePointFor?.(ship.x, ship.y) ?? null,
    });
  }

  /**
   * @param ship - A ship.
   * @returns Its squad order, or null when it flies on its own.
   */
  private orderFor(ship: SquadAiShip): ReturnType<SquadCommand["orderFor"]> {
    if (ship.owner === PLAYER_SIDE) return this.playerSquad.orderFor(ship.id);
    return this.enemySquadActive ? this.enemySquad.orderFor(ship.id) : null;
  }
}

/**
 * @param contacts - Every living ship.
 * @returns The sides fielding {@link MIN_AI_SQUAD_SIZE}+ living ships.
 */
function sidesFlyingAsSquads(contacts: readonly BotContact[]): Set<string> {
  const counts = new Map<string, number>();
  for (const c of contacts) counts.set(c.side, (counts.get(c.side) ?? 0) + 1);
  return new Set(
    [...counts].filter(([, n]) => n >= MIN_AI_SQUAD_SIZE).map(([side]) => side),
  );
}
