/**
 * hazardModel — steps mission hazards and reports their effects per ship.
 * Deterministic (no RNG): asteroid impacts land on a fixed interval spent
 * inside the belt. Scripts switch hazards on/off; hero powers may add owned
 * minefields. Pure.
 */

import { withinRange } from "../../arcade/objectives/objectiveGeometry";
import type {
  HazardDefinition,
  HazardEffect,
  HazardHarms,
  HazardVisual,
  MinefieldDefinition,
} from "./hazardTypes";
import type { ObjectivePoint } from "../../arcade/objectives";

/** Milliseconds per second. */
const MS_PER_SECOND = 1000;

/** A ship as hazards see it. */
export interface HazardShip {
  readonly id: string;
  readonly side: "player" | "enemy";
  readonly x: number;
  readonly y: number;
}

/** Runtime state of one hazard. */
interface HazardRuntime {
  readonly def: HazardDefinition;
  readonly active: boolean;
  /** Mines still armed (minefields). */
  readonly mines: readonly ObjectivePoint[];
  /** Time each ship has spent inside since its last impact (belts). */
  readonly insideMs: Readonly<Record<string, number>>;
  /** Front position (flare walls). */
  readonly position: number;
}

/** Every hazard of a mission. */
export interface HazardState {
  readonly hazards: readonly HazardRuntime[];
}

/** One step's result. */
export interface HazardStepResult {
  readonly state: HazardState;
  readonly effects: HazardEffect[];
}

/**
 * @param def - Hazard definition.
 * @returns Its fresh runtime.
 */
function runtimeOf(def: HazardDefinition): HazardRuntime {
  return {
    def,
    active: def.startsInactive !== true,
    mines: def.kind === "minefield" ? def.mines : [],
    insideMs: {},
    position: def.kind === "flare_wall" ? def.start : 0,
  };
}

/**
 * @param defs - Hazard definitions.
 * @returns Fresh hazard state.
 */
export function createHazardState(
  defs: readonly HazardDefinition[],
): HazardState {
  return { hazards: defs.map(runtimeOf) };
}

/**
 * @param state - Hazard state.
 * @param def - A hazard to add mid-mission (e.g. a power's minefield).
 * @returns State with it added (replacing one with the same id).
 */
export function addHazard(
  state: HazardState,
  def: HazardDefinition,
): HazardState {
  return {
    hazards: [
      ...state.hazards.filter((h) => h.def.id !== def.id),
      runtimeOf(def),
    ],
  };
}

/**
 * @param state - Hazard state.
 * @param id - Hazard id.
 * @param active - On or off.
 * @returns State with that hazard switched.
 */
export function setHazardActive(
  state: HazardState,
  id: string,
  active: boolean,
): HazardState {
  return {
    hazards: state.hazards.map((h) => (h.def.id === id ? { ...h, active } : h)),
  };
}

/**
 * @param harms - Who a hazard harms.
 * @param ship - A ship.
 * @returns Whether it harms that ship.
 */
function harmsShip(harms: HazardHarms | undefined, ship: HazardShip): boolean {
  return harms === undefined || harms === "all" || harms === ship.side;
}

/** An effect with only hull damage / shield drain / stress set. */
function effect(
  shipId: string,
  parts: Partial<Omit<HazardEffect, "shipId">>,
): HazardEffect {
  return { shipId, hullDamage: 0, shieldDrain: 0, stress: 0, ...parts };
}

/**
 * @param runtime - A minefield runtime.
 * @param ships - Ships.
 * @param worldSize - Torus side.
 * @returns Runtime with triggered mines removed, and their blasts.
 */
function stepMines(
  runtime: HazardRuntime,
  def: MinefieldDefinition,
  ships: readonly HazardShip[],
  worldSize: number,
): { runtime: HazardRuntime; effects: HazardEffect[] } {
  const effects: HazardEffect[] = [];
  const armed = runtime.mines.filter((mine) => {
    const victim = ships.find(
      (s) =>
        harmsShip(def.harms, s) &&
        withinRange(s, mine, def.triggerRadius, worldSize),
    );
    if (!victim) return true;
    effects.push(effect(victim.id, { hullDamage: def.damage }));
    return false;
  });
  return { runtime: { ...runtime, mines: armed }, effects };
}

