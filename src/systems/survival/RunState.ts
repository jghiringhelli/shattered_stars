/**
 * Survival roguelite — run creation and fleet/state updates (pure,
 * immutable: every function returns a new RunState).
 */

import type { FactionId } from "../../config";
import { createRunState } from "../../data/survival/model";
import { ascensionRules, clampAscension } from "../../data/survival/ascension";
import {
  MAX_SHIP_UPGRADES,
  STARTING_REROLLS,
  STARTING_SALVAGE,
} from "../../data/survival/economy";
import { MAX_ESCORTS } from "../../data/survival/escorts";
import {
  bonusStartingSalvage,
  startingEscorts,
  unlockedRelicPools,
} from "../../data/survival/metaUnlocks";
import { relicsOf } from "../../data/survival/relicCatalog";
import { FACTION_STARTER_SHIPS } from "../../data/survival/starters";
import {
  flagshipLoadout,
  joiningSquadLoadouts,
} from "../../arcade/systems/SurvivalLoadouts";
import { generateSectorMap } from "./SectorMapGenerator";
import {
  RUN_LOG_LIMIT,
  RUN_SCHEMA_VERSION,
  type RunState,
  type ShipRecord,
} from "./RunTypes";

/** Hull fraction events can never push a ship below (events never kill). */
export const EVENT_HULL_FLOOR = 0.05;

/** What a new run needs. */
export interface NewRunOptions {
  readonly seed: number;
  readonly faction: FactionId;
  readonly flagshipId: string;
  readonly loadoutId: string | null;
  readonly ascension: number;
  /** Meta unlock ids owned (escort packages, relic pools, war chest). */
  readonly unlocked: readonly string[];
  readonly now: number;
}

/**
 * @param definitionId - Ship id.
 * @param loadoutId - Quick build, or null.
 * @returns A fresh, undamaged ship record.
 */
export function freshShip(
  definitionId: string,
  loadoutId: string | null,
): ShipRecord {
  return { definitionId, loadoutId, hull: 1, shields: 1, upgrades: 0 };
}

/** Every run starts with this many escort wingmen (ADR-0004: a squad, and its mark, from node 1). */
export const FREE_STARTING_ESCORTS = 1;

/**
 * @param options - Seed, faction, flagship, ascension, meta unlocks, clock.
 * @returns A new run positioned at the start of sector 1, with the free
 *   wingman plus any meta escort package (capped at MAX_ESCORTS).
 */
export function createRun(options: NewRunOptions): RunState {
  const ascension = clampAscension(options.ascension);
  const flagship = freshShip(
    options.flagshipId,
    flagshipLoadout(options.flagshipId, options.loadoutId),
  );
  const base: RunState = {
    version: RUN_SCHEMA_VERSION,
    seed: options.seed >>> 0,
    faction: options.faction,
    ascension,
    sector: 1,
    map: generateSectorMap(options.seed, 1, mapOptions(ascension)),
    currentNodeId: null,
    activeNodeId: null,
    activeKind: null,
    activeEventId: null,
    eventCombat: null,
    path: [],
    salvage: STARTING_SALVAGE + bonusStartingSalvage(options.unlocked),
    rerolls: STARTING_REROLLS,
    rerollsSpentHere: 0,
    relics: [],
    mutations: {},
    flagship,
    escorts: [],
    progression: createRunState(),
    pools: unlockedRelicPools(options.unlocked),
    pendingRewards: [],
    seenEvents: [],
    shopBought: [],
    stats: emptyStats(),
    status: "active",
    cause: null,
    startedAt: options.now,
    log: [],
  };
  let run = base;
  const escorts = FREE_STARTING_ESCORTS + startingEscorts(options.unlocked);
  for (let i = 0; i < escorts; i++) {
    run = addEscort(run);
  }
  return run;
}

function emptyStats(): RunState["stats"] {
  return {
    kills: 0,
    elitesKilled: 0,
    bossesKilled: 0,
    nodesCleared: 0,
    salvageEarned: 0,
    escortsLost: 0,
    bonusCharts: 0,
    elapsedMs: 0,
  };
}

