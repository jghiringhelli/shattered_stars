/**
 * ShipRepairFeedback — the one object a battle scene creates to get the
 * repair mechanic and its feedback:
 *
 * - applies each ship's own shield regen + hull repair (rigger, mechanic
 *   crew, talents) and allied repair fields, with the hull damage pause;
 * - turns the restored amounts into RepairEvents on a pulse-folding channel;
 * - feeds those events to the ship overlays (shimmer + "+") and to the
 *   pooled repair drones (allied sorties / self-repair riggers).
 *
 * Scene wiring is 1–3 lines: construct it in create(), call
 * `selfRepair(ship, deltaMs)` where the scene used to regenerate shields,
 * and (Skirmish only) `auraRepair(...)` for support-aura repair. It ticks
 * itself on the scene's UPDATE event and cleans up on SHUTDOWN.
 */

import Phaser from "phaser";
import {
  DamagePauseTracker,
  repairStep,
} from "../../../arcade/systems/repair/HullRepair";
import { RepairEventChannel } from "../../../arcade/systems/repair/RepairEventChannel";
import type {
  DurabilitySnapshot,
  RepairEvent,
  RepairSource,
} from "../../../arcade/systems/repair/RepairEvents";
import { RepairDronePool } from "../../../rendering/repairDrones/RepairDronePool";
import { RepairDroneView } from "../../../rendering/repairDrones/RepairDroneView";
import { matchStats } from "../../../telemetry/matchTelemetry";
import {
  droneOrbitRadius,
  selfRepairKey,
  selfRepairSourcesOf,
  type AuraRepairRates,
  type RepairFeedbackDebugState,
  type RepairFeedbackShip,
  type SelfRepairSources,
  type ShipRepairFeedbackOptions,
} from "./repairFeedbackModel";

export type {
  AuraRepairRates,
  RepairFeedbackDebugState,
  RepairFeedbackShip,
  RepairOverlay,
  ShipRepairFeedbackOptions,
} from "./repairFeedbackModel";

/** Per-scene repair mechanic + feedback hub. */
export class ShipRepairFeedback {
  private readonly channel = new RepairEventChannel();
  private readonly tracker = new DamagePauseTracker();
  private readonly drones = new RepairDronePool();
  private readonly view: RepairDroneView;
  private readonly sources = new Map<string, SelfRepairSources>();
  private readonly unsubscribe: () => void;
  private deliveredEvents = 0;
  private lastEvent: RepairEvent | null = null;

