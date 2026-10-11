/**
 * Spec: sortie briefings — terse, mood-driven, deterministic codenames,
 * ≤ 3 s by default, one-line objectives, and a procedural stinger that
 * finishes inside the card's lifetime.
 */

import { describe, it, expect } from "vitest";
import {
  BRIEFING_STINGERS,
  MAX_SORTIE_BRIEFING_MS,
  SORTIE_BRIEFING_MS,
  aceDuelBriefing,
  codenameFor,
  dogfightBriefing,
  raidBriefing,
  threatLabel,
  type SortieBriefing,
} from "../../../../src/ui/briefing/sortieBriefing";

const MAX_OBJECTIVE_CHARS = 60;

function terse(briefing: SortieBriefing): void {
  expect(briefing.objective.length).toBeLessThanOrEqual(MAX_OBJECTIVE_CHARS);
  expect(briefing.objective).not.toContain("\n");
  expect(briefing.intel.length).toBeGreaterThan(0);
  expect(briefing.intel.length).toBeLessThanOrEqual(3);
}

describe("timing", () => {
  it("shows for at most 3 seconds by default", () => {
    expect(SORTIE_BRIEFING_MS).toBeLessThanOrEqual(MAX_SORTIE_BRIEFING_MS);
    expect(MAX_SORTIE_BRIEFING_MS).toBe(3000);
  });

  it("every stinger finishes before the card launches", () => {
    for (const notes of Object.values(BRIEFING_STINGERS)) {
      expect(notes.length).toBeGreaterThan(0);
      for (const note of notes) {
        expect(note.atMs).toBeLessThan(SORTIE_BRIEFING_MS);
        expect(note.volume).toBeGreaterThan(0);
        expect(note.volume).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("codenameFor", () => {
  it("is deterministic for the same sortie", () => {
    expect(codenameFor("dogfight:a:b")).toBe(codenameFor("dogfight:a:b"));
  });

  it("reads as OPERATION + two words", () => {
    expect(codenameFor("raid:x")).toMatch(/^OPERATION [A-Z]+ [A-Z]+$/);
  });

  it("varies across sorties", () => {
    const names = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h"].map((s) => codenameFor(s)),
    );
    expect(names.size).toBeGreaterThan(4);
  });
});

describe("threatLabel", () => {
  it("names every difficulty tersely", () => {
    expect(threatLabel("easy")).toBe("ROOKIE");
    expect(threatLabel("brutal")).toBe("LEGEND");
  });
});

describe("dogfightBriefing", () => {
  const briefing = dogfightBriefing({
    playerShip: "Falcon",
    enemyShip: "Raptor",
    enemyFaction: "Terran Hegemony",
    difficulty: "hard",
    roundsToWin: 2,
  });

  it("is terse and tense", () => {
    terse(briefing);
    expect(briefing.mood).toBe("tense");
    expect(briefing.mode).toBe("DOGFIGHT");
  });

  it("names the contact and the threat", () => {
    expect(briefing.intel.join(" ")).toContain("RAPTOR");
    expect(briefing.intel.join(" ")).toContain("ACE");
    expect(briefing.objective).toContain("2");
  });
});

describe("aceDuelBriefing", () => {
  const briefing = aceDuelBriefing({
    matchupName: "Elite Fighters",
    playerAce: "Phoenix Commander",
    rivalAce: "Admiral Kronos",
    rivalShips: ["Raptor"],
    difficulty: "normal",
  });

  it("is terse and a rivalry", () => {
    terse(briefing);
    expect(briefing.mood).toBe("rivalry");
    expect(briefing.objective).toContain("ADMIRAL KRONOS");
  });
});

describe("raidBriefing", () => {
  const briefing = raidBriefing({
    bossName: "Dreadnought Imperator",
    bossFaction: "Terran Hegemony",
    difficulty: "mythic",
    clockMs: 720_000,
    escorts: 6,
  });

  it("is terse and dread", () => {
    terse(briefing);
    expect(briefing.mood).toBe("dread");
    expect(briefing.mode).toBe("BOSS RAID");
  });

  it("states the clock in minutes and the escorts", () => {
    const intel = briefing.intel.join(" ");
    expect(intel).toContain("12 MIN");
    expect(intel).toContain("6 ESCORTS");
    expect(intel).toContain("MYTHIC");
  });
});
