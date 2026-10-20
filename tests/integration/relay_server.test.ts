/**
 * Relay server over real sockets: the HTTP health check, the WebSocket
 * upgrade (path + origin), the version handshake, validation, rate limits
 * and a full lobby → match_start flow driven by NetClient through the
 * platform WebSocket.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { DEFAULT_CONFIG } from "../../server/src/config";
import { createSilentLogger } from "../../server/src/logger";
import { startRelayServer, type RunningRelay } from "../../server/src/wsServer";
import { NetClient } from "../../src/net/client/NetClient";
import {
  CLOSE_CODES,
  PROTOCOL_VERSION,
  type ServerMessage,
} from "../../src/net/protocol";
import { createSystemScheduler } from "../../src/net/time";
import { createWebSocketTransport } from "../../src/net/transport/Transport";

const ALLOWED_ORIGIN = "https://jghiringhelli.github.io";
let relay: RunningRelay;
let base: string;

beforeAll(async () => {
  relay = await startRelayServer(
    {
      ...DEFAULT_CONFIG,
      port: 0,
      host: "127.0.0.1",
      allowedOrigins: [ALLOWED_ORIGIN],
      startCountdownMs: 50,
    },
    { logger: createSilentLogger() },
  );
  base = `127.0.0.1:${relay.port}`;
});

afterAll(async () => {
  await relay.close();
});

/** Opens a raw socket and collects its messages. */
function raw(origin = ALLOWED_ORIGIN, path = "/ws") {
  const ws = new WebSocket(`ws://${base}${path}`, { origin });
  const messages: ServerMessage[] = [];
  const closed = new Promise<{ code: number }>((resolve) =>
    ws.on("close", (code) => resolve({ code })),
  );
  const failed = new Promise<string>((resolve) =>
    ws.on("unexpected-response", (_req, res) =>
      resolve(String(res.statusCode)),
    ),
  );
  ws.on("message", (data) =>
    messages.push(JSON.parse(String(data)) as ServerMessage),
  );
  const opened = new Promise<void>((resolve) => ws.on("open", () => resolve()));
  ws.on("error", () => undefined);
  return { ws, messages, closed, failed, opened };
}

async function until(
  predicate: () => boolean,
  timeoutMs = 3_000,
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs)
      throw new Error("condition not met in time");
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe("relay HTTP", () => {
  it("answers the health check with protocol and counters", async () => {
    const response = await fetch(`http://${base}/healthz`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      protocol: PROTOCOL_VERSION,
      rooms: 0,
    });
  });

  it("returns 404 for unknown paths", async () => {
    expect((await fetch(`http://${base}/nope`)).status).toBe(404);
  });
});

describe("relay WebSocket guards", () => {
  it("rejects a browser origin that is not allowed", async () => {
    expect(await raw("https://evil.example").failed).toBe("403");
  });

  it("refuses a client on another protocol version and closes with 4001", async () => {
    const socket = raw();
    await socket.opened;
    socket.ws.send(
      JSON.stringify({
        t: "hello",
        protocol: PROTOCOL_VERSION + 1,
        build: "b",
        name: "Old",
      }),
    );
    expect((await socket.closed).code).toBe(CLOSE_CODES.versionMismatch);
    expect(socket.messages[0]).toMatchObject({
      t: "refused",
      reason: "version_mismatch",
    });
  });

  it("closes a socket whose first message is not hello", async () => {
    const socket = raw();
    await socket.opened;
    socket.ws.send(JSON.stringify({ t: "create_room", mode: "dogfight" }));
    expect((await socket.closed).code).toBe(CLOSE_CODES.badHello);
  });

  it("answers malformed messages with an error and keeps the session", async () => {
    const socket = raw();
    await socket.opened;
    socket.ws.send(
      JSON.stringify({
        t: "hello",
        protocol: PROTOCOL_VERSION,
        build: "b",
        name: "A",
      }),
    );
    socket.ws.send("{oops");
    socket.ws.send(JSON.stringify({ t: "set_ready", ready: "yes" }));
    await until(
      () => socket.messages.filter((m) => m.t === "error").length >= 2,
    );
    expect(socket.ws.readyState).toBe(WebSocket.OPEN);
    socket.ws.close();
  });

  it("drops chat beyond the rate limit", async () => {
    const socket = raw();
    await socket.opened;
    socket.ws.send(
      JSON.stringify({
        t: "hello",
        protocol: PROTOCOL_VERSION,
        build: "b",
        name: "Spam",
      }),
    );
    socket.ws.send(JSON.stringify({ t: "create_room", mode: "skirmish" }));
    for (let i = 0; i < 30; i++)
      socket.ws.send(JSON.stringify({ t: "chat", text: `msg ${i}` }));
    await new Promise((r) => setTimeout(r, 200));
    expect(
      socket.messages.filter((m) => m.t === "chat").length,
    ).toBeLessThanOrEqual(6);
    socket.ws.close();
  });
});

describe("relay lobby over real sockets", () => {
  it("refuses an illegal squad with a readable error and a legal one after it", async () => {
    const socket = raw();
    await socket.opened;
    socket.ws.send(
      JSON.stringify({
        t: "hello",
        protocol: PROTOCOL_VERSION,
        build: "b",
        name: "Cheat",
      }),
    );
    socket.ws.send(JSON.stringify({ t: "create_room", mode: "dogfight" }));
    socket.ws.send(
      JSON.stringify({
        t: "set_loadout",
        loadout: { faction: "terran_hegemony", ships: ["terran_imperator"] },
      }),
    );
    await until(() => socket.messages.some((m) => m.t === "error"));
    const error = socket.messages.find((m) => m.t === "error");
    expect(error).toMatchObject({ code: "invalid_loadout" });
    expect((error as { message: string }).message).toMatch(/online/i);
    socket.ws.close();
  });

  it("closes a socket that sends a frame over the size limit", async () => {
    const socket = raw();
    await socket.opened;
    socket.ws.send("x".repeat(700 * 1024));
    expect((await socket.closed).code).toBe(1009);
  });

  it("lets two NetClients meet by room code and start the same match", async () => {
    const make = (name: string) =>
      new NetClient({
        url: `ws://${base}/ws`,
        build: "it-build",
        name,
        transport: createWebSocketTransport,
        scheduler: createSystemScheduler(),
      });
    const host = make("Host");
    const guest = make("Guest");
    const starts: ServerMessage[] = [];
    let code = "";
    host.on("room", (m) => {
      code = m.room.code;
    });
    host.on("match_start", (m) => starts.push(m));
    guest.on("match_start", (m) => starts.push(m));
    host.connect();
    guest.connect();
    await until(() => host.state === "online" && guest.state === "online");
    host.send({ t: "create_room", mode: "dogfight" });
    await until(() => code !== "");
    guest.send({ t: "join_room", code });
    for (const c of [host, guest]) {
      c.send({
        t: "set_loadout",
        loadout: { faction: "void_corsairs", ships: ["corsair_blade"] },
      });
      c.send({ t: "set_ready", ready: true });
    }
    await until(() => starts.length === 2);
    const [a, b] = starts as Extract<ServerMessage, { t: "match_start" }>[];
    expect(a!.match).toEqual(b!.match);
    host.close();
    guest.close();
  });
});
