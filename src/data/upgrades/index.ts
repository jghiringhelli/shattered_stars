/**
 * The complete upgrade catalog, assembled from its category files.
 */

import type { UpgradeDefinition } from "../../core/upgradeTypes";
import { MODIFICATION_UPGRADES } from "./modifications";
import {
  ASTROMECH_UPGRADES,
  CREW_UPGRADES,
  SENSOR_AND_TECH_UPGRADES,
} from "./systems";
import { ILLICIT_UPGRADES, TALENT_UPGRADES } from "./talents";
import { CANNON_UPGRADES, ORDNANCE_UPGRADES, TURRET_UPGRADES } from "./weapons";

/** Every upgrade card, keyed by id. */
export const UPGRADE_CATALOG: Readonly<Record<string, UpgradeDefinition>> = {
  ...MODIFICATION_UPGRADES,
  ...SENSOR_AND_TECH_UPGRADES,
  ...CANNON_UPGRADES,
  ...CREW_UPGRADES,
  ...ASTROMECH_UPGRADES,
  ...TALENT_UPGRADES,
  ...ORDNANCE_UPGRADES,
  ...TURRET_UPGRADES,
  ...ILLICIT_UPGRADES,
};
