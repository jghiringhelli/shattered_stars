import { describe, expect, it } from "vitest";
import {
  continueCardState,
  launchOfEntry,
} from "../../../../src/ui/menu/continueModel";
import { MAIN_MENU_ENTRIES } from "../../../../src/ui/menu/mainMenuEntries";
import { LAST_BATTLE_VERSION } from "../../../../src/telemetry/lastBattleStore";
import { MatchStatsAccumulator } from "../../../../src/telemetry/matchStats";

const BATTLE = {
  version: LAST_BATTLE_VERSION,
  savedAt: 1,
  summary: {
    ...new MatchStatsAccumulator("skirmish", () => 0).finish("victory"),
    durationMs: 182_000,
  },
};
const LAUNCH = { version: 1, savedAt: 1, label: "SKIRMISH", scene: "ArcadeBattleScene" };

describe("continueModel", () => {
  it("hides the card when nothing is remembered", () => {
    expect(continueCardState(null, null).visible).toBe(false);
  });

  it("shows the last battle line and both actions", () => {
    const state = continueCardState(LAUNCH, BATTLE);
    expect(state).toMatchObject({
      visible: true,
      title: "Continue · SKIRMISH",
      line: "Last: Skirmish — Victory 3:02",
      canContinue: true,
      canShowDetails: true,
    });
  });

  it("offers details without a continue when only a battle is stored", () => {
    const state = continueCardState(null, BATTLE);
    expect(state.canContinue).toBe(false);
    expect(state.canShowDetails).toBe(true);
  });

  it("remembers play modes but not system screens", () => {
    const byLabel = (label: string) => MAIN_MENU_ENTRIES.find((e) => e.label === label)!;
    expect(launchOfEntry(byLabel("SKIRMISH"))).toEqual({
      label: "SKIRMISH",
      scene: "SquadBuilderScene",
      data: { initialMode: "arcade" },
    });
    expect(launchOfEntry(byLabel("DOGFIGHT"))?.scene).toBe("DogfightScene");
    expect(launchOfEntry(byLabel("SETTINGS"))).toBeNull();
    expect(launchOfEntry(byLabel("ONLINE"))).toBeNull();
  });
});
