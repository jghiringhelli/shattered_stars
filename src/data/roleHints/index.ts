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
