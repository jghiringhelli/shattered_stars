/**
 * Squad Builder data types.
 * Defines the squad/ship hierarchy used by SquadBuilderScene and battle scenes.
 */

import type { FactionId } from "../config";
import type { AIDifficultyLevel } from "../ai/AIDifficulty";
import { getShipsByFaction, SHIP_DEFINITIONS } from "../data/ShipDefinitions";
import { getLoadoutById } from "../data/ShipLoadouts";
import { getQuickBuild, toSimSpecs } from "../data/SquadronPresets";
import { assignQuickBuilds } from "../arcade/systems/QuickBuildEquip";

export type GameMode = "arcade" | "continuous" | "survival" | "online" | "epic";

/**
 * A single squad — one faction's ships, controlled by one player or AI.
 * Squads with the same teamId fight on the same side.
 */
export interface SquadEntry {
  /** Team number 1–4. Squads sharing a teamId are allies. */
  teamId: number;
  factionId: FactionId | null;
  controller: "player" | "ai";
  ships: string[];
  /** loadoutId keyed by shipId — chosen via ShipPickerScene */
  loadoutChoices: Record<string, string>;
  pointsUsed: number;
}

/** Full battle setup written to registry and consumed by battle scenes */
export interface BattleConfig {
  factions: Array<{
    factionId: FactionId | null;
    controller: "player" | "ai";
    ships: string[];
    loadoutChoices: Record<string, string>;
    teamId: string;
  }>;
  gameMode: GameMode;
  pointLimit: number;
  aiDifficulty: AIDifficultyLevel;
}

export const TEAM_COLORS: readonly number[] = [
  0x2255cc, 0xcc3322, 0x22aa44, 0xcc8822,
];
export const TEAM_LABELS: readonly string[] = ["T1", "T2", "T3", "T4"];

/** Modes that allow the player to configure team structure */
export const MULTI_TEAM_MODES: readonly GameMode[] = [
  "arcade",
  "continuous",
  "epic",
];

const ALL_FACTIONS: FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

/**
 * Create a blank squad entry for the given team.
 * @param teamId - Team number 1–4 this squad belongs to.
 * @param index - Used to cycle the default faction assignment.
 * @param controller - Human player or AI.
 */
export function makeSquad(
  teamId: number,
  index: number,
  controller: "player" | "ai",
): SquadEntry {
  return {
    teamId,
    factionId: ALL_FACTIONS[index % ALL_FACTIONS.length] as FactionId,
    controller,
    ships: [],
    loadoutChoices: {},
    pointsUsed: 0,
  };
}

/**
 * Picks a faction different from the player's for a quick AI-opponent squad
 * (used by the simple flow so single-ship matches aren't mirror battles by
 * default). Deterministic — cycles to the next faction in roster order.
 *
 * @param playerFaction - The faction the player just chose.
 */
export function pickOpponentFaction(playerFaction: FactionId): FactionId {
  const idx = ALL_FACTIONS.indexOf(playerFaction);
  const nextIdx = (idx + 1) % ALL_FACTIONS.length;
  return ALL_FACTIONS[nextIdx] as FactionId;
}

/**
 * Derive a human-readable battle format label from the current squad list.
 * Counts squads per team, sorts descending, joins with 'v'.
 *
 * @param squads - All squads in the builder.
 * @returns Label such as "1v1", "2v2", "2v1", "1v1v1v1".
 */
export function computeFormatLabel(squads: SquadEntry[]): string {
  const teamCounts = new Map<number, number>();
  for (const s of squads) {
    teamCounts.set(s.teamId, (teamCounts.get(s.teamId) ?? 0) + 1);
  }
  if (teamCounts.size === 0) return "—";
  return [...teamCounts.values()].sort((a, b) => b - a).join("v");
}

/**
 * Maximum ships in one squad. Caps both auto-fill paths so a cheap flagship
 * can't spawn a swarm the wing-formation spawner has no offsets for.
 */
export const MAX_SQUAD_SHIPS = 6;

/**
 * Ships a squad may recruit, cheapest-last so a greedy pass spends the budget
 * on the strongest hulls first and uses cheap ships to mop up the remainder.
 *
 * @param factionId - Faction to recruit from.
 * @param gameMode - Capital and huge ships are only allowed in "epic" mode.
 * @param exclude - Ship ids already in the squad.
 */
