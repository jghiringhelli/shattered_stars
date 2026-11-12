/**
 * Spec: the Skirmish WINGMEN state — choosing a type, CUSTOM starting from
 * the current squad, taking the squad edited in the picker, resetting on a
 * faction change and turning into a stable fill request.
 */

import { describe, expect, it } from "vitest";
import { planWingmen } from "../../../../src/systems/setup/wingmen";
import { WingmenChoice, type WingmenContext } from "../../../../src/ui/squad/skirmish/WingmenChoice";

const CONTEXT: WingmenContext = {
  faction: "terran_hegemony",
  shipId: "terran_gladius",
  loadoutId: null,
  gameMode: "arcade",
  pointLimit: 200,
};
const AUTO_PLAN = planWingmen({ ...CONTEXT, type: "auto", seed: 1 });

describe("WingmenChoice", () => {
  it("builds a request that carries the type and a stable seed", () => {
    const choice = new WingmenChoice("fighters", []);
    const a = choice.request(CONTEXT);
    expect(a.type).toBe("fighters");
    expect(choice.request(CONTEXT).seed).toBe(a.seed);
  });

  it("SHUFFLE changes the seed", () => {
    const choice = new WingmenChoice("auto", []);
    const before = choice.request(CONTEXT).seed;
    choice.shuffle();
    expect(choice.request(CONTEXT).seed).not.toBe(before);
  });

  it("starts CUSTOM from the squad that would fly now", () => {
    const choice = new WingmenChoice("auto", []);
    choice.choose("custom", AUTO_PLAN);
    expect(choice.type).toBe("custom");
    expect(choice.snapshot().custom).toEqual(AUTO_PLAN.ships.slice(1));
  });

  it("keeps an earlier CUSTOM list when CUSTOM is chosen again", () => {
    const choice = new WingmenChoice("auto", ["terran_gladius"]);
    choice.choose("custom", AUTO_PLAN);
    expect(choice.snapshot().custom).toEqual(["terran_gladius"]);
  });

  it("takes the picked squad as the wingmen, leaving out the flagship", () => {
    const choice = new WingmenChoice("auto", []);
    choice.applyPicked("terran_gladius", ["terran_viper", "terran_gladius", "terran_gladius"], { "0": "a", "2": "b" });
    const snapshot = choice.snapshot();
    expect(snapshot.type).toBe("custom");
    expect(snapshot.custom).toEqual(["terran_viper", "terran_gladius"]);
    expect(snapshot.customLoadouts).toEqual({ "0": "a", "1": "b" });
  });

  it("drops the first ship when the flagship is not in the picked squad", () => {
    const choice = new WingmenChoice("auto", []);
    choice.applyPicked("terran_gladius", ["terran_viper", "terran_gladius"], {});
    expect(choice.snapshot().custom).toEqual(["terran_viper"]);
    choice.applyPicked("x", ["a", "b"], {});
    expect(choice.snapshot().custom).toEqual(["b"]);
  });

  it("forgets the picked ships and leaves CUSTOM on a faction change", () => {
    const choice = new WingmenChoice("custom", ["terran_gladius"]);
    choice.resetForFaction();
    expect(choice.snapshot()).toEqual({ type: "auto", custom: [], customLoadouts: {} });
    const strikers = new WingmenChoice("strikers", []);
    strikers.resetForFaction();
    expect(strikers.type).toBe("strikers");
  });
});
