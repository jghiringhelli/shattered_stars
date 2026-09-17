/**
 * ArcadeBattleSim — Headless battle loop for arcade AI validation.
 *
 * No Phaser, no DOM. Runs the full physics/AI/stress loop in pure TypeScript
 * at 60Hz (16.67ms steps) until one side is eliminated or the tick limit is hit.
 *
 * Use this to:
 *  - Verify AI uses special maneuvers (K-turn, boost, barrel roll).
 *  - Check escort prioritisation (interceptors target threats to bombers).
 *  - Measure stress/green-maneuver fractions to detect runaway difficulty.
 *  - Rough balance testing without opening a browser.
 */

import {
  createControlState,
  getContinuousMovement,
  updateCooldowns,
  canFire,
  canKTurn,
  canBarrelRoll,
  canBoost,
  useBoost,
  processCommand,
  getSizeMovementBase,
  type ShipControlState,
} from "../../src/core/ArcadeControls";
import {
  INITIAL_STRESS,
  STRESSED_MAX_DEFLECTION,
  classifyManeuver,
  lookupDialDifficulty,
  updateStress,
  applyKturnStress,
  type StressState,
} from "../../src/arcade/ArcadeStress";
import {
  selectAITarget,
  computeAIDecision,
  type AIShipView,
} from "../../src/systems/ArcadeAI";
import { getShipDefinition, getShipDial } from "../../src/data/ShipDefinitions";
import { getHandlingProfile } from "../../src/systems/FlightControlSystem";
import type { ShipRole, ManeuverDefinition } from "../../src/core/types";
import type { FactionId } from "../../src/config";

// ============================================
// Sim-local types
// ============================================

export interface SimShip {
  id: string;
  definitionId: string;
  faction: FactionId;
  role: ShipRole;
  x: number;
  y: number;
  angle: number;
  hull: number;
  maxHull: number;
  control: ShipControlState;
  stress: StressState;
  shipDial: readonly ManeuverDefinition[];
  maxAngularVelocity: number;
  movementSpeedBase: number;
  targetId: string | null;
  aiDecisionTimer: number;
  // Telemetry accumulators
  kturnCount: number;
  boostCount: number;
  barrelRollCount: number;
  greenFrames: number;
  redFrames: number;
  totalFrames: number;
  damageDealt: number;
}

export interface SimProjectile {
  id: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  damage: number;
  ownerId: string;
  ownerFaction: FactionId;
  lifetime: number;
}

export interface ShipTelemetry {
  id: string;
  definitionId: string;
  role: ShipRole;
  faction: FactionId;
  survived: boolean;
  kturnCount: number;
  boostCount: number;
  barrelRollCount: number;
  greenManeuverFraction: number;
  redManeuverFraction: number;
  damageDealt: number;
}

export interface SimResult {
  winnerFaction: FactionId | "draw";
  durationMs: number;
  ticks: number;
  telemetry: ShipTelemetry[];
}

export interface SimShipSpec {
  id: string;
  definitionId: string;
  faction: FactionId;
  x: number;
  y: number;
  angle: number;
}

// ============================================
// Ship factory
// ============================================

const BASE_TURN_RATE = 90;

/**
 * Constructs a SimShip from a spec, reading stats from ShipDefinitions.
 *
 * @param spec - Identity and initial position.
 * @returns Fully-initialised SimShip ready for simulation.
 */
export function createSimShip(spec: SimShipSpec): SimShip {
  const def = getShipDefinition(spec.definitionId);
  const fakeState = { id: spec.id } as Parameters<typeof createControlState>[0];
  const handling = getHandlingProfile(
    def?.baseStats.size ?? "small",
    def?.role ?? "heavy_fighter",
  );
  return {
    ...spec,
    role: def?.role ?? "heavy_fighter",
    hull: def?.baseStats.hull ?? 4,
    maxHull: def?.baseStats.hull ?? 4,
    control: { ...createControlState(fakeState), currentManeuver: null },
    stress: INITIAL_STRESS,
    shipDial: getShipDial(spec.definitionId),
    maxAngularVelocity: BASE_TURN_RATE * handling.turnRate,
    movementSpeedBase: getSizeMovementBase(def?.baseStats.size ?? "small"),
    targetId: null,
    aiDecisionTimer: 0,
    kturnCount: 0,
    boostCount: 0,
    barrelRollCount: 0,
    greenFrames: 0,
    redFrames: 0,
    totalFrames: 0,
    damageDealt: 0,
  };
}

// ============================================
// Simulation runner
// ============================================

const FIXED_STEP_MS = 1000 / 60; // 16.67 ms
const PROJ_SPEED = 2500; // px/s laser
const PROJ_LIFETIME = 2000; // ms
const HIT_RADIUS = 50; // px — generous to account for simplified sim physics
const BOOST_DISTANCE = 220; // px
const FIELD_SIZE = 4000; // px (toroid)

