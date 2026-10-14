/**
 * Shared e2e helpers for the pick screens: read the scene's texts, move the
 * real mouse onto an object by its text, read the tooltip on show, press keys.
 */

import { expect, type Page } from "@playwright/test";

/** Every Text string in a scene, containers included. */
export async function sceneTexts(page: Page, key: string): Promise<string[]> {
  return page.evaluate((k) => {
    const scene = (window as any).game.scene.getScene(k);
    const collect = (obj: any): string[] => [
      ...(typeof obj.text === "string" ? [obj.text] : []),
      ...((obj.list as any[] | undefined) ?? []).flatMap(collect),
    ];
    return (scene.children.list as any[]).flatMap(collect);
  }, key);
}

/** Visible Text objects of a scene with their font size (px) — density audits. */
export async function visibleTexts(
  page: Page,
  key: string,
): Promise<Array<{ text: string; size: number }>> {
  return page.evaluate((k) => {
    const scene = (window as any).game.scene.getScene(k);
    const out: Array<{ text: string; size: number }> = [];
    const walk = (obj: any, parentVisible: boolean): void => {
      const visible = parentVisible && obj.visible !== false && obj.alpha !== 0;
      if (typeof obj.text === "string" && obj.text.trim() && visible) {
        const size = parseFloat(String(obj.style?.fontSize ?? "0"));
        out.push({ text: obj.text, size });
      }
      for (const child of (obj.list as any[] | undefined) ?? []) walk(child, visible);
    };
    for (const obj of scene.children.list as any[]) walk(obj, true);
    return out;
  }, key);
}

/** Moves the real mouse onto the first object with this text. */
export async function hoverText(page: Page, key: string, text: string): Promise<void> {
  const centre = await page.evaluate(
    ({ k, t }) => {
      const scene = (window as any).game.scene.getScene(k);
      const find = (list: any[]): any =>
        list.reduce<any>(
          (hit, obj) => hit ?? (obj.text === t ? obj : find(obj.list ?? [])),
          null,
        );
      const obj = find(scene.children.list);
      if (!obj) return null;
      const b = obj.getBounds();
      return { x: b.centerX, y: b.centerY };
    },
    { k: key, t: text },
  );
  expect(centre, `text "${text}" on screen`).not.toBeNull();
  const box = (await page.locator("canvas").boundingBox())!;
  const size = await page.evaluate(() => {
    const g = (window as any).game;
    return { w: g.scale.gameSize.width, h: g.scale.gameSize.height };
  });
  await page.mouse.move(
    box.x + centre!.x * (box.width / size.w),
    box.y + centre!.y * (box.height / size.h),
  );
}

/** Clicks the object with this text (real mouse). */
export async function clickText(page: Page, key: string, text: string): Promise<void> {
  await hoverText(page, key, text);
  await page.mouse.down();
  await page.mouse.up();
}

/** The tooltip text currently on show in a scene ("" when none). */
export async function tooltip(page: Page, key: string): Promise<string> {
  return page.evaluate(
    (k) =>
      (window as any).game.scene.getScene(k).data.get("hintTooltip")
        ?.shownText ?? "",
    key,
  );
}

/** Whether the scene's tooltip shows the full explanation (not the short hover line). */
export async function tooltipExpanded(page: Page, key: string): Promise<boolean> {
  return page.evaluate(
    (k) =>
      (window as any).game.scene.getScene(k).data.get("hintTooltip")?.expanded ??
      false,
    key,
  );
}
