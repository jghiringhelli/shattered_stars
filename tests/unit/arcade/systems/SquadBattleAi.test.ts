/**
 * SquadBattleAi — specification: the squad scenes' AI layer gives AI ships
 * BotPilots, lets the player's squad focus the player's mark (its wingmen
 * mark their own focus while the player has none), coordinates enemy squads
 * of two or more ships (their leader marks a target unless every pilot is a
 * novice), owns the battle's marks (the bonus only for sides flying as a
 * squad, HUD, forgotten on death) and steers bots away from hazards.
 */

import { describe, it, expect } from "vitest";
import { BATTLEFIELD_SIZE } from "../../../../src/config";
import { createCycleFlight } from "../../../../src/arcade/systems/CycleFlight";
import { getShipDial } from "../../../../src/data/ShipDefinitions";
import { createSeededRng } from "../../../../src/utils/random";
import {
  ENEMY_SIDE,
  PLAYER_SIDE,
  SquadBattleAi,
  squadContactOf,
  type SquadAiShip,
} from "../../../../src/arcade/systems/SquadBattleAi";
import type { BotPilot } from "../../../../src/arcade/ai/BotPilot";

const FRAME_MS = 16;
const SETTLE_MS = 3000;
const CENTER = BATTLEFIELD_SIZE / 2;

type TestShip = SquadAiShip & { bot: BotPilot | null };

function newAi(
  safePointFor?: (x: number, y: number) => { x: number; y: number } | null,
): SquadBattleAi {
  return new SquadBattleAi({
    worldSize: BATTLEFIELD_SIZE,
    random: createSeededRng(7).next,
    ...(safePointFor ? { safePointFor } : {}),
  });
}

/** Two player ships (a squad) and one enemy, for the mark rules. */
function wing(): TestShip[] {
  return [
    ship("p0", "player", { x: CENTER, y: CENTER, angle: 0 }, null),
    ship("p1", "player", { x: CENTER + 120, y: CENTER, angle: 0 }, null),
    ship("e1", "ai", { x: CENTER, y: CENTER - 600, angle: 180 }, null),
  ];
}

function ship(
  id: string,
  owner: "player" | "ai",
  at: { x: number; y: number; angle: number },
  bot: BotPilot | null,
): TestShip {
  const definitionId = owner === "player" ? "confed_sparrow" : "terran_viper";
  return {
    id,
    definitionId,
    owner,
    ...at,
    hull: 12,
    maxHull: 12,
    shields: 8,
    maxShields: 8,
    combatStats: { firingArc: 90, weaponRange: 300 },
    flight: createCycleFlight(definitionId, at),
    dial: getShipDial(definitionId),
    bot,
  };
}

/** Runs command + every bot's fly for a while (ships hold their poses). */
function settle(ai: SquadBattleAi, ships: readonly TestShip[]): void {
  for (let now = 0; now <= SETTLE_MS; now += FRAME_MS) {
    ai.command(ships, now);
    for (const s of ships) ai.fly(s, now, FRAME_MS);
  }
}

describe("squadContactOf", () => {
  it("sides a ship by its owner, with its weapon envelope", () => {
    const contact = squadContactOf(
      ship("e1", "ai", { x: 10, y: 20, angle: 90 }, null),
    );
    expect(contact).toMatchObject({
      side: ENEMY_SIDE,
      x: 10,
      y: 20,
      firingArcDeg: 90,
      weaponRange: 300,
      alive: true,
    });
  });
});

describe("SquadBattleAi — pilots", () => {
  it("creates a pilot of the requested tier", () => {
    expect(newAi().createPilot("novice").tier).toBe("novice");
  });

  it("a bot-flown ship gets controls back; a player-flown one gets none", () => {
    const ai = newAi();
    const pose = { x: CENTER, y: CENTER, angle: 0 };
    const bot = ship("e1", "ai", pose, ai.createPilot("average"));
    const flagship = ship("p0", "player", { ...pose, y: CENTER + 400 }, null);
    ai.command([bot, flagship], 0);
    expect(ai.fly(bot, 0, FRAME_MS)?.motion).toBeDefined();
    expect(ai.fly(flagship, 0, FRAME_MS)).toBeNull();
  });
});

describe("SquadBattleAi — the player's mark", () => {
  it("marks a target for the player's side only", () => {
    const ai = newAi();
    ai.command(wing(), 0);
    ai.markTarget("e1", 0);
    expect(ai.playerMarkOf(0)).toBe("e1");
    expect(ai.isMarkedBy(PLAYER_SIDE, "e1", 0)).toBe(true);
    expect(ai.isMarkedBy(ENEMY_SIDE, "e1", 0)).toBe(false);
  });

  it("a lone player ship's mark shows on the HUD but earns no bonus", () => {
    const ai = newAi();
    const [flagship, , enemy] = wing();
    ai.command([flagship!, enemy!], 0);
    ai.markTarget("e1", 0);
    expect(ai.playerMarkOf(0)).toBe("e1");
    expect(ai.isMarkedBy(PLAYER_SIDE, "e1", 0)).toBe(false);
  });

  it("escorts mark their own focus while the player has no mark", () => {
    const ai = newAi();
    const { ships } = escortScenario(ai);
    settle(ai, ships);
    expect(ai.playerMarkOf(SETTLE_MS)).not.toBeNull();
    expect(
      ai.isMarkedBy(PLAYER_SIDE, ai.playerMarkOf(SETTLE_MS)!, SETTLE_MS),
    ).toBe(true);
  });

  it("forgets the mark when the marked ship is destroyed", () => {
    const ai = newAi();
    ai.markTarget("e1", 0);
    ai.forget("e1");
    expect(ai.playerMarkOf(0)).toBeNull();
  });

  it("a new battle starts without marks", () => {
    const ai = newAi();
    ai.markTarget("e1", 0);
    ai.reset();
    expect(ai.playerMarkOf(0)).toBeNull();
  });

  it("escorts go after the player's mark rather than the nearer enemy", () => {
    const ai = newAi();
    const { ships, escort } = escortScenario(ai);
    ai.markTarget("far", 0);
    settle(ai, ships);
    expect(escort.bot?.targetId).toBe("far");
  });

  it("without a mark, escorts pick their own (nearer) target", () => {
    const ai = newAi();
    const { ships, escort } = escortScenario(ai);
    settle(ai, ships);
    expect(escort.bot?.targetId).toBe("near");
  });
});

