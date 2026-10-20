/**
 * victoryLines — the on-win phase opens the debrief: its dialogue goes ahead
 * of the mission's own debrief lines and the mission is never mutated.
 */

import { describe, expect, it } from "vitest";
import { withVictoryLines } from "../../../src/campaign/battle/victoryLines";
import type {
  CampaignMission,
  DebriefLine,
} from "../../../src/data/campaign/campaignTypes";

const line = (text: string): DebriefLine => ({
  speaker: "CHEN",
  portraitKey: "portrait_chen",
  text,
});

const mission = (debrief?: readonly DebriefLine[]): CampaignMission =>
  ({ id: "m", debrief }) as unknown as CampaignMission;

describe("withVictoryLines", () => {
  it("returns the same mission when no on-win line played", () => {
    const m = mission([line("debrief")]);
    expect(withVictoryLines(m, [])).toBe(m);
  });

  it("puts on-win lines ahead of the debrief lines", () => {
    const result = withVictoryLines(mission([line("debrief")]), [
      line("after-fight"),
    ]);
    expect(result.debrief?.map((l) => l.text)).toEqual([
      "after-fight",
      "debrief",
    ]);
  });

  it("gives a mission without a debrief just the on-win lines", () => {
    const result = withVictoryLines(mission(), [line("after-fight")]);
    expect(result.debrief?.map((l) => l.text)).toEqual(["after-fight"]);
  });

  it("does not mutate the mission it was given", () => {
    const m = mission([line("debrief")]);
    withVictoryLines(m, [line("after-fight")]);
    expect(m.debrief).toHaveLength(1);
  });
});
