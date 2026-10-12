/**
 * Spec: which music a game situation calls for.
 *
 * - Survival: sector bosses → boss; belt-heavy nodes → hazard; else skirmish.
 * - Campaign: boss missions → boss; hazard missions → hazard; else skirmish.
 * - Survival map: the shop plays the cantina, travel plays Long Haul.
 * - Low hull raises the Shields Low tension layer, with hysteresis so it
 *   does not flap around the threshold.
 * - Any battle's flagship hull feeds it (a lost flagship reads as 0 hull).
 * - A boss at or under Boss Raid's critical-phase hull ratio is in its final
 *   phase (Campaign bosses have no scripted phases).
 */

import { describe, it, expect } from "vitest";
import {
  BELT_HEAVY_STEPS,
  TENSION_ENTER_HULL_FRACTION,
  TENSION_EXIT_HULL_FRACTION,
  bossFinalPhase,
  campaignBattleMode,
  hullFractionOf,
  nextLowHullTension,
  survivalBattleMode,
  survivalMapMusic,
} from "../../../src/audio/musicContexts";
import { BOSS_PHASE_3_HULL_RATIO } from "../../../src/systems/EpicBossRules";

describe("flagship hull fraction", () => {
  it("is hull over max hull", () => {
    expect(hullFractionOf({ hull: 30, maxHull: 120 })).toBe(0.25);
  });

  it("reads a lost flagship as no hull (tension released)", () => {
    expect(hullFractionOf(null)).toBe(0);
  });

  it("reads a ship without max hull as no hull", () => {
    expect(hullFractionOf({ hull: 5, maxHull: 0 })).toBe(0);
  });
});

describe("boss final phase", () => {
  const boss = (hull: number) => ({ hull, maxHull: 100, tags: ["boss"] });

  it("is on once a living boss reaches the critical-phase hull ratio", () => {
    expect(bossFinalPhase([boss(BOSS_PHASE_3_HULL_RATIO * 100)])).toBe(true);
  });

  it("is off while every boss is above it", () => {
    expect(bossFinalPhase([boss(BOSS_PHASE_3_HULL_RATIO * 100 + 1)])).toBe(
      false,
    );
  });

  it("ignores destroyed bosses", () => {
    expect(bossFinalPhase([boss(0)])).toBe(false);
  });

  it("ignores ships that are not bosses", () => {
    expect(bossFinalPhase([{ hull: 1, maxHull: 100, tags: ["ace"] }])).toBe(
      false,
    );
  });
});

describe("survival battle music", () => {
  it("plays the boss track at sector bosses, even in a dense belt", () => {
    expect(survivalBattleMode({ kind: "boss", beltSteps: 0 })).toBe("boss");
    expect(survivalBattleMode({ kind: "boss", beltSteps: 12 })).toBe("boss");
  });

  it("plays the asteroid track once the belt starts heavily squeezed", () => {
    expect(
      survivalBattleMode({ kind: "combat", beltSteps: BELT_HEAVY_STEPS }),
    ).toBe("hazard");
    expect(
      survivalBattleMode({ kind: "elite", beltSteps: BELT_HEAVY_STEPS + 3 }),
    ).toBe("hazard");
  });

  it("plays skirmish music in ordinary nodes", () => {
    expect(
      survivalBattleMode({ kind: "combat", beltSteps: BELT_HEAVY_STEPS - 1 }),
    ).toBe("skirmish");
  });
});

describe("campaign battle music", () => {
  it("plays the boss track when the mission fields a boss", () => {
    expect(
      campaignBattleMode({
        enemies: [{}, { isBoss: true }],
        hazards: [{ kind: "minefield" }],
      }),
    ).toBe("boss");
  });

  it("plays the asteroid track in hazard missions", () => {
    expect(
      campaignBattleMode({
        enemies: [{}],
        hazards: [{ kind: "asteroid_belt" }],
      }),
    ).toBe("hazard");
  });

  it("plays skirmish music otherwise", () => {
    expect(campaignBattleMode({ enemies: [{ isBoss: false }] })).toBe(
      "skirmish",
    );
    expect(campaignBattleMode({ enemies: [], hazards: [] })).toBe("skirmish");
  });
});

describe("survival map music", () => {
  it("plays the cantina in the shop", () => {
    expect(survivalMapMusic("shop")).toBe("survival_shop");
  });

  it("plays Long Haul while travelling the sector map", () => {
    expect(survivalMapMusic(null)).toBe("long_haul");
    expect(survivalMapMusic("repair")).toBe("long_haul");
    expect(survivalMapMusic("event")).toBe("long_haul");
  });
});

describe("low-hull tension", () => {
  it("raises tension at the entry threshold", () => {
    expect(nextLowHullTension(false, TENSION_ENTER_HULL_FRACTION)).toBe(true);
    expect(nextLowHullTension(false, TENSION_ENTER_HULL_FRACTION + 0.01)).toBe(
      false,
    );
  });

  it("holds tension until the hull recovers past the exit threshold", () => {
    expect(nextLowHullTension(true, TENSION_EXIT_HULL_FRACTION)).toBe(true);
    expect(nextLowHullTension(true, TENSION_EXIT_HULL_FRACTION + 0.01)).toBe(
      false,
    );
  });

  it("does not raise tension for a destroyed flagship (battle is over)", () => {
    expect(nextLowHullTension(false, 0)).toBe(false);
  });
});
