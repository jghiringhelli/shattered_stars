/**
 * Boot scene - handles asset loading and initialization
 */

import Phaser from "phaser";
import { FACTION_COLORS, SHIP_SIZES } from "../config";
import { SHIP_DEFINITIONS } from "../data/ShipDefinitions";
import { loadPortraitImages } from "./boot/BootPortraitLoader";
import { PlayerProfileManager } from "../systems/PlayerProfile";
import {
  initTutorialOverlay,
  hideTutorialOverlay,
} from "../ui/TutorialOverlay";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    // Show the first-launch quick-controls overlay while assets load, so it
    // never blocks or overlaps the main menu — it's dismissed automatically
    // once loading completes (or by the player, whichever comes first).
    initTutorialOverlay();

    // Show loading progress
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(440, 320, 400, 50);

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const loadingText = this.make.text({
      x: width / 2,
      y: height / 2 - 50,
      text: "Loading...",
      style: {
        font: "24px monospace",
        color: "#ffffff",
      },
    });
    loadingText.setOrigin(0.5, 0.5);

    this.load.on("progress", (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x00bfff, 1);
      progressBar.fillRect(450, 330, 380 * value, 30);
    });

    this.load.on("complete", () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      hideTutorialOverlay();
    });

    // Generate placeholder ship textures programmatically
    this.generatePlaceholderTextures();

    // Load pilot portrait images for campaign debrief
    loadPortraitImages(this.load);

    // Load ship thumbnail images for campaign debrief stats
    this.loadCampaignShipThumbnails();

    // Load cinematic art for encyclopedia (768x512 wide landscape per ship)
    this.loadEncyclopediaArt();

    // Load small in-battle ship sprites for every ship (used by all real-time
    // battle scenes; loading them all at boot means no scene needs its own
    // per-roster preload() — the texture is already there by the time any
    // scene starts).
    this.loadBattleSprites();

    // Load SD-generated StarCraft-inspired UI textures (fail-silent if not generated)
    this.loadUiTextures();

    // Load SD-generated painted space backgrounds (fail-silent if not generated)
    this.loadBackgroundTextures();

    // Fallback: generate portrait_command programmatically if PNG not found
    this.registerPortraitFallback();
  }

  create(): void {
    this.applyProfileFromUrl();
    // Transition to main menu
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

  /**
   * Generate a programmatic star/badge placeholder for portrait_command if the PNG is absent.
   * Registered before loader runs so it fires exactly once on load complete.
   */
  private registerPortraitFallback(): void {
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (this.textures.exists("portrait_command")) return;
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x0a1a3a, 1);
      g.fillRect(0, 0, 128, 128);
      g.fillStyle(0x4488cc, 1);
      const cx = 64,
        cy = 56,
        r = 28;
      for (let i = 0; i < 5; i++) {
        const a = (i * 72 - 90) * (Math.PI / 180);
        const ia = (i * 72 + 36 - 90) * (Math.PI / 180);
        g.fillTriangle(
          cx + Math.cos(a) * r,
          cy + Math.sin(a) * r,
          cx + Math.cos(ia) * (r * 0.4),
          cy + Math.sin(ia) * (r * 0.4),
          cx,
          cy + r * 0.15,
        );
      }
      g.generateTexture("portrait_command", 128, 128);
      g.destroy();
    });
  }

  /**
   * Load SD-generated StarCraft-inspired UI textures from public/assets/ui/.
   * Missing files fail silently — Phaser skips 404s without error.
   * Generate these with: python scripts/generate_ui_textures.py
   */
  private loadUiTextures(): void {
    const base = "assets/ui";
    this.load.image("tex_menu_bg", `${base}/ui_menu_bg.png`);
    this.load.image("tex_title_frame", `${base}/ui_title_frame.png`);
  }

  /**
   * Load SD-generated painted space backgrounds (nebulae/planets/galaxy/starfield)
   * from public/assets/backgrounds/. Missing files fail silently — Phaser skips
   * 404s without error, so scenes can fall back to the procedural starfield.
   * Generate these with: python scripts/generate_backgrounds.py
   */
  private loadBackgroundTextures(): void {
    const base = "assets/backgrounds";
    const ids = [
      "nebula_blue",
      "nebula_purple",
      "nebula_teal",
      "nebula_crimson",
      "planet_rocky",
      "planet_gas_giant",
      "planet_ice",
      "starfield_deep",
      "galaxy_spiral",
    ];
    for (const id of ids) {
      this.load.image(`bg_${id}`, `${base}/${id}.png`);
    }
  }

  /**
   * Load all ship sprites for every ship definition.
   * Key: def.spriteKey (e.g. "ship_terran_raptor")
   * Path: assets/ships/<faction>/<id>.png
   * Missing files fail silently — Phaser skips 404s.
   */
  private loadCampaignShipThumbnails(): void {
    Object.values(SHIP_DEFINITIONS).forEach(({ id, faction, spriteKey }) => {
      this.load.image(spriteKey, `assets/ships/${faction}/${id}.png`);
    });
  }

  /**
   * Load wide cinematic encyclopedia art for all ships (768×512 PNGs).
   * Missing files are expected (art is generated separately via generate_ship_art.py).
   * Phaser logs a console.warn for every 404 before the loaderror event fires, so we
   * suppress those warnings for ship_art_* keys for the duration of this load phase.
   */
  private loadEncyclopediaArt(): void {
    const originalWarn = console.warn.bind(console);
    const silenceArtWarnings = (...args: unknown[]): void => {
      const first = args[0];
      if (typeof first === "string" && first.includes("Failed to process file"))
        return;
      originalWarn(...args);
    };
    console.warn = silenceArtWarnings;
    this.load.once("complete", () => {
      console.warn = originalWarn;
    });

    Object.values(SHIP_DEFINITIONS).forEach(({ id, faction }) => {
      this.load.image(
        `ship_art_${id}`,
        `assets/ships/encyclopedia/${faction}/${id}_art.png`,
      );
    });
  }

  /**
   * Load the small in-battle sprite PNG for every ship (missing files are
   * expected and silently fall back to the faction+size placeholder texture
   * at render time — see src/rendering/ShipVisual.ts).
   */
  private loadBattleSprites(): void {
    Object.values(SHIP_DEFINITIONS).forEach(({ id, faction }) => {
      const key = `ship_${id}`;
      if (this.textures.exists(key)) return;
      this.load.image(key, `assets/ships/${faction}/${id}.png`);
    });
  }
}
