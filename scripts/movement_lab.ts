/**
 * Movement lab: compares the template and analog steering engines with a
 * proportional pilot and a key-tapper pilot (input latency, turn-rate
 * constancy, U-turn time and radius, smoothness, time in the firing wedge in
 * a duel against a novice bot, shots per minute), sweeps the analog
 * turn-rate scale and emulates battles (bots and a human-like pilot, template
 * vs analog tunings, many seeded rounds). Writes docs/balance/movement-lab.md.
 *
 * Usage: npm run movement:lab [-- --seeds=8 --duration=45 --speeds=3,2 --scales=1,0.75,0.5 --ship=<id> --out=<file>
 *   --battle-rounds=30 (0 = skip the battle emulation) --banks=45,55,60,70 --holds=off,250 --formations=1,2,4
 *   --battle-ships=terran_gladius,confed_sparrow]
 *
 * The battle emulation is slow (about 25 min per ship): fly shards in
 * parallel processes and merge them:
 *   --battle-ships=<id> --battle-sections=human --battle-json=shard.json   (a shard; writes no doc)
 *   --battle-merge=a.json,b.json                                          (the doc from shards)
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  assembleBattleReport,
  BATTLE_SECTIONS,
  formatBattleReport,
  runBattleRows,
  type BattleSection,
} from "../src/simulation/movementLab/BattleLab";
import type { BattleRow } from "../src/simulation/movementLab/LabBattleCells";
import { formatLabReport } from "../src/simulation/movementLab/LabReport";
import { runMovementLab } from "../src/simulation/movementLab/MovementLab";

/** Hulls of the battle emulation: cruise at throttle 3 (bank only), hard turn at 1-2. */
const DEFAULT_BATTLE_SHIPS = "terran_gladius,confed_sparrow";

/**
 * @param name - Option name (without dashes).
 * @param fallback - Value when the option is absent.
 * @returns The option's value from the command line.
 */
function option(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

/**
 * @param text - Comma-separated numbers.
 * @returns The numbers.
 */
function numbers(text: string): number[] {
  return text.split(",").map(Number);
}

/**
 * @param text - Comma-separated hold thresholds in ms, `off` = the variant is off.
 * @returns The thresholds (null = off).
 */
function holds(text: string): (number | null)[] {
  return text.split(",").map((part) => (part === "off" ? null : Number(part)));
}

/**
 * @param row - A finished battle row.
 * @returns A progress line.
 */
function progress(row: BattleRow): string {
  const { wins, losses, draws } = row.result;
  return `${row.definitionId} ${row.section} ${row.setting.label} ${row.formation}v${row.formation} vs ${row.versus}: ${wins}-${losses}-${draws}`;
}

/**
 * @returns The battle rows: merged from shards, or flown now (none when rounds = 0).
 */
function battleRows(): BattleRow[] {
  const merge = option("battle-merge", "");
  if (merge)
    return merge.split(",").flatMap((file) => JSON.parse(readFileSync(file, "utf8")) as BattleRow[]);
  const rounds = Number(option("battle-rounds", "30"));
  if (rounds <= 0) return [];
  const sections = option("battle-sections", BATTLE_SECTIONS.join(",")).split(",") as BattleSection[];
  return option("battle-ships", DEFAULT_BATTLE_SHIPS)
    .split(",")
    .flatMap((definitionId) =>
      runBattleRows(
        {
          definitionId,
          rounds,
          banks: numbers(option("banks", "45,55,60,70")),
          holds: holds(option("holds", "off,250")),
          squadFormations: numbers(option("formations", "1,2,4")),
        },
        sections,
        (row) => console.error(progress(row)),
      ),
    );
}

const shard = option("battle-json", "");
if (shard) {
  writeFileSync(shard, JSON.stringify(battleRows()));
  console.log(`Shard written to ${shard}`);
} else {
  const out = option("out", "docs/balance/movement-lab.md");
  const ship = option("ship", "");
  const report = runMovementLab({
    ...(ship ? { definitionId: ship } : {}),
    speeds: numbers(option("speeds", "3,2")),
    seeds: Number(option("seeds", "8")),
    durationMs: Number(option("duration", "45")) * 1000,
    rateScales: numbers(option("scales", "1,0.75,0.5")),
  });
  const rows = battleRows();
  const markdown = [
    formatLabReport(report),
    ...(rows.length > 0 ? ["", formatBattleReport(assembleBattleReport(rows))] : []),
  ].join("\n");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, markdown.trimEnd() + "\n");
  console.log(markdown);
  console.log(`\nWritten to ${out}`);
}
