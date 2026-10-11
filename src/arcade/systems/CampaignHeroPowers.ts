/**
 * CampaignHeroPowers — the battle-side controller of the hero's two active
 * powers: latches V/B (HERO_POWER_1/2) presses, casts unlocked and ready
 * powers, hands their commands to a {@link PowerHost} (the scene), keeps the
 * timed statuses they create and resolves delayed strikes. Phaser-free.
 */

import type { FactionId } from "../../config";
import type { ObjectivePoint } from "../objectives";
import {
  activateHeroPower,
  createHeroPowerSlots,
  tickHeroPowers,
  type HeroPowerSlot,
} from "../../campaign/powers/heroPowerState";
import {
  resolveHeroPower,
  type PowerCommand,
  type PowerWorld,
} from "../../campaign/powers/heroPowerEffects";
import type { HeroPowerInput } from "../../campaign/powers/HeroPowerInput";
import {
  ENEMY_SIDE_KEY,
  addStatus,
  hasStatus,
  pruneStatuses,
  statusMultiplier,
  type StatusLedger,
} from "../../campaign/powers/statusEffects";

/** What the scene does for powers. */
export interface PowerHost {
  damage(shipId: string, amount: number, ignoreShields: boolean): void;
  repair(shipId: string, hullFraction: number): void;
  refillShields(shipId: string): void;
  stripShields(shipId: string): void;
  stress(shipId: string, amount: number): void;
  spawnDrones(
    shipId: string,
    points: readonly ObjectivePoint[],
    lifetimeMs: number,
  ): void;
  teleport(shipId: string, x: number, y: number): void;
  addMines(points: readonly ObjectivePoint[], damage: number): void;
  /** A delayed bombardment lands now. */
  strike(x: number, y: number, radius: number, damage: number): void;
  fx(kind: string, x: number, y: number, radius: number): void;
}

/** One frame for the controller. */
export interface PowerFrame {
  readonly nowMs: number;
  readonly deltaMs: number;
  /** The battle, or null when the flagship is gone (no casting). */
  readonly world: PowerWorld | null;
}

type StrikeCommand = Extract<PowerCommand, { cmd: "strike" }>;

export class CampaignHeroPowers {
  private slotStates: HeroPowerSlot[];
  private ledger: StatusLedger = [];
  private strikes: { dueMs: number; strike: StrikeCommand }[] = [];
  private requests: number[] = [];

  /**
   * @param factionId - Campaign faction (its hero's powers).
   * @param ranks - Saved power ranks.
   * @param cooldownMultiplier - Armory/research cooldown multiplier.
   * @param input - Hero power intent latch.
   */
  constructor(
    factionId: FactionId,
    ranks: Readonly<Record<string, number>>,
    cooldownMultiplier: number,
    private readonly input: HeroPowerInput,
  ) {
    this.slotStates = createHeroPowerSlots(
      factionId,
      ranks,
      cooldownMultiplier,
    );
  }

  /** Both power slots. */
  get slots(): readonly HeroPowerSlot[] {
    return this.slotStates;
  }

  /** Start listening for V/B. */
  attach(): void {
    this.input.attach();
  }

  /** Stop listening. */
  detach(): void {
    this.input.detach();
  }

  /** @param slot - Slot to cast on the next update (debug / tests). */
  requestCast(slot: number): void {
    this.requests.push(slot);
  }

  /**
   * One frame: cooldowns, casts, due strikes, expired statuses.
   *
   * @param frame - Time and battle.
   * @param host - The scene.
   * @returns Ids of the powers cast this frame.
   */
  update(frame: PowerFrame, host: PowerHost): string[] {
    this.slotStates = tickHeroPowers(this.slotStates, frame.deltaMs);
    const requests = [...this.requests, ...this.input.takeRequests()];
    this.requests = [];
    const cast: string[] = [];
    for (const slot of frame.world ? requests : []) {
      const result = activateHeroPower(this.slotStates, slot);
      this.slotStates = result.slots;
      if (!result.activation || !frame.world) continue;
      cast.push(result.activation.powerId);
      this.apply(
        resolveHeroPower(result.activation, frame.world),
        frame.nowMs,
        host,
      );
    }
    this.resolveStrikes(frame.nowMs, host);
    this.ledger = pruneStatuses(this.ledger, frame.nowMs);
    return cast;
  }

  /**
   * @param shipId - A ship.
   * @param nowMs - Scene time.
   * @returns Multiplier on damage it takes.
   */
  damageTakenMultiplier(shipId: string, nowMs: number): number {
    return statusMultiplier(this.ledger, shipId, "damage_taken", nowMs);
  }

  /**
   * @param shipId - A ship.
   * @param nowMs - Scene time.
   * @returns Multiplier on its attack interval.
   */
  attackIntervalMultiplier(shipId: string, nowMs: number): number {
    return statusMultiplier(this.ledger, shipId, "attack_interval", nowMs);
  }

  /**
   * @param shipId - A ship.
   * @param nowMs - Scene time.
   * @returns Whether it is cloaked (untargetable).
   */
  isCloaked(shipId: string, nowMs: number): boolean {
    return hasStatus(this.ledger, shipId, "cloaked", nowMs);
  }

  /**
   * @param shipId - A ship.
   * @param nowMs - Scene time.
   * @returns Whether its weapons are silenced.
   */
  weaponsDisabled(shipId: string, nowMs: number): boolean {
    return hasStatus(this.ledger, shipId, "weapons_disabled", nowMs);
  }

  /**
   * @param side - A side.
   * @param nowMs - Scene time.
   * @returns Time scale of that side's ships (time-slow).
   */
  timeScaleFor(side: "player" | "enemy", nowMs: number): number {
    if (side !== "enemy") return 1;
    return statusMultiplier(this.ledger, ENEMY_SIDE_KEY, "time_scale", nowMs);
  }

  /**
   * @param commands - A cast's commands.
   * @param nowMs - Scene time.
   * @param host - The scene.
   */
  private apply(
    commands: readonly PowerCommand[],
    nowMs: number,
    host: PowerHost,
  ): void {
    for (const c of commands) {
      switch (c.cmd) {
        case "strike":
          this.strikes.push({ dueMs: nowMs + c.delayMs, strike: c });
          break;
        case "status":
          this.ledger = addStatus(this.ledger, {
            shipId: c.shipId,
            kind: c.kind,
            value: c.value,
            untilMs: nowMs + c.durationMs,
          });
          break;
        case "damage":
          host.damage(c.shipId, c.amount, c.ignoreShields);
          break;
        case "repair":
          host.repair(c.shipId, c.hullFraction);
          break;
        case "refillShields":
          host.refillShields(c.shipId);
          break;
        case "stripShields":
          host.stripShields(c.shipId);
          break;
        case "stress":
          host.stress(c.shipId, c.amount);
          break;
        case "spawnDrones":
          host.spawnDrones(c.shipId, c.points, c.lifetimeMs);
          break;
        case "teleport":
          host.teleport(c.shipId, c.x, c.y);
          break;
        case "mines":
          host.addMines(c.points, c.damage);
          break;
        case "fx":
          host.fx(c.kind, c.x, c.y, c.radius);
          break;
      }
    }
  }

  /**
   * @param nowMs - Scene time.
   * @param host - The scene.
   */
  private resolveStrikes(nowMs: number, host: PowerHost): void {
    const due = this.strikes.filter((s) => s.dueMs <= nowMs);
    this.strikes = this.strikes.filter((s) => s.dueMs > nowMs);
    for (const { strike } of due)
      host.strike(strike.x, strike.y, strike.radius, strike.damage);
  }
}
