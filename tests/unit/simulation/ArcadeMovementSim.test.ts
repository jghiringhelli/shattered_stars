/**
 * Headless Arcade Movement Simulation
 *
 * Verifies that all 101 ships move correctly through the discrete cycle system:
 *   - Per-cycle displacement = speed × SPEED_SCALE_FACTOR + baseSize  (straight)
 *   - Angle changes exactly match ManeuverTemplate.deltaAngle
 *   - Paths are continuous (no teleportation between cycles)
 *   - Position snapshots at each half-second align with expected geometry
 *
 * No rendering, no Phaser — pure TypeScript logic.
 */

import { describe, it, expect } from "vitest";
import {
  SHIP_DEFINITIONS,
  getShipDial,
} from "../../../src/data/ShipDefinitions";
import { resolveManeuver, distance } from "../../../src/systems/MovementSystem";
import {
  createControlState,
  updateManeuver,
  advanceCycle,
  processCommand,
  startManeuver,
  type ShipControlState,
} from "../../../src/core/ArcadeControls";
import type { ShipState, ManeuverDirection } from "../../../src/core/types";
import {
  SPEED_SCALE_FACTOR,
  CYCLE_DURATION_MS,
  SHIP_SIZES,
} from "../../../src/config";

// ============================================
// Helpers
// ============================================

function makeShip(id: string, x = 3000, y = 3000, angle = 0): ShipState {
  return {
    id,
    definitionId: id,
    faction: "terran_hegemony",
    owner: "ai",
    x,
    y,
    angle,
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
  };
}

interface CycleSnapshot {
  cycle: number;
  x: number;
  y: number;
  angle: number;
  maneuver: ManeuverDirection;
  speed: number;
}

/**
 * Simulates one complete cycle (ticking at 16ms increments) and returns the
 * final ship position/angle as a snapshot.
 * Returns the updated ship state and the control state that has already called
 * advanceCycle (ready for the next cycle).
 */
function simulateCycle(
  ship: ShipState,
  control: ShipControlState,
): { ship: ShipState; control: ShipControlState; snapshot: CycleSnapshot } {
  let currentShip = { ...ship };
  let currentControl = control;
  const tick = 16; // ms per frame
  let elapsed = 0;

  while (elapsed < CYCLE_DURATION_MS) {
    const remaining = CYCLE_DURATION_MS - elapsed;
    const dt = Math.min(tick, remaining);
    const {
      control: nextControl,
      position,
      cycleComplete,
    } = updateManeuver(currentControl, dt);
    currentControl = nextControl;
    if (position) {
      currentShip = {
        ...currentShip,
        x: position.x,
        y: position.y,
        angle: position.angle,
      };
    }
    elapsed += dt;
    if (cycleComplete) break;
  }

  const snapshot: CycleSnapshot = {
    cycle: 0,
    x: currentShip.x,
    y: currentShip.y,
    angle: currentShip.angle,
    maneuver: currentControl.currentManeuver ?? "straight",
    speed: currentControl.speed,
  };

  currentControl = advanceCycle(currentShip, currentControl);
  return { ship: currentShip, control: currentControl, snapshot };
}

/**
 * Seeds a ship directly into the given maneuver+speed (bypassing the warmup
 * straight cycle that createControlState inserts), then runs N full cycles
 * all executing that same maneuver.  Returns a snapshot for each cycle.
 */
function runCycles(
  shipId: string,
  direction: ManeuverDirection,
  speed: number,
  numCycles: number,
  startX = 3000,
  startY = 3000,
  startAngle = 0,
): CycleSnapshot[] {
  const def = SHIP_DEFINITIONS[shipId];
  if (!def) throw new Error(`Ship not found: ${shipId}`);

  const baseSize = SHIP_SIZES[def.baseStats.size] ?? 32;
  let ship = makeShip(shipId, startX, startY, startAngle);
  let control = createControlState(ship, baseSize);
  // Override speed, then use startManeuver to bypass the warmup straight cycle.
  control = { ...control, speed };
  control = startManeuver(ship, control, direction);

  const snapshots: CycleSnapshot[] = [];

  for (let i = 0; i < numCycles; i++) {
    // Queue same direction so advanceCycle keeps executing it.
    control = { ...control, nextManeuver: direction };
    const result = simulateCycle(ship, control);
    ship = result.ship;
    control = result.control;
    snapshots.push({ ...result.snapshot, cycle: i });
  }

  return snapshots;
}

// ============================================
// Core geometry invariants
// ============================================

