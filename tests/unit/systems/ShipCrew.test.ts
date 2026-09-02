import { describe, it, expect } from "vitest";
import {
  getAvailableCrewRoles,
  nextCrewRole,
  issueConcentrateFire,
  concentrateFireMultiplier,
  CONCENTRATE_FIRE_DURATION_MS,
  CONCENTRATE_FIRE_DAMAGE_BONUS,
  nextPowerFocus,
  redirectPower,
  isPowerFocused,
  canRedirectPower,
  POWER_REDIRECT_DURATION_MS,
  POWER_REDIRECT_COOLDOWN_MS,
  createMainBeamState,
  startCharging,
  tickMainBeam,
  isMainBeamReady,
  resetMainBeam,
  MAIN_BEAM_CHARGE_DURATION_MS,
  canEmergencyRepair,
  EMERGENCY_REPAIR_COOLDOWN_MS,
  createCommanderOrders,
  canFireMainBeam,
  MAIN_BEAM_COOLDOWN_MS,
} from "../../../src/systems/ShipCrew";

describe("ShipCrew", () => {
  describe("getAvailableCrewRoles / nextCrewRole", () => {
    it("solo ship (no turret, not capital) only has pilot", () => {
      expect(getAvailableCrewRoles(false, false)).toEqual(["pilot"]);
    });

    it("large ship with a turret gets pilot + gunner", () => {
      expect(getAvailableCrewRoles(true, false)).toEqual(["pilot", "gunner"]);
    });

    it("capital ship gets pilot + gunner + commander", () => {
      expect(getAvailableCrewRoles(true, true)).toEqual([
        "pilot",
        "gunner",
        "commander",
      ]);
    });

    it("cycles forward and wraps around", () => {
      const roles = getAvailableCrewRoles(true, true);
      expect(nextCrewRole("pilot", roles)).toBe("gunner");
      expect(nextCrewRole("gunner", roles)).toBe("commander");
      expect(nextCrewRole("commander", roles)).toBe("pilot");
    });

    it("falls back to pilot when current role is not in the available list", () => {
      const roles = getAvailableCrewRoles(false, false);
      expect(nextCrewRole("commander", roles)).toBe("pilot");
    });
  });

  describe("concentrate fire", () => {
    it("grants no bonus before an order is issued", () => {
      expect(concentrateFireMultiplier(null, "enemy_1", 0)).toBe(1);
    });

    it("grants the bonus against the called target while active", () => {
      const order = issueConcentrateFire("enemy_1", 1000);
      expect(concentrateFireMultiplier(order, "enemy_1", 1500)).toBe(
        1 + CONCENTRATE_FIRE_DAMAGE_BONUS,
      );
    });

    it("grants no bonus against a different target", () => {
      const order = issueConcentrateFire("enemy_1", 1000);
      expect(concentrateFireMultiplier(order, "enemy_2", 1500)).toBe(1);
    });

    it("expires after CONCENTRATE_FIRE_DURATION_MS", () => {
      const order = issueConcentrateFire("enemy_1", 1000);
      const justExpired = 1000 + CONCENTRATE_FIRE_DURATION_MS;
      expect(concentrateFireMultiplier(order, "enemy_1", justExpired)).toBe(1);
    });
  });

  describe("redirect power", () => {
    it("cycles engines -> turrets -> shields -> engines", () => {
      expect(nextPowerFocus(null)).toBe("engines");
      expect(nextPowerFocus("engines")).toBe("turrets");
      expect(nextPowerFocus("turrets")).toBe("shields");
      expect(nextPowerFocus("shields")).toBe("engines");
    });

    it("is focused on the chosen system while active", () => {
      const redirect = redirectPower("turrets", 1000);
      expect(isPowerFocused(redirect, "turrets", 1500)).toBe(true);
      expect(isPowerFocused(redirect, "engines", 1500)).toBe(false);
    });

    it("stops being focused after POWER_REDIRECT_DURATION_MS", () => {
      const redirect = redirectPower("shields", 1000);
      const justExpired = 1000 + POWER_REDIRECT_DURATION_MS;
      expect(isPowerFocused(redirect, "shields", justExpired)).toBe(false);
    });

    it("cannot redirect again until the cooldown elapses", () => {
      expect(
        canRedirectPower(1000, 1000 + POWER_REDIRECT_COOLDOWN_MS - 1),
      ).toBe(false);
      expect(canRedirectPower(1000, 1000 + POWER_REDIRECT_COOLDOWN_MS)).toBe(
        true,
      );
    });
  });

  describe("main beam charge", () => {
    it("starts uncharged and not charging", () => {
      const state = createMainBeamState();
      expect(state.charging).toBe(false);
      expect(isMainBeamReady(state)).toBe(false);
    });

    it("is not ready until the full charge duration has ticked", () => {
      let state = startCharging(createMainBeamState());
      state = tickMainBeam(state, MAIN_BEAM_CHARGE_DURATION_MS - 1);
      expect(isMainBeamReady(state)).toBe(false);
    });

    it("is ready once fully charged", () => {
      let state = startCharging(createMainBeamState());
      state = tickMainBeam(state, MAIN_BEAM_CHARGE_DURATION_MS);
      expect(isMainBeamReady(state)).toBe(true);
    });

    it("does not tick past full charge", () => {
      let state = startCharging(createMainBeamState());
      state = tickMainBeam(state, MAIN_BEAM_CHARGE_DURATION_MS * 5);
      expect(state.chargeMs).toBe(MAIN_BEAM_CHARGE_DURATION_MS);
    });

    it("does nothing while not charging", () => {
      const state = tickMainBeam(createMainBeamState(), 500);
      expect(state.chargeMs).toBe(0);
    });

    it("resets to a fresh uncharged state", () => {
      let state = startCharging(createMainBeamState());
      state = tickMainBeam(state, MAIN_BEAM_CHARGE_DURATION_MS);
      state = resetMainBeam();
      expect(state.charging).toBe(false);
      expect(state.chargeMs).toBe(0);
    });
  });

  describe("main beam cooldown", () => {
    it("cannot fire again until MAIN_BEAM_COOLDOWN_MS has passed", () => {
      expect(canFireMainBeam(1000, 1000 + MAIN_BEAM_COOLDOWN_MS - 1)).toBe(
        false,
      );
      expect(canFireMainBeam(1000, 1000 + MAIN_BEAM_COOLDOWN_MS)).toBe(true);
    });
  });

  describe("emergency repair", () => {
    it("cannot repair again until EMERGENCY_REPAIR_COOLDOWN_MS has passed", () => {
      expect(
        canEmergencyRepair(1000, 1000 + EMERGENCY_REPAIR_COOLDOWN_MS - 1),
      ).toBe(false);
      expect(
        canEmergencyRepair(1000, 1000 + EMERGENCY_REPAIR_COOLDOWN_MS),
      ).toBe(true);
    });
  });

  describe("createCommanderOrders", () => {
    it("starts with all orders idle and cooldowns already elapsed", () => {
      const orders = createCommanderOrders();
      expect(orders.concentrateFire).toBeNull();
      expect(orders.powerRedirect).toBeNull();
      expect(orders.mainBeam.charging).toBe(false);
      expect(canRedirectPower(orders.lastPowerRedirectAt, 0)).toBe(true);
      expect(canFireMainBeam(orders.lastMainBeamFiredAt, 0)).toBe(true);
      expect(canEmergencyRepair(orders.lastEmergencyRepairAt, 0)).toBe(true);
    });
  });
});
