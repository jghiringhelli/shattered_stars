/**
 * CreatureHost — drives every creature of a battle for a scene or a headless
 * sim. Each creature is a ship record in the battle (hull, shields, kills,
 * rewards go through the mode's shared combat model); the host builds its
 * {@link CreatureFrame} from the opposing ships each tick (pooled — nothing
 * is allocated per frame once the ships were seen), steps its encounter,
 * writes the pose back, and turns the encounter's effects into calls on a
 * {@link CreatureHostBridge} — the mode's own damage / stress / spawn path.
 * Pure: no Phaser.
 */

import type { CreatureEncounter } from "./CreatureEncounter";
import type {
  CreatureEffects,
  CreatureEventKind,
  CreatureFrame,
  CreatureTarget,
} from "./CreatureWorld";

/** A ship record as the host reads it. */
export interface CreatureHostShip {
  readonly id: string;
  readonly owner: "player" | "ai";
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
  /** The encounter that drives it (absent / null for an ordinary ship). */
  readonly creature?: CreatureEncounter | null;
  /** Hull radius of a creature (px). */
  readonly radiusPx?: number;
  /** True for a boss creature (adds are counted against it). */
  readonly isBossCreature?: boolean;
}

/** What a mode provides to its creatures. */
export interface CreatureHostBridge<S extends CreatureHostShip> {
  ships(): Iterable<S>;
  /** The player's own ship (power targeting "flagship"). */
  isFlagship(ship: S): boolean;
  /** Real HP of damage through the mode's shield / relic / kill path. */
  damage(victim: S, amount: number, attacker: S): void;
  stress(victim: S, amount: number): void;
  nudge(victim: S, dx: number, dy: number): void;
  /** True while a creature is stunned (EMP): it neither moves nor acts this tick. */
  isSuppressed?(ship: S): boolean;
  /** Writes the creature's pose to its ship (and sprite / flight state). */
  setPose(ship: S, x: number, y: number, angle: number): void;
  spawnAdd(creatureId: string, x: number, y: number, angle: number): void;
  /** The creature healed (refresh its bars). */
  healed(ship: S, hull: number): void;
  /** A cue happened (telegraph, power, part destroyed, phase, feed). */
  event(
    ship: S,
    kind: CreatureEventKind,
    label: string,
    x: number,
    y: number,
  ): void;
}

/** The pooled prey list and effects of one creature ship. */
class CreatureLink<S extends CreatureHostShip> {
  readonly targets: CreatureTarget[] = [];
  readonly effects: CreatureEffects;
  private readonly pool = new Map<string, CreatureTarget>();
  private readonly byId = new Map<string, S>();

  constructor(
    private readonly ship: S,
    private readonly bridge: CreatureHostBridge<S>,
  ) {
    this.effects = {
      damage: (id, amount) => {
        const victim = this.livingVictim(id);
        if (victim) bridge.damage(victim, amount, ship);
      },
      stress: (id, amount) => {
        const victim = this.livingVictim(id);
        if (victim) bridge.stress(victim, amount);
      },
      nudge: (id, dx, dy) => {
        const victim = this.livingVictim(id);
        if (victim) bridge.nudge(victim, dx, dy);
      },
      spawn: (creatureId, x, y, angle) =>
        bridge.spawnAdd(creatureId, x, y, angle),
      heal: (hull) => bridge.healed(ship, hull),
      emit: (kind, label, x, y) => bridge.event(ship, kind, label, x, y),
    };
  }

  private livingVictim(id: string): S | undefined {
    const victim = this.byId.get(id);
    return victim && victim.hull > 0 ? victim : undefined;
  }

  /** Rebuilds the prey list from the living ships of the other side. */
  refresh(): void {
    this.targets.length = 0;
    this.byId.clear();
    for (const other of this.bridge.ships()) {
      if (other.hull <= 0 || other.owner === this.ship.owner) continue;
      let target = this.pool.get(other.id);
      if (!target) {
        target = {
          id: other.id,
          x: 0,
          y: 0,
          angle: 0,
          radiusPx: 0,
          isFlagship: false,
        };
        this.pool.set(other.id, target);
      }
      target.x = other.x;
      target.y = other.y;
      target.angle = other.angle;
      target.radiusPx = other.radiusPx ?? 0;
      target.isFlagship = this.bridge.isFlagship(other);
      this.targets.push(target);
      this.byId.set(other.id, other);
    }
  }
}

/** Steps every creature of one battle. */
export class CreatureHost<S extends CreatureHostShip> {
  private readonly links = new Map<string, CreatureLink<S>>();

  /** @param bridge - The mode's damage / spawn / pose path. */
  constructor(private readonly bridge: CreatureHostBridge<S>) {}

  /**
   * One logic tick of every living creature.
   *
   * @param nowMs - Sim time (ms).
   * @param deltaMs - Frame length (ms).
   */
  step(nowMs: number, deltaMs: number): void {
    let adds = 0;
    for (const ship of this.bridge.ships())
      if (ship.creature && !ship.isBossCreature && ship.hull > 0) adds++;
    for (const ship of this.bridge.ships()) {
      const encounter = ship.creature;
      if (!encounter || ship.hull <= 0) continue;
      if (this.bridge.isSuppressed?.(ship)) continue;
      const link = this.linkOf(ship);
      link.refresh();
      const frame: CreatureFrame = {
        nowMs,
        deltaMs,
        hullFraction: ship.hull / ship.maxHull,
        shieldsUp: ship.shields > 0,
        addsAlive: ship.isBossCreature ? adds : 0,
        targets: link.targets,
      };
      encounter.step(frame, link.effects);
      this.bridge.setPose(ship, encounter.x, encounter.y, encounter.angle);
    }
  }

  /**
   * A ship died: every living creature may feed on the wreck.
   *
   * @param victim - The ship that died.
   */
  noteWreck(victim: Pick<S, "x" | "y">): void {
    for (const ship of this.bridge.ships())
      if (ship.creature && ship.hull > 0)
        ship.creature.noteWreck(victim.x, victim.y);
  }

  /** @param shipId - A creature ship that is gone. */
  forget(shipId: string): void {
    this.links.delete(shipId);
  }

  private linkOf(ship: S): CreatureLink<S> {
    let link = this.links.get(ship.id);
    if (!link) {
      link = new CreatureLink(ship, this.bridge);
      this.links.set(ship.id, link);
    }
    return link;
  }
}
