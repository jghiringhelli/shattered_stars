/**
 * scenarioHudModel — what the Scenario HUD shows, as plain data: one glyph
 * per objective (kind, owner, progress) and the scoreboard's lines. Owners
 * are never shown by colour alone: each has a tag and a symbol, and the
 * views add a shape frame (friendly ring / hostile bare, as sideGlyphs).
 *
 * Pure: no Phaser.
 */

import {
  SCENARIO_ROUND_MS,
  SCRAMBLE_HOLD_MS,
  totalPoints,
  type ObjectiveOwner,
  type ScenarioSide,
  type ScenarioState,
} from "../../arcade/scenarios";
import { MS_PER_SECOND } from "../../arcade/objectives/objectiveCore";
import { formatMatchClock } from "../../systems/arena/MatchTimer";

/** What an objective is drawn as. */
export type GlyphKind = "satellite" | "node" | "crate";

/** One objective, ready to draw. */
export interface ObjectiveGlyph {
  readonly id: string;
  readonly label: string;
  readonly kind: GlyphKind;
  readonly x: number;
  readonly y: number;
  /** Control radius (0 for crates). */
  readonly radius: number;
  readonly owner: ObjectiveOwner;
  /** Scrambling progress 0–1 (nodes), else 0. */
  readonly progress: number;
  readonly progressSide: ScenarioSide | null;
  /** The ship carrying it (crates), else null. */
  readonly carrierId: string | null;
}

/** Scoreboard lines. */
export interface ScoreboardView {
  readonly title: string;
  readonly playerScore: string;
  readonly enemyScore: string;
  readonly goal: string;
  readonly round: string;
  readonly chips: string;
  /** Call-out (carrying salvage, scoring not started), or "". */
  readonly alert: string;
}

/** Owner tags (end screen, readouts). */
export const OWNER_TAGS: Readonly<Record<ObjectiveOwner, string>> = {
  player: "OURS",
  enemy: "FOE",
  contested: "CONTESTED",
  none: "OPEN",
};

/** Owner symbols (scoreboard chips, marker captions). */
export const OWNER_SYMBOLS: Readonly<Record<ObjectiveOwner, string>> = {
  player: "▲",
  enemy: "▼",
  contested: "±",
  none: "·",
};

/** Seconds shown with one decimal. */
const SECONDS_DECIMALS = 1;

/**
 * @param state - The match.
 * @returns One glyph per objective, in definition order.
 */
export function objectiveGlyphs(state: ScenarioState): ObjectiveGlyph[] {
  const none = { progress: 0, progressSide: null, carrierId: null } as const;
  const zones = state.zones.map((z) => ({
    ...none,
    id: z.id,
    label: z.label,
    kind: "satellite" as const,
    x: z.x,
    y: z.y,
    radius: z.radius,
    owner: z.controller,
  }));
  const nodes = state.nodes.map((n) => ({
    ...none,
    id: n.id,
    label: n.label,
    kind: "node" as const,
    x: n.x,
    y: n.y,
    radius: n.radius,
    owner: n.owner ?? ("none" as const),
    progress: Math.min(1, n.progressMs / SCRAMBLE_HOLD_MS),
    progressSide: n.progressSide,
  }));
  const crates = state.crates.map((c) => ({
    ...none,
    id: c.id,
    label: c.label,
    kind: "crate" as const,
    x: c.x,
    y: c.y,
    radius: 0,
    owner: c.carrierSide ?? ("none" as const),
    carrierId: c.carrierId,
  }));
  return [...zones, ...nodes, ...crates];
}

/**
 * @param state - The match.
 * @param playerShipId - The human player's ship (salvage call-out), or null.
 * @returns The scoreboard's lines.
 */
export function scoreboardView(
  state: ScenarioState,
  playerShipId: string | null,
): ScoreboardView {
  const def = state.definition;
  const toRound = (SCENARIO_ROUND_MS - state.roundElapsedMs) / MS_PER_SECOND;
  const left = Math.max(0, def.timeLimitMs - state.elapsedMs);
  const chips = objectiveGlyphs(state)
    .map((g) => `${g.label}${OWNER_SYMBOLS[g.owner]}`)
    .join(" ");
  return {
    title: def.shortName,
    playerScore: `YOU ${totalPoints(state.points.player)}`,
    enemyScore: `${totalPoints(state.points.enemy)} FOE`,
    goal: `FIRST TO ${def.threshold}`,
    round: `ROUND ${state.round + 1} · ${toRound.toFixed(SECONDS_DECIMALS)}s · ${formatMatchClock(left)}`,
    chips,
    alert: alertOf(state, playerShipId),
  };
}

/**
 * @returns The call-out: salvage carried by the player, or scoring not started.
 */
function alertOf(state: ScenarioState, playerShipId: string | null): string {
  if (playerShipId && state.crates.some((c) => c.carrierId === playerShipId)) {
    return "CARRYING SALVAGE — BOOST / ROLL DROPS IT";
  }
  const first = state.definition.firstScoringRound;
  if (state.round + 1 < first) return `SCORING FROM ROUND ${first}`;
  return "";
}
