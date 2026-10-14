/**
 * tideBreach — the beat every Act III finale ends on (campaign_arc.md):
 * the Void Tide's front enters the Reach. When the finale's last goal is
 * done, Tidecells — the Tide's small outriders, which hunt loud minds —
 * arrive ahead of the squad and the banner calls the Breach. Pure.
 */

import type { ObjectiveDefinition } from "../../arcade/objectives";
import { isConstraintObjective } from "../../arcade/objectives";
import type { CampaignMission } from "../../data/campaign/campaignTypes";
import type { ScriptBeat } from "../scripting/scriptTypes";

/** The creature the Tide's front sends. */
export const BREACH_CREATURE_ID = "tidecell";
/** Outriders that arrive. */
export const BREACH_CREATURE_COUNT = 3;
/** Faction the outriders are drawn with (the Tide has none; this is only looks). */
const BREACH_FACTION = "void_corsairs";
/** The finale slot of a faction campaign's Act III. */
const FINALE_ACT = 3;
const FINALE_SLOT = 15;

/**
 * @param mission - A campaign mission.
 * @returns True for a faction campaign's Act III finale.
 */
export function isActThreeFinale(mission: CampaignMission): boolean {
  return mission.act === FINALE_ACT && mission.missionNumber === FINALE_SLOT;
}

/**
 * @param mission - A campaign mission.
 * @param objectives - Its compiled objectives.
 * @returns The Breach beat for a finale (fires when its last goal completes),
 *   else none.
 */
export function tideBreachBeats(
  mission: CampaignMission,
  objectives: readonly ObjectiveDefinition[],
): ScriptBeat[] {
  if (!isActThreeFinale(mission)) return [];
  const goals = objectives.filter(
    (o) => !o.optional && !isConstraintObjective(o),
  );
  const last = goals[goals.length - 1];
  if (!last) return [];
  return [
    {
      id: `${mission.id}_tide_breach`,
      when: { on: "objective", objectiveId: last.id, status: "completed" },
      actions: [
        {
          do: "spawn",
          group: {
            shipId: BREACH_CREATURE_ID,
            count: BREACH_CREATURE_COUNT,
            side: "enemy",
            faction: BREACH_FACTION,
            at: "ahead",
          },
        },
        {
          do: "banner",
          title: "THE BREACH",
          subtitle: "The Void Tide enters the Reach — the Spine gates go dark",
        },
      ],
    },
  ];
}