/**
 * @param ascension - Ascension level.
 * @returns Map generation knobs for it.
 */
export function mapOptions(ascension: number): {
  eliteWeightMultiplier: number;
} {
  return {
    eliteWeightMultiplier: ascensionRules(ascension).eliteWeightMultiplier,
  };
}

/**
 * @param run - The run.
 * @param message - A notable event.
 * @returns The run with the message appended to its (bounded) log.
 */
export function withLog(run: RunState, message: string): RunState {
  return { ...run, log: [...run.log, message].slice(-RUN_LOG_LIMIT) };
}

/**
 * @param run - The run.
 * @returns Every ship of the fleet, flagship first.
 */
export function fleetOf(run: RunState): ShipRecord[] {
  return [run.flagship, ...run.escorts];
}

/**
 * @param run - The run.
 * @param ships - New fleet, flagship first (must not be empty).
 * @returns The run with the fleet replaced and the escort count synced.
 */
export function withFleet(
  run: RunState,
  ships: readonly ShipRecord[],
): RunState {
  const [flagship, ...escorts] = ships;
  if (!flagship) return run;
  return {
    ...run,
    flagship,
    escorts,
    progression: { ...run.progression, escorts: escorts.length },
  };
}

/**
 * @param run - The run.
 * @param fraction - Share of max hull to repair (negative damages, never
 *   below EVENT_HULL_FLOOR).
 * @returns The run with every ship's hull adjusted.
 */
export function adjustFleetHull(run: RunState, fraction: number): RunState {
  return withFleet(
    run,
    fleetOf(run).map((ship) => ({
      ...ship,
      hull:
        fraction < 0
          ? Math.max(
              Math.min(ship.hull, EVENT_HULL_FLOOR),
              ship.hull + fraction,
            )
          : Math.min(1, ship.hull + fraction),
    })),
  );
}

/**
 * @param run - The run.
 * @returns The run with one more escort (faction starter) unless the wing is full.
 */
export function addEscort(run: RunState): RunState {
  if (run.escorts.length >= MAX_ESCORTS) return run;
  const definitionId = FACTION_STARTER_SHIPS[run.faction];
  const [loadoutId] = joiningSquadLoadouts(fleetOf(run), [definitionId]);
  return withFleet(run, [
    ...fleetOf(run),
    freshShip(definitionId, loadoutId ?? null),
  ]);
}

/**
 * @param run - The run.
 * @returns The run with its last escort removed (no-op without escorts).
 */
export function removeEscort(run: RunState): RunState {
  if (run.escorts.length === 0) return run;
  return withFleet(run, fleetOf(run).slice(0, -1));
}

/**
 * @param run - The run.
 * @param index - Fleet index (0 = flagship).
 * @returns The run with that ship one upgrade level higher (capped).
 */
export function upgradeShip(run: RunState, index: number): RunState {
  return withFleet(
    run,
    fleetOf(run).map((ship, i) =>
      i === index
        ? { ...ship, upgrades: Math.min(MAX_SHIP_UPGRADES, ship.upgrades + 1) }
        : ship,
    ),
  );
}

/**
 * @param run - The run.
 * @param sector - The sector to enter (1-based).
 * @returns The run at the start of that sector, with a fresh map and the
 *   per-sector rerolls from relics.
 */
export function enterSector(run: RunState, sector: number): RunState {
  const bonusRerolls = relicsOf(run.relics)
    .flatMap((relic) => relic.effects)
    .reduce(
      (sum, e) => sum + (e.kind === "economy" ? (e.rerollsPerSector ?? 0) : 0),
      0,
    );
  return {
    ...run,
    sector,
    map: generateSectorMap(run.seed, sector, mapOptions(run.ascension)),
    currentNodeId: null,
    path: [],
    rerolls: run.rerolls + bonusRerolls,
  };
}

/**
 * @param value - A number.
 * @param min - Lower bound.
 * @param max - Upper bound.
 * @returns It clamped to [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
