/**
 * RepairDronePool — fixed pool of repair-drone slots driven by repair
 * events. Pure (no Phaser): the view only reads the slots and draws them.
 *
 * - A repair from an allied ship (support/capital repair field) sends drones
 *   from that ship to the repaired one; self-repair (rigger, mechanic
 *   crew, damage-control order) launches drones from the ship itself; plain
 *   shield regeneration sends none (it only shimmers on the overlay).
 * - Each (source, target) pair waits {@link SORTIE_COOLDOWN_MS} between
 *   sorties, so steady regeneration reads as periodic drone visits.
 * - Slots are allocated once; the active budget shrinks with the
 *   performance system's particle scale.
 */

import type {
  RepairEvent,
  RepairSourceKind,
} from "../../arcade/systems/repair/RepairEvents";
import {
  DRONE_LAUNCH_MS,
  DRONE_ORBIT_MS,
  dronePhaseAt,
  dronePosition,
  returnProgress,
  type DronePhase,
  type MutablePoint,
} from "./droneFlight";

/** Pool size — the most drones ever in flight at once. */
export const MAX_CONCURRENT_DRONES = 24;

/** Fewest drones allowed in flight even at minimum quality. */
export const MIN_DRONE_BUDGET = 2;

/** Minimum time between two sorties to the same ship from the same source. */
export const SORTIE_COOLDOWN_MS = 2500;

/** Drones launched per sortie, by repair source. */
export const DRONES_PER_SORTIE: Readonly<Record<RepairSourceKind, number>> = {
  astromech: 1,
  mechanic_crew: 2,
  self_regen: 0,
  aura: 2,
  damage_control: 3,
};

/** Full turn in radians (spreads a wing around the orbit). */
const TAU = Math.PI * 2;

/** One drone slot (mutated in place; inactive slots are free). */
export interface DroneSlot {
  active: boolean;
  /** True once the slot's position has been computed at least once. */
  positioned: boolean;
  sourceId: string;
  targetId: string;
  elapsedMs: number;
  phase: DronePhase;
  phaseOffset: number;
  orbitRadius: number;
  /** Recalled early (target destroyed): flies home from `recall`. */
  recalled: boolean;
  readonly recall: MutablePoint;
  /** Last known source / target positions. */
  readonly source: MutablePoint;
  readonly target: MutablePoint;
  x: number;
  y: number;
}

/** Position lookup for ships (undefined once a ship is gone). */
export type ShipPositionLookup = (
  shipId: string,
) => { readonly x: number; readonly y: number } | undefined;

/**
 * A free slot.
 * @returns A new inactive slot.
 */
function emptySlot(): DroneSlot {
  return {
    active: false,
    positioned: false,
    sourceId: "",
    targetId: "",
    elapsedMs: 0,
    phase: "done",
    phaseOffset: 0,
    orbitRadius: 0,
    recalled: false,
    recall: { x: 0, y: 0 },
    source: { x: 0, y: 0 },
    target: { x: 0, y: 0 },
    x: 0,
    y: 0,
  };
}

/** Fixed-size pool of repair drones. */
export class RepairDronePool {
  private readonly pool: DroneSlot[];
  private readonly cooldowns = new Map<string, number>();
  private activeBudget: number;

  /**
   * @param capacity - Number of slots (allocated once).
   */
  constructor(private readonly capacity: number = MAX_CONCURRENT_DRONES) {
    this.pool = Array.from({ length: capacity }, emptySlot);
    this.activeBudget = capacity;
  }

  /**
   * Scale the in-flight budget (performance system particle multiplier).
   * @param scale - 0–1 quality scale.
   */
  setBudgetScale(scale: number): void {
    const clamped = Math.min(1, Math.max(0, scale));
    const floor = Math.min(this.capacity, MIN_DRONE_BUDGET);
    this.activeBudget = Math.max(floor, Math.round(this.capacity * clamped));
  }

  /**
   * Current in-flight budget.
   * @returns Most drones allowed in flight now.
   */
  budget(): number {
    return this.activeBudget;
  }

  /**
   * Every slot, active or free (the same array every call).
   * @returns The slots.
   */
  slots(): ReadonlyArray<DroneSlot> {
    return this.pool;
  }

