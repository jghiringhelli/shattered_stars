import Phaser from "phaser";

/** Configuration for a textured panel container. */
export interface TexturedPanelOptions {
  /** Horizontal center in local parent coordinates. */
  readonly x: number;
  /** Vertical center in local parent coordinates. */
  readonly y: number;
  /** Panel width in pixels. */
  readonly width: number;
  /** Panel height in pixels. */
  readonly height: number;
  /** Texture key registered via BootScene.loadUiTextures(). Falls back to Graphics if absent. */
  readonly textureKey: string;
  /** Alpha applied to the background image layer (default 1.0). */
  readonly alpha?: number;
  /** Fill color for the Graphics fallback (default 0x112233). */
  readonly fallbackColor?: number;
  /** Fill alpha for the Graphics fallback (default 0.6). */
  readonly fallbackAlpha?: number;
  /** Corner radius for the Graphics fallback rounded rect (default 8). */
  readonly fallbackRadius?: number;
}

/**
 * Create a scene Container whose background is a texture image (if loaded)
 * or a filled rounded-rect Graphics object (fallback).
 *
 * The container is added to the scene and positioned at (x, y).
 * Children are drawn centered at local (0, 0). When parented to another
 * container via parentContainer.add(result), Phaser re-parents without
 * duplication — the same pattern used by ShipStatCard.
 *
 * @param scene - The owning Phaser scene.
 * @param options - Panel layout and texture configuration.
 * @returns Container whose first child is the background layer.
 */
export function createTexturedPanel(
  scene: Phaser.Scene,
  options: TexturedPanelOptions,
): Phaser.GameObjects.Container {
  const {
    x,
    y,
    width,
    height,
    textureKey,
    alpha = 1,
    fallbackColor = 0x112233,
    fallbackAlpha = 0.6,
    fallbackRadius = 8,
  } = options;

  const container = scene.add.container(x, y);

  if (scene.textures.exists(textureKey)) {
    const img = scene.add
      .image(0, 0, textureKey)
      .setDisplaySize(width, height)
      .setAlpha(alpha);
    container.add(img);
  } else {
    const g = scene.add.graphics();
    g.fillStyle(fallbackColor, fallbackAlpha);
    g.fillRoundedRect(-width / 2, -height / 2, width, height, fallbackRadius);
    container.add(g);
  }

  return container;
}

/**
 * Add a full-screen `tex_menu_bg` background image at depth −1 if the texture has been
 * generated. Silently skips when the texture is absent (SD not yet run).
 *
 * @param scene - The Phaser scene to add the image into.
 */
export function addSceneBackground(scene: Phaser.Scene): void {
  if (!scene.textures.exists("tex_menu_bg")) return;
  const { width, height } = scene.scale;
  scene.add
    .image(width / 2, height / 2, "tex_menu_bg")
    .setDisplaySize(width, height)
    .setDepth(-1);
}

/**
 * Add a painted space background (nebula/planet/galaxy — see
 * scripts/generate_backgrounds.py) at depth −2, behind everything else
 * including `tex_menu_bg`. Silently skips when the texture is absent, so
 * scenes always fall back cleanly to their procedural starfield.
 *
 * @param scene     - The Phaser scene to add the image into.
 * @param textureId - One of the ids in BootScene's loadBackgroundTextures
 *                    (without the `bg_` prefix), e.g. "nebula_purple".
 */
export function addPaintedSpaceBackground(
  scene: Phaser.Scene,
  textureId: string,
): void {
  const key = `bg_${textureId}`;
  if (!scene.textures.exists(key)) return;
  const { width, height } = scene.scale;
  scene.add
    .image(scene.scale.width / 2, scene.scale.height / 2, key)
    .setDisplaySize(width, height)
    .setDepth(-2);
}

/**
 * Add a `tex_title_frame` horizontal banner image if the texture has been generated.
 * Silently skips when the texture is absent.
 *
 * @param scene      - The Phaser scene to add the image into.
 * @param centerY    - Vertical center of the banner in scene coordinates.
 * @param bannerHeight - Display height of the banner in pixels.
 */
export function addSceneTitleFrame(
  scene: Phaser.Scene,
  centerY: number,
  bannerHeight: number,
): void {
  if (!scene.textures.exists("tex_title_frame")) return;
  scene.add
    .image(scene.scale.width / 2, centerY, "tex_title_frame")
    .setDisplaySize(scene.scale.width, bannerHeight);
}
