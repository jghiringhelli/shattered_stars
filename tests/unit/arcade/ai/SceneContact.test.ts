/**
 * botContacts — specification tests: a scene ship becomes a BotContact
 * with its side, health, primary arc and range, throttle and stress.
 */

import { describe, expect, it } from "vitest";
import { botContactOf } from "../../../../src/arcade/ai/SceneContact";
import { createCycleFlight } from "../../../../src/arcade/systems/CycleFlight";
import { getModeCombatStats } from "../../../../src/data/ModeBalancing";

const SHIP = "confed_sparrow";

function sceneShip(hull: number) {
  const combatStats = getModeCombatStats(SHIP, "continuous");
  const flight = createCycleFlight(SHIP, { x: 100, y: 200, angle: 45 });
  return {
    id: "s1",
    definitionId: SHIP,
    x: 100,
    y: 200,
    angle: 45,
    hull,
    maxHull: combatStats.maxHull,
    shields: 3,
    maxShields: combatStats.maxShields,
    flight,
    combatStats,
  };
}

describe("botContactOf", () => {
  it("describes the ship's identity, side, pose and health", () => {
    const ship = sceneShip(7);
    expect(botContactOf(ship, "blue")).toMatchObject({
      id: "s1",
      side: "blue",
      definitionId: SHIP,
      x: 100,
      y: 200,
      angle: 45,
      alive: true,
      hull: 7,
      shields: 3,
    });
  });

  it("carries its primary arc and range, throttle and stress", () => {
    const ship = sceneShip(7);
    const seen = botContactOf(ship, "blue");
    expect(seen.firingArcDeg).toBe(ship.combatStats.firingArc);
    expect(seen.weaponRange).toBe(ship.combatStats.weaponRange);
    expect(seen.speed).toBe(ship.flight.motion.control.speed);
    expect(seen.isStressed).toBe(false);
  });

  it("a ship at zero hull is not alive", () => {
    expect(botContactOf(sceneShip(0), "blue").alive).toBe(false);
  });
});