/**
 * Flagship + bot escort, one enemy close ahead and one far away.
 * @param ai - The AI layer (creates the escort's pilot).
 * @returns Every ship and the escort.
 */
function escortScenario(ai: SquadBattleAi): {
  ships: TestShip[];
  escort: TestShip;
} {
  const escort = ship(
    "p1",
    "player",
    { x: CENTER + 100, y: CENTER, angle: 0 },
    ai.createPilot("average"),
  );
  const ships = [
    ship("p0", "player", { x: CENTER, y: CENTER, angle: 0 }, null),
    escort,
    ship("near", "ai", { x: CENTER + 100, y: CENTER - 350, angle: 180 }, null),
    ship("far", "ai", { x: CENTER - 700, y: CENTER - 700, angle: 180 }, null),
  ];
  return { ships, escort };
}

describe("SquadBattleAi — enemy squads", () => {
  it("an enemy squad of two or more marks a target of the player's side", () => {
    const ai = newAi();
    const flagship = ship(
      "p0",
      "player",
      { x: CENTER, y: CENTER, angle: 0 },
      null,
    );
    const e1 = ship(
      "e1",
      "ai",
      { x: CENTER, y: CENTER - 600, angle: 180 },
      ai.createPilot("average"),
    );
    const e2 = ship(
      "e2",
      "ai",
      { x: CENTER + 120, y: CENTER - 600, angle: 180 },
      ai.createPilot("average"),
    );
    settle(ai, [flagship, e1, e2]);
    expect(ai.isMarkedBy(ENEMY_SIDE, "p0", SETTLE_MS)).toBe(true);
  });

  it("a squad of novice pilots focuses but never marks", () => {
    const ai = newAi();
    const flagship = ship(
      "p0",
      "player",
      { x: CENTER, y: CENTER, angle: 0 },
      null,
    );
    const e1 = ship(
      "e1",
      "ai",
      { x: CENTER, y: CENTER - 600, angle: 180 },
      ai.createPilot("novice"),
    );
    const e2 = ship(
      "e2",
      "ai",
      { x: CENTER + 120, y: CENTER - 600, angle: 180 },
      ai.createPilot("novice"),
    );
    settle(ai, [flagship, e1, e2]);
    expect(ai.isMarkedBy(ENEMY_SIDE, "p0", SETTLE_MS)).toBe(false);
  });

  it("a lone enemy flies on its own, without a mark", () => {
    const ai = newAi();
    const flagship = ship(
      "p0",
      "player",
      { x: CENTER, y: CENTER, angle: 0 },
      null,
    );
    const e1 = ship(
      "e1",
      "ai",
      { x: CENTER, y: CENTER - 600, angle: 180 },
      ai.createPilot("average"),
    );
    settle(ai, [flagship, e1]);
    expect(ai.isMarkedBy(ENEMY_SIDE, "p0", SETTLE_MS)).toBe(false);
  });

  it("a new wave clears the enemy squad's mark", () => {
    const ai = newAi();
    const flagship = ship(
      "p0",
      "player",
      { x: CENTER, y: CENTER, angle: 0 },
      null,
    );
    const e1 = ship(
      "e1",
      "ai",
      { x: CENTER, y: CENTER - 600, angle: 180 },
      ai.createPilot("average"),
    );
    const e2 = ship(
      "e2",
      "ai",
      { x: CENTER + 120, y: CENTER - 600, angle: 180 },
      ai.createPilot("average"),
    );
    settle(ai, [flagship, e1, e2]);
    ai.resetEnemySquad();
    expect(ai.isMarkedBy(ENEMY_SIDE, "p0", SETTLE_MS)).toBe(false);
  });
});

describe("SquadBattleAi — hazards", () => {
  it("a bot near a hazard steers for the safe point instead of the enemy", () => {
    const east = { x: CENTER + 2000, y: CENTER };
    const ai = newAi(() => east);
    const bot = ship(
      "e1",
      "ai",
      { x: CENTER, y: CENTER, angle: 0 },
      ai.createPilot("expert"),
    );
    const prey = ship(
      "p0",
      "player",
      { x: CENTER, y: CENTER - 500, angle: 180 },
      null,
    );
    settle(ai, [bot, prey]);
    expect(bot.bot?.intent.maneuver.endsWith("right")).toBe(true);
  });
});
