/**
 * telemetry_worker — child process of the telemetry battery: runs one cell
 * (optionally under a what-if tempo) and writes its match samples as JSON.
 * Spawned by telemetry_pool.ts; not meant to be run by hand.
 *
 * Usage: node --import tsx scripts/telemetry_worker.ts --cell <id> --seeds <n> --out <file> [--tempo <json>]
 */

import * as fs from "fs";
import { batteryCell } from "../src/simulation/batteryCells";
import type { TempoVariant } from "../src/simulation/TempoVariant";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main(): void {
  const id = arg("--cell") ?? "";
  const cell = batteryCell(id);
  if (!cell) throw new Error(`Unknown battery cell "${id}"`);
  const tempoJson = arg("--tempo");
  const tempo = tempoJson ? (JSON.parse(tempoJson) as TempoVariant) : undefined;
  const samples = cell.run(Number(arg("--seeds") ?? 10), tempo);
  fs.writeFileSync(arg("--out") ?? "samples.json", JSON.stringify(samples));
}

main();
