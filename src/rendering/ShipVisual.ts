/**
 * ShipVisual — shared "textured art with vector fallback" ship body renderer.
 * Every real-time battle scene draws ships the same way: use the ship's own
 * PNG (with a faction-colored ring) when its texture is loaded, otherwise a
 * faction-colored placeholder texture, otherwise a plain vector hull. This
 * used to be duplicated (and, for most scenes, simply skipped) per scene —
 * centralizing it means every mode shows real ship art, not a bare triangle.
 */

import type Phaser from "phaser";
import { FACTION_COLORS } from "../config";
import type { FactionId, ShipSize } from "../config";
import { shipSpriteAssetById } from "../assets/assetManifest";
import { swapWhenLoaded } from "../assets/textureLoading";

export interface ShipVisualOptions {
  /** Ship definition id — resolves the `ship_<id>` individual art texture. */
  readonly definitionId: string;
  readonly faction: FactionId;
  /** The ship definition's actual size class — resolves the `ship_<faction>_<size>` placeholder texture. */
  readonly fallbackSizeName: ShipSize;
  /** On-screen radius in pixels the visual should occupy. */
  readonly size: number;
  readonly isPlayer: boolean;
}

export interface ShipVisual {
  /** Vector-fallback hull graphics. Real geometry when no texture is loaded, an empty placeholder otherwise (kept so callers have a stable `hull` reference to tint/flash). */
  readonly hull: Phaser.GameObjects.Graphics;
  /** The ship art image, or null when falling back to the vector hull. */
  readonly image: Phaser.GameObjects.Image | null;
  /** Faction-colored identification ring drawn around textured ships (null for vector fallback, which strokes its own outline instead). */
  readonly ring: Phaser.GameObjects.Graphics | null;
}

/** Adds the ship's body (art image + ring, or vector fallback) into `container` and returns the created parts. */
export function addShipVisual(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  opts: ShipVisualOptions,
): ShipVisual {
  const { definitionId, faction, size, isPlayer } = opts;
  const color = FACTION_COLORS[faction] ?? 0xffffff;

  const spriteKey = `ship_${definitionId}`;
  const fallbackKey = `ship_${faction}_${opts.fallbackSizeName}`;
  const textureKey = scene.textures.exists(spriteKey)
    ? spriteKey
    : scene.textures.exists(fallbackKey)
      ? fallbackKey
      : null;

  if (textureKey) {
    const img = scene.add.image(0, 0, textureKey);
    img.setDisplaySize(size * 1.8, size * 1.8);
    // Ships spawned after preload (waves, reinforcements) show the faction
    // placeholder for a moment and switch to their art once it downloads.
    const art = shipSpriteAssetById(definitionId);
    if (art && textureKey !== spriteKey)
      swapWhenLoaded(scene, img, art, "stretch");
    // Composited normally: the art carries a real alpha channel, so the ship
    // occludes what it flies over instead of being added to it.
    container.add(img);

    const ring = scene.add.graphics();
    const ringAlpha = isPlayer ? 1.0 : 0.75;
    const ringThick = isPlayer ? 3 : 2;
    ring.lineStyle(ringThick + 2, 0x000000, 0.6);
    ring.strokeCircle(0, 0, size * 1.05);
    ring.lineStyle(ringThick, color, ringAlpha);
    ring.strokeCircle(0, 0, size * 1.05);
    if (isPlayer) {
      ring.lineStyle(1, 0xffffff, 0.35);
      ring.strokeCircle(0, 0, size * 1.25);
    }
    container.add(ring);

    const hull = scene.add.graphics(); // invisible placeholder for callers expecting a hull ref
    return { hull, image: img, ring };
  }

  const hull = scene.add.graphics();
  hull.fillStyle(color, 1);
  hull.beginPath();
  hull.moveTo(0, -size / 2);
  hull.lineTo(-size / 3, size / 2);
  hull.lineTo(0, size / 3);
  hull.lineTo(size / 3, size / 2);
  hull.closePath();
  hull.fillPath();
  hull.lineStyle(2, 0xffffff, 0.85);
  hull.strokePath();

  // Faction-colored ring on fallback shapes too, matching textured ships.
  hull.lineStyle(3, color, 0.9);
  hull.strokeCircle(0, 0, size * 0.9);
  if (isPlayer) {
    hull.lineStyle(1, 0xffffff, 0.5);
    hull.strokeCircle(0, 0, size * 1.1);
  }
  container.add(hull);
  return { hull, image: null, ring: null };
}
