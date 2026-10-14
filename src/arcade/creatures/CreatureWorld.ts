/**
 * CreatureWorld — the contract between a creature encounter and the battle
 * scene (or headless sim) it lives in. The encounter reads what any ship bot
 * reads (the prey's positions, its own hull fraction) from a
 * {@link CreatureFrame}, and asks the scene to apply effects through
 * {@link CreatureEffects}: damage, stress, nudges, summons, healing, cues.
 * The scene owns the ships; the encounter owns the creature's behaviour.
 */

/** A ship the creature may hunt (the scene pools and reuses these). */
export interface CreatureTarget {
  readonly id: string;
  x: number;
  y: number;
  angle: number;
  /** Hull radius (px). */
  radiusPx: number;
  /** The player's own ship (the flagship). */
  isFlagship: boolean;
}

/** One logic tick of input. */
export interface CreatureFrame {
  /** Sim time (ms) — never the wall clock. */
  readonly nowMs: number;
  readonly deltaMs: number;
  /** The creature's hull as a fraction of max (the scene owns the hull). */
  readonly hullFraction: number;
  /** True while its shields still hold (parts are not exposed). */
  readonly shieldsUp: boolean;
  /** Adds of this creature alive on the field. */
  readonly addsAlive: number;
  /** Living ships hostile to the creature. */
  readonly targets: readonly CreatureTarget[];
}

/** What happened, for cues (audio, HUD, floating text). */
export type CreatureEventKind =
  | "telegraph"
  | "power"
  | "part_destroyed"
  | "phase"
  | "feed"
  | "feed_broken"
  | "phase_shift";

/** What an encounter asks its scene to do. */
export interface CreatureEffects {
  /** Real HP of damage to a ship (the scene runs it through its shield / relic path). */
  damage(targetId: string, amount: number): void;
  /** Instant stress (0..1) on a pilot. */
  stress(targetId: string, amount: number): void;
  /** Moves a ship by a vector (tractor pull, spore drag). */
  nudge(targetId: string, dx: number, dy: number): void;
  /** Calls an add of the given creature id at a point. */
  spawn(creatureId: string, x: number, y: number, angle: number): void;
  /** Heals the creature's hull by real HP. */
  heal(hull: number): void;
  /** A cue happened. */
  emit(kind: CreatureEventKind, label: string, x: number, y: number): void;
}
