/**
 * Spec: a daily run starts at the day's fixed ascension even when the
 * player has not unlocked it yet (ordinary runs stay capped).
 */

import { describe, it, expect } from "vitest";
import { RoguelikeRunService } from "../../../../src/systems/survival/RoguelikeRunService";
import { MemoryStore } from "../../../../src/systems/survival/KeyValueStore";
import { dailyChallengeFor } from "../../../../src/systems/survival/DailyChallenge";

const daily = dailyChallengeFor(new Date(2026, 9, 11));

function request(uncapped: boolean) {
  return {
    faction: daily.faction,
    flagshipId: daily.flagshipId,
    loadoutId: null,
    ascension: 3,
    seed: daily.seed,
    ...(uncapped ? { uncappedAscension: true } : {}),
  };
}

describe("daily run start", () => {
  it("ordinary runs are capped at the unlocked ascension", () => {
    const service = new RoguelikeRunService(new MemoryStore(), () => 0);
    expect(service.startRun(request(false)).ascension).toBe(0);
  });

  it("a daily run keeps its fixed ascension", () => {
    const service = new RoguelikeRunService(new MemoryStore(), () => 0);
    const run = service.startRun(request(true));
    expect(run.ascension).toBe(3);
    expect(run.seed).toBe(daily.seed);
  });
});
