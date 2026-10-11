import { describe, expect, it } from "vitest";
import {
  addEntry,
  battleSetupSummary,
  moveEntry,
  removeEntry,
  reserveForBattle,
  reserveTotal,
  formatOfMode,
} from "../../../../src/ui/squad/reserveEditorModel";
import {
  DEFAULT_REINFORCEMENT_PREFS,
  MAX_RESERVE_ENTRIES,
  buildReserve,
  toDeployOption,
} from "../../../../src/arcade/reinforcements";

const wasp = { definitionId: "confed_wasp", loadoutId: null };
const kestrel = { definitionId: "confed_kestrel", loadoutId: null };
const finch = { definitionId: "confed_finch", loadoutId: null };

describe("reserve editor model", () => {
  it("moves an entry up or down, clamped at the ends", () => {
    expect(moveEntry([wasp, kestrel, finch], 2, -1)).toEqual([
      wasp,
      finch,
      kestrel,
    ]);
    expect(moveEntry([wasp, kestrel], 0, -1)).toEqual([wasp, kestrel]);
    expect(moveEntry([wasp, kestrel], 1, 1)).toEqual([wasp, kestrel]);
  });

  it("removes an entry", () => {
    expect(removeEntry([wasp, kestrel, finch], 1)).toEqual([wasp, finch]);
  });

  it("adds at the end, up to the maximum length", () => {
    expect(addEntry([wasp], kestrel)).toEqual([wasp, kestrel]);
    const full = Array.from({ length: MAX_RESERVE_ENTRIES }, () => wasp);
    expect(addEntry(full, kestrel)).toBe(full);
  });

  it("totals the reserve's cost", () => {
    expect(reserveTotal([wasp, kestrel])).toBe(
      toDeployOption(wasp)!.cost + toDeployOption(kestrel)!.cost,
    );
  });

  it("maps Squad Builder modes to reinforcement formats", () => {
    expect(formatOfMode("arcade", false)).toBe("skirmish");
    expect(formatOfMode("arcade", true)).toBe("scenario");
    expect(formatOfMode("epic", false)).toBe("epic");
    expect(formatOfMode("survival", false)).toBeNull();
    expect(formatOfMode("online", false)).toBeNull();
  });

  it("keeps a reserve built for the same faction, rebuilds it for another", () => {
    const prefs = {
      ...DEFAULT_REINFORCEMENT_PREFS,
      factionId: "free_confederation" as const,
      reserve: [wasp, kestrel],
    };
    expect(reserveForBattle(prefs, "free_confederation", "skirmish")).toEqual([
      wasp,
      kestrel,
    ]);
    expect(reserveForBattle(prefs, "void_corsairs", "skirmish")).toEqual(
      buildReserve("void_corsairs", "balanced", 1000, "skirmish"),
    );
  });

  it("summarises the setup in one line", () => {
    expect(
      battleSetupSummary(
        { ...DEFAULT_REINFORCEMENT_PREFS, reserve: [wasp, kestrel] },
        "skirmish",
      ),
    ).toBe("POOL 1000 · 250 ON FIELD · BALANCED · 2 IN RESERVE");
    expect(
      battleSetupSummary(
        { ...DEFAULT_REINFORCEMENT_PREFS, battle: "classic" },
        "skirmish",
      ),
    ).toBe("ONE SQUAD · NO REINFORCEMENTS");
  });
});
