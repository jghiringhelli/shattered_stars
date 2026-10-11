/**
 * EpicAiFlight — specification tests for who flies the Boss Raid's AI
 * ships: escorts at the raid difficulty's bot tier, wingmen always average.
 */

import { describe, it, expect } from "vitest";
import {
  raidBotSkill,
  WINGMAN_SKILL,
  type EpicDifficulty,
} from "../../../../src/arcade/systems/EpicAiFlight";
import { BRUTAL_REACTION_SCALE } from "../../../../src/arcade/ai";

describe("raidBotSkill — escorts", () => {
  it.each([
    ["easy", "novice", 1],
    ["medium", "average", 1],
    ["hard", "expert", 1],
    ["mythic", "expert", BRUTAL_REACTION_SCALE],
  ] as const)(
    "flies %s escorts as %s pilots (reaction x%s)",
    (difficulty, tier, reactionScale) => {
      expect(raidBotSkill("escort", difficulty)).toEqual({
        tier,
        reactionScale,
      });
    },
  );
});

describe("raidBotSkill — wingmen", () => {
  it.each(["easy", "medium", "hard", "mythic"] as EpicDifficulty[])(
    "flies the player's wingmen as average pilots on %s",
    (difficulty) => {
      expect(raidBotSkill("wingman", difficulty)).toBe(WINGMAN_SKILL);
      expect(WINGMAN_SKILL).toEqual({ tier: "average", reactionScale: 1 });
    },
  );
});
