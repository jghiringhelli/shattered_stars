/**
 * simAuras — repair and faction auras for any headless sim's ships, the way
 * every battle scene applies them since the combat unification: each
 * ship's own shield regen and hull repair (its sheet's rates, hull paused
 * after damage), then each side's faction auras (support ships, hero
 * pilots, coordinator crews) resolved by the shared applyAllyAuraRepairs —
 * the repair channel applied here, the shot / mitigation / stress buffs
 * returned for the sim's combat and flight steps.
 *
 * Mutates the ships' hull and shields. Pure: no Phaser.
 */

import type { FactionId } from "../config";
import type { CombatModifiers } from "../core/CombatModifiers";
import {
  DamagePauseTracker,
  repairStep,
} from "../arcade/systems/repair/HullRepair";
import { getShipDefinition } from "../data/ShipDefinitions";
import {
  applyAllyAuraRepairs,
  type AllyRepairRates,
  type AuraFieldShip,
} from "../systems/aura/AllyAuraRepair";
import type { ActiveAura } from "../systems/SupportAura";

export { DamagePauseTracker };

/** Faction assumed for a hull whose definition is unknown (never in practice). */
const FALLBACK_FACTION: FactionId = "free_confederation";

/** No ship is covered by an aura. */
export const NO_AURAS: ReadonlyMap<string, ActiveAura> = new Map();

/** What a sim ship exposes to repair and auras (mutable hull / shields). */
export interface SimAuraShip {
  readonly id: string;
  readonly definitionId: string;
  readonly loadoutId: string | null;
  readonly x: number;
  readonly y: number;
  hull: number;
  readonly maxHull: number;
  shields: number;
  readonly maxShields: number;
  readonly modifiers: CombatModifiers;
}

/**
 * One frame of repair and auras for the living ships.
 * @param ships - The living ships (mutated: hull, shields).
 * @param sideOf - The side a ship fights for (auras never cross sides).
 * @param tracker - Damage-pause bookkeeping kept across frames.
 * @param deltaMs - Frame length (ms).
 * @returns The aura covering each covered ship this frame.
 */
export function updateSimAuras<S extends SimAuraShip>(
  ships: readonly S[],
  sideOf: (ship: S) => string,
  tracker: DamagePauseTracker,
  deltaMs: number,
): ReadonlyMap<string, ActiveAura> {
  for (const ship of ships) selfRepair(ship, tracker, deltaMs);
  return applyAllyAuraRepairs(
    ships.map((ship) => auraFieldOf(ship, sideOf(ship))),
    {
      auraRepair: (field, rates) =>
        auraRepair(field.ship, rates, tracker, deltaMs),
    },
    deltaMs,
  );
}

/** A sim ship as the shared aura resolver reads it. */
interface SimAuraField<S extends SimAuraShip> extends AuraFieldShip {
  readonly ship: S;
}

function auraFieldOf<S extends SimAuraShip>(
  ship: S,
  side: string,
): SimAuraField<S> {
  return {
    ship,
    id: ship.id,
    definitionId: ship.definitionId,
    faction: getShipDefinition(ship.definitionId)?.faction ?? FALLBACK_FACTION,
    x: ship.x,
    y: ship.y,
    hull: ship.hull,
    shields: ship.shields,
    maxShields: ship.maxShields,
    loadoutId: ship.loadoutId,
    owner: side,
    modifiers: ship.modifiers,
  };
}

function selfRepair(
  ship: SimAuraShip,
  tracker: DamagePauseTracker,
  deltaMs: number,
): void {
  const quietMs = tracker.observe(ship.id, ship.hull, ship.shields, deltaMs);
  const { shieldRegenPerSecond, hullRepairPerSecond } = ship.modifiers;
  if (shieldRegenPerSecond <= 0 && hullRepairPerSecond <= 0) return;
  restore(
    ship,
    { shieldRegenPerSecond, hullRepairPerSecond },
    deltaMs,
    quietMs,
  );
}

function auraRepair(
  ship: SimAuraShip,
  rates: AllyRepairRates,
  tracker: DamagePauseTracker,
  deltaMs: number,
): void {
  if (rates.shieldRegenPerSecond <= 0 && rates.hullRepairPerSecond <= 0) return;
  restore(ship, rates, deltaMs, tracker.quietMs(ship.id));
}

function restore(
  ship: SimAuraShip,
  rates: Pick<AllyRepairRates, "shieldRegenPerSecond" | "hullRepairPerSecond">,
  deltaMs: number,
  quietMs: number,
): void {
  const next = repairStep({
    hull: ship.hull,
    maxHull: ship.maxHull,
    shields: ship.shields,
    maxShields: ship.maxShields,
    shieldRegenPerSecond: rates.shieldRegenPerSecond,
    hullRepairPerSecond: rates.hullRepairPerSecond,
    deltaMs,
    msSinceDamage: quietMs,
  });
  ship.hull = next.hull;
  ship.shields = next.shields;
}
