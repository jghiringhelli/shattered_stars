/**
 * Rule of N act unlocks and the Act V endings.
 */

import { describe, expect, it } from "vitest";
import {
  coalitionActStatus,
  factionActStatus,
  factionActStatuses,
  lockedActsOf,
} from "../../../src/campaign/chronicle/actUnlocks";
import { emptyChronicle } from "../../../src/campaign/chronicle/chronicleRules";
import type { ChronicleData } from "../../../src/campaign/chronicle/chronicleTypes";
import {
  bestEnding,
  endingOptions,
} from "../../../src/campaign/chronicle/endings";
import { UNITY_FLAGS } from "../../../src/data/campaign/crossovers";

const HEG = "terran_hegemony";
const FACTIONS = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
] as const;

/** A Chronicle where the first `count` factions completed the given acts. */
function withActs(
  count: number,
  acts: readonly number[],
  extra: Partial<ChronicleData> = {},
): ChronicleData {
  const actsComplete: Record<string, readonly number[]> = {};
  FACTIONS.slice(0, count).forEach((f) => (actsComplete[f] = acts));
  return { ...emptyChronicle(), actsComplete, ...extra };
}

describe("Rule of N — faction acts", () => {
  it("keeps every Act I open from a fresh Chronicle", () => {
    for (const f of FACTIONS)
      expect(factionActStatus(emptyChronicle(), f, 1).state).toBe("open");
  });

  it("locks Act II until Act I is complete in two factions, own included", () => {
    expect(factionActStatus(withActs(1, [1]), HEG, 2)).toMatchObject({
      state: "locked",
      missing: 1,
      reason: expect.stringContaining("complete Act I in 1 more faction"),
    });
    expect(factionActStatus(withActs(2, [1]), HEG, 2).state).toBe("open");
  });

  it("needs the faction's own Act I even when others have finished it", () => {
    const chronicle = withActs(5, [1]);
    const status = factionActStatus(chronicle, "ascendant_empire", 2);
    expect(status.state).toBe("open");
    const noOwn: ChronicleData = {
      ...chronicle,
      actsComplete: { ...chronicle.actsComplete, ascendant_empire: [] },
    };
    expect(factionActStatus(noOwn, "ascendant_empire", 2)).toMatchObject({
      state: "locked",
      reason: "Complete Act I of this campaign first",
    });
  });

  it("locks Act III until Act II is complete in three factions", () => {
    expect(factionActStatus(withActs(2, [1, 2]), HEG, 3)).toMatchObject({
      state: "locked",
      missing: 1,
    });
    expect(factionActStatus(withActs(3, [1, 2]), HEG, 3).state).toBe("open");
  });

  it("reports an act as complete once the faction finished it", () => {
    expect(factionActStatus(withActs(1, [1]), HEG, 1).state).toBe("complete");
  });

  it("never takes away an act the faction already has progress in", () => {
    expect(factionActStatus(withActs(1, [1]), HEG, 2, [2]).state).toBe("open");
  });

  it("Free Order lifts the cross-faction condition but not the own-act one", () => {
    const free = { ...withActs(1, [1]), freeOrder: true };
    expect(factionActStatus(free, HEG, 2).state).toBe("open");
    expect(factionActStatus(free, HEG, 3).state).toBe("locked");
    expect(lockedActsOf(factionActStatuses(free, HEG))).toEqual([3]);
  });
});

describe("Rule of N — Coalition acts", () => {
  it("opens Act IV after four faction campaigns", () => {
    const three = coalitionActStatus(withActs(3, [1, 2, 3]), 4);
    expect(three).toMatchObject({ state: "locked", missing: 1 });
    expect(coalitionActStatus(withActs(4, [1, 2, 3]), 4).state).toBe("open");
  });

  it("needs Act IV done and all five campaigns for Act V", () => {
    const four = withActs(4, [1, 2, 3], { actsComplete: { coalition: [4] } });
    expect(coalitionActStatus(four, 5).state).toBe("locked");
    const all = withActs(5, [1, 2, 3]);
    expect(coalitionActStatus(all, 5).state).toBe("locked");
    const ready: ChronicleData = {
      ...all,
      actsComplete: { ...all.actsComplete, coalition: [4] },
    };
    expect(coalitionActStatus(ready, 5).state).toBe("open");
  });

  it("Free Order needs one finished campaign for Act IV and only Act IV for Act V", () => {
    const free = withActs(1, [1, 2, 3], { freeOrder: true });
    expect(coalitionActStatus(free, 4).state).toBe("open");
    const act4: ChronicleData = {
      ...free,
      actsComplete: { ...free.actsComplete, coalition: [4] },
    };
    expect(coalitionActStatus(act4, 5).state).toBe("open");
    expect(
      coalitionActStatus({ ...emptyChronicle(), freeOrder: true }, 4).state,
    ).toBe("locked");
  });
});

describe("Act V endings", () => {
  const flagsOf = (flags: readonly string[]): Record<string, boolean> =>
    Object.fromEntries(flags.map((f) => [f, true]));
  const keys = [
    "key_heg_witness",
    "key_conf_pact",
    "key_synth_dissent",
    "key_cors_loyalty",
    "key_asc_mercy",
  ];

  it("forces The Quiet when unity is below 4", () => {
    expect(endingOptions(flagsOf(UNITY_FLAGS.slice(0, 3)))).toMatchObject({
      available: ["quiet"],
      forced: true,
      unity: 3,
    });
  });

  it("offers Sever and Seal from unity 4", () => {
    expect(endingOptions(flagsOf(UNITY_FLAGS.slice(0, 4))).available).toEqual([
      "sever",
      "seal",
    ]);
  });

  it("withholds Answer without all five keys, or below unity 7", () => {
    expect(
      endingOptions(flagsOf([...UNITY_FLAGS.slice(0, 7), ...keys.slice(0, 4)]))
        .available,
    ).not.toContain("answer");
    expect(
      endingOptions(flagsOf([...UNITY_FLAGS.slice(0, 6), ...keys])).available,
    ).not.toContain("answer");
  });

  it("offers Answer first with five keys and unity 7", () => {
    const flags = flagsOf([...UNITY_FLAGS.slice(0, 7), ...keys]);
    expect(endingOptions(flags).available).toEqual(["answer", "sever", "seal"]);
    expect(bestEnding(flags)).toBe("answer");
  });
});
