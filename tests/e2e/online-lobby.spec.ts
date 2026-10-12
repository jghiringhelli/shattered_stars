/**
 * Online lobby, end to end: two browser contexts reach the lobby from the
 * main menu, find each other (room code / quick match), ready up and receive
 * the same match from a real relay started in-process; a dropped connection
 * shows as reconnecting and resumes the same seat.
 */

import { test, expect, type Browser, type Page } from "@playwright/test";
import { DEFAULT_CONFIG } from "../../server/src/config";
import { createSilentLogger } from "../../server/src/logger";
import { startRelayServer, type RunningRelay } from "../../server/src/wsServer";
import {
  clickGameCoord,
  clickMenuItem,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";

let relay: RunningRelay;

test.beforeAll(async () => {
  relay = await startRelayServer(
    {
      ...DEFAULT_CONFIG,
      port: 0,
      host: "127.0.0.1",
      startCountdownMs: 300,
      quickMatchReadyMs: 20_000,
    },
    { logger: createSilentLogger() },
  );
});

test.afterAll(async () => {
  await relay.close();
});

/** A player: own browser context, at the online lobby, connected. */
async function openLobby(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/?server=ws://127.0.0.1:${relay.port}/ws`);
  await waitForMenuReady(page);
  await clickMenuItem(page, "ONLINE");
  await waitForScene(page, "LobbyScene");
  await waitForLobby(page, "s.connection === 'online'");
  return page;
}

/** Wait until an expression over the lobby state `s` is true. */
async function waitForLobby(
  page: Page,
  expression: string,
  timeout = 15_000,
): Promise<void> {
  await page.waitForFunction(
    (expr) => {
      const s = (window as any).game?.registry.get("onlineSession")?.state;
      return s ? Boolean(new Function("s", `return ${expr};`)(s)) : false;
    },
    expression,
    { timeout },
  );
}

async function lobbyState<T>(page: Page, expression: string): Promise<T> {
  return page.evaluate((expr) => {
    const s = (window as any).game.registry.get("onlineSession").state;
    return new Function("s", `return ${expr};`)(s);
  }, expression) as Promise<T>;
}

/** Click a named lobby control (button / toggle) at its on-screen position. */
async function clickNamed(page: Page, name: string): Promise<void> {
  const handle = await page.waitForFunction(
    (n) => {
      const scene = (window as any).game.scene.getScene("LobbyScene");
      const find = (list: any[]): any => {
        for (const o of list) {
          if (o.name === n && o.active) return o;
          const inner = o.list ? find(o.list) : null;
          if (inner) return inner;
        }
        return null;
      };
      const found = find(scene.children.list);
      if (!found) return null;
      const m = found.getWorldTransformMatrix();
      return { x: m.tx, y: m.ty };
    },
    name,
    { timeout: 10_000 },
  );
  const { x, y } = (await handle.jsonValue()) as { x: number; y: number };
  await clickGameCoord(page, x, y);
}

async function hasNamed(page: Page, name: string): Promise<boolean> {
  return page.evaluate((n) => {
    const scene = (window as any).game.scene.getScene("LobbyScene");
    const find = (list: any[]): boolean =>
      list.some(
        (o) => (o.name === n && o.active) || (o.list ? find(o.list) : false),
      );
    return find(scene.children.list);
  }, name);
}

test.describe("online lobby", () => {
  test.describe.configure({ mode: "serial" });

  test("two players meet by room code, ready up and receive the same match", async ({
    browser,
  }) => {
    const host = await openLobby(browser);
    const guest = await openLobby(browser);

    await clickNamed(host, "online_create_room");
    await waitForLobby(host, "s.room !== null");
    const code = await lobbyState<string>(host, "s.room.code");
    expect(code).toMatch(/^[A-Z2-9]{5}$/);
    expect(await hasNamed(host, "online_room_code")).toBe(true);

    await clickNamed(guest, "online_join_by_code");
    await guest.waitForTimeout(150);
    await guest.keyboard.type(code.toLowerCase());
    await guest.keyboard.press("Enter");
    await waitForLobby(guest, "s.room && s.room.players.length === 2");
    await waitForLobby(
      host,
      "s.room.players.length === 2 && s.room.players.every((p) => p.loadout)",
    );

    const pings = await lobbyState<number[]>(
      host,
      "s.room.players.map((p) => p.pingMs)",
    );
    expect(pings.every((ping) => ping >= 0)).toBe(true);

    await clickNamed(host, "online_ready");
    await clickNamed(guest, "online_ready");
    await waitForLobby(host, "s.match !== null");
    await waitForLobby(guest, "s.match !== null");
    const hostMatch = await lobbyState<unknown>(host, "s.match");
    const guestMatch = await lobbyState<unknown>(guest, "s.match");
    expect(hostMatch).toEqual(guestMatch);
    expect(await hasNamed(host, "online_match_card")).toBe(true);

    await clickNamed(host, "online_match_back");
    await clickNamed(guest, "online_match_back");
    await waitForLobby(host, "s.match === null && s.room.phase === 'lobby'");
    await waitForLobby(guest, "s.match === null && s.room.phase === 'lobby'");
    await host.context().close();
    await guest.context().close();
  });

  test("quick match pairs two players into a ready-check room", async ({
    browser,
  }) => {
    const a = await openLobby(browser);
    const b = await openLobby(browser);
    await clickNamed(a, "online_quick_match");
    await waitForLobby(a, "s.queue !== null");
    expect(await hasNamed(a, "online_queue_timer")).toBe(true);
    await clickNamed(b, "online_quick_match");
    await waitForLobby(
      a,
      "s.room && s.room.quickMatch && s.room.players.length === 2",
    );
    await waitForLobby(
      b,
      "s.room && s.room.quickMatch && s.room.readyDeadline !== null",
    );
    expect(await hasNamed(b, "online_countdown")).toBe(true);
    await a.context().close();
    await b.context().close();
  });

  test("a dropped connection shows as reconnecting and resumes the same seat", async ({
    browser,
  }) => {
    const host = await openLobby(browser);
    const guest = await openLobby(browser);
    await clickNamed(host, "online_create_room");
    await waitForLobby(host, "s.room !== null");
    const code = await lobbyState<string>(host, "s.room.code");
    await guest.evaluate(
      (c) => (window as any).game.registry.get("onlineSession").joinRoom(c),
      code,
    );
    await waitForLobby(host, "s.room.players.length === 2");
    const guestId = await lobbyState<string>(guest, "s.localId");

    await guest.evaluate(() =>
      (window as any).game.registry
        .get("onlineSession")
        .client.transport.close(1000, "test drop"),
    );
    await waitForLobby(host, "s.room.players.some((p) => !p.connected)", 5_000);
    await waitForLobby(guest, "s.connection === 'online'", 10_000);
    await waitForLobby(
      host,
      "s.room.players.length === 2 && s.room.players.every((p) => p.connected)",
    );
    expect(await lobbyState<string>(guest, "s.localId")).toBe(guestId);
    await host.context().close();
    await guest.context().close();
  });
});
