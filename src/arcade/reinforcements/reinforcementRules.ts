/**
 * reinforcementRules — the numbers of the reinforcement-pool battle and the
 * default rules per format.
 *
 * Why these numbers (a "normal match lasts a couple of minutes"):
 * - Skirmish: each side owns a 1000-point pool and may have at most 250
 *   points of living ships at once. A Skirmish squad is 200 points, so the
 *   opening squad plus one or two reinforcements fill the field, and the pool
 *   pays for about four full fields — enough to keep fighting for ~3 minutes
 *   at the real-time attrition rate (measured with bot-vs-bot matches).
 * - Epic: its squads are 400 points and capital ships cost 100–170, so the
 *   field cap doubles (500). The pool does not: capital ships trade far
 *   slower than fighters — measured bot-vs-bot Epic matches lost only
 *   130–490 points per side in 3:00, so a doubled 2000 pool was never
 *   touched. 1200 (opening 400 + top-up to 500 + ~700 of replacements)
 *   lets a side that loses the exchange run dry near the 3:00 mark.
 * - Scenario: the Skirmish numbers, but the picker only offers the
 *   pre-planned reserve (tabletop lists are fixed before the game).
 * Quotas keep every field a mix: at most four bombers, two aces (unique
 * pilots; nine a match) and capital ships only in Epic. Round 4 loosened the
 * Skirmish ace quota (1 on field / 3 a match) so Aces is a real plan.
 *
 * Pure.
 */

import { CYCLE_DURATION_MS } from "../../config";
import type {
  QuotaRule,
  ReinforcementFormat,
  ReinforcementRules,
  ShipCategory,
} from "./reinforcementTypes";

/** Points a side may deploy over a Skirmish / Scenario match. */
export const DEFAULT_POOL_POINTS = 1000;

/** Points of living ships a side may field at once (Skirmish / Scenario). */
export const DEFAULT_FIELD_CAP_POINTS = 250;

/** Epic pool (see above: capital ships trade slowly, so not doubled). */
export const EPIC_POOL_POINTS = 1200;

/** Epic field cap: twice the Skirmish cap (fits a capital ship + escorts). */
export const EPIC_FIELD_CAP_POINTS = 2 * DEFAULT_FIELD_CAP_POINTS;

/** A reinforced match ends at 3:00; destroyed points decide it then. */
export const REINFORCED_TIME_LIMIT_MS = 180_000;

/** The player's picker deploys the next reserve ship after 5 s. */
export const PICKER_AUTO_ACCEPT_MS = 5000;

/**
 * A ship that warps in ignores hits for one maneuver cycle — the same span
 * as the X-Wing round's hit immunity (CombatTempo.HIT_IMMUNITY_MS).
 */
export const ARRIVAL_PROTECTION_MS = CYCLE_DURATION_MS;

/** AI sides deploy as soon as field points free up. */
export const AI_DEPLOY_DELAY_MS = 0;

/** No limit for a quota field. */
const UNLIMITED = Number.POSITIVE_INFINITY;

/** Skirmish / Scenario quotas (a table the balance sweeps tune). */
export const SKIRMISH_QUOTAS: readonly QuotaRule[] = [
  { category: "bomber", maxOnField: 4, maxPerMatch: UNLIMITED },
  { category: "ace", maxOnField: 2, maxPerMatch: 9 },
  { category: "capital", maxOnField: 0, maxPerMatch: 0 },
];

const EPIC_QUOTAS: readonly QuotaRule[] = [
  { category: "bomber", maxOnField: 3, maxPerMatch: UNLIMITED },
  { category: "ace", maxOnField: 2, maxPerMatch: 4 },
  { category: "capital", maxOnField: 1, maxPerMatch: 3 },
];

const BASE: Omit<ReinforcementRules, "format" | "quotas" | "choice"> = {
  poolPoints: DEFAULT_POOL_POINTS,
  fieldCapPoints: DEFAULT_FIELD_CAP_POINTS,
  timeLimitMs: REINFORCED_TIME_LIMIT_MS,
  pickerAutoAcceptMs: PICKER_AUTO_ACCEPT_MS,
  arrivalProtectionMs: ARRIVAL_PROTECTION_MS,
  aiDeployDelayMs: AI_DEPLOY_DELAY_MS,
};

const FORMAT_RULES: Readonly<Record<ReinforcementFormat, ReinforcementRules>> =
  {
    skirmish: {
      ...BASE,
      format: "skirmish",
      quotas: SKIRMISH_QUOTAS,
      choice: "open",
    },
    epic: {
      ...BASE,
      format: "epic",
      poolPoints: EPIC_POOL_POINTS,
      fieldCapPoints: EPIC_FIELD_CAP_POINTS,
      quotas: EPIC_QUOTAS,
      choice: "open",
    },
    scenario: {
      ...BASE,
      format: "scenario",
      quotas: SKIRMISH_QUOTAS,
      choice: "planned",
    },
  };

/** Match-rule overrides a battle config may carry. */
export interface RuleOverrides {
  readonly poolPoints?: number;
  readonly fieldCapPoints?: number;
}

/**
 * @param format - The battle's format.
 * @param overrides - Pool / cap overrides (ignored unless positive).
 * @returns The match rules.
 */
export function rulesFor(
  format: ReinforcementFormat,
  overrides: RuleOverrides = {},
): ReinforcementRules {
  const base = FORMAT_RULES[format];
  return {
    ...base,
    poolPoints: positiveOr(overrides.poolPoints, base.poolPoints),
    fieldCapPoints: positiveOr(overrides.fieldCapPoints, base.fieldCapPoints),
  };
}

/**
 * @param rules - Match rules.
 * @param category - A category.
 * @returns Its quota, or undefined when it has none.
 */
export function quotaFor(
  rules: Pick<ReinforcementRules, "quotas">,
  category: ShipCategory,
): QuotaRule | undefined {
  return rules.quotas.find((quota) => quota.category === category);
}

function positiveOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}
