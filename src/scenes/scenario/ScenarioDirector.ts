/**
 * ScenarioDirector — the Scenario mode's squad layer over the fleet: both
 * sides re-plan their objective play (scenarioAi) on the squad cadence and
 * each AI ship's steering goal is read from its directive and its latest
 * position. The player's side follows the same logic; its wingmen drop the
 * objectives while the player has a mark (R) live.
 *
 * Pure: no Phaser.
 */

import { SQUAD_PLAN_INTERVAL_MS } from "../../arcade/ai/SquadCommand";
import type { ObjectivePoint } from "../../arcade/objectives";
import {
  planScenarioSide,
  steeringGoal,
  type PlannerShip,
  type ScenarioDirective,
  type ScenarioSide,
  type ScenarioState,
} from "../../arcade/scenarios";

/** Both sides. */
const SIDES: readonly ScenarioSide[] = ["player", "enemy"];

/** One director update. */
export interface DirectorFrame {
  readonly nowMs: number;
  readonly state: ScenarioState;
  /** Living ships, both sides. */
  readonly ships: readonly PlannerShip[];
  /** The player's side has a live mark. */
  readonly markActive: boolean;
}

export class ScenarioDirector {
  private directives = new Map<string, ScenarioDirective>();
  private positions = new Map<string, ObjectivePoint>();
  private nextPlanMs: number | null = null;

  /**
   * @param worldSize - Torus side length.
   * @param planIntervalMs - Re-plan cadence (default: the squad layer's).
   */
  constructor(
    private readonly worldSize: number,
    private readonly planIntervalMs = SQUAD_PLAN_INTERVAL_MS,
  ) {}

  /**
   * Track positions every tick; re-plan both sides when due.
   * @param frame - Time, match, ships, mark state.
   */
  update(frame: DirectorFrame): void {
    this.positions = new Map(
      frame.ships.map((s) => [s.id, { x: s.x, y: s.y }]),
    );
    this.nextPlanMs ??= frame.nowMs;
    if (frame.nowMs < this.nextPlanMs) return;
    this.nextPlanMs = Math.max(
      this.nextPlanMs + this.planIntervalMs,
      frame.nowMs,
    );
    const next = new Map<string, ScenarioDirective>();
    for (const side of SIDES) {
      const plan = planScenarioSide({
        state: frame.state,
        side,
        ships: frame.ships,
        worldSize: this.worldSize,
        previous: this.directives,
        markActive: frame.markActive,
      });
      for (const [id, directive] of plan) next.set(id, directive);
    }
    this.directives = next;
  }

  /**
   * @param shipId - An AI ship.
   * @returns Its current directive, or null (human / not planned yet).
   */
  directiveFor(shipId: string): ScenarioDirective | null {
    return this.directives.get(shipId) ?? null;
  }

  /**
   * @param shipId - An AI ship.
   * @returns Where it must steer now, or null to fly its squad orders.
   */
  goalFor(shipId: string): ObjectivePoint | null {
    const directive = this.directives.get(shipId);
    const at = this.positions.get(shipId);
    if (!directive || !at) return null;
    return steeringGoal(directive, at, this.worldSize);
  }
}
