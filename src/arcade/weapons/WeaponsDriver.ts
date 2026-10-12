/**
 * WeaponsDriver — runs the shared secondary-weapons runtime for one battle
 * without Phaser: the battle scenes (through BattleWeapons, which adds
 * input, drawing and HUD) and the headless sims (skill arena, scenario,
 * duel and survival sims) drive their secondaries through it, so bots use
 * ordnance the same way everywhere.
 *
 * - arms each ship from its quick build;
 * - runs the runtime once per frame with the injected bot decider;
 * - hands every hit to the owner's damage path (shields, then hull);
 * - reports a ship's cloak damage factor and drops its cloak when it attacks;
 * - buffers a human's FIRE_SECONDARY refused only because this attacker
 *   already attacked the target this cycle: it fires as soon as the cycle
 *   clears (within one cycle) — the scenes run this before their primaries,
 *   so the held launch becomes that cycle's attack.
 *
 * Pure: no Phaser.
 */

import { CYCLE_DURATION_MS } from "../../config";
import type { HitImmunityLedger } from "../systems/CombatTempo";
import type { CombatModifiers } from "../../core/CombatModifiers";
import { getLoadoutById } from "../../data/ShipLoadouts";
import { CLOAKED_DAMAGE_FACTOR } from "./FireControl";
import { SecondaryWeapons } from "./SecondaryWeapons";
import type {
  FireOutcome,
  OrdnanceDecider,
  WeaponBody,
  WeaponEvent,
  WeaponWorld,
} from "./weaponTypes";

/** A secondary hit for the owner to apply. */
export type WeaponHit = Extract<WeaponEvent, { kind: "hit" }>;

/** What the driver reads from (and asks of) its battle. */
export interface WeaponsDriverLink {
  /** Every ship as the weapons see it. */
  bodies(): Iterable<WeaponBody>;
  /** The enemy this ship's pilot wants (HUD target / bot target). */
  wantedTargetOf(shipId: string): string | null;
  /** Apply a hit through the battle's damage path (shields, then hull) at `nowMs`. */
  applyHit(hit: WeaponHit, nowMs: number): void;
  /** True for ships a bot flies (default: every ship). */
  isBotControlled?(shipId: string): boolean;
}

/** How a battle's weapons are set up. */
export interface WeaponsDriverConfig {
  readonly worldSize: number;
  /** The battle's round-tempo ledger (shared with its primary weapons). */
  readonly ledger: HitImmunityLedger;
  /** Uniform [0, 1) source for the turrets' dice. */
  readonly random: () => number;
  /** Bots' ordnance choices (src/arcade/ai/OrdnanceDecision). */
  readonly decide: OrdnanceDecider;
}

/** What a ship is armed from. */
export interface WeaponsLoadout {
  readonly definitionId: string;
  readonly loadoutId: string | null;
  readonly modifiers: CombatModifiers;
}

export class WeaponsDriver {
  readonly runtime: SecondaryWeapons;
  readonly world: WeaponWorld;
  /** Held FIRE_SECONDARY presses: ship id → until when (ms). */
  private readonly held = new Map<string, number>();
  private readonly outcomes = new Map<string, FireOutcome>();

  /**
   * @param link - What the driver reads from its battle.
   * @param config - World size, tempo ledger, dice and bot decider.
   */
  constructor(
    private readonly link: WeaponsDriverLink,
    config: WeaponsDriverConfig,
  ) {
    this.runtime = new SecondaryWeapons(config);
    this.world = {
      bodies: () => link.bodies(),
      wantedTargetOf: (id) => link.wantedTargetOf(id),
      isBotControlled: (id) => link.isBotControlled?.(id) ?? true,
    };
  }

  /**
   * Arm a ship from its quick build.
   * @param shipId - The ship.
   * @param loadout - Hull, quick build and modifier sheet.
   */
  equip(shipId: string, loadout: WeaponsLoadout): void {
    this.runtime.equip(shipId, {
      definitionId: loadout.definitionId,
      upgradeIds: loadout.loadoutId
        ? (getLoadoutById(loadout.loadoutId)?.upgrades ?? [])
        : [],
      modifiers: loadout.modifiers,
    });
  }

  /** @param shipId - A ship destroyed or removed (its shots keep flying). */
  forget(shipId: string): void {
    this.runtime.forget(shipId);
    this.held.delete(shipId);
  }

  /**
   * FIRE_SECONDARY for a human pilot (held for up to a cycle when the
   * target was already attacked this cycle).
   * @param shipId - The human's ship.
   * @param nowMs - Battle time (ms).
   * @returns What the press did now.
   */
  fire(shipId: string, nowMs: number): FireOutcome {
    const outcome = this.runtime.fire(shipId, this.world, nowMs);
    this.outcomes.set(shipId, outcome);
    if (outcome === "attacked")
      this.held.set(shipId, nowMs + CYCLE_DURATION_MS);
    else this.held.delete(shipId);
    return outcome;
  }

  /** @param shipId - A ship. @returns Its last FIRE_SECONDARY outcome, held launches included. */
  lastOutcomeOf(shipId: string): FireOutcome | null {
    return this.outcomes.get(shipId) ?? null;
  }

  /**
   * One frame of the runtime; every hit goes to the link's damage path.
   * @param deltaMs - Frame length (ms).
   * @param nowMs - Battle time (ms).
   * @returns The frame's events (effects, cloak changes, hits).
   */
  update(deltaMs: number, nowMs: number): WeaponEvent[] {
    this.releaseHeld(nowMs);
    const events = this.runtime.update(this.world, deltaMs, nowMs);
    for (const event of events) {
      if (event.kind === "hit") this.link.applyHit(event, nowMs);
    }
    return events;
  }

  /**
   * @param shipId - A ship.
   * @returns Damage factor its cloak gives against every hit (1 = none).
   */
  incomingDamageFactor(shipId: string): number {
    return this.runtime.isCloaked(shipId) ? CLOAKED_DAMAGE_FACTOR : 1;
  }

  /** @param shipId - A ship that attacked (its cloak drops). */
  onAttack(shipId: string): void {
    this.runtime.breakCloak(shipId);
  }

  private releaseHeld(nowMs: number): void {
    for (const [shipId, untilMs] of this.held) {
      if (nowMs > untilMs) {
        this.held.delete(shipId);
        continue;
      }
      const outcome = this.runtime.fire(shipId, this.world, nowMs);
      if (outcome === "attacked") continue;
      this.held.delete(shipId);
      this.outcomes.set(shipId, outcome);
    }
  }
}
