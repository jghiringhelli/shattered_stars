/**
 * SecondaryWeapons — THE secondary-weapons runtime shared by every battle
 * mode (Skirmish, Dogfight, Ace Duel, Boss Raid, Continuous, Survival,
 * Campaign, Flight School). One instance per battle; the scene glue maps
 * its ship records to {@link WeaponBody}s, calls `update` once per frame,
 * forwards FIRE_SECONDARY / WEAPON_CYCLE / CLOAK for the human pilot, and
 * applies the returned `hit` events through its own damage path.
 *
 * Per frame: reloads and cloaks tick; every ship with a launcher works on
 * a lock on the target its pilot wants; bots choose ordnance through the
 * injected decider; turrets track and fire; shots fly and strike; devices
 * fuse, arm, trigger and blast. A launch (and its warhead while it flies)
 * is this attacker's attack on the target (HitImmunityLedger), so a warhead
 * and a primary shot never both land on one target in one cycle.
 *
 * Pure: no Phaser.
 */

import type { HitImmunityLedger } from "../systems/CombatTempo";
import {
  aimTurretBy,
  createArsenal,
  cycleSelection,
  endCloak,
  isCloaked as arsenalCloaked,
  startCloak,
  tickArsenal,
  type Arsenal,
  type ArsenalLoadout,
  type SlotState,
} from "./Arsenal";
import { FieldOrdnance, indexBodies, type FieldView } from "./FieldOrdnance";
import { checkSecondaryFire, ordnanceViewOf } from "./FireControl";
import { torusRangePx } from "./FiringGeometry";
import { spendLock, stepLock } from "./TargetLock";
import { fireTurret } from "./TurretGunnery";
import { isLauncher } from "./weaponSpecs";
import type {
  FireFrame,
  FireOutcome,
  OrdnanceDecider,
  WeaponBody,
  WeaponEvent,
  WeaponWorld,
} from "./weaponTypes";

/** How a battle's runtime is set up. */
export interface SecondaryWeaponsConfig {
  readonly worldSize: number;
  /** The battle's round-tempo ledger (shared with its primary weapons). */
  readonly ledger: HitImmunityLedger;
  /** Uniform [0, 1) source for the turrets' dice. */
  readonly random: () => number;
  /** Bots' ordnance choices (none = bots only use turrets). */
  readonly decide?: OrdnanceDecider;
}

export class SecondaryWeapons {
  private readonly arsenals = new Map<string, Arsenal>();
  private readonly field: FieldOrdnance;
  private pending: WeaponEvent[] = [];

  /** @param config - World size, tempo ledger, dice and bot decider. */
  constructor(private readonly config: SecondaryWeaponsConfig) {
    this.field = new FieldOrdnance(config.worldSize);
  }

  /** Equip a ship. @param shipId - The ship. @param loadout - Its build. @returns Its arsenal. */
  equip(shipId: string, loadout: ArsenalLoadout): Arsenal {
    const arsenal = createArsenal(loadout);
    this.arsenals.set(shipId, arsenal);
    return arsenal;
  }

  /** @param shipId - A ship destroyed or removed (its shots keep flying). */
  forget(shipId: string): void {
    this.arsenals.delete(shipId);
  }

  /** Forget every ship, shot and device (restart). */
  clear(): void {
    this.arsenals.clear();
    this.field.clear();
    this.pending = [];
  }

  /** @param shipId - A ship. @returns Its arsenal, or null. */
  arsenalOf(shipId: string): Arsenal | null {
    return this.arsenals.get(shipId) ?? null;
  }

  /** @returns Missiles and torpedoes in flight (rendering). */
  get shotsInFlight(): FieldOrdnance["shotsInFlight"] {
    return this.field.shotsInFlight;
  }

  /** @returns Bombs and mines on the field (rendering). */
  get devicesOnField(): FieldOrdnance["devicesOnField"] {
    return this.field.devicesOnField;
  }

