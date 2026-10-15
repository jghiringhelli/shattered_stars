/**
 * Mode XP — how much global progression XP a finished match is worth in each
 * game mode. Pure (no I/O): `matchXpReward` turns a match summary into the
 * reward the profile store applies. See docs/specs/progression.md (PRG-6).
 */

import { XP_REWARDS } from "./ProgressionData";

/** XP a mode pays out. */
export interface ModeXpRule {
  /** Awarded for a victory (a Survival node clear, a Campaign mission...). */
  readonly win: number;
  /** Awarded for a defeat or a draw. */
  readonly loss: number;
  /** Awarded per hostile ship destroyed. */
  readonly perKill: number;
  /** Extra XP when the match closes a whole run (Survival run won). */
  readonly runWonBonus: number;
}

/** What the profile store applies after a match. */
export interface MatchXpReward {
  readonly xp: number;
  readonly kills: number;
  readonly won: boolean;
}

/** The parts of a match summary the XP rules read. */
export interface XpMatchSummary {
  readonly mode: string;
  readonly outcome: string;
  readonly kills: number;
  readonly runWon?: boolean | string | number | null;
}

/** Kills past this count in one match earn no further XP (anti-farm). */
export const MAX_REWARDED_KILLS = 60;

/** A Survival node is a short fight in a long run: half the usual win bonus. */
const SURVIVAL_NODE_WIN_XP = Math.round(XP_REWARDS.win / 2);

const STANDARD_RULE: ModeXpRule = {
  win: XP_REWARDS.win,
  loss: XP_REWARDS.loss,
  perKill: XP_REWARDS.perKill,
  runWonBonus: 0,
};

/** Per-mode XP (keys are the `mode` ids of the match telemetry). */
export const MODE_XP_RULES: Readonly<Record<string, ModeXpRule>> = {
  skirmish: STANDARD_RULE,
  continuous: STANDARD_RULE,
  dogfight: STANDARD_RULE,
  ace_duel: STANDARD_RULE,
  boss_raid: { ...STANDARD_RULE, win: XP_REWARDS.missionComplete },
  campaign: { ...STANDARD_RULE, win: XP_REWARDS.missionComplete },
  survival: {
    ...STANDARD_RULE,
    win: SURVIVAL_NODE_WIN_XP,
    runWonBonus: XP_REWARDS.missionComplete,
  },
};

const VICTORY = "victory";
const RESULT_OUTCOMES: ReadonlySet<string> = new Set([
  VICTORY,
  "defeat",
  "draw",
]);

/**
 * @param summary - A finished match.
 * @returns Its XP reward, or null when the match earns none (a quit, a mode
 *   without XP such as Flight School).
 */
export function matchXpReward(summary: XpMatchSummary): MatchXpReward | null {
  const rule = MODE_XP_RULES[summary.mode];
  if (!rule || !RESULT_OUTCOMES.has(summary.outcome)) return null;
  const won = summary.outcome === VICTORY;
  const kills = Math.min(
    MAX_REWARDED_KILLS,
    Math.max(0, Math.floor(Number.isFinite(summary.kills) ? summary.kills : 0)),
  );
  const runBonus = won && summary.runWon === true ? rule.runWonBonus : 0;
  const xp = kills * rule.perKill + (won ? rule.win : rule.loss) + runBonus;
  return { xp, kills, won };
}
