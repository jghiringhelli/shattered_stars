/**
 * reinforcementEndModel — the reinforcement lines of the end screen: why
 * the match ended, ships deployed and pool left per side, and the DRAW
 * headline (the classic overlay only knows victory / defeat).
 *
 * Pure.
 */

import type {
  CoalitionStats,
  ReinforcedResult,
  ReinforcedSide,
  ReinforcementFormat,
} from "../../../arcade/reinforcements";

/** Both coalitions' totals. */
type MatchTotals = Readonly<Record<ReinforcedSide, CoalitionStats>>;

/** What the reinforcement rules add to the classic end screen. */
export interface EndOverlayExtras {
  readonly pointsDestroyed: number;
  readonly pointsLost: number;
  readonly details: string[];
  readonly outcomeLabel?: string;
}

/** What the end-of-match telemetry is built from. */
export interface TelemetryInput {
  readonly stats: MatchTotals;
  readonly result: ReinforcedResult | null;
  readonly format: ReinforcementFormat;
  readonly elapsedMs: number;
}

/**
 * @param result - How the match ended (null: a scenario decided it).
 * @returns One line on why it ended ("" when unknown).
 */
export function reasonLine(result: ReinforcedResult | null): string {
  if (!result) return "";
  if (result.reason === "time") return "TIME — DESTROYED POINTS DECIDE";
  if (result.winner === "player") return "ENEMY POOL EXHAUSTED";
  if (result.winner === "enemy") return "YOUR POOL EXHAUSTED";
  return "BOTH POOLS EXHAUSTED";
}

/**
 * @param stats - Both coalitions' totals.
 * @returns Ships deployed and pool left, per side.
 */
export function endDetails(stats: MatchTotals): string[] {
  const { player, enemy } = stats;
  return [
    `SHIPS DEPLOYED  YOU ${player.deployed}  ·  FOE ${enemy.deployed}`,
    `POOL LEFT  YOU ${player.remainingPoints}  ·  FOE ${enemy.remainingPoints}`,
  ];
}

/**
 * @param result - How the match ended.
 * @returns "DRAW" for a draw, else undefined (the overlay's own headline).
 */
export function outcomeLabel(
  result: ReinforcedResult | null,
): string | undefined {
  return result?.winner === "draw" ? "DRAW" : undefined;
}

/**
 * @param stats - Both coalitions' totals.
 * @param result - How the match ended.
 * @returns Points by deploy cost, the reason and summary lines, DRAW.
 */
export function endOverlayExtras(
  stats: MatchTotals,
  result: ReinforcedResult | null,
): EndOverlayExtras {
  const label = outcomeLabel(result);
  const reason = reasonLine(result);
  return {
    pointsDestroyed: stats.player.destroyedPoints,
    pointsLost: stats.player.lostPoints,
    details: [...(reason ? [reason] : []), ...endDetails(stats)],
    ...(label ? { outcomeLabel: label } : {}),
  };
}

/**
 * @param input - Totals, result, format and match length.
 * @returns Flat end-of-match telemetry fields.
 */
export function telemetryDetails(
  input: TelemetryInput,
): Record<string, number | string> {
  const { player, enemy } = input.stats;
  return {
    battle: "reinforcements",
    format: input.format,
    matchMs: Math.round(input.elapsedMs),
    endReason: input.result?.reason ?? "scenario",
    shipsDeployedFriendly: player.deployed,
    shipsDeployedHostile: enemy.deployed,
    shipsLostFriendly: player.lost,
    shipsLostHostile: enemy.lost,
    pointsDestroyed: player.destroyedPoints,
    pointsLost: player.lostPoints,
  };
}