describe("ArcadeMovementSim — core geometry invariants", () => {
  it("straight maneuver travels speed × SPEED_SCALE_FACTOR + baseSize per cycle", () => {
    const testCases: Array<{ id: string; speed: number }> = [
      { id: "terran_gladius", speed: 1 },
      { id: "terran_gladius", speed: 2 },
      { id: "terran_gladius", speed: 3 },
    ];

    for (const { id, speed } of testCases) {
      const def = SHIP_DEFINITIONS[id];
      if (!def) continue;

      const baseSize = SHIP_SIZES[def.baseStats.size] ?? 32;
      const expectedDist = speed * SPEED_SCALE_FACTOR + baseSize;

      const [snap] = runCycles(id, "straight", speed, 1);
      if (!snap) continue;

      const actualDist = distance(3000, 3000, snap.x, snap.y);
      expect(actualDist).toBeCloseTo(expectedDist, 0);
    }
  });

  it("N straight cycles travel N × templateLength total (path is continuous)", () => {
    const id = "terran_gladius";
    const def = SHIP_DEFINITIONS[id]!;
    const baseSize = SHIP_SIZES[def.baseStats.size] ?? 32;
    const speed = 3;
    const templateLength = speed * SPEED_SCALE_FACTOR + baseSize;

    const snaps = runCycles(id, "straight", speed, 5);

    for (let i = 1; i < snaps.length; i++) {
      const prev = snaps[i - 1]!;
      const curr = snaps[i]!;
      const stepDist = distance(prev.x, prev.y, curr.x, curr.y);
      expect(stepDist).toBeCloseTo(templateLength, 0);
    }
  });

  it("bank_left rotates -45° per cycle (ship facing 0°)", () => {
    const id = "terran_gladius";
    const snaps = runCycles(id, "bank_left", 2, 1);
    expect(snaps[0]!.angle).toBeCloseTo(315, 0); // 0° + (-45°) normalised
  });

  it("turn_left rotates -90° per cycle", () => {
    const id = "terran_gladius";
    const snaps = runCycles(id, "turn_left", 2, 1);
    expect(snaps[0]!.angle).toBeCloseTo(270, 0);
  });

  it("kturn rotates 180° and ends near starting x", () => {
    const id = "terran_gladius";
    const snaps = runCycles(id, "kturn", 2, 1);
    const snap = snaps[0]!;

    expect(snap.angle).toBeCloseTo(180, 0);
    expect(Math.abs(snap.x - 3000)).toBeLessThan(10);
  });

  it("larger ships cover more distance per cycle at same speed", () => {
    const allDefs = Object.entries(SHIP_DEFINITIONS);
    const smallEntry = allDefs.find(([, d]) => d.baseStats.size === "small");
    const largeEntry = allDefs.find(([, d]) => d.baseStats.size === "large");
    if (!smallEntry || !largeEntry) return;

    const [smallId] = smallEntry;
    const [largeId] = largeEntry;
    const [smallSnap] = runCycles(smallId, "straight", 2, 1);
    const [largeSnap] = runCycles(largeId, "straight", 2, 1);
    if (!smallSnap || !largeSnap) return;

    const smallDist = distance(3000, 3000, smallSnap.x, smallSnap.y);
    const largeDist = distance(3000, 3000, largeSnap.x, largeSnap.y);
    expect(largeDist).toBeGreaterThan(smallDist);
  });
});

// ============================================
// All ships × valid maneuvers simulation
// ============================================

