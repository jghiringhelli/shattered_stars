/**
 * Roster quick builds — Void Corsairs: one build for every Corsair pilot
 * the original catalogue left grounded, flying the black-market (illicit)
 * gear the raider hulls carry.
 */

import type { BlueprintsByShip } from "./loadoutTypes";

export const CORSAIR_ROSTER: BlueprintsByShip = {
  corsair_blade: [
    {
      id: "blade_overcharged",
      name: "Blade Overcharged",
      shipId: "corsair_blade",
      pilotId: "blade_raider",
      upgrades: ["overcharged_capacitors", "hull_upgrade"],
      description: "Overcharged guns on a stressed-out raider",
      role: "offense",
    },
    {
      id: "blade_venom_sting",
      name: "Blade Venom Sting",
      shipId: "corsair_blade",
      pilotId: "venom_sting",
      upgrades: [
        "predator",
        "daredevil",
        "concussion_missile",
        "hot_wired_engines",
      ],
      description: "Venom Sting ambushes from behind and boosts away",
      role: "offense",
    },
  ],
  corsair_fang: [
    {
      id: "fang_hot_wired",
      name: "Fang Hot-Wired",
      shipId: "corsair_fang",
      pilotId: "fang_raider",
      upgrades: ["hot_wired_engines"],
      description: "Cheap raider with hot-wired boosters",
      role: "swarm",
    },
  ],
  corsair_venom: [
    {
      id: "venom_jury_rigged",
      name: "Venom Jury-Rigged",
      shipId: "corsair_venom",
      pilotId: "venom_pilot",
      upgrades: ["jury_rigged_deflectors"],
      description: "Scrap-built deflectors on a cheap skirmisher",
      role: "swarm",
    },
  ],
  corsair_cutlass: [
    {
      id: "cutlass_smuggler",
      name: "Cutlass Smuggler",
      shipId: "corsair_cutlass",
      pilotId: "cutlass_pilot",
      upgrades: ["black_market_munitions", "seeker_missile"],
      description: "Extra black-market missiles, volatile cargo",
      role: "offense",
    },
  ],
  corsair_tender: [
    {
      id: "tender_supply_master",
      name: "Tender Supply Master",
      shipId: "corsair_tender",
      pilotId: "supply_master_patch",
      upgrades: ["mechanic", "jury_rigged_deflectors", "shield_upgrade"],
      description: "Patch keeps the raid fleet flying on scrap",
      role: "support",
    },
  ],
};
