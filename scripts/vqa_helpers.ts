/**
 * Shared helpers for gameplay_vision_qa.ts
 *
 * Vision calls go through the Anthropic Messages REST API (no SDK dependency).
 * Set ANTHROPIC_API_KEY in your environment before running.
 *
 * Vision model: claude-opus-4-6 — same as qa_ship_art.py for consistency.
 */

import type { Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ShipSnapshot {
  id: string;
  owner: "player" | "ai";
  x: number;
  y: number;
  angle: number;
  hull: number;
  maxHull: number;
  faction: string;
  definitionId?: string;
}

export interface Check {
  name: string;
  passed: boolean;
  detail: string;
  screenshotPath?: string;
  visionAnalysis?: string;
}

export interface ScenarioResult {
  scenario: string;
  passed: boolean;
  checks: Check[];
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Playwright helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Wait until a named Phaser scene is active (running). */
export async function waitForScene(
  page: Page,
  key: string,
  ms = 20_000,
): Promise<void> {
  await page.waitForFunction(
    (k: string) => {
      const g = (window as any).game;
      return g?.isBooted === true && g.scene.isActive(k);
    },
    key,
    { timeout: ms },
  );
}

/**
 * Stop all running scenes then start the target.
 * Mirrors the approach in visual_qa.ts.
 */
export async function jumpToScene(page: Page, key: string): Promise<void> {
  await page.evaluate((k: string) => {
    const g = (window as any).game;
    const active: any[] = g?.scene.getScenes(true) ?? [];
    for (const s of active) g.scene.stop(s.sys.settings.key);
    setTimeout(() => g.scene.start(k), 120);
  }, key);
}

/** Take a screenshot and return its absolute path. */
export async function takeShot(
  page: Page,
  outDir: string,
  name: string,
): Promise<string> {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸  ${file}`);
  return file;
}

/** Dispatch keydown then keyup (50 ms apart) to the game window. */
export async function pressKey(
  page: Page,
  key: string,
  code: string,
  keyCode: number,
): Promise<void> {
  const dispatch = (type: string): Promise<void> =>
    page.evaluate(
      ([t, k, c, kc]: [string, string, string, number]) => {
        window.dispatchEvent(
          new KeyboardEvent(t, { key: k, code: c, keyCode: kc, bubbles: true }),
        );
      },
      [type, key, code, keyCode] as [string, string, string, number],
    );
  await dispatch("keydown");
  await page.waitForTimeout(50);
  await dispatch("keyup");
}

// ─────────────────────────────────────────────────────────────────────────────
// Claude Vision
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a single screenshot to Claude Vision with a structured prompt.
 * Returns the raw text response.
 *
 * The prompt should ask for a JSON reply so callers can parse flags/issues.
 */
export async function callVision(
  screenshotPath: string,
  prompt: string,
): Promise<string> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) return "⚠ ANTHROPIC_API_KEY not set — vision check skipped";

  const imageData = fs.readFileSync(screenshotPath).toString("base64");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: imageData,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return `Vision API error ${response.status}: ${body.slice(0, 200)}`;
  }

  const json = (await response.json()) as { content: Array<{ text: string }> };
  return json.content[0]?.text ?? "(empty response)";
}
