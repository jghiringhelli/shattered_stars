/**
 * WeaponTelemetry — headless Monte-Carlo damage sampling for every weapon type.
 *
 * Drives the REAL combat resolvers (resolveAttack, fireOrdnance, fireTurret) so
 * the numbers match live gameplay, and reports per-weapon damage, hit rate and
 * damage-per-point so we can see how non-laser weapons (turrets, missiles,
 * torpedoes, bombs, mines, rockets) stack up against their squad-point cost.
 */

import type { ShipState } from "../core/types";
import type { RandomGenerator } from "../utils/random";
import { createSeededRng } from "../utils/random";
import { resolveAttack, type AttackContext } from "../systems/CombatSystem";
import {
  fireOrdnance,
  ORDNANCE_DEFINITIONS,
  deployBomb,
  detonateBomb,
  type OrdnanceDefinition,
} from "../systems/OrdnanceSystem";
import {
  fireTurret,
  createTurretState,
  TURRET_DEFINITIONS,
  type TurretDefinition,
} from "../systems/TurretSystem";

/** Aggregate outcome of sampling one weapon many times. */
export interface DamageSample {
  readonly samples: number;
  readonly mean: number;
  readonly min: number;
  readonly max: number;
  /** Fraction of shots dealing at least 1 damage. */
  readonly hitRate: number;
}

/** Comparable damage/cost profile for a single non-primary weapon. */
export interface WeaponProfile {
  readonly id: string;
  readonly name: string;
  readonly category: "ordnance" | "turret";
  readonly subtype: string;
  readonly pointCost: number;
  readonly charges: number;
  /** Mean damage of a single shot. */
  readonly meanDamage: number;
  readonly hitRate: number;
  /** Mean damage per squad point for a single shot. */
  readonly damagePerPoint: number;
  /** Mean damage per point across all charges (burst value of the card). */
  readonly burstDamagePerPoint: number;
  readonly note: string;
}

const DEFAULT_SAMPLES = 20_000;

/** Minimal ShipState fixture; only the fields the resolvers read matter. */
function makeShip(id: string, x: number, y: number): ShipState {
  return {
    id,
    definitionId: "telemetry_dummy",
    faction: "terran_hegemony",
    owner: "player",
    x,
    y,
    angle: 0,
    hull: 90,
    maxHull: 90,
    shields: 0,
    maxShields: 0,
    isStressed: false,
    hasFocus: false,
    hasEvade: false,
    hasTargetLock: null,
    isCloaked: false,
    currentManeuver: null,
    maneuverProgress: 0,
    mobileArcDirection: "front",
    charges: 0,
    maxCharges: 0,
  };
}

function summarize(values: number[]): DamageSample {
  const samples = values.length;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  let hits = 0;
  for (const v of values) {
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
    if (v > 0) hits++;
  }
  return {
    samples,
    mean: samples > 0 ? sum / samples : 0,
    min: samples > 0 ? min : 0,
    max: samples > 0 ? max : 0,
    hitRate: samples > 0 ? hits / samples : 0,
  };
}

/** Options controlling attacker/defender tokens for primary-weapon sampling. */
export interface LaserOptions {
  readonly defenseDice: number;
  readonly range?: 1 | 2 | 3;
  readonly attackerHasFocus?: boolean;
  readonly attackerHasTargetLock?: boolean;
  readonly defenderHasFocus?: boolean;
  readonly defenderShields?: number;
  readonly defenderHull?: number;
}

/** Sample a primary-weapon (laser) attack of `attackDice` via resolveAttack. */
export function sampleLaserDamage(
  attackDice: number,
  opts: LaserOptions,
  samples: number = DEFAULT_SAMPLES,
  rng: RandomGenerator = createSeededRng(1),
): DamageSample {
  const context: AttackContext = {
    attackDice,
    attackerHasFocus: opts.attackerHasFocus ?? false,
    attackerHasTargetLock: opts.attackerHasTargetLock ?? false,
    defenseDice: opts.defenseDice,
    defenderHasFocus: opts.defenderHasFocus ?? false,
    defenderHasEvadeToken: false,
    defenderShields: opts.defenderShields ?? 90,
    defenderHull: opts.defenderHull ?? 90,
    range: opts.range ?? 2,
  };
  const values: number[] = [];
  for (let i = 0; i < samples; i++) {
    values.push(resolveAttack(context, rng).totalDamage);
  }
  return summarize(values);
}

