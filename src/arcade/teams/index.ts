/**
 * Teams — side identity of squad battles (Skirmish, Epic, Scenario,
 * Reinforcements, online): hostility, allies, side keys, squad → team
 * assignment and team-scoped support auras. Pure.
 */

export {
  areAllies,
  areHostile,
  assignSquadTeams,
  parseTeamId,
  relationOf,
  teamKey,
  type TeamId,
  type TeamRelation,
  type Teamed,
} from "./teams";
export { resolveTeamAuras } from "./teamAuras";
