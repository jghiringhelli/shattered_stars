/**
 * P2P Multiplayer — Two-Browser E2E Tests
 *
 * Drives two headless browser contexts against a live P2P server.
 * Exercises connection, room lifecycle, game_start seed agreement,
 * game_action relay, echo prevention, disconnect propagation, and
 * planning-phase maneuver synchronisation.
 */

import { test, expect } from './fixtures/p2p-server';
import { waitForMenuReady } from './helpers/game';
import type { BrowserContext, Page, Browser } from '@playwright/test';

// ── Page-pair helpers ─────────────────────────────────────────────────────────

/** Navigate two fresh pages to the game and wait for the menu. */
async function launchPages(browser: Browser): Promise<{
  ctx1: BrowserContext; ctx2: BrowserContext;
  page1: Page; page2: Page;
}> {
  const [ctx1, ctx2] = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  const [page1, page2] = await Promise.all([ctx1.newPage(), ctx2.newPage()]);
  await Promise.all([page1.goto('/'), page2.goto('/')]);
  await Promise.all([waitForMenuReady(page1), waitForMenuReady(page2)]);
  return { ctx1, ctx2, page1, page2 };
}

/** Connect both pages' NetworkService singletons to the P2P server. */
async function connectBoth(page1: Page, page2: Page, serverUrl: string): Promise<void> {
  await Promise.all([
    page1.evaluate((url) => (window as any).networkService.connect(url), serverUrl),
    page2.evaluate((url) => (window as any).networkService.connect(url), serverUrl),
  ]);
}

/**
 * Page1 creates a room and Page2 joins it.
 * Returns the room ID so tests can reference it.
 */
async function createAndJoinRoom(page1: Page, page2: Page): Promise<string> {
  const created = await page1.evaluate(() =>
    new Promise<any>((resolve) => {
      const ns = (window as any).networkService;
      ns.once('room_created', (data: any) => resolve(data));
      ns.createRoom('E2ETest', 2, 'turn_based');
    }),
  );
  const roomId: string = created.room.id;

  await page2.evaluate((rid: string) =>
    new Promise<void>((resolve) => {
      const ns = (window as any).networkService;
      ns.once('room_joined', () => resolve());
      ns.joinRoom(rid);
    }), roomId,
  );

  return roomId;
}

/**
 * Both pages select a faction with ships and mark ready.
 * Waits until both receive the game_start event.
 * Returns the seed received by each page; both must match.
 */
async function reachGameStart(page1: Page, page2: Page): Promise<{ seed1: number; seed2: number }> {
  // Subscribe to game_start on both sides before triggering ready
  const startPromise1 = page1.evaluate(() =>
    new Promise<number>((resolve) => {
      (window as any).networkService.once('game_start', (d: any) => resolve(d.seed));
    }),
  );
  const startPromise2 = page2.evaluate(() =>
    new Promise<number>((resolve) => {
      (window as any).networkService.once('game_start', (d: any) => resolve(d.seed));
    }),
  );

  // Select factions (so server has ships data)
  await Promise.all([
    page1.evaluate(() => (window as any).networkService.selectFaction('terran_hegemony', ['terran_gladius'])),
    page2.evaluate(() => (window as any).networkService.selectFaction('free_confederation', ['confed_falcon'])),
  ]);

  // Mark ready — server auto-starts when all players are ready
  await Promise.all([
    page1.evaluate(() => (window as any).networkService.setReady(true)),
    page2.evaluate(() => (window as any).networkService.setReady(true)),
  ]);

  const [seed1, seed2] = await Promise.all([startPromise1, startPromise2]);
  return { seed1, seed2 };
}

// ── Tests — Connection & Room ─────────────────────────────────────────────────

test.describe('P2P Multiplayer — connection and room lifecycle', () => {
  let ctx1: BrowserContext, ctx2: BrowserContext;
  let page1: Page, page2: Page;

  test.beforeEach(async ({ browser, p2pServer }) => {
    ({ ctx1, ctx2, page1, page2 } = await launchPages(browser));
    await connectBoth(page1, page2, p2pServer.url);
  });

  test.afterEach(async () => {
    await Promise.all([ctx1.close(), ctx2.close()]);
  });

  test('both pages connect to the server successfully', async () => {
    const [c1, c2] = await Promise.all([
      page1.evaluate(() => (window as any).networkService.isConnectedToServer()),
      page2.evaluate(() => (window as any).networkService.isConnectedToServer()),
    ]);
    expect(c1).toBe(true);
    expect(c2).toBe(true);
  });

  test('host creates a room and guest joins', async () => {
    const roomId = await createAndJoinRoom(page1, page2);
    expect(typeof roomId).toBe('string');
    expect(roomId.length).toBeGreaterThan(0);
  });

  test('game_start delivers the same seed to both clients', async () => {
    await createAndJoinRoom(page1, page2);
    const { seed1, seed2 } = await reachGameStart(page1, page2);
    expect(typeof seed1).toBe('number');
    expect(seed1).toBe(seed2);
  });

  test('game_start seed is stored in NetworkService.getCurrentBattleSeed()', async () => {
    await createAndJoinRoom(page1, page2);
    const { seed1 } = await reachGameStart(page1, page2);

    const stored = await page1.evaluate(() =>
      (window as any).networkService.getCurrentBattleSeed(),
    );
    expect(stored).toBe(seed1);
  });

  test('disconnecting guest delivers player_left to host', async () => {
    await createAndJoinRoom(page1, page2);

    const leftPromise = page1.evaluate(() =>
      new Promise<any>((resolve) => {
        (window as any).networkService.once('player_left', (d: any) => resolve(d));
      }),
    );

    await ctx2.close(); // Force-close guest connection

    const leftData = await leftPromise;
    expect(leftData).toBeDefined();
  });
});

