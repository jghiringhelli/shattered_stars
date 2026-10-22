/**
 * Spec: Flight School never blocks a lesson. The trainee's stress and
 * special-maneuver recharge are cleared when a lesson starts (and while no
 * special is in flight), and a refused gesture always says why.
 *
 * The "real trace" cases drive the real pilot controls (PlayerFlightPilot +
 * the cycle engine) exactly as the scene does, to prove the Knife-roll
 * blockage: after the Hook lesson the trainee is stressed and recharging.
 */

import { describe, it, expect } from "vitest";
import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS } from "../../../src/config";
import {
  createCycleFlight,
  tickCycleFlight,
  type CycleFlightState,
} from "../../../src/arcade/systems/CycleFlight";
import {
  PlayerFlightPilot,
  type IntentSource,
} from "../../../src/arcade/systems/PlayerFlightPilot";
import type { FlightRefusal } from "../../../src/arcade/systems/FlightCapabilities";
import { INITIAL_STRESS } from "../../../src/arcade/ArcadeStress";
import { getShipDial } from "../../../src/data/ShipDefinitions";
import type { ActionIntent } from "../../../src/input/InputTypes";
import { FLIGHT_SCHOOL_STEPS } from "../../../src/tutorial/FlightSchoolSteps";
import {
  SCHOOL_TRAINEE_DEFINITION,
  TRAINER_LESSONS,
  isSpecialInProgress,
  rechargeNotice,
  refreshTrainee,
  refusalNotice,
  trainerFlight,
} from "../../../src/tutorial/TraineeSupport";

const FRAME_MS = 16;

/** The scene's per-frame loop, headless, on the trainee ship. */
class Trace {
  readonly held = new Set<ActionIntent>();
  flight: CycleFlightState = trainerFlight(
    createCycleFlight(SCHOOL_TRAINEE_DEFINITION, {
      x: 2000,
      y: 2000,
      angle: 0,
    }),
  );
  refusals: FlightRefusal[] = [];
  nowMs = 1000;
  private readonly source: IntentSource = {
    isHeld: (intent) => this.held.has(intent),
    onAny: () => 1,
    off: () => true,
  };
  private readonly pilot = new PlayerFlightPilot(this.source);
  private readonly dial = getShipDial(SCHOOL_TRAINEE_DEFINITION);

  step(durationMs: number): void {
    for (let t = 0; t < durationMs; t += FRAME_MS) {
      this.nowMs += FRAME_MS;
      const flown = this.pilot.fly({
        flight: this.flight,
        ship: this.flight.motion,
        dial: this.dial,
        nowMs: this.nowMs,
        deltaMs: FRAME_MS,
        worldSize: BATTLEFIELD_SIZE,
      });
      this.refusals.push(...flown.refusals);
      this.flight = { motion: flown.motion, stress: flown.stress };
      const tick = tickCycleFlight(this.flight, {
        deltaMs: FRAME_MS,
        worldSize: BATTLEFIELD_SIZE,
        dial: this.dial,
        cycleMs: CYCLE_DURATION_MS,
      });
      this.flight = tick.state;
      if (tick.completed)
        this.pilot.onCycleCommitted(
          tick.state.motion.control.currentManeuver ?? "straight",
        );
    }
  }

  press(intent: ActionIntent, holdMs = 60): void {
    this.held.add(intent);
    this.step(holdMs);
    this.held.delete(intent);
  }

  /** Tap Z (Snap turn), then let the 5 s recharge pass. */
  snapAndWait(): void {
    this.press("MANEUVER", 60);
    this.step(5200);
  }

  /** Hold Z + a side: the Hook, then let the cycles fly it out. */
  hook(): void {
    this.held.add("MANEUVER");
    this.step(64);
    this.held.add("STEER_LEFT");
    this.step(96);
    this.held.clear();
    this.step(CYCLE_DURATION_MS * 3);
  }

  /** Tap Z, press it again and keep it down, then a side. */
  knife(): void {
    this.press("MANEUVER", 48);
    this.step(32);
    this.held.add("MANEUVER");
    this.step(64);
    this.held.add("STEER_LEFT");
    this.step(96);
    this.held.clear();
  }

  get queued(): string | null {
    return this.flight.motion.control.nextManeuver;
  }
}

