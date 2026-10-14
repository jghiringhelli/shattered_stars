/**
 * duelStatsModel — the STATS tab of the duel setups: both ships' numbers
 * side by side (build bonuses folded in) and who is ahead on each row.
 * Pure: no Phaser.
 */

import type { ShipDefinition } from "../../core/types";
import type { TermId } from "../../data/tooltips";

/** Stat bonuses a quick build adds (the picker's LoadoutBonuses subset). */
export interface StatBonuses {
  readonly hull: number;
  readonly shld: number;
  readonly atk: number;
  readonly agi: number;
}

/** Which side leads a row. */
export type RowLead = "you" | "enemy" | "tie";

/** One compared stat. */
export interface StatCompareRow {
  readonly label: string;
  readonly you: number;
  readonly enemy: number;
  readonly better: RowLead;
  readonly term: TermId;
}

/**
 * @param you - Your value.
 * @param enemy - The enemy's value.
 * @returns The side with the higher value.
 */
function leader(you: number, enemy: number): RowLead {
  if (you === enemy) return "tie";
  return you > enemy ? "you" : "enemy";
}

/**
 * @param yours - Your ship.
 * @param yourBonus - Bonuses of your build.
 * @param theirs - The enemy ship.
 * @param theirBonus - Bonuses of the enemy build.
 * @returns Hull, shields, attack, agility and speed rows.
 */
export function compareStats(
  yours: ShipDefinition,
  yourBonus: StatBonuses,
  theirs: ShipDefinition,
  theirBonus: StatBonuses,
): StatCompareRow[] {
  const mine = yours.baseStats;
  const other = theirs.baseStats;
  const row = (
    label: string,
    you: number,
    enemy: number,
    term: TermId,
  ): StatCompareRow => ({ label, you, enemy, better: leader(you, enemy), term });
  return [
    row("HULL", mine.hull + yourBonus.hull, other.hull + theirBonus.hull, "stat.hull"),
    row("SHIELDS", mine.shields + yourBonus.shld, other.shields + theirBonus.shld, "stat.shields"),
    row("ATTACK", mine.attack + yourBonus.atk, other.attack + theirBonus.atk, "stat.attack"),
    row("AGILITY", mine.agility + yourBonus.agi, other.agility + theirBonus.agi, "stat.agility"),
    row("SPEED", mine.speed.max, other.speed.max, "stat.speed"),
  ];
}
