/**
 * P2P Server Integration Tests
 *
 * Tests the WebSocket server protocol directly using ws clients.
 * Covers room lifecycle, game_start seed distribution, game_action
 * relay, echo prevention, and disconnect handling.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { spawn, type ChildProcess } from 'child_process';
import { resolve } from 'path';

// ── Constants ─────────────────────────────────────────────────────────────────

const PORT = 19898; // Dedicated integration-test port
const SCRIPT = resolve(process.cwd(), 'scripts/p2p_server.ts');

// ── Server lifecycle ──────────────────────────────────────────────────────────

function startServer(): Promise<ChildProcess> {
  return new Promise((resolveP, rejectP) => {
    const proc = spawn('npx', ['tsx', SCRIPT, '--port', String(PORT)], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'], // pipe stderr to capture startup errors
    });

    let started = false;
    proc.stdout!.on('data', (chunk: Buffer) => {
      if (!started && chunk.toString().includes('listening')) {
        started = true;
        resolveP(proc);
      }
    });
    proc.stderr!.on('data', (chunk: Buffer) => {
      // Only reject on obvious fatal startup errors, not TypeScript warnings
      const text = chunk.toString();
      if (!started && text.includes('Error') && text.includes('Cannot find')) {
        rejectP(new Error(`Server startup error: ${text.slice(0, 200)}`));
      }
    });
    proc.on('error', rejectP);
    proc.on('exit', (code) => {
      if (!started && code !== null && code !== 0) {
        rejectP(new Error(`Server exited before ready (code ${code})`));
      }
    });
    setTimeout(() => {
      if (!started) rejectP(new Error('Server did not start within 25 s'));
    }, 25_000);
  });
}

// ── WebSocket client helpers ──────────────────────────────────────────────────

interface ServerMessage { type: string; payload: unknown; senderId?: string; }

interface WsClient {
  /** Queued messages not yet consumed by waitFor. */
  readonly messages: ServerMessage[];
  /** Send a typed message to the server. */
  send(type: string, payload: unknown): void;
  /** Resolve with the next matching message (buffered or incoming). */
  waitFor(type: string, timeout?: number): Promise<ServerMessage>;
  /** Close the underlying socket. */
  close(): void;
}

