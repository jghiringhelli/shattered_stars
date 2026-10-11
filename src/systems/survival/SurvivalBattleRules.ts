/**
 * Survival roguelite — the rules of one battle node, as a pure facade for
 * SurvivalScene: which fleet spawns with how much hull, each wave's size /
 * faction / tiers / belt, elite affixes, relic & mutation effects (through
 * RelicCombatEngine), kill bookkeeping and the outcome handed back to the
 * run. Seeded from the node, so a battle's own rolls are reproducible.
 */

import type { FactionId } from "../../config";
import {
  combineEffects,
  type CombatModifiers,
} from "../../core/CombatModifiers";
import { createSeededRng, type RandomGenerator } from "../../utils/random";
import { getShipsByFaction } from "../../data/ShipDefinitions";
import { rollAffixes, type EliteAffix } from "../../data/survival/affixes";
import type {
  RosterShip,
  WaveTier,
} from "../../arcade/systems/SurvivalLoadouts";
import {
  tierAbove,
  survivalEnemyTier,
} from "../../arcade/systems/SurvivalSteering";
import type { BotTier } from "../../arcade/ai/BotTypes";
import { killSalvage } from "./RunEconomy";
import {
  maxHullMultiplier,
  staticEffectsFor,
  upgradeHull,
  type FleetLoadout,
  type FleetRole,
} from "./FleetEffects";
import { RelicCombatEngine } from "./RelicCombatEngine";
import type { CombatPlan } from "./CombatNodePlan";
import type { CombatOutcome } from "./CombatResolution";
import type { RunState, ShipRecord } from "./RunTypes";

/** Ship roles never fielded as regular wave ships (too big for a patrol). */
const EXCLUDED_ROSTER_ROLES: ReadonlySet<string> = new Set(["capital"]);

/** One wave of the node. */
export interface WaveSpec {
  readonly index: number;
  readonly total: number;
  readonly isBossWave: boolean;
  readonly faction: FactionId;
  /** Wave number fed to survivalEnemyTier. */
  readonly tierWave: number;
  readonly beltSteps: number;
}

/** The durability / modifiers of a ship being equipped. */
export interface EquipTarget {
  hull: number;
  maxHull: number;
  shields: number;
  maxShields: number;
  modifiers: CombatModifiers;
}

/** A living player ship at the end of the battle. */
export interface SurvivorView {
  readonly record: ShipRecord;
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
}

export class SurvivalBattleRules {
  readonly engine: RelicCombatEngine;
  readonly rng: RandomGenerator;
  readonly loadout: FleetLoadout;
  private wave = 0;
  private current: WaveSpec | null = null;
  private kills = 0;
  private elites = 0;
  private bosses = 0;
  private salvage = 0;
  private readonly ranks = new Map<string, WaveTier>();

  /**
   * @param run - The run (relics, mutations, fleet, economy).
   * @param plan - The node's battle plan.
   */
  constructor(
    private readonly run: RunState,
    readonly plan: CombatPlan,
  ) {
    this.rng = createSeededRng(plan.combatSeed);
    this.loadout = {
      relicIds: run.relics,
      mutationIds: Object.values(run.mutations).filter(
        (m): m is string => typeof m === "string",
      ),
      speed: run.progression.bonuses.speed,
    };
    this.engine = new RelicCombatEngine(this.loadout);
  }

  /** @returns The fleet to spawn, flagship first. */
  fleet(): ShipRecord[] {
    return [this.run.flagship, ...this.run.escorts];
  }

  /**
   * Folds relics, mutations, Drive and upgrades into a freshly built player
   * ship and sets its persisted hull / shields.
   *
   * @param ship - The ship (already carrying its quick build and run bonuses).
   * @param role - Flagship or escort.
   * @param record - Its saved record.
   */
  equipPlayer(ship: EquipTarget, role: FleetRole, record: ShipRecord): void {
    const combined = combineEffects([
      ship.modifiers,
      ...staticEffectsFor(this.loadout, role, record.upgrades),
    ]);
    ship.modifiers = this.engine.passiveShieldRegen(role)
      ? combined
      : { ...combined, shieldRegenPerSecond: 0 };
    ship.maxHull = Math.round(
      (ship.maxHull + upgradeHull(record.upgrades)) *
        maxHullMultiplier(this.loadout, role),
    );
    ship.hull = Math.max(1, Math.round(ship.maxHull * record.hull));
    ship.shields = Math.round(ship.maxShields * record.shields);
  }

