/**
 * CLI: ship point-efficiency analysis.
 *
 * Computes each ship's combat rating (expected damage x effective durability)
 * relative to its squad-point cost, ranks the roster, and flags ships that are
 * over- or under-costed within their role so the catalogue "makes sense".
 *
 * Usage:
 *   npx tsx scripts/ship_efficiency.ts [--role gunship] [--stddev 1.5] [--json out.json]
 */

import { writeFileSync } from "node:fs";
import { SHIP_DEFINITIONS } from "../src/data/ShipDefinitions";
import {
  rankShipsByEfficiency,
  flagCostOutliers,
  type ShipValue,
} from "../src/simulation/ShipEfficiency";

interface CliArgs {
  readonly role: string | null;
  readonly stdDevs: number;
  readonly json: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  let role: string | null = null;
  let stdDevs = 1.5;
  let json: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--role") role = argv[++i] ?? null;
    else if (arg === "--stddev") stdDevs = Number(argv[++i]);
    else if (arg === "--json") json = argv[++i] ?? null;
  }
  return { role, stdDevs, json };
}

function pad(value: string | number, width: number): string {
  return String(value).padEnd(width);
}

function fmt(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function printRow(v: ShipValue): void {
  console.log(
    pad(v.name, 26) +
      pad(v.role, 15) +
      pad(v.pointCost, 5) +
      pad(fmt(v.offense), 8) +
      pad(fmt(v.durability), 9) +
      pad(fmt(v.combatRating), 9) +
      fmt(v.ratingPerPoint, 3),
  );
}

function printHeader(): void {
  console.log(
    pad("ship", 26) +
      pad("role", 15) +
      pad("pts", 5) +
      pad("offense", 8) +
      pad("durab.", 9) +
      pad("rating", 9) +
      "rating/pt",
  );
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const allValues = rankShipsByEfficiency();
  const shown = args.role
    ? allValues.filter((v) => v.role === args.role)
    : allValues;

  console.log(
    `Ship efficiency - ${shown.length} ships${args.role ? ` (role=${args.role})` : ""}`,
  );
  console.log("Higher rating/pt = more combat value per squad point.\n");
  printHeader();
  for (const v of shown) printRow(v);

  const outliers = flagCostOutliers(allValues, args.stdDevs);
  console.log(
    `\n=== UNDER-COSTED (too strong for cost, > ${args.stdDevs}sd within role) ===`,
  );
  if (outliers.underCosted.length === 0) console.log("  none");
  for (const v of outliers.underCosted) printRow(v);
  console.log(
    `\n=== OVER-COSTED (too weak for cost, > ${args.stdDevs}sd within role) ===`,
  );
  if (outliers.overCosted.length === 0) console.log("  none");
  for (const v of outliers.overCosted) printRow(v);

  if (args.json) {
    const payload = {
      ships: allValues,
      outliers,
      totalShips: Object.keys(SHIP_DEFINITIONS).length,
    };
    writeFileSync(args.json, JSON.stringify(payload, null, 2));
    console.log(`\nWrote efficiency report to ${args.json}`);
  }
}

main();
