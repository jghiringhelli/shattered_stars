/**
 * balance_worker — child process of the balance report: runs a batch of
 * balance jobs (JSON file in) and writes their results (JSON file out).
 * Spawned by scripts/balance/pool.ts; not meant to be run by hand.
 *
 * Usage: node --import tsx scripts/balance_worker.ts --in <jobs.json> --out <results.json>
 */

import * as fs from "fs";
import {
  runBalanceJob,
  type BalanceJob,
} from "../src/simulation/balance/balanceJobs";

function arg(flag: string): string {
  const i = process.argv.indexOf(flag);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  if (!value) throw new Error(`missing ${flag}`);
  return value;
}

function main(): void {
  const jobs = JSON.parse(fs.readFileSync(arg("--in"), "utf8")) as BalanceJob[];
  const results = jobs.map((job) => runBalanceJob(job));
  fs.writeFileSync(arg("--out"), JSON.stringify(results));
}

main();
