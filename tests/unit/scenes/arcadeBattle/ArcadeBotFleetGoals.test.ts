/**
 * ArcadeBotFleet goal steering — specification: Scenario mode hands the
 * fleet a goal source; an AI ship with a goal steers for it (BotPilot's
 * safe-point path: no specials, boosts or rolls), one without flies its
 * squad orders as before.
 */

import { describe, expect, it } from "vitest";
import { ArcadeBotFleet } from "../../../../src/scenes/arcadeBattle/ArcadeBotFleet";
import type { BotContact } from "../../../../src/arcade/ai";
import {
  createCycleFlight,
  tickCycleFlight,
  type CycleFlightState,
} from "../../../../src/arcade/systems/CycleFlight";
import { getShipDial } from "../../../../src/data/ShipDefinitions";
import { createSeededRng } from "../../../../src/utils/random";
import { CYCLE_DURATION_MS } from "../../../../src/config";

const WORLD = 6000;
const TICK_MS = 1000 / 60;
const FLY_MS = 5000;
const GOAL = { x: 4800, y: 3000 };

function contact(
  id: string,
  side: string,
  x: number,
  y: number,
  angle: number,
): BotContact {
  return {
    id,
    side,
    definitionId:
      side === "free_confederation" ? "confed_kestrel" : "corsair_venom",
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

/** Flies enemy_0 (heading up toward the player dead ahead) and returns its end pose. */
function flyEnemy(withGoal: boolean): { x: number; boosted: boolean } {
  const fleet = new ArcadeBotFleet({
    difficulty: "hard",
    playerSide: "free_confederation",
    random: createSeededRng(3).next,
    worldSize: WORLD,
  });
  if (withGoal) fleet.setGoalSource((id) => (id === "enemy_0" ? GOAL : null));
  const player = contact("player_0", "free_confederation", 3000, 1800, 180);
  let self = contact("enemy_0", "void_corsairs", 3000, 3000, 0);
  let flight: CycleFlightState = createCycleFlight(self.definitionId, self);
  const dial = getShipDial(self.definitionId);
  let boosted = false;
  for (let t = 0; t < FLY_MS; t += TICK_MS) {
    fleet.command(t, [player, self]);
    const result = fleet.fly({
      self,
      flight,
      dial,
      nowMs: t,
      deltaMs: TICK_MS,
    });
    boosted ||=
      result.events.includes("boost") || result.events.includes("barrel_roll");
    const tick = tickCycleFlight(
      { motion: result.motion, stress: result.stress },
      { deltaMs: TICK_MS, worldSize: WORLD, dial, cycleMs: CYCLE_DURATION_MS },
    );
    flight = tick.state;
    if (tick.completed) {
      fleet.onCycleCommitted(
        "enemy_0",
        flight.motion.control.currentManeuver ?? "straight",
      );
    }
    const { x, y, angle } = flight.motion;
    self = { ...self, x, y, angle };
  }
  return { x: self.x, boosted };
}

describe("ArcadeBotFleet goal source", () => {
  it("an AI ship with a goal steers for it instead of chasing the enemy ahead", () => {
    expect(flyEnemy(true).x).toBeGreaterThan(3600);
  });

  it("without a goal the ship keeps after the enemy ahead", () => {
    expect(flyEnemy(false).x).toBeLessThan(3600);
  });

  it("a goal-steered ship neither boosts nor barrel-rolls", () => {
    expect(flyEnemy(true).boosted).toBe(false);
  });
});
