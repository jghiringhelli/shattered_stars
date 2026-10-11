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
   */
  constructor(
    private readonly playerFaction: string,
    private readonly worldSize: number,
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
   * @returns This tick's frame.
   */
  build(ships: Iterable<ScenarioShipSource>, deltaMs: number): ScenarioFrame {
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
    return { deltaMs, worldSize: this.worldSize, ships: living, events };
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
      value: scenarioShipValue(shipPointCost(ship.definitionId)),
      healthFraction:
        max > 0
          ? (Math.max(0, ship.hull) + Math.max(0, ship.shields)) / max
          : 0,
    };
  }

  /** @returns The destroyed event of a ship that just died. */
  private destroyed(ship: ScenarioShipSource): ScenarioEvent {
    return {
      kind: "destroyed",
      shipId: ship.id,
      side: this.sideOf(ship),
      value: scenarioShipValue(shipPointCost(ship.definitionId)),
      x: ship.x,
      y: ship.y,
    };
  }
}