  /** @returns The next wave's spec (call once per wave). */
  nextWave(): WaveSpec {
    this.wave += 1;
    const plan = this.plan;
    this.current = {
      index: this.wave,
      total: plan.waves,
      isBossWave: plan.kind === "boss" && this.wave === plan.waves,
      faction: plan.enemyFaction,
      tierWave: plan.effectiveWave + this.wave - 1,
      beltSteps: plan.beltSteps + this.wave - 1,
    };
    return this.current;
  }

  /** @returns The wave in progress (reinforcements fly as its regulars). */
  currentWave(): WaveSpec {
    return this.current ?? this.nextWave();
  }

  /** @returns True once the last wave has been spawned. */
  get onLastWave(): boolean {
    return this.wave >= this.plan.waves;
  }

  /**
   * @param faction - The wave's faction.
   * @returns Its roster without capital ships.
   */
  roster(faction: FactionId): RosterShip[] {
    return getShipsByFaction(faction).filter(
      (ship) => !EXCLUDED_ROSTER_ROLES.has(ship.role),
    );
  }

  /** @returns Affixes for one elite. */
  eliteAffixes(): EliteAffix[] {
    return rollAffixes(this.rng, this.plan.eliteAffixCount);
  }

  /**
   * @param spec - The wave.
   * @param rank - The ship's rank.
   * @param affixes - Its affixes.
   * @returns The bot tier its pilot flies at.
   */
  tierFor(
    spec: WaveSpec,
    rank: WaveTier,
    affixes: readonly EliteAffix[],
  ): BotTier {
    const tier = survivalEnemyTier(spec.tierWave, rank);
    return affixes.some((a) => a.tierBoost) ? tierAbove(tier) : tier;
  }

  /**
   * Applies ascension hull and an elite's affixes to an enemy.
   *
   * @param ship - The enemy.
   * @param affixes - Its affixes (empty for regulars).
   * @returns Attack dice it gains.
   */
  equipEnemy(ship: EquipTarget, affixes: readonly EliteAffix[]): number {
    const hullScale = affixes.reduce(
      (m, a) => m * (a.hullMultiplier ?? 1),
      this.plan.enemyHullMultiplier,
    );
    const shieldScale = affixes.reduce(
      (m, a) => m * (a.shieldMultiplier ?? 1),
      1,
    );
    ship.maxHull = Math.round(ship.maxHull * hullScale);
    ship.hull = ship.maxHull;
    ship.maxShields = Math.round(ship.maxShields * shieldScale);
    ship.shields = ship.maxShields;
    ship.modifiers = combineEffects([
      ship.modifiers,
      ...affixes.flatMap((a) => (a.effect ? [a.effect] : [])),
    ]);
    return affixes.reduce((sum, a) => sum + (a.attackDiceBonus ?? 0), 0);
  }

  /**
   * @param id - An enemy's id.
   * @param rank - Its rank.
   */
  registerEnemy(id: string, rank: WaveTier): void {
    this.ranks.set(id, rank);
  }

  /**
   * Banks a kill by the player's fleet.
   *
   * @param id - The destroyed enemy.
   * @returns Salvage it is worth (raw, before ascension).
   */
  recordKill(id: string): number {
    const rank = this.ranks.get(id) ?? "regular";
    this.kills += 1;
    if (rank === "elite") this.elites += 1;
    if (rank === "boss") this.bosses += 1;
    const salvage = killSalvage(this.run, rank);
    this.salvage += salvage;
    return salvage;
  }

  /** Kills scored so far. */
  get killCount(): number {
    return this.kills;
  }

  /** Raw kill salvage banked so far this battle. */
  get salvageEarned(): number {
    return this.salvage;
  }

  /**
   * @param survivors - Living player ships, flagship first.
   * @param progressionLevel - The run controller's level after the battle.
   * @param durationMs - Battle length.
   * @returns The outcome for CombatResolution.
   */
  outcome(
    survivors: readonly SurvivorView[],
    progressionLevel: number,
    durationMs: number,
  ): CombatOutcome {
    return {
      survivors: survivors.map((s) => ({
        ...s.record,
        hull: s.maxHull > 0 ? Math.max(0, Math.min(1, s.hull / s.maxHull)) : 0,
        shields:
          s.maxShields > 0
            ? Math.max(0, Math.min(1, s.shields / s.maxShields))
            : 1,
      })),
      kills: this.kills,
      elitesKilled: this.elites,
      bossesKilled: this.bosses,
      killSalvage: this.salvage,
      progressionLevel,
      durationMs,
    };
  }
}