function connectClient(): Promise<WsClient> {
  return new Promise((resolveP, rejectP) => {
    const ws = new WebSocket(`ws://localhost:${PORT}`);
    const queue: ServerMessage[] = [];
    const waiters = new Map<string, Array<(m: ServerMessage) => void>>();

    ws.on('message', (raw: Buffer) => {
      const msg = JSON.parse(raw.toString()) as ServerMessage;
      const handlers = waiters.get(msg.type);
      if (handlers?.length) {
        handlers.shift()!(msg);
        if (!handlers.length) waiters.delete(msg.type);
      } else {
        queue.push(msg);
      }
    });
    ws.on('error', rejectP);
    ws.on('open', () => {
      resolveP({
        messages: queue,
        send(type, payload) {
          ws.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
        },
        waitFor(type, timeout = 5_000) {
          const buffered = queue.findIndex((m) => m.type === type);
          if (buffered !== -1) return Promise.resolve(queue.splice(buffered, 1)[0]);
          return new Promise<ServerMessage>((res, rej) => {
            const timer = setTimeout(() => {
              const list = waiters.get(type);
              if (list) { const i = list.indexOf(handler); if (i !== -1) list.splice(i, 1); }
              rej(new Error(`Timeout waiting for '${type}'`));
            }, timeout);
            const handler = (m: ServerMessage) => { clearTimeout(timer); res(m); };
            if (!waiters.has(type)) waiters.set(type, []);
            waiters.get(type)!.push(handler);
          });
        },
        close() { ws.close(); },
      });
    });
  });
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('P2P Server — protocol integration', () => {
  let server: ChildProcess | undefined;

  beforeAll(async () => { server = await startServer(); }, 30_000);
  afterAll(() => {
    if (!server) return;
    if (process.platform === 'win32' && server.pid) {
      // On Windows, shell:true spawns cmd.exe which shells node. proc.kill() only
      // kills cmd.exe; the child node process outlives it and holds the port.
      // taskkill /F /T kills the entire process tree.
      spawn('taskkill', ['/f', '/t', '/pid', String(server.pid)], { shell: true });
    } else {
      server.kill();
    }
  });

  it('host creates a room and receives room_created', async () => {
    const host = await connectClient();
    host.send('create_room', { name: 'TestRoom', maxPlayers: 2, gameMode: 'turn_based' });
    const msg = await host.waitFor('room_created');
    const room = (msg.payload as any).room;
    expect(room.name).toBe('TestRoom');
    expect(room.playerCount).toBe(1);
    host.close();
  });

  it('guest joins host room and both receive player_joined', async () => {
    const host = await connectClient();
    host.send('create_room', { name: 'JoinTest', maxPlayers: 2, gameMode: 'turn_based' });
    const created = await host.waitFor('room_created');
    const roomId = (created.payload as any).room.id as string;

    const guest = await connectClient();
    guest.send('join_room', { roomId });
    const joined = await guest.waitFor('room_joined');
    const hostJoin = await host.waitFor('player_joined');

    expect((joined.payload as any).room.playerCount).toBe(2);
    expect(hostJoin.payload).toBeDefined();

    host.close();
    guest.close();
  });

  it('select_faction with ships is reflected in room_update', async () => {
    const host = await connectClient();
    host.send('create_room', { name: 'FactionTest', maxPlayers: 2, gameMode: 'turn_based' });
    const created = await host.waitFor('room_created');
    const roomId = (created.payload as any).room.id as string;

    host.send('select_faction', { factionId: 'terran_hegemony', ships: ['terran_gladius', 'terran_viper'] });
    // Drain the room_created room_update first, then get the faction change one
    await host.waitFor('room_update'); // initial room broadcast
    const update = await host.waitFor('room_update');

    const players: any[] = (update.payload as any).players;
    const hostPlayer = players.find((p: any) => p.isHost);
    expect(hostPlayer?.factionId).toBe('terran_hegemony');
    expect(hostPlayer?.ships).toEqual(['terran_gladius', 'terran_viper']);
    host.close();
  });

  it('game_start is broadcast with seed and ships when all players ready', async () => {
    const host = await connectClient();
    host.send('create_room', { name: 'ReadyTest', maxPlayers: 2, gameMode: 'turn_based' });
    const created = await host.waitFor('room_created');
    const roomId = (created.payload as any).room.id as string;

    host.send('select_faction', { factionId: 'terran_hegemony', ships: ['terran_gladius'] });
    await host.waitFor('room_update'); // initial
    await host.waitFor('room_update'); // faction

    const guest = await connectClient();
    guest.send('join_room', { roomId });
    await guest.waitFor('room_joined');
    await host.waitFor('player_joined');
    await host.waitFor('room_update'); // join broadcast

    guest.send('select_faction', { factionId: 'free_confederation', ships: ['confed_falcon'] });
    await guest.waitFor('room_update');
    await host.waitFor('room_update');

    host.send('player_ready', { isReady: true });
    await host.waitFor('room_update');
    await guest.waitFor('room_update');

    guest.send('player_ready', { isReady: true });

    const hostStart = await host.waitFor('game_start');
    const guestStart = await guest.waitFor('game_start');

    const hostSeed = (hostStart.payload as any).seed as number;
    const guestSeed = (guestStart.payload as any).seed as number;
    expect(typeof hostSeed).toBe('number');
    expect(hostSeed).toBe(guestSeed); // same seed on both clients

    const hostPlayers: any[] = (hostStart.payload as any).players;
    expect(hostPlayers.some((p: any) => p.ships?.includes('terran_gladius'))).toBe(true);
    expect(hostPlayers.some((p: any) => p.ships?.includes('confed_falcon'))).toBe(true);

    host.close();
    guest.close();
  });

  it('game_action is relayed to opponent but NOT echoed to sender', async () => {
    const host = await connectClient();
    host.send('create_room', { name: 'ActionTest', maxPlayers: 2, gameMode: 'turn_based' });
    const created = await host.waitFor('room_created');
    const roomId = (created.payload as any).room.id as string;
    host.send('select_faction', { factionId: 'terran_hegemony', ships: ['terran_gladius'] });
    await host.waitFor('room_update'); await host.waitFor('room_update');

    const guest = await connectClient();
    guest.send('join_room', { roomId });
    await guest.waitFor('room_joined');
    await host.waitFor('player_joined'); await host.waitFor('room_update');
    guest.send('select_faction', { factionId: 'free_confederation', ships: ['confed_falcon'] });
    await guest.waitFor('room_update'); await host.waitFor('room_update');

    host.send('player_ready', { isReady: true });
    await host.waitFor('room_update'); await guest.waitFor('room_update');
    guest.send('player_ready', { isReady: true });
    await host.waitFor('game_start'); await guest.waitFor('game_start');

    // Host sends game_action
    host.send('game_action', { type: 'submit_maneuvers', data: { maneuvers: [] } });

    // Guest receives it
    const relayed = await guest.waitFor('game_action');
    expect(relayed.payload).toBeDefined();

    // Host should NOT receive its own action (wait briefly then check queue)
    await new Promise((r) => setTimeout(r, 300));
    const echoed = host.messages.find((m) => m.type === 'game_action');
    expect(echoed).toBeUndefined();

    host.close();
    guest.close();
  });

  it('remaining player receives player_left when opponent disconnects', async () => {
    const host = await connectClient();
    host.send('create_room', { name: 'DiscoTest', maxPlayers: 2, gameMode: 'turn_based' });
    const created = await host.waitFor('room_created');
    const roomId = (created.payload as any).room.id as string;

    const guest = await connectClient();
    guest.send('join_room', { roomId });
    await guest.waitFor('room_joined');
    await host.waitFor('player_joined'); await host.waitFor('room_update');

    guest.close();
    const left = await host.waitFor('player_left', 3_000);
    expect(left.payload).toBeDefined();

    host.close();
  });

  it('player_disconnected with inBattle=true is broadcast when game is started', async () => {
    // Full ready flow: create → join → factions → both ready → game_start
    const host = await connectClient();
    host.send('create_room', { name: 'InBattleTest', maxPlayers: 2, gameMode: 'turn_based' });
    const created = await host.waitFor('room_created');
    const roomId = (created.payload as any).room.id as string;
    host.send('select_faction', { factionId: 'terran_hegemony', ships: ['terran_gladius'] });

    const guest = await connectClient();
    guest.send('join_room', { roomId });
    await guest.waitFor('room_joined');
    guest.send('select_faction', { factionId: 'free_confederation', ships: ['confed_falcon'] });

    host.send('player_ready', { isReady: true });
    guest.send('player_ready', { isReady: true });

    // Wait for game_start so isStarted = true on server
    await host.waitFor('game_start', 8_000);
    await guest.waitFor('game_start', 8_000);

    // Guest disconnects mid-battle
    guest.close();
    await host.waitFor('player_left', 3_000);
    const disconnected = await host.waitFor('player_disconnected', 3_000);

    expect((disconnected.payload as any).inBattle).toBe(true);
    host.close();
  });
});
