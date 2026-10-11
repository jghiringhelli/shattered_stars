/**
 * Survival roguelite — the map side panel's text (pure): run status, fleet
 * hull and the build (relics with synergy tags, mutations, set bonuses).
 */

import { getShipDefinition } from "../../data/ShipDefinitions";
import {
  activeArchetypeSets,
  relicsOf,
} from "../../data/survival/relicCatalog";
import { getMutation } from "../../data/survival/mutations";
import { activeAscensionModifiers } from "../../data/survival/ascension";
import { sectorName, SECTOR_COUNT } from "../../data/survival/sectors";
import { fleetOf } from "../../systems/survival/RunState";
import { seedToCode } from "../../systems/survival/RunRng";
import type { RunState } from "../../systems/survival/RunTypes";
import { SALVAGE_GLYPH } from "./choiceViewModels";

/**
 * @param run - The run.
 * @returns Header lines: sector, seed, ascension, salvage, rerolls.
 */
export function statusLines(run: RunState): string[] {
  const ascension = activeAscensionModifiers(run.ascension)
    .map((m) => m.name)
    .join(", ");
  return [
    `SECTOR ${run.sector}/${SECTOR_COUNT} — ${sectorName(run.sector).toUpperCase()}`,
    `Seed ${seedToCode(run.seed)}   Ascension ${run.ascension}`,
    ...(ascension ? [`  ${ascension}`] : []),
    `Salvage ${run.salvage} ${SALVAGE_GLYPH}   Rerolls ${run.rerolls}`,
  ];
}

/**
 * @param run - The run.
 * @returns One line per ship: role, name, upgrade level and hull %.
 */
export function fleetLines(run: RunState): string[] {
  return fleetOf(run).map((ship, i) => {
    const name =
      getShipDefinition(ship.definitionId)?.name ?? ship.definitionId;
    const level = ship.upgrades > 0 ? ` Lv${ship.upgrades}` : "";
    return `${i === 0 ? "★" : "·"} ${name}${level}  hull ${Math.round(ship.hull * 100)}%`;
  });
}

/**
 * @param run - The run.
 * @returns Relic lines (icon, name, tags), mutations and active set bonuses.
 */
export function buildLines(run: RunState): string[] {
  const relics = relicsOf(run.relics).map(
    (r) => `${r.icon} ${r.name} [${r.tags.join(", ")}]`,
  );
  const mutations = Object.values(run.mutations).flatMap((id) => {
    const m = id ? getMutation(id) : undefined;
    return m ? [`${m.icon} ${m.name} (mutation)`] : [];
  });
  const sets = activeArchetypeSets(run.relics).map(
    (s) => `✦ ${s.name} — ${s.description}`,
  );
  const lines = [...relics, ...mutations, ...sets];
  return lines.length > 0
    ? lines
    : ["No relics yet — elites and bosses drop them"];
}
