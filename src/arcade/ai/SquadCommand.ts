/**
 * SquadCommand — one side's squad layer, for scenes and the skill arena
 * alike. Each update (every frame is fine; it re-plans on a short interval)
 * it perceives the battle through the squad's reaction delay, has the
 * SquadCoordinator assign every ship of the side its order (focus target,
 * flank slot, cohesion rally point, support wingman, fall back / drag) and
 * manages the side's SquadMark:
 * - AI squads (`aiLeader: true`): the AI leader marks the squad's focus;
 * - the player's side (`aiLeader: false`): the player marks (with the
 *   MARK_TARGET intent → SquadMark.placeMark); wingmen focus the player's
 *   mark, or the coordinator's own choice while there is none. With
 *   `assistMark` the wingmen also mark that choice while the player has no
 *   mark, and keep the player's mark refreshed while its target lives.
 *
 * Pure: no Phaser.
 */

import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS } from "../../config";
import {
  clearMark,
  markedTargetOf,
  placeMark,
  type SquadMarks,
} from "../systems/SquadMark";
import type { SideKey, SquadOrder } from "./BotTypes";
import { contactSnapshot, type BotContact } from "./BotView";
import { SnapshotHistory } from "./Perception";
import {
  DEFAULT_COORDINATION,
  SquadCoordinator,
  type CoordinationOptions,
} from "./SquadCoordinator";
import { TIER_PROFILES } from "./bots/BotKit";

/** How often a squad re-plans (ms): twice per maneuver cycle. */
export const SQUAD_PLAN_INTERVAL_MS = CYCLE_DURATION_MS / 2;

/** SquadCommand options. */
export interface SquadCommandOptions {
  /** The side this command leads (ships with this `side` are its squad). */
  readonly side: SideKey;
  /** True: the AI leader marks the focus. False: only the player marks. */
  readonly aiLeader: boolean;
  /**
   * Player-led sides only: the squad marks its own focus while the player
   * has none (the player's mark always wins). Default false.
   */
  readonly assistMark?: boolean;
  /** Delay of the squad's shared picture (ms). Default: the average pilot's. */
  readonly reactionMs?: number;
  /** Re-plan interval (ms). Default: {@link SQUAD_PLAN_INTERVAL_MS}. */
  readonly planIntervalMs?: number;
  /** Coordination behaviours. Default: all on. */
  readonly coordination?: CoordinationOptions;
  /** Torus edge (px). Default: BATTLEFIELD_SIZE. */
  readonly worldSize?: number;
}

/** One update of the squad layer. */
export interface SquadCommandFrame {
  readonly nowMs: number;
  /** Every ship in the battle (both sides), as it is now. */
  readonly ships: readonly BotContact[];
  /** The battle's current marks (all sides). */
  readonly marks: SquadMarks;
}

export class SquadCommand {
  readonly side: SideKey;
  private readonly aiLeader: boolean;
  private readonly assistMark: boolean;
  private readonly reactionMs: number;
  private readonly planIntervalMs: number;
  private readonly worldSize: number;
  private readonly coordination: CoordinationOptions;
  private coordinator: SquadCoordinator;
  private history: SnapshotHistory;
  private orders: ReadonlyMap<string, SquadOrder> = new Map();
  private nextPlanMs: number | null = null;
  private focus: string | null = null;

  /** @param options - Side, leadership, reaction, cadence, coordination. */
  constructor(options: SquadCommandOptions) {
    this.side = options.side;
    this.aiLeader = options.aiLeader;
    this.assistMark = options.assistMark ?? false;
    this.reactionMs = options.reactionMs ?? TIER_PROFILES.average.reactionMs;
    this.planIntervalMs = options.planIntervalMs ?? SQUAD_PLAN_INTERVAL_MS;
    this.worldSize = options.worldSize ?? BATTLEFIELD_SIZE;
    this.coordination = options.coordination ?? DEFAULT_COORDINATION;
    this.coordinator = this.newCoordinator();
    this.history = new SnapshotHistory(this.reactionMs, this.worldSize);
  }

  /** The squad's current focus target (its mark on AI sides), or null. */
  get focusTargetId(): string | null {
    return this.focus;
  }

  /**
   * Perceive, re-plan when due and update the side's mark.
   *
   * @param frame - Time, every ship, and the current marks.
   * @returns The marks after this update (the AI leader's mark refreshed).
   */
  update(frame: SquadCommandFrame): SquadMarks {
    this.history.record(frame.nowMs, frame.ships.map(contactSnapshot));
    this.nextPlanMs ??= frame.nowMs;
    if (frame.nowMs < this.nextPlanMs) return frame.marks;
    this.nextPlanMs = Math.max(
      this.nextPlanMs + this.planIntervalMs,
      frame.nowMs,
    );
    return this.plan(frame);
  }

  /**
   * @param shipId - A ship of this side.
   * @returns Its current order, or null (not in the squad / nothing to do).
   */
  orderFor(shipId: string): SquadOrder | null {
    return this.orders.get(shipId) ?? null;
  }

  /** Forget orders, focus and perception (new round). */
  reset(): void {
    this.coordinator = this.newCoordinator();
    this.history = new SnapshotHistory(this.reactionMs, this.worldSize);
    this.orders = new Map();
    this.nextPlanMs = null;
    this.focus = null;
  }

  /**
   * @param frame - This update.
   * @returns The marks after planning.
   */
  private plan(frame: SquadCommandFrame): SquadMarks {
    const own = frame.ships
      .filter((s) => s.side === this.side)
      .map(contactSnapshot)
      .filter((s) => s.alive);
    // Ships gone from the battle (destroyed) are dropped from the delayed
    // picture: marking one would leave a ghost mark the squad refreshes forever.
    const present = new Set(
      frame.ships.filter((s) => s.alive).map((s) => s.id),
    );
    const enemies = this.history
      .perceive(frame.nowMs, this.reactionMs, "")
      .filter((s) => s.side !== this.side && present.has(s.id));
    const playerMark = this.aiLeader
      ? null
      : markedTargetOf(frame.marks, this.side, frame.nowMs);
    this.orders = this.coordinator.plan(own, enemies, playerMark);
    this.focus = [...this.orders.values()][0]?.focusTargetId ?? null;
    if (!this.aiLeader && !this.assistMark) return frame.marks;
    if (playerMark)
      return present.has(playerMark)
        ? placeMark(frame.marks, this.side, playerMark, frame.nowMs)
        : frame.marks;
    return this.focus
      ? placeMark(frame.marks, this.side, this.focus, frame.nowMs)
      : clearMark(frame.marks, this.side);
  }

  /** @returns A fresh coordinator with this command's settings. */
  private newCoordinator(): SquadCoordinator {
    return new SquadCoordinator(
      this.reactionMs,
      this.coordination,
      this.worldSize,
    );
  }
}
