/**
 * Image Generator Service
 * Interfaces with Stable Diffusion API for procedural asset generation
 */

import type { FactionId } from '../config';

// ============================================
// Types
// ============================================

export interface GenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfgScale?: number;
  seed?: number | undefined;
  sampler?: string;
  loras?: Array<{ name: string; weight: number }>;
}

export interface GenerationResult {
  success: boolean;
  imageBase64?: string;
  seed?: number;
  error?: string;
}

export interface FactionStyle {
  basePrompt: string;
  negativePrompt: string;
  loras: Array<{ name: string; weight: number }>;
  colorPalette: string[];
}

// ============================================
// Faction Style Definitions
// ============================================

export const FACTION_STYLES: Record<FactionId, FactionStyle> = {
  terran_hegemony: {
    basePrompt: 'military spacecraft, naval warship design, angular hull, heavy armor plating, industrial aesthetic, gun batteries, blue engine glow, disciplined formation',
    negativePrompt: 'organic, alien, fantasy, medieval, colorful, cute, cartoon',
    loras: [
      { name: 'industrial_scifi', weight: 0.6 },
      { name: 'concept_art', weight: 0.4 },
    ],
    colorPalette: ['#1a3a5c', '#2d5a8c', '#4a7ab0', '#8ab4d6', '#c4d6e8'],
  },

  free_confederation: {
    basePrompt: 'rebel spacecraft, modified freighter, asymmetrical design, salvaged parts, guerrilla fighter, exposed machinery, green and orange accents, agile craft',
    negativePrompt: 'uniform, pristine, luxury, symmetrical, military parade',
    loras: [
      { name: 'scifi_style', weight: 0.5 },
      { name: 'industrial_scifi', weight: 0.4 },
    ],
    colorPalette: ['#2d4a1a', '#5c7a3a', '#8ca85a', '#b0c87a', '#d4e8a0'],
  },

  synthetic_collective: {
    basePrompt: 'alien biomechanical spacecraft, organic technology, hive mind aesthetic, geometric patterns, pulsing energy cores, purple and cyan bioluminescence, insectoid design',
    negativePrompt: 'human, industrial, rusty, primitive, warm colors',
    loras: [
      { name: 'alien_species', weight: 0.7 },
      { name: 'synthetic_genesis', weight: 0.5 },
    ],
    colorPalette: ['#1a1a3d', '#3d2a5c', '#5c3a7a', '#8a4a9c', '#b85ac0'],
  },

  void_corsairs: {
    basePrompt: 'pirate spacecraft, raider vessel, aggressive design, skull motifs, red and black, weapon bristling, fast attack craft, intimidating silhouette',
    negativePrompt: 'friendly, cute, professional, clean, orderly',
    loras: [
      { name: 'scifi_style', weight: 0.6 },
      { name: 'concept_art', weight: 0.4 },
    ],
    colorPalette: ['#3d1a1a', '#5c2a2a', '#8c3a3a', '#b04a4a', '#d45a5a'],
  },

  ascendant_empire: {
    basePrompt: 'elegant spacecraft, golden filigree, ornate design, ancient advanced technology, crystalline elements, white and gold, majestic presence, mystic energy',
    negativePrompt: 'crude, industrial, dirty, aggressive, dark',
    loras: [
      { name: 'concept_art', weight: 0.6 },
      { name: 'scifi_artist', weight: 0.5 },
    ],
    colorPalette: ['#3d3a1a', '#7a6a2a', '#b0983a', '#d4c05a', '#f0e080'],
  },
};

// ============================================
// API Configuration
// ============================================

const SD_API_URL = 'http://localhost:7860';

// ============================================
// API Functions
// ============================================

/**
 * Check if SD API is available
 */
