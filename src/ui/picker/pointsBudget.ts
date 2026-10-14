/**
 * pointsBudget — plain-language points maths for the pick screens: how much
 * of the budget is spent, what is left, why a pick is refused and how the
 * reinforcement pool / on-field cap read. Pure: no Phaser.
 */

/** Spent points against a limit. */
export interface PointsBudget {
  readonly spent: number;
  readonly limit: number;
  /** Points left (negative when over). */
  readonly remaining: number;
  /** Filled share of the bar, 0..1 (clamped). */
  readonly fraction: number;
  readonly over: boolean;
}

/** Whether a pick fits, and if not, why. */
export type BudgetVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

/**
 * @param spent - Points spent (flown cost: hull + pilot + cards).
 * @param limit - Point limit.
 * @returns The budget.
 */
export function budgetOf(spent: number, limit: number): PointsBudget {
  const fraction = limit > 0 ? Math.min(1, Math.max(0, spent / limit)) : 0;
  return {
    spent,
    limit,
    remaining: limit - spent,
    fraction,
    over: spent > limit,
  };
}

/**
 * @param budget - A budget.
 * @returns "130 spent · 70 left of 200" (or how far over the limit it is).
 */
export function budgetCaption(budget: PointsBudget): string {
  if (budget.over) {
    return `${budget.spent} spent \u00b7 ${-budget.remaining} over the limit of ${budget.limit}`;
  }
  return `${budget.spent} spent \u00b7 ${budget.remaining} left of ${budget.limit}`;
}

/**
 * Whether adding a pick keeps the squad within the limit.
 *
 * @param spent - Points already spent.
 * @param cost - Flown cost of the pick.
 * @param limit - Point limit.
 * @param cheapest - Cost of the cheapest alternative, to suggest (optional).
 * @returns ok, or a plain-language reason.
 */
export function checkAddToBudget(
  spent: number,
  cost: number,
  limit: number,
  cheapest?: number,
): BudgetVerdict {
  if (spent + cost <= limit) return { ok: true };
  const left = Math.max(0, limit - spent);
  const hint =
    cheapest !== undefined && cheapest <= left
      ? ` The cheapest ship is ${cheapest} pts.`
      : cheapest !== undefined
        ? ` The cheapest ship is ${cheapest} pts, so raise the limit or remove a ship.`
        : "";
  return {
    ok: false,
    reason: `Over budget: this pick costs ${cost} pts and only ${left} pts left.${hint}`,
  };
}

/**
 * @param ownCost - Flown cost of the player's ship.
 * @param squadTotal - Cost of the whole squad (ship + wingmen).
 * @param limit - Point limit.
 * @returns The simple-flow line explaining where the rest of the budget goes.
 */
export function wingmenCaption(
  ownCost: number,
  squadTotal: number,
  limit: number,
): string {
  if (squadTotal <= ownCost) {
    return `Your ship ${ownCost} pts of ${limit} \u2014 no wingmen fit`;
  }
  return `Your ship ${ownCost} pts + AI wingmen ${squadTotal - ownCost} pts = ${squadTotal} of ${limit}`;
}

/**
 * @param pool - Reinforcement pool size.
 * @returns What the pool means.
 */
export function poolNote(pool: number): string {
  return `Pool ${pool}: every ship you deploy spends points; the battle ends when the pool is empty`;
}

/**
 * @param cap - On-field cap.
 * @returns What the on-field cap means.
 */
export function fieldCapNote(cap: number): string {
  return `On-field cap ${cap}: at most ${cap} flown points in play at once; the rest wait in reserve`;
}