  /** WEAPON_CYCLE. @param shipId - The ship. */
  cycleWeapon(shipId: string): void {
    const arsenal = this.arsenals.get(shipId);
    if (arsenal) cycleSelection(arsenal);
  }

  /** Gunner crew aim. @param shipId - The ship. @param facingDeg - Turret aim (°). */
  aimTurret(shipId: string, facingDeg: number): void {
    const arsenal = this.arsenals.get(shipId);
    if (arsenal) aimTurretBy(arsenal, facingDeg);
  }

  /** The turret tracks on its own again. @param shipId - The ship. */
  releaseTurret(shipId: string): void {
    const turret = this.arsenals.get(shipId)?.turret;
    if (turret) turret.manualAim = false;
  }

  /** @param shipId - A ship. @returns True while it is cloaked. */
  isCloaked(shipId: string): boolean {
    const arsenal = this.arsenals.get(shipId);
    return arsenal ? arsenalCloaked(arsenal) : false;
  }

  /**
   * CLOAK: engage the ship's cloak (only ships with the cloak action, once
   * recharged); pressed while cloaked, it decloaks.
   * @param shipId - The ship.
   * @returns True when the cloak engaged.
   */
  toggleCloak(shipId: string): boolean {
    const arsenal = this.arsenals.get(shipId);
    if (!arsenal) return false;
    if (arsenalCloaked(arsenal)) {
      this.breakCloak(shipId);
      return false;
    }
    if (!startCloak(arsenal)) return false;
    this.pending.push({ kind: "cloak", shipId, cloaked: true });
    return true;
  }

  /** The ship attacked: its cloak drops. @param shipId - The ship. */
  breakCloak(shipId: string): void {
    const arsenal = this.arsenals.get(shipId);
    if (!arsenal || !arsenalCloaked(arsenal)) return;
    endCloak(arsenal);
    this.pending.push({ kind: "cloak", shipId, cloaked: false });
  }

  /**
   * FIRE_SECONDARY: fire the ship's selected slot.
   * @param shipId - The ship.
   * @param world - The battle this frame.
   * @param nowMs - Battle time (ms).
   * @returns What happened (HUD feedback).
   */
  fire(shipId: string, world: WeaponWorld, nowMs: number): FireOutcome {
    const arsenal = this.arsenals.get(shipId);
    const slot = arsenal?.slots[arsenal.selected];
    if (!arsenal || !slot) return "no_weapon";
    const bodies = indexBodies(world);
    const self = bodies.get(shipId);
    if (!self || self.hull <= 0) return "no_weapon";
    return this.fireSlot(arsenal, slot, self, { world, bodies, nowMs });
  }

  /**
   * Advance every weapon one frame.
   * @param world - The battle this frame.
   * @param deltaMs - Frame length (ms).
   * @param nowMs - Battle time (ms).
   * @returns Events to apply (hits) and show (launches, blasts, cloaks).
   */
  update(world: WeaponWorld, deltaMs: number, nowMs: number): WeaponEvent[] {
    const bodies = indexBodies(world);
    const visible = [...bodies.values()].filter(
      (body) => body.hull > 0 && !this.isCloaked(body.id),
    );
    for (const [shipId, arsenal] of this.arsenals) {
      this.tickShip(shipId, arsenal, deltaMs);
      const self = bodies.get(shipId);
      if (!self || self.hull <= 0) continue;
      const frame = { world, bodies, nowMs };
      this.updateLock(arsenal, self, frame, deltaMs);
      if (world.isBotControlled(shipId)) this.botTurn(arsenal, self, frame);
      if (arsenal.turret)
        this.turretTurn(arsenal, self, visible, frame, deltaMs);
    }
    const { random } = this.config;
    const field: FieldView = {
      bodies,
      isCloaked: (id) => this.isCloaked(id),
      random,
    };
    this.pending.push(...this.field.update(field, deltaMs));
    // A warhead in flight is its owner's attack on its target (no primary
    // may land in the same cycle as its impact, however long it flies).
    for (const shot of this.field.shotsInFlight) {
      if (shot.targetId)
        this.config.ledger.recordHit(shot.ownerId, shot.targetId, nowMs);
    }
    const events = this.pending;
    this.pending = [];
    return events;
  }