export async function checkSDAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${SD_API_URL}/sdapi/v1/sd-models`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get available models
 */
export async function getAvailableModels(): Promise<string[]> {
  try {
    const response = await fetch(`${SD_API_URL}/sdapi/v1/sd-models`);
    if (!response.ok) return [];
    const models = await response.json();
    return models.map((m: { model_name: string }) => m.model_name);
  } catch {
    return [];
  }
}

/**
 * Get available LoRAs
 */
export async function getAvailableLoras(): Promise<string[]> {
  try {
    const response = await fetch(`${SD_API_URL}/sdapi/v1/loras`);
    if (!response.ok) return [];
    const loras = await response.json();
    return loras.map((l: { name: string }) => l.name);
  } catch {
    return [];
  }
}

/**
 * Generate an image using SD API
 */
export async function generateImage(request: GenerationRequest): Promise<GenerationResult> {
  try {
    // Build LoRA prompt string
    let loraPrompt = '';
    if (request.loras && request.loras.length > 0) {
      loraPrompt = request.loras
        .map((l) => `<lora:${l.name}:${l.weight}>`)
        .join(' ');
    }

    const payload = {
      prompt: `${request.prompt} ${loraPrompt}`.trim(),
      negative_prompt: request.negativePrompt ?? '',
      width: request.width ?? 512,
      height: request.height ?? 512,
      steps: request.steps ?? 20,
      cfg_scale: request.cfgScale ?? 7,
      seed: request.seed ?? -1,
      sampler_name: request.sampler ?? 'DPM++ 2M SDE',
      batch_size: 1,
      n_iter: 1,
    };

    const response = await fetch(`${SD_API_URL}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { success: false, error: `API error: ${response.status}` };
    }

    const result = await response.json();

    return {
      success: true,
      imageBase64: result.images[0],
      seed: result.info ? JSON.parse(result.info).seed : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate a ship sprite for a faction
 */
export async function generateShipSprite(
  faction: FactionId,
  shipType: 'fighter' | 'interceptor' | 'bomber' | 'capital',
  seed?: number
): Promise<GenerationResult> {
  const style = FACTION_STYLES[faction];

  const typePrompts: Record<string, string> = {
    fighter: 'single pilot fighter craft, small agile ship, cockpit visible',
    interceptor: 'sleek interceptor, ultra-fast design, minimal profile',
    bomber: 'heavy bomber, torpedo bays, armored hull, slow powerful',
    capital: 'capital ship, large warship, command bridge, massive scale',
  };

  const prompt = `${typePrompts[shipType]}, ${style.basePrompt}, top-down view, game sprite, transparent background, 2D art, clean lines, high detail`;

  return generateImage({
    prompt,
    negativePrompt: `${style.negativePrompt}, blurry, low quality, text, watermark, 3D render, photograph`,
    width: 256,
    height: 256,
    steps: 25,
    cfgScale: 7.5,
    seed,
    loras: style.loras,
  });
}

/**
 * Generate a background element
 */
export async function generateBackground(
  type: 'nebula' | 'starfield' | 'asteroid' | 'station',
  seed?: number
): Promise<GenerationResult> {
  const typePrompts: Record<string, string> = {
    nebula: 'space nebula, cosmic gas cloud, vibrant colors, stars background',
    starfield: 'deep space starfield, distant galaxies, cosmic dust',
    asteroid: 'asteroid field, rocky debris, space rocks, dark void',
    station: 'space station, orbital platform, industrial structure, docking bays',
  };

  return generateImage({
    prompt: `${typePrompts[type]}, space environment, sci-fi background, digital art`,
    negativePrompt: 'text, watermark, frame, border, signature',
    width: 512,
    height: 512,
    steps: 20,
    cfgScale: 7,
    seed,
    loras: [
      { name: 'space_nebula', weight: 0.6 },
      { name: 'scifi_environments', weight: 0.4 },
    ],
  });
}

// ============================================
// Fallback Placeholder Generation
// ============================================

/**
 * Generate a placeholder image when SD is unavailable
 */
export function generatePlaceholder(
  width: number,
  height: number,
  color: string,
  label: string
): string {
  // Create a simple SVG placeholder
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="${color}"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
            fill="white" font-family="monospace" font-size="14">
        ${label}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Generate faction style anchor images for visual consistency
 */
export async function generateFactionAnchors(
  faction: FactionId
): Promise<Map<string, GenerationResult>> {
  const results = new Map<string, GenerationResult>();

  const available = await checkSDAvailable();
  if (!available) {
    console.warn('SD API not available, using placeholders');
    const style = FACTION_STYLES[faction];
    const placeholderColor = style.colorPalette[2] ?? '#888888';
    const placeholder = generatePlaceholder(256, 256, placeholderColor, faction);

    results.set('fighter', { success: true, imageBase64: placeholder });
    results.set('interceptor', { success: true, imageBase64: placeholder });
    results.set('bomber', { success: true, imageBase64: placeholder });
    results.set('capital', { success: true, imageBase64: placeholder });

    return results;
  }

  // Generate with consistent seed for each type
  const baseSeed = Math.floor(Math.random() * 1000000);

  for (const type of ['fighter', 'interceptor', 'bomber', 'capital'] as const) {
    const result = await generateShipSprite(faction, type, baseSeed);
    results.set(type, result);

    // Small delay between generations to not overload
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}
