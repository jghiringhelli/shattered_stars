/**
 * ArcadeFrameCache — Precomputed per-frame lists.
 * Built once at the start of each tick to replace scattered .filter()/.map() calls.
 */

export interface ArcadeShipView {
  readonly id: string;
  readonly faction: string;
  readonly hull: number;
  readonly x: number;
  readonly y: number;
}

export interface FrameCache {
  readonly aliveShips: ArcadeShipView[];
  readonly aliveByFaction: ReadonlyMap<string, ArcadeShipView[]>;
  readonly aliveEnemiesOf: (faction: string) => ArcadeShipView[];
}

/**
 * Builds the per-frame cache from the full ship map.
 * O(n) single pass — replaces multiple O(n) filter calls scattered through the tick.
 *
 * @param ships - Iterable of all ships (alive and dead).
 */
export function buildFrameCache(ships: Iterable<ArcadeShipView>): FrameCache {
  const aliveShips: ArcadeShipView[] = [];
  const aliveByFaction = new Map<string, ArcadeShipView[]>();

  for (const ship of ships) {
    if (ship.hull <= 0) continue;
    aliveShips.push(ship);
    let factionList = aliveByFaction.get(ship.faction);
    if (!factionList) {
      factionList = [];
      aliveByFaction.set(ship.faction, factionList);
    }
    factionList.push(ship);
  }

  return {
    aliveShips,
    aliveByFaction,
    aliveEnemiesOf(faction: string): ArcadeShipView[] {
      const result: ArcadeShipView[] = [];
      for (const [f, list] of aliveByFaction) {
        if (f !== faction) {
          for (const ship of list) result.push(ship);
        }
      }
      return result;
    },
  };
}