describe("why the Knife roll lesson got stuck (real pilot trace)", () => {
  it("refuses a Knife roll after the Snap and Hook lessons: the trainee is stressed", () => {
    const trace = new Trace();
    trace.snapAndWait();
    trace.hook();
    expect(trace.flight.stress.isStressed).toBe(true);
    trace.knife();
    expect(trace.refusals.map((r) => r.reason)).toContain("stressed");
    expect(trace.queued).not.toBe("tallon_left");
  });

  it("flies the Knife roll after the lesson-start refresh", () => {
    const trace = new Trace();
    trace.snapAndWait();
    trace.hook();
    trace.flight = refreshTrainee(trace.flight);
    trace.refusals = [];
    trace.knife();
    expect(trace.refusals).toEqual([]);
    expect(trace.queued).toBe("tallon_left");
  });

  it("is refused for the 5 s recharge too, even when not stressed", () => {
    const trace = new Trace();
    trace.hook();
    trace.flight = {
      ...trace.flight,
      stress: INITIAL_STRESS,
    };
    expect(trace.flight.motion.control.kturnCooldown).toBeGreaterThan(0);
    trace.knife();
    expect(trace.queued).not.toBe("tallon_left");
    expect(trace.refusals).toEqual([]);
  });

  it("completes Snap, Hook and Knife back to back when refreshed per lesson", () => {
    const trace = new Trace();
    trace.press("MANEUVER", 60);
    trace.step(400);
    expect(
      trace.queued === "kturn" ||
        isSpecialInProgress(trace.flight.motion.control),
    ).toBe(true);
    trace.step(CYCLE_DURATION_MS * 3);
    trace.flight = refreshTrainee(trace.flight);
    trace.hook();
    trace.flight = refreshTrainee(trace.flight);
    trace.knife();
    expect(trace.queued).toBe("tallon_left");
  });
});

describe("refreshTrainee", () => {
  it("clears stress and every recharge but keeps the pose and speed", () => {
    const trace = new Trace();
    trace.hook();
    const before = trace.flight;
    const after = refreshTrainee(before);
    expect(after.stress).toEqual(INITIAL_STRESS);
    const control = after.motion.control;
    expect(control.kturnCooldown).toBe(0);
    expect(control.barrelRollCooldown).toBe(0);
    expect(control.boostCooldown).toBe(0);
    expect(control.speed).toBe(before.motion.control.speed);
    expect(after.motion.x).toBe(before.motion.x);
    expect(after.motion.control.nextManeuver).toBe(
      before.motion.control.nextManeuver,
    );
  });
});

describe("the trainee ship", () => {
  it("may fly every special and both dashes, on the unrestricted rule", () => {
    const { capabilities } = trainerFlight(
      createCycleFlight(SCHOOL_TRAINEE_DEFINITION, { x: 0, y: 0, angle: 0 }),
    ).motion.control;
    expect(capabilities?.boost).toBe(true);
    expect(capabilities?.barrelRoll).toBe(true);
    for (const special of [
      "kturn",
      "segnor_left",
      "segnor_right",
      "tallon_left",
      "tallon_right",
    ] as const)
      expect(capabilities?.specials[special], special).toBeDefined();
  });
});

describe("isSpecialInProgress", () => {
  it("is true while a special is flying or queued", () => {
    const trace = new Trace();
    expect(isSpecialInProgress(trace.flight.motion.control)).toBe(false);
    trace.knife();
    expect(isSpecialInProgress(trace.flight.motion.control)).toBe(true);
  });
});

describe("refusal notices", () => {
  it.each([
    [{ action: "tallon", reason: "stressed" }, "STRESSED: NO KNIFE ROLL"],
    [{ action: "segnor", reason: "not_on_dial" }, "HOOK LOOP NOT ON DIAL"],
    [{ action: "boost", reason: "no_action" }, "NO BOOST ACTION"],
  ] as const)("%j reads %s", (refusal, text) => {
    expect(refusalNotice(refusal)).toContain(text);
  });

  it("says a recharging special is RECHARGING with the seconds left", () => {
    expect(rechargeNotice("tallon", 3200)).toBe(
      "RECHARGING: KNIFE ROLL ready in 3.2 s",
    );
    expect(rechargeNotice("boost", 0)).toBeNull();
  });
});

describe("lesson plan flags", () => {
  it("keeps the trainee free on the special and dash lessons (and the radar turn)", () => {
    expect(Object.keys(TRAINER_LESSONS)).toEqual([
      "kturn",
      "segnor",
      "tallon",
      "boost",
      "barrel_roll",
      "radar",
    ]);
    const ids = FLIGHT_SCHOOL_STEPS.map((s) => s.id);
    for (const id of Object.keys(TRAINER_LESSONS)) expect(ids).toContain(id);
  });

  it("names the trick each special lesson teaches", () => {
    expect(TRAINER_LESSONS["tallon"]).toBe("tallon");
    expect(TRAINER_LESSONS["barrel_roll"]).toBe("barrel_roll");
    expect(TRAINER_LESSONS["radar"]).toBeNull();
  });

  it("no prompt mentions the removed 500 ms beat bar", () => {
    for (const step of FLIGHT_SCHOOL_STEPS)
      expect(step.prompt(() => "K")).not.toMatch(/beat bar|watch the beat/i);
  });
});
