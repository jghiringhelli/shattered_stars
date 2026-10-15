import { describe, it, expect } from "vitest";
import {
  codeToSeed,
  deriveSeed,
  rngFor,
  seedToCode,
} from "../../../../src/systems/survival/RunRng";
import {
  addEscort,
  createRun,
  adjustFleetHull,
  EVENT_HULL_FLOOR,
  enterSector,
  FREE_STARTING_ESCORTS,
  removeEscort,
  upgradeShip,
  withLog,
} from "../../../../src/systems/survival/RunState";
import { MAX_ESCORTS } from "../../../../src/data/survival/escorts";
import { getRelic } from "../../../../src/data/survival/relicCatalog";
import {
  FACTION_STARTER_SHIPS,
  NO_STARTER_KIT,
  STARTER_KITS,
  starterKitOf,
} from "../../../../src/data/survival/starters";
import type { FactionId } from "../../../../src/config";
import {
  MAX_SHIP_UPGRADES,
  STARTING_SALVAGE,
} from "../../../../src/data/survival/economy";
import { RUN_LOG_LIMIT } from "../../../../src/systems/survival/RunTypes";
import { RunBuilder } from "./survivalRunBuilder";

describe("RunRng", () => {
  it("derives a stable seed per purpose and different seeds per purpose", () => {
    expect(deriveSeed(5, "draft", "n1")).toBe(deriveSeed(5, "draft", "n1"));
    expect(deriveSeed(5, "draft", "n1")).not.toBe(deriveSeed(5, "draft", "n2"));
    expect(deriveSeed(5, "draft", "n1")).not.toBe(deriveSeed(6, "draft", "n1"));
  });

  it("gives identical sequences for the same purpose", () => {
    const a = rngFor(9, "x");
    const b = rngFor(9, "x");
    expect([a.next(), a.next()]).toEqual([b.next(), b.next()]);
  });

  it("round-trips seed codes, case-insensitively", () => {
    for (const seed of [0, 1, 123456789, 0xffffffff]) {
      expect(codeToSeed(seedToCode(seed))).toBe(seed);
      expect(codeToSeed(seedToCode(seed).toLowerCase())).toBe(seed);
    }
  });

  it("rejects empty, too long or non-alphanumeric codes", () => {
    expect(codeToSeed("")).toBeNull();
    expect(codeToSeed("ABCDEFGH")).toBeNull();
    expect(codeToSeed("AB-12")).toBeNull();
    expect(codeToSeed("ZZZZZZZ")).toBeNull();
  });
});

describe("createRun", () => {
  it("starts in sector 1 at no node with starting salvage, an intact flagship and its free wingman", () => {
    const run = RunBuilder.aRun().build();
    expect(run.sector).toBe(1);
    expect(run.currentNodeId).toBeNull();
    expect(run.salvage).toBe(STARTING_SALVAGE);
    expect(run.flagship).toMatchObject({
      definitionId: "terran_viper",
      hull: 1,
      shields: 1,
      upgrades: 0,
    });
    expect(run.escorts).toHaveLength(FREE_STARTING_ESCORTS);
    expect(run.pools).toEqual(["base"]);
  });

  it("gives every run one escort wingman: a fresh faction starter fighter", () => {
    expect(FREE_STARTING_ESCORTS).toBe(1);
    for (const faction of Object.keys(FACTION_STARTER_SHIPS) as FactionId[]) {
      const run = RunBuilder.aRun().withFaction(faction).build();
      expect(run.escorts).toHaveLength(1);
      expect(run.escorts[0]).toMatchObject({
        definitionId: FACTION_STARTER_SHIPS[faction],
        hull: 1,
        shields: 1,
        upgrades: 0,
      });
      expect(run.progression.escorts).toBe(1);
    }
  });

  it("applies meta unlocks: escort packages on top of the free wingman, war chest, relic pools", () => {
    const run = RunBuilder.aRun()
      .withUnlocks(
        "wingmate_package",
        "twin_wing_package",
        "war_chest",
        "ace_pack",
      )
      .build();
    expect(run.escorts).toHaveLength(FREE_STARTING_ESCORTS + 2);
    expect(run.progression.escorts).toBe(FREE_STARTING_ESCORTS + 2);
    expect(run.salvage).toBe(STARTING_SALVAGE + 30);
    expect(run.pools).toEqual(["base", "ace_pack"]);
  });

  it("counts the free wingman toward the escort cap", () => {
    let run = RunBuilder.aRun().withUnlocks("twin_wing_package").build();
    for (let i = 0; i < MAX_ESCORTS; i++) run = addEscort(run);
    expect(run.escorts).toHaveLength(MAX_ESCORTS);
  });

  it("clamps ascension to 0..10", () => {
    expect(RunBuilder.aRun().withAscension(42).build().ascension).toBe(10);
    expect(RunBuilder.aRun().withAscension(-3).build().ascension).toBe(0);
  });
});

