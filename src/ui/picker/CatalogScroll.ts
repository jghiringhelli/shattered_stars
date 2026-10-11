/**
 * CatalogScroll — scroll controller for ShipCatalogPanel's ship grid.
 * Provides mousewheel handling, geometry-mask clipping, and a scrollbar.
 * Pattern mirrors SquadListPanel scroll implementation.
 */

import Phaser from "phaser";
import { HOLO_PALETTE, HOLO_RADIUS } from "../theme/HoloTheme";

/** Scrollbar geometry and wheel tuning. */
const SCROLLBAR = {
  /** Distance of the track's left edge from the clip's right edge. */
  inset: 6,
  width: 4,
  minThumb: 20,
  /** Pixels scrolled per wheel delta unit. */
  wheelFactor: 0.8,
} as const;

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

  /**
   * Wire mousewheel on the scene to scroll the grid container.
   *
   * @param scene - Owning scene.
   * @param getContainer - Returns the grid container currently on screen.
   * @param onScroll - Called after every scroll step.
   */
  setupWheel(
    scene: Phaser.Scene,
    getContainer: () => Phaser.GameObjects.Container,
    onScroll: () => void = () => undefined,
  ): void {
    scene.input.on(
      "wheel",
      (_ptr: unknown, _gos: unknown, _dx: number, dy: number) => {
        const maxScroll = Math.max(0, this.contentH - this.cfg.clipH);
        this.scrollY = Math.max(
          0,
          Math.min(maxScroll, this.scrollY + dy * SCROLLBAR.wheelFactor),
        );
        getContainer().setY(this.cfg.clipY - this.scrollY);
        this.drawScrollbar(scene);
        onScroll();
      },
    );
  }

  /** Current scroll offset in pixels (0 = top). */
  get offset(): number {
    return this.scrollY;
  }

  /**
   * True when a content-space vertical span is at least partly visible.
   *
   * @param top - Span top in content coordinates.
   * @param height - Span height.
   * @returns Whether any of it lies inside the clip.
   */
  isSpanVisible(top: number, height: number): boolean {
    const viewTop = this.scrollY;
    return top + height > viewTop && top < viewTop + this.cfg.clipH;
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
    const trackX = this.cfg.clipX + this.cfg.clipW - SCROLLBAR.inset;
    const thumbH = Math.max(
      SCROLLBAR.minThumb,
      this.cfg.clipH * (this.cfg.clipH / this.contentH),
    );
    const thumbY =
      this.cfg.clipY + (this.scrollY / maxScroll) * (this.cfg.clipH - thumbH);
    this.scrollbarGfx = scene.add.graphics();
    this.scrollbarGfx.fillStyle(HOLO_PALETTE.track, HOLO_PALETTE.trackAlpha);
    this.scrollbarGfx.fillRoundedRect(
      trackX,
      this.cfg.clipY,
      SCROLLBAR.width,
      this.cfg.clipH,
      HOLO_RADIUS.sm / 2,
    );
    this.scrollbarGfx.fillStyle(HOLO_PALETTE.border, 1);
    this.scrollbarGfx.fillRoundedRect(
      trackX,
      thumbY,
      SCROLLBAR.width,
      thumbH,
      HOLO_RADIUS.sm / 2,
    );
  }

  /** Update the total content height (drives scroll bounds). */
  setContentHeight(h: number): void {
    this.contentH = h;
    const maxScroll = Math.max(0, this.contentH - this.cfg.clipH);
    this.scrollY = Math.min(this.scrollY, maxScroll);
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
