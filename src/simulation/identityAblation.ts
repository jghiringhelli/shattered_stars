/**
 * identityAblation — a ship equipped without its faction's identity levers
 * (src/data/factionIdentity.ts): its identity cards are left in the hangar
 * (no stats, no sheet effect, no secondary weapon), a named pilot of an ace
 * faction flies without its ability, and the ship projects no faction aura.
 * The balance harness fields whole squads this way to measure what the
 * identity is worth to its faction (tests/balance/FactionIdentity.test.ts).
 *
 * Pure: no Phaser.
 */

import type { CombatModifiers } from "../core/CombatModifiers";
import { FACTION_IDENTITIES, isIdentityCard } from "../data/factionIdentity";
import { getShipDefinition } from "../data/ShipDefinitions";
import { getLoadoutById } from "../data/ShipLoadouts";
import { UPGRADE_CATALOG } from "../data/upgrades";
import { PILOT_CARDS } from "../systems/SquadBuilder";
import {
  applyUpgradeStatEffects,
  type LoadoutTarget,
} from "../systems/BattleHelpers";
import { resolveEquipmentModifiers } from "../arcade/ArcadeUpgradeEffects";
import { auraShipOf } from "../systems/aura/AllyAuraRepair";
import { projectionScaleFor } from "../systems/aura/FactionAuras";

/** What a ship flies with once its identity levers are removed. */
export interface StrippedEquipment {
  /** The quick build's cards that are not identity cards. */
  readonly upgradeIds: readonly string[];
  /** The pilot's ability, unless it is an identity lever. */
  readonly abilityId: string | undefined;
}

/**
 * @param definitionId - The hull.
 * @param loadoutId - Its quick build (null = bare hull).
 * @returns The build's equipment without its faction's identity levers.
 */
export function strippedEquipment(
  definitionId: string,
  loadoutId: string | null,
): StrippedEquipment {
  const loadout = loadoutId ? getLoadoutById(loadoutId) : undefined;
  const faction = getShipDefinition(definitionId)?.faction;
  if (!loadout || !faction) return { upgradeIds: [], abilityId: undefined };
  const identity = FACTION_IDENTITIES[faction];
  const pilot = PILOT_CARDS[loadout.pilotId];
  const dropAbility = identity.aceAbilities && pilot?.isUnique === true;
  return {
    upgradeIds: loadout.upgrades.filter(
      (id) => !isIdentityCard(identity, id, UPGRADE_CATALOG[id]?.slotType),
    ),
    abilityId: dropAbility ? undefined : pilot?.abilityId,
  };
}

/**
 * Equip a freshly built ship without its identity levers: the remaining
 * cards' stat bonuses go onto the ship and its sheet is returned.
 * @param ship - The new ship (stats bumped in place).
 * @param loadoutId - Its quick build.
 * @returns The sheet and the cards it flies with (weapons arm from them).
 */
export function equipWithoutIdentity(
  ship: LoadoutTarget,
  loadoutId: string | null,
): {
  readonly modifiers: CombatModifiers;
  readonly upgradeIds: readonly string[];
} {
  const equipment = strippedEquipment(ship.definitionId, loadoutId);
  applyUpgradeStatEffects(ship, equipment.upgradeIds);
  return {
    modifiers: resolveEquipmentModifiers(
      equipment.upgradeIds,
      equipment.abilityId,
    ),
    upgradeIds: equipment.upgradeIds,
  };
}

/** A squad's ship as the usage count reads it. */
export interface UsageShip {
  readonly definitionId: string;
  readonly loadoutId: string | null;
}

/** How much of a squad flies its faction's identity. */
export interface IdentityUsage {
  readonly ships: number;
  /** Ships flying an identity card or an identity ace ability. */
  readonly identityShips: number;
  /** Ships that project the faction aura (support, hero, coordinator…). */
  readonly auraProjectors: number;
}

/**
 * @param ships - A squad's ships on their quick builds.
 * @returns How many fly identity cards / abilities and project the aura.
 */
export function identityUsage(ships: readonly UsageShip[]): IdentityUsage {
  let identityShips = 0;
  let auraProjectors = 0;
  for (const ship of ships) {
    if (fliesIdentity(ship)) identityShips += 1;
    if (projectsAura(ship)) auraProjectors += 1;
  }
  return { ships: ships.length, identityShips, auraProjectors };
}

function fliesIdentity(ship: UsageShip): boolean {
  const loadout = ship.loadoutId ? getLoadoutById(ship.loadoutId) : undefined;
  if (!loadout) return false;
  const stripped = strippedEquipment(ship.definitionId, ship.loadoutId);
  const ability = PILOT_CARDS[loadout.pilotId]?.abilityId;
  return (
    stripped.upgradeIds.length < loadout.upgrades.length ||
    stripped.abilityId !== ability
  );
}

function projectsAura(ship: UsageShip): boolean {
  const def = getShipDefinition(ship.definitionId);
  if (!def) return false;
  const stats = def.baseStats;
  const snapshot = auraShipOf({
    id: ship.definitionId,
    definitionId: ship.definitionId,
    faction: def.faction,
    x: 0,
    y: 0,
    hull: stats.hull,
    shields: stats.shields,
    maxShields: stats.shields,
    loadoutId: ship.loadoutId,
  });
  return projectionScaleFor(snapshot) !== null;
}
