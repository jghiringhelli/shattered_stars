/**
 * ZoomStableLayer — a screen-space container whose children render at plain
 * screen-pixel coordinates at any camera zoom (the same zoom cancellation
 * BattleHud applies to its widgets). For HUD panels a battle scene adds next
 * to BattleHud. Not for interactive controls: Phaser mis-hit-tests
 * scrollFactor(0) objects under zoom, so buttons stay on zoom-1 screens.
 */

import type Phaser from "phaser";
import { createScreenContainer } from "../../ui/hud/holoPrimitives";
import { hudRootTransform, type CameraLike } from "../../ui/hud/hudMath";

/** Screen-space, zoom-cancelling HUD layer. */
export class ZoomStableLayer {
  /** Root container (scrollFactor 0). */
  readonly container: Phaser.GameObjects.Container;
  private lastZoom = Number.NaN;
  private lastWidth = Number.NaN;
  private lastHeight = Number.NaN;

  /**
   * @param scene - Owning scene.
   * @param depth - Display depth of the layer.
   */
  constructor(scene: Phaser.Scene, depth: number) {
    this.container = createScreenContainer(scene).setDepth(depth);
  }

  /**
   * Add screen-space children (pinned to the screen with the layer).
   *
   * @param children - Objects positioned in screen px.
   * @returns This layer.
   */
  add(...children: Phaser.GameObjects.GameObject[]): this {
    this.container.add(children);
    this.container.setScrollFactor(0, 0, true);
    return this;
  }

  /**
   * Re-apply the zoom cancellation when the camera zoom or size changed.
   *
   * @param camera - The scene's main camera.
   */
  sync(camera: Pick<CameraLike, "zoom" | "width" | "height">): void {
    if (
      camera.zoom === this.lastZoom &&
      camera.width === this.lastWidth &&
      camera.height === this.lastHeight
    )
      return;
    this.lastZoom = camera.zoom;
    this.lastWidth = camera.width;
    this.lastHeight = camera.height;
    const t = hudRootTransform(camera.zoom, camera.width, camera.height);
    this.container.setPosition(t.x, t.y).setScale(t.scale);
  }

  /**
   * @param visible - Whether the layer shows.
   */
  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  /** Destroy the layer and its children. */
  destroy(): void {
    this.container.destroy();
  }
}
