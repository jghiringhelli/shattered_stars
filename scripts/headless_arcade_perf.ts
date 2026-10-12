/**
 * Headless Arcade Performance Benchmark
 *
 * Runs the extracted pure arcade systems (FrameCache, CombatSystem,
 * VictorySystem) at various ship/projectile counts without Phaser.
 * Reports ms/tick to verify the ~4ms budget at 128 ships.
 *
 * Usage:
 *   npx tsx scripts/headless_arcade_perf.ts [--ticks N]
 */

import { buildFrameCache } from "../src/arcade/systems/ArcadeFrameCache";
import { resolveCollisions } from "../src/arcade/systems/ArcadeCombatSystem";
import { checkVictoryCondition } from "../src/arcade/systems/ArcadeVictorySystem";
import type { Projectile } from "../src/core/Projectile";

const SHIP_COUNTS = [8, 16, 32, 64, 128];
const PROJECTILES_PER_SHIP = 2;
const DEFAULT_TICKS = 300;

function parseArgs(): { ticks: number } {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--ticks");
  const ticks =
    idx >= 0 && args[idx + 1] ? parseInt(args[idx + 1]!, 10) : DEFAULT_TICKS;
  return { ticks: Number.isNaN(ticks) ? DEFAULT_TICKS : ticks };
}

interface FakeShip {
  id: string;
  faction: string;
  team: number;
  hull: number;
  x: number;
  y: number;
}

function generateShips(count: number): FakeShip[] {
  const ships: FakeShip[] = [];
  const factions = ["alpha", "beta"];
  for (let i = 0; i < count; i++) {
    ships.push({
      id: `ship_${i}`,
      faction: factions[i % 2]!,
      team: i % 2,
      hull: 5 + Math.floor(Math.random() * 5),
      x: Math.random() * 4000,
      y: Math.random() * 4000,
    });
  }
  return ships;
}

/** Benchmark projectile: a real Projectile plus a fixed velocity to drift it each tick. */
type BenchProjectile = Projectile & { vx: number; vy: number };

function generateProjectiles(ships: FakeShip[]): BenchProjectile[] {
  const projs: BenchProjectile[] = [];
  for (const ship of ships) {
    for (let j = 0; j < PROJECTILES_PER_SHIP; j++) {
      projs.push({
        id: `proj_${ship.id}_${j}`,
        x: ship.x + (Math.random() - 0.5) * 100,
        y: ship.y + (Math.random() - 0.5) * 100,
        angle: 0,
        vx: Math.cos(Math.random() * Math.PI * 2) * 300,
        vy: Math.sin(Math.random() * Math.PI * 2) * 300,
        damage: 2,
        ownerId: ship.id,
        ownerFaction: ship.faction,
        lifetime: 2000,
        maxLifetime: 2000,
        speed: 300,
        isHoming: false,
        homingTargetId: null,
        homingTurnRate: 0,
        homingTurnBudget: 0,
      });
    }
  }
  return projs;
}

function benchmarkTier(
  shipCount: number,
  ticks: number,
): { avgMs: number; maxMs: number; p95Ms: number } {
  const ships = generateShips(shipCount);
  const projectiles = generateProjectiles(ships);
  const times: number[] = [];

  for (let t = 0; t < ticks; t++) {
    for (const ship of ships) {
      ship.x += (Math.random() - 0.5) * 10;
      ship.y += (Math.random() - 0.5) * 10;
    }
    for (const p of projectiles) {
      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;
    }

    const start = performance.now();

    const cache = buildFrameCache(ships);
    resolveCollisions(projectiles, cache.aliveShips, 15);
    checkVictoryCondition(cache, 0);

    const elapsed = performance.now() - start;
    times.push(elapsed);
  }

  times.sort((a, b) => a - b);
  const avg = times.reduce((s, v) => s + v, 0) / times.length;
  const p95 = times[Math.floor(times.length * 0.95)]!;
  const max = times[times.length - 1]!;

  return { avgMs: avg, maxMs: max, p95Ms: p95 };
}

function main(): void {
  const { ticks } = parseArgs();

  console.log(`Headless Arcade Performance Benchmark`);
  console.log(`Ticks per tier: ${ticks}`);
  console.log(`Projectiles/ship: ${PROJECTILES_PER_SHIP}`);
  console.log(
    `Budget: <4ms/tick for AI+collision+victory within 16.67ms frame`,
  );
  console.log(`─────────────────────────────────────────────────────`);
  console.log(
    `${"Ships".padEnd(8)}${"Projs".padEnd(8)}${"Avg(ms)".padEnd(12)}${"P95(ms)".padEnd(12)}${"Max(ms)".padEnd(12)}Status`,
  );
  console.log(`─────────────────────────────────────────────────────`);

  for (const count of SHIP_COUNTS) {
    const projCount = count * PROJECTILES_PER_SHIP;
    const result = benchmarkTier(count, ticks);
    const status = result.p95Ms < 4 ? "✓ PASS" : "⚠ OVER BUDGET";
    console.log(
      `${String(count).padEnd(8)}${String(projCount).padEnd(8)}${result.avgMs.toFixed(3).padEnd(12)}${result.p95Ms.toFixed(3).padEnd(12)}${result.maxMs.toFixed(3).padEnd(12)}${status}`,
    );
  }

  console.log(`─────────────────────────────────────────────────────`);
}

main();
