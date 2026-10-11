/**
 * factionAssets — campaign-only hulls each faction fields for objective
 * entities: convoy transports and defended stations.
 */

import type { FactionId } from "../../config";

/** Convoy transport hull per faction (support/medium hulls). */
export const FACTION_TRANSPORT: Readonly<Record<FactionId, string>> = {
  terran_hegemony: "terran_sentinel",
  free_confederation: "confed_crane",
  synthetic_collective: "synth_relay_node",
  void_corsairs: "corsair_tender",
  ascendant_empire: "ascendant_acolyte",
};

/** Defended station hull per faction (large hulls). */
export const FACTION_STATION: Readonly<Record<FactionId, string>> = {
  terran_hegemony: "terran_bulwark",
  free_confederation: "confed_heron",
  synthetic_collective: "synth_carrier",
  void_corsairs: "corsair_frigate",
  ascendant_empire: "ascendant_bastion",
};
