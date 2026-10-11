/**
 * BotDifficulty — specification tests: difficulty labels map onto the tiers
 * the skill gates measure, Brutal is a faster expert, unknown labels fly the
 * average pilot.
 */

import { describe, expect, it } from "vitest";
import {
  BRUTAL_REACTION_SCALE,
  botProfile,
  difficultyToTier,
} from "../../../../src/arcade/ai/BotDifficulty";
import { TIER_PROFILES } from "../../../../src/arcade/ai/bots/BotKit";

describe("difficultyToTier", () => {
  it("maps the duel difficulties onto the gate tiers", () => {
    expect(difficultyToTier("easy")).toEqual({
      tier: "novice",
      reactionScale: 1,
    });
    expect(difficultyToTier("normal")).toEqual({
      tier: "average",
      reactionScale: 1,
    });
    expect(difficultyToTier("hard")).toEqual({
      tier: "expert",
      reactionScale: 1,
    });
    expect(difficultyToTier("brutal")).toEqual({
      tier: "expert",
      reactionScale: BRUTAL_REACTION_SCALE,
    });
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

describe("botProfile", () => {
  it("is the tier's measured profile at scale 1", () => {
    expect(botProfile("average")).toBe(TIER_PROFILES.average);
  });

  it("scales reaction and decision cadence, not the noise", () => {
    const brutal = botProfile("expert", BRUTAL_REACTION_SCALE);
    expect(brutal.reactionMs).toBeCloseTo(
      TIER_PROFILES.expert.reactionMs * BRUTAL_REACTION_SCALE,
    );
    expect(brutal.decisionIntervalMs).toBeCloseTo(
      TIER_PROFILES.expert.decisionIntervalMs * BRUTAL_REACTION_SCALE,
    );
    expect(brutal.headingNoiseDeg).toBe(TIER_PROFILES.expert.headingNoiseDeg);
  });
});
