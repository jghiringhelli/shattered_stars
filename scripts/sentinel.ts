/**
 * Sentinel — the one door.
 *
 * forgecraft-mcp is not always available in-session, so this local script fills the
 * sentinel's navigational role: it reads the project's declared identity, the active
 * enforcement gates, and the working-tree state, then prints ONE next action.
 *
 * It is a lightweight drift detector, not a build tool. Run: `npm run sentinel`.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = process.cwd();

/** Read a file if it exists, else empty string. */
function read(rel: string): string {
  const p = resolve(ROOT, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

/** First capture group of the first matching line, or a fallback. */
function firstMatch(text: string, re: RegExp, fallback: string): string {
  const m = text.match(re);
  return m?.[1] !== undefined ? m[1].trim() : fallback;
}

function identity(): void {
  const fc = read("forgecraft.yaml");
  const name = firstMatch(fc, /projectName:\s*(.+)/, "unknown");
  const tier = firstMatch(fc, /tier:\s*(.+)/, "unknown");
  const inline = fc.match(/tags:\s*\[(.+)\]/);
  const block = [...fc.matchAll(/^\s*-\s*([A-Z_]+)\s*$/gm)].map((m) => m[1]);
  const tags = inline
    ? inline[1]!.trim()
    : block.length
      ? block.join(", ")
      : "—";
  const claude = read("CLAUDE.md");
  const repo = firstMatch(claude, /\*\*Repo\*\*:\s*(.+)/, "—");
  console.log("=== SENTINEL ================================================");
  console.log(`  Project : ${name}  [${tags}]  tier=${tier}`);
  console.log(`  Repo    : ${repo}`);
  console.log(
    `  Domain  : Phaser 3 tactical space combat (X-Wing TMG mechanics)`,
  );
}

function gates(): void {
  const hooksDir = resolve(ROOT, ".claude/hooks");
  const hooks = existsSync(hooksDir)
    ? readdirSync(hooksDir).filter(
        (f) => f.startsWith("pre-commit-") && f.endsWith(".sh"),
      )
    : [];
  console.log("");
  console.log(
    `  Enforced gates (${hooks.length}): ${hooks.map((h) => h.replace(/^pre-commit-|\.sh$/g, "")).join(", ") || "none"}`,
  );
  console.log(
    "  Verify: npm run typecheck | npm test -- --run | npm run analyze:telemetry",
  );
}

interface TreeState {
  readonly branch: string;
  readonly dirty: string[];
}

function tree(): TreeState {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: ROOT })
      .toString()
      .trim();
    const dirty = execSync("git status --porcelain", { cwd: ROOT })
      .toString()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    return { branch, dirty };
  } catch {
    return { branch: "(no git)", dirty: [] };
  }
}

function nextAction(state: TreeState): void {
  console.log("");
  console.log(
    `  Branch  : ${state.branch}   working tree: ${state.dirty.length} change(s)`,
  );
  console.log("--- NEXT ACTION --------------------------------------------");
  if (state.dirty.length > 0) {
    const src = state.dirty.some((l) => /\bsrc\//.test(l));
    console.log("  Uncommitted work present. Before committing:");
    console.log("    1. npm run typecheck");
    console.log("    2. npm test -- --run");
    if (src)
      console.log(
        "    3. npx vitest run --coverage   (coverage hook gates src/ changes)",
      );
    console.log(
      "    -> commit with a conventional message; hooks enforce the rest.",
    );
    if (state.dirty.length > 15) {
      console.log(
        `  ⚠ ${state.dirty.length} dirty files — do NOT squash into one commit.`,
      );
      console.log(
        "    Split into ATOMIC commits, one logical change per commit",
      );
      console.log(
        "    (per CLAUDE.md's Commit Protocol). Group by feature/concern,",
      );
      console.log(
        "    commit each group separately, don't wait until end-of-session.",
      );
    }
  } else {
    console.log("  Working tree clean. Pick the next bound prompt:");
    console.log(
      "    -> DEVELOPMENT_PROMPTS.md  (Load / Scope / Acceptance / Commit)",
    );
    console.log("    -> routing index: docs/spec-map.md");
  }
  console.log("============================================================");
}

function main(): void {
  identity();
  gates();
  nextAction(tree());
}

main();