// ── Tests — In-Battle Message Relay ──────────────────────────────────────────

test.describe('P2P Multiplayer — game_action routing', () => {
  let ctx1: BrowserContext, ctx2: BrowserContext;
  let page1: Page, page2: Page;

  test.beforeEach(async ({ browser, p2pServer }) => {
    ({ ctx1, ctx2, page1, page2 } = await launchPages(browser));
    await connectBoth(page1, page2, p2pServer.url);
    await createAndJoinRoom(page1, page2);
    await reachGameStart(page1, page2);
  });

  test.afterEach(async () => {
    await Promise.all([ctx1.close(), ctx2.close()]);
  });

  test('game_action sent by host is received by guest', async () => {
    const receivedPromise = page2.evaluate(() =>
      new Promise<any>((resolve) => {
        (window as any).networkService.once('game_action', (d: any) => resolve(d));
      }),
    );

    await page1.evaluate(() =>
      (window as any).networkService.sendGameAction({
        type: 'submit_maneuvers',
        data: { maneuvers: [{ shipId: 'ship_0', direction: 'straight', speed: 3, difficulty: 'white' }] },
      }),
    );

    const received = await receivedPromise;
    expect(received.type).toBe('submit_maneuvers');
    expect((received.data as any).maneuvers).toHaveLength(1);
  });

  test('host does not receive its own game_action (no echo)', async () => {
    // Store any incoming game_action on page1 in a window variable
    await page1.evaluate(() => {
      (window as any).__echoTest = false;
      (window as any).networkService.once('game_action', () => { (window as any).__echoTest = true; });
    });

    await page1.evaluate(() =>
      (window as any).networkService.sendGameAction({ type: 'turn_sync', data: { turnNumber: 1, stateHash: 'abc' } }),
    );

    // Wait briefly then check no echo arrived
    await page1.waitForTimeout(500);
    const echoed = await page1.evaluate(() => (window as any).__echoTest);
    expect(echoed).toBe(false);
  });

  test('planning sync: both players exchange submit_maneuvers', async () => {
    // Arm listeners on both sides before either submits
    const guestReceived = page2.evaluate(() =>
      new Promise<any>((resolve) => {
        (window as any).networkService.once('game_action', (d: any) => {
          if (d.type === 'submit_maneuvers') resolve(d);
        });
      }),
    );
    const hostReceived = page1.evaluate(() =>
      new Promise<any>((resolve) => {
        (window as any).networkService.once('game_action', (d: any) => {
          if (d.type === 'submit_maneuvers') resolve(d);
        });
      }),
    );

    // Host submits its maneuvers
    await page1.evaluate(() =>
      (window as any).networkService.sendGameAction({
        type: 'submit_maneuvers',
        data: { maneuvers: [{ shipId: 'host_0', direction: 'bank_right', speed: 2, difficulty: 'red' }] },
      }),
    );

    // Guest submits its maneuvers
    await page2.evaluate(() =>
      (window as any).networkService.sendGameAction({
        type: 'submit_maneuvers',
        data: { maneuvers: [{ shipId: 'guest_0', direction: 'straight', speed: 3, difficulty: 'white' }] },
      }),
    );

    const [fromHost, fromGuest] = await Promise.all([guestReceived, hostReceived]);
    expect(fromHost.data.maneuvers[0].shipId).toBe('host_0');
    expect(fromGuest.data.maneuvers[0].shipId).toBe('guest_0');
  });

  test('turn_sync relayed to opponent with correct fields', async () => {
    const receivedPromise = page2.evaluate(() =>
      new Promise<any>((resolve) => {
        (window as any).networkService.once('game_action', (d: any) => {
          if (d.type === 'turn_sync') resolve(d);
        });
      }),
    );

    await page1.evaluate(() =>
      (window as any).networkService.sendGameAction({
        type: 'turn_sync',
        data: { turnNumber: 1, stateHash: 'deadbeef' },
      }),
    );

    const received = await receivedPromise;
    expect(received.type).toBe('turn_sync');
    expect((received.data as any).turnNumber).toBe(1);
    expect((received.data as any).stateHash).toBe('deadbeef');
  });
});
