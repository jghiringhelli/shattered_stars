/**
 * AllyAuraRepair — faction auras for any battle mode's ships, feeding the
 * repair part (shield regen + support hull repair) to the scene's repair
 * sink (ShipRepairFeedback) exactly as Skirmish does, so ally-to-ally repair
 * drones fly in Boss Raid, Continuous, Survival and Campaign too.
 *
 * A mode ship carries only its hull id and quick build; role and size come
 * from the hull definition, the unique pilot and upgrades from the build.
 * Only the repair channels are applied here; the damage / hit-chance /
 * mitigation / stress buffs are returned for each mode to apply at its own
 * consumption points (resolveDiceAttack attackerAura / targetAura,
 * stressModifiersOf aura, DamageRules.damageMitigationOf). A projector's
 * pilot ability shapes its aura through its folded sheet (AuraShipFacts).
 *
 * Pure apart from the sink it is handed.
 */

import type { FactionId } from "../../config";
import { getShipDefinition } from "../../data/ShipDefinitions";
import { getLoadoutById } from "../../data/ShipLoadouts";
import { uniquePilotOf } from "../../data/squadRules";
import { isBridgeOffline, type CapitalSystemsState } from "../CapitalSystems";
import { resolveSupportAuras, type ActiveAura } from "../SupportAura";
import type { AuraShip } from "./FactionAuras";
import type { CombatModifiers } from "../../core/CombatModifiers";
import { auraFactsOf, auraShipFacts } from "./AuraShipFacts";

/** What a mode's ship must expose to project or receive an aura. */
export interface AuraFieldShip {
  readonly id: string;
  readonly definitionId: string;
  readonly faction: FactionId;
  readonly x: number;
  readonly y: number;
  readonly hull: number;
  readonly shields: number;
  readonly maxShields: number;
  readonly loadoutId: string | null;
  readonly capitalSystems?: CapitalSystemsState | null;
  /**
   * Side the ship fights for. When set, auras only reach ships of the same
   * side (a mirror match never heals the enemy); else the faction decides.
   */
  readonly owner?: string;
  /**
   * The ship's folded modifier sheet (quick build, pilot ability, relics,
   * campaign abilities). When set, its aura knobs are read from it; else
   * from the quick build (auraShipFacts).
   */
  readonly modifiers?: CombatModifiers;
}

/** Repair rates a covered ship receives this frame. */
export interface AllyRepairRates {
  readonly shieldRegenPerSecond: number;
  readonly hullRepairPerSecond: number;
  /** The projector credited (repair drones fly from it). */
  readonly repairSourceId: string | null;
}

/** Applies an allied repair field (ShipRepairFeedback implements it). */
export interface AuraRepairSink<S> {
  auraRepair(ship: S, rates: AllyRepairRates, deltaMs: number): unknown;
}

/** Hull role / size assumed for a ship whose definition is unknown. */
const FALLBACK_ROLE = "light_fighter";
const FALLBACK_SIZE = "small";

/** What a quick build contributes to aura eligibility. */
interface LoadoutAuraFacts {
  readonly isUnique: boolean;
  readonly upgrades: readonly string[];
}

const NO_LOADOUT: LoadoutAuraFacts = { isUnique: false, upgrades: [] };

/**
 * Memo of immutable catalogue facts per loadout id: the catalogue lookup is
 * a linear scan, and auras resolve every frame for every ship.
 */
const loadoutFacts = new Map<string, LoadoutAuraFacts>();

function factsOf(loadoutId: string | null): LoadoutAuraFacts {
  if (!loadoutId) return NO_LOADOUT;
  const cached = loadoutFacts.get(loadoutId);
  if (cached) return cached;
  const facts = {
    isUnique: uniquePilotOf(loadoutId) !== null,
    upgrades: getLoadoutById(loadoutId)?.upgrades ?? [],
  };
  loadoutFacts.set(loadoutId, facts);
  return facts;
}

/**
 * @param ship - A mode's ship.
 * @returns Its aura snapshot.
 */
export function auraShipOf(ship: AuraFieldShip): AuraShip {
  const def = getShipDefinition(ship.definitionId);
  const facts = factsOf(ship.loadoutId);
  return {
    id: ship.id,
    x: ship.x,
    y: ship.y,
    faction: ship.faction,
    role: def?.role ?? FALLBACK_ROLE,
    size: def?.baseStats.size ?? FALLBACK_SIZE,
    isUnique: facts.isUnique,
    equippedUpgrades: facts.upgrades,
    hull: ship.hull,
    shields: ship.shields,
    maxShields: ship.maxShields,
    systemsOnline: ship.capitalSystems
      ? !isBridgeOffline(ship.capitalSystems)
      : true,
    ...(ship.modifiers
      ? auraFactsOf(ship.modifiers)
      : auraShipFacts(ship.definitionId, ship.loadoutId)),
  };
}

/**
 * Resolve every faction aura for this frame (per side) and apply its repair
 * rates to the covered ships through the sink. A capital's hull is the sum
 * of its systems — its repair crews own that pool — so it only gets shields.
 *
 * @param ships - Every ship in play (both sides).
 * @param sink - The scene's repair feedback (null: resolve only).
 * @param deltaMs - Frame length (ms).
 * @returns The resolved buffs per covered ship.
 */
export function applyAllyAuraRepairs<S extends AuraFieldShip>(
  ships: Iterable<S>,
  sink: AuraRepairSink<S> | null,
  deltaMs: number,
): ReadonlyMap<string, ActiveAura> {
  const sides = new Map<string, S[]>();
  for (const ship of ships) {
    const side = ship.owner ?? ship.faction;
    const roster = sides.get(side);
    if (roster) roster.push(ship);
    else sides.set(side, [ship]);
  }
  const buffs = new Map<string, ActiveAura>();
  for (const roster of sides.values()) {
    const resolved = resolveSupportAuras(roster.map(auraShipOf)).buffs;
    for (const ship of roster) {
      const aura = resolved.get(ship.id);
      if (!aura) continue;
      buffs.set(ship.id, aura);
      sink?.auraRepair(
        ship,
        ship.capitalSystems ? { ...aura, hullRepairPerSecond: 0 } : aura,
        deltaMs,
      );
    }
  }
  return buffs;
}
