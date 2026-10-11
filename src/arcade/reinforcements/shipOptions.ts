/**
 * shipOptions — turns a reserve entry (ship + loadout) into a deploy option:
 * its pool cost (the loadout's derived price, else the bare ship's), role,
 * quota categories (bomber, ace = unique pilot, capital) and label; plus a
 * faction's whole catalog of deployable quick builds.
 *
 * Pure (reads the static ship / loadout data).
 */

import type { FactionId } from "../../config";
import {
  getShipDefinition,
  getShipsByFaction,
} from "../../data/ShipDefinitions";
import { getLoadoutById, getShipLoadouts } from "../../data/ShipLoadouts";
import { uniquePilotOf } from "../../data/squadRules";
import type {
  DeployOption,
  ReinforcementFormat,
  ReserveEntry,
  ShipCategory,
} from "./reinforcementTypes";

/**
 * @param entry - A ship and its loadout (a loadout of another ship is dropped).
 * @returns The deploy option, or null for an unknown ship.
 */
export function toDeployOption(entry: ReserveEntry): DeployOption | null {
  const def = getShipDefinition(entry.definitionId);
  if (!def) return null;
  const loadout = entry.loadoutId ? getLoadoutById(entry.loadoutId) : undefined;
  const ownLoadout = loadout?.shipId === def.id ? loadout : undefined;
  const loadoutId = ownLoadout?.id ?? null;
  const uniquePilotId = uniquePilotOf(loadoutId);
  return {
    definitionId: def.id,
    loadoutId,
    cost: ownLoadout?.pointCost ?? def.baseStats.pointCost,
    role: def.role,
    categories: categoriesOf(
      def.role === "bomber",
      uniquePilotId !== null,
      def.role === "capital" || def.baseStats.size === "huge",
    ),
    uniquePilotId,
    label: ownLoadout?.name ?? def.name,
  };
}

/**
 * @param entries - Reserve entries.
 * @returns Their deploy options (unknown ships dropped).
 */
export function toDeployOptions(
  entries: readonly ReserveEntry[],
): DeployOption[] {
  return entries.flatMap((entry) => {
    const option = toDeployOption(entry);
    return option ? [option] : [];
  });
}

/**
 * @param format - The battle's format (capital ships only in Epic).
 * @param definitionId - A ship.
 * @returns Whether the format may field it at all.
 */
export function isFormatShip(
  format: ReinforcementFormat,
  definitionId: string,
): boolean {
  const def = getShipDefinition(definitionId);
  if (!def) return false;
  const isCapital = def.role === "capital" || def.baseStats.size === "huge";
  return format === "epic" || !isCapital;
}

/**
 * Every quick build of a faction the format allows, cheapest first.
 * @param faction - The faction.
 * @param format - The battle's format.
 * @returns The catalog.
 */
export function factionCatalog(
  faction: FactionId,
  format: ReinforcementFormat,
): DeployOption[] {
  const entries: ReserveEntry[] = getShipsByFaction(faction)
    .filter((def) => isFormatShip(format, def.id))
    .flatMap((def) =>
      getShipLoadouts(def.id).map((loadout) => ({
        definitionId: def.id,
        loadoutId: loadout.id,
      })),
    );
  return toDeployOptions(entries).sort(
    (a, b) => a.cost - b.cost || a.label.localeCompare(b.label),
  );
}

/**
 * @param option - A deploy option.
 * @param category - A category.
 * @returns Whether the option counts toward it.
 */
export function hasCategory(
  option: Pick<DeployOption, "categories">,
  category: ShipCategory,
): boolean {
  return option.categories.includes(category);
}

function categoriesOf(
  bomber: boolean,
  ace: boolean,
  capital: boolean,
): ShipCategory[] {
  const out: ShipCategory[] = [];
  if (bomber) out.push("bomber");
  if (ace) out.push("ace");
  if (capital) out.push("capital");
  return out;
}
