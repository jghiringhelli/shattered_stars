/**
 * EpicAiFlight — specification tests for who flies the Boss Raid's AI
 * ships: escorts crewed slot by slot from the raid difficulty's squad plan
 * (BotDifficulty.squadSkillPlan), wingmen always average.
 */

import { describe, it, expect } from "vitest";
import {
  raidBotSkill,
  WINGMAN_SKILL,
  type EpicDifficulty,
} from "../../../../src/arcade/systems/EpicAiFlight";
import {
  squadSkillPlan,
  squadSlotSkill,
} from "../../../../src/arcade/ai/BotDifficulty";

describe("raidBotSkill — escorts", () => {
  it.each([
    ["easy", "easy"],
    ["medium", "normal"],
    ["hard", "hard"],
    ["mythic", "brutal"],
  ] as const)(
    "crews %s escorts slot by slot from the %s squad plan",
    (difficulty, label) => {
      const plan = squadSkillPlan(label, "classic");
      for (const slot of [0, 1, 2, 3])
        expect(raidBotSkill("escort", difficulty, slot)).toEqual(
          squadSlotSkill(plan, slot),
        );
    },
  );

  it("leads an easy raid's escorts with an average pilot and novice wingmen", () => {
    expect(raidBotSkill("escort", "easy", 0).tier).toBe("average");
    expect(raidBotSkill("escort", "easy", 1).tier).toBe("novice");
  });
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
