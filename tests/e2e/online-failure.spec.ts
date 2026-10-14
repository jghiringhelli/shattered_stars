/**
 * online-failure.spec.ts — when the relay cannot be reached the lobby says so
 * in plain language and offers PLAY OFFLINE INSTEAD (a way out that needs no
 * server).
 */

import { test, expect } from "@playwright/test";
import {
  clickGameCoord,
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";

/** The initial connection attempts back off for several seconds. */
const UNREACHABLE_TIMEOUT_MS = 40_000;

test("an unreachable server shows advice and a way back to the offline modes", async ({
  page,
}) => {
  await page.goto("/?server=ws://127.0.0.1:1/ws");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  await page.evaluate(() => (window as any).game.scene.start("LobbyScene"));
  await waitForScene(page, "LobbyScene");
  await page.waitForFunction(
    () => {
      const scene = (window as any).game.scene.getScene("LobbyScene");
      return scene?.session?.state?.connection === "unreachable";
    },
    undefined,
    { timeout: UNREACHABLE_TIMEOUT_MS },
  );
  await page.waitForTimeout(300);
  const texts = await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene("LobbyScene");
    const out: string[] = [];
    const walk = (list: any[]): void => {
      for (const o of list) {
        if (typeof o.text === "string") out.push(o.text);
        if (Array.isArray(o.list)) walk(o.list);
      }
    };
    walk(scene.children.list);
    return out.join("\n");
  });
  expect(texts).toContain("Server unreachable");
  expect(texts).toMatch(/Could not reach the game server/);
  expect(texts).toMatch(/work offline/);

  const target = await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene("LobbyScene");
    const find = (list: any[]): any => {
      for (const o of list) {
        if (o.name === "online_play_offline") return o;
        const hit = Array.isArray(o.list) ? find(o.list) : null;
        if (hit) return hit;
      }
      return null;
    };
    const button = find(scene.children.list);
    if (!button) return null;
    const m = button.getWorldTransformMatrix();
    return { x: m.tx as number, y: m.ty as number };
  });
  expect(target).not.toBeNull();
  await clickGameCoord(page, target!.x, target!.y);
  await waitForScene(page, "MainMenuScene");
});
