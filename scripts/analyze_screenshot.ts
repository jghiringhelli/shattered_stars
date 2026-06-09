/**
 * analyze_screenshot.ts — Claude vision analysis for arcade game screenshots.
 *
 * Usage:
 *   npx tsx scripts/analyze_screenshot.ts [path-to-screenshot.png] [question]
 *
 * Defaults:
 *   - image:    tests/e2e/fixtures/arcade_snapshot.png
 *   - question: standard HUD/FX checklist
 *
 * Requirements:
 *   - ANTHROPIC_API_KEY environment variable set.
 *   - @anthropic-ai/sdk installed: npm install --save-dev @anthropic-ai/sdk
 *
 * The script reads the PNG, encodes it as base64, and asks the Claude model
 * a structured question about what it sees in the arcade battle scene.
 */

import * as fs from "fs";
import * as path from "path";

// ─────────────────────────────────────────────
// Types matching the SDK API surface
// ─────────────────────────────────────────────

interface ImageContent {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

interface TextContent {
  type: "text";
  text: string;
}

type ContentBlock = ImageContent | TextContent;

interface AnthropicMessage {
  model: string;
  max_tokens: number;
  messages: Array<{
    role: "user";
    content: ContentBlock[];
  }>;
}

// ─────────────────────────────────────────────
// Default analysis prompts
// ─────────────────────────────────────────────

const DEFAULT_PROMPT = `
You are reviewing a screenshot from "Shattered Stars", a Phaser 3 arcade space combat game.

Please analyse this screenshot and answer each question concisely:

1. **Ships visible**: Are there any ship sprites on screen? Describe their approximate positions (top/middle/bottom, left/right). Do they look like triangles or other distinct shapes?

2. **HUD elements**: Is there a speed indicator (number 1-5) visible in the top-left area? Is there a stress bar (horizontal coloured bar) visible near the top-left?

3. **Stress bar colour**: If a stress bar is visible, what colour is it? (green = low stress, yellow = medium, red = high stress)

4. **Projectiles**: Are any laser bolts or missile trails visible?

5. **FX effects**: Are there any thrust trails, explosion rings, or other particle effects visible?

6. **Maneuver indicator**: Is there text showing STRAIGHT, BANK, or TURN anywhere on the HUD?

7. **Overall rendering quality**: Does the scene appear to have rendered correctly, or is it mostly black / broken?

Respond in structured JSON with keys: ships_visible, hud_present, stress_bar_color, projectiles_present, fx_present, maneuver_text, render_ok, notes.
`.trim();

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function analyzeScreenshot(
  imagePath: string,
  prompt: string,
): Promise<void> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    console.error("ERROR: ANTHROPIC_API_KEY environment variable not set.");
    process.exit(1);
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`ERROR: Image file not found: ${imagePath}`);
    process.exit(1);
  }

  const imageData = fs.readFileSync(imagePath);
  const base64Data = imageData.toString("base64");
  const ext = path.extname(imagePath).toLowerCase();
  const mediaType =
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";

  console.log(
    `Analysing: ${imagePath} (${(imageData.length / 1024).toFixed(1)} KB)`,
  );
  console.log("Sending to Claude vision...\n");

  const requestBody: AnthropicMessage = {
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64Data },
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`API error ${response.status}: ${errorText}`);
    process.exit(1);
  }

  const result = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };

  const textContent = result.content.find((c) => c.type === "text");
  if (!textContent?.text) {
    console.error("No text content in response");
    process.exit(1);
  }

  console.log("=== Claude Vision Analysis ===\n");
  console.log(textContent.text);

  if (result.usage) {
    console.log(
      `\n[tokens: ${result.usage.input_tokens} in / ${result.usage.output_tokens} out]`,
    );
  }

  // Try to parse as JSON for structured output
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      console.log("\n=== Structured Result ===");
      console.log(JSON.stringify(parsed, null, 2));

      if (parsed["render_ok"] === false || parsed["render_ok"] === "false") {
        console.error(
          "\nFAIL: render_ok is false — scene did not render correctly.",
        );
        process.exit(2);
      }
    } catch {
      // JSON parse failed — raw text is still printed above
    }
  }
}

const imagePath = process.argv[2] ?? "tests/e2e/fixtures/arcade_snapshot.png";
const prompt = process.argv[3] ?? DEFAULT_PROMPT;

analyzeScreenshot(imagePath, prompt).catch((err: unknown) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
