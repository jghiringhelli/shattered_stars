/**
 * Event-driven vision analysis — cost-optimized: screenshots are sent to
 * Claude Vision only at flagged checkpoints (mode transition, kill, stress
 * spike, drill end, one random sample per minute), never per-frame, and each
 * call returns structured JSON so results aggregate without extra LLM calls.
 * One additional text-only call synthesizes the final per-mode verdict.
 */

import * as fs from "fs";
import { callVision } from "../vqa_helpers";
import type { VisionFinding } from "./types";

const RUBRIC_PROMPT = `You are QA-testing a space-combat arcade game (Shattered Stars, X-Wing-miniatures-inspired). Look at this screenshot and reply with ONLY minified JSON, no prose, no markdown fences, matching exactly this shape:
{"bugs":["..."],"visualIssues":["..."],"usabilityFriction":["..."],"incompleteFeatures":["..."],"funScore":1,"funReasoning":"..."}
Rules: bugs = things that look broken/wrong (overlap, NaN text, missing sprite, stuck UI). visualIssues = things that look unpolished but not broken (misaligned HUD, low contrast, clipping). usabilityFriction = things a player would find confusing or annoying (unclear feedback, no indicator, dead space). incompleteFeatures = placeholder/stub-looking elements. funScore = 1-5 rating of whether THIS MOMENT looks kinetic/engaging vs static/boring, judged from motion cues, HUD info density, and visual clarity of what's happening. funReasoning = one sentence citing concrete evidence in the image. Empty arrays are fine if nothing applies.`;

function stripFences(text: string): string {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? m[0] : text;
}

/** Sends one screenshot to Claude Vision with the structured QA rubric. */
export async function analyzeScreenshot(
  screenshotPath: string,
  context: string,
): Promise<VisionFinding | null> {
  if (!process.env["ANTHROPIC_API_KEY"]) return null;
  const raw = await callVision(screenshotPath, RUBRIC_PROMPT);
  try {
    const parsed = JSON.parse(stripFences(raw)) as Omit<
      VisionFinding,
      "context" | "screenshot"
    >;
    return { context, screenshot: screenshotPath, ...parsed };
  } catch {
    console.warn(
      `  ⚠ vision reply not parseable for ${context}: ${raw.slice(0, 120)}`,
    );
    return null;
  }
}

/** Text-only Claude call (no image) for the one-per-mode closing synthesis. */
async function callTextSynthesis(prompt: string): Promise<string> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) return "(skipped — ANTHROPIC_API_KEY not set)";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) return `Vision API error ${response.status}`;
  const json = (await response.json()) as { content: Array<{ text: string }> };
  return json.content[0]?.text ?? "(empty response)";
}

/**
 * ONE closing call per mode: feeds the aggregated stats + sampled findings and
 * asks for the final bugs/friction/incomplete/fun verdict, grounded in evidence.
 */
export async function synthesizeModeVerdict(
  mode: string,
  statsSummary: string,
  findings: readonly VisionFinding[],
  frictionEvents: readonly string[],
  consoleErrors: readonly string[],
): Promise<string> {
  const findingsDigest = findings
    .map(
      (f) =>
        `[${f.context}] fun=${f.funScore} bugs=${f.bugs.join("; ") || "none"} friction=${f.usabilityFriction.join("; ") || "none"}`,
    )
    .join("\n");
  const prompt = `Mode: ${mode}\n\nTelemetry summary:\n${statsSummary}\n\nVision checkpoint findings:\n${findingsDigest || "(no vision samples)"}\n\nFriction events:\n${frictionEvents.join("\n") || "none"}\n\nConsole errors:\n${consoleErrors.slice(0, 10).join("\n") || "none"}\n\nWrite a concise verdict (5-8 sentences) for this mode covering: concrete bugs found, visual polish issues, usability friction, incomplete features, and — most importantly — whether the movement-driven ship-role design felt meaningful and whether play was fun, citing the evidence above.`;
  return callTextSynthesis(prompt);
}

export function fileExists(p: string): boolean {
  return fs.existsSync(p);
}