  private tickShip(shipId: string, arsenal: Arsenal, deltaMs: number): void {
    const wasCloaked = arsenalCloaked(arsenal);
    tickArsenal(arsenal, deltaMs);
    if (wasCloaked && !arsenalCloaked(arsenal)) {
      this.pending.push({ kind: "cloak", shipId, cloaked: false });
    }
  }

  private wantedTarget(self: WeaponBody, frame: FireFrame): WeaponBody | null {
    const id = frame.world.wantedTargetOf(self.id);
    const target = id ? frame.bodies.get(id) : undefined;
    if (!target || target.hull <= 0 || target.side === self.side) return null;
    return this.isCloaked(target.id) ? null : target;
  }

  private updateLock(
    arsenal: Arsenal,
    self: WeaponBody,
    frame: FireFrame,
    deltaMs: number,
  ): void {
    if (!arsenal.slots.some((slot) => isLauncher(slot.spec))) return;
    const target = this.wantedTarget(self, frame);
    arsenal.lock = stepLock(arsenal.lock, {
      wantedId: target?.id ?? null,
      rangePx: target
        ? torusRangePx(self, target, this.config.worldSize)
        : null,
      deltaMs,
    });
  }

  private botTurn(arsenal: Arsenal, self: WeaponBody, frame: FireFrame): void {
    const decision = this.config.decide?.(
      ordnanceViewOf({
        self,
        arsenal,
        target: this.wantedTarget(self, frame),
        bodies: frame.bodies.values(),
        isCloaked: (id) => this.isCloaked(id),
        worldSize: this.config.worldSize,
      }),
    );
    if (decision?.kind === "cloak") this.toggleCloak(self.id);
    const slot =
      decision?.kind === "fire" ? arsenal.slots[decision.slot] : undefined;
    if (slot) this.fireSlot(arsenal, slot, self, frame);
  }

  private turretTurn(
    arsenal: Arsenal,
    self: WeaponBody,
    visible: readonly WeaponBody[],
    frame: FireFrame,
    deltaMs: number,
  ): void {
    if (!arsenal.turret) return;
    const events = fireTurret({
      self,
      turret: arsenal.turret,
      visible,
      preferredId: frame.world.wantedTargetOf(self.id),
      ledger: this.config.ledger,
      random: this.config.random,
      worldSize: this.config.worldSize,
      deltaMs,
      nowMs: frame.nowMs,
    });
    if (events.length > 0) this.breakCloak(self.id);
    this.pending.push(...events);
  }

  private fireSlot(
    arsenal: Arsenal,
    slot: SlotState,
    self: WeaponBody,
    frame: FireFrame,
  ): FireOutcome {
    const target = this.wantedTarget(self, frame);
    const { ledger, worldSize } = this.config;
    let outcome = checkSecondaryFire(
      slot,
      arsenal.lock,
      self,
      target,
      worldSize,
    );
    if (
      target &&
      outcome === "launched" &&
      ledger.isImmune(self.id, target.id, frame.nowMs)
    )
      outcome = "attacked";
    const { spec } = slot;
    if (outcome === "launched" && target && isLauncher(spec)) {
      this.pending.push(this.field.launch(self, spec, target));
      arsenal.lock = spendLock(arsenal.lock);
      this.config.ledger.recordHit(self.id, target.id, frame.nowMs);
    } else if (outcome === "dropped" && !isLauncher(spec)) {
      this.pending.push(this.field.drop(self, spec));
    } else {
      return outcome;
    }
    slot.charges -= 1;
    slot.cooldownMs = spec.cooldownMs;
    this.breakCloak(self.id);
    return outcome;
  }
}
