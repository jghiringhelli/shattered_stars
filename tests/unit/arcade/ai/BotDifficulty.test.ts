/**
 * BotDifficulty — specification tests: difficulty labels map onto the tiers
 * the skill gates measure, tuned on the real engine (docs/balance/): duel
 * Easy is a slow-reacting average pilot (novices lost ~100 % once the bots
 * stopped weaving), Hard a slower-reacting expert, Brutal a quicker expert;
 * unknown labels fly the average pilot. Squad modes crew slot by slot.
 */

import { describe, expect, it } from "vitest";
import {
  ACE_HARD_REACTION_SCALE,
  BRUTAL_REACTION_SCALE,
  DOGFIGHT_BRUTAL_REACTION_SCALE,
  EASY_REACTION_SCALE,
  HARD_REACTION_SCALE,
  TRAINING_SKILL,
  botProfile,
  difficultyToTier,
  squadLeaderSkill,
  squadSkillPlan,
  squadSlotSkill,
} from "../../../../src/arcade/ai/BotDifficulty";
import { TIER_PROFILES } from "../../../../src/arcade/ai/bots/BotKit";

describe("difficultyToTier", () => {
  it("maps the duel difficulties onto the gate tiers", () => {
    expect(difficultyToTier("easy")).toEqual({
      tier: "average",
      reactionScale: EASY_REACTION_SCALE,
    });
    expect(difficultyToTier("normal")).toEqual({
      tier: "average",
      reactionScale: 1,
    });
    expect(difficultyToTier("hard")).toEqual({
      tier: "expert",
      reactionScale: HARD_REACTION_SCALE,
    });
    expect(difficultyToTier("brutal")).toEqual({
      tier: "expert",
      reactionScale: BRUTAL_REACTION_SCALE,
    });
  });

  it("slows Easy's average pilot and Hard's expert, and quickens Brutal's", () => {
    expect(EASY_REACTION_SCALE).toBeGreaterThan(1);
    expect(HARD_REACTION_SCALE).toBeGreaterThan(1);
    expect(BRUTAL_REACTION_SCALE).toBeLessThan(1);
  });

  it("keeps a novice for training (Flight School's exam)", () => {
    expect(TRAINING_SKILL.tier).toBe("novice");
  });

  it("maps the epic raid's labels too", () => {
    expect(difficultyToTier("medium").tier).toBe("average");
    expect(difficultyToTier("mythic")).toEqual({
      tier: "expert",
      reactionScale: BRUTAL_REACTION_SCALE,
    });
  });

  it("is case-insensitive and falls back to the average pilot", () => {
    expect(difficultyToTier("HARD").tier).toBe("expert");
    expect(difficultyToTier("veteran")).toEqual({
      tier: "average",
      reactionScale: 1,
    });
  });
});

describe("difficultyToTier — per duel mode", () => {
  it("eases Dogfight's Brutal expert (one shared scale left it at 6 %)", () => {
    expect(difficultyToTier("brutal", "dogfight")).toEqual({
      tier: "expert",
      reactionScale: DOGFIGHT_BRUTAL_REACTION_SCALE,
    });
    expect(DOGFIGHT_BRUTAL_REACTION_SCALE).toBeGreaterThan(
      BRUTAL_REACTION_SCALE,
    );
    expect(DOGFIGHT_BRUTAL_REACTION_SCALE).toBeLessThan(HARD_REACTION_SCALE);
  });

  it("quickens Ace Duel's Hard expert (one shared scale left it at 36 %)", () => {
    expect(difficultyToTier("hard", "ace")).toEqual({
      tier: "expert",
      reactionScale: ACE_HARD_REACTION_SCALE,
    });
    expect(ACE_HARD_REACTION_SCALE).toBeLessThan(HARD_REACTION_SCALE);
    expect(ACE_HARD_REACTION_SCALE).toBeGreaterThan(BRUTAL_REACTION_SCALE);
  });

  it("keeps every other label on the shared mapping", () => {
    for (const mode of ["dogfight", "ace"] as const) {
      expect(difficultyToTier("easy", mode)).toEqual(difficultyToTier("easy"));
      expect(difficultyToTier("normal", mode)).toEqual(
        difficultyToTier("normal"),
      );
    }
    expect(difficultyToTier("hard", "dogfight")).toEqual(
      difficultyToTier("hard"),
    );
    expect(difficultyToTier("BRUTAL", "ace")).toEqual(
      difficultyToTier("brutal"),
    );
  });
});

describe("botProfile", () => {
  it("is the tier's measured profile at scale 1", () => {
    expect(botProfile("average")).toBe(TIER_PROFILES.average);
  });

  it("scales reaction and decision cadence, not the noise", () => {
    const hard = botProfile("expert", HARD_REACTION_SCALE);
    expect(hard.reactionMs).toBeCloseTo(
      TIER_PROFILES.expert.reactionMs * HARD_REACTION_SCALE,
    );
    expect(hard.decisionIntervalMs).toBeCloseTo(
      TIER_PROFILES.expert.decisionIntervalMs * HARD_REACTION_SCALE,
    );
    expect(hard.headingNoiseDeg).toBe(TIER_PROFILES.expert.headingNoiseDeg);
  });
});

describe("squadSkillPlan — squad modes", () => {
  const strength = (s: { tier: string; reactionScale: number }): number =>
    ({ novice: 0, average: 1, expert: 2 })[s.tier]! * 10 - s.reactionScale;

  it("crews every squad label with marks (a squad that never marks loses ~100 %)", () => {
    for (const format of ["classic", "reinforced"] as const)
      for (const label of ["easy", "normal", "hard", "brutal"])
        expect(squadSkillPlan(label, format).marks).toBe(true);
  });

  it("orders the labels easy < normal < hard < brutal in both formats", () => {
    for (const format of ["classic", "reinforced"] as const) {
      const best = (label: string) =>
        Math.max(...squadSkillPlan(label, format).slots.map(strength));
      const mean = (label: string) => {
        const slots = squadSkillPlan(label, format).slots;
        return slots.reduce((sum, s) => sum + strength(s), 0) / slots.length;
      };
      expect(mean("easy")).toBeLessThan(mean("normal"));
      expect(best("normal")).toBeLessThan(best("hard"));
      expect(best("hard")).toBeLessThan(best("brutal"));
    }
  });

  it("crews Easy as an average leader with novice wingmen, Normal as average pilots", () => {
    const easy = squadSkillPlan("easy", "classic");
    expect(squadSlotSkill(easy, 0).tier).toBe("average");
    expect(squadSlotSkill(easy, 1).tier).toBe("novice");
    expect(squadSkillPlan("normal", "reinforced").slots).toEqual([
      { tier: "average", reactionScale: 1 },
    ]);
  });

  it("cycles slots for reinforcements and leads with the quickest pilot", () => {
    const easy = squadSkillPlan("easy", "reinforced");
    const n = easy.slots.length;
    expect(squadSlotSkill(easy, n)).toEqual(squadSlotSkill(easy, 0));
    expect(squadSlotSkill(easy, n + 2)).toEqual(squadSlotSkill(easy, 2));
    expect(squadLeaderSkill(easy).tier).toBe("average");
  });

  it("maps Epic's labels and unknown labels (any case)", () => {
    expect(squadSkillPlan("Mythic", "classic")).toEqual(
      squadSkillPlan("brutal", "classic"),
    );
    expect(squadSkillPlan("medium")).toEqual(squadSkillPlan("normal"));
    expect(squadSkillPlan("whatever", "reinforced")).toEqual(
      squadSkillPlan("normal", "reinforced"),
    );
  });
});
