/**
 * AI difficulty labels. Difficulty is the opposing bots' piloting skill
 * (difficultyToTier in src/arcade/ai/BotDifficulty.ts maps a label to a
 * skill tier) — never a stat bonus on hit chance, damage or cooldowns.
 */

export type AIDifficultyLevel = "easy" | "normal" | "hard" | "brutal";

/** Display name per difficulty. */
export const DIFFICULTY_NAMES: Record<AIDifficultyLevel, string> = {
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
  brutal: "Brutal",
};

/** One-line description per difficulty (who flies the enemy ships). */
export const DIFFICULTY_DESCRIPTIONS: Record<AIDifficultyLevel, string> = {
  easy: "Novice pilots: slow reactions, sloppy lines, no focus-fire marks",
  normal: "Average pilots: steady pursuit and coordinated squads",
  hard: "Expert pilots: plan maneuvers ahead and punish mistakes",
  brutal: "Expert pilots with lightning reactions",
};
