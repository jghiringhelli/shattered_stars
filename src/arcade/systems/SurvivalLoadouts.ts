/**
 * SurvivalLoadouts — who flies which quick build in Survival: each wave's
 * roster (regulars, elites, the boss of a boss wave) with loadouts that never
 * repeat a unique ace within the wave, and loadouts for ships joining the
 * player's squad that respect the aces already flying in it.
 *
 * Pure: no Phaser.
 */

import { assignQuickBuilds } from "./QuickBuildEquip";
import { selectionFor } from "./QuickBuildChoice";

/** How hard a wave ship hits: plain, elite (+hull, +attack) or boss. */
export type WaveTier = "regular" | "elite" | "boss";

/** Roles an elite is drawn from by default, in preference order. */
const DEFAULT_ELITE_ROLES: readonly string[] = ["gunship", "bomber"];

/** Role a boss is drawn from. */
const BOSS_ROLE = "gunship";

/** A faction ship a wave may field. */
export interface RosterShip {
  readonly id: string;
  readonly role: string;
}

/** How many ships of each tier a wave fields. */
export interface WaveComposition {
  readonly enemyCount: number;
  readonly eliteCount: number;
  readonly isMilestone: boolean;
  /**
   * Roles elites are drawn from, most preferred first (default: the
   * roster's first gunship or bomber, whichever it lists first).
   */
  readonly eliteRoles?: readonly string[];
}

/** One ship of a wave, with its quick build. */
export interface WaveSlot {
  readonly definitionId: string;
  readonly tier: WaveTier;
  readonly loadoutId: string | null;
}

/** A ship already in the player's squad. */
export interface SquadMember {
  readonly definitionId: string;
  readonly loadoutId: string | null;
}

/**
 * A wave's ships, in spawn order (regulars, elites, boss), each with its
 * quick build. Regulars cycle through the roster; elites are its first ship
 * of the preferred elite roles (else its first ship); a boss wave's boss is
 * its first gunship (else its last ship).
 *
 * @param roster - The enemy faction's ships.
 * @param composition - Ship counts, elite roles and whether a boss joins.
 * @returns The wave's ships (empty for an empty roster).
 */
export function planWaveRoster(
  roster: readonly RosterShip[],
  composition: WaveComposition,
): WaveSlot[] {
  if (roster.length === 0) return [];
  const elite = eliteShip(roster, composition.eliteRoles);
  const boss =
    roster.find((ship) => ship.role === BOSS_ROLE) ??
    roster[roster.length - 1]!;
  const ships: { definitionId: string; tier: WaveTier }[] = [
    ...Array.from({ length: composition.enemyCount }, (_, index) => ({
      definitionId: roster[index % roster.length]!.id,
      tier: "regular" as const,
    })),
    ...Array.from({ length: composition.eliteCount }, () => ({
      definitionId: elite.id,
      tier: "elite" as const,
    })),
    ...(composition.isMilestone
      ? [{ definitionId: boss.id, tier: "boss" as const }]
      : []),
  ];
  const loadouts = assignQuickBuilds(ships.map((ship) => ship.definitionId));
  return ships.map((ship, index) => ({
    ...ship,
    loadoutId: loadouts[index] ?? null,
  }));
}

/**
 * @param roster - The enemy faction's ships (not empty).
 * @param roles - Preferred elite roles, most preferred first; omitted = the
 *   roster's first gunship or bomber.
 * @returns The ship its elites fly.
 */
function eliteShip(
  roster: readonly RosterShip[],
  roles: readonly string[] | undefined,
): RosterShip {
  const byRole = roles
    ? roles
        .map((role) => roster.find((ship) => ship.role === role))
        .find((ship) => ship !== undefined)
    : roster.find((ship) => DEFAULT_ELITE_ROLES.includes(ship.role));
  return byRole ?? roster[0]!;
}

/**
 * Quick builds for ships joining the player's squad: the squad's loadouts
 * stay as flown, so a unique ace already in it is never handed out again.
 *
 * @param squad - Ships already in the squad (lost ones included).
 * @param joiningIds - Definition ids of the ships joining, in order.
 * @returns One loadout per joining ship, or null when it flies bare.
 */
export function joiningSquadLoadouts(
  squad: readonly SquadMember[],
  joiningIds: readonly string[],
): (string | null)[] {
  const loadouts = assignQuickBuilds(
    [...squad.map((member) => member.definitionId), ...joiningIds],
    squad.map((member) => member.loadoutId),
  );
  return loadouts.slice(squad.length);
}

/**
 * The flagship's quick build: the one picked on the setup screen when the
 * ship offers it, otherwise the default a new squad would get.
 *
 * @param definitionId - The flagship's ship id.
 * @param picked - The setup screen's pick, if any.
 * @returns The loadout id, or null when the ship flies bare.
 */
export function flagshipLoadout(
  definitionId: string,
  picked: string | null,
): string | null {
  const previous = { shipIds: [definitionId], loadoutIds: [picked] };
  return selectionFor([definitionId], previous).loadoutIds[0] ?? null;
}
