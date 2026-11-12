/**
 * Telemetry of instant turns — a cycle a human's turn cuts ends exactly on the
 * template arc at the progress it was cut (the prefix of its path), the turn
 * then flies as a full template from that pose, and neither the heading nor the
 * position jumps at the cut. Uninterrupted cycles still end on their template.
 */

import { describe, it, expect } from "vitest";
import {
  ARCADE_FIXED_TICK_MS,
  flyArcadeShip,
  type FlightRecord,
  type TimedInterrupt,
} from "../../../../src/simulation/flight/ArcadeFlightRecorder";
import {
  headingDelta,
  predictArcPose,
  predictManeuver,
  torusDisplacement,
  type FlightStep,
  type Pose,
} from "../../../../src/simulation/flight/XWingFlightOracle";
import { BATTLEFIELD_SIZE } from "../../../../src/config";
import { CYCLE_INTERRUPT_MIN_ELAPSED_MS } from "../../../../src/core/cycleInterrupt";

const START: Pose = { x: 3000, y: 3000, angle: 0 };
const END_POSITION_TOLERANCE_PX = 2;
const END_HEADING_TOLERANCE_DEG = 1;
/** The path is a 20-segment polyline: the cut pose is on the arc to this (px / deg). */
const PREFIX_POSITION_TOLERANCE_PX = 0.5;
const PREFIX_HEADING_TOLERANCE_DEG = 0.5;
/** Largest heading change of one 60 Hz tick: a 90° turn over 30 ticks. */
const MAX_HEADING_STEP_PER_TICK_DEG = 3.5;

const straights = (count: number, speed = 3): FlightStep[] =>
  Array.from({ length: count }, () => ({ direction: "straight", speed }));

/** Start pose of cycle `index`. */
const startOf = (record: FlightRecord, index: number): Pose =>
  index === 0 ? START : record.cyclePoses[index - 1]!;

/** Every cycle ends on its template (full) or on the arc prefix (cut). */
function expectEveryCycleOnItsTemplate(record: FlightRecord): void {
  record.cyclePoses.forEach((end, index) => {
    const step = {
      direction: record.cycleDirections[index]!,
      speed: record.cycleSpeeds[index]!,
    };
    const fraction = record.cycleFractions[index]!;
    const start = startOf(record, index);
    if (fraction === 1) {
      const want = predictManeuver(start, step, record.baseSize);
      const d = torusDisplacement(want, end, BATTLEFIELD_SIZE);
      expect(Math.hypot(d.dx, d.dy)).toBeLessThanOrEqual(
        END_POSITION_TOLERANCE_PX,
      );
      expect(Math.abs(headingDelta(want.angle, end.angle))).toBeLessThanOrEqual(
        END_HEADING_TOLERANCE_DEG,
      );
      return;
    }
    const want = predictArcPose(start, step, record.baseSize, fraction);
    const d = torusDisplacement(want, end, BATTLEFIELD_SIZE);
    expect(Math.hypot(d.dx, d.dy)).toBeLessThanOrEqual(
      PREFIX_POSITION_TOLERANCE_PX,
    );
    expect(Math.abs(headingDelta(want.angle, end.angle))).toBeLessThanOrEqual(
      PREFIX_HEADING_TOLERANCE_DEG,
    );
  });
}

const interrupt = (
  atMs: number,
  direction: TimedInterrupt["direction"],
): TimedInterrupt => ({ atMs, direction });

describe("instant turns — flight telemetry", () => {
  it("an uninterrupted flight still ends every cycle on its template", () => {
    const record = flyArcadeShip("terran_gladius", [
      { direction: "straight", speed: 3 },
      { direction: "bank_left", speed: 2 },
      { direction: "turn_right", speed: 2 },
      { direction: "straight", speed: 3 },
    ]);
    expect(record.cycleFractions).toEqual([1, 1, 1, 1]);
    expectEveryCycleOnItsTemplate(record);
  });

  it("a cut cycle ends at predictArcPose at its progress, then a full template flies from there", () => {
    const record = flyArcadeShip("terran_gladius", straights(4), {
      interrupts: [interrupt(700, "bank_left")],
    });
    expect(record.cycleFractions[0]).toBe(1);
    expect(record.cycleFractions[1]).toBeGreaterThan(0.3);
    expect(record.cycleFractions[1]).toBeLessThan(0.5);
    expect(record.cycleDirections[1]).toBe("straight");
    expect(record.cycleDirections[2]).toBe("bank_left");
    expect(record.cycleFractions[2]).toBe(1);
    expectEveryCycleOnItsTemplate(record);
  });

  it("the turn runs its own 500 ms after the cut, not the rest of the old cycle", () => {
    const record = flyArcadeShip("terran_gladius", straights(4), {
      interrupts: [interrupt(700, "turn_right")],
    });
    const cutAt = record.cycleEndMs[1]!;
    expect(record.cycleEndMs[2]! - cutAt).toBeCloseTo(500, 0);
  });

  it("a request inside the minimum cycle age is delayed to it, never refused", () => {
    const record = flyArcadeShip("terran_gladius", straights(4), {
      interrupts: [interrupt(520, "drift_right")],
    });
    expect(record.cycleDirections[2]).toBe("drift_right");
    expect(record.cycleFractions[1]! * 500).toBeGreaterThanOrEqual(
      CYCLE_INTERRUPT_MIN_ELAPSED_MS - 1,
    );
    expectEveryCycleOnItsTemplate(record);
  });

  it("no heading discontinuity and no position jump at any cut", () => {
    const record = flyArcadeShip("terran_viper", straights(8), {
      interrupts: [
        interrupt(650, "bank_right"),
        interrupt(1400, "turn_left"),
        interrupt(2100, "drift_right"),
        interrupt(2300, "bank_left"),
      ],
    });
    expectEveryCycleOnItsTemplate(record);
    const { samples } = record;
    for (let i = 1; i < samples.length; i++) {
      const step = Math.abs(
        headingDelta(samples[i]!.angle, samples[i - 1]!.angle),
      );
      expect(step).toBeLessThanOrEqual(MAX_HEADING_STEP_PER_TICK_DEG);
    }
    expect(record.maxTickJumpPx).toBeLessThan(8);
  });

  it("holds across every light, heavy and bomber hull and many cut times", () => {
    for (const id of [
      "terran_viper",
      "terran_gladius",
      "terran_hammer",
      "synth_drone",
    ]) {
      for (let at = 620; at < 1000; at += 47) {
        const record = flyArcadeShip(id, straights(5, 2), {
          interrupts: [
            interrupt(at, at % 2 === 0 ? "bank_left" : "turn_right"),
          ],
          tickMs: ARCADE_FIXED_TICK_MS,
        });
        expectEveryCycleOnItsTemplate(record);
      }
    }
  });
});
