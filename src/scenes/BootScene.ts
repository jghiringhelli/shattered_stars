/**
 * Boot scene — generates placeholder textures, loads only what the main menu
 * draws (BOOT_ASSETS, ~2 MB), then hands over to the menu. Ship sprites,
 * portraits, encyclopedia art and other backdrops load per scene through the
 * preload gate installed here (see src/assets/), so the first menu appears
 * after a few MB instead of the whole art library.
 */

import Phaser from "phaser";
import { FACTION_COLORS, SHIP_SIZES } from "../config";
import { PlayerProfileManager } from "../systems/PlayerProfile";
import { createBootLoadingView } from "../ui/menu/BootLoadingView";
import { BOOT_ASSETS } from "../assets/assetManifest";
import { queueAssets } from "../assets/textureLoading";
import { installScenePreloadGates } from "../assets/scenePreloadGate";
import { installIdempotentImageCache } from "../assets/idempotentImageCache";
import { browserStore } from "../systems/keyValueStore";
import { installStorageWarning } from "../ui/StorageWarningToast";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    const loadingView = createBootLoadingView(this);
    this.load.on("progress", (value: number) => {
      loadingView.setProgress(value);
    });
    this.load.once("complete", () => {
      loadingView.destroy();
    });

    // Faction+size placeholder ships (shown until a ship's art has loaded).
    this.generatePlaceholderTextures();
    queueAssets(this, BOOT_ASSETS);
  }

  create(): void {
    installIdempotentImageCache(Phaser.Loader.FileTypes.ImageFile);
    installScenePreloadGates(this.game.scene.getScenes(false));
    installStorageWarning(browserStore());
    this.applyProfileFromUrl();
    this.scene.start("MainMenuScene");
  }
  /**
   * Select the active player profile from a `?profile=<id>` URL param, if present.
   * Enables quick testing (e.g. ?profile=dev-unlock-all, ?profile=test-veteran).
   */
  private applyProfileFromUrl(): void {
    try {
      const id = new URLSearchParams(window.location.search).get("profile");
      if (!id) return;
      if (PlayerProfileManager.list().some((p) => p.id === id)) {
        PlayerProfileManager.setActive(id);
      }
    } catch {
      /* no-op: URL/profile access is best-effort */
    }
  }

  /**
   * Generate simple geometric placeholder textures for ships
   * These will be replaced with actual sprites later
   */
  private generatePlaceholderTextures(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });

    // Generate a ship texture for each faction and size
    for (const [factionId, color] of Object.entries(FACTION_COLORS)) {
      for (const [sizeName, sizePixels] of Object.entries(SHIP_SIZES)) {
        const key = `ship_${factionId}_${sizeName}`;
        this.generateShipTexture(graphics, key, color, sizePixels);
      }
    }

    // Generate projectile textures
    this.generateProjectileTextures(graphics);

    // Generate UI textures
    this.generateUITextures(graphics);

    graphics.destroy();
  }

  private generateShipTexture(
    graphics: Phaser.GameObjects.Graphics,
    key: string,
    color: number,
    size: number,
  ): void {
    graphics.clear();

    // Draw a simple triangle pointing up (ship shape)
    graphics.fillStyle(color, 1);
    graphics.beginPath();
    graphics.moveTo(size / 2, 0); // Top point
    graphics.lineTo(size, size); // Bottom right
    graphics.lineTo(size / 2, size * 0.75); // Back indent
    graphics.lineTo(0, size); // Bottom left
    graphics.closePath();
    graphics.fillPath();

    // Add a lighter accent for the cockpit/front
    graphics.fillStyle(0xffffff, 0.3);
    graphics.fillTriangle(
      size / 2,
      0,
      size / 2 - size / 6,
      size / 3,
      size / 2 + size / 6,
      size / 3,
    );

    // Add engine glow at back
    graphics.fillStyle(0xffffff, 0.5);
    graphics.fillCircle(size / 2, size * 0.85, size / 8);

    graphics.generateTexture(key, size, size);
  }

  private generateProjectileTextures(
    graphics: Phaser.GameObjects.Graphics,
  ): void {
    // Laser bolt
    graphics.clear();
    graphics.fillStyle(0x00bfff, 1);
    graphics.fillRect(0, 0, 4, 12);
    graphics.fillStyle(0xffffff, 0.8);
    graphics.fillRect(1, 1, 2, 10);
    graphics.generateTexture("projectile_laser", 4, 12);

    // Missile
    graphics.clear();
    graphics.fillStyle(0xff6b35, 1);
    graphics.fillTriangle(4, 0, 0, 8, 8, 8);
    graphics.fillRect(2, 8, 4, 8);
    graphics.fillStyle(0xffff00, 0.8);
    graphics.fillCircle(4, 16, 3);
    graphics.generateTexture("projectile_missile", 8, 20);
  }

  private generateUITextures(graphics: Phaser.GameObjects.Graphics): void {
    // Health bar background
    graphics.clear();
    graphics.fillStyle(0x333333, 1);
    graphics.fillRect(0, 0, 40, 6);
    graphics.generateTexture("healthbar_bg", 40, 6);

    // Health bar fill (hull)
    graphics.clear();
    graphics.fillStyle(0x00ff00, 1);
    graphics.fillRect(0, 0, 40, 6);
    graphics.generateTexture("healthbar_hull", 40, 6);

    // Health bar fill (shields)
    graphics.clear();
    graphics.fillStyle(0x00bfff, 1);
    graphics.fillRect(0, 0, 40, 6);
    graphics.generateTexture("healthbar_shields", 40, 6);

    // Target indicator
    graphics.clear();
    graphics.lineStyle(2, 0xff0000, 1);
    graphics.strokeCircle(16, 16, 14);
    graphics.strokeCircle(16, 16, 8);
    graphics.generateTexture("target_indicator", 32, 32);

    // Selection indicator
    graphics.clear();
    graphics.lineStyle(2, 0x00ff00, 1);
    graphics.strokeCircle(20, 20, 18);
    graphics.generateTexture("selection_indicator", 40, 40);
  }
}
