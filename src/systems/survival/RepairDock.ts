/**
 * Survival roguelite — repair dock (pure). One choice per dock: repair the
 * whole fleet's hull, OR upgrade one ship (flagship or an escort). That
 * trade-off only matters because hull damage persists between nodes.
 */

import {
  DOCK_REPAIR_FRACTION,
  MAX_SHIP_UPGRADES,
} from "../../data/survival/economy";
import { getShipDefinition } from "../../data/ShipDefinitions";
import { adjustFleetHull, fleetOf, upgradeShip, withLog } from "./RunState";
import { repairFraction } from "./RunEconomy";
import type { RunState } from "./RunTypes";

/** One repair-dock option. */
export interface DockOption {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly enabled: boolean;
}

/**
 * @param run - The run.
 * @returns The dock's options: repair, then an upgrade per ship.
 */
export function dockOptions(run: RunState): DockOption[] {
  const repair = Math.round(repairFraction(run, DOCK_REPAIR_FRACTION) * 100);
  const options: DockOption[] = [
    {
      id: "repair",
      name: "Repair Fleet",
      icon: "✚",
      description: `Restore ${repair}% hull on every ship`,
      enabled: true,
    },
  ];
  fleetOf(run).forEach((ship, index) => {
    const name =
      getShipDefinition(ship.definitionId)?.name ?? ship.definitionId;
    const role = index === 0 ? "Flagship" : `Escort ${index}`;
    options.push({
      id: `upgrade-${index}`,
      name: `Upgrade ${role}`,
      icon: "⬆",
      description: `${name} Lv ${ship.upgrades} → ${ship.upgrades + 1}: +1 damage, +hull`,
      enabled: ship.upgrades < MAX_SHIP_UPGRADES,
    });
  });
  return options;
}

/**
 * @param run - The run.
 * @param optionId - A dock option id.
 * @returns The run after using the dock (unchanged for an unknown/disabled id).
 */
export function useDock(run: RunState, optionId: string): RunState {
  const option = dockOptions(run).find((o) => o.id === optionId);
  if (!option || !option.enabled) return run;
  if (option.id === "repair") {
    const fraction = repairFraction(run, DOCK_REPAIR_FRACTION);
    return withLog(
      adjustFleetHull(run, fraction),
      "Repair dock: hull restored",
    );
  }
  const index = Number(option.id.split("-")[1]);
  return withLog(upgradeShip(run, index), `Repair dock: ${option.name}`);
}
