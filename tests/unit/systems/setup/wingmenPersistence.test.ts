/**
 * Spec: the WINGMEN choice survives in share codes (old codes without it
 * still decode, and read as "no choice") and in the remembered builder
 * (older documents without it still load).
 */

import { describe, expect, it } from "vitest";
import { createMemoryStore } from "../../../../src/systems/keyValueStore";
import {
  SHARE_CODE_PREFIX,
  decodeSquadCode,
  encodeSquadCode,
  listSavedSquads,
  saveSquad,
  type FactionOfShip,
} from "../../../../src/systems/setup/squadShare";
import {
  SETUP_MEMORY_KEY,
  SETUP_MEMORY_VERSION,
  loadBuilderMemory,
  saveBuilderMemory,
  type BuilderMemory,
} from "../../../../src/systems/setup/setupMemory";
import { WINGMEN_TYPES } from "../../../../src/systems/setup/wingmen";

const FACTIONS: Record<string, string> = { a1: "alpha", a2: "alpha", b1: "beta" };
const factionOf: FactionOfShip = (id) => FACTIONS[id];
const SQUAD = { factionId: "alpha", ships: ["a1", "a2"], loadoutChoices: { "1": "build" } };

function codeOf(payload: unknown): string {
  return SHARE_CODE_PREFIX + btoa(JSON.stringify(payload));
}

describe("share code with a wingmen choice", () => {
  for (const wingmen of WINGMEN_TYPES) {
    it(`round-trips ${wingmen}`, () => {
      const decoded = decodeSquadCode(encodeSquadCode({ ...SQUAD, wingmen }), factionOf);
      expect(decoded).toEqual({ squad: { ...SQUAD, wingmen } });
    });
  }

  it("decodes a code made before the choice existed, without one", () => {
    const old = codeOf({ v: 1, f: "alpha", s: ["a1", "a2"], l: { "1": "build" } });
    const decoded = decodeSquadCode(old, factionOf);
    expect(decoded).toEqual({ squad: SQUAD });
    expect("squad" in decoded && "wingmen" in decoded.squad).toBe(false);
  });

  it("keeps writing codes older builds can read (same version, same fields plus w)", () => {
    const code = encodeSquadCode({ ...SQUAD, wingmen: "strikers" });
    const payload = JSON.parse(atob(code.slice(SHARE_CODE_PREFIX.length))) as Record<string, unknown>;
    expect(payload).toMatchObject({ v: 1, f: "alpha", s: ["a1", "a2"], w: "strikers" });
  });

  it("writes no w field when the squad has no choice", () => {
    const payload = JSON.parse(atob(encodeSquadCode(SQUAD).slice(SHARE_CODE_PREFIX.length))) as Record<string, unknown>;
    expect("w" in payload).toBe(false);
  });

  it("ignores an unknown wingmen value instead of rejecting the code", () => {
    const code = codeOf({ v: 1, f: "alpha", s: ["a1"], w: "swarm" });
    expect(decodeSquadCode(code, factionOf)).toEqual({
      squad: { factionId: "alpha", ships: ["a1"], loadoutChoices: {} },
    });
  });

  it("saves and lists a squad with its choice", () => {
    const store = createMemoryStore();
    saveSquad("Fighters", { ...SQUAD, wingmen: "fighters" }, store, () => 5, factionOf);
    expect(listSavedSquads(store, factionOf)[0]?.squad.wingmen).toBe("fighters");
  });
});

const BUILDER: BuilderMemory = {
  pointLimit: 200,
  aiDifficulty: "normal",
  simpleMode: true,
  squads: [
    { factionId: "terran_hegemony", controller: "player", teamId: 1, ships: ["terran_gladius"], loadoutChoices: {} },
  ],
};

describe("setup memory with a wingmen choice", () => {
  it("remembers the choice and the custom wingmen", () => {
    const store = createMemoryStore();
    saveBuilderMemory("arcade", { ...BUILDER, wingmen: "support_heavy", customWingmen: ["a", "b"] }, store);
    const loaded = loadBuilderMemory("arcade", store);
    expect(loaded?.wingmen).toBe("support_heavy");
    expect(loaded?.customWingmen).toEqual(["a", "b"]);
  });

  it("loads a document saved before the choice existed", () => {
    const store = createMemoryStore();
    store.setItem(
      SETUP_MEMORY_KEY,
      JSON.stringify({ version: SETUP_MEMORY_VERSION, builders: { arcade: BUILDER }, modes: {} }),
    );
    const loaded = loadBuilderMemory("arcade", store);
    expect(loaded).toEqual(BUILDER);
    expect(loaded && "wingmen" in loaded).toBe(false);
  });

  it("drops an unknown choice and keeps the rest of the builder", () => {
    const store = createMemoryStore();
    store.setItem(
      SETUP_MEMORY_KEY,
      JSON.stringify({
        version: SETUP_MEMORY_VERSION,
        builders: { arcade: { ...BUILDER, wingmen: "swarm", customWingmen: ["x", 3] } },
        modes: {},
      }),
    );
    const loaded = loadBuilderMemory("arcade", store);
    expect(loaded?.pointLimit).toBe(200);
    expect(loaded && "wingmen" in loaded).toBe(false);
    expect(loaded && "customWingmen" in loaded).toBe(false);
  });
});
