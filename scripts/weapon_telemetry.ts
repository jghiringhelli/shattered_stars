/**
 * CLI: headless weapon-damage telemetry.
 *
 * Runs Monte-Carlo damage sampling against the REAL combat resolvers and prints
 * a per-weapon table (mean damage, hit rate, damage-per-point, burst value) for
 * every turret and ordnance card, plus a primary-weapon (laser) reference grid.
 *
 * Usage:
 *   npx tsx scripts/weapon_telemetry.ts [--samples 20000] [--seed 1] [--json out.json]
 */

import { writeFileSync } from "node:fs";
import { createSeededRng } from "../src/utils/random";
import {
  profileAllWeapons,
  sampleLaserDamage,
  type WeaponProfile,
} from "../src/simulation/WeaponTelemetry";

interface CliArgs {
  readonly samples: number;
  readonly seed: number;
  readonly json: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  let samples = 20_000;
  let seed = 1;
  let json: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--samples") samples = Number(argv[++i]);
    else if (arg === "--seed") seed = Number(argv[++i]);
    else if (arg === "--json") json = argv[++i] ?? null;
  }
  return { samples, seed, json };
}

function pad(value: string | number, width: number): string {
  return String(value).padEnd(width);
}

function fmt(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function printWeaponTable(title: string, rows: WeaponProfile[]): void {
  console.log(`\n=== ${title} ===`);
  console.log(
    pad("weapon", 24) +
      pad("pts", 5) +
      pad("mean", 7) +
      pad("hit%", 7) +
      pad("dmg/pt", 8) +
      pad("burst/pt", 9) +
      "note",
  );
  for (const r of rows) {
    console.log(
      pad(r.name, 24) +
        pad(r.pointCost, 5) +
        pad(fmt(r.meanDamage), 7) +
        pad(fmt(r.hitRate * 100, 1), 7) +
        pad(fmt(r.damagePerPoint, 3), 8) +
        pad(
          Number.isFinite(r.burstDamagePerPoint)
            ? fmt(r.burstDamagePerPoint, 3)
            : "n/a",
          9,
        ) +
        r.note,
    );
  }
}

/** Primary-weapon reference: expected damage for attack dice vs agility. */
function printLaserGrid(samples: number, seed: number): void {
  console.log(
    "\n=== Primary weapons (lasers) - mean damage by dice vs agility ===",
  );
  console.log(
    pad("attackDice", 12) + [0, 1, 2, 3].map((a) => pad(`agi${a}`, 8)).join(""),
  );
  for (let dice = 1; dice <= 5; dice++) {
    const cells = [0, 1, 2, 3].map((agi) => {
      const s = sampleLaserDamage(
        dice,
        { defenseDice: agi },
        samples,
        createSeededRng(seed),
      );
      return pad(fmt(s.mean), 8);
    });
    console.log(pad(dice, 12) + cells.join(""));
  }
  console.log(
    "\nNote: turrets and ordnance do NOT roll defense dice — their damage ignores target agility.",
  );
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const rng = createSeededRng(args.seed);
  const profiles = profileAllWeapons(args.samples, rng);

  const turrets = profiles.filter((p) => p.category === "turret");
  const ordnance = profiles.filter((p) => p.category === "ordnance");

  console.log(
    `Weapon telemetry - ${args.samples} samples/weapon, seed ${args.seed}`,
  );
  printLaserGrid(args.samples, args.seed);
  printWeaponTable("Turrets (sampled at closest valid range)", turrets);
  printWeaponTable(
    "Ordnance (single shot; burst/pt spans all charges)",
    ordnance,
  );

  if (args.json) {
    writeFileSync(
      args.json,
      JSON.stringify(
        { samples: args.samples, seed: args.seed, profiles },
        null,
        2,
      ),
    );
    console.log(`\nWrote ${profiles.length} weapon profiles to ${args.json}`);
  }
}

main();
