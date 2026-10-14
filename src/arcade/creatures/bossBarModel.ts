/**
 * bossBarModel — what a creature boss's HUD bar shows, as plain data: name,
 * phase pips (current / reached), hull and shield fractions, each body part
 * (weak point or armoured plate, alive or destroyed and which power its loss
 * disabled), and the telegraphed power with its kind tag and seconds left.
 * Every signal is text or shape — never colour alone. Pure.
 */

import type { CreaturePowerKind } from "../../data/creatures/creatureTypes";
import type { CreatureEncounter } from "./CreatureEncounter";

/** Short text tag shown beside a telegraph (shape-independent, readable). */
export const POWER_TAGS: Readonly<Record<CreaturePowerKind, string>> = {
  cone: "FAN",
  ring: "RING",
  pull: "PULL",
  cloud: "CLOUD",
  summon: "CALL",
  scream: "SCREAM",
  sweep: "SWEEP",
  lunge: "LUNGE",
  blink: "BLINK",
};

/** One body part on the bar. */
export interface BossBarPart {
  readonly id: string;
  readonly name: string;
  readonly alive: boolean;
  readonly hpFraction: number;
  /** "weak" takes extra damage, "plate" less. */
  readonly kind: "weak" | "plate";
  /** Names of the powers its loss disabled (empty while it is alive). */
  readonly disables: readonly string[];
}

/** The telegraphed power. */
export interface BossBarTelegraph {
  readonly label: string;
  readonly tag: string;
  readonly stage: "windup" | "active";
  readonly secondsLeft: number;
}

/** Everything the bar draws. */
export interface BossBarView {
  readonly name: string;
  readonly epithet: string;
  readonly phaseName: string;
  readonly phases: readonly {
    readonly reached: boolean;
    readonly current: boolean;
  }[];
  readonly hullFraction: number;
  readonly shieldFraction: number;
  readonly parts: readonly BossBarPart[];
  readonly telegraph: BossBarTelegraph | null;
  readonly feeding: boolean;
  readonly phased: boolean;
}

/** The ship numbers the bar needs. */
export interface BossBarShip {
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
}

const MS_PER_S = 1000;

function fraction(value: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
}

/**
 * @param encounter - The creature's encounter.
 * @param ship - Its ship record (hull and shields).
 * @param nowMs - Sim time (ms).
 * @returns The bar's view.
 */
export function bossBarView(
  encounter: CreatureEncounter,
  ship: BossBarShip,
  nowMs: number,
): BossBarView {
  const definition = encounter.definition;
  const tele = encounter.telegraph;
  return {
    name: definition.name.toUpperCase(),
    epithet: definition.lore.epithet,
    phaseName: encounter.phase.name,
    phases: Array.from({ length: encounter.phaseCount }, (_, i) => ({
      reached: i <= encounter.phaseIndex,
      current: i === encounter.phaseIndex,
    })),
    hullFraction: fraction(ship.hull, ship.maxHull),
    shieldFraction: fraction(ship.shields, ship.maxShields),
    parts: encounter.parts.map((part) => ({
      id: part.spec.id,
      name: part.spec.name,
      alive: part.alive,
      hpFraction: fraction(part.hp, part.maxHp),
      kind: part.spec.damageMultiplier >= 1 ? "weak" : "plate",
      disables: part.alive
        ? []
        : definition.powers
            .filter((power) => power.requiresPart === part.spec.id)
            .map((power) => power.name),
    })),
    telegraph:
      tele.stage === "idle"
        ? null
        : {
            label: tele.name,
            tag: POWER_TAGS[tele.kind],
            stage: tele.stage,
            secondsLeft: Math.max(0, (tele.endsMs - nowMs) / MS_PER_S),
          },
    feeding: encounter.feeding,
    phased: encounter.phased,
  };
}