function recruitableShips(
  factionId: FactionId,
  gameMode: GameMode,
  exclude: readonly string[],
) {
  return getShipsByFaction(factionId)
    .filter(
      (s) =>
        gameMode === "epic" ||
        (s.role !== "capital" && s.baseStats.size !== "huge"),
    )
    .filter((s) => !exclude.includes(s.id))
    .sort((a, b) => b.baseStats.pointCost - a.baseStats.pointCost);
}

/**
 * What a squad costs as it flies: every ship on its chosen quick build,
 * else the default one the battle scenes equip (assignQuickBuilds — unique
 * pilots never twice), priced at that build's cost (bare hull when the
 * ship has no build).
 *
 * @param ships - Ship ids in squad order.
 * @param loadoutChoices - Chosen builds keyed by squad index ("0", "1", …).
 * @returns Total points.
 */
export function flownSquadCost(
  ships: readonly string[],
  loadoutChoices: Readonly<Record<string, string>> = {},
): number {
  const builds = assignQuickBuilds(
    ships,
    ships.map((_, index) => loadoutChoices[String(index)]),
  );
  return ships.reduce((sum, id, index) => {
    const build = builds[index] ? getLoadoutById(builds[index]!) : undefined;
    return (
      sum + (build?.pointCost ?? SHIP_DEFINITIONS[id]?.baseStats.pointCost ?? 0)
    );
  }, 0);
}

/**
 * Adds wingmen to a squad up to the point limit, keeping the ships already in
 * it and recomputing pointsUsed from the final roster — priced as it flies
 * ({@link flownSquadCost}: the player's chosen build, every other ship's
 * default build), so a squad never fields more points than the limit.
 *
 * The simple Skirmish flow lets the player pick a single flagship. Without
 * this, that ship launched alone: a 28pt Stiletto against the 198pt three-ship
 * squad autoFillSquad builds for the AI.
 *
 * @param squad - Squad to fill in place (mutates .ships and .pointsUsed).
 * @param gameMode - Capital ships are only allowed in "epic" mode.
 * @param pointLimit - Maximum total point cost for the squad.
 */
export function fillSquadWingmen(
  squad: SquadEntry,
  gameMode: GameMode,
  pointLimit: number,
): void {
  if (!squad.factionId) return;
  squad.pointsUsed = flownSquadCost(squad.ships, squad.loadoutChoices);
  for (const ship of recruitableShips(squad.factionId, gameMode, squad.ships)) {
    if (squad.ships.length >= MAX_SQUAD_SHIPS) break;
    const withShip = flownSquadCost(
      [...squad.ships, ship.id],
      squad.loadoutChoices,
    );
    if (withShip > pointLimit) continue;
    squad.ships.push(ship.id);
    squad.pointsUsed = withShip;
  }
}

/**
 * Fills a squad for its faction from scratch, discarding whatever was there
 * before: the faction's curated quick-build squad for exactly this budget
 * (SquadronPresets — balanced lists with an aura projector), else greedily
 * by point cost, highest first. Shared by SquadListPanel (advanced builder)
 * and the simple flow's AI-opponent auto-fill so both use identical logic.
 *
 * @param squad - Squad to fill in place (mutates .ships, .loadoutChoices and .pointsUsed).
 * @param gameMode - Capital ships are only allowed in "epic" mode.
 * @param pointLimit - Maximum total point cost for the squad.
 */
export function autoFillSquad(
  squad: SquadEntry,
  gameMode: GameMode,
  pointLimit: number,
): void {
  squad.ships = [];
  squad.loadoutChoices = {};
  squad.pointsUsed = 0;
  const preset = squad.factionId
    ? getQuickBuild(squad.factionId, pointLimit)
    : undefined;
  if (preset && preset.pointLimit === pointLimit) {
    const specs = toSimSpecs(preset);
    squad.ships = specs.map((spec) => spec.shipId);
    specs.forEach((spec, index) => {
      if (spec.loadoutId) squad.loadoutChoices[String(index)] = spec.loadoutId;
    });
    squad.pointsUsed = flownSquadCost(squad.ships, squad.loadoutChoices);
    return;
  }
  fillSquadWingmen(squad, gameMode, pointLimit);
}
