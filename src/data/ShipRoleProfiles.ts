/**
 * ShipRoleProfiles — one-line pros/cons per ship role, shared by any screen
 * that helps a new player pick a ship (Survival setup, squad builder,
 * encyclopedia). Kept role-based rather than per-ship so it stays accurate
 * without needing hand-written copy for every one of the ~100 ships.
 */

import type { ShipRole } from "../core/types";

export interface RoleProsCons {
  readonly pros: string;
  readonly cons: string;
}

export const ROLE_PROS_CONS: Record<ShipRole, RoleProsCons> = {
  interceptor: {
    pros: "Very agile, hard to hit",
    cons: "Fragile — low hull and shields",
  },
  light_fighter: {
    pros: "Balanced, easy to fly",
    cons: "No standout strength",
  },
  heavy_fighter: {
    pros: "Tough all-around combatant",
    cons: "Less nimble than a light fighter",
  },
  bomber: {
    pros: "Devastating ordnance damage",
    cons: "Slow and clumsy in a dogfight",
  },
  gunship: {
    pros: "Heavy sustained firepower",
    cons: "Poor maneuverability",
  },
  support: {
    pros: "Buffs and coordinates allies",
    cons: "Weak alone in direct combat",
  },
  capital: {
    pros: "Massive hull, shields, and firepower",
    cons: "Very slow, huge target",
  },
};

/** Returns the pros/cons line for a ship role, defaulting to a generic line for unknown roles. */
export function getRoleProsCons(role: ShipRole): RoleProsCons {
  return ROLE_PROS_CONS[role] ?? { pros: "Well-rounded", cons: "No specialty" };
}

/** One-line "how to play it" hint per loadout role — see ShipLoadouts.ts. */
export type LoadoutRole =
  "offense" | "defense" | "support" | "balanced" | "swarm";

const LOADOUT_PLAYSTYLE: Record<LoadoutRole, string> = {
  offense: "Best for: aggressive players who want to strike hard and fast",
  defense: "Best for: players who want to out-last their opponent",
  support: "Best for: players who like buffing and coordinating allies",
  balanced: "Best for: players who want a bit of everything",
  swarm: "Best for: players who overwhelm with numbers, not brawn",
};

/** Returns the playstyle hint for a loadout role. */
export function getLoadoutPlaystyle(role: LoadoutRole): string {
  return LOADOUT_PLAYSTYLE[role] ?? "Best for: any playstyle";
}
