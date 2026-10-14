/**
 * Flight telemetry battery — arcade engine (ArcadeBattleScene / skirmish).
 *
 * Every ship (fighters, bombers, gunships, supports and epic capitals) is flown
 * through the REAL per-tick motion step for several cycles. At every cycle end
 * its pose is compared with the X-Wing 2.0 oracle. If a ship is not where the
 * rules say it must be after N cycles, movement is broken.
 *
 * Covers: every dial maneuver of every ship, mixed plans, closed loops, cycle
 * timing, seam crossing, boost, barrel roll and relative pursuit geometry.
 */

import { describe, it, expect } from "vitest";
import {
  SHIP_DEFINITIONS,
  getMovementProfile,
  getShipDial,
} from "../../../../src/data/ShipDefinitions";
import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS } from "../../../../src/config";
import { BOOST_DISTANCE_PX } from "../../../../src/arcade/ArcadeInputGestures";
import {
  ARCADE_FIXED_TICK_MS,
  flyArcadeShip,
  type FlightRecord,
} from "../../../../src/simulation/flight/ArcadeFlightRecorder";
import {
  headingDelta,
  predictArcPose,
  predictBarrelRoll,
  predictFlight,
  translate,
  type FlightStep,
  type Pose,
} from "../../../../src/simulation/flight/XWingFlightOracle";

/** Position tolerance at a cycle end (px). */
const POS_TOL = 0.5;
/** Heading tolerance at a cycle end (deg). */
const ANGLE_TOL = 0.1;
/** Cycles flown per maneuver. */
const CYCLES = 4;
/** A non-axis start heading, so rotation bugs cannot hide behind 0°/90°. */
const START: Pose = { x: 3000, y: 3000, angle: 37 };

/**
 * Compare a recorded flight with the oracle cycle by cycle.
 * @param record - What the game did.
 * @param expected - What the rules say.
 * @returns Human-readable mismatches (empty when the flight is correct).
 */
function mismatches(record: FlightRecord, expected: Pose[]): string[] {
  const out: string[] = [];
  expected.forEach((want, i) => {
    const got = record.cyclePoses[i];
    if (!got) {
      out.push(`cycle ${i}: never completed`);
      return;
    }
    const posErr = Math.hypot(got.x - want.x, got.y - want.y);
    const angErr = Math.abs(headingDelta(got.angle, want.angle));
    if (posErr > POS_TOL || angErr > ANGLE_TOL) {
      out.push(
        `cycle ${i}: at (${got.x.toFixed(1)}, ${got.y.toFixed(1)}, ${got.angle.toFixed(1)}°) ` +
          `expected (${want.x.toFixed(1)}, ${want.y.toFixed(1)}, ${want.angle.toFixed(1)}°)`,
      );
    }
  });
  return out;
}

/**
 * Fly a plan and diff it against the oracle.
 * @param shipId - Ship definition id.
 * @param plan - Maneuvers, one per cycle.
 * @param start - Start pose.
 * @returns Mismatch descriptions.
 */
function verifyPlan(
  shipId: string,
  plan: FlightStep[],
  start: Pose = START,
): string[] {
  const record = flyArcadeShip(shipId, plan, { start });
  return mismatches(record, predictFlight(start, plan, record.baseSize));
}

const SHIP_IDS = Object.keys(SHIP_DEFINITIONS);

describe("arcade flight — every ship flies every dial maneuver to the X-Wing pose", () => {
  for (const shipId of SHIP_IDS) {
    it(`${shipId} (${SHIP_DEFINITIONS[shipId]!.role}, ${SHIP_DEFINITIONS[shipId]!.baseStats.size})`, () => {
      const failures = getShipDial(shipId).flatMap((m) => {
        const plan = Array.from({ length: CYCLES }, () => ({
          direction: m.direction,
          speed: m.speed,
        }));
        return verifyPlan(shipId, plan).map(
          (f) => `${m.direction} ${m.speed}: ${f}`,
        );
      });
      expect(failures).toEqual([]);
    });
  }
});

