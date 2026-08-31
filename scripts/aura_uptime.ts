/**
 * CLI: sweep support-aura radius vs lone-ally uptime.
 *
 * Prints the coverage fraction a single escorted ally maintains inside a
 * support ship's aura for a range of radii, so the aura radius can be tuned to
 * a target uptime (~65-70% for a lone anchored ally under default wander).
 *
 * Run: npx tsx scripts/aura_uptime.ts [--json]
 */

import { sweepAuraUptime } from "../src/simulation/AuraUptimeTelemetry";
import { AURA_RADIUS_DEFAULT } from "../src/systems/SupportAura";

const RADII = [120, 160, 200, 240, 280, 320, 360, 420];

/**
 * Format a 0-1 fraction as a padded percentage cell.
 * @param value - Fraction in [0, 1].
 * @returns A right-padded percent string.
 */
function pct(value: number): string {
  return `${Math.round(value * 100)}%`.padEnd(6);
}

/**
 * Entry point: print the uptime sweep (table or JSON).
 * @returns Nothing.
 */
function main(): void {
  const rows = sweepAuraUptime(RADII);
  if (process.argv.includes("--json")) {
    process.stdout.write(
      JSON.stringify({ defaultRadius: AURA_RADIUS_DEFAULT, rows }, null, 2) +
        "\n",
    );
    return;
  }

  process.stdout.write(
    "Support-aura uptime for a lone escorted ally (headless pursuit sim)\n",
  );
  process.stdout.write(
    `Default radius = ${AURA_RADIUS_DEFAULT}px. Higher radius -> higher uptime.\n\n`,
  );
  process.stdout.write("radius  uptime\n");
  for (const row of rows) {
    const mark = row.radius === AURA_RADIUS_DEFAULT ? "  <- default" : "";
    process.stdout.write(
      `${String(row.radius).padEnd(7)} ${pct(row.uptime)}${mark}\n`,
    );
  }
}

main();
