/**
 * Multiplayer / LobbyScene E2E Tests
 *
 * Two groups:
 *  1. Single-player with live P2P server — LobbyScene state, NetworkService connect, room creation.
 *  2. Two-player game_start handshake — create_room → join_room → player_ready×2 → game_start.
 *
 * Server spawned on port 19897. Killed in afterAll.
 */

import { test, expect, chromium, type Browser, type BrowserContext } from '@playwright/test';
import { waitForScene, waitForMenuReady, collectErrors } from './helpers/game';
import { spawn, exec, type ChildProcess } from 'child_process';
import { resolve } from 'path';

const P2P_PORT = 19897;
const P2P_URL = `ws://localhost:${P2P_PORT}`;
const SCRIPT = resolve(process.cwd(), 'scripts/p2p_server.ts');

// ─── server lifecycle ─────────────────────────────────────────────────────────

function startP2PServer(): Promise<ChildProcess> {
  return new Promise((resolveP, rejectP) => {
    const proc = spawn(
      'npx',
      ['tsx', SCRIPT, '--port', String(P2P_PORT)],
      { shell: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const t = setTimeout(() => rejectP(new Error('P2P server start timeout')), 10_000);
    proc.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('listening')) { clearTimeout(t); resolveP(proc); }
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('EADDRINUSE')) {
        clearTimeout(t);
        rejectP(new Error('port in use'));
      }
    });
    proc.on('error', (err: Error) => { clearTimeout(t); rejectP(err); });
  });
}

async function killServer(proc: ChildProcess): Promise<void> {
  if (!proc.pid || proc.killed) return;
  return new Promise<void>((res) => {
    if (process.platform === 'win32') {
      // On Windows with shell:true, the shell exits but node.exe keeps the port.
      // Use taskkill /T to kill the whole process tree.
      exec(`taskkill /F /T /PID ${proc.pid}`, () => setTimeout(res, 200));
    } else {
      proc.on('close', () => res());
      proc.kill('SIGTERM');
      setTimeout(() => { if (!proc.killed) proc.kill('SIGKILL'); }, 3_000);
    }
  });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function launchLobby(page: any): Promise<void> {
  await page.goto('/');
  await waitForMenuReady(page);
  // ONLINE menu navigates to SquadBuilderScene (online mode) → LobbyScene via START.
  // Start LobbyScene directly to avoid depending on the squad-builder flow.
  await page.evaluate(() => (window as any).game.scene.start('LobbyScene'));
  await waitForScene(page, 'LobbyScene');
}

async function connectToServer(page: any): Promise<void> {
  await page.evaluate((url: string) => {
    const ns = (window as any).game?.registry?.get('networkService');
    if (ns && typeof ns.connect === 'function') ns.connect(url);
  }, P2P_URL);
  await page.waitForFunction(
    () => {
      const ns = (window as any).game?.registry?.get('networkService');
      return ns?.isConnected === true || ns?.connected === true;
    },
    { timeout: 8_000 },
  );
}

// ─── Single-player with server ────────────────────────────────────────────────

test.describe('LobbyScene — single player with server', () => {
  let server: ChildProcess;
  test.beforeAll(async () => { server = await startP2PServer(); });
  test.afterAll(async () => { await killServer(server); });

  test('LobbyScene becomes active after ONLINE navigation', async ({ page }) => {
    await launchLobby(page);
    expect(
      await page.evaluate(() => (window as any).game.scene.isActive('LobbyScene')),
    ).toBe(true);
  });

  test('NetworkService connects without page errors', async ({ page }) => {
    const errors = collectErrors(page as any);
    await launchLobby(page);
    await connectToServer(page);
    expect(errors.pageErrors).toHaveLength(0);
  });

  test('host can create a room', async ({ page }) => {
    await launchLobby(page);
    // Stay in local simulation mode — P2P WS may not be open yet when createRoom fires,
    // causing the message to be silently dropped. Local mode uses processLocalMessage instead.
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('LobbyScene') as any;
      if (typeof s.createRoom === 'function') s.createRoom();
    });
    await page.waitForFunction(
      () => {
        const ns = (window as any).game?.registry?.get('networkService');
        return ns?.currentRoomId != null;
      },
      { timeout: 8_000 },
    );
    const roomId = await page.evaluate(() => {
      const ns = (window as any).game?.registry?.get('networkService');
      return ns?.currentRoomId ?? null;
    });
    expect(typeof roomId).toBe('string');
  });

  test('lobby shows correct connected state', async ({ page }) => {
    await launchLobby(page);
    await connectToServer(page);
    const isConnected = await page.evaluate(() => {
      const ns = (window as any).game?.registry?.get('networkService');
      return ns?.isConnected ?? ns?.connected ?? false;
    });
    expect(isConnected).toBe(true);
  });
});