/**
 * Steps one active hazard.
 *
 * @param runtime - Hazard runtime.
 * @param ships - Ships.
 * @param deltaMs - Frame length.
 * @param worldSize - Torus side.
 * @returns New runtime and effects.
 */
function stepOne(
  runtime: HazardRuntime,
  ships: readonly HazardShip[],
  deltaMs: number,
  worldSize: number,
): { runtime: HazardRuntime; effects: HazardEffect[] } {
  const def = runtime.def;
  const seconds = deltaMs / MS_PER_SECOND;
  const exposed = (at: ObjectivePoint, radius: number): HazardShip[] =>
    ships.filter(
      (s) => harmsShip(def.harms, s) && withinRange(s, at, radius, worldSize),
    );
  switch (def.kind) {
    case "ion_storm":
      return {
        runtime,
        effects: exposed(def.at, def.radius).map((s) =>
          effect(s.id, {
            shieldDrain: def.shieldDrainPerSecond * seconds,
            stress: (def.stressPerSecond ?? 0) * seconds,
          }),
        ),
      };
    case "minefield":
      return stepMines(runtime, def, ships, worldSize);
    case "asteroid_belt": {
      const insideMs: Record<string, number> = {};
      const effects: HazardEffect[] = [];
      for (const s of exposed(def.at, def.radius)) {
        let time = (runtime.insideMs[s.id] ?? 0) + deltaMs;
        if (time >= def.hitIntervalMs) {
          effects.push(effect(s.id, { hullDamage: def.damagePerHit }));
          time -= def.hitIntervalMs;
        }
        insideMs[s.id] = time;
      }
      return { runtime: { ...runtime, insideMs }, effects };
    }
    case "flare_wall": {
      const direction = Math.sign(def.speed) || 1;
      const raw = runtime.position + def.speed * seconds;
      const position =
        direction > 0 ? Math.min(def.stop, raw) : Math.max(def.stop, raw);
      const burned = ships.filter((s) => {
        const coordinate = def.axis === "x" ? s.x : s.y;
        const passed =
          direction > 0
            ? coordinate >= def.start && coordinate < position
            : coordinate <= def.start && coordinate > position;
        return passed && harmsShip(def.harms, s);
      });
      return {
        runtime: { ...runtime, position },
        effects: burned.map((s) =>
          effect(s.id, { hullDamage: def.damagePerSecond * seconds }),
        ),
      };
    }
  }
}

/**
 * Advances every active hazard by one frame.
 *
 * @param state - Hazard state.
 * @param ships - Living ships.
 * @param deltaMs - Frame length.
 * @param worldSize - Torus side.
 * @returns New state and per-ship effects.
 */
export function stepHazards(
  state: HazardState,
  ships: readonly HazardShip[],
  deltaMs: number,
  worldSize: number,
): HazardStepResult {
  const effects: HazardEffect[] = [];
  const hazards = state.hazards.map((runtime) => {
    if (!runtime.active) return runtime;
    const result = stepOne(runtime, ships, deltaMs, worldSize);
    effects.push(...result.effects);
    return result.runtime;
  });
  return { state: { hazards }, effects };
}

/**
 * @param state - Hazard state.
 * @returns Shapes of every active hazard, for drawing.
 */
export function hazardVisuals(state: HazardState): HazardVisual[] {
  return state.hazards
    .filter((h) => h.active)
    .flatMap((h): HazardVisual[] => {
      const def = h.def;
      switch (def.kind) {
        case "ion_storm":
        case "asteroid_belt":
          return [
            {
              id: def.id,
              kind: def.kind,
              x: def.at.x,
              y: def.at.y,
              radius: def.radius,
            },
          ];
        case "minefield":
          return h.mines.map((m, i) => ({
            id: `${def.id}_${i}`,
            kind: "mine" as const,
            x: m.x,
            y: m.y,
            radius: def.triggerRadius,
            harms: def.harms ?? "all",
          }));
        case "flare_wall":
          return [
            {
              id: def.id,
              kind: "flare_wall",
              axis: def.axis,
              position: h.position,
              direction: Math.sign(def.speed) || 1,
            },
          ];
      }
    });
}
