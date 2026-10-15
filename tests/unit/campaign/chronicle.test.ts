/**
 * Chronicle rules — shared flags, first-witness canon with exclusive groups,
 * derived keys, unity, act completion and seeding from older saves.
 */

import { describe, expect, it } from "vitest";
import {
  canonFilter,
  completedActs,
  deriveFlags,
  effectiveFlags,
  earnedKeys,
  emptyChronicle,
  recordVictory,
  seedChronicle,
  unityCount,
} from "../../../src/campaign/chronicle/chronicleRules";
import { summarizeChronicle } from "../../../src/campaign/chronicle/chronicleTimeline";
import type { ChronicleVictory } from "../../../src/campaign/chronicle/chronicleTypes";
import { FACTION_CAMPAIGNS } from "../../../src/data/CampaignData";

const HEG = "terran_hegemony";
const COR = "void_corsairs";

const win = (over: Partial<ChronicleVictory>): ChronicleVictory => ({
  missionId: "heg_2_1",
  faction: HEG,
  campaignId: HEG,
  storyFlags: {},
  actsComplete: [],
  ...over,
});

describe("Chronicle canon (first witness writes it)", () => {
  it("records the first side to finish a crossover as canon", () => {
    const chronicle = recordVictory(
      emptyChronicle(),
      win({ storyFlags: { heg_convoy_intact: true } }),
    );
    expect(chronicle.crossovers["X4"]?.canonFaction).toBe(HEG);
    expect(chronicle.flags["heg_convoy_intact"]).toBe(true);
  });

  it("keeps the first canon when the other side plays later", () => {
    let chronicle = recordVictory(
      emptyChronicle(),
      win({ storyFlags: { heg_convoy_intact: true } }),
    );
    chronicle = recordVictory(
      chronicle,
      win({
        missionId: "cors_2_4",
        faction: COR,
        campaignId: COR,
        storyFlags: { x4_convoy_gutted: true },
      }),
    );
    expect(chronicle.crossovers["X4"]?.canonFaction).toBe(HEG);
    expect(chronicle.crossovers["X4"]?.witnesses).toEqual([HEG, COR]);
    expect(chronicle.flags["x4_convoy_gutted"]).toBeUndefined();
  });

  it("lets compatible flags of both sides stand (X5 joint breakout)", () => {
    let chronicle = recordVictory(
      emptyChronicle(),
      win({
        missionId: "conf_2_2",
        faction: "free_confederation",
        campaignId: "free_confederation",
        storyFlags: { conf_prisoners_freed: true },
      }),
    );
    expect(chronicle.flags["x5_joint_breakout"]).toBeUndefined();
    chronicle = recordVictory(
      chronicle,
      win({
        missionId: "cors_2_3",
        faction: COR,
        campaignId: COR,
        storyFlags: { cors_crew_rescued: true },
      }),
    );
    expect(chronicle.flags["x5_joint_breakout"]).toBe(true);
    expect(chronicle.flags["key_cors_loyalty"]).toBe(true);
  });

  it("ignores flags that are not shared", () => {
    const chronicle = recordVictory(
      emptyChronicle(),
      win({ storyFlags: { heg_lance_lost: true } }),
    );
    expect(chronicle.flags["heg_lance_lost"]).toBeUndefined();
  });

  it("filters a second witness's exclusive flag before it is saved", () => {
    const flags = canonFilter(
      { x4_convoy_gutted: true, cors_crew_rescued: true },
      { heg_convoy_intact: true },
    );
    expect(flags).toEqual({ cors_crew_rescued: true });
  });

  it("reads the opposite exclusive flag as false once canon is set", () => {
    const chronicle = recordVictory(
      emptyChronicle(),
      win({ storyFlags: { heg_convoy_intact: true } }),
    );
    const flags = effectiveFlags({ x4_convoy_gutted: true }, chronicle);
    expect(flags["heg_convoy_intact"]).toBe(true);
    expect(flags["x4_convoy_gutted"]).toBe(false);
  });

  it("adds extra flags (Coalition lead markers) to the effective flags", () => {
    const flags = effectiveFlags({}, emptyChronicle(), {
      lead_void_corsairs: true,
    });
    expect(flags["lead_void_corsairs"]).toBe(true);
  });
});

describe("derived flags, unity and keys", () => {
  it("derives the Hegemony key from either source flag", () => {
    expect(deriveFlags({ heg_phoenix_defected: true })["key_heg_witness"]).toBe(
      true,
    );
    expect(deriveFlags({ x11_betrayal_averted: true })["key_heg_witness"]).toBe(
      true,
    );
    expect(deriveFlags({})["key_heg_witness"]).toBeUndefined();
  });

  it("counts unity flags only", () => {
    expect(
      unityCount({
        x7_shards_saved: true,
        x8_node_preserved: true,
        heg_lance_lost: true,
      }),
    ).toBe(2);
  });

  it("lists the keys earned", () => {
    expect(earnedKeys({ key_conf_pact: true, key_asc_mercy: true })).toEqual([
      "key_conf_pact",
      "key_asc_mercy",
    ]);
  });
});

describe("act completion and seeding", () => {
  const heg = FACTION_CAMPAIGNS.terran_hegemony;
  const actOne = ["heg_1_1", "heg_1_2", "heg_1_3", "heg_1_4", "heg_1_5"];

  it("completes an act when every slot has a completed mission", () => {
    expect(completedActs(heg, actOne)).toEqual([1]);
    expect(completedActs(heg, actOne.slice(0, 4))).toEqual([]);
  });

  it("accepts either mission of a branch pair", () => {
    expect(
      completedActs(heg, [
        "heg_1_1",
        "heg_1_2",
        "heg_1_3b",
        "heg_1_4",
        "heg_1_5",
      ]),
    ).toEqual([1]);
  });

  it("seeds the Chronicle from older saves, the oldest being first witness", () => {
    const chronicle = seedChronicle([
      {
        faction: COR,
        campaign: FACTION_CAMPAIGNS.void_corsairs,
        completedMissions: ["cors_2_4"],
        storyFlags: { x4_convoy_gutted: true },
        lastPlayed: 2,
      },
      {
        faction: HEG,
        campaign: heg,
        completedMissions: [...actOne, "heg_2_1"],
        storyFlags: { heg_convoy_intact: true },
        lastPlayed: 1,
      },
    ]);
    expect(chronicle.crossovers["X4"]?.canonFaction).toBe(HEG);
    expect(chronicle.flags["x4_convoy_gutted"]).toBeUndefined();
    expect(chronicle.actsComplete[HEG]).toEqual([1]);
  });
});

describe("Chronicle timeline", () => {
  it("lists the 15 crossovers in story order with canon points of view", () => {
    const chronicle = recordVictory(emptyChronicle(), win({}));
    const summary = summarizeChronicle(chronicle);
    expect(summary.rows).toHaveLength(15);
    const days = summary.rows.map((r) => r.day);
    expect(days).toEqual([...days].sort((a, b) => a - b));
    expect(summary.resolved).toBe(1);
    expect(summary.dayReached).toBe(52);
    expect(summary.rows.find((r) => r.id === "X4")?.canonFaction).toBe(HEG);
  });
});
