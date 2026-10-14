/**
 * hullTraits — what a hull's bare statistics are good and bad at, in plain
 * words with the real numbers ("evasive (Agility 3)"). Pure.
 */

import type { ShipDefinition } from "../../core/types";

/** Hull + shields from which a ship reads as sturdy / below which fragile. */
const STURDY_DURABILITY = 10;
const FRAGILE_DURABILITY = 5;
/** Agility from which a ship reads as evasive / at which it is clumsy. */
const EVASIVE_AGILITY = 3;
const CLUMSY_AGILITY = 1;
/** Attack from which a ship hits hard / at which it has light guns. */
const HARD_HITTING_ATTACK = 4;
const LIGHT_GUNS_ATTACK = 2;
/** Top speed from which a ship is fast / at which it is slow. */
const FAST_TOP_SPEED = 5;
const SLOW_TOP_SPEED = 3;

/** What a hull is good and bad at. */
export interface HullTraits {
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
}

/**
 * @param ship - A ship definition.
 * @returns Strength and weakness phrases with the real stat values.
 */
export function hullTraits(ship: ShipDefinition): HullTraits {
  const { hull, shields, attack, agility, speed, size } = ship.baseStats;
  const capital = ship.role === "capital" || size === "huge";
  const durability = hull + shields;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (durability >= STURDY_DURABILITY || capital)
    strengths.push(`sturdy (${hull} hull + ${shields} shields)`);
  else if (durability <= FRAGILE_DURABILITY)
    weaknesses.push(`fragile (${hull} hull + ${shields} shields)`);
  if (agility >= EVASIVE_AGILITY) strengths.push(`evasive (Agility ${agility})`);
  else if (agility <= CLUMSY_AGILITY && !capital)
    weaknesses.push(`clumsy (Agility ${agility})`);
  if (attack >= HARD_HITTING_ATTACK)
    strengths.push(`hard-hitting (Attack ${attack})`);
  else if (attack <= LIGHT_GUNS_ATTACK)
    weaknesses.push(`light guns (Attack ${attack})`);
  if (speed.max >= FAST_TOP_SPEED)
    strengths.push(`fast (speed up to ${speed.max})`);
  else if (speed.max <= SLOW_TOP_SPEED && !capital)
    weaknesses.push(`slow (top speed ${speed.max})`);
  if (strengths.length === 0)
    strengths.push(`balanced stats (Attack ${attack}, Agility ${agility})`);
  if (weaknesses.length === 0)
    weaknesses.push("no standout flaw — it wins or loses on its build");
  return { strengths, weaknesses };
}
