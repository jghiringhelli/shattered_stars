/**
 * CLI: support-aura coverage telemetry.
 *
 * Two views:
 *  1. Radius sweep — coverage fraction a lone escorted ally holds for a range
 *     of radii, to see how radius maps to uptime under default wander.
 *  2. Per-faction — each faction's signature aura, its radius, effect, and the
 *     resulting lone-ally uptime, so support ships can be tuned to a ~65-70%
 *     sweet spot in mid-sized (4-6 ship) squads.
 *
 * Run: npx tsx scripts/aura_uptime.ts [--json]
 */

import {
  measureAuraUptime,
  sweepAuraUptime,
} from "../src/simulation/AuraUptimeTelemetry";
import { FACTION_AURAS } from "../src/systems/SupportAura";

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
 * Emit the JSON view (radius sweep + per-faction uptime).
 * @returns Nothing.
 */
function emitJson(): void {
  const factions = Object.values(FACTION_AURAS).map((aura) => ({
    faction: aura.faction,
    name: aura.name,
    effect: aura.effect,
    radius: aura.radius,
    uptime: measureAuraUptime({ radius: aura.radius }),
  }));
  process.stdout.write(
    JSON.stringify({ sweep: sweepAuraUptime(RADII), factions }, null, 2) + "\n",
  );
}

/**
 * Entry point: print the coverage tables (or JSON).
 * @returns Nothing.
 */
function main(): void {
  if (process.argv.includes("--json")) {
    emitJson();
    return;
  }

  process.stdout.write(
    "Support-aura coverage for a lone escorted ally (headless pursuit sim)\n\n",
  );
  process.stdout.write("radius  uptime\n");
  for (const row of sweepAuraUptime(RADII)) {
    process.stdout.write(
      `${String(row.radius).padEnd(7)} ${pct(row.uptime)}\n`,
    );
  }

  process.stdout.write(
    "\nfaction              aura              effect            radius  uptime\n",
  );
  for (const aura of Object.values(FACTION_AURAS)) {
    const uptime = measureAuraUptime({ radius: aura.radius });
    process.stdout.write(
      `${aura.faction.padEnd(20)} ${aura.name.padEnd(17)} ${aura.effect.padEnd(17)} ${String(aura.radius).padEnd(7)} ${pct(uptime)}\n`,
    );
  }
}

main();
