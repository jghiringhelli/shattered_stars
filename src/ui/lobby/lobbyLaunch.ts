/**
 * lobbyLaunch — pure builders for the battle configuration a lobby room
 * launches: ArcadeBattleScene's registry `battleConfig` and DogfightScene's
 * networked init data.
 */

import type { FactionId } from "../../config";
import { defaultShipsForFaction, resolveShips } from "./lobbyData";

/** A player's faction/ship source for battle setup. */
export interface PlayerSource {
  id: string;
  factionId: string | null;
  ships?: string[] | undefined;
}

/** Faction a player without one falls back to. */
const FALLBACK_LOCAL_FACTION: FactionId = "free_confederation";
/** Faction an opponent without one falls back to. */
const FALLBACK_OPPONENT_FACTION: FactionId = "terran_hegemony";

/** Inputs shared by both builders. */
export interface LaunchContext {
  readonly localId: string;
  readonly sources: ReadonlyArray<PlayerSource>;
  readonly seed: number | undefined;
  readonly isOnlineMode: boolean;
}

/**
 * Build ArcadeBattleScene's `battleConfig` registry entry.
 *
 * @param context - Local id, player sources, seed, online flag.
 * @param gameMode - Room game mode.
 * @param pointLimit - Squad point limit.
 * @returns The registry value.
 */
export function buildArcadeBattleConfig(
  context: LaunchContext,
  gameMode: string,
  pointLimit: number,
): Record<string, unknown> {
  const factions = context.sources.map((p) => ({
    factionId: (p.factionId ?? FALLBACK_LOCAL_FACTION) as FactionId,
    controller: (p.id === context.localId ? "player" : "ai") as "player" | "ai",
    ships: resolveShips(p.factionId, p.ships),
  }));
  return {
    factions,
    gameMode,
    pointLimit,
    seed: context.seed,
    isOnlineMode: context.isOnlineMode,
  };
}

/**
 * Build DogfightScene's networked init data for a 2-player room.
 *
 * @param context - Local id, player sources, seed, online flag.
 * @returns Scene data, or null when either side is missing.
 */
export function buildDogfightInit(
  context: LaunchContext,
): Record<string, unknown> | null {
  const local = context.sources.find((p) => p.id === context.localId);
  const opponent = context.sources.find((p) => p.id !== context.localId);
  if (!local || !opponent) return null;
  const localFactionId = (local.factionId ??
    FALLBACK_LOCAL_FACTION) as FactionId;
  const opponentFactionId = (opponent.factionId ??
    FALLBACK_OPPONENT_FACTION) as FactionId;
  return {
    isOnlineMode: context.isOnlineMode,
    seed: context.seed ?? 0,
    localFactionId,
    localShipId:
      resolveShips(local.factionId, local.ships)[0] ??
      defaultShipsForFaction(localFactionId)[0],
    opponentFactionId,
    opponentShipId:
      resolveShips(opponent.factionId, opponent.ships)[0] ??
      defaultShipsForFaction(opponentFactionId)[0],
  };
}
