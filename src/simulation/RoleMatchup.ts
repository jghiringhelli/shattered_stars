/**
 * RoleMatchup — validates whether ship ROLES (not factions) form a healthy
 * rock-paper-scissors counter system at equal point cost, per the design
 * intent that a support ship should almost always lose to an ace/dogfighter
 * in equal conditions, while other roles (workhorse, outfighter/turret,
 * bomber/specialist) carve out their own niches.
 *
 * Fills the gap left by BalanceAnalyzer.ts's RoleStats.vsOtherRoles, which
 * was declared but never populated ("Would need simulation to fill").
 */

import type { ShipRole } from "../core/types";
import { getShipDefinition } from "../data/ShipDefinitions";
import { runDuel, type DuelOutcome, type DuelRunOptions } from "./DuelBalance";

/** One representative ship per role (all terran_hegemony, for a controlled comparison). */
export const ROLE_REPRESENTATIVES: Record<ShipRole, string> = {
  light_fighter: "terran_stiletto",
  interceptor: "terran_viper",
  heavy_fighter: "terran_gladius",
  bomber: "terran_hammer",
  gunship: "terran_bastion",
  support: "terran_sentinel",
  capital: "terran_imperator",
};

export const ALL_ROLES: readonly ShipRole[] = Object.keys(
  ROLE_REPRESENTATIVES,
) as ShipRole[];

/** Builds a same-ship squad that spends as much of `budget` as possible (min 1 ship). */
export function buildEqualPointSquad(
  shipId: string,
  budget: number,
): readonly string[] {
  const cost = getShipDefinition(shipId)?.baseStats.pointCost ?? Infinity;
  const count = Math.max(1, Math.floor(budget / cost));
  return Array.from({ length: count }, () => shipId);
}

export interface RoleMatchupResult {
  readonly roleA: ShipRole;
  readonly roleB: ShipRole;
  readonly squadASize: number;
  readonly squadBSize: number;
  readonly outcome: DuelOutcome;
}

export type RoleDuelOptions = Omit<DuelRunOptions, "battles" | "seed">;

/** Runs every unordered role pair as an equal-point squad duel. */
export function runRoleMatchupMatrix(
  roles: readonly ShipRole[],
  budget: number,
  battlesPerPair: number,
  seed: number,
  duelOptions: RoleDuelOptions,
): RoleMatchupResult[] {
  const results: RoleMatchupResult[] = [];
  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      const roleA = roles[i]!;
      const roleB = roles[j]!;
      const squadA = buildEqualPointSquad(ROLE_REPRESENTATIVES[roleA], budget);
      const squadB = buildEqualPointSquad(ROLE_REPRESENTATIVES[roleB], budget);
      const outcome = runDuel(squadA, squadB, {
        ...duelOptions,
        battles: battlesPerPair,
        seed: seed + i * 1000 + j,
      });
      results.push({
        roleA,
        roleB,
        squadASize: squadA.length,
        squadBSize: squadB.length,
        outcome,
      });
    }
  }
  return results;
}

/** Role A's win share for one matchup result, from role A's point of view. */
export function roleAWinShare(r: RoleMatchupResult): number {
  return r.outcome.side1DecisiveShare;
}

export interface RoleSummary {
  readonly role: ShipRole;
  readonly avgWinShare: number;
  readonly beats: readonly ShipRole[];
  readonly losesTo: readonly ShipRole[];
}

const DOMINANCE_THRESHOLD = 0.6;

/** Per-role average win share plus which specific roles it clearly beats/loses to. */
export function summarizeByRole(
  results: readonly RoleMatchupResult[],
): RoleSummary[] {
  return ALL_ROLES.map((role) => {
    const shares: number[] = [];
    const beats: ShipRole[] = [];
    const losesTo: ShipRole[] = [];
    for (const r of results) {
      const isA = r.roleA === role;
      const isB = r.roleB === role;
      if (!isA && !isB) continue;
      const share = isA ? roleAWinShare(r) : 1 - roleAWinShare(r);
      shares.push(share);
      const opponent = isA ? r.roleB : r.roleA;
      if (share >= DOMINANCE_THRESHOLD) beats.push(opponent);
      else if (share <= 1 - DOMINANCE_THRESHOLD) losesTo.push(opponent);
    }
    const avgWinShare = shares.length
      ? shares.reduce((a, b) => a + b, 0) / shares.length
      : 0.5;
    return { role, avgWinShare, beats, losesTo };
  });
}

/** A role that clearly beats every other role — a dominance red flag, not a healthy counter system. */
export function findDominantRole(
  summaries: readonly RoleSummary[],
): ShipRole | null {
  const dominant = summaries.find(
    (s) => s.beats.length === ALL_ROLES.length - 1,
  );
  return dominant?.role ?? null;
}

/** A role that clearly loses to every other role — an underpowered red flag. */
export function findUnderpoweredRole(
  summaries: readonly RoleSummary[],
): ShipRole | null {
  const weak = summaries.find((s) => s.losesTo.length === ALL_ROLES.length - 1);
  return weak?.role ?? null;
}
