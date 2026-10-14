/**
 * creatureTypes — the data model of the aerial / space creature bosses and
 * spawns (pure data, no Phaser). A creature is not a ship: it moves in its
 * own style (never the maneuver dial), fights with telegraphed powers (a
 * wind-up of one or two 500 ms cycles, then a cooldown), carries body parts
 * whose destruction disables a power, and grows angrier in phases. Its hull
 * and shields go through the shared durability path (miniature points ×
 * DURABILITY_SCALE), so every damage source of every mode works on it.
 */

/** How a creature moves (none of them is the ship maneuver dial). */
export type CreatureMovementStyle =
  /** Pursues in a sine-wave undulation; the body segments trail the head. */
  | "serpentine"
  /** Slow current-borne drift on a standoff orbit; powers do the work. */
  | "drift"
  /** A slow core with brood pods orbiting it. */
  | "hive"
  /** Stalks at standoff and phase-shifts (blinks) around its prey. */
  | "blink"
  /** Circles its prey, then lunges in a straight dash. */
  | "orbit_lunge";

/** Size class (body radius and sprite scale come from the definition). */
export type CreatureSizeClass = "small" | "medium" | "large" | "huge";

/** What a power does. */
export type CreaturePowerKind =
  /** A forward fan of acid / fire / bite. */
  | "cone"
  /** An expanding shockwave: hits the band between innerRangePx and rangePx. */
  | "ring"
  /** A tractor channel dragging prey toward the maw. */
  | "pull"
  /** A lingering spore cloud: slows and stresses whoever stays inside. */
  | "cloud"
  /** Calls adds into the fight. */
  | "summon"
  /** A psychic scream: stress on every pilot in earshot ("loud minds"). */
  | "scream"
  /** A rotating tentacle sweep. */
  | "sweep"
  /** A straight dash through the prey. */
  | "lunge"
  /** A psionic phase-shift: untargetable while it relocates. */
  | "blink";

/** Whom a power aims at. */
export type CreaturePowerTargeting =
  | "nearest"
  | "flagship"
  /** The target with the most other targets near it. */
  | "cluster"
  | "farthest";

/** One telegraphed power. */
export interface CreaturePowerSpec {
  readonly id: string;
  /** HUD label of the telegraph ("ACID SPRAY"). */
  readonly name: string;
  readonly kind: CreaturePowerKind;
  readonly targeting: CreaturePowerTargeting;
  /** Visible wind-up in 500 ms cycles (1 or 2) before the power lands. */
  readonly windupCycles: number;
  /** Cooldown after the power ends, in cycles. */
  readonly cooldownCycles: number;
  /** Real HP per target hit (a regular's shot is ≈ its attack dice, 2–3). */
  readonly damage: number;
  /** Instant stress added to a pilot hit, 0..1. */
  readonly stress: number;
  /** Reach: cone length, ring outer radius, pull / scream radius, cloud radius, lunge / blink distance. */
  readonly rangePx: number;
  /** Ring inner radius (the safe pocket by the body). */
  readonly innerRangePx?: number;
  /** Cone / sweep width in degrees. */
  readonly arcDeg?: number;
  /** Active window for pull, cloud, sweep and lunge (ms). */
  readonly durationMs?: number;
  /** Cloud: share of motion a slowed pilot keeps (0..1). */
  readonly slowFactor?: number;
  /** Pull: px/s dragged toward the maw. */
  readonly pullSpeedPxPerS?: number;
  /** Summon: adds called. */
  readonly spawnCount?: number;
  /** Summon: creature id of the adds. */
  readonly spawnCreatureId?: string;
  /** Disabled for good once this part is destroyed. */
  readonly requiresPart?: string;
  /** First phase (0-based) the power is used in. */
  readonly fromPhase: number;
  /** Relative pick weight. */
  readonly weight: number;
  /** The power is only picked with a target within this range (default rangePx). */
  readonly triggerRangePx?: number;
}

/** A body part: a hit pool that exposes a weak point or an armoured plate. */
export interface CreaturePartSpec {
  readonly id: string;
  readonly name: string;
  /** Miniature hit points (× DURABILITY_SCALE). */
  readonly hpPoints: number;
  /** Bearing of the part off the creature's nose (deg, 0 = ahead, clockwise). */
  readonly bearingDeg: number;
  /** Width of the attacker bearings that hit the part (deg). */
  readonly arcDeg: number;
  /** Hull damage multiplier on hits that land on the part (weak point > 1, plate < 1). */
  readonly damageMultiplier: number;
  /** Bearing drift (deg/s) for orbiting hive pods; 0 for fixed parts. */
  readonly orbitDegPerS?: number;
  /** Distance from the body centre for drawing and the pods (px). */
  readonly offsetPx: number;
}

/** A phase of a creature fight (enrage ladder). */
export interface CreaturePhaseSpec {
  readonly name: string;
  /** Multiplier on movement speed. */
  readonly speedScale: number;
  /** Multiplier on power cooldowns (< 1 = faster). */
  readonly cooldownScale: number;
  /** Multiplier on power damage. */
  readonly damageScale: number;
  /** Movement style override from this phase on. */
  readonly movementStyle?: CreatureMovementStyle;
}

/** Movement tuning (px, px/s, deg/s). */
export interface CreatureMovementSpec {
  readonly style: CreatureMovementStyle;
  readonly speedPxPerS: number;
  /** Turn rate toward the prey (deg/s). */
  readonly turnDegPerS: number;
  /** Distance it likes to keep from its prey (px). */
  readonly standoffPx: number;
  /** Serpentine undulation (deg) / orbit width (px). */
  readonly amplitude: number;
  /** Undulation period / orbit period (ms). */
  readonly periodMs: number;
  /** Blink: cycles between phase-shifts. */
  readonly blinkEveryCycles?: number;
}

/** Lore shown in the bestiary. */
export interface CreatureLore {
  readonly epithet: string;
  readonly origin: string;
  readonly description: string;
  readonly tactics: string;
}

/** Everything about one creature. */
export interface CreatureDefinition {
  readonly id: string;
  readonly name: string;
  readonly sizeClass: CreatureSizeClass;
  /** Body radius (px): targeting edge and contact range. */
  readonly radiusPx: number;
  /** Miniature hull points (× DURABILITY_SCALE). */
  readonly hullPoints: number;
  /** Miniature shield points (× DURABILITY_SCALE). */
  readonly shieldPoints: number;
  readonly movement: CreatureMovementSpec;
  readonly powers: readonly CreaturePowerSpec[];
  readonly parts: readonly CreaturePartSpec[];
  /** Phases in order (index 0 = the opening phase). */
  readonly phases: readonly CreaturePhaseSpec[];
  /** Hull regained per wreck it feeds on (miniature points); 0 = never regenerates. */
  readonly feedHullPoints: number;
  readonly isBoss: boolean;
  /** Body segments drawn behind the head (serpentine bodies). */
  readonly segmentCount: number;
  /** Asset key stem: textures are `creature_<stem>_body` / `_segment` / `_pod`. */
  readonly spriteStem: string;
  readonly lore: CreatureLore;
}