describe("starter kits", () => {
  const newRun = (flagshipId: string) =>
    createRun({
      seed: 1,
      faction: "terran_hegemony",
      flagshipId,
      loadoutId: null,
      ascension: 0,
      unlocked: [],
      now: 0,
    });

  it("gives a flagship without a kit nothing extra", () => {
    const run = newRun("terran_viper");
    expect(starterKitOf("terran_viper")).toEqual(NO_STARTER_KIT);
    expect(run.flagship.upgrades).toBe(0);
    expect(run.relics).toEqual([]);
    expect(run.salvage).toBe(STARTING_SALVAGE);
    expect(run.escorts).toHaveLength(FREE_STARTING_ESCORTS);
  });

  it("applies every kit: upgrade levels, extra escorts, relic and salvage", () => {
    for (const [flagshipId, kit] of Object.entries(STARTER_KITS)) {
      const run = newRun(flagshipId);
      expect(run.flagship.upgrades).toBe(kit.upgrades);
      expect(run.escorts).toHaveLength(FREE_STARTING_ESCORTS + kit.escorts);
      expect(run.relics).toEqual(kit.relicId ? [kit.relicId] : []);
      expect(run.salvage).toBe(STARTING_SALVAGE + kit.salvage);
    }
  });

  it("keeps every kit within the shop's upgrade cap and the wing cap and names real relics", () => {
    for (const kit of Object.values(STARTER_KITS)) {
      expect(kit.upgrades).toBeLessThanOrEqual(MAX_SHIP_UPGRADES);
      expect(FREE_STARTING_ESCORTS + kit.escorts).toBeLessThanOrEqual(
        MAX_ESCORTS,
      );
      if (kit.relicId) expect(getRelic(kit.relicId)).toBeDefined();
    }
  });
});

describe("fleet updates", () => {
  it("repairs hull up to full and damages it without ever killing a ship", () => {
    const run = RunBuilder.aRun().build();
    const hurt = adjustFleetHull(run, -2);
    expect(hurt.flagship.hull).toBe(EVENT_HULL_FLOOR);
    expect(adjustFleetHull(hurt, 0.3).flagship.hull).toBeCloseTo(
      EVENT_HULL_FLOOR + 0.3,
    );
    expect(adjustFleetHull(hurt, 5).flagship.hull).toBe(1);
  });

  it("caps escorts at MAX_ESCORTS and keeps the progression count in sync", () => {
    let run = RunBuilder.aRun().build();
    for (let i = 0; i < MAX_ESCORTS + 3; i++) run = addEscort(run);
    expect(run.escorts).toHaveLength(MAX_ESCORTS);
    expect(run.progression.escorts).toBe(MAX_ESCORTS);
    run = removeEscort(run);
    expect(run.progression.escorts).toBe(MAX_ESCORTS - 1);
  });

  it("caps ship upgrades at MAX_SHIP_UPGRADES", () => {
    let run = RunBuilder.aRun().build();
    for (let i = 0; i < MAX_SHIP_UPGRADES + 2; i++) run = upgradeShip(run, 0);
    expect(run.flagship.upgrades).toBe(MAX_SHIP_UPGRADES);
  });

  it("keeps only the newest log messages", () => {
    let run = RunBuilder.aRun().build();
    for (let i = 0; i < RUN_LOG_LIMIT + 4; i++) run = withLog(run, `m${i}`);
    expect(run.log).toHaveLength(RUN_LOG_LIMIT);
    expect(run.log.at(-1)).toBe(`m${RUN_LOG_LIMIT + 3}`);
  });
});

describe("enterSector", () => {
  it("draws the next sector's map and grants per-sector rerolls from Loaded Dice", () => {
    const run = RunBuilder.aRun()
      .with({
        relics: ["loaded_dice"],
        rerolls: 0,
        currentNodeId: "x",
        path: ["x"],
      })
      .build();
    const next = enterSector(run, 2);
    expect(next.sector).toBe(2);
    expect(next.map.sector).toBe(2);
    expect(next.currentNodeId).toBeNull();
    expect(next.path).toEqual([]);
    expect(next.rerolls).toBe(2);
  });
});
