/**
 * Arcade Controls Tests
 */

import { describe, it, expect } from "vitest";
import {
  createControlState,
  processCommand,
  updateManeuver,
  advanceCycle,
  updateCooldowns,
  getContinuousMovement,
  canFire,
  canKTurn,
  canBarrelRoll,
  startManeuver,
  type ShipControlState,
} from "../../../src/core/ArcadeControls";
import type { ShipState } from "../../../src/core/types";
import { CYCLE_DURATION_MS } from "../../../src/config";

function createMockShip(overrides: Partial<ShipState> = {}): ShipState {
  return {
    id: "test-ship",
    definitionId: "test-def",
    faction: "terran_hegemony",
    owner: "player",
    x: 500,
    y: 500,
    angle: 0,
    hull: 5,
    maxHull: 5,
    shields: 2,
    maxShields: 2,
    isStressed: false,
    hasFocus: false,
    hasEvade: false,
    hasTargetLock: null,
    isCloaked: false,
    currentManeuver: null,
    maneuverProgress: 0,
    ...overrides,
  };
}

describe("ArcadeControls", () => {
  describe("createControlState", () => {
    it("should create initial control state with straight maneuver already executing", () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      expect(control.speed).toBe(3);
      expect(control.minSpeed).toBe(1);
      expect(control.maxSpeed).toBe(5);
      // Cycle system: a maneuver is always executing from creation
      expect(control.currentManeuver).toBe("straight");
      expect(control.maneuverPath.length).toBeGreaterThan(0);
      expect(control.weaponCooldown).toBe(0);
      expect(control.kturnCooldown).toBe(0);
      // nextManeuver queue starts empty
      expect(control.nextManeuver).toBeNull();
    });
  });

  describe("processCommand", () => {
    it("should increase speed on thrust_increase", () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      const result = processCommand(ship, control, "thrust_increase");

      expect(result.speed).toBe(4);
    });

    it("should cap speed at max (5)", () => {
      const ship = createMockShip();
      const control = { ...createControlState(ship), speed: 5 };

      const result = processCommand(ship, control, "thrust_increase");

      expect(result.speed).toBe(5);
    });

    it("should decrease speed on thrust_decrease", () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      const result = processCommand(ship, control, "thrust_decrease");

      expect(result.speed).toBe(2);
    });

    it("should not go below minSpeed (1)", () => {
      const ship = createMockShip();
      const control = { ...createControlState(ship), speed: 1 };

      const result = processCommand(ship, control, "thrust_decrease");

      expect(result.speed).toBe(1);
    });

    it("queues turn_left for next cycle without interrupting current maneuver", () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      const result = processCommand(ship, control, "turn_left");

      expect(result.nextManeuver).toBe("turn_left");
      // Current maneuver is still the one that was already executing
      expect(result.currentManeuver).toBe("straight");
    });

    it("queues turn_right for next cycle", () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      const result = processCommand(ship, control, "turn_right");

      expect(result.nextManeuver).toBe("turn_right");
    });

    it("queues bank_left for next cycle", () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      const result = processCommand(ship, control, "bank_left");

      expect(result.nextManeuver).toBe("bank_left");
    });

    it("queues kturn and starts cooldown when cooldown is ready", () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      const result = processCommand(ship, control, "kturn");

      expect(result.nextManeuver).toBe("kturn");
      expect(result.kturnCooldown).toBeGreaterThan(0);
    });

    it("does not queue kturn when on cooldown", () => {
      const ship = createMockShip();
      const control = { ...createControlState(ship), kturnCooldown: 5000 };

      const result = processCommand(ship, control, "kturn");

      expect(result.nextManeuver).toBeNull();
    });

    it("can queue a new direction while a maneuver is in progress (next cycle)", () => {
      const ship = createMockShip();
      let control = createControlState(ship); // starts 'straight'
      control = processCommand(ship, control, "turn_left");

      // Can immediately re-queue a different direction
      const result = processCommand(ship, control, "turn_right");

      expect(result.nextManeuver).toBe("turn_right");
      // Current still executing straight
      expect(result.currentManeuver).toBe("straight");
    });

    it("should update weapon cooldown on fire", () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      const result = processCommand(ship, control, "fire");

      expect(result.weaponCooldown).toBeGreaterThan(0);
    });
  });

  describe("startManeuver", () => {
    it("should always start the requested maneuver, replacing any in-progress one", () => {
      const ship = createMockShip();
      let control = createControlState(ship);
      control = startManeuver(ship, control, "turn_left");
      control = { ...control, maneuverProgress: 0.5 }; // Partially complete

      // New system: startManeuver always replaces
      const result = startManeuver(ship, control, "turn_right");

      expect(result.currentManeuver).toBe("turn_right");
    });

    it("should create maneuver path and target", () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      const result = startManeuver(ship, control, "turn_left");

      expect(result.maneuverPath.length).toBeGreaterThan(0);
      expect(result.maneuverTarget).not.toBeNull();
    });

    it("should reset progress to 0 when starting a new maneuver", () => {
      const ship = createMockShip();
      const control = { ...createControlState(ship), maneuverProgress: 0.7 };

      const result = startManeuver(ship, control, "bank_right");

      expect(result.maneuverProgress).toBe(0);
    });
  });

  describe("updateManeuver", () => {
    it("should progress maneuver over time", () => {
      const ship = createMockShip();
      let control = createControlState(ship);
      control = startManeuver(ship, control, "turn_left");

      const result = updateManeuver(control, 100);

      expect(result.control.maneuverProgress).toBeGreaterThan(0);
      expect(result.position).not.toBeNull();
      expect(result.cycleComplete).toBe(false);
    });

    it("signals cycleComplete when full cycle elapses", () => {
      const ship = createMockShip();
      let control = createControlState(ship);
      control = startManeuver(ship, control, "turn_left");

      const result = updateManeuver(control, CYCLE_DURATION_MS);

      expect(result.cycleComplete).toBe(true);
      expect(result.control.maneuverProgress).toBe(1);
      expect(result.position).not.toBeNull();
      // currentManeuver stays set — advanceCycle handles the transition
      expect(result.control.currentManeuver).toBe("turn_left");
    });

    it("signals cycleComplete for oversized deltaMs", () => {
      const ship = createMockShip();
      let control = createControlState(ship);
      control = startManeuver(ship, control, "straight");

      const result = updateManeuver(control, CYCLE_DURATION_MS * 3);

      expect(result.cycleComplete).toBe(true);
    });

    it("never exceeds progress 1", () => {
      const ship = createMockShip();
      let control = createControlState(ship);
      control = startManeuver(ship, control, "straight");

      const result = updateManeuver(control, CYCLE_DURATION_MS * 5);

      expect(result.control.maneuverProgress).toBe(1);
    });
  });

  describe("advanceCycle", () => {
    it("starts the queued maneuver on cycle completion", () => {
      const ship = createMockShip();
      let control = createControlState(ship);
      control = processCommand(ship, control, "bank_right");
      expect(control.nextManeuver).toBe("bank_right");

      const advanced = advanceCycle(ship, control);

      expect(advanced.currentManeuver).toBe("bank_right");
      expect(advanced.nextManeuver).toBeNull();
      expect(advanced.maneuverProgress).toBe(0);
    });

    it("defaults to straight when no maneuver is queued", () => {
      const ship = createMockShip();
      const control = createControlState(ship); // nextManeuver = null

      const advanced = advanceCycle(ship, control);

      expect(advanced.currentManeuver).toBe("straight");
    });
  });

  describe("updateCooldowns", () => {
    it("should decrease weapon cooldown", () => {
      const ship = createMockShip();
      const control: ShipControlState = {
        ...createControlState(ship),
        weaponCooldown: 500,
      };

      const result = updateCooldowns(control, 100);

      expect(result.weaponCooldown).toBe(400);
    });

    it("should not go below 0", () => {
      const ship = createMockShip();
      const control: ShipControlState = {
        ...createControlState(ship),
        weaponCooldown: 50,
      };

      const result = updateCooldowns(control, 100);

      expect(result.weaponCooldown).toBe(0);
    });

    it("should decrease kturn cooldown", () => {
      const ship = createMockShip();
      const control: ShipControlState = {
        ...createControlState(ship),
        kturnCooldown: 5000,
      };

      const result = updateCooldowns(control, 1000);

      expect(result.kturnCooldown).toBe(4000);
    });

    it("should decrease barrel roll cooldown", () => {
      const ship = createMockShip();
      const control: ShipControlState = {
        ...createControlState(ship),
        barrelRollCooldown: 2000,
      };

      const result = updateCooldowns(control, 500);

      expect(result.barrelRollCooldown).toBe(1500);
    });
  });

  describe("getContinuousMovement", () => {
    it("should return forward movement based on angle and speed", () => {
      const ship = createMockShip({ angle: 0 }); // Facing up
      // getContinuousMovement only moves when currentManeuver === null
      const control: ShipControlState = {
        ...createControlState(ship),
        currentManeuver: null,
      };

      const movement = getContinuousMovement(ship, control, 1000);

      expect(movement.y).toBeLessThan(ship.y); // Moving up (negative y in Phaser)
      expect(Math.abs(movement.x - ship.x)).toBeLessThan(1); // Almost no x movement
    });

    it("should not move when maneuver is active", () => {
      const ship = createMockShip({ angle: 0 });
      const control = createControlState(ship); // starts straight

      const movement = getContinuousMovement(ship, control, 1000);

      expect(movement.x).toBe(ship.x);
      expect(movement.y).toBe(ship.y);
    });

    it("should move faster at higher speeds", () => {
      const ship = createMockShip({ angle: 0 });
      // currentManeuver must be null for continuous movement
      const slowControl: ShipControlState = {
        ...createControlState(ship),
        speed: 1,
        currentManeuver: null,
      };
      const fastControl: ShipControlState = {
        ...createControlState(ship),
        speed: 5,
        currentManeuver: null,
      };

      const slow = getContinuousMovement(ship, slowControl, 1000);
      const fast = getContinuousMovement(ship, fastControl, 1000);

      expect(Math.abs(fast.y - ship.y)).toBeGreaterThan(
        Math.abs(slow.y - ship.y),
      );
    });

    it("should respect angle direction", () => {
      const ship = createMockShip({ angle: 90 }); // Facing right
      const control: ShipControlState = {
        ...createControlState(ship),
        currentManeuver: null,
      };

      const movement = getContinuousMovement(ship, control, 1000);

      expect(movement.x).toBeGreaterThan(ship.x); // Moving right
    });
  });

  describe("canFire", () => {
    it("should return true when cooldown is 0", () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      expect(canFire(control)).toBe(true);
    });

    it("should return false when on cooldown", () => {
      const ship = createMockShip();
      const control = { ...createControlState(ship), weaponCooldown: 100 };

      expect(canFire(control)).toBe(false);
    });
  });

  describe("canKTurn", () => {
    it("should return true when cooldown is 0", () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      expect(canKTurn(control)).toBe(true);
    });

    it("should return false when on cooldown", () => {
      const ship = createMockShip();
      const control = { ...createControlState(ship), kturnCooldown: 5000 };

      expect(canKTurn(control)).toBe(false);
    });

    it("should return true even while a maneuver is executing (discrete cycle model)", () => {
      const ship = createMockShip();
      const control = createControlState(ship); // starts 'straight'

      // canKTurn only gates on cooldown, not current maneuver
      expect(canKTurn(control)).toBe(true);
    });
  });

  describe("canBarrelRoll", () => {
    it("should return true when cooldown is 0", () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      expect(canBarrelRoll(control)).toBe(true);
    });

    it("should return false when on cooldown", () => {
      const ship = createMockShip();
      const control = { ...createControlState(ship), barrelRollCooldown: 2000 };

      expect(canBarrelRoll(control)).toBe(false);
    });
  });

  describe("tallon roll commands", () => {
    it("queues tallon_left for next cycle when cooldown is ready", () => {
      const ship = createMockShip();
      const control = createControlState(ship);
      const result = processCommand(ship, control, "tallon_left");

      expect(result.nextManeuver).toBe("tallon_left");
      expect(result.kturnCooldown).toBeGreaterThan(0);
    });

    it("queues tallon_right for next cycle when cooldown is ready", () => {
      const ship = createMockShip();
      const control = createControlState(ship);
      const result = processCommand(ship, control, "tallon_right");

      expect(result.nextManeuver).toBe("tallon_right");
      expect(result.kturnCooldown).toBeGreaterThan(0);
    });

    it("blocks tallon_left when kturn cooldown is active", () => {
      const ship = createMockShip();
      const control = { ...createControlState(ship), kturnCooldown: 5000 };
      const result = processCommand(ship, control, "tallon_left");

      expect(result.nextManeuver).toBeNull();
    });

    it("tallon_left endpoint has same x/y displacement as turn_left but ends facing backward (180°)", () => {
      const ship = createMockShip({ x: 0, y: 0, angle: 0 });
      const control = createControlState(ship);
      const tallon = startManeuver(ship, control, "tallon_left");
      const turn = startManeuver(
        ship,
        { ...control, kturnCooldown: 0 },
        "turn_left",
      );

      // Same position displacement
      expect(tallon.maneuverTarget?.x).toBeCloseTo(
        turn.maneuverTarget?.x ?? 0,
        1,
      );
      expect(tallon.maneuverTarget?.y).toBeCloseTo(
        turn.maneuverTarget?.y ?? 0,
        1,
      );
      // Tallon = 180° from start, turn_left = 270° (−90° from 0°)
      expect(tallon.maneuverTarget?.angle).toBeCloseTo(180, 1);
      expect(turn.maneuverTarget?.angle).toBeCloseTo(270, 1);
    });
  });

  describe("segnor loop commands", () => {
    it("queues segnor_left for next cycle when cooldown is ready", () => {
      const ship = createMockShip();
      const control = createControlState(ship);
      const result = processCommand(ship, control, "segnor_left");

      expect(result.nextManeuver).toBe("segnor_left");
      expect(result.kturnCooldown).toBeGreaterThan(0);
    });

    it("queues segnor_right for next cycle when cooldown is ready", () => {
      const ship = createMockShip();
      const control = createControlState(ship);
      const result = processCommand(ship, control, "segnor_right");

      expect(result.nextManeuver).toBe("segnor_right");
    });

    it("blocks segnor_left when kturn cooldown is active", () => {
      const ship = createMockShip();
      const control = { ...createControlState(ship), kturnCooldown: 5000 };
      const result = processCommand(ship, control, "segnor_left");

      expect(result.nextManeuver).toBeNull();
    });

    it("segnor_left endpoint has same x/y displacement as bank_left but ends at 225°", () => {
      const ship = createMockShip({ x: 0, y: 0, angle: 0 });
      const control = createControlState(ship);
      const segnor = startManeuver(ship, control, "segnor_left");
      const bank = startManeuver(
        ship,
        { ...control, kturnCooldown: 0 },
        "bank_left",
      );

      expect(segnor.maneuverTarget?.x).toBeCloseTo(
        bank.maneuverTarget?.x ?? 0,
        1,
      );
      expect(segnor.maneuverTarget?.y).toBeCloseTo(
        bank.maneuverTarget?.y ?? 0,
        1,
      );
      // Segnor ends at 225° (−135° from 0°), bank_left ends at 315° (−45° from 0°)
      expect(segnor.maneuverTarget?.angle).toBeCloseTo(225, 1);
      expect(bank.maneuverTarget?.angle).toBeCloseTo(315, 1);
    });
  });
});