  /**
   * @param options - Scene hooks.
   */
  constructor(private readonly options: ShipRepairFeedbackOptions) {
    this.view = new RepairDroneView(options.scene);
    this.unsubscribe = this.channel.subscribe((event) => this.deliver(event));
    const events = options.scene.events;
    events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /**
   * The repair mechanic's own state (hull-repair pause after hits) — the
   * part of this hub that is simulation, snapshotted by online battles.
   */
  get mechanic(): DamagePauseTracker {
    return this.tracker;
  }

  /**
   * Apply a ship's own shield regen and hull repair for one frame (replaces
   * the scene's regenerateShields call) and refresh its overlay.
   * @param ship - A ship (mutated: hull, shields).
   * @param deltaMs - Frame length (ms).
   * @returns True when anything was restored.
   */
  selfRepair(ship: RepairFeedbackShip, deltaMs: number): boolean {
    const quietMs = this.tracker.observe(
      ship.id,
      ship.hull,
      ship.shields,
      deltaMs,
    );
    const { shieldRegenPerSecond, hullRepairPerSecond } = ship.modifiers;
    if (shieldRegenPerSecond <= 0 && hullRepairPerSecond <= 0) return false;
    const sources = this.selfSourcesOf(ship);
    return this.applyRates(
      ship,
      { shieldRegenPerSecond, hullRepairPerSecond },
      deltaMs,
      quietMs,
      sources,
    );
  }

  /**
   * Apply an allied repair field for one frame. Call after `selfRepair`
   * for the same frame (it shares that call's damage-pause bookkeeping).
   * @param ship - The covered ship (mutated: hull, shields).
   * @param aura - Rates and credited projector.
   * @param deltaMs - Frame length (ms).
   * @returns True when anything was restored.
   */
  auraRepair(
    ship: RepairFeedbackShip,
    aura: AuraRepairRates,
    deltaMs: number,
  ): boolean {
    if (aura.shieldRegenPerSecond <= 0 && aura.hullRepairPerSecond <= 0)
      return false;
    const source: RepairSource = aura.repairSourceId
      ? { kind: "aura", sourceShipId: aura.repairSourceId }
      : { kind: "self_regen", sourceShipId: null };
    const quietMs = this.tracker.quietMs(ship.id);
    return this.applyRates(ship, aura, deltaMs, quietMs, {
      shield: source,
      hull: source,
    });
  }

  /**
   * Report a repair the scene applied itself (e.g. a capital's repair
   * order trickle) so it gets the shimmer and drones.
   * @param ship - The repaired ship, already holding its new values.
   * @param previous - Its values before the repair.
   * @param source - Who repaired it.
   */
  reportRepair(
    ship: RepairFeedbackShip,
    previous: DurabilitySnapshot,
    source: RepairSource,
  ): void {
    this.channel.observe({
      shipId: ship.id,
      previous,
      current: { hull: ship.hull, shields: ship.shields },
      source,
    });
    this.options.overlayOf(ship.id)?.update(ship.hull, ship.shields);
  }

  /**
   * Deliver a discrete repair event now (bypasses pulse folding).
   * @param event - The repair.
   */
  publishRepair(event: RepairEvent): void {
    this.channel.publish(event);
  }

  /**
   * Drop a removed ship's bookkeeping.
   * @param shipId - The ship.
   */
  forget(shipId: string): void {
    this.channel.forget(shipId);
    this.tracker.forget(shipId);
    this.sources.delete(shipId);
  }

  /**
   * Snapshot for specs and debugging.
   * @returns Delivered events and drone counts.
   */
  debugState(): RepairFeedbackDebugState {
    return {
      deliveredEvents: this.deliveredEvents,
      lastEvent: this.lastEvent,
      activeDrones: this.drones.activeCount(),
      droneBudget: this.drones.budget(),
    };
  }

  /**
   * Restore at the given rates, then report and refresh the overlay.
   * @param ship - The ship (mutated).
   * @param rates - Shield and hull rates (real-time HP / s).
   * @param deltaMs - Frame length (ms).
   * @param quietMs - Time since the ship last took damage.
   * @param sources - Credited sources per channel.
   * @returns True when anything was restored.
   */
  private applyRates(
    ship: RepairFeedbackShip,
    rates: Pick<
      AuraRepairRates,
      "shieldRegenPerSecond" | "hullRepairPerSecond"
    >,
    deltaMs: number,
    quietMs: number,
    sources: { readonly shield: RepairSource; readonly hull: RepairSource },
  ): boolean {
    const previous = { hull: ship.hull, shields: ship.shields };
    const next = repairStep({
      ...previous,
      maxHull: ship.maxHull,
      maxShields: ship.maxShields,
      ...rates,
      deltaMs,
      msSinceDamage: quietMs,
    });
    if (next.hull === previous.hull && next.shields === previous.shields)
      return false;
    ship.hull = next.hull;
    ship.shields = next.shields;
    this.channel.observe({
      shipId: ship.id,
      previous,
      current: next,
      source: sources.shield,
      hullSource: sources.hull,
    });
    this.options.overlayOf(ship.id)?.update(ship.hull, ship.shields);
    return true;
  }

  /**
   * A ship's own-repair sources, cached until its loadout changes.
   * @param ship - The ship.
   * @returns Credited sources per channel.
   */
  private selfSourcesOf(ship: RepairFeedbackShip): SelfRepairSources {
    const cached = this.sources.get(ship.id);
    if (cached && cached.key === selfRepairKey(ship)) return cached;
    const entry = selfRepairSourcesOf(ship);
    this.sources.set(ship.id, entry);
    return entry;
  }

  /**
   * Channel subscriber: overlay cue + drone sortie.
   * @param event - A delivered repair.
   */
  private deliver(event: RepairEvent): void {
    this.deliveredEvents++;
    this.lastEvent = event;
    if (event.kind === "hull")
      matchStats.record({
        kind: "repair",
        hull: event.amount,
        shipId: event.shipId,
      });
    this.options.overlayOf(event.shipId)?.showRepair(event);
    const definitionId = this.options.shipOf(event.shipId)?.definitionId;
    this.drones.requestSortie(event, droneOrbitRadius(definitionId));
  }

  /**
   * Scene UPDATE hook: pulse timers, drone flight, drone drawing.
   * @param _time - Scene time (unused).
   * @param delta - Frame length (ms).
   */
  private onUpdate(_time: number, delta: number): void {
    this.channel.tick(delta);
    this.drones.setBudgetScale(this.options.particleScale?.() ?? 1);
    this.drones.step(delta, this.options.shipOf);
    this.view.render(this.drones.slots());
  }

  /** SHUTDOWN hook: stop ticking and release the graphics. */
  private destroy(): void {
    this.options.scene.events.off(
      Phaser.Scenes.Events.UPDATE,
      this.onUpdate,
      this,
    );
    this.unsubscribe();
    this.drones.clear();
    this.view.destroy();
  }
}
