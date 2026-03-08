/**
 * Parallax Background
 *
 * Multi-layer scrolling starfield with:
 * - Multiple star layers at different depths
 * - Nebula clouds
 * - Occasional asteroids or debris
 */

import Phaser from 'phaser';

interface StarLayer {
  graphics: Phaser.GameObjects.Graphics;
  speed: number; // Parallax speed multiplier (0-1)
  stars: { x: number; y: number; size: number; brightness: number }[];
}

interface Nebula {
  x: number;
  y: number;
  radius: number;
  color: number;
  alpha: number;
}

export class ParallaxBackground {
  private scene: Phaser.Scene;
  private layers: StarLayer[] = [];
  private nebulaGraphics!: Phaser.GameObjects.Graphics;
  private nebulae: Nebula[] = [];
  private width: number;
  private height: number;
  private lastCameraX: number = 0;
  private lastCameraY: number = 0;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.scene = scene;
    this.width = width;
    this.height = height;

    this.createNebulae();
    this.createStarLayers();
  }

  private createNebulae(): void {
    this.nebulaGraphics = this.scene.add.graphics();
    this.nebulaGraphics.setDepth(-10);
    this.nebulaGraphics.setScrollFactor(0.1); // Very slow parallax

    // Generate random nebulae
    const nebulaColors = [
      0x4422aa, // Purple
      0x2244aa, // Blue
      0x224466, // Teal
      0x442266, // Deep purple
      0x662244, // Magenta
      0x226644, // Green
    ];

    for (let i = 0; i < 8; i++) {
      this.nebulae.push({
        x: Math.random() * this.width * 2,
        y: Math.random() * this.height * 2,
        radius: 150 + Math.random() * 300,
        color: Phaser.Math.RND.pick(nebulaColors),
        alpha: 0.05 + Math.random() * 0.1,
      });
    }

    this.renderNebulae();
  }

  private renderNebulae(): void {
    this.nebulaGraphics.clear();

    for (const nebula of this.nebulae) {
      // Multiple layers for soft edges
      for (let layer = 3; layer >= 0; layer--) {
        const layerRadius = nebula.radius * (1 - layer * 0.2);
        const layerAlpha = nebula.alpha * (1 - layer * 0.2);

        this.nebulaGraphics.fillStyle(nebula.color, layerAlpha);
        this.nebulaGraphics.fillCircle(nebula.x, nebula.y, layerRadius);
      }
    }
  }

  private createStarLayers(): void {
    // Create 3 layers of stars with different parallax speeds
    const layerConfigs = [
      { speed: 0.05, count: 100, minSize: 0.3, maxSize: 0.8, minBright: 0.1, maxBright: 0.3 }, // Far stars
      { speed: 0.15, count: 80, minSize: 0.5, maxSize: 1.2, minBright: 0.2, maxBright: 0.5 },  // Mid stars
      { speed: 0.3, count: 50, minSize: 0.8, maxSize: 2, minBright: 0.4, maxBright: 0.8 },     // Near stars
    ];

    for (let i = 0; i < layerConfigs.length; i++) {
      const config = layerConfigs[i]!;
      const graphics = this.scene.add.graphics();
      graphics.setDepth(-5 + i);
      graphics.setScrollFactor(config.speed);

      const stars: StarLayer['stars'] = [];

      for (let j = 0; j < config.count; j++) {
        stars.push({
          x: Math.random() * this.width * 3 - this.width,
          y: Math.random() * this.height * 3 - this.height,
          size: config.minSize + Math.random() * (config.maxSize - config.minSize),
          brightness: config.minBright + Math.random() * (config.maxBright - config.minBright),
        });
      }

      this.layers.push({
        graphics,
        speed: config.speed,
        stars,
      });

      this.renderLayer(this.layers[i]!);
    }
  }

  private renderLayer(layer: StarLayer): void {
    layer.graphics.clear();

    for (const star of layer.stars) {
      // Twinkling effect - vary brightness slightly
      const twinkle = 0.9 + Math.random() * 0.2;
      const alpha = star.brightness * twinkle;

      // Star glow
      layer.graphics.fillStyle(0xffffff, alpha * 0.3);
      layer.graphics.fillCircle(star.x, star.y, star.size * 2);

      // Star core
      layer.graphics.fillStyle(0xffffff, alpha);
      layer.graphics.fillCircle(star.x, star.y, star.size);

      // Bright stars get color tint
      if (star.brightness > 0.6) {
        const colors = [0xaaccff, 0xffccaa, 0xffffaa, 0xaaffaa];
        const color = Phaser.Math.RND.pick(colors);
        layer.graphics.fillStyle(color, alpha * 0.3);
        layer.graphics.fillCircle(star.x, star.y, star.size * 1.5);
      }
    }
  }

  /**
   * Update parallax based on camera movement
   * Call this in the scene's update method
   */
  update(): void {
    const camera = this.scene.cameras.main;
    const deltaX = camera.scrollX - this.lastCameraX;
    const deltaY = camera.scrollY - this.lastCameraY;

    // Only re-render if camera moved significantly
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      // Subtle twinkling effect by re-rendering occasionally
      if (Math.random() < 0.1) {
        for (const layer of this.layers) {
          this.renderLayer(layer);
        }
      }
    }

    this.lastCameraX = camera.scrollX;
    this.lastCameraY = camera.scrollY;
  }

  /**
   * Create a shooting star effect
   */
  createShootingStar(): void {
    const startX = Math.random() * this.width;
    const startY = Math.random() * this.height * 0.5;
    const angle = Math.PI / 4 + Math.random() * Math.PI / 4;
    const length = 100 + Math.random() * 200;

    const star = this.scene.add.graphics();
    star.setDepth(-3);
    star.setScrollFactor(0.5);

    // Draw shooting star trail
    for (let i = 0; i < 20; i++) {
      const progress = i / 20;
      const x = startX + Math.cos(angle) * length * progress;
      const y = startY + Math.sin(angle) * length * progress;
      const alpha = 1 - progress;
      const size = (1 - progress) * 3;

      star.fillStyle(0xffffff, alpha);
      star.fillCircle(x, y, size);
    }

    // Animate fade out
    this.scene.tweens.add({
      targets: star,
      alpha: 0,
      duration: 1000,
      onComplete: () => star.destroy(),
    });
  }

  /**
   * Start periodic shooting stars
   */
  startShootingStars(intervalMin: number = 5000, intervalMax: number = 15000): void {
    const schedule = () => {
      this.createShootingStar();
      const nextInterval = Phaser.Math.Between(intervalMin, intervalMax);
      this.scene.time.delayedCall(nextInterval, schedule);
    };

    // Start after initial delay
    this.scene.time.delayedCall(Phaser.Math.Between(2000, 5000), schedule);
  }

  /**
   * Create a distant planet or moon
   */
  addDistantPlanet(x: number, y: number, radius: number, color: number): void {
    const planet = this.scene.add.graphics();
    planet.setDepth(-8);
    planet.setScrollFactor(0.05);

    // Planet body
    planet.fillStyle(color, 0.3);
    planet.fillCircle(x, y, radius);

    // Atmosphere glow
    planet.lineStyle(radius * 0.1, color, 0.2);
    planet.strokeCircle(x, y, radius * 1.1);

    // Highlight
    planet.fillStyle(0xffffff, 0.1);
    planet.fillCircle(x - radius * 0.3, y - radius * 0.3, radius * 0.4);
  }

  /**
   * Add space station silhouette
   */
  addSpaceStation(x: number, y: number, scale: number = 1): void {
    const station = this.scene.add.graphics();
    station.setDepth(-7);
    station.setScrollFactor(0.08);
    station.setPosition(x, y);
    station.setScale(scale);

    // Draw simple station silhouette
    station.fillStyle(0x222233, 0.8);

    // Main body
    station.fillRect(-30, -10, 60, 20);

    // Solar panels
    station.fillRect(-80, -3, 45, 6);
    station.fillRect(35, -3, 45, 6);

    // Antenna
    station.fillRect(-5, -25, 10, 15);
    station.fillCircle(0, -28, 5);

    // Docking bay
    station.fillRect(-15, 10, 30, 15);

    // Lights
    station.fillStyle(0xff0000, 0.8);
    station.fillCircle(-25, 0, 2);
    station.fillCircle(25, 0, 2);

    station.fillStyle(0x00ff00, 0.8);
    station.fillCircle(0, -28, 2);
  }

  /**
   * Clean up
   */
  destroy(): void {
    for (const layer of this.layers) {
      layer.graphics.destroy();
    }
    this.nebulaGraphics.destroy();
    this.layers = [];
    this.nebulae = [];
  }
}
