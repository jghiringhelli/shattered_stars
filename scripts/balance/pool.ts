/**
 * pool — runs balance jobs in parallel child processes (balance_worker.ts),
 * one job per process, and collects their results by key. Temporary files
 * live in the OS temp dir and are removed.
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type {
  BalanceJob,
  BalanceJobResult,
} from "../../src/simulation/balance/balanceJobs";

/** A job with its result key. */
export interface KeyedJob {
  readonly key: string;
  readonly job: BalanceJob;
}

/** Workers kept free for the rest of the machine. */
const SPARE_CORES = 2;
const WORKER = path.resolve("scripts", "balance_worker.ts");

function runOne(
  keyed: KeyedJob,
  dir: string,
  index: number,
): Promise<BalanceJobResult> {
  const input = path.join(dir, `job_${index}.json`);
  const output = path.join(dir, `out_${index}.json`);
  fs.writeFileSync(input, JSON.stringify([keyed.job]));
  const args = ["--import", "tsx", WORKER, "--in", input, "--out", output];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: ["ignore", "ignore", "inherit"],
    });
    child.on("exit", (code) => {
      if (code !== 0)
        return reject(new Error(`job ${keyed.key} exited ${code}`));
      const [result] = JSON.parse(
        fs.readFileSync(output, "utf8"),
      ) as BalanceJobResult[];
      resolve(result!);
    });
  });
}

/**
 * @param jobs - Keyed jobs (heaviest first runs best).
 * @param workers - Parallel processes (default: cores − 2).
 * @param onDone - Progress callback.
 * @returns Results by key.
 */
export async function runPool(
  jobs: readonly KeyedJob[],
  workers: number = Math.max(1, os.cpus().length - SPARE_CORES),
  onDone: (key: string, done: number, total: number) => void = () => undefined,
): Promise<Map<string, BalanceJobResult>> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ss-balance-"));
  const results = new Map<string, BalanceJobResult>();
  const queue = jobs.map((job, index) => ({ job, index }));
  try {
    await Promise.all(
      Array.from({ length: Math.min(workers, jobs.length) }, async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          results.set(next.job.key, await runOne(next.job, dir, next.index));
          onDone(next.job.key, results.size, jobs.length);
        }
      }),
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return results;
}
