import { describe, it, expect } from "vitest";
import {
  fleetModifiers,
  reequipFlight,
} from "../../../../src/systems/survival/runFlightEquip";
import {
  createCycleFlight,
  createShipControl,
} from "../../../../src/arcade/systems/CycleFlight";
import {
  combineEffects,
  NEUTRAL_MODIFIERS,
} from "../../../../src/core/CombatModifiers";

const POSE = { x: 100, y: 200, angle: 0 };
const SHIP = "terran_viper";

describe("reequipFlight — Drive through the equipment path", () => {
  it("is idempotent: re-applying the same sheet changes nothing (no stacking per wave)", () => {
    const sheet = fleetModifiers(
      combineEffects([{ boostCooldownMultiplier: 0.8 }]),
      3,
    );
    const once = reequipFlight(createCycleFlight(SHIP, POSE), SHIP, sheet);
    const twice = reequipFlight(once, SHIP, sheet);
    const many = [1, 2, 3, 4, 5].reduce(
      (f) => reequipFlight(f, SHIP, sheet),
      once,
    );
    expect(twice).toEqual(once);
    expect(many).toEqual(once);
  });

  it("rebuilds from the hull's base, so a smaller bonus really lowers the effect", () => {
    const base = createShipControl(SHIP, POSE);
    const fast = reequipFlight(
      createCycleFlight(SHIP, POSE),
      SHIP,
      fleetModifiers(NEUTRAL_MODIFIERS, 4),
    );
    const slow = reequipFlight(
      fast,
      SHIP,
      fleetModifiers(NEUTRAL_MODIFIERS, 0),
    );
    expect(fast.motion.control.maxSpeed).toBe(base.maxSpeed + 1);
    expect(fast.motion.control.boostCooldownMax).toBeCloseTo(
      base.boostCooldownMax * 0.85 ** 3,
    );
    expect(slow.motion.control.maxSpeed).toBe(base.maxSpeed);
    expect(slow.motion.control.boostCooldownMax).toBe(base.boostCooldownMax);
  });

  it("keeps the flight in progress (pose, maneuver, stress) and clamps the throttle", () => {
    const flight = createCycleFlight(SHIP, POSE);
    const equipped = reequipFlight(
      flight,
      SHIP,
      fleetModifiers(NEUTRAL_MODIFIERS, 1),
    );
    expect(equipped.motion.x).toBe(POSE.x);
    expect(equipped.motion.control.currentManeuver).toBe(
      flight.motion.control.currentManeuver,
    );
    expect(equipped.stress).toBe(flight.stress);
    const flooredSpeed = {
      ...equipped,
      motion: {
        ...equipped.motion,
        control: { ...equipped.motion.control, speed: 99 },
      },
    };
    const clamped = reequipFlight(flooredSpeed, SHIP, NEUTRAL_MODIFIERS);
    expect(clamped.motion.control.speed).toBe(clamped.motion.control.maxSpeed);
  });

  it("folds Drive into the sheet without disturbing other knobs", () => {
    const base = combineEffects([
      { rearArcLaserBonus: 2, shieldRegenPerSecond: 0 },
    ]);
    const sheet = fleetModifiers(base, 2);
    expect(sheet.rearArcLaserBonus).toBe(2);
    expect(sheet.maxSpeedBonus).toBe(1);
    expect(fleetModifiers(sheet, 0)).toEqual(sheet);
    expect(fleetModifiers(base, 0)).toEqual(base);
  });
});
