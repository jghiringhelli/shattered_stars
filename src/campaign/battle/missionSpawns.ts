/**
 * missionSpawns — turns objective entities, scripted groups and allied
 * squadrons into battle spawn requests (placement around the flagship for
 * "flank" / "ahead" / "behind", tags, side), and reads ships for objectives
 * (tabletop weight: medium or larger counts double). Pure.
 */

import type { FactionId } from "../../config";
import { getShipDefinition } from "../../data/ShipDefinitions";
import type { EntitySpawn, ObjectivePoint } from "../../arcade/objectives";
import type { ScriptSpawnGroup } from "../scripting/scriptTypes";
import type { MissionAlly } from "../../data/campaign/campaignTypes";
import type { BattleSpawnRequest } from "./battleTypes";

/** Distance of "ahead" / "behind" / "flank" arrivals from the flagship (px). */
export const ARRIVAL_DISTANCE = 650;
/** Gap between ships of one group (px). */
export const GROUP_SPACING = 80;
/** Tag every allied (non-squad) player-side ship carries. */
export const ALLY_TAG = "ally";
/** Size classes that count once for zone control. */
const LIGHT_SIZES: ReadonlySet<string> = new Set(["tiny", "small"]);

const PREFIXES: readonly (readonly [string, FactionId])[] = [
  ["terran_", "terran_hegemony"],
  ["confed_", "free_confederation"],
  ["synth_", "synthetic_collective"],
  ["corsair_", "void_corsairs"],
  ["ascendant_", "ascendant_empire"],
];

/**
 * @param shipId - Ship definition id.
 * @returns Its faction (by id prefix; Hegemony when unknown).
 */
export function factionOfShip(shipId: string): FactionId {
  return (
    PREFIXES.find(([prefix]) => shipId.startsWith(prefix))?.[1] ??
    "terran_hegemony"
  );
}

/**
 * @param shipId - Ship definition id.
 * @returns Its zone-control weight (1 small/tiny, 2 medium or bigger).
 */
export function objectiveWeight(shipId: string): number {
  const size = getShipDefinition(shipId)?.baseStats.size ?? "small";
  return LIGHT_SIZES.has(size) ? 1 : 2;
}

/** Where the flagship is and who fights. */
export interface SpawnContext {
  readonly flagship: {
    readonly x: number;
    readonly y: number;
    readonly angle: number;
  };
  /** Increasing number making ids unique. */
  readonly sequence: number;
  readonly playerFaction: FactionId;
  readonly enemyFaction: FactionId;
}

/**
 * @param from - A pose.
 * @param distance - Distance along its heading.
 * @param turnDeg - Heading offset.
 * @returns That point.
 */
function offsetFrom(
  from: SpawnContext["flagship"],
  distance: number,
  turnDeg: number,
): ObjectivePoint {
  const radians = ((from.angle + turnDeg) * Math.PI) / 180;
  return {
    x: from.x + Math.sin(radians) * distance,
    y: from.y - Math.cos(radians) * distance,
  };
}

/**
 * @param at - Placement.
 * @param ctx - Spawn context.
 * @returns Group centre.
 */
function groupCentre(
  at: ScriptSpawnGroup["at"],
  ctx: SpawnContext,
): ObjectivePoint {
  if (typeof at === "object") return at;
  if (at === "ahead") return offsetFrom(ctx.flagship, ARRIVAL_DISTANCE, 0);
  if (at === "behind") return offsetFrom(ctx.flagship, ARRIVAL_DISTANCE, 180);
  return offsetFrom(
    ctx.flagship,
    ARRIVAL_DISTANCE,
    ctx.sequence % 2 === 0 ? 90 : -90,
  );
}

/**
 * @param group - A scripted group.
 * @param ctx - Spawn context.
 * @returns One request per ship, spread around the arrival point, facing the flagship.
 */
export function groupSpawnRequests(
  group: ScriptSpawnGroup,
  ctx: SpawnContext,
): BattleSpawnRequest[] {
  const centre = groupCentre(group.at ?? "flank", ctx);
  const ally = group.side === "ally";
  const facing =
    (Math.atan2(ctx.flagship.x - centre.x, -(ctx.flagship.y - centre.y)) *
      180) /
    Math.PI;
  const tags = [
    ...(group.tag ? [group.tag] : []),
    ...(ally ? [ALLY_TAG] : []),
    ...(group.isBoss ? ["boss"] : []),
    ...(group.isAce ? ["ace"] : []),
  ];
  return Array.from({ length: group.count }, (_, i) => ({
    id: `script_${ctx.sequence}_${i}`,
    definitionId: group.shipId,
    faction: ally
      ? ctx.playerFaction
      : ((group.faction as FactionId | undefined) ?? ctx.enemyFaction),
    owner: ally ? ("player" as const) : ("ai" as const),
    pose: {
      x: centre.x + (i - (group.count - 1) / 2) * GROUP_SPACING,
      y: centre.y,
      angle: (facing + 360) % 360,
    },
    tags,
    hullScale: 1,
    scripted: false,
    piloted: true,
    isAce: group.isAce === true,
    isBoss: group.isBoss === true,
    lifetimeMs: null,
  }));
}

/**
 * @param ally - A mission's allied squadron.
 * @param start - Player squad start point.
 * @param playerFaction - Player faction.
 * @returns Requests placing it beside the player's squad.
 */
export function allySpawnRequests(
  ally: MissionAlly,
  start: ObjectivePoint,
  playerFaction: FactionId,
): BattleSpawnRequest[] {
  return Array.from({ length: ally.count }, (_, i) => ({
    id: `ally_${ally.tag}_${i}`,
    definitionId: ally.shipId,
    faction: playerFaction,
    owner: "player" as const,
    pose: {
      x: start.x - 2 * GROUP_SPACING - i * GROUP_SPACING,
      y: start.y + GROUP_SPACING,
      angle: 270,
    },
    tags: [ally.tag, ALLY_TAG],
    hullScale: 1,
    scripted: false,
    piloted: true,
    isAce: false,
    isBoss: false,
    lifetimeMs: null,
  }));
}

/**
 * @param spawn - An objective entity.
 * @param playerFaction - Player faction.
 * @returns Its spawn request.
 */
export function objectiveSpawnRequest(
  spawn: EntitySpawn,
  playerFaction: FactionId,
): BattleSpawnRequest {
  const player = spawn.side === "player";
  return {
    id: spawn.id,
    definitionId: spawn.shipId,
    faction: player ? playerFaction : factionOfShip(spawn.shipId),
    owner: player ? "player" : "ai",
    pose: { x: spawn.x, y: spawn.y, angle: spawn.angle },
    tags: [...spawn.tags, ...(spawn.isBoss ? ["boss"] : [])],
    hullScale: spawn.hullScale,
    scripted: spawn.scripted,
    piloted: !spawn.scripted,
    isAce: false,
    isBoss: spawn.isBoss === true,
    lifetimeMs: null,
  };
}
