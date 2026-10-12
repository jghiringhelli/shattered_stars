/**
 * ArcadeBotFleet — specification: the Skirmish AI flies skill-gate bots at
 * the battle's difficulty, squads coordinate and mark, the player's side
 * marks only by the player's hand, and lone ships fly without a mark.
 */

import { describe, it, expect } from "vitest";
import {
  ArcadeBotFleet,
  WINGMAN_SKILL,
} from "../../../../src/scenes/arcadeBattle/ArcadeBotFleet";
import {
  BRUTAL_REACTION_SCALE,
  type BotContact,
} from "../../../../src/arcade/ai";
import { createCycleFlight } from "../../../../src/arcade/systems/CycleFlight";
import { getShipDial } from "../../../../src/data/ShipDefinitions";
import { createSeededRng } from "../../../../src/utils/random";

const WORLD = 6000;
const PLAYER = "free_confederation";
const ENEMY = "void_corsairs";
const TICK_MS = 1000 / 60;

/** A ship as the AI sees it, with sensible defaults. */
function contact(
  id: string,
  side: string,
  x: number,
  y: number,
  angle = 0,
): BotContact {
  return {
    id,
    side,
    definitionId: side === PLAYER ? "confed_kestrel" : "corsair_venom",
    x,
    y,
    angle,
    alive: true,
    hull: 24,
    maxHull: 24,
    shields: 0,
    maxShields: 0,
    firingArcDeg: 60,
    weaponRange: 1200,
    speed: 2,
  };
}

/** The player + two wingmen to the south, three enemies to the north. */
const SQUADS: readonly BotContact[] = [
  contact("player_0", PLAYER, 3000, 3500),
  contact("ally_0", PLAYER, 2800, 3600),
  contact("ally_1", PLAYER, 3200, 3600),
  contact("enemy_0", ENEMY, 2800, 2500, 180),
  contact("enemy_1", ENEMY, 3000, 2400, 180),
  contact("enemy_2", ENEMY, 3200, 2500, 180),
];

function fleetAt(difficulty: string): ArcadeBotFleet {
  return new ArcadeBotFleet({
    difficulty,
    playerFaction: PLAYER,
    random: createSeededRng(7).next,
    worldSize: WORLD,
  });
}

/** Runs the squad layer for a while (perception needs history). */
function commandFor(
  fleet: ArcadeBotFleet,
  contacts: readonly BotContact[],
  untilMs: number,
  fromMs = 0,
): void {
  for (let t = fromMs; t <= untilMs; t += TICK_MS) fleet.command(t, contacts);
}

describe("ArcadeBotFleet tiers", () => {
  it.each([
    ["easy", "novice"],
    ["normal", "average"],
    ["hard", "expert"],
    ["brutal", "expert"],
  ])("enemy pilots fly %s as %s", (difficulty, tier) => {
    const fleet = fleetAt(difficulty);
    fleet.enlist("enemy_0", ENEMY);
    expect(fleet.tierOf("enemy_0")).toBe(tier);
  });

  it("gives brutal pilots the faster reaction", () => {
    expect(fleetAt("brutal").skillFor(ENEMY).reactionScale).toBe(
      BRUTAL_REACTION_SCALE,
    );
    expect(fleetAt("hard").skillFor(ENEMY).reactionScale).toBeGreaterThan(
      BRUTAL_REACTION_SCALE,
    );
  });

  it("flies an unknown difficulty as the average pilot", () => {
    const fleet = fleetAt("legendary");
    fleet.enlist("enemy_0", ENEMY);
    expect(fleet.tierOf("enemy_0")).toBe("average");
  });

  it.each(["easy", "brutal"])(
    "flies the player's wingmen as the wingman tier on %s",
    (difficulty) => {
      const fleet = fleetAt(difficulty);
      fleet.enlist("ally_0", PLAYER);
      expect(fleet.tierOf("ally_0")).toBe(WINGMAN_SKILL.tier);
    },
  );

  it("has no tier for a ship without an AI pilot", () => {
    expect(fleetAt("normal").tierOf("player_0")).toBeNull();
  });
});

