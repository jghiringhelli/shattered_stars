import { describe, expect, it } from "vitest";
import { createMemoryStore } from "../../../../src/systems/keyValueStore";
import {
  MAX_SAVED_SQUADS,
  SHARE_CODE_PREFIX,
  decodeSquadCode,
  deleteSavedSquad,
  encodeSquadCode,
  listSavedSquads,
  saveSquad,
  type FactionOfShip,
} from "../../../../src/systems/setup/squadShare";

const FACTIONS: Record<string, string> = {
  a1: "alpha",
  a2: "alpha",
  b1: "beta",
};
const factionOf: FactionOfShip = (id) => FACTIONS[id];
const SQUAD = {
  factionId: "alpha",
  ships: ["a1", "a2"],
  loadoutChoices: { "1": "build" },
};

function codeOf(payload: unknown): string {
  return SHARE_CODE_PREFIX + btoa(JSON.stringify(payload));
}

describe("squad share codes", () => {
  it("round-trips a squad", () => {
    expect(decodeSquadCode(encodeSquadCode(SQUAD), factionOf)).toEqual({
      squad: SQUAD,
    });
  });

  it("tolerates whitespace around a pasted code", () => {
    const decoded = decodeSquadCode(
      `\n ${encodeSquadCode(SQUAD)} \n`,
      factionOf,
    );
    expect("squad" in decoded).toBe(true);
  });

  it("rejects text that is not a code", () => {
    expect(decodeSquadCode("hello", factionOf)).toEqual({
      error: "Not a squad code",
    });
    expect(
      "error" in decodeSquadCode(SHARE_CODE_PREFIX + "%%%", factionOf),
    ).toBe(true);
  });

  it("rejects an unknown ship and a ship of another faction", () => {
    expect(
      decodeSquadCode(codeOf({ v: 1, f: "alpha", s: ["zz"] }), factionOf),
    ).toEqual({
      error: "Unknown ship: zz",
    });
    expect(
      "error" in
        decodeSquadCode(
          codeOf({ v: 1, f: "alpha", s: ["a1", "b1"] }),
          factionOf,
        ),
    ).toBe(true);
  });

  it("rejects empty, oversized and badly typed squads", () => {
    expect(
      "error" in
        decodeSquadCode(codeOf({ v: 1, f: "alpha", s: [] }), factionOf),
    ).toBe(true);
    const many = Array.from({ length: 50 }, () => "a1");
    expect(
      "error" in
        decodeSquadCode(codeOf({ v: 1, f: "alpha", s: many }), factionOf),
    ).toBe(true);
    expect(
      "error" in
        decodeSquadCode(codeOf({ v: 1, f: "alpha", s: [3] }), factionOf),
    ).toBe(true);
    expect(
      "error" in
        decodeSquadCode(codeOf({ v: 2, f: "alpha", s: ["a1"] }), factionOf),
    ).toBe(true);
  });

  it("rejects loadout picks for ships that are not in the squad", () => {
    const code = codeOf({ v: 1, f: "alpha", s: ["a1"], l: { "5": "x" } });
    expect("error" in decodeSquadCode(code, factionOf)).toBe(true);
  });
});

describe("saved squads", () => {
  it("saves, lists newest first and deletes", () => {
    const store = createMemoryStore();
    saveSquad("First", SQUAD, store, () => 1, factionOf);
    saveSquad("Second", SQUAD, store, () => 2, factionOf);
    const listed = listSavedSquads(store, factionOf);
    expect(listed.map((s) => s.name)).toEqual(["Second", "First"]);
    const after = deleteSavedSquad(listed[0]!.id, store, factionOf);
    expect(after.map((s) => s.name)).toEqual(["First"]);
  });

  it("replaces a squad saved under the same name", () => {
    const store = createMemoryStore();
    saveSquad("Aces", SQUAD, store, () => 1, factionOf);
    saveSquad(
      "aces",
      { ...SQUAD, ships: ["a1"], loadoutChoices: {} },
      store,
      () => 2,
      factionOf,
    );
    const listed = listSavedSquads(store, factionOf);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.squad.ships).toEqual(["a1"]);
  });

  it("refuses an empty name", () => {
    expect(
      saveSquad("   ", SQUAD, createMemoryStore(), Date.now, factionOf),
    ).toEqual({
      error: "Give the squad a name",
    });
  });

  it("keeps at most the library capacity, dropping the oldest", () => {
    const store = createMemoryStore();
    for (let i = 0; i < MAX_SAVED_SQUADS + 3; i++) {
      saveSquad(`S${i}`, SQUAD, store, () => i + 1, factionOf);
    }
    const listed = listSavedSquads(store, factionOf);
    expect(listed).toHaveLength(MAX_SAVED_SQUADS);
    expect(listed.at(-1)?.name).toBe("S3");
  });

  it("drops entries whose ships no longer exist", () => {
    const store = createMemoryStore();
    saveSquad("Old", SQUAD, store, () => 1, factionOf);
    expect(listSavedSquads(store, () => undefined)).toEqual([]);
  });

  it("reads a corrupt library as empty", () => {
    const store = createMemoryStore();
    store.setItem("ss_saved_squads_v1", "[[");
    expect(listSavedSquads(store, factionOf)).toEqual([]);
  });
});