describe("ArcadeMovementSim — all ships × all valid dial maneuvers", () => {
  it("all ships produce valid geometry for every dial entry", () => {
    const failures: string[] = [];

    for (const [shipId, def] of Object.entries(SHIP_DEFINITIONS)) {
      const dial = getShipDial(shipId);
      const baseSize = SHIP_SIZES[def.baseStats.size] ?? 32;

      for (const entry of dial) {
        const expected = resolveManeuver(0, 0, 0, entry, baseSize);

        let ship = makeShip(shipId, 0, 0, 0);
        let control = createControlState(ship, baseSize);
        control = { ...control, speed: entry.speed };
        control = startManeuver(ship, control, entry.direction);

        const result = simulateCycle(ship, control);
        const snap = result.snapshot;

        if (isNaN(snap.x) || isNaN(snap.y) || isNaN(snap.angle)) {
          failures.push(
            `${shipId} ${entry.direction}@${entry.speed}: NaN position`,
          );
          continue;
        }

        const angleDiff = Math.abs(snap.angle - expected.targetAngle);
        const normalizedDiff = Math.min(angleDiff, 360 - angleDiff);
        if (normalizedDiff > 2) {
          failures.push(
            `${shipId} ${entry.direction}@${entry.speed}: angle ${snap.angle.toFixed(1)}° ≠ expected ${expected.targetAngle.toFixed(1)}°`,
          );
        }

        const actualDist = distance(0, 0, snap.x, snap.y);
        const expectedDist = distance(0, 0, expected.targetX, expected.targetY);
        if (Math.abs(actualDist - expectedDist) > 2) {
          failures.push(
            `${shipId} ${entry.direction}@${entry.speed}: dist ${actualDist.toFixed(1)} ≠ expected ${expectedDist.toFixed(1)}`,
          );
        }
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `Movement geometry failures (${failures.length}):\n${failures.slice(0, 20).join("\n")}`,
      );
    }
  });

  it("speed-1 ships always move at least SPEED_SCALE_FACTOR + baseSize pixels per cycle", () => {
    const failures: string[] = [];

    for (const [shipId, def] of Object.entries(SHIP_DEFINITIONS)) {
      const baseSize = SHIP_SIZES[def.baseStats.size] ?? 32;
      const minExpected = 1 * SPEED_SCALE_FACTOR + baseSize;

      const [snap] = runCycles(shipId, "straight", 1, 1);
      if (!snap) continue;

      const actualDist = distance(3000, 3000, snap.x, snap.y);
      if (actualDist < minExpected - 2) {
        failures.push(
          `${shipId}: dist ${actualDist.toFixed(1)} < minimum ${minExpected}`,
        );
      }
    }

    if (failures.length > 0) {
      throw new Error(`Ships moving too little:\n${failures.join("\n")}`);
    }
  });

  it("paths are continuous — no teleportation between cycle waypoints", () => {
    const failures: string[] = [];
    const sampleIds = Object.keys(SHIP_DEFINITIONS).slice(0, 15);

    for (const shipId of sampleIds) {
      const def = SHIP_DEFINITIONS[shipId];
      if (!def) continue;

      const baseSize = SHIP_SIZES[def.baseStats.size] ?? 32;
      const speed = 3;
      const maxJump = (speed * SPEED_SCALE_FACTOR + baseSize) / 5; // ~1/5th of cycle per tick

      let ship = makeShip(shipId, 3000, 3000, 0);
      let control = createControlState(ship, baseSize);
      control = { ...control, speed };
      control = startManeuver(ship, control, "straight");

      let prevX = ship.x;
      let prevY = ship.y;

      for (let frame = 0; frame < 40; frame++) {
        const { control: nextControl, position } = updateManeuver(control, 16);
        control = nextControl;
        if (position) {
          const jump = distance(prevX, prevY, position.x, position.y);
          if (jump > maxJump + 5) {
            failures.push(
              `${shipId} frame ${frame}: jumped ${jump.toFixed(1)}px (max ${maxJump.toFixed(1)})`,
            );
          }
          prevX = position.x;
          prevY = position.y;
        }
      }
    }

    if (failures.length > 0) {
      throw new Error(`Path discontinuities:\n${failures.join("\n")}`);
    }
  });
});

// ============================================
// Position log analysis
// ============================================

describe("ArcadeMovementSim — position log (half-second snapshots)", () => {
  it("position snapshots at 500ms intervals match cycle targets within 1px", () => {
    const shipId = "terran_gladius";
    const def = SHIP_DEFINITIONS[shipId]!;
    const baseSize = SHIP_SIZES[def.baseStats.size] ?? 32;

    const sequence: ManeuverDirection[] = [
      "straight",
      "bank_left",
      "turn_right",
      "straight",
      "kturn",
    ];
    const speed = 2;

    let ship = makeShip(shipId, 3000, 3000, 0);
    let control = createControlState(ship, baseSize);
    control = { ...control, speed };

    for (const dir of sequence) {
      const expected = resolveManeuver(
        ship.x,
        ship.y,
        ship.angle,
        { direction: dir, speed, difficulty: "white" },
        baseSize,
      );

      // Seed maneuver directly
      control = startManeuver(ship, control, dir);
      const result = simulateCycle(ship, control);
      ship = result.ship;
      control = result.control;
      const snap = result.snapshot;

      expect(snap.x).toBeCloseTo(expected.targetX, 0);
      expect(snap.y).toBeCloseTo(expected.targetY, 0);

      const angleDiff = Math.abs(snap.angle - expected.targetAngle);
      expect(Math.min(angleDiff, 360 - angleDiff)).toBeLessThan(2);
    }
  });

  it("aggregate path: 8 straight cycles arrive at expected total distance", () => {
    const shipId = "terran_gladius";
    const def = SHIP_DEFINITIONS[shipId]!;
    const baseSize = SHIP_SIZES[def.baseStats.size] ?? 32;
    const speed = 3;
    const numCycles = 8;
    const templateLength = speed * SPEED_SCALE_FACTOR + baseSize;

    const snaps = runCycles(shipId, "straight", speed, numCycles);
    const last = snaps[snaps.length - 1]!;

    const totalDist = distance(3000, 3000, last.x, last.y);
    expect(totalDist).toBeCloseTo(numCycles * templateLength, 0);
  });
});