describe("arcade flight — mid-cycle the ship rides the template's arc", () => {
  /** Mid-cycle tolerance (px): waypoint interpolation error on tight arcs. */
  const MID_TOL = 1;

  for (const shipId of SHIP_IDS) {
    it(`${shipId} stays on the arc, nose tangent, through every tick`, () => {
      const capital = getMovementProfile(shipId) === "capital";
      const failures = getShipDial(shipId)
        .filter((m) => m.direction !== "straight")
        .flatMap((m) => {
          const step = { direction: m.direction, speed: m.speed };
          const record = flyArcadeShip(shipId, [step], { start: START });
          return record.samples
            .filter((s) => s.tMs < CYCLE_DURATION_MS)
            .flatMap((s) => {
              const t = s.tMs / CYCLE_DURATION_MS;
              const want = predictArcPose(
                START,
                step,
                record.baseSize,
                capital ? t * t : t,
              );
              const posErr = Math.hypot(s.x - want.x, s.y - want.y);
              const angErr = Math.abs(headingDelta(s.angle, want.angle));
              return posErr > MID_TOL || angErr > 0.5
                ? [
                    `${m.direction} ${m.speed} @${s.tMs.toFixed(0)}ms: off by ${posErr.toFixed(2)}px / ${angErr.toFixed(2)}°`,
                  ]
                : [];
            });
        });
      expect(failures).toEqual([]);
    });
  }

  it("a hard turn sweeps twice the heading of a bank in the same cycle, on a tighter radius", () => {
    const turn = flyArcadeShip(
      "terran_viper",
      [{ direction: "turn_right", speed: 2 }],
      {
        start: { x: 3000, y: 3000, angle: 0 },
      },
    );
    const bank = flyArcadeShip(
      "terran_viper",
      [{ direction: "bank_right", speed: 2 }],
      {
        start: { x: 3000, y: 3000, angle: 0 },
      },
    );
    const half = (r: FlightRecord) =>
      r.samples.find((s) => s.tMs >= CYCLE_DURATION_MS / 2)!;
    expect(half(turn).angle).toBeCloseTo(2 * half(bank).angle, 0);
    // Same chord length, but the turn ends further to the side: tighter radius.
    expect(turn.cyclePoses[0]!.x - 3000).toBeGreaterThan(
      bank.cyclePoses[0]!.x - 3000,
    );
  });
});

describe("arcade flight — mixed plans and closed loops", () => {
  it("an interceptor flying a mixed plan lands on every oracle pose", () => {
    const plan: FlightStep[] = [
      { direction: "straight", speed: 4 },
      { direction: "bank_left", speed: 2 },
      { direction: "turn_right", speed: 1 },
      { direction: "kturn", speed: 4 },
      { direction: "tallon_left", speed: 3 },
      { direction: "straight", speed: 5 },
    ];
    expect(verifyPlan("terran_viper", plan)).toEqual([]);
  });

  it("four hard right turns bring a fighter back to its start pose", () => {
    const plan = Array.from({ length: 4 }, () => ({
      direction: "turn_right" as const,
      speed: 2,
    }));
    const end = flyArcadeShip("confed_falcon", plan, { start: START })
      .cyclePoses[3]!;
    expect(Math.hypot(end.x - START.x, end.y - START.y)).toBeLessThan(POS_TOL);
    expect(Math.abs(headingDelta(end.angle, START.angle))).toBeLessThan(
      ANGLE_TOL,
    );
  });

  it("two Snap turns bring a ship back to where it started", () => {
    const plan = Array.from({ length: 2 }, () => ({
      direction: "kturn" as const,
      speed: 3,
    }));
    const end = flyArcadeShip("terran_stiletto", plan, { start: START })
      .cyclePoses[1]!;
    expect(Math.hypot(end.x - START.x, end.y - START.y)).toBeLessThan(POS_TOL);
    expect(Math.abs(headingDelta(end.angle, START.angle))).toBeLessThan(
      ANGLE_TOL,
    );
  });

  it("a Hook Loop leaves the ship facing back toward where it came from", () => {
    const end = flyArcadeShip(
      "confed_raven",
      [{ direction: "segnor_left", speed: 3 }],
      {
        start: { x: 3000, y: 3000, angle: 0 },
      },
    ).cyclePoses[0]!;
    const backToStart =
      (Math.atan2(3000 - end.x, -(3000 - end.y)) * 180) / Math.PI;
    expect(Math.abs(headingDelta(end.angle, backToStart))).toBeLessThan(45);
  });
});

