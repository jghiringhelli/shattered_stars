/**
 * CLI: arcade weapon hit-rate telemetry.
 *
 * Prints a grid of straight-bolt (front laser == auto-aim turret) hit rates and
 * homing-ordnance hit rates across ranges and target speeds, using the REAL
 * projectile motion/collision functions. Confirms turret/laser parity and shows
 * where straight shots start missing fast crossing targets.
 *
 * Usage: npx tsx scripts/arcade_hitrate.ts
 */

import { sweepHitRates } from "../src/simulation/ArcadeHitRate";

const RANGES = [150, 250, 350, 500, 700];
const SPEEDS = [0, 100, 200, 300, 450, 600];

function pad(value: string | number, width: number): string {
  return String(value).padEnd(width);
}

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function printGrid(
  title: string,
  pick: (range: number, speed: number) => number,
): void {
  console.log(`\n=== ${title} (rows=target speed px/s, cols=range px) ===`);
  console.log(pad("speed", 8) + RANGES.map((r) => pad(r, 7)).join(""));
  for (const speed of SPEEDS) {
    const cells = RANGES.map((range) => pad(pct(pick(range, speed)), 7));
    console.log(pad(speed, 8) + cells.join(""));
  }
}

function main(): void {
  const rows = sweepHitRates(RANGES, SPEEDS);
  const at = (range: number, speed: number) =>
    rows.find((r) => r.range === range && r.targetSpeed === speed)!;

  console.log(
    "Arcade weapon hit-rate telemetry (kinematic, real projectile functions)",
  );
  console.log(
    "Front lasers and 360 turrets fire the SAME straight bolt -> identical hit rate.",
  );
  console.log(
    "Turret advantage: auto-aims every cooldown; laser needs the ship pointed at the target.",
  );

  printGrid("Straight bolt (laser / turret)", (r, s) => at(r, s).boltHitRate);
  printGrid("Homing missile", (r, s) => at(r, s).homingMissileHitRate);
  printGrid("Homing torpedo", (r, s) => at(r, s).homingTorpedoHitRate);
}

main();
