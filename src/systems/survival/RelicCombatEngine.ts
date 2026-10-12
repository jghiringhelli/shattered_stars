/**
 * Survival roguelite — real-time relic & mutation rules during a battle.
 *
 * The battle scene asks this engine at its consumption points:
 * - a flight event / committed maneuver → timed buffs (Adrenal Injector,
 *   Slipstream Vanes, Afterburner Core…), shield restores;
 * - a shot → hit-chance / damage / crit adjustments (marked targets,
 *   escort count, mutations, active buffs) and how many bolts to roll;
 * - incoming damage → protective multipliers (buffs, Formation Lock);
 * - a kill → shield restore (Reactive Shields).
 * Static knobs are folded in at spawn (FleetEffects). No Phaser.
 */

import type { ManeuverDifficulty } from "../../core/types";
import type { FlightEvent } from "../../arcade/systems/PilotFlightTypes";
import type { RelicTrigger, TimedBuff } from "../../data/survival/relics";
import {
  mutationsOf,
  relicEffectsOf,
  scopeIncludes,
  type FleetLoadout,
  type FleetRole,
} from "./FleetEffects";

/** A shot's relic adjustments. */
export interface ShotAdjust {
  readonly hitChanceBonus: number;
  readonly damageBonus: number;
  readonly damageMultiplier: number;
  readonly critChanceBonus: number;
  /** Bolts to roll for this attack (Scatter Array fires 2). */
  readonly shots: number;
}

/** A shot as the engine sees it. */
export interface ShotQuery {
  readonly shooterId: string;
  readonly role: FleetRole;
  readonly targetMarked: boolean;
  readonly escortsAlive: number;
  readonly nowMs: number;
}

/** What the scene must apply after a trigger. */
export interface TriggerResult {
  /** Fraction of the ship's max shields to restore now. */
  readonly shieldRestoreFraction: number;
  /** Names of buffs started (for floating text). */
  readonly started: readonly string[];
}

const FLIGHT_TRIGGERS: Readonly<Partial<Record<FlightEvent, RelicTrigger>>> = {
  barrel_roll: "barrel_roll",
  boost: "boost",
  kturn: "kturn",
  segnor: "kturn",
  tallon: "kturn",
};

const NO_TRIGGER: TriggerResult = { shieldRestoreFraction: 0, started: [] };

export class RelicCombatEngine {
  private readonly buffs = new Map<
    string,
    { buff: TimedBuff; untilMs: number }[]
  >();
  private readonly triggers: { on: RelicTrigger; buff: TimedBuff }[];

  /**
   * @param loadout - The run's relics, mutations and Drive investment.
   * @param enemyDamageScale - Multiplier on every hit the fleet takes (the
   *   node's enemy lethality, CombatPlan.enemyDamageMultiplier); default 1.
   */
  constructor(
    private readonly loadout: FleetLoadout,
    private readonly enemyDamageScale = 1,
  ) {
    this.triggers = [
      ...relicEffectsOf(loadout).flatMap((e) =>
        e.kind === "trigger" ? [{ on: e.on, buff: e.buff }] : [],
      ),
      ...mutationsOf(loadout).flatMap((m) =>
        m.rules.trigger ? [m.rules.trigger] : [],
      ),
    ];
  }

  /**
   * @param shipId - The ship that acted.
   * @param role - Its role (triggers fire for the flagship only).
   * @param event - The flight event.
   * @param nowMs - Scene time.
   * @returns Buffs started and shields to restore.
   */
  onFlightEvent(
    shipId: string,
    role: FleetRole,
    event: FlightEvent,
    nowMs: number,
  ): TriggerResult {
    const trigger = FLIGHT_TRIGGERS[event];
    return trigger && role === "flagship"
      ? this.fire(shipId, trigger, nowMs)
      : NO_TRIGGER;
  }

  /**
   * @param shipId - The ship whose maneuver committed.
   * @param role - Its role.
   * @param difficulty - The committed maneuver's dial colour.
   * @param nowMs - Scene time.
   * @returns Buffs started and shields to restore.
   */
  onManeuver(
    shipId: string,
    role: FleetRole,
    difficulty: ManeuverDifficulty,
    nowMs: number,
  ): TriggerResult {
    if (difficulty !== "red" || role !== "flagship") return NO_TRIGGER;
    return this.fire(shipId, "red_maneuver", nowMs);
  }

