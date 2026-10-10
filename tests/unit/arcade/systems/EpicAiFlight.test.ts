/**
 * EpicAiFlight — specification tests for Boss Raid AI K-turn rules.
 */

import { describe, it, expect } from "vitest";
import { mayAiKTurn } from "../../../../src/arcade/systems/EpicAiFlight";

const FIGHTER = "confed_sparrow";
const HUGE_CAPITAL = "terran_imperator";
const LARGE_CAPITAL = "terran_executor";

describe("mayAiKTurn", () => {
  it("never lets a huge capital K-turn, even as a wingman on mythic", () => {
    expect(mayAiKTurn(HUGE_CAPITAL, "wingman", "mythic")).toBe(false);
  });

  it("never lets a large capital-dial ship K-turn", () => {
    expect(mayAiKTurn(LARGE_CAPITAL, "escort", "hard")).toBe(false);
  });

  it("forbids boss escorts from K-turning on easy", () => {
    expect(mayAiKTurn(FIGHTER, "escort", "easy")).toBe(false);
  });

  it.each(["medium", "hard", "mythic"] as const)(
    "lets boss escort fighters K-turn on %s",
    (difficulty) => {
      expect(mayAiKTurn(FIGHTER, "escort", difficulty)).toBe(true);
    },
  );

  it("lets wingman fighters K-turn on easy", () => {
    expect(mayAiKTurn(FIGHTER, "wingman", "easy")).toBe(true);
  });
});
