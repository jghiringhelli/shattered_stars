/**
 * Player Progression Data — pure unlock rules (no I/O).
 *
 * Defines which factions and ship roles are available at a given amount of global XP.
 * Consumed by PlayerProfile (state) and the ship-picker UI (gating). See
 * docs/specs/progression.md (gates PRG-1…PRG-8) and docs/adr/ADR-0002.
 */

import type { FactionId } from "../config";
import type { ShipDefinition, ShipRole } from "../core/types";

/** Minimal projection of a player profile that the pure unlock rules need. */
export interface ProgressionState {
  readonly totalXp: number;
  readonly unlockAll: boolean;
  readonly unlockedFactionIds: readonly FactionId[];
  readonly unlockedShipIds: readonly string[];
}

/** One rung of a faction's role-unlock ladder. Roles are cumulative up the ladder. */
export interface RoleTier {
  readonly minXp: number;
  readonly roles: readonly ShipRole[];
  readonly label: string;
}

/** Factions playable from the very first battle (XP 0). */
export const STARTING_FACTIONS: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "void_corsairs",
];

/** Global XP at which each non-starting faction becomes available. */
export const FACTION_UNLOCK_XP: Partial<Record<FactionId, number>> = {
  synthetic_collective: 2000,
  ascendant_empire: 4000,
};

/** XP granted by battle outcomes, shared across all game modes. */
export const XP_REWARDS = {
  perKill: 10,
  win: 100,
  loss: 20,
  missionComplete: 150,
} as const;

// Base role ladder (the "workhorse → ace → turret → ordnance → support → capital" rhythm).
const BASE_LADDER: readonly RoleTier[] = [
  {
    minXp: 0,
    roles: ["heavy_fighter", "light_fighter"],
    label: "Workhorse & escort",
  },
  { minXp: 300, roles: ["interceptor"], label: "Ace interceptor" },
  { minXp: 900, roles: ["gunship"], label: "Gunship / turret platform" },
  { minXp: 2000, roles: ["bomber"], label: "Ordnance loadout" },
  { minXp: 3500, roles: ["support"], label: "Support & command" },
  { minXp: 6000, roles: ["capital"], label: "Capital ships" },
];

// Raiders lead with aces; the swarm faction leads with cheap fighters; support faction
// brings command online early. Each ladder keeps a flyable tier-0 (PRG-4).
const RAIDER_LADDER: readonly RoleTier[] = [
  { minXp: 0, roles: ["interceptor", "light_fighter"], label: "Raider aces" },
  { minXp: 400, roles: ["heavy_fighter"], label: "Heavy raiders" },
  { minXp: 1000, roles: ["bomber"], label: "Strike ordnance" },
  { minXp: 2200, roles: ["gunship"], label: "Gunship / turret platform" },
  { minXp: 3800, roles: ["support"], label: "Support & command" },
  { minXp: 6000, roles: ["capital"], label: "Capital ships" },
];

const SWARM_LADDER: readonly RoleTier[] = [
  { minXp: 0, roles: ["light_fighter", "interceptor"], label: "Drone swarm" },
  { minXp: 500, roles: ["heavy_fighter"], label: "Heavy drones" },
  { minXp: 1200, roles: ["gunship"], label: "Gunship / turret platform" },
  { minXp: 2400, roles: ["bomber"], label: "Ordnance drones" },
  { minXp: 4000, roles: ["support"], label: "Coordination nexus" },
  { minXp: 6500, roles: ["capital"], label: "Gestalt capital" },
];

const SUPPORT_LADDER: readonly RoleTier[] = [
  {
    minXp: 0,
    roles: ["heavy_fighter", "support"],
    label: "Guardian & support",
  },
  { minXp: 400, roles: ["light_fighter"], label: "Escort" },
  { minXp: 1100, roles: ["interceptor"], label: "Ace interceptor" },
  { minXp: 2200, roles: ["gunship"], label: "Gunship / turret platform" },
  { minXp: 3600, roles: ["bomber"], label: "Ordnance loadout" },
  { minXp: 5500, roles: ["capital"], label: "Ascendant capital" },
];

/** Per-faction role-unlock ladder. */
export const FACTION_ROLE_TIERS: Record<FactionId, readonly RoleTier[]> = {
  terran_hegemony: BASE_LADDER,
  free_confederation: BASE_LADDER,
  void_corsairs: RAIDER_LADDER,
  synthetic_collective: SWARM_LADDER,
  ascendant_empire: SUPPORT_LADDER,
};

/** True when the faction is playable for this progression state (PRG-1, PRG-2, PRG-5). */
export function isFactionUnlocked(
  faction: FactionId,
  state: ProgressionState,
): boolean {
  if (state.unlockAll) return true;
  if (STARTING_FACTIONS.includes(faction)) return true;
  if (state.unlockedFactionIds.includes(faction)) return true;
  const threshold = FACTION_UNLOCK_XP[faction];
  return threshold !== undefined && state.totalXp >= threshold;
}

/** Cumulative set of roles unlocked for a faction at the given XP (PRG-3). */
export function unlockedRolesForFaction(
  faction: FactionId,
  totalXp: number,
): Set<ShipRole> {
  const roles = new Set<ShipRole>();
  for (const tier of FACTION_ROLE_TIERS[faction]) {
    if (totalXp >= tier.minXp) for (const r of tier.roles) roles.add(r);
  }
  return roles;
}

/** True when a specific ship is available to this progression state (PRG-3, PRG-5). */
export function isShipUnlocked(
  def: ShipDefinition,
  state: ProgressionState,
): boolean {
  if (state.unlockAll) return true;
  if (state.unlockedShipIds.includes(def.id)) return true;
  if (!isFactionUnlocked(def.faction, state)) return false;
  return unlockedRolesForFaction(def.faction, state.totalXp).has(def.role);
}

/** The next role tier a faction will unlock above the current XP, or null if maxed. */
export function nextRoleTier(
  faction: FactionId,
  totalXp: number,
): RoleTier | null {
  for (const tier of FACTION_ROLE_TIERS[faction]) {
    if (totalXp < tier.minXp) return tier;
  }
  return null;
}

/** Human-readable reason a ship is locked, for the picker (PRG-7). Empty if unlocked. */
export function lockReason(
  def: ShipDefinition,
  state: ProgressionState,
): string {
  if (isShipUnlocked(def, state)) return "";
  if (!isFactionUnlocked(def.faction, state)) {
    const xp = FACTION_UNLOCK_XP[def.faction];
    return xp !== undefined
      ? `Unlock ${def.faction} at ${xp} XP`
      : `Faction locked`;
  }
  const tier = FACTION_ROLE_TIERS[def.faction].find((t) =>
    t.roles.includes(def.role),
  );
  return tier ? `Reach ${tier.minXp} XP (${tier.label})` : "Locked";
}