  private fire(shipId: string, on: RelicTrigger, nowMs: number): TriggerResult {
    const fired = this.triggers.filter((t) => t.on === on);
    if (fired.length === 0) return NO_TRIGGER;
    const kept = this.live(shipId, nowMs).filter(
      (b) => !fired.some((f) => f.buff.id === b.buff.id),
    );
    const added = fired.map((f) => ({
      buff: f.buff,
      untilMs: nowMs + f.buff.durationMs,
    }));
    this.buffs.set(shipId, [...kept, ...added]);
    return {
      shieldRestoreFraction: fired.reduce(
        (sum, f) => sum + (f.buff.shieldRestoreFraction ?? 0),
        0,
      ),
      started: fired.filter((f) => f.buff.durationMs > 1).map((f) => f.buff.id),
    };
  }

  private live(
    shipId: string,
    nowMs: number,
  ): { buff: TimedBuff; untilMs: number }[] {
    return (this.buffs.get(shipId) ?? []).filter((b) => b.untilMs > nowMs);
  }

  /**
   * @param query - The shot.
   * @returns Its relic / mutation adjustments.
   */
  shot(query: ShotQuery): ShotAdjust {
    const effects = relicEffectsOf(this.loadout);
    let hit = 0;
    let damage = 0;
    let crit = 0;
    for (const e of effects) {
      if (
        e.kind === "marked" &&
        query.targetMarked &&
        scopeIncludes(e.scope, query.role)
      ) {
        hit += e.hitChanceBonus;
        damage += e.damageBonus;
        crit += e.critChanceBonus;
      }
      if (e.kind === "perEscort" && query.role === "flagship") {
        damage += Math.floor(query.escortsAlive / e.escortsPerDamage);
      }
    }
    for (const { buff } of this.live(query.shooterId, query.nowMs)) {
      hit += buff.hitChanceBonus ?? 0;
      damage += buff.damageBonus ?? 0;
    }
    const mutations =
      query.role === "flagship" ? mutationsOf(this.loadout) : [];
    return {
      hitChanceBonus:
        hit + mutations.reduce((s, m) => s + (m.rules.hitChanceBonus ?? 0), 0),
      damageBonus: damage,
      damageMultiplier: mutations.reduce(
        (p, m) => p * (m.rules.damageMultiplier ?? 1),
        1,
      ),
      critChanceBonus: crit,
      shots: Math.max(1, ...mutations.map((m) => m.rules.shotsPerAttack ?? 1)),
    };
  }

  /**
   * @param shipId - The player ship hit.
   * @param role - Its role.
   * @param escortsAlive - Living escorts.
   * @param nowMs - Scene time.
   * @returns Multiplier on the incoming damage (<1 protects): the node's
   *   enemy lethality, live buffs and Formation Lock.
   */
  incomingMultiplier(
    shipId: string,
    role: FleetRole,
    escortsAlive: number,
    nowMs: number,
  ): number {
    let multiplier = this.enemyDamageScale;
    for (const { buff } of this.live(shipId, nowMs))
      multiplier *= buff.damageTakenMultiplier ?? 1;
    if (role === "flagship") {
      for (const e of relicEffectsOf(this.loadout)) {
        if (e.kind === "formation" && escortsAlive >= e.minEscorts)
          multiplier *= e.damageTakenMultiplier;
      }
    }
    return multiplier;
  }

  /**
   * @param role - The killer's role.
   * @returns Fraction of the killer's max shields to restore.
   */
  killShieldFraction(role: FleetRole): number {
    if (role !== "flagship") return 0;
    return mutationsOf(this.loadout).reduce(
      (s, m) => s + (m.rules.killShieldFraction ?? 0),
      0,
    );
  }

  /**
   * @param role - A ship's role.
   * @returns False when its shields must not regenerate on their own.
   */
  passiveShieldRegen(role: FleetRole): boolean {
    return (
      role !== "flagship" ||
      !mutationsOf(this.loadout).some((m) => m.rules.noPassiveShieldRegen)
    );
  }

  /**
   * @param role - A ship's role.
   * @returns Multiplier on its attack interval (Rail Driver).
   */
  attackIntervalMultiplier(role: FleetRole): number {
    if (role !== "flagship") return 1;
    return mutationsOf(this.loadout).reduce(
      (p, m) => p * (m.rules.attackIntervalMultiplier ?? 1),
      1,
    );
  }

  /**
   * @param role - A ship's role.
   * @returns Extra weapon range (px) from mutations.
   */
  rangeBonusPx(role: FleetRole): number {
    if (role !== "flagship") return 0;
    return mutationsOf(this.loadout).reduce(
      (s, m) => s + (m.rules.rangeBonusPx ?? 0),
      0,
    );
  }

  /**
   * @param shipId - A ship.
   * @param nowMs - Scene time.
   * @returns Ids of its active buffs (HUD).
   */
  activeBuffs(shipId: string, nowMs: number): string[] {
    return this.live(shipId, nowMs).map((b) => b.buff.id);
  }
}
