/**
 * Wrapper around the `claude` CLI (Claude Code) in non-interactive print mode.
 * Preferred over the raw Anthropic API: reuses whatever auth the user already
 * has configured (subscription login or API key) — no ANTHROPIC_API_KEY
 * management needed. Every function returns null on any failure (CLI not
 * installed, not logged in, timeout, bad JSON) so callers can fall back to
 * the direct API path in vqa_helpers.ts.
 */

import { spawnSync } from "node:child_process";
import * as path from "node:path";

interface ClaudeCliEnvelope {
  readonly is_error: boolean;
  readonly result: string;
}

const CLI_TIMEOUT_MS = 90_000;

/**
 * shell:true is required on Windows to resolve the claude.cmd shim. Node
 * refuses to escape argv entries when shell:true is combined with an args
 * array (DEP0190), so the command is built as a single fixed literal string
 * (both branches are hardcoded, never interpolated) and the prompt is passed
 * via stdin instead of argv — dynamic/untrusted text never touches the shell.
 */
function runClaudeCli(
  prompt: string,
  allowedTools: "Read" | null,
): string | null {
  const command = allowedTools
    ? "claude -p --output-format json --allowedTools Read"
    : "claude -p --output-format json";
  const proc = spawnSync(command, {
    input: prompt,
    encoding: "utf-8",
    timeout: CLI_TIMEOUT_MS,
    shell: true,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (proc.error || proc.status !== 0 || !proc.stdout) return null;
  try {
    const envelope = JSON.parse(proc.stdout) as ClaudeCliEnvelope;
    return envelope.is_error ? null : envelope.result;
  } catch {
    return null;
  }
}

/** Text-only prompt via the CLI (no image). Null if the CLI is unavailable/not logged in. */
export function callClaudeCliText(prompt: string): string | null {
  return runClaudeCli(prompt, null);
}

/** Asks the CLI to view a local screenshot (via its built-in Read tool) and answer about it. */
export function callClaudeCliVision(
  prompt: string,
  screenshotPath: string,
): string | null {
  const absPath = path.resolve(screenshotPath);
  const fullPrompt = `Use the Read tool to view the image at "${absPath}", then ${prompt}`;
  return runClaudeCli(fullPrompt, "Read");
}
