/**
 * Spec: the Flight School step machine. Each lesson completes only when the
 * player's REAL flight state shows the taught input took effect (throttle
 * changed, maneuver queued/flown, dash cooldown started, weapon/mark used);
 * prompts always name the key from the player's active bindings.
 */

import { describe, it, expect } from "vitest";
import {
  FLIGHT_SCHOOL_STEPS,
  advanceFlightSchool,
  currentStep,
  skipFlightSchoolStep,
  startFlightSchool,
  type FlightSchoolObservation,
  type FlightSchoolState,
} from "../../../src/tutorial/FlightSchoolSteps";

const IDLE: FlightSchoolObservation = {
  nowMs: 0,
  speed: 3,
  minSpeed: 1,
  maxSpeed: 5,
  currentManeuver: "straight",
  nextManeuver: null,
  boostCooldownMs: 0,
  barrelRollCooldownMs: 0,
  pressed: new Set(),
  primaryHits: 0,
  secondaryShots: 0,
  markedTargetId: null,
  beaconOnScreen: false,
  enemiesAlive: 0,
};

/** Feed one observation; returns the new state. */
function feed(
  state: FlightSchoolState,
  patch: Partial<FlightSchoolObservation>,
): FlightSchoolState {
  return advanceFlightSchool(state, { ...IDLE, ...patch }).state;
}

/** Run the machine to the step with `id`. */
function reach(id: string): FlightSchoolState {
  let state = startFlightSchool(0);
  while (currentStep(state)?.id !== id) state = skipFlightSchoolStep(state, 0);
  return feed(state, {});
}

describe("Flight School step machine", () => {
  it("starts on the throttle lesson and lists every taught skill in order", () => {
    expect(currentStep(startFlightSchool(0))?.id).toBe("throttle_up");
    expect(FLIGHT_SCHOOL_STEPS.map((s) => s.id)).toEqual([
      "throttle_up",
      "throttle_down",
      "drift",
      "bank",
      "hard_turn",
      "kturn",
      "segnor",
      "tallon",
      "boost",
      "barrel_roll",
      "primary_fire",
      "secondary",
      "mark",
      "radar",
      "status_ring",
      "final_fight",
    ]);
  });

  it("completes throttle-up only when the speed actually rises two notches", () => {
    let state = feed(startFlightSchool(0), { speed: 3 });
    state = feed(state, { speed: 4 });
    expect(currentStep(state)?.id).toBe("throttle_up");
    const result = advanceFlightSchool(state, { ...IDLE, speed: 5 });
    expect(result.event).toBe("step_complete");
    expect(currentStep(result.state)?.id).toBe("throttle_down");
  });

  it("treats a ship already at max as complete once it is at max", () => {
    const state = feed(startFlightSchool(0), { speed: 5 });
    expect(currentStep(state)?.id).toBe("throttle_down");
  });

  it("completes throttle-down when the speed drops two notches (or hits minimum)", () => {
    let state = reach("throttle_down");
    state = feed(state, { speed: 5 });
    state = feed(state, { speed: 3 });
    expect(currentStep(state)?.id).toBe("drift");
  });

  it("drift needs a drift maneuver queued or flying — a straight cycle is not enough", () => {
    let state = reach("drift");
    state = feed(state, { currentManeuver: "straight" });
    expect(currentStep(state)?.id).toBe("drift");
    state = feed(state, { nextManeuver: "drift_left" });
    expect(currentStep(state)?.id).toBe("bank");
  });

  it.each([
    ["bank", "bank_right"],
    ["hard_turn", "turn_left"],
    ["kturn", "kturn"],
    ["segnor", "segnor_right"],
    ["tallon", "tallon_left"],
  ] as const)("%s completes on the %s maneuver", (id, maneuver) => {
    const state = feed(reach(id), { currentManeuver: maneuver });
    expect(currentStep(state)?.id).not.toBe(id);
  });

  it("boost and barrel roll complete when their cooldowns start", () => {
    let state = feed(reach("boost"), { boostCooldownMs: 2900 });
    expect(currentStep(state)?.id).toBe("barrel_roll");
    state = feed(state, { barrelRollCooldownMs: 1900 });
    expect(currentStep(state)?.id).toBe("primary_fire");
  });

  it("primary fire needs three hits on the drone", () => {
    let state = feed(reach("primary_fire"), { primaryHits: 2 });
    expect(currentStep(state)?.id).toBe("primary_fire");
    state = feed(state, { primaryHits: 3 });
    expect(currentStep(state)?.id).toBe("secondary");
  });

  it("secondary, mark and radar complete on their real effects", () => {
    let state = feed(reach("secondary"), { secondaryShots: 1 });
    expect(currentStep(state)?.id).toBe("mark");
    state = feed(state, { markedTargetId: "drone" });
    expect(currentStep(state)?.id).toBe("radar");
    state = feed(state, { beaconOnScreen: true });
    expect(currentStep(state)?.id).toBe("status_ring");
  });

  it("the status ring lesson is acknowledged with CONFIRM", () => {
    const state = feed(reach("status_ring"), { pressed: new Set(["CONFIRM"]) });
    expect(currentStep(state)?.id).toBe("final_fight");
  });

  it("the final fight completes the course when the bot is destroyed", () => {
    let state = feed(reach("final_fight"), { enemiesAlive: 1 });
    const result = advanceFlightSchool(state, { ...IDLE, enemiesAlive: 0 });
    expect(result.event).toBe("course_complete");
    state = result.state;
    expect(state.completed).toBe(true);
    expect(currentStep(state)).toBeNull();
  });

  it("does not count a bot that was never spawned as destroyed", () => {
    const state = feed(reach("final_fight"), { enemiesAlive: 0 });
    expect(currentStep(state)?.id).toBe("final_fight");
  });

  it("prompts name the player's bound keys", () => {
    const mark = FLIGHT_SCHOOL_STEPS.find((s) => s.id === "mark")!;
    const keys = (intent: string): string =>
      intent === "MARK_TARGET" ? "K" : "?";
    expect(mark.prompt(keys)).toContain("[K]");
  });

  it("every step's prompt mentions at least one key", () => {
    for (const step of FLIGHT_SCHOOL_STEPS)
      expect(step.prompt(() => "KEY")).toMatch(/\[KEY\]/);
  });
});
