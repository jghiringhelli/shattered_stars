/**
 * normalizeObjective — upgrades v1 (legacy) objectives, which carried only a
 * kind and a description, into real objective definitions with default
 * geometry (offsets from the battlefield centre). Designs normally author
 * full objectives; this keeps any un-designed or legacy data playable with
 * the real mechanics instead of "clear all enemies". Pure.
 */

import type { FactionId } from "../../config";
import type { ObjectiveDefinition } from "../../arcade/objectives";
import type {
  CampaignMission,
  MissionObjective,
} from "../../data/campaign/campaignTypes";
import {
  FACTION_STATION,
  FACTION_TRANSPORT,
} from "../../data/campaign/factionAssets";

/** Default hold-out for a survive objective without a timer (s). */
export const DEFAULT_SURVIVE_SECONDS = 90;
/** Default capture zone: offset, radius (px) and hold time (s). */
const DEFAULT_ZONE = {
  at: { x: 0, y: -700 },
  radius: 260,
  holdSeconds: 25,
} as const;
/** Default convoy route, transports and speed (px/s). */
const DEFAULT_CONVOY = {
  path: [
    { x: -900, y: 500 },
    { x: 0, y: -200 },
    { x: 900, y: -1200 },
  ],
  count: 2,
  speed: 55,
} as const;
/** Default defended station offset. */
const DEFAULT_STATION_AT = { x: 0, y: -150 } as const;
/** Enemy tag of bosses and aces (set when they spawn). */
export const BOSS_TAG = "boss";
export const ACE_TAG = "ace";

/**
 * @param mission - The mission.
 * @returns Every enemy it fields (delayed waves included).
 */
function enemyTotal(mission: CampaignMission): number {
  return mission.enemies.reduce((sum, e) => sum + e.count, 0);
}

/**
 * @param mission - The mission.
 * @returns Tag of its named target: boss, else ace, else none.
 */
function namedTargetTag(mission: CampaignMission): string | null {
  if (mission.enemies.some((e) => e.isBoss)) return BOSS_TAG;
  if (mission.enemies.some((e) => e.isAce)) return ACE_TAG;
  return null;
}

/**
 * @param obj - Authored objective (legacy or full).
 * @param mission - Its mission.
 * @param factionId - Player faction (transport/station hulls).
 * @returns A full objective definition (offset coordinates).
 */
export function normalizeObjective(
  obj: MissionObjective,
  mission: CampaignMission,
  factionId: FactionId,
): ObjectiveDefinition {
  const base = {
    id: obj.id,
    description: obj.description,
    optional: obj.optional,
    xpBonus: obj.xpBonus,
    timeLimit: obj.timeLimit,
    reward: "reward" in obj ? obj.reward : undefined,
  };
  switch (obj.type) {
    case "eliminate": {
      if (obj.count !== undefined) {
        return {
          ...base,
          type: "eliminate",
          count: obj.count,
          tag: "tag" in obj ? obj.tag : undefined,
        };
      }
      const tag = obj.target ? namedTargetTag(mission) : null;
      return tag
        ? { ...base, type: "eliminate", count: 1, tag }
        : {
            ...base,
            type: "eliminate",
            count: Math.max(1, enemyTotal(mission)),
          };
    }
    case "survive":
      return obj.timeLimit !== undefined || obj.optional
        ? { ...base, type: "survive" }
        : { ...base, type: "survive", timeLimit: DEFAULT_SURVIVE_SECONDS };
    case "escort":
      if ("path" in obj) return obj;
      return {
        ...base,
        type: "escort",
        path: DEFAULT_CONVOY.path,
        speed: DEFAULT_CONVOY.speed,
        transports: {
          shipId: FACTION_TRANSPORT[factionId],
          count: DEFAULT_CONVOY.count,
        },
        maxLosses: DEFAULT_CONVOY.count - 1,
      };
    case "defend":
      if ("stationShipId" in obj) return obj;
      return {
        ...base,
        type: "defend",
        at: DEFAULT_STATION_AT,
        stationShipId: FACTION_STATION[factionId],
      };
    case "capture":
      if ("at" in obj) return obj;
      return { ...base, type: "capture", ...DEFAULT_ZONE };
    case "assassinate": {
      if ("targetShipId" in obj) return obj;
      const tag = namedTargetTag(mission);
      return tag
        ? { ...base, type: "eliminate", count: 1, tag }
        : {
            ...base,
            type: "eliminate",
            count: Math.max(1, enemyTotal(mission)),
          };
    }
    default:
      return obj;
  }
}
