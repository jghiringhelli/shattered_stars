/**
 * directorSides — the per-team state a reinforced match keeps (one pool
 * ledger and field cap for the team, its member squads, arrival counter,
 * when its AI squads may next deploy) and the read-only summaries the HUD,
 * end screen and telemetry show. Coalitions: the player's team vs every
 * other team.
 *
 * Pure.
 */

import type { ShipRole } from "../../core/types";
import {
  createSideLedger,
  fieldPoints,
  remainingPoints,
  retireShip,
  type SideLedger,
} from "./poolLedger";
import type { DirectorSideSetup } from "./directorTypes";
import {
  createMemberState,
  memberOptions,
  type MemberState,
} from "./directorMembers";
import { isSideExhausted } from "./quotaRules";
import type { ReinforcedSide, SideStanding } from "./reinforcementOutcome";
import type { ReinforcementRules } from "./reinforcementTypes";

/** One team's runtime state. */
export interface SideState {
  /** The team's side key. */
  readonly key: string;
  readonly isPlayerSide: boolean;
  /** The team's pool and field (shared by its squads). */
  readonly ledger: SideLedger;
  /** Its squads, in setup order. */
  readonly members: readonly MemberState[];
  /** Reinforcements deployed (numbers arrival slots). */
  readonly arrivals: number;
  /** Battle time from which its AI squads may deploy (AI deploy delay). */
  readonly readyAtMs: number;
}

/** What the HUD and end screen show of a side. */
export interface SideSummary {
  /** The team's side key. */
  readonly key: string;
  /** Its first squad's faction. */
  readonly faction: string;
  /** Every squad's faction, in order (a mixed team lists several). */
  readonly factions: readonly string[];
  readonly isPlayerSide: boolean;
  readonly poolPoints: number;
  readonly remainingPoints: number;
  readonly fieldPoints: number;
  readonly fieldCapPoints: number;
  readonly deployedCount: number;
  readonly lostCount: number;
  readonly lostPoints: number;
  readonly exhausted: boolean;
}

/** A coalition's totals (the player's team vs everyone else). */
export interface CoalitionStats {
  readonly deployed: number;
  readonly lost: number;
  readonly lostPoints: number;
  /** Points of opposing ships destroyed. */
  readonly destroyedPoints: number;
  readonly remainingPoints: number;
}

/**
 * @param rules - Match rules.
 * @param setup - The team and its squads.
 * @param isPlayerSide - Whether it is the player's team.
 * @returns A fresh side.
 */
export function createSideState(
  rules: ReinforcementRules,
  setup: DirectorSideSetup,
  isPlayerSide: boolean,
): SideState {
  return {
    key: setup.key,
    isPlayerSide,
    ledger: createSideLedger(rules),
    members: setup.members.map(createMemberState),
    arrivals: 0,
    readyAtMs: 0,
  };
}

/**
 * @param side - A team.
 * @param key - One of its squads.
 * @param update - The squad's new state.
 * @returns The team with that squad replaced.
 */
export function withMember(
  side: SideState,
  key: string,
  update: (member: MemberState) => MemberState,
): SideState {
  return {
    ...side,
    members: side.members.map((m) => (m.key === key ? update(m) : m)),
  };
}

/**
 * A ship of the team was destroyed: it leaves the field, the team's AI
 * squads wait the deploy delay, and the human who flew it gets a picker.
 *
 * @param side - The team.
 * @param shipId - The ship.
 * @param after - When the AI may deploy again, and the picker countdown.
 * @returns The updated team.
 */
export function retireFromSide(
  side: SideState,
  shipId: string,
  after: { readonly readyAtMs: number; readonly pickerMs: number },
): SideState {
  return {
    ...side,
    ledger: retireShip(side.ledger, shipId),
    readyAtMs: after.readyAtMs,
    members: side.members.map((m) =>
      m.pilotId === shipId
        ? { ...m, pilotId: null, pickerMs: after.pickerMs }
        : m,
    ),
  };
}

/**
 * @param side - A team.
 * @param rules - Match rules.
 * @returns Whether it has nothing alive and nothing any squad can deploy.
 */
