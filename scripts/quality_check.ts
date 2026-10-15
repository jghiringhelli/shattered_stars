/**
 * Quality ratchet CLI (limits: 300 lines/file, 50 lines/function, 5 params).
 *   npm run quality                   list every current offender (exit 0)
 *   npm run quality:check             fail on NEW/WORSENED violations in the whole tree (CI)
 *   tsx scripts/quality_check.ts --staged   same, for the staged (index) content only (pre-commit)
 *   npm run quality:baseline          rewrite scripts/quality-baseline.json (only after paying debt down)
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  buildBaseline,
  DEFAULT_LIMITS,
  describeViolation,
  findRegressions,
  scanViolations,
  type Baseline,
  type Violation,
} from "./lib/qualityScan";
import { readSourceTree } from "./lib/sourceTree";

const BASELINE_PATH = "scripts/quality-baseline.json";
const SCANNED = /^(src|server\/src)\/.*\.tsx?$/;
const mode = process.argv[2] ?? "--list";

function git(args: readonly string[]): string {
  return execFileSync("git", [...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function scanTree(): Violation[] {
  return readSourceTree(process.cwd(), ["src", "server/src"]).flatMap((file) =>
    scanViolations(file.path, file.text, DEFAULT_LIMITS),
  );
}

function scanStaged(): Violation[] {
  const staged = git(["diff", "--cached", "--name-only", "--diff-filter=ACM"])
    .split("\n")
    .map((line) => line.trim())
    .filter((path) => SCANNED.test(path) && !path.endsWith(".d.ts"));
  return staged.flatMap((path) => scanViolations(path, git(["show", `:${path}`]), DEFAULT_LIMITS));
}

function loadBaseline(): Baseline {
  if (!existsSync(BASELINE_PATH)) {
    console.error(`Missing ${BASELINE_PATH}; run "npm run quality:baseline".`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Baseline;
}

function listOffenders(): void {
  const violations = scanTree();
  const byKind = (kind: Violation["kind"]) => violations.filter((v) => v.kind === kind);
  for (const kind of ["file-lines", "function-lines", "params"] as const) {
    const rows = byKind(kind).sort((a, b) => b.value - a.value);
    console.log(`\n${kind}: ${rows.length}`);
    for (const row of rows) console.log(`  ${describeViolation(row)}`);
  }
}

function reportRegressions(violations: readonly Violation[]): never | void {
  const regressions = findRegressions(violations, loadBaseline());
  if (regressions.length === 0) {
    console.log(`Quality ratchet OK (${violations.length} tolerated, 0 new or worsened).`);
    return;
  }
  console.error("Quality ratchet: new or worsened violations (CLAUDE.md: 300 lines/file, 50 lines/function, 5 params):");
  for (const regression of regressions) console.error(`  ${describeViolation(regression)}`);
  console.error("Split the file/function or reduce the parameters; existing debt may shrink but not grow.");
  process.exit(1);
}

if (mode === "--update-baseline") {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(buildBaseline(scanTree()), null, 2)}\n`);
  console.log(`Wrote ${BASELINE_PATH}`);
} else if (mode === "--staged") {
  reportRegressions(scanStaged());
} else if (mode === "--check") {
  reportRegressions(scanTree());
} else {
  listOffenders();
}