/**
 * Runs a headless arcade battle until one faction is wiped or `maxMs` elapses.
 *
 * @param ships  - All ships to simulate.
 * @param maxMs  - Wall-clock time limit (default 60 s = 60 000 ms).
 * @returns Battle result with per-ship telemetry.
 */
export function runSimulation(ships: SimShip[], maxMs = 60_000): SimResult {
  const shipMap = new Map(ships.map((s) => [s.id, s]));
  const projectiles: SimProjectile[] = [];
  let projCounter = 0;
  const totalTicks = Math.ceil(maxMs / FIXED_STEP_MS);

  for (let tick = 0; tick < totalTicks; tick++) {
    const deltaMs = FIXED_STEP_MS;

    // Check win condition
    const factions = new Set(
      [...shipMap.values()].filter((s) => s.hull > 0).map((s) => s.faction),
    );
    if (factions.size <= 1) break;

    const allShips = [...shipMap.values()];
    const aiViews = new Map<string, AIShipView>(
      allShips.map((s) => [s.id, toView(s)]),
    );

    for (const ship of allShips) {
      if (ship.hull <= 0) continue;

      ship.aiDecisionTimer -= deltaMs;
      ship.control = updateCooldowns(ship.control, deltaMs);

      const allies = allShips.filter(
        (s) => s.faction === ship.faction && s.hull > 0,
      );
      const enemies = allShips.filter(
        (s) => s.faction !== ship.faction && s.hull > 0,
      );
      const allyViews = allies.map((s) => aiViews.get(s.id)!);
      const enemyViews = enemies.map((s) => aiViews.get(s.id)!);

      // Target selection
      const currentTarget = ship.targetId ? shipMap.get(ship.targetId) : null;
      if (
        !currentTarget ||
        currentTarget.hull <= 0 ||
        ship.aiDecisionTimer <= 0
      ) {
        const picked = selectAITarget(
          aiViews.get(ship.id)!,
          allyViews,
          enemyViews,
          FIELD_SIZE,
        );
        ship.targetId = picked?.id ?? null;
        ship.aiDecisionTimer = 300 + Math.random() * 200;
      }

      const target = ship.targetId ? shipMap.get(ship.targetId) : null;
      if (!target || target.hull <= 0) continue;

      const decision = computeAIDecision(
        aiViews.get(ship.id)!,
        aiViews.get(target.id)!,
        allyViews,
        enemyViews,
        deltaMs,
        FIELD_SIZE,
      );

      // K-turn: instant 180° flip — sim doesn't track maneuver arc
      if (decision.doKturn && canKTurn(ship.control)) {
        ship.angle = (ship.angle + 180) % 360;
        ship.control = {
          ...ship.control,
          kturnCooldown: ship.control.kturnCooldownMax,
        };
        ship.stress = applyKturnStress(ship.stress);
        ship.kturnCount++;
      }

      // Boost
      if (decision.doBoost && canBoost(ship.control)) {
        const rad = (ship.angle - 90) * (Math.PI / 180);
        ship.x =
          (((ship.x + Math.cos(rad) * BOOST_DISTANCE) % FIELD_SIZE) +
            FIELD_SIZE) %
          FIELD_SIZE;
        ship.y =
          (((ship.y + Math.sin(rad) * BOOST_DISTANCE) % FIELD_SIZE) +
            FIELD_SIZE) %
          FIELD_SIZE;
        ship.control = useBoost(ship.control);
        ship.boostCount++;
      }

      // Barrel roll: lateral 80px nudge — sim doesn't animate the arc
      if (decision.doBarrelRoll && canBarrelRoll(ship.control)) {
        const lateralOffset = decision.barrelRollDir === "left" ? -90 : 90;
        const rollRad = (ship.angle + lateralOffset - 90) * (Math.PI / 180);
        ship.x =
          (((ship.x + Math.cos(rollRad) * 80) % FIELD_SIZE) + FIELD_SIZE) %
          FIELD_SIZE;
        ship.y =
          (((ship.y + Math.sin(rollRad) * 80) % FIELD_SIZE) + FIELD_SIZE) %
          FIELD_SIZE;
        ship.control = {
          ...ship.control,
          barrelRollCooldown: ship.control.barrelRollCooldownMax,
        };
        ship.barrelRollCount++;
      }

      // Steering + stress
      const maxTurn = ship.maxAngularVelocity * (deltaMs / 1000);
      let turn = decision.turnDelta;
      const deflRatio = Math.abs(turn) / (maxTurn || 1);
      const { direction: dir } = classifyManeuver(
        deflRatio,
        ship.control.speed,
      );
      const difficulty = lookupDialDifficulty(
        dir,
        ship.control.speed,
        ship.shipDial,
      );
      ship.stress = updateStress(ship.stress, difficulty, deltaMs);
      ship.totalFrames++;
      if (difficulty === "green") ship.greenFrames++;
      if (difficulty === "red") ship.redFrames++;
      if (ship.stress.isStressed && difficulty === "red") {
        turn = Math.max(
          -maxTurn * STRESSED_MAX_DEFLECTION,
          Math.min(maxTurn * STRESSED_MAX_DEFLECTION, turn),
        );
      }
      ship.angle = (((ship.angle + turn) % 360) + 360) % 360;

      // Speed adjustment
      if (decision.desiredSpeed > ship.control.speed) {
        ship.control = processCommand(
          ship as never,
          ship.control,
          "thrust_increase",
        );
      } else if (decision.desiredSpeed < ship.control.speed) {
        ship.control = processCommand(
          ship as never,
          ship.control,
          "thrust_decrease",
        );
      }

      // Continuous movement
      const pos = getContinuousMovement(
        { x: ship.x, y: ship.y, angle: ship.angle } as never,
        ship.control,
        deltaMs,
        ship.movementSpeedBase,
      );
      ship.x = ((pos.x % FIELD_SIZE) + FIELD_SIZE) % FIELD_SIZE;
      ship.y = ((pos.y % FIELD_SIZE) + FIELD_SIZE) % FIELD_SIZE;

      // Fire
      if (decision.firePrimary && canFire(ship.control)) {
        ship.control = processCommand(ship as never, ship.control, "fire");
        projectiles.push({
          id: `p${projCounter++}`,
          x: ship.x,
          y: ship.y,
          angle: ship.angle,
          speed: PROJ_SPEED,
          damage: Math.max(
            1,
            Math.round(
              Math.min(
                getShipDefinition(ship.definitionId)?.baseStats.attack ?? 2,
                2,
              ) * (ship.stress.isStressed ? 0.75 : 1),
            ),
          ),
          ownerId: ship.id,
          ownerFaction: ship.faction,
          lifetime: PROJ_LIFETIME,
        });
      }
    }

    // Update projectiles + hit detection
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i]!;
      p.lifetime -= deltaMs;
      if (p.lifetime <= 0) {
        projectiles.splice(i, 1);
        continue;
      }

      const rad = (p.angle - 90) * (Math.PI / 180);
      p.x += Math.cos(rad) * p.speed * (deltaMs / 1000);
      p.y += Math.sin(rad) * p.speed * (deltaMs / 1000);

      for (const ship of shipMap.values()) {
        if (ship.faction === p.ownerFaction || ship.hull <= 0) continue;
        const dx = p.x - ship.x;
        const dy = p.y - ship.y;
        if (Math.sqrt(dx * dx + dy * dy) < HIT_RADIUS) {
          ship.hull = Math.max(0, ship.hull - p.damage);
          const shooter = shipMap.get(p.ownerId);
          if (shooter) shooter.damageDealt += p.damage;
          projectiles.splice(i, 1);
          break;
        }
      }
    }
  }

  const allShips = [...shipMap.values()];
  const liveFactions = new Set(
    allShips.filter((s) => s.hull > 0).map((s) => s.faction),
  );
  const winner: FactionId | "draw" =
    liveFactions.size === 1 ? [...liveFactions][0]! : "draw";

  const telemetry: ShipTelemetry[] = allShips.map((s) => ({
    id: s.id,
    definitionId: s.definitionId,
    role: s.role,
    faction: s.faction,
    survived: s.hull > 0,
    kturnCount: s.kturnCount,
    boostCount: s.boostCount,
    barrelRollCount: s.barrelRollCount,
    greenManeuverFraction:
      s.totalFrames > 0 ? s.greenFrames / s.totalFrames : 0,
    redManeuverFraction: s.totalFrames > 0 ? s.redFrames / s.totalFrames : 0,
    damageDealt: s.damageDealt,
  }));

  return {
    winnerFaction: winner,
    durationMs: allShips.reduce((m, _) => m, 0) + totalTicks * FIXED_STEP_MS,
    ticks: totalTicks,
    telemetry,
  };
}

// ============================================
// Internal helper
// ============================================

function toView(ship: SimShip): AIShipView {
  return {
    id: ship.id,
    x: ship.x,
    y: ship.y,
    angle: ship.angle,
    faction: ship.faction,
    role: ship.role,
    hull: ship.hull,
    stress: ship.stress,
    control: ship.control,
    shipDial: ship.shipDial,
    maxAngularVelocity: ship.maxAngularVelocity,
  };
}
