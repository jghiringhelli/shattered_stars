/**
 * P2P Server Integration Tests
 *
 * Tests the WebSocket server protocol directly using ws clients.
 * Covers room lifecycle, game_start seed distribution, game_action
 * relay, echo prevention, and disconnect handling.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";
import { spawn, type ChildProcess } from "child_process";
import { resolve } from "path";

// ── Constants ─────────────────────────────────────────────────────────────────

const PORT = 19898; // Dedicated integration-test port
const SCRIPT = resolve(process.cwd(), "scripts/p2p_server.ts");

// ── Server lifecycle ──────────────────────────────────────────────────────────

function startServer(): Promise<ChildProcess> {
  return new Promise((resolveP, rejectP) => {
    const proc = spawn("npx", ["tsx", SCRIPT, "--port", String(PORT)], {
      shell: true,
      stdio: ["ignore", "pipe", "pipe"], // pipe stderr to capture startup errors
    });

    let started = false;
    proc.stdout!.on("data", (chunk: Buffer) => {
      if (!started && chunk.toString().includes("listening")) {
        started = true;
        resolveP(proc);
      }
    });
    proc.stderr!.on("data", (chunk: Buffer) => {
      // Only reject on obvious fatal startup errors, not TypeScript warnings
      const text = chunk.toString();
      if (!started && text.includes("Error") && text.includes("Cannot find")) {
        rejectP(new Error(`Server startup error: ${text.slice(0, 200)}`));
      }
    });
    proc.on("error", rejectP);
    proc.on("exit", (code) => {
      if (!started && code !== null && code !== 0) {
        rejectP(new Error(`Server exited before ready (code ${code})`));
      }
    });
    setTimeout(() => {
      if (!started) rejectP(new Error("Server did not start within 25 s"));
    }, 25_000);
  });
}

// ── WebSocket client helpers ──────────────────────────────────────────────────

interface ServerMessage {
  type: string;
  payload: unknown;
  senderId?: string;
}

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

    ws.on("message", (raw: Buffer) => {
      const msg = JSON.parse(raw.toString()) as ServerMessage;
      const handlers = waiters.get(msg.type);
      if (handlers?.length) {
        handlers.shift()!(msg);
        if (!handlers.length) waiters.delete(msg.type);
      } else {
        queue.push(msg);
      }
    });
    ws.on("error", rejectP);
    ws.on("open", () => {
      resolveP({
        messages: queue,
        send(type, payload) {
          ws.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
        },
        waitFor(type, timeout = 5_000) {
          const buffered = queue.findIndex((m) => m.type === type);
          if (buffered !== -1)
            return Promise.resolve(queue.splice(buffered, 1)[0]);
          return new Promise<ServerMessage>((res, rej) => {
            const timer = setTimeout(() => {
              const list = waiters.get(type);
              if (list) {
                const i = list.indexOf(handler);
                if (i !== -1) list.splice(i, 1);
              }
              rej(new Error(`Timeout waiting for '${type}'`));
            }, timeout);
            const handler = (m: ServerMessage) => {
              clearTimeout(timer);
              res(m);
            };
            if (!waiters.has(type)) waiters.set(type, []);
            waiters.get(type)!.push(handler);
          });
        },
        close() {
          ws.close();
        },
      });
    });
  });
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("P2P Server — protocol integration", () => {
  let server: ChildProcess | undefined;

  beforeAll(async () => {
    server = await startServer();
  }, 30_000);
  afterAll(
    () =>
      new Promise<void>((done) => {
        if (!server) {
          done();
          return;
        }
        if (process.platform === "win32" && server.pid) {
          // On Windows, shell:true spawns cmd.exe which shells node. proc.kill() only
          // kills cmd.exe; the child node process outlives it and holds the port.
          // taskkill /F /T kills the entire process tree. We await completion so the
          // port is freed before the next test run starts.
          const killer = spawn(
            "taskkill",
            ["/f", "/t", "/pid", String(server.pid)],
            { shell: true },
          );
          killer.on("close", () => done());
          killer.on("error", () => done());
        } else {
          server.kill();
          done();
        }
      }),
  );

  it("host creates a room and receives room_created", async () => {
    const host = await connectClient();
    host.send("create_room", {
      name: "TestRoom",
      maxPlayers: 2,
      gameMode: "arcade",
    });
    const msg = await host.waitFor("room_created");
    const room = (msg.payload as any).room;
    expect(room.name).toBe("TestRoom");
    expect(room.playerCount).toBe(1);

    // Regression: the client's self-generated playerId never matches the
    // server's connection-assigned id, so identity checks like
    // `player.id === localId` silently failed against a real server until
    // room_created/room_joined started echoing back the server's own id.
    const yourPlayerId = (msg.payload as any).yourPlayerId;
    expect(yourPlayerId).toBeTruthy();
    expect(room.hostId).toBe(yourPlayerId);
    expect(room.players[0].id).toBe(yourPlayerId);

    host.close();
  });

  it("guest joins host room and both receive player_joined", async () => {
    const host = await connectClient();
    host.send("create_room", {
      name: "JoinTest",
      maxPlayers: 2,
      gameMode: "arcade",
    });
    const created = await host.waitFor("room_created");
    const roomId = (created.payload as any).room.id as string;

    const guest = await connectClient();
    guest.send("join_room", { roomId });
    const joined = await guest.waitFor("room_joined");
    const hostJoin = await host.waitFor("player_joined");

    expect((joined.payload as any).room.playerCount).toBe(2);
    expect(hostJoin.payload).toBeDefined();

    const guestPlayerId = (joined.payload as any).yourPlayerId;
    expect(guestPlayerId).toBeTruthy();
    const guestEntry = (joined.payload as any).room.players.find(
      (p: any) => p.id === guestPlayerId,
    );
    expect(guestEntry).toBeDefined();

    host.close();
    guest.close();
  });

  it("select_faction with ships is reflected in room_update", async () => {
    const host = await connectClient();
    host.send("create_room", {
      name: "FactionTest",
      maxPlayers: 2,
      gameMode: "arcade",
    });
    const created = await host.waitFor("room_created");
    const roomId = (created.payload as any).room.id as string;

    host.send("select_faction", {
      factionId: "terran_hegemony",
      ships: ["terran_gladius", "terran_viper"],
    });
    // Drain the room_created room_update first, then get the faction change one
    await host.waitFor("room_update"); // initial room broadcast
    const update = await host.waitFor("room_update");

    const players: any[] = (update.payload as any).players;
    const hostPlayer = players.find((p: any) => p.isHost);
    expect(hostPlayer?.factionId).toBe("terran_hegemony");
    expect(hostPlayer?.ships).toEqual(["terran_gladius", "terran_viper"]);
    host.close();
  });

  it("game_start is broadcast with seed and ships when all players ready", async () => {
    const host = await connectClient();
    host.send("create_room", {
      name: "ReadyTest",
      maxPlayers: 2,
      gameMode: "arcade",
    });
    const created = await host.waitFor("room_created");
    const roomId = (created.payload as any).room.id as string;

    host.send("select_faction", {
      factionId: "terran_hegemony",
      ships: ["terran_gladius"],
    });
    await host.waitFor("room_update"); // initial
    await host.waitFor("room_update"); // faction

    const guest = await connectClient();
    guest.send("join_room", { roomId });
    await guest.waitFor("room_joined");
    await host.waitFor("player_joined");
    await host.waitFor("room_update"); // join broadcast

    guest.send("select_faction", {
      factionId: "free_confederation",
      ships: ["confed_falcon"],
    });
    await guest.waitFor("room_update");
    await host.waitFor("room_update");

    host.send("player_ready", { isReady: true });
    await host.waitFor("room_update");
    await guest.waitFor("room_update");

    guest.send("player_ready", { isReady: true });

    const hostStart = await host.waitFor("game_start");
    const guestStart = await guest.waitFor("game_start");

    const hostSeed = (hostStart.payload as any).seed as number;
    const guestSeed = (guestStart.payload as any).seed as number;
    expect(typeof hostSeed).toBe("number");
    expect(hostSeed).toBe(guestSeed); // same seed on both clients

    const hostPlayers: any[] = (hostStart.payload as any).players;
    expect(
      hostPlayers.some((p: any) => p.ships?.includes("terran_gladius")),
    ).toBe(true);
    expect(
      hostPlayers.some((p: any) => p.ships?.includes("confed_falcon")),
    ).toBe(true);

    host.close();
    guest.close();
  });

  it("game_action is relayed to opponent but NOT echoed to sender", async () => {
    const host = await connectClient();
    host.send("create_room", {
      name: "ActionTest",
      maxPlayers: 2,
      gameMode: "arcade",
    });
    const created = await host.waitFor("room_created");
    const roomId = (created.payload as any).room.id as string;
    host.send("select_faction", {
      factionId: "terran_hegemony",
      ships: ["terran_gladius"],
    });
    await host.waitFor("room_update");
    await host.waitFor("room_update");

    const guest = await connectClient();
    guest.send("join_room", { roomId });
    await guest.waitFor("room_joined");
    await host.waitFor("player_joined");
    await host.waitFor("room_update");
    guest.send("select_faction", {
      factionId: "free_confederation",
      ships: ["confed_falcon"],
    });
    await guest.waitFor("room_update");
    await host.waitFor("room_update");

    host.send("player_ready", { isReady: true });
    await host.waitFor("room_update");
    await guest.waitFor("room_update");
    guest.send("player_ready", { isReady: true });
    await host.waitFor("game_start");
    await guest.waitFor("game_start");

    // Host sends game_action
    host.send("game_action", {
      type: "submit_maneuvers",
      data: { maneuvers: [] },
    });

    // Guest receives it
    const relayed = await guest.waitFor("game_action");
    expect(relayed.payload).toBeDefined();

    // Host should NOT receive its own action (wait briefly then check queue)
    await new Promise((r) => setTimeout(r, 300));
    const echoed = host.messages.find((m) => m.type === "game_action");
    expect(echoed).toBeUndefined();

    host.close();
    guest.close();
  });

  it("remaining player receives player_left when opponent disconnects", async () => {
    const host = await connectClient();
    host.send("create_room", {
      name: "DiscoTest",
      maxPlayers: 2,
      gameMode: "arcade",
    });
    const created = await host.waitFor("room_created");
    const roomId = (created.payload as any).room.id as string;

    const guest = await connectClient();
    guest.send("join_room", { roomId });
    await guest.waitFor("room_joined");
    await host.waitFor("player_joined");
    await host.waitFor("room_update");

    guest.close();
    const left = await host.waitFor("player_left", 3_000);
    expect(left.payload).toBeDefined();

    host.close();
  });

  it("player_disconnected with inBattle=true is broadcast when game is started", async () => {
    // Full ready flow: create → join → factions → both ready → game_start
    const host = await connectClient();
    host.send("create_room", {
      name: "InBattleTest",
      maxPlayers: 2,
      gameMode: "arcade",
    });
    const created = await host.waitFor("room_created");
    const roomId = (created.payload as any).room.id as string;
    host.send("select_faction", {
      factionId: "terran_hegemony",
      ships: ["terran_gladius"],
    });

    const guest = await connectClient();
    guest.send("join_room", { roomId });
    await guest.waitFor("room_joined");
    guest.send("select_faction", {
      factionId: "free_confederation",
      ships: ["confed_falcon"],
    });

    host.send("player_ready", { isReady: true });
    guest.send("player_ready", { isReady: true });

    // Wait for game_start so isStarted = true on server
    await host.waitFor("game_start", 8_000);
    await guest.waitFor("game_start", 8_000);

    // Guest disconnects mid-battle
    guest.close();
    await host.waitFor("player_left", 3_000);
    const disconnected = await host.waitFor("player_disconnected", 3_000);

    expect((disconnected.payload as any).inBattle).toBe(true);
    host.close();
  });

  it("late joiner receives battle_snapshot and can claim a ship", async () => {
    // Full start flow: host creates, guest joins, both faction+ready → game_start
    const host = await connectClient();
    host.send("create_room", {
      name: "LateJoinTest",
      maxPlayers: 4,
      gameMode: "arcade",
    });
    const created = await host.waitFor("room_created");
    const roomId = (created.payload as any).room.id as string;
    host.send("select_faction", {
      factionId: "terran_hegemony",
      ships: ["terran_gladius"],
    });

    const guest = await connectClient();
    guest.send("join_room", { roomId });
    await guest.waitFor("room_joined");
    guest.send("select_faction", {
      factionId: "free_confederation",
      ships: ["confed_falcon"],
    });

    host.send("player_ready", { isReady: true });
    guest.send("player_ready", { isReady: true });
    await host.waitFor("game_start", 8_000);
    await guest.waitFor("game_start", 8_000);

    // Host sends an end-of-turn snapshot (as if the scene called sendBattleSnapshot)
    const fakeSnapshot = {
      version: 1,
      baseSeed: 12345,
      turnNumber: 1,
      ships: [],
      capturedAt: Date.now(),
    };
    host.send("update_snapshot", fakeSnapshot);
    // Give the server a moment to store the snapshot before the late joiner arrives
    await new Promise<void>((r) => setTimeout(r, 150));

    // A third player joins the already-started room
    const lateJoiner = await connectClient();
    lateJoiner.send("join_room", { roomId });
    await lateJoiner.waitFor("room_joined");

    // Late joiner should immediately receive the stored battle snapshot
    const snap = await lateJoiner.waitFor("battle_snapshot", 3_000);
    expect((snap.payload as any).version).toBe(1);
    expect((snap.payload as any).turnNumber).toBe(1);
    expect((snap.payload as any).baseSeed).toBe(12345);

    // Late joiner claims an AI ship
    lateJoiner.send("claim_ship", { shipId: "ship_terran_0" });

    // Both original players are notified of the claim
    const hostClaim = await host.waitFor("ship_claimed", 3_000);
    expect((hostClaim.payload as any).shipId).toBe("ship_terran_0");

    const guestClaim = await guest.waitFor("ship_claimed", 3_000);
    expect((guestClaim.payload as any).shipId).toBe("ship_terran_0");

    // Claiming must actually grant control: a claimed-but-not-owned ship
    // would otherwise be silently rejected by game_action's actor check.
    lateJoiner.send("game_action", {
      shipId: "ship_terran_0",
      maneuver: "straight",
    });
    const relayedAction = await host.waitFor("game_action", 3_000);
    expect((relayedAction.payload as any).shipId).toBe("ship_terran_0");

    // A second player trying to claim the same ship must be rejected —
    // otherwise two players could each believe they control it.
    guest.send("claim_ship", { shipId: "ship_terran_0" });
    const rejection = await guest.waitFor("error", 3_000);
    expect((rejection.payload as any).message).toMatch(/already claimed/i);

    host.close();
    guest.close();
    lateJoiner.close();
  });
});
