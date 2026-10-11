import { describe, it, expect } from "vitest";
import {
  advanceSector,
  chooseHangar,
  chooseMutation,
  choosePower,
  chooseRelic,
  currentReward,
  mutationChoices,
  powerDraft,
  relicChoices,
  skipPower,
  spendReroll,
} from "../../../../src/systems/survival/RewardFlow";
import { getRelic } from "../../../../src/data/survival/relicCatalog";
import { SKIP_DRAFT_SALVAGE } from "../../../../src/data/survival/economy";
import { MAX_ESCORTS } from "../../../../src/data/survival/escorts";
import type { PendingReward } from "../../../../src/systems/survival/RunTypes";
import { RunBuilder } from "./survivalRunBuilder";

const POWER: PendingReward = { kind: "power", key: "s1-r0-c0" };

describe("power draft and rerolls", () => {
  it("draws the same powers for the same key", () => {
    const run = RunBuilder.aRun()
      .with({ pendingRewards: [POWER] })
      .build();
    expect(powerDraft(run, "k").map((p) => p.id)).toEqual(
      powerDraft(run, "k").map((p) => p.id),
    );
  });

  it("spends a reroll charge and changes the draw", () => {
    const run = RunBuilder.aRun()
      .with({ rerolls: 2, pendingRewards: [POWER] })
      .build();
    const rerolled = spendReroll(run)!;
    expect(rerolled.rerolls).toBe(1);
    expect(rerolled.rerollsSpentHere).toBe(1);
    expect(powerDraft(rerolled, "k").map((p) => p.id)).not.toEqual(
      powerDraft(run, "k").map((p) => p.id),
    );
  });

  it("refuses to reroll without charges", () => {
    expect(
      spendReroll(RunBuilder.aRun().with({ rerolls: 0 }).build()),
    ).toBeNull();
  });

  it("applies the chosen power, claims the reward and resets the reroll count", () => {
    const run = RunBuilder.aRun()
      .with({ pendingRewards: [POWER], rerollsSpentHere: 2 })
      .build();
    const next = choosePower(run, "gun_damage");
    expect(next.progression.branch.gunnery).toBe(1);
    expect(next.progression.bonuses.damage).toBeGreaterThan(0);
    expect(next.pendingRewards).toEqual([]);
    expect(next.rerollsSpentHere).toBe(0);
    expect(run.progression.branch.gunnery).toBe(0);
  });

  it("turns Wing Commander's extra escort into a real escort, never past the cap", () => {
    const base = RunBuilder.aRun()
      .with({ pendingRewards: [POWER] })
      .build();
    const ready = {
      ...base,
      progression: {
        ...base.progression,
        branch: { ...base.progression.branch, fleet: 3, gunnery: 3 },
      },
    };
    expect(choosePower(ready, "x_wingcmd").escorts).toHaveLength(1);
    let full = ready;
    for (let i = 0; i < MAX_ESCORTS; i++)
      full = { ...full, escorts: [...full.escorts, full.flagship] };
    full = {
      ...full,
      progression: { ...full.progression, escorts: MAX_ESCORTS },
    };
    expect(choosePower(full, "x_wingcmd").escorts).toHaveLength(MAX_ESCORTS);
  });

  it("pays salvage when the draft is skipped", () => {
    const run = RunBuilder.aRun()
      .with({ pendingRewards: [POWER] })
      .build();
    expect(skipPower(run).salvage).toBe(run.salvage + SKIP_DRAFT_SALVAGE);
  });
});

describe("relic rewards", () => {
  const reward = { kind: "relic", key: "k", minRarity: "rare" } as const;

  it("offers three unowned relics from unlocked pools, preferring the rarity floor", () => {
    const run = RunBuilder.aRun()
      .with({ relics: ["target_painter"] })
      .build();
    const offered = relicChoices(run, reward);
    expect(offered).toHaveLength(3);
    offered.forEach((r) => {
      expect(r.pool).toBe("base");
      expect(r.id).not.toBe("target_painter");
    });
    expect(offered[0]!.rarity).toBe("rare");
  });

  it("adds the chosen relic once", () => {
    const run = RunBuilder.aRun()
      .with({ pendingRewards: [reward] })
      .build();
    const next = chooseRelic(run, "wing_link");
    expect(next.relics).toEqual(["wing_link"]);
    expect(currentReward(next)).toBeNull();
    expect(
      chooseRelic({ ...next, pendingRewards: [reward] }, "wing_link").relics,
    ).toEqual(["wing_link"]);
    expect(getRelic("wing_link")).toBeDefined();
  });
});

describe("boss rewards", () => {
  it("graduates the hull from the Hangar", () => {
    const run = RunBuilder.aRun()
      .with({ pendingRewards: [{ kind: "hangar" }] })
      .build();
    expect(chooseHangar(run, 0).progression.hull).toBe("ace");
  });

  it("installs one mutation per slot; a later pick in the slot replaces it", () => {
    const reward = { kind: "mutation", slot: "weapon" } as const;
    expect(mutationChoices(reward).length).toBeGreaterThanOrEqual(2);
    const run = RunBuilder.aRun()
      .with({ pendingRewards: [reward, reward] })
      .build();
    const first = chooseMutation(run, "rail_driver");
    expect(first.mutations).toEqual({ weapon: "rail_driver" });
    expect(chooseMutation(first, "scatter_array").mutations).toEqual({
      weapon: "scatter_array",
    });
  });

  it("jumps to the next sector", () => {
    const run = RunBuilder.aRun()
      .with({ pendingRewards: [{ kind: "nextSector" }] })
      .build();
    const next = advanceSector(run);
    expect(next.sector).toBe(2);
    expect(next.pendingRewards).toEqual([]);
  });
});
