/**
 * Online battle e2e helpers: two browser contexts against an in-process
 * relay, each behind the `?netsim=` latency simulator, taken from the
 * lobby into a running lockstep battle; then the per-tick state-hash
 * traces of both clients are compared.
 */

import { expect, type Browser, type Page } from "@playwright/test";
import { clickMenuItem, waitForMenuReady, waitForScene } from "./game";

/** One client's lockstep diagnostics (OnlineBattleLink.debug). */
export interface OnlineDebug {
  readonly tick: number;
  readonly status: string;
  readonly inputDelay: number;
  readonly stats: {
    readonly stallMs: number;
    readonly longestStallMs: number;
    readonly resyncs: number;
    readonly snapshotsApplied: number;
    readonly bytesSent: number;
    readonly hashesSent: number;
  };
  readonly hashes: [number, number][];
}

/**
 * @param browser - The test browser.
 * @param relayPort - In-process relay port.
 * @param netsim - `?netsim=` value (one-way latency, jitter, loss).
 * @returns A page at the online lobby, connected.
 */
export async function openOnlineLobby(
  browser: Browser,
  relayPort: number,
  netsim: string,
): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) console.log(`[nav] ${frame.url()}`);
  });
  page.on("pageerror", (error) => console.log(`[pageerror] ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") console.log(`[console] ${message.text()}`);
  });
  await page.goto(
    `/?server=ws://127.0.0.1:${relayPort}/ws&netsim=${encodeURIComponent(netsim)}`,
  );
  await waitForMenuReady(page);
  await clickMenuItem(page, "ONLINE");
  await waitForScene(page, "LobbyScene");
  await waitForLobby(page, "s.connection === 'online'");
  return page;
}

/** Wait until an expression over the lobby state `s` is true. */
export async function waitForLobby(
  page: Page,
  expression: string,
  timeout = 20_000,
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

/** Run `method(...args)` on the page's OnlineSession. */
export async function session(
  page: Page,
  method: string,
  ...args: unknown[]
): Promise<unknown> {
  return page.evaluate(
    ([m, a]) => {
      const s = (window as any).game.registry.get("onlineSession");
      return s[m as string](...(a as unknown[]));
    },
    [method, args] as const,
  );
}

/**
 * Host opens a room in `mode`, the guest joins by code, both fly the given
 * factions (a squad battle's sides are factions), ready up and land in
 * `sceneKey`.
 */
export async function startOnlineMatch(
  host: Page,
  guest: Page,
  mode: string,
  sceneKey: string,
): Promise<void> {
  await session(host, "selectMode", mode);
  await session(host, "createRoom");
  await waitForLobby(host, "s.room !== null");
  const code = await host.evaluate(
    () => (window as any).game.registry.get("onlineSession").state.room.code,
  );
  await session(guest, "joinRoom", code);
  await waitForLobby(
    host,
    "s.room.players.length === 2 && s.room.players.every((p) => p.loadout)",
  );
  if (mode !== "dogfight") {
    await session(host, "setLoadout", SQUADS[0]);
    await session(guest, "setLoadout", SQUADS[1]);
    await waitForLobby(
      host,
      `s.room.players.every((p) => p.loadout && p.loadout.ships.length === 3)`,
    );
  }
  await session(host, "setReady", true);
  await session(guest, "setReady", true);
  await waitForScene(host, sceneKey, 30_000);
  await waitForScene(guest, sceneKey, 30_000);
}

/** Squads of the e2e squad battles (one faction per side). */
const SQUADS = [
  {
    faction: "terran_hegemony",
    ships: ["terran_gladius", "terran_viper", "terran_viper"],
  },
  {
    faction: "void_corsairs",
    ships: ["corsair_raider", "corsair_raider", "corsair_raider"],
  },
] as const;

/** @returns The battle scene's online diagnostics. */
export async function onlineDebug(
  page: Page,
  sceneKey: string,
): Promise<OnlineDebug> {
  return page.evaluate(
    (key) => (window as any).game.scene.getScene(key).onlineDebug,
    sceneKey,
  ) as Promise<OnlineDebug>;
}

/** Wait until the battle has simulated `ticks` ticks. */
export async function waitForTicks(
  page: Page,
  sceneKey: string,
  ticks: number,
  timeout: number,
): Promise<void> {
  await page.waitForFunction(
    ([key, n]) =>
      ((window as any).game?.scene.getScene(key)?.onlineDebug?.tick ?? -1) >=
      (n as number),
    [sceneKey, ticks] as const,
    { timeout, polling: 500 },
  );
}

/**
 * Fly a pilot for a while: hold and release steering / throttle and tap
 * the special keys, so the input streams are far from neutral.
 */
export async function flyAround(page: Page, seed: number): Promise<void> {
  const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
  const taps = ["z", "r", "q", "e"];
  for (let i = 0; i < 6; i++) {
    const key = keys[(seed + i) % keys.length]!;
    await page.keyboard.down(key);
    await page.waitForTimeout(180 + ((seed * 37 + i * 53) % 400));
    await page.keyboard.up(key);
    await page.keyboard.press(taps[(seed + i) % taps.length]!);
  }
}

/** Ticks both traces hold, and how many of them disagree. */
export function compareTraces(
  a: readonly [number, number][],
  b: readonly [number, number][],
): { common: number; mismatched: number[] } {
  const other = new Map(b);
  const mismatched: number[] = [];
  let common = 0;
  for (const [tick, hash] of a) {
    const theirs = other.get(tick);
    if (theirs === undefined) continue;
    common++;
    if (theirs !== hash) mismatched.push(tick);
  }
  return { common, mismatched };
}

/** Assert the clients ran in lockstep: identical hashes on every common tick. */
export function expectIdentical(
  a: OnlineDebug,
  b: OnlineDebug,
  minCommonTicks: number,
): void {
  const { common, mismatched } = compareTraces(a.hashes, b.hashes);
  expect(mismatched.slice(0, 5)).toEqual([]);
  expect(common).toBeGreaterThanOrEqual(minCommonTicks);
  expect(new Set(a.hashes.map(([, hash]) => hash)).size).toBeGreaterThan(
    minCommonTicks / 2,
  );
  expect(a.stats.resyncs + b.stats.resyncs).toBe(0);
}

/**
 * @param page - A client.
 * @param sceneKey - The battle scene.
 * @param seat - A seat.
 * @returns The heading of the ship that seat flies, as this client simulates it.
 */
export async function seatShipAngle(
  page: Page,
  sceneKey: string,
  seat: number,
): Promise<number> {
  return page.evaluate(
    ([key, s]) => {
      const scene = (window as any).game.scene.getScene(key);
      const online = scene.online;
      const id = online.shipOf ? online.shipOf(s) : online.shipIdOf(s);
      return scene.ships.get(id).angle as number;
    },
    [sceneKey, seat] as const,
  );
}

/**
 * The guest (seat 1) holds a steering key: the ship it flies must turn on
 * the host's client too — its input really reaches every simulation.
 */
export async function expectGuestSteersOnHost(
  host: Page,
  guest: Page,
  sceneKey: string,
): Promise<void> {
  const before = await seatShipAngle(host, sceneKey, 1);
  await guest.keyboard.down("ArrowLeft");
  await guest.waitForTimeout(2_000);
  await guest.keyboard.up("ArrowLeft");
  await host.waitForTimeout(500);
  const after = await seatShipAngle(host, sceneKey, 1);
  const turned = Math.abs(((after - before + 540) % 360) - 180);
  expect(turned).toBeGreaterThan(30);
}
