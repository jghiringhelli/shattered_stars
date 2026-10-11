/**
 * scenarioFrameTracker — turns the Skirmish scene's ship records into the
 * Scenario rules' per-frame view: sides (the player's faction vs everyone
 * else), control weight (medium and bigger count double), scenario value
 * (squad cost), health and stress, plus the events since the last frame —
 * destructions (detected from hull reaching 0) and evasive actions (boost /
 * barrel roll, reported by the scene's flight hook).
 *
 * Pure: no Phaser.
 */

import {
  SCENARIO_POINTS_PER_SQUAD_POINT,
  controlWeight,
  scenarioShipValue,
  type ScenarioEvent,
  type ScenarioFrame,
  type ScenarioShip,
  type ScenarioSide,
} from "../../arcade/scenarios";
import type { FlightEvent } from "../../arcade/systems/PilotFlightTypes";
import type { ObjectivePoint } from "../../arcade/objectives";
import { getShipDefinition } from "../../data/ShipDefinitions";
import { shipPointCost } from "../../systems/arena/BattleScore";

/** What the tracker reads of a Skirmish ship record. */
export interface ScenarioShipSource {
  readonly id: string;
  readonly faction: string;
  readonly definitionId: string;
  readonly x: number;
  readonly y: number;
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
  readonly stress: { readonly isStressed: boolean };
}

/**
 * @param event - A flight event.
 * @returns Whether it is a boost or barrel roll (drops carried salvage).
 */
export function isEvasiveFlightEvent(event: FlightEvent): boolean {
  return event === "boost" || event === "barrel_roll";
}

/** Builds one ScenarioFrame per logic tick. */
export class ScenarioFrameTracker {
  private readonly alive = new Set<string>();
  private pending: ScenarioEvent[] = [];

  /**
   * @param playerFaction - The human player's faction (the "player" side).
   * @param worldSize - Torus side length.
   * @param pointsPerSquadPoint - Scenario value of one squad point.
   */
  constructor(
    private readonly playerFaction: string,
    private readonly worldSize: number,
    private readonly pointsPerSquadPoint: number = SCENARIO_POINTS_PER_SQUAD_POINT,
  ) {}

  /**
   * @param ship - A ship record.
   * @returns Its scenario side.
   */
  sideOf(ship: { readonly faction: string }): ScenarioSide {
    return ship.faction === this.playerFaction ? "player" : "enemy";
  }

  /**
   * A ship boosted or barrel-rolled (reported in the next frame).
   * @param shipId - The ship.
   * @param origin - Where the action started.
   */
  noteEvasive(shipId: string, origin: ObjectivePoint): void {
    this.pending.push({ kind: "evasive", shipId, x: origin.x, y: origin.y });
  }

  /**
   * @param ships - Every ship record (living and destroyed).
   * @param deltaMs - Tick length.
   * @param reserves - Reinforced battles: whether each side can still field a ship.
   * @returns This tick's frame.
   */
  build(
    ships: Iterable<ScenarioShipSource>,
    deltaMs: number,
    reserves?: ScenarioFrame["reserves"],
  ): ScenarioFrame {
    const living: ScenarioShip[] = [];
    const events = this.pending;
    this.pending = [];
    for (const ship of ships) {
      if (ship.hull > 0) {
        this.alive.add(ship.id);
        living.push(this.describe(ship));
      } else if (this.alive.delete(ship.id)) {
        events.push(this.destroyed(ship));
      }
    }
    const frame = { deltaMs, worldSize: this.worldSize, ships: living, events };
    return reserves ? { ...frame, reserves } : frame;
  }

  /** @returns The ship as the rules see it. */
  private describe(ship: ScenarioShipSource): ScenarioShip {
    const max = ship.maxHull + ship.maxShields;
    return {
      id: ship.id,
      side: this.sideOf(ship),
      x: ship.x,
      y: ship.y,
      hull: ship.hull,
      maxHull: ship.maxHull,
      weight: controlWeight(
        getShipDefinition(ship.definitionId)?.baseStats.size ?? "small",
      ),
      tags: [],
      stressed: ship.stress.isStressed,
      value: this.valueOf(ship),
      healthFraction:
        max > 0
          ? (Math.max(0, ship.hull) + Math.max(0, ship.shields)) / max
          : 0,
    };
  }

  /** @returns What destroying the ship is worth (scenario points). */
  private valueOf(ship: ScenarioShipSource): number {
    return scenarioShipValue(
      shipPointCost(ship.definitionId),
      this.pointsPerSquadPoint,
    );
  }

  /** @returns The destroyed event of a ship that just died. */
  private destroyed(ship: ScenarioShipSource): ScenarioEvent {
    return {
      kind: "destroyed",
      shipId: ship.id,
      side: this.sideOf(ship),
      value: this.valueOf(ship),
      x: ship.x,
      y: ship.y,
    };
  }
}
