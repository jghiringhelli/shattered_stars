/**
 * reserveQueue — the player's ordered reserve and the picker built from it.
 *
 * The reserve is a repeating list with a cursor: "next" is the first ship
 * from the cursor on that can deploy now; deploying the cursor ship moves
 * the cursor on, picking any other ship does not (a one-off change of
 * plan). The picker lists the next ship first (the default the countdown
 * accepts), then the reserve's other ships, then — when the match's choice
 * is open — one ship per role from the faction's catalog. Ships that cannot
 * deploy are still listed, disabled, with the reason.
 *
 * Pure.
 */

import type { ShipRole } from "../../core/types";
import type { SideLedger } from "./poolLedger";
import { checkDeploy } from "./quotaRules";
import type {
  DeployCheck,
  DeployOption,
  QuotaRule,
  ReinforcementChoice,
} from "./reinforcementTypes";

/** Picker rows taken by reserve ships when the choice is open. */
export const RESERVE_PICKER_ROWS = 3;

/** Roles offered from the catalog, in picker order. */
const CATALOG_ROLES: readonly ShipRole[] = [
  "light_fighter",
  "interceptor",
  "heavy_fighter",
  "bomber",
  "gunship",
  "support",
  "capital",
];

/** The player's reserve. */
export interface PlayerReserve {
  readonly entries: readonly DeployOption[];
  readonly cursor: number;
}

/** One picker row. */
export interface PickerOption {
  readonly option: DeployOption;
  readonly check: DeployCheck;
  readonly source: "reserve" | "catalog";
  /** Index in the reserve (reserve rows), else null. */
  readonly reserveIndex: number | null;
  /** The row the countdown deploys. */
  readonly isDefault: boolean;
}

/** What the picker is built from. */
export interface PickerInput {
  readonly reserve: PlayerReserve;
  readonly catalog: readonly DeployOption[];
  readonly choice: ReinforcementChoice;
  readonly ledger: SideLedger;
  readonly quotas: readonly QuotaRule[];
  readonly maxOptions: number;
}

/**
 * @param entries - The planned ships in order.
 * @returns A reserve at its first ship.
 */
export function createPlayerReserve(
  entries: readonly DeployOption[],
): PlayerReserve {
  return { entries, cursor: 0 };
}

/**
 * @param reserve - The reserve.
 * @param ledger - The player's side.
 * @param quotas - The match's quotas.
 * @returns Index of the first ship from the cursor on that can deploy now, or null.
 */
export function nextReserveIndex(
  reserve: PlayerReserve,
  ledger: SideLedger,
  quotas: readonly QuotaRule[],
): number | null {
  const count = reserve.entries.length;
  for (let i = 0; i < count; i++) {
    const index = (reserve.cursor + i) % count;
    if (checkDeploy(ledger, quotas, reserve.entries[index]!).allowed)
      return index;
  }
  return null;
}

/**
 * @param reserve - The reserve.
 * @param index - The reserve ship deployed.
 * @returns The reserve after it (cursor moves on only from the cursor ship).
 */
export function takeReserve(
  reserve: PlayerReserve,
  index: number,
): PlayerReserve {
  if (index !== reserve.cursor || reserve.entries.length === 0) return reserve;
  return { ...reserve, cursor: (reserve.cursor + 1) % reserve.entries.length };
}

/**
 * @param input - Reserve, catalog, choice rule, the side's accounts, row limit.
 * @returns The picker rows, default first.
 */
export function pickerOptions(input: PickerInput): PickerOption[] {
  const check = (o: DeployOption): DeployCheck =>
    checkDeploy(input.ledger, input.quotas, o);
  const rows: PickerOption[] = [];
  const seen = new Set<string>();
  const push = (row: Omit<PickerOption, "check">): void => {
    if (rows.length >= input.maxOptions || seen.has(keyOf(row.option))) return;
    seen.add(keyOf(row.option));
    rows.push({ ...row, check: check(row.option) });
  };
  const { entries, cursor } = input.reserve;
  const first =
    nextReserveIndex(input.reserve, input.ledger, input.quotas) ?? cursor;
  if (entries[first])
    push({
      option: entries[first]!,
      source: "reserve",
      reserveIndex: first,
      isDefault: true,
    });
  const reserveRows =
    input.choice === "open" ? RESERVE_PICKER_ROWS : input.maxOptions;
  for (let i = 1; i < entries.length && rows.length < reserveRows; i++) {
    const index = (first + i) % entries.length;
    push({
      option: entries[index]!,
      source: "reserve",
      reserveIndex: index,
      isDefault: false,
    });
  }
  if (input.choice !== "open") return rows;
  for (const option of catalogPicks(input.catalog, check))
    push({ option, source: "catalog", reserveIndex: null, isDefault: false });
  return rows;
}

/** Per role: the cheapest ship that can deploy, else the cheapest one. */
function catalogPicks(
  catalog: readonly DeployOption[],
  check: (o: DeployOption) => DeployCheck,
): DeployOption[] {
  return CATALOG_ROLES.flatMap((role) => {
    const ofRole = catalog
      .filter((o) => o.role === role)
      .sort((a, b) => a.cost - b.cost);
    const pick = ofRole.find((o) => check(o).allowed) ?? ofRole[0];
    return pick ? [pick] : [];
  });
}

function keyOf(option: DeployOption): string {
  return `${option.definitionId}/${option.loadoutId ?? ""}`;
}
