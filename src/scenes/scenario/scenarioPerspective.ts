/**
 * scenarioPerspective — a scenario match seen from one side. The match
 * itself is canonical (online: seat 0's squad is the "player" side on
 * every client); the scoreboard ("YOU" / "FOE"), objective colours and the
 * end screen read it from the local pilot's side. Pure.
 */

import type { ScenarioSide, ScenarioState } from "../../arcade/scenarios";

type Owned = string | null;

/** @param owner - An owner tag. @returns It as the other side sees it. */
function flip<T extends Owned>(owner: T): T {
  if (owner === "player") return "enemy" as T;
  if (owner === "enemy") return "player" as T;
  return owner;
}

function swap<T>(
  pair: Readonly<Record<ScenarioSide, T>>,
): Record<ScenarioSide, T> {
  return { player: pair.enemy, enemy: pair.player };
}

/**
 * @param state - The canonical match.
 * @param side - The side the viewer flies.
 * @returns The match with "player" meaning the viewer's side.
 */
export function scenarioFromSide(
  state: ScenarioState,
  side: ScenarioSide,
): ScenarioState {
  if (side === "player") return state;
  const result = state.result;
  return {
    ...state,
    zones: state.zones.map((z) => ({ ...z, controller: flip(z.controller) })),
    nodes: state.nodes.map((n) => ({
      ...n,
      owner: flip(n.owner),
      progressSide: flip(n.progressSide),
      controller: flip(n.controller),
    })),
    crates: state.crates.map((c) => ({
      ...c,
      carrierSide: flip(c.carrierSide),
    })),
    points: swap(state.points),
    lastRoundAwards: state.lastRoundAwards ? swap(state.lastRoundAwards) : null,
    result: result
      ? { ...result, winner: flip(result.winner), points: swap(result.points) }
      : null,
  };
}
