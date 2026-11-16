/**
 * The steering engine a ship is built with: the Settings choice offline, the
 * template engine while the online lock is on, a pure override when named.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  activeSteeringMode,
  lockSteeringToOnlineMode,
} from "../../../src/arcade/systems/SteeringMode";
import { flightCapabilitiesOf } from "../../../src/arcade/systems/FlightCapabilities";
import {
  createCycleFlight,
  createShipControl,
} from "../../../src/arcade/systems/CycleFlight";
import { usesAnalogSteering } from "../../../src/core/analogSteering";
import { getShipsByRole } from "../../../src/data/ShipDefinitions";
import { resetBrowserStore } from "../../../src/systems/keyValueStore";
import {
  DEFAULT_SETTINGS,
  saveSettings,
} from "../../../src/systems/SettingsStorage";

const POSE = { x: 3000, y: 3000, angle: 0 };
const fighterId = (): string => getShipsByRole("heavy_fighter")[0]!.id;

function chooseAnalog(): void {
  saveSettings({
    ...DEFAULT_SETTINGS,
    gameplay: { ...DEFAULT_SETTINGS.gameplay, steeringMode: "analog" },
  });
}

afterEach(() => {
  lockSteeringToOnlineMode(false);
  resetBrowserStore();
});

describe("steering mode selection", () => {
  it("defaults to the template engine", () => {
    resetBrowserStore();
    expect(activeSteeringMode()).toBe("template");
    expect(flightCapabilitiesOf(fighterId()).steering).toBeUndefined();
    expect(usesAnalogSteering(createShipControl(fighterId(), POSE))).toBe(false);
  });

  it("builds ships on the analog engine when Settings choose it", () => {
    resetBrowserStore();
    chooseAnalog();
    expect(activeSteeringMode()).toBe("analog");
    const control = createShipControl(fighterId(), POSE);
    expect(usesAnalogSteering(control)).toBe(true);
    expect(control.analog?.free).toBe(true);
  });

  it("builds template ships while the online lock is on, whatever Settings say", () => {
    resetBrowserStore();
    chooseAnalog();
    lockSteeringToOnlineMode(true);
    expect(activeSteeringMode()).toBe("template");
    const control = createShipControl(fighterId(), POSE);
    expect(usesAnalogSteering(control)).toBe(false);
    expect(control.analog).toBeUndefined();
    lockSteeringToOnlineMode(false);
    expect(activeSteeringMode()).toBe("analog");
  });

  it("lets a caller name the engine without touching Settings", () => {
    resetBrowserStore();
    const flight = createCycleFlight(fighterId(), POSE, "identity", "analog");
    expect(usesAnalogSteering(flight.motion.control)).toBe(true);
  });

  it("keeps capital hulls on the template engine", () => {
    const capital = getShipsByRole("capital")[0]!.id;
    const control = createShipControl(capital, POSE, "identity", "analog");
    expect(usesAnalogSteering(control)).toBe(false);
  });
});
