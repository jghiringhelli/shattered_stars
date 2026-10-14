/**
 * roleHints — one-line role and "best with" hints (P2-1) for every pilot
 * ability, upgrade card, quick build, survival relic and armory mod,
 * derived from their effect data.
 */

export {
  MAX_HINT_CHARS,
  abilityPlaystyle,
  bestWithLine,
  pilotAbilityHint,
  quickBuildHint,
  shipHint,
  upgradeHint,
  upgradePlaystyle,
  type RoleHint,
} from "./cardHints";
export { armoryHint, armoryPlaystyle, relicHint } from "./modeHints";
export {
  PLAYSTYLES,
  ROLE_PLURALS,
  ROLE_TITLES,
  roleLine,
  type Playstyle,
  type PlaystyleInfo,
} from "./playstyles";
export {
  explainBaseShip,
  explainQuickBuild,
  type BuildExplanation,
  type CostLine,
} from "./buildExplanation";
export { hullTraits, type HullTraits } from "./hullTraits";
export {
  ROLE_BLURBS,
  ROLE_CHIP_LABELS,
  ROLE_SECTION_ORDER,
  sortRolesForSections,
} from "./roleSections";
