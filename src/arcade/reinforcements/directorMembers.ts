/**
 * directorMembers — the per-squad state inside a team side of a reinforced
 * match: its faction, its sub-reserve (a human squad's planned reserve, an
 * AI squad's strategy rotation), a human squad's catalog, replacement
 * picker countdown and the ship its human flies. The team's pool and cap
 * live on the side (directorSides).
 *
 * Pure.
 */

import type { SideLedger } from "./poolLedger";
import {
  PICKER_MAX_OPTIONS,
  type DirectorMemberSetup,
  type PickerView,
} from "./directorTypes";
import {
  pickerOptions,
  type PickerOption,
  type PlayerReserve,
} from "./reserveQueue";
import type { PlannerState } from "./strategyPlanner";
import type {
  DeployOption,
  ReinforcementRules,
  StrategyId,
} from "./reinforcementTypes";

/** One squad's runtime state. */
export interface MemberState {
  readonly key: string;
  readonly faction: string;
  readonly human: boolean;
  readonly strategy: StrategyId;
  /** AI squads: the strategy plan. */
  readonly planner: PlannerState;
  /** Human squads: the reserve. */
  readonly reserve: PlayerReserve;
  /** Human squads: extra ships the picker offers (open choice). */
  readonly catalog: readonly DeployOption[];
  /** Picker countdown left (ms), or null while it is closed. */
  readonly pickerMs: number | null;
  /** The ship its human flies now (null between ships, always for AI). */
  readonly pilotId: string | null;
}

/**
 * @param setup - The squad's setup.
 * @returns A fresh squad.
 */
export function createMemberState(setup: DirectorMemberSetup): MemberState {
  return {
    key: setup.key,
    faction: setup.faction,
    human: setup.human,
    strategy: setup.strategy,
    planner: { rotation: setup.plan, cursor: 0 },
    reserve: { entries: setup.plan, cursor: 0 },
    catalog: setup.human ? setup.catalog : [],
    pickerMs: null,
    pilotId: null,
  };
}

/**
 * @param member - A squad.
 * @param rules - Match rules.
 * @returns Every ship it could ever deploy (exhaustion check).
 */
export function memberOptions(
  member: MemberState,
  rules: ReinforcementRules,
): DeployOption[] {
  if (!member.human) return [...member.planner.rotation];
  return [
    ...member.reserve.entries,
    ...(rules.choice === "open" ? member.catalog : []),
  ];
}

/**
 * @param member - A human squad.
 * @param ledger - Its team's ledger.
 * @param rules - Match rules.
 * @returns Its picker rows.
 */
export function pickerRowsOf(
  member: MemberState,
  ledger: SideLedger,
  rules: ReinforcementRules,
): PickerOption[] {
  return pickerOptions({
    reserve: member.reserve,
    catalog: member.catalog,
    choice: rules.choice,
    ledger,
    quotas: rules.quotas,
    maxOptions: PICKER_MAX_OPTIONS,
  });
}

/**
 * @param member - A squad.
 * @param ledger - Its team's ledger.
 * @param rules - Match rules.
 * @returns Its open picker, or null while closed.
 */
export function pickerViewOf(
  member: MemberState,
  ledger: SideLedger,
  rules: ReinforcementRules,
): PickerView | null {
  if (member.pickerMs === null) return null;
  const options = pickerRowsOf(member, ledger, rules);
  return {
    options,
    remainingMs: member.pickerMs,
    counting: options[0]?.check.allowed ?? false,
  };
}

/**
 * One tick of a human squad's picker countdown (held while its default row
 * cannot deploy).
 *
 * @param member - A squad.
 * @param ledger - Its team's ledger.
 * @param rules - Match rules.
 * @param deltaMs - Tick length.
 * @returns The squad with its countdown advanced, and the default row once it is due.
 */
export function countDownPicker(
  member: MemberState,
  ledger: SideLedger,
  rules: ReinforcementRules,
  deltaMs: number,
): { readonly member: MemberState; readonly due: PickerOption | null } {
  if (member.pickerMs === null) return { member, due: null };
  const row = pickerRowsOf(member, ledger, rules)[0];
  if (!row?.check.allowed) return { member, due: null };
  const pickerMs = Math.max(0, member.pickerMs - deltaMs);
  return pickerMs > 0
    ? { member: { ...member, pickerMs }, due: null }
    : { member, due: row };
}

/**
 * @param member - A human squad.
 * @param count - How many.
 * @returns The next reserve ships from the cursor on (repeating).
 */
export function reservePreviewOf(
  member: MemberState,
  count: number,
): DeployOption[] {
  const { entries, cursor } = member.reserve;
  if (entries.length === 0) return [];
  return Array.from(
    { length: count },
    (_, i) => entries[(cursor + i) % entries.length]!,
  );
}
