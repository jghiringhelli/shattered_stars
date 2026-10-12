/**
 * Asset Generation Script
 * Run with: npx tsx scripts/generate-assets.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  checkSDAvailable,
  getAvailableModels,
  getAvailableLoras,
  generateFactionAnchors,
  FACTION_STYLES,
} from "../src/services/ImageGenerator";
import type { FactionId } from "../src/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, "..", "public", "assets", "generated");

async function ensureDirectory(dir: string): Promise<void> {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function saveBase64Image(
  base64: string,
  filepath: string,
): Promise<void> {
  // Handle both raw base64 and data URL format
  let buffer: Buffer;

  if (base64.startsWith("data:")) {
    // Data URL format - extract the base64 part
    const matches = base64.match(/^data:image\/\w+;base64,(.+)$/);
    if (matches) {
      buffer = Buffer.from(matches[1]!, "base64");
    } else {
      // SVG data URL
      const svgMatches = base64.match(/^data:image\/svg\+xml;base64,(.+)$/);
      if (svgMatches) {
        buffer = Buffer.from(svgMatches[1]!, "base64");
        filepath = filepath.replace(/\.\w+$/, ".svg");
      } else {
        throw new Error("Invalid data URL format");
      }
    }
  } else {
    // Raw base64
    buffer = Buffer.from(base64, "base64");
  }

  fs.writeFileSync(filepath, buffer);
  console.log(`  Saved: ${filepath}`);
}

async function main(): Promise<void> {
  console.log("=".repeat(50));
  console.log("Shattered Stars Asset Generator");
  console.log("=".repeat(50));
  console.log();

  // Check SD availability
  console.log("Checking Stable Diffusion API...");
  const available = await checkSDAvailable();

  if (available) {
    console.log("✓ SD API is available");

    const models = await getAvailableModels();
    console.log(`  Models: ${models.join(", ") || "none found"}`);

    const loras = await getAvailableLoras();
    console.log(`  LoRAs: ${loras.join(", ") || "none found"}`);
  } else {
    console.log("✗ SD API not available - will generate placeholders");
  }

  console.log();

  // Ensure output directory
  await ensureDirectory(OUTPUT_DIR);

  // Generate for each faction
  const factions: FactionId[] = [
    "terran_hegemony",
    "free_confederation",
    "synthetic_collective",
    "void_corsairs",
    "ascendant_empire",
  ];

  for (const faction of factions) {
    console.log(`Generating assets for ${faction}...`);
    const factionDir = path.join(OUTPUT_DIR, faction);
    await ensureDirectory(factionDir);

    const results = await generateFactionAnchors(faction);

    for (const [type, result] of results) {
      if (result.success && result.imageBase64) {
        const ext = result.imageBase64.startsWith("data:image/svg")
          ? "svg"
          : "png";
        await saveBase64Image(
          result.imageBase64,
          path.join(factionDir, `${type}.${ext}`),
        );
      } else {
        console.log(`  ✗ Failed to generate ${type}: ${result.error}`);
      }
    }

    console.log();
  }

  console.log("=".repeat(50));
  console.log("Asset generation complete!");
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log("=".repeat(50));
}

main().catch(console.error);
