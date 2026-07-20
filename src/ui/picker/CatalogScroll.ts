/**
 * CatalogScroll — scroll controller for ShipCatalogPanel's ship grid.
 * Provides mousewheel handling, geometry-mask clipping, and a scrollbar.
 * Pattern mirrors SquadListPanel scroll implementation.
 */

import Phaser from "phaser";

/**
 * Configuration for the scrollable clip area.
 *
 * @param clipX  - Left edge of the visible region.
 * @param clipY  - Top edge of the visible region.
 * @param clipW  - Width of the visible region.
 * @param clipH  - Height of the visible region.
 */
export interface CatalogScrollConfig {
  readonly clipX: number;
  readonly clipY: number;
  readonly clipW: number;
  readonly clipH: number;
}

export class CatalogScroll {
  private scrollY = 0;
  private contentH = 0;
  private clipMask: Phaser.GameObjects.Graphics | null = null;
  private scrollbarGfx: Phaser.GameObjects.Graphics | null = null;

  constructor(private readonly cfg: CatalogScrollConfig) {}

  /** Wire mousewheel on the scene to scroll the grid container. */
  setupWheel(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
  ): void {
    scene.input.on(
      "wheel",
      (_ptr: unknown, _gos: unknown, _dx: number, dy: number) => {
        const maxScroll = Math.max(0, this.contentH - this.cfg.clipH);
        this.scrollY = Math.max(
          0,
          Math.min(maxScroll, this.scrollY + dy * 0.8),
        );
        container.setY(this.cfg.clipY - this.scrollY);
        this.drawScrollbar(scene);
      },
    );
  }

  /** Apply a geometry mask that clips the grid to the visible region. */
  applyMask(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
  ): void {
    this.clipMask?.destroy();
    this.clipMask = scene.make.graphics({
      add: false,
    } as Phaser.Types.GameObjects.Graphics.Options);
    this.clipMask.fillStyle(0xffffff);
    this.clipMask.fillRect(
      this.cfg.clipX,
      this.cfg.clipY,
      this.cfg.clipW,
      this.cfg.clipH,
    );
    container.setMask(
      new Phaser.Display.Masks.GeometryMask(scene, this.clipMask),
    );
  }

  /** Draw a thin scrollbar track + thumb on the right edge. */
  drawScrollbar(scene: Phaser.Scene): void {
    this.scrollbarGfx?.destroy();
    const maxScroll = Math.max(0, this.contentH - this.cfg.clipH);
    if (maxScroll <= 0) return;
    const trackX = this.cfg.clipX + this.cfg.clipW - 6;
    const thumbH = Math.max(
      20,
      this.cfg.clipH * (this.cfg.clipH / this.contentH),
    );
    const thumbY =
      this.cfg.clipY + (this.scrollY / maxScroll) * (this.cfg.clipH - thumbH);
    this.scrollbarGfx = scene.add.graphics();
    this.scrollbarGfx.fillStyle(0x0e1622, 1);
    this.scrollbarGfx.fillRoundedRect(
      trackX,
      this.cfg.clipY,
      4,
      this.cfg.clipH,
      2,
    );
    this.scrollbarGfx.fillStyle(0x445577, 1);
    this.scrollbarGfx.fillRoundedRect(trackX, thumbY, 4, thumbH, 2);
  }

  /** Update the total content height (drives scroll bounds). */
  setContentHeight(h: number): void {
    this.contentH = h;
  }

  /** Reset scroll position to the top. */
  reset(): void {
    this.scrollY = 0;
  }

  /** Clean up all graphics. */
  destroy(): void {
    this.clipMask?.destroy();
    this.scrollbarGfx?.destroy();
    this.clipMask = null;
    this.scrollbarGfx = null;
  }
}
