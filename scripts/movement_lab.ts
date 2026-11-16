/**
 * Movement lab: compares the template and analog steering engines with a
 * proportional pilot and a key-tapper pilot (input latency, turn-rate
 * constancy, U-turn time and radius, smoothness, time in the firing wedge in
 * a duel against a novice bot, shots per minute) and sweeps the analog
 * turn-rate scale. Writes docs/balance/movement-lab.md.
 *
 * Usage: npm run movement:lab [-- --seeds=8 --duration=45 --speeds=3,2 --scales=1,0.75,0.5 --ship=<id> --out=<file>]
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { formatLabReport } from "../src/simulation/movementLab/LabReport";
import { runMovementLab } from "../src/simulation/movementLab/MovementLab";

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

const out = option("out", "docs/balance/movement-lab.md");
const ship = option("ship", "");
const report = runMovementLab({
  ...(ship ? { definitionId: ship } : {}),
  speeds: numbers(option("speeds", "3,2")),
  seeds: Number(option("seeds", "8")),
  durationMs: Number(option("duration", "45")) * 1000,
  rateScales: numbers(option("scales", "1,0.75,0.5")),
});
const markdown = formatLabReport(report);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, markdown.trimEnd() + "\n");
console.log(markdown);
console.log(`\nWritten to ${out}`);