describe("ArcadeBotFleet squads and marks", () => {
  it("lets an AI squad mark its focus", () => {
    const fleet = fleetAt("normal");
    commandFor(fleet, SQUADS, 1000);
    const marked = fleet.markedTargetOf(ENEMY, 1000);
    expect(marked).not.toBeNull();
    expect(SQUADS.find((s) => s.id === marked)?.side).toBe(PLAYER);
  });

  it("has the player's wingmen mark their own focus while the player has none", () => {
    const fleet = fleetAt("normal");
    commandFor(fleet, SQUADS, 1000);
    const focus = fleet.orderFor("ally_0", PLAYER)?.focusTargetId ?? null;
    expect(focus).not.toBeNull();
    expect(fleet.markedTargetOf(PLAYER, 1000)).toBe(focus);
  });

  it("a novice enemy squad focuses without marking", () => {
    const fleet = fleetAt("easy");
    commandFor(fleet, SQUADS, 1000);
    expect(fleet.orderFor("enemy_0", ENEMY)?.focusTargetId).not.toBeNull();
    expect(fleet.markedTargetOf(ENEMY, 1000)).toBeNull();
  });

  it("has the wingmen focus the target the player marked", () => {
    const fleet = fleetAt("normal");
    commandFor(fleet, SQUADS, 500);
    fleet.markTarget(PLAYER, "enemy_2", 500);
    commandFor(fleet, SQUADS, 1500, 500 + TICK_MS);
    expect(fleet.isMarkedBy(PLAYER, "enemy_2", 1500)).toBe(true);
    expect(fleet.orderFor("ally_0", PLAYER)?.focusTargetId).toBe("enemy_2");
    expect(fleet.orderFor("ally_1", PLAYER)?.focusTargetId).toBe("enemy_2");
  });

  it("names the squad focus as an AI ship's target before its pilot decides", () => {
    const fleet = fleetAt("normal");
    fleet.enlist("ally_0", PLAYER);
    commandFor(fleet, SQUADS, 500);
    fleet.markTarget(PLAYER, "enemy_1", 500);
    commandFor(fleet, SQUADS, 1500, 500 + TICK_MS);
    expect(fleet.targetIdFor("ally_0", PLAYER)).toBe("enemy_1");
  });

  it("gives a lone ship no orders and no mark", () => {
    const duel = [
      contact("player_0", PLAYER, 3000, 3500),
      contact("enemy_0", ENEMY, 3000, 2500, 180),
    ];
    const fleet = fleetAt("normal");
    commandFor(fleet, duel, 1000);
    fleet.markTarget(PLAYER, "enemy_0", 1000);
    expect(fleet.markedTargetOf(ENEMY, 1000)).toBeNull();
    expect(fleet.markedTargetOf(PLAYER, 1000)).toBeNull();
    expect(fleet.orderFor("enemy_0", ENEMY)).toBeNull();
  });

  it("drops a destroyed ship's marks and pilot", () => {
    const fleet = fleetAt("normal");
    fleet.enlist("enemy_2", ENEMY);
    commandFor(fleet, SQUADS, 500);
    fleet.markTarget(PLAYER, "enemy_2", 500);
    fleet.forget("enemy_2");
    expect(fleet.markedTargetOf(PLAYER, 500)).toBeNull();
    expect(fleet.tierOf("enemy_2")).toBeNull();
  });
});

describe("ArcadeBotFleet flight", () => {
  it("flies an AI ship through the pilot controls, enlisting it on first use", () => {
    const fleet = fleetAt("hard");
    const self = SQUADS.find((s) => s.id === "enemy_1")!;
    commandFor(fleet, SQUADS, 0);
    const flight = createCycleFlight(self.definitionId, self);
    const result = fleet.fly({
      self,
      flight,
      dial: getShipDial(self.definitionId),
      nowMs: 0,
      deltaMs: TICK_MS,
    });
    expect(fleet.tierOf("enemy_1")).toBe("expert");
    expect(result.motion.control).toBeDefined();
    expect(result.stress).toBeDefined();
  });
});