  /**
   * Launch the drones a repair event calls for, if its pair is off cooldown.
   * @param event - The repair.
   * @param orbitRadius - Orbit radius around the repaired ship.
   * @returns Number of drones launched.
   */
  requestSortie(event: RepairEvent, orbitRadius: number): number {
    const wanted = DRONES_PER_SORTIE[event.sourceKind];
    if (wanted <= 0) return 0;
    const sourceId = event.sourceShipId ?? event.shipId;
    const pairKey = `${sourceId}>${event.shipId}`;
    if (this.cooldowns.has(pairKey)) return 0;
    let launched = 0;
    let inFlight = this.activeCount();
    for (const slot of this.pool) {
      if (launched >= wanted || inFlight >= this.activeBudget) break;
      if (slot.active) continue;
      this.launch(
        slot,
        sourceId,
        event.shipId,
        orbitRadius,
        (TAU * launched) / wanted,
      );
      launched++;
      inFlight++;
    }
    if (launched > 0) this.cooldowns.set(pairKey, SORTIE_COOLDOWN_MS);
    return launched;
  }

  /**
   * Advance every drone and cooldown by one frame.
   * @param deltaMs - Frame length (ms).
   * @param positionOf - Current ship positions.
   */
  step(deltaMs: number, positionOf: ShipPositionLookup): void {
    for (const [key, left] of this.cooldowns) {
      if (left - deltaMs <= 0) this.cooldowns.delete(key);
      else this.cooldowns.set(key, left - deltaMs);
    }
    for (const slot of this.pool) {
      if (slot.active) this.advance(slot, deltaMs, positionOf);
    }
  }

  /**
   * Number of drones in flight.
   * @returns Active slot count.
   */
  activeCount(): number {
    let count = 0;
    for (const slot of this.pool) if (slot.active) count++;
    return count;
  }

  /** Ground every drone and clear cooldowns (scene teardown / restart). */
  clear(): void {
    for (const slot of this.pool) slot.active = false;
    this.cooldowns.clear();
  }

  /**
   * Arm a free slot for a new sortie.
   * @param slot - The free slot.
   * @param sourceId - Launching ship.
   * @param targetId - Repaired ship.
   * @param orbitRadius - Orbit radius.
   * @param phaseOffset - Orbit start angle.
   */
  private launch(
    slot: DroneSlot,
    sourceId: string,
    targetId: string,
    orbitRadius: number,
    phaseOffset: number,
  ): void {
    slot.active = true;
    slot.positioned = false;
    slot.recalled = false;
    slot.sourceId = sourceId;
    slot.targetId = targetId;
    slot.elapsedMs = 0;
    slot.phase = "launch";
    slot.orbitRadius = orbitRadius;
    slot.phaseOffset = phaseOffset;
  }

  /**
   * Move one drone along its path; recall it if its target is gone.
   * @param slot - An active slot.
   * @param deltaMs - Frame length (ms).
   * @param positionOf - Current ship positions.
   */
  private advance(
    slot: DroneSlot,
    deltaMs: number,
    positionOf: ShipPositionLookup,
  ): void {
    const source = positionOf(slot.sourceId);
    const target = positionOf(slot.targetId);
    if (source) copyPoint(source, slot.source);
    if (target) copyPoint(target, slot.target);
    if (!slot.positioned && (!source || !target)) {
      slot.active = false;
      return;
    }
    slot.elapsedMs += deltaMs;
    if (!target && !slot.recalled && slot.phase !== "return") {
      slot.recalled = true;
      copyPoint(slot, slot.recall);
      slot.elapsedMs = DRONE_LAUNCH_MS + DRONE_ORBIT_MS;
    }
    slot.phase = dronePhaseAt(slot.elapsedMs);
    if (slot.phase === "done") {
      slot.active = false;
      return;
    }
    if (slot.recalled) {
      const t = returnProgress(slot.elapsedMs);
      slot.x = slot.recall.x + (slot.source.x - slot.recall.x) * t;
      slot.y = slot.recall.y + (slot.source.y - slot.recall.y) * t;
    } else {
      dronePosition(
        slot.elapsedMs,
        slot.source,
        slot.target,
        slot.orbitRadius,
        slot.phaseOffset,
        slot,
      );
    }
    slot.positioned = true;
  }
}

/**
 * Copy a point's coordinates.
 * @param from - Source point.
 * @param to - Destination (mutated).
 */
function copyPoint(
  from: { readonly x: number; readonly y: number },
  to: MutablePoint,
): void {
  to.x = from.x;
  to.y = from.y;
}