describe("arcade flight — timing", () => {
  it("completes one maneuver every CYCLE_DURATION_MS on the scene's fixed tick", () => {
    const plan = Array.from({ length: 10 }, () => ({
      direction: "straight" as const,
      speed: 3,
    }));
    const { cycleEndMs } = flyArcadeShip("terran_viper", plan);
    expect(cycleEndMs[9]!).toBeGreaterThanOrEqual(10 * CYCLE_DURATION_MS);
    expect(cycleEndMs[9]! - 10 * CYCLE_DURATION_MS).toBeLessThan(
      ARCADE_FIXED_TICK_MS,
    );
  });

  it("lands on the same poses whatever the tick length", () => {
    const plan: FlightStep[] = [
      { direction: "turn_left", speed: 2 },
      { direction: "bank_right", speed: 3 },
      { direction: "straight", speed: 4 },
    ];
    const at60 = flyArcadeShip("terran_viper", plan, {
      start: START,
      tickMs: 1000 / 60,
    });
    const at144 = flyArcadeShip("terran_viper", plan, {
      start: START,
      tickMs: 1000 / 144,
    });
    const jittered = flyArcadeShip("terran_viper", plan, {
      start: START,
      tickMs: (i) => 5 + ((i * 37) % 45),
    });
    for (const other of [at144, jittered]) {
      other.cyclePoses.forEach((pose, i) => {
        expect(
          Math.hypot(
            pose.x - at60.cyclePoses[i]!.x,
            pose.y - at60.cyclePoses[i]!.y,
          ),
        ).toBeLessThan(POS_TOL);
      });
    }
  });
});

describe("arcade flight — seam crossing", () => {
  it("crosses the battlefield edge without a jump and keeps its course", () => {
    const start: Pose = { x: 3000, y: 100, angle: 0 };
    const plan = Array.from({ length: 3 }, () => ({
      direction: "straight" as const,
      speed: 4,
    }));
    const record = flyArcadeShip("terran_viper", plan, { start });
    expect(
      mismatches(record, predictFlight(start, plan, record.baseSize)),
    ).toEqual([]);
    expect(record.maxTickJumpPx).toBeLessThan(60);
  });
});

describe("arcade flight — actions", () => {
  const start: Pose = { x: 3000, y: 3000, angle: 0 };
  const twoStraights = Array.from({ length: 2 }, () => ({
    direction: "straight" as const,
    speed: 3,
  }));

  it("a boost moves the ship forward and the rest of the cycle continues from there", () => {
    const record = flyArcadeShip("terran_viper", twoStraights, {
      start,
      actions: [{ atMs: 250, action: "boost" }],
    });
    const expected = predictFlight(start, twoStraights, record.baseSize).map(
      (p) => translate(p, 0, BOOST_DISTANCE_PX),
    );
    expect(mismatches(record, expected)).toEqual([]);
  });

  it("a barrel roll slides the ship sideways without turning it", () => {
    const record = flyArcadeShip("terran_viper", twoStraights, {
      start,
      actions: [{ atMs: 250, action: "barrel_roll_left" }],
    });
    const expected = predictFlight(start, twoStraights, record.baseSize).map(
      (p) => predictBarrelRoll(p, "left", record.baseSize),
    );
    expect(mismatches(record, expected)).toEqual([]);
  });
});

describe("arcade flight — relative pursuit geometry", () => {
  it("a chaser flying the same plan keeps a constant separation", () => {
    const plan: FlightStep[] = [
      { direction: "straight", speed: 3 },
      { direction: "bank_left", speed: 3 },
      { direction: "turn_right", speed: 2 },
    ];
    const leaderStart: Pose = { x: 3000, y: 2700, angle: 0 };
    const leader = flyArcadeShip("terran_viper", plan, { start: leaderStart });
    const chaserStart: Pose = { x: 3000, y: 3000, angle: 0 };
    const chaser = flyArcadeShip("terran_viper", plan, { start: chaserStart });
    const gap0 = Math.hypot(
      leaderStart.x - chaserStart.x,
      leaderStart.y - chaserStart.y,
    );
    leader.cyclePoses.forEach((pose, i) => {
      const c = chaser.cyclePoses[i]!;
      expect(Math.hypot(pose.x - c.x, pose.y - c.y)).toBeCloseTo(gap0, 0);
    });
  });

  it("one speed step faster closes the gap by one template unit per cycle", () => {
    const start: Pose = { x: 3000, y: 3000, angle: 0 };
    const target = flyArcadeShip(
      "terran_viper",
      Array.from({ length: 4 }, () => ({
        direction: "straight" as const,
        speed: 2,
      })),
      { start: { x: 3000, y: 2400, angle: 0 } },
    );
    const chaser = flyArcadeShip(
      "terran_viper",
      Array.from({ length: 4 }, () => ({
        direction: "straight" as const,
        speed: 3,
      })),
      { start },
    );
    const gaps = target.cyclePoses.map((p, i) => chaser.cyclePoses[i]!.y - p.y);
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i - 1]! - gaps[i]!).toBeCloseTo(40, 3);
    }
  });
});

/** Sanity: the battlefield constant the recorder wraps on. */
it("flies on the scene's battlefield", () => {
  expect(BATTLEFIELD_SIZE).toBeGreaterThan(1000);
});
