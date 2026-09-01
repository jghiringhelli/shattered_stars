/**
 * Mouse-click helpers for driving in-game UI (choice panels, buttons) that
 * only respond to pointer input, not keyboard — e.g. Survival's power draft.
 */

import type { Page } from "playwright";

interface CanvasTransform {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

/** Conversion factors between Phaser game coords and real viewport pixels. */
async function getCanvasTransform(page: Page): Promise<CanvasTransform> {
  const box = (await page.locator("canvas").boundingBox())!;
  const { gw, gh } = await page.evaluate(() => {
    const g = (window as any).game;
    return {
      gw: g.scale.gameSize.width as number,
      gh: g.scale.gameSize.height as number,
    };
  });
  return {
    offsetX: box.x,
    offsetY: box.y,
    scaleX: box.width / gw,
    scaleY: box.height / gh,
  };
}

/** Clicks at a position expressed in Phaser game-world coordinates (not viewport pixels). */
export async function clickGameCoord(
  page: Page,
  gameX: number,
  gameY: number,
): Promise<void> {
  const { offsetX, offsetY, scaleX, scaleY } = await getCanvasTransform(page);
  await page.mouse.click(offsetX + gameX * scaleX, offsetY + gameY * scaleY);
}

/**
 * Fires "pointerdown" directly on a choice-panel card's hit rectangle,
 * bypassing pixel-based hit-testing. Verified necessary: real synthetic
 * clicks (page.mouse.click / locator.click / manual move+down+up) do not
 * register as Phaser "pointerdown" for objects nested two levels inside a
 * Container in this headless Canvas-renderer setup, even with correct
 * coordinates and a confirmed listener on the target object.
 */
export async function emitCardPointerdown(
  page: Page,
  sceneKey: string,
  panelProperty: string,
  cardIndex: number,
): Promise<boolean> {
  return page.evaluate(
    ({ key, prop, index }: { key: string; prop: string; index: number }) => {
      const scene = (window as any).game?.scene.getScene(key) as any;
      const panelContainer = scene?.[prop]?.container;
      const cardGroups =
        panelContainer?.list?.filter((o: any) => o.type === "Container") ?? [];
      const rect = cardGroups[index]?.list?.find(
        (o: any) => o.type === "Rectangle",
      );
      if (!rect) return false;
      rect.emit("pointerdown");
      return true;
    },
    { key: sceneKey, prop: panelProperty, index: cardIndex },
  );
}