export function sideExhausted(
  side: SideState,
  rules: ReinforcementRules,
): boolean {
  const options = side.members.flatMap((m) => memberOptions(m, rules));
  return isSideExhausted(side.ledger, rules.quotas, options);
}

/**
 * @param side - A team.
 * @param exhausted - Whether it is exhausted.
 * @returns Its summary.
 */
export function summarize(side: SideState, exhausted: boolean): SideSummary {
  const { ledger } = side;
  const factions = [...new Set(side.members.map((m) => m.faction))];
  return {
    key: side.key,
    faction: factions[0] ?? "",
    factions,
    isPlayerSide: side.isPlayerSide,
    poolPoints: ledger.poolPoints,
    remainingPoints: remainingPoints(ledger),
    fieldPoints: fieldPoints(ledger),
    fieldCapPoints: ledger.fieldCapPoints,
    deployedCount: ledger.deployedCount,
    lostCount: ledger.lostCount,
    lostPoints: ledger.lostPoints,
    exhausted,
  };
}

/**
 * @param own - The coalition's sides.
 * @param opposing - The other coalition's sides.
 * @returns The coalition's totals.
 */
export function coalitionStats(
  own: readonly SideState[],
  opposing: readonly SideState[],
): CoalitionStats {
  const sum = (sides: readonly SideState[], pick: (l: SideLedger) => number) =>
    sides.reduce((total, side) => total + pick(side.ledger), 0);
  return {
    deployed: sum(own, (l) => l.deployedCount),
    lost: sum(own, (l) => l.lostCount),
    lostPoints: sum(own, (l) => l.lostPoints),
    destroyedPoints: sum(opposing, (l) => l.lostPoints),
    remainingPoints: sum(own, remainingPoints),
  };
}

/**
 * @param sides - Every side.
 * @param playerSide - The player's coalition (true) or the opponents' (false).
 * @returns The coalition's sides.
 */
export function coalitionOf(
  sides: Iterable<SideState>,
  playerSide: boolean,
): SideState[] {
  return [...sides].filter((side) => side.isPlayerSide === playerSide);
}

/**
 * @param sides - Every side.
 * @param key - A team.
 * @returns Roles of every living ship of the other teams.
 */
export function opposingRolesOf(
  sides: Iterable<SideState>,
  key: string,
): ShipRole[] {
  return [...sides]
    .filter((side) => side.key !== key)
    .flatMap((side) => [...side.ledger.field.values()].map((e) => e.role));
}

/**
 * @param sides - Every side.
 * @returns The sides, the player's first.
 */
export function playerSideFirst(sides: Iterable<SideState>): SideState[] {
  return [...sides].sort(
    (a, b) => Number(b.isPlayerSide) - Number(a.isPlayerSide),
  );
}

/**
 * @param sides - Every side.
 * @returns Both coalitions' totals.
 */
export function matchTotals(
  sides: Iterable<SideState>,
): Readonly<Record<ReinforcedSide, CoalitionStats>> {
  const all = [...sides];
  const player = coalitionOf(all, true);
  const enemy = coalitionOf(all, false);
  return {
    player: coalitionStats(player, enemy),
    enemy: coalitionStats(enemy, player),
  };
}

/**
 * @param coalition - One coalition's sides.
 * @param rules - Match rules.
 * @returns Whether every side of it is exhausted.
 */
export function coalitionExhausted(
  coalition: readonly SideState[],
  rules: ReinforcementRules,
): boolean {
  return coalition.every((side) => sideExhausted(side, rules));
}

/**
 * @param sides - Every side.
 * @param rules - Match rules.
 * @returns Both coalitions as the outcome reads them.
 */
export function standingsOf(
  sides: Iterable<SideState>,
  rules: ReinforcementRules,
): Readonly<Record<ReinforcedSide, SideStanding>> {
  const all = [...sides];
  const totals = matchTotals(all);
  const standing = (
    playerSide: boolean,
    side: ReinforcedSide,
  ): SideStanding => ({
    exhausted: coalitionExhausted(coalitionOf(all, playerSide), rules),
    destroyedPoints: totals[side].destroyedPoints,
  });
  return { player: standing(true, "player"), enemy: standing(false, "enemy") };
}
