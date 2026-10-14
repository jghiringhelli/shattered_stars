/**
 * Creature test builders: a small definition with one of each behaviour, and
 * a spy for the effects an encounter asks its scene to apply.
 */

import type {
  CreatureDefinition,
  CreaturePowerSpec,
} from "../../src/data/creatures/creatureTypes";
import type {
  CreatureEffects,
  CreatureEventKind,
  CreatureFrame,
  CreatureTarget,
} from "../../src/arcade/creatures/CreatureEncounter";

/** A cone power with a one-cycle wind-up. */
export const CONE_POWER: CreaturePowerSpec = {
  id: "spray",
  name: "SPRAY",
  kind: "cone",
  targeting: "nearest",
  windupCycles: 1,
  cooldownCycles: 3,
  damage: 10,
  stress: 0.2,
  rangePx: 300,
  arcDeg: 60,
  fromPhase: 0,
  weight: 1,
};

/**
 * @param overrides - Fields to change.
 * @returns A mid-sized serpentine creature with one part and two phases.
 */
export function aCreature(
  overrides: Partial<CreatureDefinition> = {},
): CreatureDefinition {
  return {
    id: "test_wyrm",
    name: "Test Wyrm",
    sizeClass: "large",
    radiusPx: 80,
    hullPoints: 20,
    shieldPoints: 0,
    movement: {
      style: "serpentine",
      speedPxPerS: 120,
      turnDegPerS: 90,
      standoffPx: 200,
      amplitude: 30,
      periodMs: 2000,
    },
    powers: [CONE_POWER],
    parts: [
      {
        id: "tail",
        name: "Tail gland",
        hpPoints: 2,
        bearingDeg: 180,
        arcDeg: 90,
        damageMultiplier: 2,
        offsetPx: 70,
      },
    ],
    phases: [
      { name: "Hunting", speedScale: 1, cooldownScale: 1, damageScale: 1 },
      { name: "Frenzy", speedScale: 1.5, cooldownScale: 0.5, damageScale: 1.5 },
    ],
    feedHullPoints: 0,
    isBoss: true,
    segmentCount: 0,
    spriteStem: "test",
    lore: { epithet: "", origin: "", description: "", tactics: "" },
    ...overrides,
  };
}

/** A pooled target the way a scene supplies it. */
export function aTarget(
  id: string,
  x: number,
  y: number,
  isFlagship = false,
): CreatureTarget {
  return { id, x, y, angle: 0, radiusPx: 20, isFlagship };
}

/** Everything an encounter asked its scene to do. */
export interface EffectLog {
  readonly damage: { id: string; amount: number }[];
  readonly stress: { id: string; amount: number }[];
  readonly nudges: { id: string; dx: number; dy: number }[];
  readonly spawns: { creatureId: string }[];
  readonly events: { kind: CreatureEventKind; label: string }[];
  healed: number;
}

/** @returns Effects recording every request, and the log. */
export function spyEffects(): { effects: CreatureEffects; log: EffectLog } {
  const log: EffectLog = {
    damage: [],
    stress: [],
    nudges: [],
    spawns: [],
    events: [],
    healed: 0,
  };
  const effects: CreatureEffects = {
    damage: (id, amount) => log.damage.push({ id, amount }),
    stress: (id, amount) => log.stress.push({ id, amount }),
    nudge: (id, dx, dy) => log.nudges.push({ id, dx, dy }),
    spawn: (creatureId) => log.spawns.push({ creatureId }),
    heal: (hull) => {
      log.healed += hull;
    },
    emit: (kind, label) => log.events.push({ kind, label }),
  };
  return { effects, log };
}

/**
 * @param nowMs - Time (ms).
 * @param targets - The prey.
 * @param hullFraction - Creature hull fraction.
 * @returns A frame of one logic tick.
 */
export function frameAt(
  nowMs: number,
  targets: readonly CreatureTarget[],
  hullFraction = 1,
): CreatureFrame {
  return {
    nowMs,
    deltaMs: 1000 / 60,
    hullFraction,
    shieldsUp: false,
    addsAlive: 0,
    targets,
  };
}
