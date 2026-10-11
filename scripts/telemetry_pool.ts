/**
 * telemetry_pool — runs battery jobs (cell × seeds × optional tempo) in
 * parallel child processes (telemetry_worker.ts) and collects their match
 * samples. Temporary files live in the OS temp dir and are removed.
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { MatchSample } from "../src/simulation/telemetryBattery";
import type { TempoVariant } from "../src/simulation/TempoVariant";

/** One job for a worker. */
export interface BatteryJob {
  readonly key: string;
  readonly cellId: string;
  readonly seeds: number;
  readonly tempo?: TempoVariant;
}

/** Workers kept free for the rest of the machine. */
const SPARE_CORES = 2;
const WORKER = path.resolve("scripts", "telemetry_worker.ts");

function runJob(job: BatteryJob, dir: string): Promise<MatchSample[]> {
  const out = path.join(dir, `${job.key.replace(/[^a-z0-9]+/gi, "_")}.json`);
  const args = [
    "--import",
    "tsx",
    WORKER,
    "--cell",
    job.cellId,
    "--seeds",
    String(job.seeds),
    "--out",
    out,
  ];
  if (job.tempo) args.push("--tempo", JSON.stringify(job.tempo));
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: ["ignore", "ignore", "inherit"],
    });
    child.on("exit", (code) => {
      if (code !== 0)
        return reject(new Error(`worker ${job.key} exited ${code}`));
      resolve(JSON.parse(fs.readFileSync(out, "utf8")) as MatchSample[]);
    });
  });
}

/**
 * @param jobs - Jobs to run.
 * @param onDone - Progress callback.
 * @returns Samples per job key.
 */
export async function runJobs(
  jobs: readonly BatteryJob[],
  onDone: (key: string, done: number, total: number) => void = () => undefined,
): Promise<Map<string, MatchSample[]>> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ss-telemetry-"));
  const results = new Map<string, MatchSample[]>();
  const queue = [...jobs];
  const workers = Math.max(
    1,
    Math.min(jobs.length, os.cpus().length - SPARE_CORES),
  );
  try {
    await Promise.all(
      Array.from({ length: workers }, async () => {
        for (let job = queue.shift(); job; job = queue.shift()) {
          results.set(job.key, await runJob(job, dir));
          onDone(job.key, results.size, jobs.length);
        }
      }),
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return results;
}
