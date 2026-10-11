/**
 * quotaRules — may a side deploy this ship now? Checks, in order: the
 * remaining pool, a unique pilot already flying, the category's per-match
 * quota, its on-field quota, and the field cap. Also: whether a ship could
 * ever deploy again (pool / match quota / cost over the cap are permanent),
 * and whether a side is exhausted (nothing alive, nothing it can deploy).
 *
 * Pure.
 */

import {
  categoryCount,
  fieldPoints,
  remainingPoints,
  type SideLedger,
} from "./poolLedger";
import type {
  DeployBlock,
  DeployCheck,
  DeployOption,
  QuotaRule,
  ShipCategory,
} from "./reinforcementTypes";

const ALLOWED: DeployCheck = { allowed: true, block: null, reason: "" };

/** Plural display name of each category (picker reasons). */
const CATEGORY_PLURAL: Readonly<Record<ShipCategory, string>> = {
  bomber: "BOMBERS",
  ace: "ACES",
  capital: "CAPITALS",
};

/**
 * @param ledger - The side.
 * @param quotas - The match's quotas.
 * @param option - The ship to deploy.
 * @returns Whether it may deploy now, and why not.
 */
export function checkDeploy(
  ledger: SideLedger,
  quotas: readonly QuotaRule[],
  option: DeployOption,
): DeployCheck {
  const left = remainingPoints(ledger);
  if (option.cost > left) return refuse("pool", `POOL ${left} LEFT`);
  if (option.uniquePilotId !== null && pilotFlying(ledger, option))
    return refuse("unique", "PILOT ALREADY FLYING");
  for (const quota of quotas) {
    if (!option.categories.includes(quota.category)) continue;
    const name = CATEGORY_PLURAL[quota.category];
    if (quota.maxOnField <= 0 || quota.maxPerMatch <= 0)
      return refuse("quota_match", `${name} NOT ALLOWED`);
    if (categoryCount(ledger, quota.category, "match") >= quota.maxPerMatch)
      return refuse("quota_match", `MAX ${quota.maxPerMatch} ${name} / MATCH`);
    if (categoryCount(ledger, quota.category, "field") >= quota.maxOnField)
      return refuse("quota_field", `MAX ${quota.maxOnField} ${name} ON FIELD`);
  }
  const onField = fieldPoints(ledger);
  if (onField + option.cost > ledger.fieldCapPoints)
    return refuse(
      "cap",
      `CAP ${onField}+${option.cost} > ${ledger.fieldCapPoints}`,
    );
  return ALLOWED;
}

/**
 * @param ledger - The side.
 * @param quotas - The match's quotas.
 * @param option - A ship.
 * @returns Whether it can still deploy at some point this match (only
 *   temporary blocks — cap, field quota, a flying unique pilot — stand).
 */
export function canEverDeploy(
  ledger: SideLedger,
  quotas: readonly QuotaRule[],
  option: DeployOption,
): boolean {
  if (option.cost > ledger.fieldCapPoints) return false;
  return !isPermanentBlock(checkDeploy(ledger, quotas, option).block);
}

/**
 * @param ledger - The side.
 * @param quotas - The match's quotas.
 * @param options - Everything the side could deploy.
 * @returns True when no ship is alive and none of the options can deploy.
 */
export function isSideExhausted(
  ledger: SideLedger,
  quotas: readonly QuotaRule[],
  options: readonly DeployOption[],
): boolean {
  if (ledger.field.size > 0) return false;
  return !options.some((option) => checkDeploy(ledger, quotas, option).allowed);
}

/**
 * @param block - A refusal.
 * @returns Whether it lasts for the rest of the match.
 */
export function isPermanentBlock(block: DeployBlock | null): boolean {
  return block === "pool" || block === "quota_match";
}

function refuse(block: DeployBlock, reason: string): DeployCheck {
  return { allowed: false, block, reason };
}

function pilotFlying(ledger: SideLedger, option: DeployOption): boolean {
  for (const entry of ledger.field.values())
    if (entry.uniquePilotId === option.uniquePilotId) return true;
  return false;
}
