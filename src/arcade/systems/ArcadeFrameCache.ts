/**
 * ArcadeFrameCache — Precomputed per-frame lists, grouped by team.
 * Built once at the start of each tick to replace scattered .filter()/.map() calls.
 */

import type { TeamId } from "../teams";

export interface ArcadeShipView {
  readonly id: string;
  readonly team: TeamId;
  readonly hull: number;
  readonly x: number;
  readonly y: number;
}

export interface FrameCache<T extends ArcadeShipView = ArcadeShipView> {
  readonly aliveShips: T[];
  readonly aliveByTeam: ReadonlyMap<TeamId, T[]>;
  readonly aliveEnemiesOf: (team: TeamId) => T[];
}

/**
 * Builds the per-frame cache from the full ship map.
 * O(n) single pass — replaces multiple O(n) filter calls scattered through the tick.
 *
 * @param ships - Iterable of all ships (alive and dead).
 * @returns Living ships, by team, and every team's living enemies.
 */
export function buildFrameCache<T extends ArcadeShipView>(
  ships: Iterable<T>,
): FrameCache<T> {
  const aliveShips: T[] = [];
  const aliveByTeam = new Map<TeamId, T[]>();

  for (const ship of ships) {
    if (ship.hull <= 0) continue;
    aliveShips.push(ship);
    let teamList = aliveByTeam.get(ship.team);
    if (!teamList) {
      teamList = [];
      aliveByTeam.set(ship.team, teamList);
    }
    teamList.push(ship);
  }

  return {
    aliveShips,
    aliveByTeam,
    aliveEnemiesOf(team: TeamId): T[] {
      const result: T[] = [];
      for (const [other, list] of aliveByTeam) {
        if (other !== team) {
          for (const ship of list) result.push(ship);
        }
      }
      return result;
    },
  };
}