/** Sample ordnance damage (hits + crits + bonus). Ordnance ignores agility. */
export function sampleOrdnanceDamage(
  ordnance: OrdnanceDefinition,
  samples: number = DEFAULT_SAMPLES,
  rng: RandomGenerator = createSeededRng(1),
): DamageSample {
  if (ordnance.type === "bomb" || ordnance.type === "mine") {
    return sampleBombDamage(ordnance, samples, rng);
  }
  const attacker = makeShip("attacker", 0, 0);
  const target = makeShip("target", 100, 0);
  const values: number[] = [];
  for (let i = 0; i < samples; i++) {
    const r = fireOrdnance(attacker, target, ordnance, rng);
    values.push(r.hits + r.crits + r.bonusDamage);
  }
  return summarize(values);
}

/**
 * Sample bomb/mine damage via the real deploy + detonate path. Bombs are NOT
 * fired with dice — flat/seismic bombs deal bonusDamage, cluster bombs roll
 * dice, and ion bombs deal zero HULL damage (they only apply ion tokens).
 */
export function sampleBombDamage(
  ordnance: OrdnanceDefinition,
  samples: number = DEFAULT_SAMPLES,
  rng: RandomGenerator = createSeededRng(1),
): DamageSample {
  const owner = makeShip("owner", 0, 0);
  const bomb = deployBomb(owner, ordnance);
  const target = {
    ...makeShip("target", bomb.x, bomb.y),
    faction: "void_corsairs" as const,
  };
  const values: number[] = [];
  for (let i = 0; i < samples; i++) {
    const result = detonateBomb(bomb, ordnance, [target], [], rng);
    values.push(result.affectedShips[0]?.damage ?? 0);
  }
  return summarize(values);
}

/** Distance (px) that fireTurret maps to a given range band (1/2/3). */
function distanceForBand(band: number): number {
  if (band <= 1) return 50;
  if (band === 2) return 150;
  return 250;
}

/** Sample turret damage (hits + crits) at a range band. Turrets ignore agility. */
export function sampleTurretDamage(
  definition: TurretDefinition,
  band: number,
  samples: number = DEFAULT_SAMPLES,
  rng: RandomGenerator = createSeededRng(1),
): DamageSample {
  const attacker = makeShip("attacker", 0, 0);
  const target = makeShip("target", distanceForBand(band), 0);
  const turret = createTurretState(definition.id);
  const values: number[] = [];
  for (let i = 0; i < samples; i++) {
    const r = fireTurret(attacker, target, turret, definition, rng);
    values.push(r.hits + r.crits);
  }
  return summarize(values);
}

function ordnanceProfile(
  def: OrdnanceDefinition,
  samples: number,
  rng: RandomGenerator,
): WeaponProfile {
  const dmg = sampleOrdnanceDamage(def, samples, rng);
  return {
    id: def.id,
    name: def.name,
    category: "ordnance",
    subtype: def.type,
    pointCost: def.pointCost,
    charges: def.charges,
    meanDamage: dmg.mean,
    hitRate: dmg.hitRate,
    damagePerPoint: dmg.mean / def.pointCost,
    burstDamagePerPoint: (dmg.mean * def.charges) / def.pointCost,
    note: def.effect !== "damage" ? `effect: ${def.effect}` : "",
  };
}

function turretProfile(
  def: TurretDefinition,
  samples: number,
  rng: RandomGenerator,
): WeaponProfile {
  // Closest valid band is strongest (range-1 bonus), so report that.
  const band = def.range.min;
  const dmg = sampleTurretDamage(def, band, samples, rng);
  return {
    id: def.id,
    name: def.name,
    category: "turret",
    subtype: `${def.arcType} ${def.arcSize}\u00b0`,
    pointCost: def.pointCost,
    charges: Infinity,
    meanDamage: dmg.mean,
    hitRate: dmg.hitRate,
    damagePerPoint: dmg.mean / def.pointCost,
    burstDamagePerPoint: dmg.mean / def.pointCost,
    note: `range ${def.range.min}-${def.range.max}`,
  };
}

/** Profile every ordnance and turret weapon, sorted by damage-per-point. */
export function profileAllWeapons(
  samples: number = DEFAULT_SAMPLES,
  rng: RandomGenerator = createSeededRng(1),
): WeaponProfile[] {
  const profiles: WeaponProfile[] = [];
  for (const def of Object.values(ORDNANCE_DEFINITIONS)) {
    profiles.push(ordnanceProfile(def, samples, rng));
  }
  for (const def of Object.values(TURRET_DEFINITIONS)) {
    profiles.push(turretProfile(def, samples, rng));
  }
  profiles.sort((a, b) => b.damagePerPoint - a.damagePerPoint);
  return profiles;
}