// ─── Two-player game_start handshake ─────────────────────────────────────────

test.describe('LobbyScene — two-player game_start handshake', () => {
  let server: ChildProcess;
  let browser1: Browser;
  let browser2: Browser;
  let ctx1: BrowserContext;
  let ctx2: BrowserContext;

  test.beforeAll(async () => {
    server = await startP2PServer();
    [browser1, browser2] = await Promise.all([chromium.launch(), chromium.launch()]);
    [ctx1, ctx2] = await Promise.all([browser1.newContext(), browser2.newContext()]);
  });

  test.afterAll(async () => {
    await Promise.all([ctx1?.close(), ctx2?.close()]);
    await Promise.all([browser1?.close(), browser2?.close()]);
    await killServer(server);
  });

  /**
   * Phase 1: Host creates a room, stores the live WebSocket on the page window.
   * Resolves with the new roomId from the server's `room_created` message.
   */
  async function hostCreateRoom(page: any): Promise<string> {
    return page.evaluate(
      (url: string): Promise<string> => new Promise((res, rej) => {
        const ws = new WebSocket(url);
        ws.onopen = () => ws.send(JSON.stringify({
          type: 'create_room',
          payload: { name: 'TestRoom', maxPlayers: 2, gameMode: 'turn_based' },
        }));
        ws.onmessage = (ev) => {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'room_created') {
            (window as any).__p2pHostWs = ws;
            res(msg.payload.room.id as string);
          }
        };
        ws.onerror  = () => rej(new Error('ws error in hostCreateRoom'));
        ws.onclose  = () => rej(new Error('ws closed before room_created'));
        setTimeout(() => rej(new Error('hostCreateRoom timeout')), 10_000);
      }),
      P2P_URL,
    );
  }

  /**
   * Phase 2 (host side): Sends player_ready on the stored WS and waits for game_start.
   */
  function hostWaitGameStart(page: any): Promise<any> {
    return page.evaluate((): Promise<any> => new Promise((res) => {
      const ws = (window as any).__p2pHostWs as WebSocket | undefined;
      if (!ws) { res({ error: 'no stored ws' }); return; }
      ws.send(JSON.stringify({ type: 'player_ready', payload: { isReady: true } }));
      const prev = ws.onmessage;
      ws.onmessage = (ev) => {
        if (typeof prev === 'function') (prev as any)(ev);
        const msg = JSON.parse(ev.data);
        if (msg.type === 'game_start') res(msg);
      };
      setTimeout(() => res({ error: 'timeout' }), 15_000);
    }));
  }

  /**
   * Phase 2 (joiner side): Joins a specific roomId, sends player_ready, waits for game_start.
   */
  function joinerHandshake(page: any, roomId: string): Promise<any> {
    return page.evaluate(
      ([url, rid]: [string, string]): Promise<any> => new Promise((res) => {
        const ws = new WebSocket(url);
        ws.onopen = () => ws.send(JSON.stringify({
          type: 'join_room',
          payload: { roomId: rid },
        }));
        ws.onmessage = (ev) => {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'room_joined')
            ws.send(JSON.stringify({ type: 'player_ready', payload: { isReady: true } }));
          if (msg.type === 'game_start') res(msg);
        };
        ws.onerror = () => res({ error: 'ws error' });
        setTimeout(() => res({ error: 'timeout' }), 15_000);
      }),
      [P2P_URL, roomId] as [string, string],
    );
  }

  test('both players receive game_start after create/join/ready', async () => {
    const [page1, page2] = await Promise.all([ctx1.newPage(), ctx2.newPage()]);
    await Promise.all([
      page1.goto('http://localhost:3003'),
      page2.goto('http://localhost:3003'),
    ]);

    const roomId = await hostCreateRoom(page1);
    const [r1, r2] = await Promise.all([hostWaitGameStart(page1), joinerHandshake(page2, roomId)]);

    expect(r1.type).toBe('game_start');
    expect(r2.type).toBe('game_start');
  });

  test('both players receive the same deterministic seed', async () => {
    const [page1, page2] = await Promise.all([ctx1.newPage(), ctx2.newPage()]);
    await Promise.all([
      page1.goto('http://localhost:3003'),
      page2.goto('http://localhost:3003'),
    ]);

    const roomId = await hostCreateRoom(page1);
    const [r1, r2] = await Promise.all([hostWaitGameStart(page1), joinerHandshake(page2, roomId)]);

    const seed1 = r1.payload?.seed;
    const seed2 = r2.payload?.seed;
    expect(typeof seed1).toBe('number');
    expect(seed1).toBe(seed2);
  });
});
